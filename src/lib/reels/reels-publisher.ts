import { prisma } from '@/lib/db';
import { FacebookService } from '@/services/facebook.service';
import { generateCompleteReelVideo, GeneratedReelResult } from './reel-video-generator';
import { checkAgainstPublishedHistory, isNewsTooOld } from '@/lib/news/news-similarity-engine';
import { stripExternalSources } from '@/lib/content/content-generator';
import fs from 'fs';

// İşlem bazlı eşzamanlılık kilidi (Aynı anda iki Reel render edilmesini önler)
const reelProcessLock = new Set<string>();

export interface ReelPublishWorkflowResult {
  success: boolean;
  step: 'SEÇİLDİ' | 'SENARYO_HAZIRLANDI' | 'VİDEO_ÜRETİLİYOR' | 'KALİTE_KONTROLÜ' | 'YAYIN_KUYRUĞU' | 'YAYINLANDI' | 'HATA';
  newsId?: string;
  contentId?: string;
  title?: string;
  facebookPostId?: string;
  durationSeconds?: number;
  qualityMetrics?: any;
  error?: string;
  skippedReason?: string;
}

/**
 * Otomatik AI Reels Seçim, Üretim ve Facebook Yayın Modülü
 * 
 * Mevcut haber analiz motorunun ürettiği sonuçları ve AI skorlarını kullanarak
 * en yüksek etkileşim potansiyeline sahip haberi seçer, profesyonel dikey 9:16
 * video üretir, kalite testlerini yapar ve Facebook Reels olarak yayınlar.
 */
