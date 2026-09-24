import { prisma } from '@/lib/db';
import { FacebookService } from '@/services/facebook.service';
import { isNewsTooOld, checkAgainstPublishedHistory } from '@/lib/news/news-similarity-engine';

const publishingIds = new Set<string>();

export async function publishReadyContent(limit: number = 1) {
  const result = {
    success: true,
    requested: limit,
    processed: 0,
    failed: 0,
    results: [] as any[]
  };

  try {
    // 1. Algoritmik Soğuma (Pacing Guard) Denetimi:
    // Facebook EdgeRank algoritmasını korumak için iki otonom gönderi arası en az 90 dakika beklenir.
    const lastPublished = await prisma.content.findFirst({
      where: {
        status: 'PUBLISHED',
        publishedAt: { not: null }
      },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true, title: true }
    });

    if (lastPublished?.publishedAt) {
      const minutesSince = Math.floor((Date.now() - new Date(lastPublished.publishedAt).getTime()) / (60 * 1000));
      if (minutesSince < 90) {
        console.log(`[Content Publisher] Pacing Guard: Last post "${lastPublished.title}" was published ${minutesSince}m ago (< 90m). Skipping auto-publish.`);
        return {
          ...result,
          cooldownActive: true,
          minutesSinceLastPost: minutesSince,
          reason: `Pacing koruması aktif: Son paylaşımdan sonra henüz ${minutesSince} dakika geçti (Minimum bekleme: 90 dk).`
        };
      }
    }

    // 2. Günlük Tavan Sınırı (Daily Cap Guard):
    // Bir gün içinde otonom yayınlanan gönderi sayısı maksimum 8 olabilir.
    const nowTurkey = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const startOfTodayTurkey = new Date(nowTurkey);
    startOfTodayTurkey.setHours(0, 0, 0, 0);

    const todayCount = await prisma.content.count({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: startOfTodayTurkey }
      }
    });

    if (todayCount >= 8) {
      console.log(`[Content Publisher] Daily Cap Guard: Already published ${todayCount} posts today (Cap: 8).`);
      return {
        ...result,
        dailyCapReached: true,
        todayCount,
        reason: `Günlük 8 gönderi tavanına ulaşıldı (${todayCount}/8). Takipçi doygunluğunu önlemek için yayın kuyruğa alındı.`
      };
    }

    // Her otonom döngüde EN FAZLA 1 adet gönderi yayınlanır (erişim bölünmesini önler)
    const effectiveLimit = Math.min(limit, 1);

    const readyContents = await prisma.content.findMany({
      where: {
        status: 'READY_TO_PUBLISH',
        facebookPostId: null,
        // Kalite filtresi: Sadece yüksek puanlı (75+) içerikler otonom yayınlanır
        OR: [
          { qualityScore: { gte: 75 } },
          { viralScore: { gte: 75 } },
          { newsValueScore: { gte: 75 } }
        ],
        AND: [
          {
            OR: [
              // Never failed yet (no retry text in aiReasoning)
              { aiReasoning: { equals: null } },
              { NOT: { aiReasoning: { contains: 'Yayinlama Hatasi' } } },
              // OR failed, but at least 15 minutes ago
              { updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }
            ]
          }
        ]
      },
      include: {
        sourceNews: true
      },
      take: 5,
      orderBy: [
        { qualityScore: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (readyContents.length === 0) {
      console.log("[Content Publisher] No qualified READY_TO_PUBLISH content found (score >= 75).");
      return result;
    }

    for (const content of readyContents) {
      if (result.processed >= effectiveLimit) break;
      if (publishingIds.has(content.id)) continue;

      // 1. Tazelik Denetimi (Anti-Stale Guard):
      // İçerik veya kaynak haber 36 saatten eski ise Facebook'ta yayınlanmaz.
      const isNewsOld = isNewsTooOld(content.sourceNews?.publishedAt, 36);
      const isContentOld = isNewsTooOld(content.createdAt, 36);

      if (isNewsOld || isContentOld) {
        console.log(`[Content Publisher] Stale content detected (ID: ${content.id}). Older than 36h. Cancelling publish.`);
        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'REJECTED',
            aiReasoning: `[ZAMAN AŞIMI] Haber veya içerik 36 saatten eski olduğu için Facebook yayını iptal edildi.`
          }
        });
        continue;
      }

      // 2. Mükerrer Yayın Denetimi (Anti-Duplicate Past Post Guard):
      // Son 7 gün içinde Facebook'ta yayınlanmış gönderilerle başlık/konu kıyaslaması yap.
      const historyCheck = await checkAgainstPublishedHistory(
        { id: content.sourceNewsId || content.id, title: content.title, summary: content.body },
        7
      );

      if (historyCheck.isDuplicate && historyCheck.matchedPost?.id !== content.id) {
        console.log(`[Content Publisher] Duplicate content detected (ID: ${content.id}) matches past post "${historyCheck.matchedPost?.title}". Cancelling publish.`);
        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'REJECTED',
            aiReasoning: `[MÜKERRER YAYIN ENGELİ] ${historyCheck.reason}`
          }
        });
        continue;
      }

      publishingIds.add(content.id);

      try {
        console.log(`[Content Publisher] Publishing content ID: ${content.id}`);

        const cleanTitle = (content.title || '')
          .replace(/\*\*/g, '')
          .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
          .trim();
        const cleanBody = (content.body || '')
          .replace(/\*\*/g, '')
          .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
          .trim();

        let messageBody = cleanTitle + '\n\n' + cleanBody;
        if (content.hashtags) {
          messageBody += '\n\n' + content.hashtags.trim();
        }
        messageBody = messageBody.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();

        // Dinamik görsel (Canva/OG Image) URL'sini 10 şablondan içerik türüne göre belirle.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai.vercel.app';
        
        const combinedText = `${cleanTitle} ${cleanBody}`.toLowerCase();
        let templateCategory = 'BREAKING';
        if (content.type === 'TRANSFER' || combinedText.includes('transfer') || combinedText.includes('imza') || combinedText.includes('anlaşma')) {
          templateCategory = 'TRANSFER';
        } else if (content.type === 'MATCH_PREVIEW' || combinedText.includes('maç günü') || combinedText.includes('derbi')) {
          templateCategory = 'MATCH_DAY';
        } else if (combinedText.includes('ilk 11') || combinedText.includes('kadro')) {
          templateCategory = 'LINEUP';
        } else if (combinedText.includes('gol') || combinedText.includes('skor') || combinedText.includes('goool')) {
          templateCategory = 'GOAL';
        } else if (combinedText.includes('kırmızı kart') || combinedText.includes('penaltı') || combinedText.includes('hakem')) {
          templateCategory = 'PENALTY_CARD';
        } else if (combinedText.includes('maç sonucu') || combinedText.includes('galibiyet') || combinedText.includes('3 puan')) {
          templateCategory = 'RESULT';
        } else if (combinedText.includes('açıklama') && (combinedText.includes('thomas reis') || combinedText.includes('reis') || combinedText.includes('teknik direktör'))) {
          templateCategory = 'QUOTE';
        } else if (content.type === 'REELS_SCRIPT' || combinedText.includes('reels')) {
          templateCategory = 'REELS';
        } else if (combinedText.includes('kamuoyu') || combinedText.includes('resmi açıklama') || combinedText.includes('kulübümüz')) {
          templateCategory = 'OFFICIAL';
        }

        let mediaUrl = `${appUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=${encodeURIComponent(templateCategory)}`;
        
        if (content.sourceNews?.imageUrl) {
          mediaUrl += `&imageUrl=${encodeURIComponent(content.sourceNews.imageUrl)}`;
        }

        // Facebook'a hem metni hem de görseli (logo ile watermarklanmis) gonder.
        const publishResponse = await FacebookService.publishPost(messageBody, mediaUrl);

        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'PUBLISHED',
            facebookPostId: publishResponse.postId,
            publishedAt: new Date()
          }
        });

        result.processed++;
        result.results.push({ contentId: content.id, status: 'PUBLISHED', facebookPostId: publishResponse.postId, mockMode: publishResponse.mockMode });
        console.log(`[Content Publisher] Done for ${content.id}: ${publishResponse.postId}`);

        // Facebook anti-spam: Çoklu paylaşımlar arasına 3 saniyelik güvenli bekleme ekle
        if (result.processed < limit) {
          console.log("[Content Publisher] Waiting 3s before next post to prevent Facebook velocity flag...");
          await new Promise(res => setTimeout(res, 3000));
        }

      } catch (err: any) {
        console.error(`[Content Publisher] Error publishing content ${content.id}:`, err);
        result.failed++;
        
        // Retry logic parsing
        const currentReasoning = content.aiReasoning || '';
        const retryCount = (currentReasoning.match(/Yayinlama Hatasi/g) || []).length;
        
        if (retryCount >= 3) {
          // Permanently fail after 3 retries
          await prisma.content.update({
            where: { id: content.id },
            data: {
              status: 'FAILED',
              aiReasoning: currentReasoning + `\n[FATAL] Yayinlama Hatasi (Maksimum deneme asildi): ${err.message}`
            }
          });
        } else {
          // Keep as READY_TO_PUBLISH but update aiReasoning to trigger updatedAt timestamp
          // The query will filter it out for 15 minutes
          await prisma.content.update({
            where: { id: content.id },
            data: {
              aiReasoning: currentReasoning + `\n[RETRY ${retryCount + 1}/3] Yayinlama Hatasi: ${err.message}`
            }
          });
        }
        
        result.results.push({ contentId: content.id, error: err.message, retrying: retryCount < 3 });
      } finally {
        publishingIds.delete(content.id);
      }
    }

    return result;
  } catch (error: any) {
    console.error("[Content Publisher] Fatal error:", error);
    result.success = false;
    // @ts-ignore
    result.error = error.message;
    return result;
  }
}

