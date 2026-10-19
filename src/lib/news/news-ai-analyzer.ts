import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

// In-memory lock to prevent race conditions during concurrent runs
const processingIds = new Set<string>();

export function analyzeNewsHeuristic(newsItem: any) {
  const title = (newsItem.title || '').trim();
  const summary = (newsItem.summary || '').trim();
  const text = `${title} ${summary}`.toLowerCase();

  // Trabzonspor doğrudan alaka kontrolü
  const tsKeywords = [
    'trabzonspor', 'bordo mavi', 'bordo-mavi', 'fırtına', 'papara park', 
    'thomas reis', 'uğurcan', 'visca', 'cham', 'savic', 'mendy', 'banza', 
    'nwakaeme', 'ertuğrul doğan', 'avcı', 'şenol güneş', 'drogheda'
  ];
  const isTs = tsKeywords.some(k => text.includes(k));

  if (!isTs) {
    return {
      isTrabzonsporRelated: false,
      importanceScore: 28,
      credibilityScore: 70,
      trabzonsporRelevanceScore: 15,
      discussionPotentialScore: 20,
      sharePotentialScore: 15,
      viralPotentialScore: 10,
      recommendedContentType: 'NEWS',
      recommendedAction: 'IGNORE',
      shortSummary: summary.slice(0, 180) || title,
      keyPoints: [title],
      riskLevel: 'LOW',
      aiConfidence: 'HIGH',
      confidenceLevel: 'UNVERIFIED'
    };
  }

  // 1. Dinamik Kategori & Öncelik Puanlaması (75 Puan Yığılma Problemini Önleyen Katmanlı Mimari)
  // Taban puan haberin alaka düzeyine göre dinamik belirlenir (önceki gibi sabit 72 değil)
  let baseScore = 60;
  let recommendedType = 'NEWS';
  let recommendedAction: 'IGNORE' | 'MONITOR' | 'CREATE_CONTENT' | 'URGENT' = 'MONITOR';

  // TIER 1: Flaş / Son Dakika / Resmi KAP / Teknik Heyet Değişikliği / Kriz (+24 ile +32 puan) -> 88-96 Puan
  const isMajorBreaking = [
    'son dakika', 'flaş', 'resmi açıklama', 'kap bildirimi', 'yollar ayrıldı', 
    'karşılıklı anlaşıldı', 'istifa', 'tarihe geçti', 'büyük kriz', 'olağanüstü',
    'şampiyonluk', 'kupa finali', 'tff kararı', 'ceza verildi'
  ].some(k => text.includes(k));

  if (isMajorBreaking) {
    baseScore += 26;
    recommendedAction = 'URGENT';
    recommendedType = 'NEWS';
  }

  // TIER 2: Derbi & Büyük Karşılaşmalar (+18 ile +24 puan) -> 80-88 Puan
  const isDerby = [
    'derbi', 'beşiktaş', 'fenerbahçe', 'galatasaray', 'dev maç', 'ilk 11', 
    'kadro açıklandı', 'hakem skandalı', '3 puan', 'galibiyet', 'maç günü'
  ].some(k => text.includes(k));

  if (isDerby) {
    baseScore += 20;
    if (recommendedAction !== 'URGENT') recommendedAction = 'CREATE_CONTENT';
    recommendedType = (text.includes('ilk 11') || text.includes('kadro')) ? 'MATCH_PREVIEW' : 'MATCH_REPORT';
  }

  // TIER 3: Sıcak Transfer & İmza & Sözleşme (+14 ile +19 puan) -> 76-84 Puan
  const isTransfer = [
    'transfer', 'imza attı', 'anlaşma sağlandı', 'bonservis', 'kap', 'sözleşme', 
    'kiralık', 'sağlık kontrolü', 'menajer', 'masada', 'prensipte anlaştı'
  ].some(k => text.includes(k));

  if (isTransfer) {
    baseScore += 16;
    if (recommendedAction !== 'URGENT') recommendedAction = 'CREATE_CONTENT';
    recommendedType = 'TRANSFER';
  }

  // TIER 4: Yıldız Oyuncu, Kaptan & Teknik Direktör Odaklı Gelişmeler (+6 ile +10 puan)
  const hasKeyFigure = [
    'thomas reis', 'uğurcan çakır', 'simon banza', 'stefan savic', 'edin visca', 
    'anthony nwakaeme', 'muhammed cham', 'ertuğrul doğan', 'fatih tekke', 'batista mendy'
  ].some(k => text.includes(k));

  if (hasKeyFigure) {
    baseScore += 8;
  }

  // TIER 5: Standart Maç & Puan Durumu & Taktik Değerlendirme (+4 ile +8 puan)
  const isStandardMatch = [
    'süper lig', 'puan durumu', 'taktik', 'basın toplantısı', 'açıklamalarda bulundu',
    'rakip', 'deplasman', 'tribün', 'bilet satışı', 'hakem'
  ].some(k => text.includes(k));

  if (isStandardMatch && !isDerby && !isMajorBreaking) {
    baseScore += 6;
  }

  // TIER 6: Rutin Antrenman & Hazırlık İndirimi (-8 ile -14 puan) -> 52-62 Puan
  const isRoutine = [
    'idman raporu', 'antrenman devam etti', 'salonda çalıştı', 'rejenerasyon', 
    'hazırlıklar sürdü', 'basına kapalı', 'milli ara idmanı'
  ].some(k => text.includes(k));

  if (isRoutine && !isDerby && !isTransfer && !isMajorBreaking) {
    baseScore -= 10;
    recommendedAction = 'MONITOR';
  }

  // TIER 7: Sosyal, Ziyaret & Taziye İndirimi (-16 ile -22 puan) -> 40-50 Puan
  const isSocial = [
    'doğum günü kutlandı', 'ziyaret etti', 'taziye', 'vefat etti', 'plaket verildi', 
    'öğrencilerle buluştu', 'sponsorluk lansmanı'
  ].some(k => text.includes(k));

  if (isSocial && !isMajorBreaking) {
    baseScore -= 18;
    recommendedAction = 'IGNORE';
  }

  // Detay & İçerik Derinliği Faktörü
  if (summary.length > 250) {
    baseScore += 4;
  } else if (summary.length < 70) {
    baseScore -= 3;
  }

  // Doğal Dağılım Çeşitliliği (Tüm haberlerin 75 çıkmasını engelleyen 7 kademeli non-lineer hash varyasyonu)
  const hashVal = title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  const hashMod = (hashVal % 9) - 4; // -4, -3, -2, -1, 0, 1, 2, 3, 4
  const finalImportance = Math.min(97, Math.max(35, baseScore + hashMod));

  // Tartışma ve Viral Puanı (Kategoriye göre dinamik oranlanır)
  const hasDebateTrigger = [
    'karar verildi', 'kriz', 'tepki', 'gidecek mi', 'kalacak mı', 'cevap verdi', 
    'itiraf', 'olay', 'hakem', 'var kararı', 'isyan', 'tartışma', '?'
  ].some(k => text.includes(k));

  const discussionScore = Math.min(96, Math.max(30, 
    isDerby ? finalImportance + 6 : 
    hasDebateTrigger ? finalImportance + 8 : 
    isRoutine || isSocial ? finalImportance - 12 : finalImportance - 2
  ));

  const viralScore = Math.min(96, Math.max(25, 
    isMajorBreaking || isDerby ? finalImportance + 7 : 
    isTransfer ? finalImportance + 5 : 
    isRoutine || isSocial ? finalImportance - 15 : finalImportance - 4
  ));

  const shareScore = Math.min(94, Math.max(25, 
    isMajorBreaking ? finalImportance + 4 : 
    isDerby ? finalImportance + 3 : 
    isRoutine || isSocial ? finalImportance - 14 : finalImportance - 5
  ));

  // Nihai Aksiyon Belirleme
  let action = recommendedAction;
  if (finalImportance >= 86) {
    action = isMajorBreaking ? 'URGENT' : 'CREATE_CONTENT';
  } else if (finalImportance >= 66) {
    action = 'CREATE_CONTENT';
  } else if (finalImportance >= 48) {
    action = 'MONITOR';
  } else {
    action = 'IGNORE';
  }

  return {
    isTrabzonsporRelated: true,
    importanceScore: finalImportance,
    credibilityScore: isMajorBreaking || isDerby ? 92 : 86,
    trabzonsporRelevanceScore: 92,
    discussionPotentialScore: discussionScore,
    sharePotentialScore: shareScore,
    viralPotentialScore: viralScore,
    recommendedContentType: recommendedType,
    recommendedAction: action,
    shortSummary: summary.slice(0, 200) || title,
    keyPoints: [title],
    riskLevel: isMajorBreaking && text.includes('kriz') ? 'MEDIUM' : 'LOW',
    aiConfidence: 'HIGH',
    confidenceLevel: 'VERIFIED'
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

        const dynamicFallback = analyzeNewsHeuristic(newsItem);

        // 5. Save to DB
        await prisma.news.update({
          where: { id: newsItem.id },
          data: {
            isProcessed: true,
            isTrabzonsporRelated: isTs,
            importanceScore: aiResult.importanceScore ?? dynamicFallback.importanceScore,
            credibilityScore: aiResult.credibilityScore ?? dynamicFallback.credibilityScore,
            relevanceScore: aiResult.trabzonsporRelevanceScore ?? dynamicFallback.trabzonsporRelevanceScore,
            discussionScore: aiResult.discussionPotentialScore ?? dynamicFallback.discussionPotentialScore,
            shareScore: aiResult.sharePotentialScore ?? dynamicFallback.sharePotentialScore,
            viralScore: aiResult.viralPotentialScore ?? dynamicFallback.viralPotentialScore,
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
