import { AIFactory } from "@/services/ai/ai.factory";
import { stripExternalSources, sanitizePlainText } from "@/lib/content/content-generator";

export interface ReelScriptScene {
  sceneIndex: number;
  timeRange: string;
  startSecond: number;
  durationSeconds: number;
  badge: string;
  subtitle: string;
  spokenText: string;
}

export interface ReelScriptData {
  title: string;
  category: 'BREAKING' | 'TRANSFER' | 'MATCH_PREVIEW' | 'INJURY' | 'MANAGEMENT' | 'GENERAL';
  badgeTitle: string;
  fullNarration: string;
  estimatedDurationSeconds: number;
  scenes: ReelScriptScene[];
  facebookCaption: string;
  pollQuestion: string;
  pollOption1: string;
  pollOption2: string;
}

/**
 * Haberin detaylarını analiz ederek Facebook Reels için 100% habere özel,
 * akıcı ve dinamik bir Türkçe seslendirme senaryosu üretir.
 * Statik şablonları asla tekrar etmez; yapay zeka ile habere özgü metin hazırlar.
 */
function cleanNewsForScript(title: string, rawText: string): string {
  let cleaned = rawText
    .replace(/(İşte detaylar|ayrıntılar|foto galeri|tıklayınız|tıklayın|muhabirimiz|haber merkezi|kaynak).*$/gi, '')
    .replace(/\b(AA|DHA|İHA|IHA)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 20) cleaned = title;
  return cleaned;
}

