"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getNewsSources() {
  return await prisma.newsSource.findMany({
    orderBy: { priority: "desc" },
  });
}

export async function addNewsSource(data: { name: string; url: string; rssUrl?: string; type: any; priority?: number }) {
  const newSource = await prisma.newsSource.create({
    data: {
      name: data.name,
      url: data.url,
      rssUrl: data.rssUrl || null,
      type: data.type,
      priority: data.priority || 50,
      isActive: true,
    }
  });
  revalidatePath("/settings");
  return newSource;
}

export async function toggleNewsSource(id: string, isActive: boolean) {
  await prisma.newsSource.update({
    where: { id },
    data: { isActive }
  });
  revalidatePath("/settings");
}

export async function deleteNewsSource(id: string) {
  // We might not be able to delete if there are related News items. 
  // But for the user request, we can just attempt deletion or soft deletion.
  // We will do a hard delete if no news exists, otherwise we'll throw.
  // Actually, standard cascade delete is not on by default unless configured.
  // Let's just try delete. If it fails due to foreign key constraints, 
  // we catch and return an error message.
  try {
    await prisma.newsSource.delete({
      where: { id }
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2003') {
      return { success: false, error: "Bu kayna─şa ba─şl─▒ haberler oldu─şu i├ğin silinemiyor. L├╝tfen pasife al─▒n." };
    }
    return { success: false, error: "Silme i┼şlemi s─▒ras─▒nda bir hata olu┼ştu." };
  }
}

export async function testProviderAction(providerName: "gemini") {
  try {
    const provider = new (await import("@/services/ai/gemini.provider")).GeminiProvider();
    
    const startTime = Date.now();
    const result = await provider.generateContent(
      "Bana Trabzonspor hakkinda kisa bir slogan yaz."
    );
    const endTime = Date.now();

    return { 
      success: true, 
      time: endTime - startTime,
      result: result
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFacebookConnectionAction() {
  try {
    const { FacebookService } = await import("@/services/facebook.service");
    const result = await FacebookService.verifyRealConnection();
    return result;
  } catch (e: any) {
    return { success: false, message: e.message || "Bilinmeyen hata" };
  }
}