export async function runAutonomousReelWorkflow(options?: {
  force?: boolean;
  targetNewsId?: string;
}): Promise<ReelPublishWorkflowResult> {
  const result: ReelPublishWorkflowResult = {
    success: false,
    step: 'SEÇİLDİ'
  };

  const force = options?.force || false;

  try {
    // 1. ZAMANLAYICI & KOTA GÜVENLİK KONTROLLERİ
    // Günlük Maksimum 3 Reels (Kural 7 gereği)
    const MAX_DAILY_REELS = 3;
    const MIN_COOLDOWN_MINUTES = 180; // İki Reel arası en az 3 saat (EdgeRank keşfet koruması)

    const nowTurkey = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const startOfTodayTurkey = new Date(nowTurkey);
    startOfTodayTurkey.setHours(0, 0, 0, 0);

    const todayReelsCount = await prisma.content.count({
      where: {
        type: 'REELS_SCRIPT',
        status: 'PUBLISHED',
        publishedAt: { gte: startOfTodayTurkey }
      }
    });

    if (!force && todayReelsCount >= MAX_DAILY_REELS) {
      console.log(`[ReelsPublisher] Daily Cap reached: ${todayReelsCount}/${MAX_DAILY_REELS} Reels published today.`);
      return {
        ...result,
        skippedReason: `Günlük maksimum ${MAX_DAILY_REELS} Reels kotasına ulaşıldı (${todayReelsCount} yayınlandı). Sayfa algoritmasını korumak için yayın bekletiliyor.`
      };
    }

    // Algoritmik Soğuma Kontrolü (Pacing Guard)
    const lastPublishedReel = await prisma.content.findFirst({
      where: {
        type: 'REELS_SCRIPT',
        status: 'PUBLISHED',
        publishedAt: { not: null }
      },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true, title: true }
    });

    if (!force && lastPublishedReel?.publishedAt) {
      const minutesSince = Math.floor((Date.now() - new Date(lastPublishedReel.publishedAt).getTime()) / (60 * 1000));
      if (minutesSince < MIN_COOLDOWN_MINUTES) {
        console.log(`[ReelsPublisher] Pacing Guard: Last Reel was published ${minutesSince}m ago (< ${MIN_COOLDOWN_MINUTES}m).`);
        return {
          ...result,
          skippedReason: `İki Reels arası en az ${MIN_COOLDOWN_MINUTES} dakika soğuma bekleniyor (Son paylaşımdan bu yana ${minutesSince} dk geçti).`
        };
      }
    }

    // 2. OTOMATİK HABER SEÇİMİ (Kural 2)
    // Mevcut AI analiz motorunun önem (>=70) ve viral skorunu kullanır
    const candidateLookback = new Date(Date.now() - 48 * 60 * 60 * 1000);

    let candidateNews: any = null;

    if (options?.targetNewsId) {
      candidateNews = await prisma.news.findUnique({
        where: { id: options.targetNewsId },
        include: { source: true, content: true }
      });
    } else {
      // Otomatik havuzdan en kaliteli taze haberi seç
      const candidates = await prisma.news.findMany({
        where: {
          isProcessed: true,
          OR: [
            { isTrabzonsporRelated: true },
            { isTrabzonsporRelated: null }
          ],
          aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
          importanceScore: { gte: 70 },
          publishedAt: { gte: candidateLookback }
        },
        include: { source: true, content: true },
        orderBy: [
          { importanceScore: 'desc' },
          { viralScore: 'desc' }
        ],
        take: 15
      });

      // Geçmiş yayın ve mükerrerlik kontrolü uygula
      for (const item of candidates) {
        // Eğer bu haber zaten bir REELS olarak yayınlanmışsa atla
        if (item.content?.type === 'REELS_SCRIPT' && item.content?.status === 'PUBLISHED') {
          continue;
        }

        // Son 7 günde yayınlananlarla benzerlik kontrolü
        const history = await checkAgainstPublishedHistory(
          { id: item.id, title: item.title, summary: item.summary || item.aiSummary },
          7
        );
        if (!history.isDuplicate) {
          candidateNews = item;
          break;
        }
      }
    }

    if (!candidateNews) {
      console.log("[ReelsPublisher] No suitable high-scoring candidate news found for Reels.");
      return {
        ...result,
        skippedReason: "Yayınlanmaya uygun yüksek puanlı (70+) taze haber bulunamadı. Zorla içerik üretilmedi."
      };
    }

    const newsId = candidateNews.id;
    if (reelProcessLock.has(newsId)) {
      return { ...result, skippedReason: "Bu haber şu anda başka bir işlem tarafından üretiliyor." };
    }

    reelProcessLock.add(newsId);
    result.newsId = newsId;
    result.title = candidateNews.title;

    // DURUM: SEÇİLDİ
    console.log(`[ReelsPublisher] ✅ STEP 1: SEÇİLDİ -> "${candidateNews.title}" (Score: ${candidateNews.importanceScore})`);
    result.step = 'SEÇİLDİ';

    // Geçici İçerik Kaydı Oluştur veya Mevcut Kaydı Güncelle (State Machine takibi için)
    let contentRecord: any;
    if (candidateNews.content && candidateNews.content.id) {
      contentRecord = await prisma.content.update({
        where: { id: candidateNews.content.id },
        data: {
          title: stripExternalSources(candidateNews.title),
          body: candidateNews.summary || candidateNews.aiSummary || candidateNews.title,
          type: 'REELS_SCRIPT',
          status: 'DRAFT',
          qualityScore: candidateNews.importanceScore || 85,
          viralScore: candidateNews.viralScore || 85,
          aiReasoning: 'DURUM: SEÇİLDİ -> Senaryo oluşturuluyor...'
        }
      });
    } else {
      contentRecord = await prisma.content.create({
        data: {
          title: stripExternalSources(candidateNews.title),
          body: candidateNews.summary || candidateNews.aiSummary || candidateNews.title,
          type: 'REELS_SCRIPT',
          status: 'DRAFT',
          sourceNewsId: candidateNews.id,
          qualityScore: candidateNews.importanceScore || 85,
          viralScore: candidateNews.viralScore || 85,
          aiReasoning: 'DURUM: SEÇİLDİ -> Senaryo oluşturuluyor...'
        }
      });
    }
    result.contentId = contentRecord.id;

    // DURUM: SENARYO HAZIRLANIYOR & VİDEO ÜRETİLİYOR
    result.step = 'SENARYO_HAZIRLANDI';
    await prisma.content.update({
      where: { id: contentRecord.id },
      data: { aiReasoning: 'DURUM: SENARYO_HAZIRLANDI -> Video ve ses render ediliyor...' }
    });

    result.step = 'VİDEO_ÜRETİLİYOR';
    console.log(`[ReelsPublisher] ⚙️ STEP 2 & 3: VİDEO_ÜRETİLİYOR -> 1080x1920 MP4 & Türkçe Seslendirme`);

    let reelResult: GeneratedReelResult;
    try {
      reelResult = await generateCompleteReelVideo({
        title: candidateNews.title,
        summary: candidateNews.summary || candidateNews.aiSummary,
        body: candidateNews.summary || candidateNews.aiSummary,
        imageUrl: candidateNews.imageUrl,
        sourceNewsId: candidateNews.id,
        category: candidateNews.aiRecommendedContentType
      });
    } catch (genErr: any) {
      result.step = 'HATA';
      result.error = `Video üretim hatası: ${genErr.message}`;
      await prisma.content.update({
        where: { id: contentRecord.id },
        data: {
          status: 'FAILED',
          aiReasoning: `[HATA - VİDEO ÜRETİMİ]: ${genErr.message}`
        }
      });
      return result;
    }

    result.durationSeconds = reelResult.durationSeconds;

    // DURUM: KALİTE KONTROLÜ
    result.step = 'KALİTE_KONTROLÜ';
    console.log(`[ReelsPublisher] 🔍 STEP 4: KALİTE_KONTROLÜ -> Dosya boyutu, çözünürlük ve ses doğrulanıyor...`);

    if (!reelResult.qualityResult.passed) {
      result.step = 'HATA';
      result.error = `Kalite kontrolünden geçemedi: ${reelResult.qualityResult.errors.join(', ')}`;
      await prisma.content.update({
        where: { id: contentRecord.id },
        data: {
          status: 'FAILED',
          aiReasoning: `[HATA - KALİTE KONTROLÜ]: ${reelResult.qualityResult.errors.join(', ')}`
        }
      });
      return result;
    }

    result.qualityMetrics = reelResult.qualityResult.metrics;

    // DURUM: YAYIN KUYRUĞU
    result.step = 'YAYIN_KUYRUĞU';
    await prisma.content.update({
      where: { id: contentRecord.id },
      data: {
        body: reelResult.scriptData.fullNarration,
        status: 'READY_TO_PUBLISH',
        aiReasoning: `DURUM: YAYIN_KUYRUĞU -> Kalite kontrolü onaylandı (${reelResult.durationSeconds}s, ${Math.round((reelResult.qualityResult.metrics?.fileSizeBytes || 0)/1024)}KB). Facebook Meta Reels API'ye gönderiliyor...`
      }
    });

    // DURUM: FACEBOOK YAYINLAMA
    console.log(`[ReelsPublisher] 🚀 STEP 5: Facebook Meta video_reels API'ye yükleniyor...`);
    const fbRes = await FacebookService.publishReel(
      reelResult.videoBuffer,
      reelResult.scriptData.facebookCaption,
      `reel_lock_${newsId}`
    );

    if (!fbRes.success || !fbRes.postId) {
      result.step = 'HATA';
      result.error = 'Facebook Reels API yanıt vermedi veya yükleme başarısız oldu.';
      await prisma.content.update({
        where: { id: contentRecord.id },
        data: {
          status: 'FAILED',
          aiReasoning: `[HATA - META REELS API]: Facebook Reels paylaşımı başarısız oldu.`
        }
      });
      return result;
    }

    // DURUM: YAYINLANDI
    result.step = 'YAYINLANDI';
    result.success = true;
    result.facebookPostId = fbRes.postId;

    await prisma.content.update({
      where: { id: contentRecord.id },
      data: {
        status: 'PUBLISHED',
        facebookPostId: fbRes.postId,
        publishedAt: new Date(),
        aiReasoning: `DURUM: YAYINLANDI ✅ | Facebook Post ID: ${fbRes.postId} | Süre: ${reelResult.durationSeconds}s | Kalite Testleri: 100% Geçti`
      }
    });

    console.log(`[ReelsPublisher] 🎉 STEP 6: YAYINLANDI! Reel Post ID: ${fbRes.postId}`);

    // Geçici video dosyasını temizle
    try {
      if (fs.existsSync(reelResult.videoFilePath)) {
        fs.unlinkSync(reelResult.videoFilePath);
      }
    } catch {}

    return result;

  } catch (fatalErr: any) {
    console.error("[ReelsPublisher] Fatal workflow error:", fatalErr);
    result.step = 'HATA';
    result.error = fatalErr.message;
    return result;
  } finally {
    if (result.newsId) {
      reelProcessLock.delete(result.newsId);
    }
  }
}
