"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FacebookService } from "@/services/facebook.service";
import { checkAgainstPublishedHistory } from "@/lib/news/news-similarity-engine";
import { stripExternalSources } from "@/lib/content/content-generator";

export async function deleteContentAction(id: string) {
  try {
    await prisma.content.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    revalidatePath("/content");
    return { success: true };
  } catch (error: any) {
    console.error("Delete Content Error:", error);
    return { success: false, error: "İçerik silinirken bir hata oluştu." };
  }
}

export async function publishContentNowAction(contentId: string, forcePublish: boolean = false) {
  try {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { sourceNews: true }
    });

    if (!content) {
      return { success: false, error: "İçerik bulunamadı." };
    }

    // Mükerrer Gönderi Koruması (Son 7 gün)
    if (!forcePublish) {
      const historyCheck = await checkAgainstPublishedHistory(
        { id: content.sourceNewsId || content.id, title: content.title, summary: content.body },
        7
      );

      if (historyCheck.isDuplicate && historyCheck.matchedPost?.id !== contentId) {
        return {
          success: false,
          duplicateWarning: true,
          matchedPost: historyCheck.matchedPost,
          error: `DİKKAT (Mükerrer Haber Koruması): Bu konu son 7 gün içinde Facebook'ta zaten yayınlandı! ("${historyCheck.matchedPost?.title}").`
        };
      }
    }

    // Build clean plain text message without markdown asterisks and without external sources
    const cleanTitle = stripExternalSources(content.title || '').replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    const cleanBody = stripExternalSources(content.body || '').replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    let message = cleanTitle ? cleanTitle + "\n\n" + cleanBody : cleanBody;
    if (content.hashtags) message += "\n\n" + content.hashtags.trim();
    message = stripExternalSources(message).replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();

    // Build the og image URL for the news title with matched template
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";
    let mediaUrl = `${baseUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=${encodeURIComponent(templateCategory)}`;
    if (content.sourceNews?.imageUrl) {
      mediaUrl += `&imageUrl=${encodeURIComponent(content.sourceNews.imageUrl)}`;
    }

    const result = await FacebookService.publishPost(message, mediaUrl, contentId);

    if (result.success && result.postId) {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: "PUBLISHED",
          facebookPostId: result.postId,
          publishedAt: new Date()
        }
      });
      revalidatePath("/content");
      return { success: true, postId: result.postId };
    } else {
      return { success: false, error: "Facebook yayın hatası: postId alınamadı." };
    }
  } catch (error: any) {
    console.error("Publish Content Error:", error);
    return { success: false, error: error.message || "Yayınlama sırasında hata oluştu." };
  }
}

export async function syncFacebookStatsAction() {
  try {
    const publishedContents = await prisma.content.findMany({
      where: {
        status: "PUBLISHED",
        facebookPostId: { not: null }
      },
      orderBy: { publishedAt: "desc" },
      take: 20
    });

    let updatedCount = 0;

    for (const content of publishedContents) {
      if (!content.facebookPostId) continue;
      try {
        const stats = await FacebookService.getPostStats(content.facebookPostId);
        if (stats) {
          const engagementRate = stats.impressions > 0 
            ? Number(((stats.reactions + stats.comments + stats.shares) / stats.impressions * 100).toFixed(2))
            : 0;

          const existing = await prisma.analytics.findFirst({
            where: { contentId: content.id },
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
                contentId: content.id,
                reach: stats.reach,
                impressions: stats.impressions,
                reactions: stats.reactions,
                comments: stats.comments,
                shares: stats.shares,
                engagementRate
              }
            });
          }
          updatedCount++;
        }
      } catch (err: any) {
        console.warn(`Error syncing stats for post ${content.facebookPostId}:`, err.message);
      }
    }

    revalidatePath("/content");
    return { success: true, updatedCount };
  } catch (error: any) {
    console.error("syncFacebookStatsAction Error:", error);
    return { success: false, error: error.message || "İstatistikler güncellenirken hata oluştu." };
  }
}
