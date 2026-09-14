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

    // Build the og image URL for the news title
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const mediaUrl = `${baseUrl}/api/og?title=${encodeURIComponent(content.title)}`;

    const result = await FacebookService.publishPost(content.body, mediaUrl);

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
