import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

// In-memory lock to prevent race conditions during concurrent runs
const processingIds = new Set<string>();

export async function analyzePendingNews(limit: number = 10) {
  const result = {
    success: true,
    requested: limit,
    processed: 0,
    failed: 0,
    results: [] as any[]
  };

  try {
    // 1. Fetch unprocessed news
    // Prioritize: LOCAL/CLUB, High Priority, Newest
    const unprocessedNews = await prisma.news.findMany({
      where: {
        isProcessed: false,
        analysisAttempts: { lt: 3 }
      },
      include: { source: true },
      orderBy: [
        { source: { priority: 'desc' } },
        { publishedAt: 'desc' }
      ],
      take: limit * 2 // Take more to account for already processing ones
    });

    if (unprocessedNews.length === 0) {
      console.log("[AI Analyzer] No unprocessed news found.");
      return result;
    }

    const aiProvider = AIFactory.getRouter("NEWS_ANALYSIS");

    for (const newsItem of unprocessedNews) {
      if (result.processed + result.failed >= limit) {
        break; // Reached requested limit
      }

      // Check lock to prevent race conditions
      if (processingIds.has(newsItem.id)) {
        continue;
      }

      // Acquire lock
      processingIds.add(newsItem.id);

      try {
        console.log(`[AI Analyzer] Analyzing: ${newsItem.title}`);
        
        const newsData = {
          title: newsItem.title,
          summary: newsItem.summary,
          publishedAt: newsItem.publishedAt,
          url: newsItem.url,
          sourceName: newsItem.source?.name
        };

        // 4. AI Analysis
        const aiResult = await aiProvider.analyzeNews(newsData);

        // 5. Save to DB
        await prisma.news.update({
          where: { id: newsItem.id },
          data: {
            isProcessed: true,
            isTrabzonsporRelated: aiResult.isTrabzonsporRelated,
            importanceScore: aiResult.importanceScore,
            credibilityScore: aiResult.credibilityScore,
            relevanceScore: aiResult.trabzonsporRelevanceScore,
            discussionScore: aiResult.discussionPotentialScore,
            shareScore: aiResult.sharePotentialScore,
            viralScore: aiResult.viralPotentialScore,
            aiRecommendedContentType: aiResult.recommendedContentType,
            aiRecommendedAction: aiResult.recommendedAction,
            aiSummary: aiResult.shortSummary,
            aiKeyPoints: aiResult.keyPoints,
            aiRiskLevel: aiResult.riskLevel,
            aiConfidence: aiResult.confidence,
            aiAnalyzedAt: new Date()
          }
        });

        result.processed++;
        result.results.push({
          title: newsItem.title,
          success: true,
          importanceScore: aiResult.importanceScore,
          credibilityScore: aiResult.credibilityScore,
          recommendedAction: aiResult.recommendedAction,
          isTrabzonsporRelated: aiResult.isTrabzonsporRelated
        });
        
      } catch (err: any) {
        console.error(`[AI Analyzer] Error analyzing ${newsItem.id}:`, err);
        result.failed++;
        result.results.push({
          title: newsItem.title,
          success: false,
          error: err.message
        });
        
        // We DO NOT set isProcessed = true, but we DO increment the attempt counter
        await prisma.news.update({
          where: { id: newsItem.id },
          data: {
            analysisAttempts: { increment: 1 },
            aiAnalysisError: err.message
          }
        });
      } finally {
        // Release lock
        processingIds.delete(newsItem.id);
      }
    }

    return result;
  } catch (error: any) {
    console.error("[AI Analyzer] Fatal error:", error);
    result.success = false;
    // @ts-ignore
    result.error = error.message;
    return result;
  }
}
