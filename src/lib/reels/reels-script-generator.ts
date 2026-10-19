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

  // 1. AI ile Habere Özel Orijinal ve Akıcı Seslendirme Metni Üret
  let aiNarration = '';
  try {
    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");
    const prompt = `
Aşağıdaki Trabzonspor haberini 9:16 dikey Facebook Reels videosu için profesyonel bir TRT Spor / beIN Sports spiker anlatımına dönüştür.

Haber Başlığı: ${cleanTitle}
Haber Detayı: ${cleanSummary}
Kategori: ${badgeTitle}

ZORUNLU KURALLAR:
1. Kesinlikle dış haber ajansı veya kaynak adı (Günebakış, Haber61, 61saat vb.) KULLANMA.
2. DİL VE ANLATIM: Cümleler akıcı, tam dilbilgisine uygun, net ve profesyonel Türkçe ile yazılmalıdır. ASLA anlamsız, mantıksız, devrik veya yarım kalan cümleler kurma.
3. "Bordo-Mavili kulüpte sıcak saatler yaşanıyor" gibi bayat şablon kalıplar KULLANMA. Haberin öznesine doğrudan gir.
4. Toplam 50-65 kelime uzunluğunda, tempolu ve net bir spiker metni oluştur.
5. Anlatım yapısı:
   - Giriş: Haberin ana gelişmesini doğrudan aktaran net bir cümle.
   - Gelişme: Kulüp, teknik heyet veya oyuncu açısından önemi ve arka planı.
   - Kapanış: Takipçilerin fikrini soran net ve kısa bir soruyla bitsin (Örn: "Sizce bu gelişme takıma nasıl yansır? Yorumlarda buluşalım.").
6. Hiçbir yerde parantez, sahne yönlendirmesi, emoji veya markdown yıldız (**) KULLANMA.
7. YALNIZCA spikerin mikrofonda doğrudan okuyacağı düz Türkçe metni ver.`;

    const generated = await aiProvider.generateContent(prompt);
    aiNarration = sanitizePlainText(generated || '');
    // Parantez veya sahne kalıntılarını temizle
    aiNarration = aiNarration
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/^(Sahne|Kanca|Seslendirme|Metin|Spiker)\s*\d*:\s*/gim, '')
      .trim();
  } catch (err: any) {
    console.warn("[ReelScriptGenerator] AI script generation warning, using dynamic fallback:", err.message);
  }

  // Eğer AI metni oluşturulamadıysa dinamik habere özel kural sentezi uygula
  if (!aiNarration || aiNarration.length < 50) {
    let hook = `Trabzonspor'da ${cleanTitle} haberi gündeme damgasını vurdu.`;
    let detail = cleanSummary.length > 30 ? cleanSummary : 'Bordo-Mavili teknik heyet ve yönetimin konuyla ilgili planlamalarını titizlikle sürdürdüğü öğrenildi.';
    let cta = category === 'TRANSFER' 
      ? 'Sizce bu transfer hamlesi takıma sınıf atlatır mı? Fikirlerinizi yorumlarda buluşturun!'
      : category === 'MATCH_PREVIEW'
      ? 'Bu kritik mücadele öncesi skor tahmininiz nedir? Yorumlarda buluşalım!'
      : 'Peki siz bu gelişmeyi nasıl değerlendiriyorsunuz? Yorumunuzu bırakmayı unutmayın!';

    aiNarration = `${hook} ${detail} ${cta}`;
  }

  // 2. Metni 4 Eşzamanlı Sahneye Böl (Altyazı ve Görsel Zamanlaması İçin)
  const sentences = aiNarration.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  
  // Ortalama konuşma hızı: ~2.8 kelime/saniye (1.32x tempolu okuma)
  const wordCount = aiNarration.split(/\s+/).length;
  const estimatedDuration = Math.max(20, Math.min(38, Math.round(wordCount / 2.7)));

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

  // Haber açıklaması ile seslendirme metnini 100% aynı yap ve "✍️ Editör" olarak imzala
  const facebookCaption = `🎬 ${cleanTitle}\n\n${aiNarration}\n\n✍️ Editör\n\n#Trabzonspor #BordoMavi #Reels #Fırtına`;

  return {
    title: cleanTitle,
    category,
    badgeTitle,
    fullNarration: aiNarration,
    estimatedDurationSeconds: estimatedDuration,
    scenes,
    facebookCaption
  };
}
