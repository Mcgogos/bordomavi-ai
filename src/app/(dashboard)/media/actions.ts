"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FacebookService } from "@/services/facebook.service";
import { stripExternalSources } from "@/lib/content/content-generator";
import { AIFactory } from "@/services/ai/ai.factory";

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
  imageUrl?: string;
}) {
  try {
    const cleanTitle = stripExternalSources(params.title || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const cleanSummary = stripExternalSources(params.summary || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const cleanScript = stripExternalSources(params.scriptText || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    let message = `🎬 BORDO MAVİ REELS | ${cleanTitle}\n\n${cleanSummary}\n\n${cleanScript}`;
    if (!message.includes('#Trabzonspor')) {
      message += '\n\n#Trabzonspor #BordoMavi #Reels #Shorts #Fırtına';
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";
    let mediaUrl = `${baseUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=REELS&format=vertical`;
    if (params.imageUrl) {
      mediaUrl += `&imageUrl=${encodeURIComponent(params.imageUrl)}`;
    }

    const result = await FacebookService.publishPost(message, mediaUrl);

    if (result.success && result.postId) {
      await prisma.content.create({
        data: {
          title: cleanTitle,
          body: cleanScript,
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
      revalidatePath("/editor");
      return { success: true, postId: result.postId };
    }

    return { success: false, error: "Facebook Reels paylaşımı başarısız oldu." };
  } catch (error: any) {
    console.error("publishReelAction Error:", error);
    return { success: false, error: error.message || "Reels yayınlanırken hata oluştu." };
  }
}

export async function generateAiReelScriptAction(params: { title: string; body?: string }) {
  try {
    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");
    const cleanTitle = stripExternalSources(params.title || '');
    const cleanBody = stripExternalSources(params.body || '');

    const prompt = `
Aşağıdaki Trabzonspor haberini 15-20 saniyelik dikey bir Facebook/Instagram Reels senaryosuna dönüştür.
Haber Başlığı: ${cleanTitle}
Haber Detayı: ${cleanBody}

Kurallar:
1. Kesinlikle dış haber ajansı veya kaynak adı (Günebakış, Haber61 vb.) KULLANMA. Kaynak doğrudan Bordo Mavi'dir.
2. 4 sahne oluştur:
   - Sahne 1 (0-3 sn - Kanca): Merak uyandıran, vurucu bir seslendirme girişi.
   - Sahne 2 (3-8 sn - Manşet): Olayın ve manşetin en vurucu 15-20 kelimelik sesli özeti.
   - Sahne 3 (8-14 sn - Detay): Perde arkası, kritik detay veya etki.
   - Sahne 4 (14-18 sn - CTA): Takipçileri yorum yapmaya zorlayan net bir A/B tartışma sorusu ve sayfa takip çağrısı.
3. KESİNLİKLE hiçbir yerde markdown yıldız işareti (**, *) KULLANMA. Sade düz metin formatında yaz.
4. Yanıtını doğrudan sahne sahne düz metin olarak ver.`;

    const generated = await aiProvider.generateContent(prompt);
    return { success: true, scriptText: stripExternalSources(generated || '') };
  } catch (err: any) {
    console.error("generateAiReelScriptAction Error:", err);
    return { success: false, error: err.message };
  }
}
