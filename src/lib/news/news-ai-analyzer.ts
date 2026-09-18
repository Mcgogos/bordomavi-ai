import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

// In-memory lock to prevent race conditions during concurrent runs
const processingIds = new Set<string>();

export function analyzeNewsHeuristic(newsItem: any) {
  const text = `${newsItem.title || ''} ${newsItem.summary || ''}`.toLowerCase();
  const keywords = ['trabzonspor', 'bordo mavi', 'fırtına', 'papara park', 'thomas reis', 'uğurcan', 'visca', 'cham', 'savic', 'mendy', 'bordo-mavi'];
  const isTs = keywords.some(k => text.includes(k));
  
  return {
    isTrabzonsporRelated: isTs,
    importanceScore: isTs ? 75 : 30,
    credibilityScore: 80,
    trabzonsporRelevanceScore: isTs ? 85 : 20,
    discussionPotentialScore: isTs ? 75 : 20,
    sharePotentialScore: isTs ? 70 : 15,
    viralPotentialScore: isTs ? 65 : 10,
    recommendedContentType: 'NEWS',
    recommendedAction: isTs ? 'CREATE_CONTENT' : 'IGNORE',
    shortSummary: newsItem.summary?.slice(0, 200) || newsItem.title,
    keyPoints: [newsItem.title],
    riskLevel: 'LOW',
    aiConfidence: 'MEDIUM',
    confidenceLevel: 'POSSIBLE'
  };
}

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

        // 4. AI Analysis with Heuristic Fallback
        let aiResult: any;
        try {
          aiResult = await aiProvider.analyzeNews(newsData);
        } catch (aiErr: any) {
          console.warn(`[AI Analyzer] AI analysis failed (${aiErr.message}), using heuristic analyzer...`);
          aiResult = analyzeNewsHeuristic(newsItem);
        }

        const isTs = aiResult.isTrabzonsporRelated ?? ((aiResult.trabzonsporRelevanceScore ?? 0) >= 50);

        // 5. Save to DB
        await prisma.news.update({
          where: { id: newsItem.id },
          data: {
            isProcessed: true,
            isTrabzonsporRelated: isTs,
            importanceScore: aiResult.importanceScore ?? (isTs ? 75 : 30),
            credibilityScore: aiResult.credibilityScore ?? 80,
            relevanceScore: aiResult.trabzonsporRelevanceScore ?? (isTs ? 85 : 20),
            discussionScore: aiResult.discussionPotentialScore ?? (isTs ? 75 : 20),
            shareScore: aiResult.sharePotentialScore ?? (isTs ? 70 : 15),
            viralScore: aiResult.viralPotentialScore ?? (isTs ? 65 : 10),
            aiRecommendedContentType: (['NEWS', 'COLUMN', 'POLL', 'NOSTALGIA', 'MATCH_PREVIEW', 'MATCH_REPORT', 'TRANSFER', 'PLAYER_ANALYSIS', 'MANAGEMENT_ANALYSIS', 'REELS_SCRIPT', 'FAN_CONTENT', 'QUESTION'].includes((aiResult.recommendedContentType || '').toUpperCase()) ? aiResult.recommendedContentType.toUpperCase() : 'NEWS') as any,
            aiRecommendedAction: (['IGNORE', 'MONITOR', 'CREATE_CONTENT', 'URGENT'].includes((aiResult.recommendedAction || '').toUpperCase()) ? aiResult.recommendedAction.toUpperCase() : (isTs ? 'CREATE_CONTENT' : 'IGNORE')) as any,
            aiSummary: aiResult.shortSummary || newsItem.summary || newsItem.title,
            aiKeyPoints: aiResult.keyPoints || [newsItem.title],
            aiRiskLevel: (['LOW', 'MEDIUM', 'HIGH'].includes((aiResult.riskLevel || '').toUpperCase()) ? aiResult.riskLevel.toUpperCase() : 'LOW') as any,
            aiConfidence: (['LOW', 'MEDIUM', 'HIGH'].includes((aiResult.confidence || aiResult.aiConfidence || '').toUpperCase()) ? (aiResult.confidence || aiResult.aiConfidence).toUpperCase() : 'MEDIUM') as any,
            confidenceLevel: (['VERIFIED', 'POSSIBLE', 'CLAIM', 'UNVERIFIED'].includes((aiResult.confidenceLevel || aiResult.confidence || '').toUpperCase()) ? (aiResult.confidenceLevel || aiResult.confidence).toUpperCase() : 'POSSIBLE') as any,
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
          isTrabzonsporRelated: isTs
        });
        
      } catch (err: any) {
        console.error(`[AI Analyzer] Error analyzing ${newsItem.id}:`, err);
        result.failed++;
        result.results.push({
          title: newsItem.title,
          success: false,
          error: err.message
        });
        
        await prisma.news.update({
          where: { id: newsItem.id },
          data: {
            analysisAttempts: { increment: 1 },
            aiAnalysisError: err.message
          }
        });
      } finally {
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
