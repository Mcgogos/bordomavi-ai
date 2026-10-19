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
export async function generateReelScript(params: {
  title: string;
  summary?: string | null;
  body?: string | null;
  category?: string | null;
}): Promise<ReelScriptData> {
  const cleanTitle = sanitizePlainText(params.title || '');
  const cleanSummary = sanitizePlainText(params.body || params.summary || '');
  const lowerText = `${cleanTitle} ${cleanSummary}`.toLocaleLowerCase('tr-TR');

  // Kategori Tespiti
  let category: ReelScriptData['category'] = 'GENERAL';
  let badgeTitle = 'BORDO MAVİ ÖZEL';

  if (lowerText.includes('transfer') || lowerText.includes('imza') || lowerText.includes('bonservis') || lowerText.includes('anlaşma')) {
    category = 'TRANSFER';
    badgeTitle = '🔥 TRANSFER MASASI';
  } else if (lowerText.includes('derbi') || lowerText.includes('beşiktaş') || lowerText.includes('fenerbahçe') || lowerText.includes('galatasaray') || lowerText.includes('maç günü')) {
    category = 'MATCH_PREVIEW';
    badgeTitle = '🏟️ DERBİ GÜNDEMİ';
  } else if (lowerText.includes('sakat') || lowerText.includes('tedavi') || lowerText.includes('ameliyat') || lowerText.includes('revir')) {
    category = 'INJURY';
    badgeTitle = '⚠️ SAĞLIK RAPORU';
  } else if (lowerText.includes('ertuğrul doğan') || lowerText.includes('yönetim') || lowerText.includes('başkan') || lowerText.includes('sponsor')) {
    category = 'MANAGEMENT';
    badgeTitle = '🏛️ KULÜP KULİSİ';
  } else if (lowerText.includes('son dakika') || lowerText.includes('flaş') || lowerText.includes('resmi')) {
    category = 'BREAKING';
    badgeTitle = '🚨 SON DAKİKA';
  }

  // 1. AI ile Habere Özel Orijinal Seslendirme Metni Üret
  let aiNarration = '';
  try {
    const aiProvider = AIFactory.getRouter("CONTENT_GENERATION");
    const prompt = `
Aşağıdaki Trabzonspor haberini 9:16 dikey Facebook Reels videosu için 25-35 saniyede akıcı ve dinamik biçimde seslendirilecek profesyonel bir Türkçe spiker anlatımına dönüştür.

Haber Başlığı: ${cleanTitle}
Haber Detayı: ${cleanSummary || cleanTitle}
Kategori: ${badgeTitle}

Kurallar:
1. Kesinlikle dış haber ajansı veya kaynak adı (Günebakış, Haber61, 61saat vb.) KULLANMA. Haberin kaynağı 'Bordo Mavi Haber Merkezi'dir.
2. "Bordo-Mavili kulüpte sıcak saatler yaşanıyor" gibi beylik ve tekrarlayan şablon cümleler KESİNLİKLE KULLANMA. Haberin öznesine (oyuncuya, maça veya karara) doğrudan ve çarpıcı bir açılışla başla.
3. Toplam 60-75 kelime uzunluğunda, spikerin tek nefeste akıcı biçimde okuyacağı tek parça bir paragraf olsun.
4. Anlatım yapısı:
   - İlk 1-2 cümle: Dikkat çekici açılış kancası ve olayın ne olduğu.
   - Orta bölüm: Haberin perde arkası, teknik detayları ve takım üzerindeki etkisi.
   - Son cümle: Takipçileri yorum yazmaya ve fikrini belirtmeye teşvik eden net bir etkileşim sorusu.
5. KESİNLİKLE hiçbir yerde parantez içi sahne yönlendirmeleri (Sahne 1, Müzik, Giriş vb.) veya markdown yıldız işareti (**) KULLANMA.
6. Yanıt olarak YALNIZCA spikerin mikrofonda doğrudan okuyacağı düz Türkçe metni ver.`;

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
  
  // Ortalama konuşma hızı: ~2.5 kelime/saniye
  const wordCount = aiNarration.split(/\s+/).length;
  const estimatedDuration = Math.max(22, Math.min(42, Math.round(wordCount / 2.3)));

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

  const facebookCaption = `🎬 BORDO MAVİ REELS | ${cleanTitle}\n\n${cleanSummary}\n\n💬 ${scenes[3].subtitle}\n\n#Trabzonspor #BordoMavi #Reels #Shorts #Fırtına #SüperLig`;

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