/**
 * Son yayınlanan Facebook gönderilerinin canlı istatistiklerini otonom senkronize eder.
 */
export async function syncPublishedPostsStats(limit: number = 5) {
  const result = { success: true, processed: 0, failed: 0 };
  try {
    const publishedContents = await prisma.content.findMany({
      where: {
        status: 'PUBLISHED',
        facebookPostId: { not: null }
      },
      orderBy: { publishedAt: 'desc' },
      take: limit
    });

    for (const item of publishedContents) {
      if (!item.facebookPostId) continue;
      try {
        const stats = await FacebookService.getPostStats(item.facebookPostId);
        if (stats) {
          const engagementRate = stats.impressions > 0 
            ? Number(((stats.reactions + stats.comments + stats.shares) / stats.impressions * 100).toFixed(2))
            : 0;

          const existing = await prisma.analytics.findFirst({
            where: { contentId: item.id },
            orderBy: { recordedAt: 'desc' }
          });

          if (existing) {
            await prisma.analytics.update({
              where: { id: existing.id },
              data: {
                reach: stats.reach,
                impressions: stats.impressions,
                reactions: stats.reactions,
                comments: stats.comments,
                shares: stats.shares,
                engagementRate,
                recordedAt: new Date()
              }
            });
          } else {
            await prisma.analytics.create({
              data: {
                contentId: item.id,
                reach: stats.reach,
                impressions: stats.impressions,
                reactions: stats.reactions,
                comments: stats.comments,
                shares: stats.shares,
                engagementRate
              }
            });
          }
          result.processed++;
        }
      } catch (postErr: any) {
        result.failed++;
        console.warn(`[Content Publisher] Stats sync error for ${item.facebookPostId}:`, postErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Content Publisher] syncPublishedPostsStats error:", err.message);
    result.success = false;
  }
  return result;
}
