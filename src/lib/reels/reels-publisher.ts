import { prisma } from '@/lib/db';
import { FacebookService } from '@/services/facebook.service';
import { generateCompleteReelVideo, GeneratedReelResult } from './reel-video-generator';
import { checkAgainstPublishedHistory, isNewsTooOld, deduplicateNewsBatch } from '@/lib/news/news-similarity-engine';
import { stripExternalSources } from '@/lib/content/content-generator';
import { SmartPublisher } from '@/lib/content/smart-publisher';
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
 */
async function tryScrapeArticleImage(articleUrl?: string | null): Promise<string | null> {
  if (!articleUrl || !articleUrl.startsWith('http')) return null;
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BordoMaviNews/2.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
      if (match && match[1] && match[1].startsWith('http')) {
        return match[1];
      }
    }
  } catch (err: any) {
    console.warn(`[ReelsPublisher] Could not scrape image from ${articleUrl}:`, err.message);
  }
  return null;
}

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
    // 1. KESİN GÜNLÜK REELS YAYIN TAKVİMİ DENETİMİ (07:00, 15:00 ve 20:30)
    const quotaInfo = await SmartPublisher.getPublishingQuota();

    if (!force && (quotaInfo.quota <= 0 || quotaInfo.allowedType !== 'REELS')) {
      console.log(`[ReelsPublisher] Takvim Koruması: Reels sadece 07:00, 15:00 ve 20:30 saatlerinde yayınlanır. (${quotaInfo.reason})`);
      return {
        ...result,
        skippedReason: quotaInfo.reason
      };
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
      if (candidateNews && (!candidateNews.imageUrl || !candidateNews.imageUrl.startsWith('http'))) {
        const scrapedImg = await tryScrapeArticleImage(candidateNews.url);
        if (scrapedImg) {
          candidateNews.imageUrl = scrapedImg;
          await prisma.news.update({
            where: { id: candidateNews.id },
            data: { imageUrl: scrapedImg }
          });
        }
      }
    } else {
      // Otomatik havuzdan görsel materyali tam, en kaliteli taze haberi seç (Kural 2)
      const candidates = await prisma.news.findMany({
        where: {
          isProcessed: true,
          OR: [
            { isTrabzonsporRelated: true },
            { isTrabzonsporRelated: null }
          ],
          aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
          importanceScore: { gte: 70 },
          publishedAt: { gte: candidateLookback },
          imageUrl: { not: null }
        },
        include: { source: true, content: true },
        orderBy: [
          { importanceScore: 'desc' },
          { viralScore: 'desc' }
        ],
        take: 20
      });

      // Konu, varlık ve semantik benzerlik motoru ile aday havuzunu tekilleştir (Aynı konudan birden fazla haber alınmaz)
      const { uniqueNews: distinctCandidates } = deduplicateNewsBatch(candidates);

      // Geçmiş yayın, mükerrerlik ve görsel geçerlilik kontrolü uygula
      for (const item of distinctCandidates) {
        // Görsel materyali yetersiz veya sahte linkli haberleri kesinlikle alma (Kural 2)
        if (!item.imageUrl || !item.imageUrl.startsWith('http') || item.imageUrl.length < 15) {
          continue;
        }

        // Eğer bu haber daha önce HERHANGİ bir şekilde (Reels veya Metin) yayınlandıysa KESİNLİKLE ATLA
        if (item.content?.status === 'PUBLISHED' || item.content?.facebookPostId) {
          continue;
        }

        const wasEverPublished = await prisma.content.findFirst({
          where: {
            sourceNewsId: item.id,
            OR: [
              { status: 'PUBLISHED' },
              { facebookPostId: { not: null } }
            ]
          }
        });
        if (wasEverPublished) {
          continue;
        }

        // Son 60 günde yayınlanan tüm haberlerle benzerlik kontrolü
        const history = await checkAgainstPublishedHistory(
          { id: item.id, title: item.title, summary: item.summary || item.aiSummary },
          60
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
        category: candidateNews.aiRecommendedContentType,
        skipHistoryCheck: force
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

    if (quotaInfo.activeSlotId) {
      await SmartPublisher.markSlotPublished(quotaInfo.activeSlotId, quotaInfo.dateKey);
    }

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
