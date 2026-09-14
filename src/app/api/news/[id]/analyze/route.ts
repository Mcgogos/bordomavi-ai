import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

export async function POST(
  request: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const newsId = resolvedParams.id;
    if (!newsId) {
      return NextResponse.json({ success: false, error: 'News ID is required' }, { status: 400 });
    }

    // 1. Fetch from DB
    const newsItem = await prisma.news.findUnique({
      where: { id: newsId },
      include: { source: true }
    });

    if (!newsItem) {
      return NextResponse.json({ success: false, error: 'News not found' }, { status: 404 });
    }

    // 2. Check if already analyzed
    if (newsItem.isProcessed && newsItem.aiAnalyzedAt) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already analyzed',
        newsId: newsItem.id,
        importanceScore: newsItem.importanceScore,
        credibilityScore: newsItem.credibilityScore,
        recommendedAction: newsItem.aiRecommendedAction
      });
    }

    // 3. Prepare data for Gemini
    const newsData = {
      title: newsItem.title,
      summary: newsItem.summary,
      publishedAt: newsItem.publishedAt,
      url: newsItem.url,
      sourceName: newsItem.source?.name
    };

    // 4. Analyze via AI
    const aiProvider = AIFactory.getRouter("NEWS_ANALYSIS"); // Use Router Architecture
    const aiResult = await aiProvider.analyzeNews(newsData);

    // 5. Update DB
    const updatedNews = await prisma.news.update({
      where: { id: newsId },
      data: {
        isProcessed: true,
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

    // 6. Return response
    return NextResponse.json({
      success: true,
      newsId: updatedNews.id,
      importanceScore: updatedNews.importanceScore,
      credibilityScore: updatedNews.credibilityScore,
      recommendedAction: updatedNews.aiRecommendedAction
    });

  } catch (error: any) {
    console.error("[API] Analyze Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
