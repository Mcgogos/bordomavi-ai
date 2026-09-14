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
      return { success: false, error: "Bu kaynağa bağlı haberler olduğu için silinemiyor. Lütfen pasife alın." };
    }
    return { success: false, error: "Silme işlemi sırasında bir hata oluştu." };
  }
}

export async function testProviderAction(providerName: "gemini" | "nvidia") {
  const { AIFactory } = await import("@/services/ai/ai.factory");
  const startTime = Date.now();
  try {
    const aiProvider = providerName === "gemini" 
      ? new (await import("@/services/ai/gemini.provider")).GeminiProvider()
      : new (await import("@/services/ai/nvidia.provider")).NvidiaProvider();
    
    await aiProvider.generateContent("Sadece 'TEST_OK' yaz ve başka hiçbir şey ekleme.");
    const endTime = Date.now();
    return { success: true, time: endTime - startTime };
  } catch (e: any) {
    return { success: false, error: e.message };
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
