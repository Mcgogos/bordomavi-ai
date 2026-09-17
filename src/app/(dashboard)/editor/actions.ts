"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

export async function publishContentDirectlyAction(id: string, updates: { title?: string, body?: string }) {
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
      }
    });

    // 2. Facebook yayını için hazırlık
    const messageBody = (updatedContent.body || '').replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai.vercel.app';
    const mediaUrl = `${appUrl}/api/og?title=${encodeURIComponent((updatedContent.title || '').replace(/\*\*/g, '').trim())}`;

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
