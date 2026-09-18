"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FacebookService } from "@/services/facebook.service";

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

export async function publishContentNowAction(contentId: string) {
  try {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { sourceNews: true }
    });

    if (!content) {
      return { success: false, error: "İçerik bulunamadı." };
    }

    // Build clean plain text message without markdown asterisks
    const cleanTitle = (content.title || '').replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    const cleanBody = (content.body || '').replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    let message = cleanTitle ? cleanTitle + "\n\n" + cleanBody : cleanBody;
    if (content.hashtags) message += "\n\n" + content.hashtags.trim();
    message = message.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();

    // Build the og image URL for the news title
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";
    const mediaUrl = `${baseUrl}/api/og?title=${encodeURIComponent(cleanTitle)}`;

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
          await prisma.analytics.create({
            data: {
              contentId: content.id,
              reach: stats.reach,
              impressions: stats.impressions,
              reactions: stats.reactions,
              comments: stats.comments,
              shares: stats.shares,
              engagementRate: stats.impressions > 0 
                ? Number(((stats.reactions + stats.comments + stats.shares) / stats.impressions * 100).toFixed(2))
                : 0
            }
          });
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
