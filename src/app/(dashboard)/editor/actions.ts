"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isNewsTooOld, checkAgainstPublishedHistory } from "@/lib/news/news-similarity-engine";

export async function saveContentAction(id: string, updates: { title?: string, body?: string, status?: string }) {
  try {
    const updated = await prisma.content.update({
      where: { id },
      data: {
        title: updates.title,
        body: updates.body,
        status: updates.status as any,
      }
    });
    revalidatePath("/editor");
    revalidatePath("/content");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Save content error:", error);
    return { success: false, error: "İçerik kaydedilirken hata oluştu." };
  }
}

export async function deleteContentAction(id: string) {
  try {
    await prisma.content.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    revalidatePath("/editor");
    revalidatePath("/content");
    return { success: true };
  } catch (error: any) {
    console.error("Delete content error:", error);
    return { success: false, error: "İçerik reddedilirken hata oluştu." };
  }
}

export async function publishContentDirectlyAction(
  id: string,
  updates: { title?: string; body?: string; customImageUrl?: string; forcePublish?: boolean }
) {
  try {
    const { FacebookService } = await import("@/services/facebook.service");
    
    // 1. Önce güncellemeleri temizle ve kaydet
    const cleanTitle = updates.title
      ? updates.title.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim()
      : undefined;
    const cleanBody = updates.body
      ? updates.body.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim()
      : undefined;

    const updatedContent = await prisma.content.update({
      where: { id },
      data: {
        ...(cleanTitle ? { title: cleanTitle } : {}),
        ...(cleanBody ? { body: cleanBody } : {}),
      },
      include: { sourceNews: true }
    });

    // 2. Mükerrer Gönderi Koruması (Son 7 günde yayınlananlarla kıyasla)
    if (!updates.forcePublish) {
      const historyCheck = await checkAgainstPublishedHistory(
        { id: updatedContent.sourceNewsId || updatedContent.id, title: updatedContent.title, summary: updatedContent.body },
        7
      );

      if (historyCheck.isDuplicate && historyCheck.matchedPost?.id !== id) {
        return {
          success: false,
          duplicateWarning: true,
          matchedPost: historyCheck.matchedPost,
          error: `DİKKAT (Mükerrer Haber Koruması): Bu konu son 7 gün içinde Facebook'ta zaten yayınlandı! ("${historyCheck.matchedPost?.title}").`
        };
      }
    }

    // 2. Facebook yayını için hazırlık (10 Canva şablonundan uygun olanı seç)
    const messageBody = (updatedContent.body || '').replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai.vercel.app';
    
    const combinedText = `${updatedContent.title || ''} ${messageBody}`.toLowerCase();
    let templateCategory = 'BREAKING';
    if (updatedContent.type === 'TRANSFER' || combinedText.includes('transfer') || combinedText.includes('imza') || combinedText.includes('anlaşma')) {
      templateCategory = 'TRANSFER';
    } else if (updatedContent.type === 'MATCH_PREVIEW' || combinedText.includes('maç günü') || combinedText.includes('derbi')) {
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
    } else if (updatedContent.type === 'REELS_SCRIPT' || combinedText.includes('reels')) {
      templateCategory = 'REELS';
    } else if (combinedText.includes('kamuoyu') || combinedText.includes('resmi açıklama') || combinedText.includes('kulübümüz')) {
      templateCategory = 'OFFICIAL';
    }

    const mediaUrl = updates.customImageUrl || `${appUrl}/api/og?title=${encodeURIComponent((updatedContent.title || '').replace(/\*\*/g, '').trim())}&template=${encodeURIComponent(templateCategory)}`;

    // 3. Facebook'a gönder — content ID'yi lockKey olarak geçirerek aynı anda iki kez basılmasını engelle
    const publishResponse = await FacebookService.publishPost(messageBody, mediaUrl, id);

    // 4. Veritabanını güncelle
    const publishedContent = await prisma.content.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        facebookPostId: publishResponse.postId,
        publishedAt: new Date()
      }
    });

    revalidatePath("/editor");
    revalidatePath("/content");
    return { success: true, data: publishedContent, mockMode: publishResponse.mockMode };
  } catch (error: any) {
    console.error("Direct publish error:", error);
    return { success: false, error: "Hemen yayınlama sırasında hata oluştu: " + error.message };
  }
}
