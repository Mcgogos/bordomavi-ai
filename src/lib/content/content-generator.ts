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
    // Bordo Mavi AI / AI Editör ibarelerini temizle, imza olarak sadece Editör kalsın
    .replace(/Bordo\s*Mavi\s*AI\s*Editör(\s*paylaştı)?/gi, 'Editör')
    .replace(/\bAI\s*Editör(\s*paylaştı)?/gi, 'Editör')
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
  let rawSummary = sanitizePlainText(news.summary || news.aiSummary || '');
  const lowerText = `${cleanTitle} ${rawSummary}`.toLocaleLowerCase('tr-TR');

  // Konu ve Kategori Tespiti
  const isTransfer = lowerText.includes('transfer') || lowerText.includes('imza') || lowerText.includes('bonservis') || lowerText.includes('anlaşma') || lowerText.includes('teklif') || lowerText.includes('görüşme') || lowerText.includes('talip');
  const isDerbyMatch = lowerText.includes('derbi') || lowerText.includes('beşiktaş') || lowerText.includes('fenerbahçe') || lowerText.includes('galatasaray') || lowerText.includes('maç') || lowerText.includes('karşılaşma') || lowerText.includes('rakip');
  const isInjury = lowerText.includes('sakat') || lowerText.includes('tedavi') || lowerText.includes('revir') || lowerText.includes('ameliyat') || lowerText.includes('yırtık');
  const isReferee = lowerText.includes('hakem') || lowerText.includes('mhk') || lowerText.includes('tff') || lowerText.includes('var') || lowerText.includes('ceza') || lowerText.includes('pfdk');
  const isManagement = lowerText.includes('ertuğrul doğan') || lowerText.includes('yönetim') || lowerText.includes('başkan') || lowerText.includes('sponsor') || lowerText.includes('divan');

  // Rozet / Kategori Başlığı
  let badge = 'BORDO MAVİ ÖZEL HABER';
  if (isTransfer) badge = 'BORDO MAVİ TRANSFER MASASI';
  else if (isDerbyMatch) badge = 'FIRTINA MAÇ VE DERBİ GÜNDEMİ';
  else if (isInjury) badge = 'BORDO MAVİ SAĞLIK RAPORU';
  else if (isReferee) badge = 'BORDO MAVİ HAKEM VE TFF DOSYASI';
  else if (isManagement) badge = 'BORDO MAVİ YÖNETİM & KULİS';

  // Dinamik Giriş Kancası (Statik şablon kaldırıldı, başlığa göre değişken açılış)
  const hooks = [
    `Bordo-Mavili renklere gönül verenlerin yakından takip ettiği sıcak gelişme gündeme bomba gibi düştü.`,
    `Trabzonspor Haber Merkezi'nin kulüp kulislerinden edindiği bilgilere göre camiada hareketli saatler yaşanıyor.`,
    `Fırtına'da kritik viraja girilirken önemli bir gelişme netlik kazanma noktasına geldi.`,
    `Trabzonspor'da teknik heyet ve yönetimin ajandasındaki en kritik dosya masaya yatırıldı.`
  ];
  const hookIndex = Math.abs(cleanTitle.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % hooks.length;
  const selectedHook = hooks[hookIndex];

  // Haber Gövdesi Sentezi
  let bodyParagraphs = '';
  if (rawSummary && rawSummary.length > 50) {
    bodyParagraphs = rawSummary;
  } else {
    bodyParagraphs = `${cleanTitle}. Yaşanan bu gelişmeyle ilgili olarak Bordo-Mavili teknik heyet ve yönetimin yol haritasını belirlediği bildirildi.`;
  }

  // Kategoriye Özel Derinlemesine Detay Paragrafı
  let categoryDetail = '';
  if (isTransfer) {
    categoryDetail = 'Bordo-Mavili transfer komitesi, oyuncunun takıma katkısı ve kulübün bütçe dengeleri üzerinde kapsamlı bir inceleme yürütüyor. Teknik direktörün sunduğu rapor doğrultusunda temasların hız kazanması ve resmi adımların atılması bekleniyor.';
  } else if (isDerbyMatch) {
    categoryDetail = 'Teknik heyet, zorlu karşılaşma öncesi oyuncularını hem taktiksel varyasyonlar hem de yüksek konsantrasyonla maça hazırlıyor. Taraftarların vereceği itici güçle birlikte sahadan mutlak 3 puanla ayrılmak hedefleniyor.';
  } else if (isInjury) {
    categoryDetail = 'Kulüp sağlık heyetinin oyuncunun tedavi sürecini anbean takip ettiği ve sahalara dönüş sürecinin en sağlıklı şekilde tamamlanması adına özel bir rehabilitasyon programı uyguladığı öğrenildi.';
  } else if (isReferee) {
    categoryDetail = 'Bordo-Mavili camia sahada adaletin sağlanması adına gelişmeleri çok yakından izlerken, kulüp yönetiminin hakem performansları ve federasyon kararları konusunda kararlı bir duruş sergilediği belirtiliyor.';
  } else if (isManagement) {
    categoryDetail = 'Trabzonspor Yönetim Kurulu, kulübün hem ekonomik geleceğini garanti altına almak hem de sahada yarışmacı kimliğini en üst seviyede tutmak amacıyla stratejik hamlelerini sürdürüyor.';
  } else {
    categoryDetail = 'Teknik heyet ve yönetim, Trabzonspor’un hedeflerine yakışır bir mücadele ortaya koyması için tüm kulis ve idari çalışmaları eksiksiz biçimde yürütüyor.';
  }

  // Konuya Özel İnteraktif Taraftar Sorusu
  let fanQuestion = '';
  if (isTransfer) {
    fanQuestion = '🔥 Trabzonspor taraftarı ne diyor? Sizce bu transfer hamlesi takıma sınıf atlatır mı? (1-10 arası puanınızı yorumlara yazın!)';
  } else if (isDerbyMatch) {
    fanQuestion = '⚽ Büyük karşılaşma öncesi skor tahmininiz nedir? Sizce galibiyetin anahtarı hangi oyuncumuzda? Yorumlarda buluşalım! 👇';
  } else if (isInjury) {
    fanQuestion = '📌 Bu mevkide teknik heyetin forma şansı vermesi gereken isim sizce kim olmalı? Fikirlerinizi yorumlarda paylaşın!';
  } else if (isReferee) {
    fanQuestion = '🗣️ Bu hakem ve federasyon kararı hakkında Bordo-Mavili camianın görüşü ne? (ADİL / YANLI) Yorumunuzu bırakın!';
  } else if (isManagement) {
    fanQuestion = '⚡ Yönetimin bu adımını canı gönülden destekliyor musunuz? (KATILIYORUM / KATILMIYORUM) Yorumlarda tartışalım!';
  } else {
    fanQuestion = '📢 Fırtına taraftarı ses veriyor! Bu sıcak gelişme hakkındaki net görüşünüz nedir? Herkes yorumunu bıraksın! 👇';
  }

  const post = `${badge}\n\n${cleanTitle}\n\n${selectedHook}\n\n${bodyParagraphs}\n\n${categoryDetail}\n\n${fanQuestion}\n\n✍️ Editör\n\n#Trabzonspor #BordoMavi #Fırtına #SüperLig`;

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

      // 4. Geçmiş Yayın Hafızası Kontrolü (Son 60 gün)
      // Eğer bu haber son 60 gün içinde Facebook'ta yayınlandıysa tekrar yayınlama!
      const historyCheck = await checkAgainstPublishedHistory(
        { id: news.id, title: news.title, summary: news.summary || news.aiSummary },
        60
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
6. Gönderinin sonuna hashtaglerden hemen önce imza olarak SADECE '✍️ Editör' yaz. Asla 'Bordo Mavi AI Editör', 'Bordo Mavi AI paylaştı' veya benzeri yapay zeka ibareleri KULLANMA. İmza yalnızca '✍️ Editör' olmalıdır. Ardından 3-5 adet hashtag ekle (#Trabzonspor vb.).
7. KESİNLİKLE hiçbir yerde markdown yıldız işareti (**, *) KULLANMA. Başlıkları ve vurguları sade düz metin olarak veya büyük harfle yaz. Metnin başında, ortasında veya sonunda asla ** olmasın.
8. Yanıtını doğrudan paylaşılacak düz metin olarak gönder (JSON veya ekstra açıklama olmadan).
9. KESİNLİKLE 'Bordo-Mavili kulüpte sıcak saatler yaşanıyor' gibi beylik, genel geçer veya tekrarlayan kalıp girişlerle başlama! Haberin öznesine, maçına veya olayına doğrudan ve özgün bir üslupla giriş yap. Her haberin açılış cümlesi birbirinden tamamen farklı ve o habere özel olmalıdır.`;

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
6. Gönderinin sonuna hashtaglerden hemen önce imza olarak SADECE '✍️ Editör' yaz. Asla 'Bordo Mavi AI Editör', 'Bordo Mavi AI paylaştı' veya benzeri yapay zeka ibareleri KULLANMA. İmza yalnızca '✍️ Editör' olmalıdır. Ardından 3-5 adet hashtag ekle (#Trabzonspor vb.).
7. KESİNLİKLE hiçbir yerde markdown yıldız işareti (**, *) KULLANMA. Başlıkları ve vurguları sade düz metin olarak veya büyük harfle yaz. Metnin başında, ortasında veya sonunda asla ** olmasın.
8. Yanıtını doğrudan paylaşılacak düz metin olarak gönder (JSON veya ekstra açıklama olmadan).
9. KESİNLİKLE 'Bordo-Mavili kulüpte sıcak saatler yaşanıyor' gibi beylik, genel geçer veya tekrarlayan kalıp girişlerle başlama! Haberin öznesine, maçına veya olayına doğrudan ve özgün bir üslupla giriş yap. Her haberin açılış cümlesi birbirinden tamamen farklı ve o habere özel olmalıdır.`;

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

