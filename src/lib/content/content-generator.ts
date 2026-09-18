import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

// Helper to strictly remove markdown asterisks (** and *) for clean plain text publishing
export function sanitizePlainText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')
    .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
    .trim();
}

export function generateSmartFallbackPost(news: any): string {
  const cleanTitle = sanitizePlainText(news.title || '');
  const cleanSummary = sanitizePlainText(news.summary || news.aiSummary || '');
  const sourceName = news.source?.name ? `Kaynak: ${news.source.name}` : '';

  const category = (news.category || news.aiRecommendedContentType || '').toUpperCase();
  let badge = 'BORDO MAVİ FLAŞ HABER';
  if (category.includes('TRANSFER')) badge = 'BORDO MAVİ TRANSFER GELİŞMESİ';
  else if (category.includes('MATCH')) badge = 'TRABZONSPOR MAÇ GÜNDEMİ';
  else if (category.includes('ANALYSIS')) badge = 'TRABZONSPOR ÖZEL ANALİZ';

  const fanQuestions = [
    'Bordo Mavi renklere gönül veren taraftarlarımız bu gelişme hakkında ne düşünüyor? Yorumlarda buluşalım!',
    'Fırtına yeni hedefleri için kenetlenmeye devam ediyor. Sizce bu hamle takımımıza nasıl yansır? Görüşlerinizi yazın!',
    'Bordo-Mavili sevdamızda yaşanan son gelişmeleri sıcağı sıcağına aktarıyoruz. Siz bu durumu nasıl değerlendiriyorsunuz?',
    'Fırtına emin adımlarla yoluna devam ediyor. Bu önemli gelişme hakkındaki düşüncelerinizi merak ediyoruz!'
  ];
  const selectedQuestion = fanQuestions[Math.floor(Math.random() * fanQuestions.length)];

  let post = `${badge}\n\n${cleanTitle}\n\n`;
  if (cleanSummary && cleanSummary !== cleanTitle) {
    post += `${cleanSummary}\n\n`;
  }
  if (sourceName) {
    post += `${sourceName}\n\n`;
  }
  post += `${selectedQuestion}\n\n`;
  post += '#Trabzonspor #BordoMavi #Fırtına #SüperLig';

  return sanitizePlainText(post);
}

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

  // Minimum AI score threshold for auto-generation (65+ Trabzonspor news)
  const MIN_AI_SCORE = 65;

  try {
    // 1. Find suitable news
    // rules: isTrabzonsporRelated is true or null, action in [CREATE_CONTENT, URGENT], no content yet, importanceScore >= 65
    const candidateNews = await prisma.news.findMany({
      where: {
        isProcessed: true,
        OR: [
          { isTrabzonsporRelated: true },
          { isTrabzonsporRelated: null }
        ],
        aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
        content: null, // no content generated yet
        importanceScore: { gte: MIN_AI_SCORE } // High-quality news (65+)
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
        
Haber Başlığı: ${sanitizePlainText(news.title)}
Kaynak: ${news.source?.name || 'Bilinmiyor'}
Haber Özeti: ${sanitizePlainText(news.summary || news.aiSummary || '')}
        
Kurallar:
1. Dikkat çekici bir başlık ile başla.
2. 2-4 kısa paragraftan oluşsun (okunması kolay).
3. Haber kaynağına dayalı net bir özet sun.
4. Kesinleşmemiş haberler için "iddia edildi", "öne sürüldü" gibi güvenilirlik ifadeleri kullan.
5. Sonunda Bordo Mavi tarzında kısa bir yorum ekle (Örn: "Sizce bu transfer takıma katkı sağlar mı?", "Fırtına'nın yeni rotası ne olacak?").
6. Gönderinin en altına 3-5 adet hashtag ekle (#Trabzonspor vb.).
7. KESİNLİKLE hiçbir yerde markdown yıldız işareti (**, *) KULLANMA. Başlıkları ve vurguları sade düz metin olarak veya büyük harfle yaz. Metnin başında, ortasında veya sonunda asla ** olmasın.
8. Yanıtını doğrudan paylaşılacak düz metin olarak gönder (JSON veya ekstra açıklama olmadan).`;

        const generatedText = await aiProvider.generateContent(prompt);

        if (!generatedText) {
          throw new Error("AI failed to generate content.");
        }

        const cleanTitle = sanitizePlainText(news.title);
        const cleanBody = sanitizePlainText(generatedText);

        // Save to DB
        // Determine type based on recommended content type
        let contentType = 'NEWS';
        if (news.aiRecommendedContentType) {
            contentType = news.aiRecommendedContentType;
        }

        await prisma.content.create({
          data: {
            title: cleanTitle,
            body: cleanBody,
            type: contentType as any,
            // High-score content goes directly to publishing queue (no manual approval needed)
            status: 'READY_TO_PUBLISH',
            sourceNewsId: news.id,
          }
        });

        result.processed++;
        result.results.push({ newsId: news.id, title: cleanTitle, success: true });
        console.log(`[Content Generator] Success for news ID: ${news.id}`);

      } catch (err: any) {
        console.warn(`[Content Generator] AI generation failed (${err.message}). Activating Autonomous Rule Fallback for: ${news.title}`);
        
        try {
          const fallbackBody = generateSmartFallbackPost(news);
          const cleanTitle = sanitizePlainText(news.title);

          let contentType = 'NEWS';
          if (news.aiRecommendedContentType) {
            contentType = news.aiRecommendedContentType;
          }

          await prisma.content.create({
            data: {
              title: cleanTitle,
              body: fallbackBody,
              type: contentType as any,
              status: 'READY_TO_PUBLISH',
              sourceNewsId: news.id,
              aiReasoning: `Otonom Kural Motoru (Yedek Mod): ${err.message?.slice(0, 100)}`
            }
          });

          result.processed++;
          result.results.push({ newsId: news.id, title: cleanTitle, success: true, mode: 'RULE_FALLBACK' });
          console.log(`[Content Generator] Autonomous Fallback Success for news ID: ${news.id}`);
        } catch (fallbackErr: any) {
          console.error(`[Content Generator] Fallback error for news ${news.id}:`, fallbackErr);
          result.failed++;
          result.results.push({ newsId: news.id, title: news.title, success: false, error: fallbackErr.message });
        }
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
    
Haber Başlığı: ${sanitizePlainText(news.title)}
Kaynak: ${news.source?.name || 'Bilinmiyor'}
Haber Özeti: ${sanitizePlainText(news.summary || news.aiSummary || '')}
    
Kurallar:
1. Dikkat çekici bir başlık ile başla.
2. 2-4 kısa paragraftan oluşsun (okunması kolay).
3. Haber kaynağına dayalı net bir özet sun.
4. Kesinleşmemiş haberler için "iddia edildi", "öne sürüldü" gibi güvenilirlik ifadeleri kullan.
5. Sonunda Bordo Mavi tarzında kısa bir yorum ekle (Örn: "Sizce bu transfer takıma katkı sağlar mı?", "Fırtına'nın yeni rotası ne olacak?").
6. Gönderinin en altına 3-5 adet hashtag ekle (#Trabzonspor vb.).
7. KESİNLİKLE hiçbir yerde markdown yıldız işareti (**, *) KULLANMA. Başlıkları ve vurguları sade düz metin olarak veya büyük harfle yaz. Metnin başında, ortasında veya sonunda asla ** olmasın.
8. Yanıtını doğrudan paylaşılacak düz metin olarak gönder (JSON veya ekstra açıklama olmadan).`;

    let cleanBody = '';
    try {
      const generatedText = await aiProvider.generateContent(prompt);
      cleanBody = sanitizePlainText(generatedText || '');
    } catch (aiErr: any) {
      console.warn(`[Content Generator] AI single generation failed (${aiErr.message}), using smart fallback...`);
      cleanBody = generateSmartFallbackPost(news);
    }

    if (!cleanBody) {
      cleanBody = generateSmartFallbackPost(news);
    }

    const cleanTitle = sanitizePlainText(news.title);

    let contentType = 'NEWS';
    if (news.aiRecommendedContentType) {
        contentType = news.aiRecommendedContentType;
    }

    const created = await prisma.content.create({
      data: {
        title: cleanTitle,
        body: cleanBody,
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

