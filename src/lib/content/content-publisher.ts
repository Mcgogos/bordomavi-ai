import { prisma } from '@/lib/db';
import { FacebookService } from '@/services/facebook.service';
import { isNewsTooOld, checkAgainstPublishedHistory } from '@/lib/news/news-similarity-engine';
import { stripExternalSources } from '@/lib/content/content-generator';
import { SmartPublisher } from '@/lib/content/smart-publisher';

const publishingIds = new Set<string>();

export async function publishReadyContent(limit: number = 1, force: boolean = false) {
  const result = {
    success: true,
    requested: limit,
    processed: 0,
    failed: 0,
    results: [] as any[]
  };

  try {
    // 1. Kesin Günlük Yayın Takvimi Denetimi:
    // Metin haberi SADECE saat 11:00 diliminde (günde 1 kez) otomatik yayınlanır.
    const quotaInfo = await SmartPublisher.getPublishingQuota();

    if (!force && (quotaInfo.quota <= 0 || quotaInfo.allowedType !== 'TEXT')) {
      console.log(`[Content Publisher] Takvim Koruması: Metin haberi sadece 11:00 diliminde yayınlanır. (${quotaInfo.reason})`);
      return {
        ...result,
        cooldownActive: true,
        minutesSinceLastPost: quotaInfo.minutesSinceLastPost,
        todayCount: quotaInfo.todayCount,
        reason: quotaInfo.reason
      };
    }

    // Her otonom döngüde EN FAZLA 1 adet metin haberi yayınlanır
    const effectiveLimit = Math.min(limit, 1);

    const readyContents = await prisma.content.findMany({
      where: {
        status: 'READY_TO_PUBLISH',
        facebookPostId: null,
        NOT: { type: 'REELS_SCRIPT' },
        // Kalite filtresi: Sadece yüksek puanlı (75+) içerikler otonom yayınlanır
        OR: [
          { qualityScore: { gte: 75 } },
          { viralScore: { gte: 75 } },
          { newsValueScore: { gte: 75 } }
        ],
        AND: [
          {
            createdAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) }
          },
          {
            OR: [
              { aiReasoning: { equals: null } },
              { NOT: { aiReasoning: { contains: 'Yayinlama Hatasi' } } },
              { updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }
            ]
          }
        ]
      },
      include: {
        sourceNews: true
      },
      take: 25,
      orderBy: [
        { createdAt: 'desc' },
        { qualityScore: 'desc' }
      ]
    });

    if (readyContents.length === 0) {
      console.log("[Content Publisher] No qualified READY_TO_PUBLISH text content found (score >= 75).");
      return result;
    }

    for (const content of readyContents) {
      if (result.processed >= effectiveLimit) break;
      if (publishingIds.has(content.id)) continue;

      // 1. Tazelik Denetimi (Anti-Stale Guard):
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
        console.log(`[Content Publisher] Publishing 11:00 Text News content ID: ${content.id}`);

        const cleanTitle = stripExternalSources(content.title || '')
          .replace(/\*\*/g, '')
          .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
          .trim();
        const cleanBody = stripExternalSources(content.body || '')
          .replace(/\*\*/g, '')
          .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
          .trim();

        let messageBody = cleanTitle + '\n\n' + cleanBody;
        if (content.hashtags) {
          messageBody += '\n\n' + content.hashtags.trim();
        }
        messageBody = stripExternalSources(messageBody)
          .replace(/\*\*/g, '')
          .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
          .trim();

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
        } else if (combinedText.includes('kamuoyu') || combinedText.includes('resmi açıklama') || combinedText.includes('kulübümüz')) {
          templateCategory = 'OFFICIAL';
        }

        let mediaUrl = `${appUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=${encodeURIComponent(templateCategory)}`;
        
        if (content.sourceNews?.imageUrl) {
          mediaUrl += `&imageUrl=${encodeURIComponent(content.sourceNews.imageUrl)}`;
        }

        // 11:00 Metin Haberi Slotu -> Kurumsal Görsel + Metin Gönderisi
        const publishResponse = await FacebookService.publishPost(messageBody, mediaUrl);

        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'PUBLISHED',
            facebookPostId: publishResponse.postId,
            publishedAt: new Date()
          }
        });

        await SmartPublisher.markSlotPublished('SLOT_1100_TEXT', quotaInfo.dateKey);

        result.processed++;
        result.results.push({ contentId: content.id, status: 'PUBLISHED', isReel: false, facebookPostId: publishResponse.postId, mockMode: publishResponse.mockMode });
        console.log(`[Content Publisher] Done for ${content.id}: ${publishResponse.postId} (11:00 Text News)`);

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
