import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';
import {
  isNewsTooOld,
  checkAgainstPublishedHistory,
  deduplicateNewsBatch
} from '@/lib/news/news-similarity-engine';

/**
 * Dış haber ajansı ve yerel site isimlerini (Günebakış, Haber61, 61saat vb.) metinden temizler.
 * Bordo Mavi doğrudan ana kaynak konumundadır.
 */
export function stripExternalSources(text: string): string {
  if (!text) return '';
  return text
    // "Kaynak : Günebakış", "Kaynak: Haber61", "Kaynak: 61saat" vb. satırları tamamen sil
    .replace(/(^|\n)\s*Kaynak\s*:\s*[^\n\r]+/gi, '')
    .replace(/\bKaynak\s*:\s*[A-Za-z0-9ÇĞİÖŞÜçğıöşü\s\.\-]+(?=\n|$)/gi, '')
    // "Günebakış'ın haberine göre", "Haber61'e göre", "61saat'ten alınan bilgiye göre"
    .replace(/\b(Günebakış|Gunebakis|Haber61|61saat|Kuzey\s*Ekspres|Taka|Fotomaç|Fotomac|Fanatik|DHA|AA|İHA)('ın|'in|'un|'ün|'e|'a)?\s+(özel\s+)?(haberine|haberine göre|aktardığına göre|göre|kaynaklı|tarafından)\b/gi, 'Bordo Mavi Haber Merkezi\'nin edindiği bilgiye göre')
    // "devamı için tıklayınız", "haberin devamı için tıklayın", "ayrıntılar için tıklayınız" vb. ifadeleri tamamen temizle
    .replace(/(haberin\s+)?(devamı|ayrıntıları|detayları)\s+için\s+(tıklayınız|tıklayın|buraya\s+tıklayın)[\.\…]*/gi, '')
    .replace(/\b(devamı|detaylar)\s+için\s+tıklayın\b/gi, '')
    .replace(/\b(devamı|detaylar)\s+için\s+tıklayınız\b/gi, '')
    .replace(/\bdevamı\s+için\b/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Helper to strictly remove markdown asterisks (** and *) and external sources for clean plain text publishing
export function sanitizePlainText(text: string): string {
  if (!text) return '';
  const noSources = stripExternalSources(text);
  return noSources
    .replace(/\*\*/g, '')
    .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
    .trim();
}

export function generateSmartFallbackPost(news: any): string {
  const cleanTitle = sanitizePlainText(news.title || '');
  let cleanSummary = sanitizePlainText(news.summary || news.aiSummary || '');

  // Eğer özet çok kısaysa zengin ve doyurucu bir haber gövdesi oluştur
  if (cleanSummary.length < 120) {
    cleanSummary = `Bordo-Mavili kulüpte sıcak saatler yaşanıyor. Trabzonspor teknik heyeti ve yönetimi, takımın başarısı ve şampiyonluk yolundaki hedefleri doğrultusunda çalışmalarını aralıksız sürdürüyor. Yaşanan bu son gelişme camiada ve taraftarlar arasında büyük yankı uyandırırken, kulüp yetkililerinin konuyla ilgili planlamalarını titizlikle yürüttüğü öğrenildi.`;
  }

  const category = (news.category || news.aiRecommendedContentType || '').toUpperCase();
  let badge = 'BORDO MAVİ ÖZEL HABER';
  if (category.includes('TRANSFER')) badge = 'BORDO MAVİ TRANSFER GELİŞMESİ';
  else if (category.includes('MATCH')) badge = 'TRABZONSPOR MAÇ GÜNDEMİ';
  else if (category.includes('ANALYSIS')) badge = 'BORDO MAVİ ÖZEL ANALİZ';

  const fanQuestions = [
    '📌 Sizce bu karar Trabzonspor’un hedeflerini nasıl etkiler? (1-10 arası puanlayın!)',
    '🔥 Bordo-Mavi renklere gönül verenler: Bu hamleyi destekliyor musunuz? Katılanlar "BEĞEN" butonuna bassın, fikri olan yoruma yazsın!',
    '⚽ Sizce ilk 11’in değişilmezi mi olmalı, yoksa hamle oyuncusu mu kalmalı? (1: İlk 11 / 2: Yedek) Yorumlarda buluşalım!',
    '🗣️ Bordo-Mavili taraftarlar ses veriyor! Bu gelişme hakkındaki net görüşünüz nedir? Herkes tek cümleyle yazsın!',
    '⚡ Fırtına zirveye kilitlendi! Teknik heyetin bu tercihini doğru buluyor musunuz? (EVET / HAYIR) Fikirlerinizi paylaşın!',
    '🏆 Şampiyonluk yolunda kritik viraj! Bordo-Mavili renklere gönül verenler yorumlarda kenetleniyor! 👇'
  ];
  const selectedQuestion = fanQuestions[Math.floor(Math.random() * fanQuestions.length)];

  let post = `${badge}\n\n${cleanTitle}\n\n${cleanSummary}\n\n${selectedQuestion}\n\n#Trabzonspor #BordoMavi #Fırtına #SüperLig`;

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
  // Kesin tazelik eşiği: 24 saatten eski haberlerden ASLA otomatik içerik üretilmez
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // 1. Taze ve kaliteli haberleri bul (son 24 saat, puan >= 65)
    const candidateNews = await prisma.news.findMany({
      where: {
        isProcessed: true,
        OR: [
          { isTrabzonsporRelated: true },
          { isTrabzonsporRelated: null }
        ],
        aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
        content: null, // henüz içerik üretilmemiş
        importanceScore: { gte: MIN_AI_SCORE },
        publishedAt: { gte: twentyFourHoursAgo } // Katı tazelik filtresi
      },
      include: { source: true },
      orderBy: { importanceScore: 'desc' }, // En önemli haberler önce
      take: limit * 4
    });

    if (candidateNews.length === 0) {
      console.log(`[Content Generator] No fresh candidate news found (last 24h, AI score >= ${MIN_AI_SCORE}).`);
      return result;
    }

    console.log(`[Content Generator] Found ${candidateNews.length} candidates. Running cross-source deduplication...`);

    // 2. Farklı yerel/ulusal kaynaklardan gelen AYNI olayı anlatan haberleri tekilleştir
    const { uniqueNews, duplicateNews } = deduplicateNewsBatch(candidateNews);

    // Mükerrer olanları veritabanında işaretle ki tekrar seçilmesinler
    for (const dup of duplicateNews) {
      console.log(`[Content Generator] Cross-source duplicate filtered: "${dup.item.title}" matches "${dup.duplicateOf.title}" (%${Math.round(dup.similarity * 100)})`);
      try {
        await prisma.news.update({
          where: { id: dup.item.id },
          data: {
            isProcessed: true,
            aiRecommendedAction: 'IGNORE',
            aiSummary: (dup.item.aiSummary || dup.item.summary || '') + `\n[MÜKERRER KAYNAK] "${dup.duplicateOf.title}" haberi ile aynı olay (%${Math.round(dup.similarity * 100)}).`
          }
        });
      } catch (e) {
        // pas geç
      }
    }

    console.log(`[Content Generator] ${uniqueNews.length} unique fresh candidates remaining after cross-source dedup.`);

    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");

    for (const news of uniqueNews) {
      if (result.processed + result.failed >= limit) {
        break;
      }

      if (generatingIds.has(news.id)) {
        continue;
      }

      // 3. Tazelik Son Kontrolü: 24 saatten eski ise atla
      if (isNewsTooOld(news.publishedAt, 24)) {
        console.log(`[Content Generator] Skipping stale news (>24h): ${news.title}`);
        await prisma.news.update({
          where: { id: news.id },
          data: {
            isProcessed: true,
            aiRecommendedAction: 'IGNORE',
            aiSummary: (news.aiSummary || news.summary || '') + '\n[BAYAT HABER] 24 saatten eski olduğu için otonom üretim engellendi.'
          }
        });
        continue;
      }

      // 4. Geçmiş Yayın Hafızası Kontrolü (Son 14 gün)
      // Eğer bu haber son 14 gün içinde Facebook'ta yayınlandıysa tekrar yayınlama!
      const historyCheck = await checkAgainstPublishedHistory(
        { id: news.id, title: news.title, summary: news.summary || news.aiSummary },
        14
      );

      if (historyCheck.isDuplicate) {
        console.log(`[Content Generator] Anti-Duplicate Guard: "${news.title}" matches published post "${historyCheck.matchedPost?.title}". Skipping.`);
        await prisma.news.update({
          where: { id: news.id },
          data: {
            isProcessed: true,
            aiRecommendedAction: 'IGNORE',
            aiSummary: (news.aiSummary || news.summary || '') + `\n[GEÇMİŞ YAYIN KORUMASI] ${historyCheck.reason}`
          }
        });
        continue;
      }

      generatingIds.add(news.id);

      try {
        console.log(`[Content Generator] Generating content for fresh & unique news: ${news.title}`);
        
        const prompt = `
Lütfen aşağıdaki haber detaylarını kullanarak Bordo Mavi (Trabzonspor) taraftar platformu için dikkat çekici bir Facebook gönderisi taslağı oluştur.
        
Haber Başlığı: ${sanitizePlainText(news.title)}
Haber Detayı: ${sanitizePlainText(news.summary || news.aiSummary || '')}
        
Kurallar:
1. Dikkat çekici, merak uyandıran güçlü bir başlık ile başla.
2. Doyurucu, akıcı ve bilgilendirici olsun (en az 3-4 zengin paragraf). Haberin kim, ne zaman, neden ve nasıl detaylarını, taraftarın merak ettiği tüm teknik ve kulis boyutlarını eksiksiz aktar. Metin 1-2 cümlelik kısa bir özet değil, taraftarın okuduğunda tüm gelişmeyi baştan sona tam anlayacağı zengin ve tatmin edici bir haber makalesi olmalıdır.
3. Haberin kaynağı KESİNLİKLE 'Bordo Mavi Haber Merkezi' veya 'Bordo Mavi Özel'dir. Asla başka gazete veya site adı (Günebakış, Haber61, 61saat, Fanatik, Fotomaç vb.) KULLANMA. 'Kaynak: ...' veya '... sitesine göre' gibi ifadeler KESİNLİKLE YASAKTIR. KESİNLİKLE 'Devamı için tıklayınız', 'Detaylar için tıklayın', 'Haberin devamı sitemizde' gibi dış link çağrışımları KULLANMA. Haberin tamamını doğrudan bu gönderide aktar.
4. Kesinleşmemiş haberler için "kulüp kaynaklarından edinilen bilgiye göre", "yönetim kulislerinde konuşulanlara göre" gibi güvenilir ifadeler kullan.
5. Gönderinin sonuna takipçileri YORUM YAPMAYA, OYLAMAYA ve TARTIŞMAYA teşvik edecek net ve etkileşim patlatıcı bir soru veya A/B tercihi ekle (Örn: 'Sizce ilk 11 başlamalı mı yoksa hamle oyuncusu mu kalmalı? (1: İlk 11 / 2: Yedek)', 'Bu kararı destekliyor musunuz? (EVET / HAYIR)', 'Bu hamleyi 1-10 arası puanlayın!'). Sonuna 'Fikrinizi yorumlarda belirtin!' veya 'Yorumlarda buluşalım!' çağrısı ekle.
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
            qualityScore: news.importanceScore || news.credibilityScore || 88,
            viralScore: news.viralScore || 85,
            newsValueScore: news.importanceScore || 85,
            confidenceScore: 90
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
              qualityScore: news.importanceScore || news.credibilityScore || 86,
              viralScore: news.viralScore || 84,
              newsValueScore: news.importanceScore || 85,
              confidenceScore: 88,
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
Haber Detayı: ${sanitizePlainText(news.summary || news.aiSummary || '')}
    
Kurallar:
1. Dikkat çekici, merak uyandıran güçlü bir başlık ile başla.
2. Doyurucu, akıcı ve bilgilendirici olsun (en az 3-4 zengin paragraf). Haberin kim, ne zaman, neden ve nasıl detaylarını, taraftarın merak ettiği tüm teknik ve kulis boyutlarını eksiksiz aktar. Metin 1-2 cümlelik kısa bir özet değil, taraftarın okuduğunda tüm gelişmeyi baştan sona tam anlayacağı zengin ve tatmin edici bir haber makalesi olmalıdır.
3. Haberin kaynağı KESİNLİKLE 'Bordo Mavi Haber Merkezi' veya 'Bordo Mavi Özel'dir. Asla başka gazete veya site adı (Günebakış, Haber61, 61saat, Fanatik, Fotomaç vb.) KULLANMA. 'Kaynak: ...' veya '... sitesine göre' gibi ifadeler KESİNLİKLE YASAKTIR. KESİNLİKLE 'Devamı için tıklayınız', 'Detaylar için tıklayın', 'Haberin devamı sitemizde' gibi dış link çağrışımları KULLANMA. Haberin tamamını doğrudan bu gönderide aktar.
4. Kesinleşmemiş haberler için "kulüp kaynaklarından edinilen bilgiye göre", "yönetim kulislerinde konuşulanlara göre" gibi güvenilir ifadeler kullan.
5. Gönderinin sonuna takipçileri YORUM YAPMAYA, OYLAMAYA ve TARTIŞMAYA teşvik edecek net ve etkileşim patlatıcı bir soru veya A/B tercihi ekle (Örn: 'Sizce ilk 11 başlamalı mı yoksa hamle oyuncusu mu kalmalı? (1: İlk 11 / 2: Yedek)', 'Bu kararı destekliyor musunuz? (EVET / HAYIR)', 'Bu hamleyi 1-10 arası puanlayın!'). Sonuna 'Fikrinizi yorumlarda belirtin!' veya 'Yorumlarda buluşalım!' çağrısı ekle.
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

    // Geçmiş yayın kontrolü ve tazelik kontrolü
    const historyCheck = await checkAgainstPublishedHistory(
      { id: news.id, title: news.title, summary: news.summary || news.aiSummary },
      14
    );
    const isOld = isNewsTooOld(news.publishedAt, 24);
    let reasoningNote = '';
    if (historyCheck.isDuplicate) {
      reasoningNote = `[MÜKERRER UYARISI] Bu konu son 14 günde yayınlanan "${historyCheck.matchedPost?.title}" ile benzer (%${Math.round(historyCheck.similarity * 100)}).`;
    } else if (isOld) {
      reasoningNote = '[BAYAT HABER UYARISI] Haber 24 saatten eski.';
    }

    const created = await prisma.content.create({
      data: {
        title: cleanTitle,
        body: cleanBody,
        type: contentType as any,
        status: 'DRAFT',
        sourceNewsId: news.id,
        aiReasoning: reasoningNote || undefined
      }
    });

    return { success: true, data: created, duplicateWarning: historyCheck.isDuplicate, matchedPost: historyCheck.matchedPost };

  } catch (error: any) {
    console.error(`[Content Generator] Error generating for news ${newsId}:`, error);
    return { success: false, error: error.message };
  } finally {
    generatingIds.delete(newsId);
  }
}

