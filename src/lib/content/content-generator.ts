import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

// In-memory lock for generation
const generatingIds = new Set<string>();

export async function generateAutomatedContent(limit: number = 5) {
  const result = {
    success: true,
    requested: limit,
    processed: 0,
    failed: 0,
    results: [] as any[]
  };

  // Minimum AI score threshold for auto-generation
  const MIN_AI_SCORE = 85;

  try {
    // 1. Find suitable news
    // rules: isTrabzonsporRelated = true, aiRecommendedAction in [CREATE_CONTENT, URGENT], no content yet, importanceScore >= 85
    const candidateNews = await prisma.news.findMany({
      where: {
        isProcessed: true,
        isTrabzonsporRelated: true,
        aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
        content: null, // no content generated yet
        importanceScore: { gte: MIN_AI_SCORE } // Only high-quality news (85+)
      },
      include: { source: true },
      orderBy: { importanceScore: 'desc' }, // Best news first
      take: limit * 2
    });

    if (candidateNews.length === 0) {
      console.log(`[Content Generator] No candidate news found with AI score >= ${MIN_AI_SCORE}.`);
      return result;
    }

    console.log(`[Content Generator] Found ${candidateNews.length} candidates with AI score >= ${MIN_AI_SCORE}.`);

    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");

    for (const news of candidateNews) {
      if (result.processed + result.failed >= limit) {
        break;
      }

      if (generatingIds.has(news.id)) {
        continue;
      }

      generatingIds.add(news.id);

      try {
        console.log(`[Content Generator] Generating content for: ${news.title}`);
        
        const prompt = `
Lütfen aşağıdaki haber detaylarını kullanarak Bordo Mavi (Trabzonspor) taraftar platformu için dikkat çekici bir Facebook gönderisi taslağı oluştur.
        
Haber Başlığı: ${news.title}
Kaynak: ${news.source?.name || 'Bilinmiyor'}
Haber Özeti: ${news.summary || news.aiSummary || ''}
        
Kurallar:
1. Dikkat çekici bir başlık ile başla.
2. 2-4 kısa paragraftan oluşsun (okunması kolay).
3. Haber kaynağına dayalı net bir özet sun.
4. Kesinleşmemiş haberler için "iddia edildi", "öne sürüldü" gibi güvenilirlik ifadeleri kullan.
5. Sonunda Bordo Mavi tarzında kısa bir yorum ekle (Örn: "Sizce bu transfer takıma katkı sağlar mı?", "Fırtına'nın yeni rotası ne olacak?").
6. Gönderinin en altına 3-5 adet hashtag ekle (#Trabzonspor vb.).
7. Yanıtını doğrudan paylaşılacak metin olarak gönder (JSON veya ekstra açıklama olmadan).`;

        const generatedText = await aiProvider.generateContent(prompt);

        if (!generatedText) {
          throw new Error("AI failed to generate content.");
        }

        // Save to DB
        // Determine type based on recommended content type
        let contentType = 'NEWS';
        if (news.aiRecommendedContentType) {
            contentType = news.aiRecommendedContentType;
        }

        await prisma.content.create({
          data: {
            title: news.title,
            body: generatedText,
            type: contentType as any,
            // High-score content goes directly to publishing queue (no manual approval needed)
            status: 'READY_TO_PUBLISH',
            sourceNewsId: news.id,
          }
        });

        result.processed++;
        result.results.push({ newsId: news.id, title: news.title, success: true });
        console.log(`[Content Generator] Success for news ID: ${news.id}`);

      } catch (err: any) {
        console.error(`[Content Generator] Error generating for news ${news.id}:`, err);
        result.failed++;
        result.results.push({ newsId: news.id, title: news.title, success: false, error: err.message });
      } finally {
        generatingIds.delete(news.id);
      }
    }

    return result;

  } catch (error: any) {
    console.error("[Content Generator] Fatal error:", error);
    result.success = false;
    // @ts-ignore
    result.error = error.message;
    return result;
  }
}

export async function generateSingleContent(newsId: string) {
  if (generatingIds.has(newsId)) return { success: false, error: "Already generating" };
  
  try {
    generatingIds.add(newsId);
    
    const news = await prisma.news.findUnique({
      where: { id: newsId },
      include: { source: true }
    });

    if (!news) throw new Error("News not found");

    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");

    const prompt = `
Lütfen aşağıdaki haber detaylarını kullanarak Bordo Mavi (Trabzonspor) taraftar platformu için dikkat çekici bir Facebook gönderisi taslağı oluştur.
    
Haber Başlığı: ${news.title}
Kaynak: ${news.source?.name || 'Bilinmiyor'}
Haber Özeti: ${news.summary || news.aiSummary || ''}
    
Kurallar:
1. Dikkat çekici bir başlık ile başla.
2. 2-4 kısa paragraftan oluşsun (okunması kolay).
3. Haber kaynağına dayalı net bir özet sun.
4. Kesinleşmemiş haberler için "iddia edildi", "öne sürüldü" gibi güvenilirlik ifadeleri kullan.
5. Sonunda Bordo Mavi tarzında kısa bir yorum ekle (Örn: "Sizce bu transfer takıma katkı sağlar mı?", "Fırtına'nın yeni rotası ne olacak?").
6. Gönderinin en altına 3-5 adet hashtag ekle (#Trabzonspor vb.).
7. Yanıtını doğrudan paylaşılacak metin olarak gönder (JSON veya ekstra açıklama olmadan).`;

    const generatedText = await aiProvider.generateContent(prompt);

    if (!generatedText) throw new Error("AI failed to generate content.");

    let contentType = 'NEWS';
    if (news.aiRecommendedContentType) {
        contentType = news.aiRecommendedContentType;
    }

    const created = await prisma.content.create({
      data: {
        title: news.title,
        body: generatedText,
        type: contentType as any,
        status: 'DRAFT',
        sourceNewsId: news.id,
      }
    });

    return { success: true, data: created };

  } catch (error: any) {
    console.error(`[Content Generator] Error generating for news ${newsId}:`, error);
    return { success: false, error: error.message };
  } finally {
    generatingIds.delete(newsId);
  }
}

