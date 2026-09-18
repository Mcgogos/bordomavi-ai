"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FacebookService } from "@/services/facebook.service";

export async function publishCanvaDesignAction(params: {
  title: string;
  subtitle?: string;
  body?: string;
  category: string;
  dataUrl?: string;
}) {
  try {
    const cleanTitle = (params.title || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const cleanSubtitle = (params.subtitle || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const cleanBody = (params.body || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    // Facebook Gönderi Metni: Başlık + Tam Haber Metni + Hashtag'ler
    let postMessage = cleanTitle;
    if (cleanBody && cleanBody !== cleanTitle) {
      postMessage += `\n\n${cleanBody}`;
    } else if (cleanSubtitle && cleanSubtitle !== cleanTitle) {
      postMessage += `\n\n${cleanSubtitle}`;
    }

    if (!postMessage.includes('#Trabzonspor')) {
      postMessage += '\n\n#Trabzonspor #BordoMavi #Fırtına';
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";
    const mediaUrl = params.dataUrl || `${baseUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=${encodeURIComponent(params.category)}`;

    const result = await FacebookService.publishPost(postMessage, mediaUrl);

    if (result.success && result.postId) {
      try {
        await prisma.content.create({
          data: {
            title: cleanTitle,
            body: cleanBody || cleanSubtitle || cleanTitle,
            type: (params.category === "MATCH_DAY" ? "MATCH_PREVIEW" : params.category === "TRANSFER" ? "TRANSFER" : "NEWS") as any,
            status: "PUBLISHED",
            facebookPostId: result.postId,
            publishedAt: new Date(),
            qualityScore: 92,
            viralScore: 88,
          },
        });
      } catch (dbErr: any) {
        console.warn("[Media Actions] DB save warning after FB publish:", dbErr.message);
      }

      try {
        revalidatePath("/media");
        revalidatePath("/content");
      } catch (revErr: any) {
        console.warn("[Media Actions] Revalidate warning:", revErr.message);
      }

      return { success: true, postId: result.postId };
    }

    return { success: false, error: "Facebook paylaşımı başarısız oldu." };
  } catch (error: any) {
    console.error("publishCanvaDesignAction Error:", error);
    return { success: false, error: error.message || "Canva görseli yayınlanırken hata oluştu." };
  }
}

export async function publishReelAction(params: {
  title: string;
  summary: string;
  scriptText: string;
}) {
  try {
    const cleanTitle = (params.title || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const cleanSummary = (params.summary || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const message = `🎬 AI REELS & SHORTS | ${cleanTitle}\n\n${cleanSummary}\n\n${params.scriptText}\n\n#Trabzonspor #BordoMavi #Reels #Shorts #Fırtına`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";
    const mediaUrl = `${baseUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=REELS`;

    const result = await FacebookService.publishPost(message, mediaUrl);

    if (result.success && result.postId) {
      await prisma.content.create({
        data: {
          title: cleanTitle,
          body: params.scriptText,
          type: "REELS_SCRIPT",
          status: "PUBLISHED",
          facebookPostId: result.postId,
          publishedAt: new Date(),
          qualityScore: 95,
          viralScore: 94,
        },
      });

      revalidatePath("/media");
      revalidatePath("/content");
      return { success: true, postId: result.postId };
    }

    return { success: false, error: "Facebook Reels paylaşımı başarısız oldu." };
  } catch (error: any) {
    console.error("publishReelAction Error:", error);
    return { success: false, error: error.message || "Reels yayınlanırken hata oluştu." };
  }
}