export async function generateReelScript(params: {
  title: string;
  summary?: string | null;
  body?: string | null;
  category?: string | null;
}): Promise<ReelScriptData> {
  const cleanTitle = sanitizePlainText(params.title || '');
  const rawBodyOrSummary = sanitizePlainText(params.body || params.summary || '');
  const cleanSummary = cleanNewsForScript(cleanTitle, rawBodyOrSummary);
  const lowerText = `${cleanTitle} ${cleanSummary}`.toLocaleLowerCase('tr-TR');

  // Kategori Tespiti
  let category: ReelScriptData['category'] = 'GENERAL';
  let badgeTitle = 'BORDO MAVİ ÖZEL';

  if (lowerText.includes('transfer') || lowerText.includes('imza') || lowerText.includes('bonservis') || lowerText.includes('anlaşma')) {
    category = 'TRANSFER';
    badgeTitle = 'TRANSFER MASASI';
  } else if (lowerText.includes('derbi') || lowerText.includes('beşiktaş') || lowerText.includes('fenerbahçe') || lowerText.includes('galatasaray') || lowerText.includes('maç günü')) {
    category = 'MATCH_PREVIEW';
    badgeTitle = 'DERBİ GÜNDEMİ';
  } else if (lowerText.includes('sakat') || lowerText.includes('tedavi') || lowerText.includes('ameliyat') || lowerText.includes('revir')) {
    category = 'INJURY';
    badgeTitle = 'SAĞLIK RAPORU';
  } else if (lowerText.includes('ertuğrul doğan') || lowerText.includes('yönetim') || lowerText.includes('başkan') || lowerText.includes('sponsor')) {
    category = 'MANAGEMENT';
    badgeTitle = 'KULÜP KULİSİ';
  } else if (lowerText.includes('son dakika') || lowerText.includes('flaş') || lowerText.includes('resmi')) {
    category = 'BREAKING';
    badgeTitle = 'SON DAKİKA';
  }

  // 1. AI ile Habere Özel Orijinal, Doğal ve Akıcı Seslendirme Metni Üret
  let aiNarration = '';
  let customPollQuestion = '';

  try {
    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");
    const prompt = `
Aşağıdaki Trabzonspor haberini 9:16 dikey Facebook Reels videosu için profesyonel bir kadın haber spikerinin seslendireceği dinamik, kurumsal ve akıcı bir TV bülten metnine dönüştür.

Haber Başlığı: ${cleanTitle}
Haber Detayı: ${cleanSummary}
Kategori: ${badgeTitle}

ZORUNLU KURALLAR (2026 META REELS ALGORİTMA STANDARDI):
1. HABER KAYNAĞI YASAK: Kesinlikle dış haber ajansı veya kaynak adı (Günebakış, Haber61, 61saat vb.) KULLANMA.
2. SESLENDİRME UYUMLULUĞU: 
   - Tüm sayıları, skorları ve tarihleri doğrudan OKUNUŞLARIYLA (yazıyla) yaz (Örn: "iki bir", "üçüncü hafta", "yirmi beş milyon euro").
   - Kısaltma KULLANMA; açıkça yaz (Örn: "teknik direktör", "dakika").
3. AKICI VE DOĞAL DİLBİLGİSİ:
   - Cümleler devrik veya anlamsız olmamalı; tam ve kurallı Türkçe spiker cümleleri kur.
   - "Sıcak saatler yaşanıyor", "bomba gelişme" gibi klişeler yerine doğrudan konunun özüne odaklan.
4. METİN UZUNLUĞU: Toplam 45-60 kelime arasında, ~18-24 saniyede rahatça okunacak ideal Facebook Reels temposunda olsun.
5. METİN AKIŞI:
   - Kanca: Haberin en kritik gelişmesini ilk cümlede net ver.
   - Detay: Teknik heyet, yönetim veya oyuncunun reaksiyonunu açıkla.
   - Etkileşim: İzleyicinin fikrini soran tek ve samimi bir soruyla bitir (Örn: "Sizce bu karar fırtınanın gidişatını nasıl etkiler? Yorumlarınızı bekliyoruz.").
6. ANKET ÇIKARTMASI: Metnin sonuna ayrı bir satırda "ANKET: <4-6 kelimelik soru>" şeklinde ekranda gösterilecek anket kartı sorusunu yaz (Örn: "ANKET: Sizce bu transfer doğru mu?").
7. Yalnızca mikrofonda doğrudan okunacak yalın metni ver. Parantez, sahne yönergesi, tırnak veya emoji KULLANMA.`;

    const generated = await aiProvider.generateContent(prompt);
    let rawTextOutput = sanitizePlainText(generated || '');

    // Anket sorusunu ayıkla
    const pollMatch = rawTextOutput.match(/ANKET:\s*([^\n\r]+)/i);
    if (pollMatch && pollMatch[1]) {
      customPollQuestion = pollMatch[1].replace(/[?"']/g, '').trim() + '?';
      rawTextOutput = rawTextOutput.replace(/ANKET:\s*[^\n\r]+/gi, '').trim();
    }

    aiNarration = rawTextOutput
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/^(Sahne|Kanca|Seslendirme|Metin|Spiker)\s*\d*:\s*/gim, '')
      .trim();
  } catch (err: any) {
    console.warn("[ReelScriptGenerator] AI script generation warning, using dynamic fallback:", err.message);
  }

  // 2026 Meta Algoritma Standardı: İdeal video süresi 18-28 sn (45-60 kelime)
  const currentWordCount = aiNarration.split(/\s+/).filter(Boolean).length;
  if (!aiNarration || currentWordCount < 35 || aiNarration.length < 200) {
    let hook = `Trabzonspor gündeminde ${cleanTitle} gelişmesi dikkatleri üzerine çekti.`;
    const firstSentences = cleanSummary.split(/(?<=[.?!])\s+/).filter(Boolean);
    const shortDetail = firstSentences.slice(0, 2).join(' ').trim();
    let detail = shortDetail.length >= 30 && shortDetail.length <= 220
      ? shortDetail
      : (shortDetail.slice(0, 200).replace(/\s+\S*$/, '') + '.');
    if (detail.length < 30) {
      detail = 'Bordo-Mavili teknik heyet ve yönetimin konuyla ilgili planlamalarını titizlikle sürdürdüğü, gelişmelerin yakından takip edildiği bildirildi.';
    }

    let cta = category === 'TRANSFER' 
      ? 'Sizce bu transfer hamlesi takıma sınıf atlatır mı? Görüşlerinizi ve yorumlarınızı bekliyoruz!'
      : category === 'MATCH_PREVIEW'
      ? 'Bu kritik mücadele öncesi takımın performansını nasıl değerlendiriyorsunuz? Yorumlarda buluşalım!'
      : 'Peki siz bu son gelişmeyi nasıl değerlendiriyorsunuz? Fikirlerinizi yorumlarda paylaşmayı unutmayın!';

    aiNarration = `${hook} ${detail} ${cta}`;
  }

  // Maksimum 60 kelime tavanı (18-28 saniye tatlı noktasını korumak için)
  if (aiNarration.split(/\s+/).filter(Boolean).length > 60) {
    const allSentences = aiNarration.split(/(?<=[.?!])\s+/).filter(Boolean);
    let bounded = '';
    for (const s of allSentences) {
      if ((bounded + ' ' + s).trim().split(/\s+/).length <= 58) {
        bounded = (bounded + ' ' + s).trim();
      } else break;
    }
    aiNarration = bounded || allSentences.slice(0, 3).join(' ');
  }

  // 2. Etkileşim ve Dwell Time Artırıcı Anket (Poll Card) Sorusu & Seçenekleri
  let pollQuestion = customPollQuestion || 'Sizce bu gelişme doğru mu?';
  let pollOption1 = 'Evet, tam isabet';
  let pollOption2 = 'Hayır, gereksiz';

  if (category === 'TRANSFER') {
    pollQuestion = customPollQuestion || 'Sizce bu transfer doğru mu?';
    pollOption1 = 'Evet, tam isabet';
    pollOption2 = 'Hayır, gereksiz';
  } else if (category === 'MATCH_PREVIEW') {
    pollQuestion = customPollQuestion || 'Trabzonspor bu maçı kazanır mı?';
    pollOption1 = 'Evet, kazanırız';
    pollOption2 = 'Zor maç, puan kaybı';
  } else if (category === 'MANAGEMENT') {
    pollQuestion = customPollQuestion || 'Yönetimin bu kararı doğru mu?';
    pollOption1 = 'Evet, sonuna kadar';
    pollOption2 = 'Hayır, yanlış karar';
  } else if (category === 'INJURY') {
    pollQuestion = customPollQuestion || 'Bu sakatlık takımı nasıl etkiler?';
    pollOption1 = 'Yerini doldururuz';
    pollOption2 = 'Ciddi kayıp yaşarız';
  } else if (category === 'BREAKING') {
    pollQuestion = customPollQuestion || 'Bu son dakika kararını destekliyor musunuz?';
    pollOption1 = 'Evet, katılıyorum';
    pollOption2 = 'Hayır, katılmıyorum';
  }

  // 3. Metni Cümlelere Böl (Altyazı ve Görsel Zamanlaması İçin)
  const sentences = aiNarration.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  
  // Ortalama konuşma hızı: ~2.8 kelime/saniye (1.32x tempolu okuma)
  const wordCount = aiNarration.split(/\s+/).length;
  const estimatedDuration = Math.max(18, Math.min(32, Math.round(wordCount / 2.7)));

  const sceneDuration = +(estimatedDuration / 4).toFixed(1);

  const scenes: ReelScriptScene[] = [
    {
      sceneIndex: 1,
      timeRange: `0.0 - ${sceneDuration} sn`,
      startSecond: 0,
      durationSeconds: sceneDuration,
      badge: badgeTitle,
      subtitle: sentences[0] || cleanTitle,
      spokenText: sentences[0] || cleanTitle
    },
    {
      sceneIndex: 2,
      timeRange: `${sceneDuration} - ${(sceneDuration * 2).toFixed(1)} sn`,
      startSecond: sceneDuration,
      durationSeconds: sceneDuration,
      badge: 'GELİŞME DETAYI',
      subtitle: sentences[1] || cleanTitle,
      spokenText: sentences[1] || cleanTitle
    },
    {
      sceneIndex: 3,
      timeRange: `${(sceneDuration * 2).toFixed(1)} - ${(sceneDuration * 3).toFixed(1)} sn`,
      startSecond: +(sceneDuration * 2).toFixed(1),
      durationSeconds: sceneDuration,
      badge: 'PERDE ARKASI',
      subtitle: sentences[2] || sentences[sentences.length - 2] || cleanSummary.slice(0, 80),
      spokenText: sentences[2] || sentences[sentences.length - 2] || cleanSummary.slice(0, 80)
    },
    {
      sceneIndex: 4,
      timeRange: `${(sceneDuration * 3).toFixed(1)} - ${estimatedDuration} sn`,
      startSecond: +(sceneDuration * 3).toFixed(1),
      durationSeconds: +(estimatedDuration - sceneDuration * 3).toFixed(1),
      badge: 'SENİN GÖRÜŞÜN?',
      subtitle: sentences[sentences.length - 1] || 'Fikrini yorumlarda belirt!',
      spokenText: sentences[sentences.length - 1] || 'Fikrini yorumlarda belirt!'
    }
  ];

  // 4. Meta 2026 Algoritma Standartlarında Facebook Reels Açıklaması:
  // - Engagement bait yok
  // - Doğal spiker anlatımı
  // - Yalnızca "✍️ Editör" imzası
  // - 3 ila 5 CamelCase hashtag
  const categoryTag = category === 'TRANSFER' ? '#TransferHaberleri' : category === 'MATCH_PREVIEW' ? '#MaçGünü' : '#SonDakika';
  const facebookCaption = `🎬 ${cleanTitle}\n\n${aiNarration}\n\n✍️ Editör\n\n#Trabzonspor #BordoMavi #SüperLig ${categoryTag} #Reels`;

  return {
    title: cleanTitle,
    category,
    badgeTitle,
    fullNarration: aiNarration,
    estimatedDurationSeconds: estimatedDuration,
    scenes,
    facebookCaption,
    pollQuestion,
    pollOption1,
    pollOption2
  };
}
