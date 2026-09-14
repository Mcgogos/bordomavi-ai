"use server";

import { AIFactory } from "@/services/ai/ai.factory";
import { generateSingleContent } from "@/lib/content/content-generator";
import { prisma } from "@/lib/db";

// Gerçek bir sistemde bu veriler veritabanına kaydedilir (Prisma)
// Ancak şu an mock mode olduğu için sadece sonucu döndürüyoruz.

export async function analyzeNewsAction(newsId: string, newsTitle: string) {
  try {
    const aiProvider = AIFactory.getRouter("NEWS_ANALYSIS");
    const result = await aiProvider.analyzeNews(newsTitle);
    
    // Save the result to the database!
    await prisma.news.update({
      where: { id: newsId },
      data: {
        isProcessed: true,
        importanceScore: result.importanceScore,
        aiConfidence: result.confidenceLevel,
        aiRecommendedAction: result.recommendedAction === 'IGNORE' ? 'IGNORE' : 'CREATE_CONTENT',
        isTrabzonsporRelated: true // assuming if it's analyzed, it has some relevance or handled by AI
      }
    });
    
    return {
      success: true,
      data: {
        aiScore: result.importanceScore,
        confidence: result.confidenceLevel,
        status: "ANALYZED"
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Bilinmeyen bir API hatası oluştu."
    };
  }
}

export async function generateContentAction(newsId: string, newsTitle: string) {
  const result = await generateSingleContent(newsId);
  return result;
}
