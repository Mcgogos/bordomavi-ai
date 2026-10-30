import { prisma } from "@/lib/db";
import { AIFactory } from "@/services/ai/ai.factory";
import { sanitizePlainText } from "@/lib/content/content-generator";

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
 * HTML entity kodlarını (&#214; -> Ö, &#252; -> ü vb.) temiz Türkçe karakterlere dönüştürür.
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * RSS özetleri kısa olduğunda haberin orijinal URL'sinden tam metin paragraflarını çeker.
 * Böylece dinleyici ve izleyici haberin tüm detaylarını eksiksiz alır.
 */
async function fetchFullArticleText(title: string, existingText: string, sourceNewsId?: string): Promise<string> {
  try {
    const newsRecord = sourceNewsId
      ? await prisma.news.findUnique({ where: { id: sourceNewsId }, include: { content: true } })
      : await prisma.news.findFirst({ where: { title: { contains: title.slice(0, 35) } }, include: { content: true } });

    if (!newsRecord) return existingText;

    if (newsRecord.url && (newsRecord.url.startsWith('http://') || newsRecord.url.startsWith('https://'))) {
      const res = await fetch(newsRecord.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        let html = await res.text();
        // Menü, üst bilgi ve alt bilgi bloklarını temizle
        html = html
          .replace(/<(header|nav|footer|aside|script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

        const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
          .map(m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
          .map(t => t
            // Sayfa sonu etiket ve menü kalıntılarını kırp
            .replace(/\b(DİĞER SPORLAR|DİĞER\s+[A-ZÇĞİÖŞÜ]|SONRAKİ HABER|Günün Spor Manşetleri|Tüm Manşetler|HANGİ MAÇ HANGİ KANALDA)[\s\S]*$/i, '')
            // Araya sıkıştırılan alakasız manşet linklerini temizle
            .replace(/Okan Buruk’tan Uğurcan'a özel görüşme!\s*"Yenilginin sorumlusu Italiano!"\s*Çakar'dan dikkat çeken hakem yorumu!/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          )
          .filter(t =>
            t.length > 55 &&
            /[.?!…]$/.test(t) &&
            !/voleybol motor sporları|hangi maç hangi kanalda|tıklayınız|abone ol|çerez politikası|telif hakkı|tüm hakları/i.test(t)
          );

        if (pMatches.length > 0) {
          const combined = pMatches.slice(0, 8).join(' ');
          if (combined.length > existingText.length) {
            return combined.slice(0, 3200);
          }
        }
      }
    }

    if (newsRecord.content?.body && newsRecord.content.body.length > existingText.length) {
      return newsRecord.content.body;
    }
  } catch (e: any) {
    console.warn('[ReelScriptGenerator] Full article fetch warning:', e.message);
  }
  return existingText;
}

function cleanNewsForScript(title: string, rawText: string): string {
  let cleaned = decodeHtmlEntities(rawText)
    // Model güvenlik çıktılarını ve yapay zeka kalıntılarını temizle
    .replace(/\b(User\s*Safety|Response\s*Safety)\s*:\s*[a-z0-9_-]+\b/gi, '')
    .replace(/\b(as\s+an\s+ai|bir\s+yapay\s+zeka\s+olarak|dil\s+modeli\s+olarak)\b/gi, '')
    // Sadece klişe yönlendirme ifadelerini sil, devamındaki makale metnini KORU!
    .replace(/\b(İşte detaylar|İşte o yorumlar|İşte ayrıntılar|Haberin detayları|Detaylar haberimizde)\s*[:.!…]*/gi, ' ')
    .replace(/\b(AA|DHA|İHA|IHA)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 20) cleaned = title;
  return cleaned;
}

/**
 * Sayıları ve skorları Türkçe spikerin kesintisiz okuması için yazıya çevirir.
 * Cümle bölme işleminden ÖNCE çağrılır ki "8. haftasında" nokta yüzünden bölünmesin.
 */
function convertNumbersToTurkishWords(text: string): string {
  const numMap: Record<string, string> = {
    '0': 'sıfır', '1': 'bir', '2': 'iki', '3': 'üç', '4': 'dört',
    '5': 'beş', '6': 'altı', '7': 'yedi', '8': 'sekiz', '9': 'dokuz', '10': 'on'
  };
  const ordMap: Record<string, string> = {
    '1': 'birinci', '2': 'ikinci', '3': 'üçüncü', '4': 'dördüncü', '5': 'beşinci',
    '6': 'altıncı', '7': 'yedinci', '8': 'sekizinci', '9': 'dokuzuncu', '10': 'onuncu',
    '11': 'on birinci', '12': 'on ikinci', '71': 'yetmiş birinci', '82': 'seksen ikinci'
  };

  return text
    // Skor + ekler: 2-0'lık -> iki sıfırlık, 2-0'a -> iki sıfıra
    .replace(/\b(\d)\s*-\s*(\d)['’]?(lık|lik|luk|lük|a|e)?\b/gi, (_, a, b, suffix) => {
      const base = `${numMap[a] || a} ${numMap[b] || b}`;
      return suffix ? `${base}${suffix.toLocaleLowerCase('tr-TR')}` : base;
    })
    // Sıra sayıları: 8. hafta / 8. haftasında / 71. dakikada -> sekizinci haftasında
    .replace(/\b(\d{1,2})\.\s*(hafta\w*|dakika\w*|sıra\w*|maç\w*|yarı\w*|sezon\w*)/gi, (_, n, word) => `${ordMap[n] || n} ${word}`);
}

/**
 * Haberin gerçek konusuna (Rakip Analizi, Sakatlık, Hakem, Taktik, Transfer vb.)
 * göre dinamik, soru ve Evet/Hayır seçenekleriyle %100 uyumlu anket sorusu üretir.
 */
export function determineContextualReelPoll(
  title: string,
  summary: string,
  categoryHint?: string
): {
  category: ReelScriptData['category'];
  badgeTitle: string;
  pollQuestion: string;
  categoryTag: string;
} {
  const titleLower = title.toLocaleLowerCase('tr-TR');
  const leadLower = (title + ' ' + summary.slice(0, 300)).toLocaleLowerCase('tr-TR');

  // 1. HAKEM & TFF & DİSİPLİN (Hakem ataması, VAR, ceza, sevk vb.)
  if (
    titleLower.includes('hakem') ||
    titleLower.includes('düdük çalacak') ||
    titleLower.includes('pfdk') ||
    titleLower.includes('mhk') ||
    titleLower.includes('var hakemi') ||
    titleLower.includes('ceza') ||
    leadLower.includes('pfdk\'ye sevk')
  ) {
    return {
      category: 'GENERAL',
      badgeTitle: 'HAKEM & DİSİPLİN',
      pollQuestion: 'Sizce verilen bu kararlar adil mi?',
      categoryTag: '#HakemKararları'
    };
  }

  // 2. SAKATLIK & SAĞLIK & EKSİKLER (Savic, Onuachu, Revir, Tedavi vb.)
  if (
    titleLower.includes('sakat') ||
    titleLower.includes('tedavi') ||
    titleLower.includes('ameliyat') ||
    titleLower.includes('revir') ||
    titleLower.includes('forma giyemeyecek') ||
    titleLower.includes('oynayamayacak') ||
    titleLower.includes('kadrodan çıkarıldı') ||
    titleLower.includes('salonda çalıştı') ||
    leadLower.includes('antrenmana çıkmadı') ||
    leadLower.includes('tedavisine başlandı')
  ) {
    return {
      category: 'INJURY',
      badgeTitle: 'SAĞLIK RAPORU',
      pollQuestion: 'Bu eksikler takımın oyununu olumsuz etkiler mi?',
      categoryTag: '#SakatlıkRaporu'
    };
  }

  // 3. KADRO & İLK 11 & TAKTİK (Thomas Reis, Muhtemel 11 vb.)
  if (
    titleLower.includes('ilk 11') ||
    titleLower.includes('muhtemel 11') ||
    titleLower.includes('taktik') ||
    titleLower.includes('formasyon') ||
    titleLower.includes('kadro tercihi') ||
    (titleLower.includes('reis') && (titleLower.includes('11') || titleLower.includes('plan')))
  ) {
    return {
      category: 'MATCH_PREVIEW',
      badgeTitle: 'TAKTIK & KADRO',
      pollQuestion: 'Hocamızın bu kadro tercihini doğru buluyor musunuz?',
      categoryTag: '#Trabzonsporİlk11'
    };
  }

  // 4. RAKİP ANALİZİ & AVRUPA / KUPA MAÇLARI (Hearts, Rakip Kimdir, Konferans Ligi vb.)
  if (
    titleLower.includes('rakip') ||
    titleLower.includes('rakibi') ||
    titleLower.includes('rakibimiz') ||
    titleLower.includes('hearts') ||
    titleLower.includes('kimdir') ||
    leadLower.includes('rakip analizi') ||
    leadLower.includes('rakibe dikkat') ||
    (leadLower.includes('avrupa') && leadLower.includes('hearts'))
  ) {
    return {
      category: 'MATCH_PREVIEW',
      badgeTitle: 'RAKİP ANALİZİ',
      pollQuestion: 'Sizce Trabzonspor bu maçı rahat kazanır mı?',
      categoryTag: '#AvrupaLigi'
    };
  }

  // 5. GERÇEK TRANSFER & İMZA
  if (
    titleLower.includes('transfer') ||
    titleLower.includes('imza') ||
    titleLower.includes('bonservis') ||
    titleLower.includes('sözleşme') ||
    titleLower.includes('kiralık') ||
    titleLower.includes('resmen açıkladı') ||
    titleLower.includes('yeni transfer') ||
    titleLower.includes('sesleri') ||
    (titleLower.includes('anlaştı') && !titleLower.includes('tff'))
  ) {
    return {
      category: 'TRANSFER',
      badgeTitle: 'TRANSFER HABERİ',
      pollQuestion: 'Sizce bu transfer hamlesi doğru mu?',
      categoryTag: '#TransferHaberleri'
    };
  }

  // 6. DERBİ & LİG MAÇI GÜNDEMİ
  if (
    titleLower.includes('derbi') ||
    titleLower.includes('beşiktaş') ||
    titleLower.includes('fenerbahçe') ||
    titleLower.includes('galatasaray') ||
    titleLower.includes('maç günü') ||
    titleLower.includes('karşılaşma')
  ) {
    return {
      category: 'MATCH_PREVIEW',
      badgeTitle: 'MAÇ GÜNDEMİ',
      pollQuestion: 'Trabzonspor bu kritik maçtan galibiyetle ayrılır mı?',
      categoryTag: '#MaçGünü'
    };
  }

  // 7. MAÇ SONU & SKOR DEĞERLENDİRMESİ
  if (
    titleLower.includes('maç sonu') ||
    titleLower.includes('galip geldi') ||
    titleLower.includes('mağlup oldu') ||
    titleLower.includes('puansız döndü') ||
    titleLower.includes('gol şov') ||
    titleLower.includes('tarihi zafer') ||
    titleLower.includes('galibiyetin ardından')
  ) {
    return {
      category: 'MATCH_PREVIEW',
      badgeTitle: 'MAÇ SONU',
      pollQuestion: 'Takımın bu maçtaki performansını beğendiniz mi?',
      categoryTag: '#MaçSonu'
    };
  }

  // 8. YÖNETİM & BAŞKAN & KULÜP GELİŞMELERİ
  if (
    titleLower.includes('ertuğrul doğan') ||
    titleLower.includes('başkan') ||
    titleLower.includes('yönetim') ||
    titleLower.includes('kongre') ||
    titleLower.includes('sponsor') ||
    titleLower.includes('tesis') ||
    titleLower.includes('tüzük')
  ) {
    return {
      category: 'MANAGEMENT',
      badgeTitle: 'KULÜP HABERİ',
      pollQuestion: 'Yönetimin bu kararını destekliyor musunuz?',
      categoryTag: '#Yönetim'
    };
  }

  // 9. OYUNCU PERFORMANSI & REKOR & GOL ŞOV
  if (
    titleLower.includes('gol krallığı') ||
    titleLower.includes('rekor') ||
    titleLower.includes('istatistik') ||
    titleLower.includes('solladı') ||
    titleLower.includes('parladı') ||
    titleLower.includes('övgü') ||
    titleLower.includes('bitiriş') ||
    titleLower.includes('muhteşem gol') ||
    titleLower.includes('ateşledi') ||
    titleLower.includes('kurtarış')
  ) {
    return {
      category: 'GENERAL',
      badgeTitle: 'YILDIZ PERFORMANSI',
      pollQuestion: 'Bu muhteşem performansı ve golü beğendiniz mi?',
      categoryTag: '#YıldızOyuncular'
    };
  }

  // 10. TARAFTAR & TRİBÜN & BORDO-MAVİ SEVDASI
  if (
    titleLower.includes('sevda') ||
    titleLower.includes('taraftar') ||
    titleLower.includes('tribün') ||
    titleLower.includes('horon') ||
    titleLower.includes('kolbastı') ||
    titleLower.includes('miraç')
  ) {
    return {
      category: 'GENERAL',
      badgeTitle: 'BORDO MAVİ SEVDA',
      pollQuestion: 'Bordo-Mavi sevdamız her yerde! Gurur duydunuz mu?',
      categoryTag: '#BordoMaviSevda'
    };
  }

  // 11. SON DAKİKA / FLAŞ GELİŞME
  if (
    titleLower.includes('son dakika') ||
    titleLower.includes('flaş') ||
    titleLower.includes('resmi açıklama')
  ) {
    return {
      category: 'BREAKING',
      badgeTitle: 'SON DAKİKA',
      pollQuestion: 'Sizce bu gelişme takımımızı olumlu etkiler mi?',
      categoryTag: '#SonDakika'
    };
  }

  // 11. GENEL TRABZONSPOR HABERİ
  return {
    category: 'GENERAL',
    badgeTitle: 'BORDO MAVİ HABER',
    pollQuestion: 'Sizce bu gelişme takımımızı olumlu etkiler mi?',
    categoryTag: '#Trabzonspor'
  };
}

export async function generateReelScript(params: {
  title: string;
  summary?: string | null;
  body?: string | null;
  category?: string | null;
  sourceNewsId?: string;
}): Promise<ReelScriptData> {
  const cleanTitle = convertNumbersToTurkishWords(
    sanitizePlainText(decodeHtmlEntities(params.title || ''))
      .replace(/([!?])\s*;+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const rawInitial = sanitizePlainText(decodeHtmlEntities(params.body || params.summary || ''));
  const fullArticleRaw = await fetchFullArticleText(cleanTitle, rawInitial, params.sourceNewsId);
  const cleanInitialLead = convertNumbersToTurkishWords(cleanNewsForScript(cleanTitle, rawInitial));
  const cleanSummary = convertNumbersToTurkishWords(cleanNewsForScript(cleanTitle, fullArticleRaw));
  const lowerText = `${cleanTitle} ${cleanSummary}`.toLocaleLowerCase('tr-TR');

  const pollMeta = determineContextualReelPoll(cleanTitle, cleanSummary, params.category || undefined);
  const category = pollMeta.category;
  const badgeTitle = pollMeta.badgeTitle;
  const pollQuestion = pollMeta.pollQuestion;
  const categoryTag = pollMeta.categoryTag;

  // Doğrudan haberin orijinal metninden ve tam makale paragraflarından %100 gerçek, eksiksiz ve akıcı Türkçe bülten oluştur
  const cleanLeadSentences = cleanInitialLead
    .replace(/\b(Fotomaç|Fanatik|Sabah|Hürriyet|Milliyet|61saat|Haber61|Günebakış|Taka|Kuzey Ekspres)\s*(Gazetesi('nin|'nde|)?|Haber('in|)?|Spor('un|)?)?\b/gi, 'spor basınının')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s =>
      s.length > 25 &&
      !s.endsWith('...') &&
      !s.includes(',...') &&
      !/\b(usta yazarları|köşelerinde değerlendirdi|işte detaylar|işte o yorumlar)\b/i.test(s)
    );

  const articleSentences = cleanSummary
    .replace(/\b(Fotomaç|Fanatik|Sabah|Hürriyet|Milliyet|61saat|Haber61|Günebakış|Taka|Kuzey Ekspres)\s*(Gazetesi('nin|'nde|)?|Haber('in|)?|Spor('un|)?)?\b/gi, 'spor basınının')
    .replace(/\b[A-ZÇĞİÖŞÜ]{3,}(?:\s+[A-ZÇĞİÖŞÜ]{2,})+\s*-\s*(?:\b[A-ZÇĞİÖŞÜ0-9]{2,}\b[.,!…\s]*)+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s =>
      s.length > 35 &&
      s.length < 190 &&
      !s.includes('&#') &&
      !s.endsWith('...') &&
      !s.includes(',...') &&
      !/\b(enseyi karartmayın|vesselam|yol kazasıdır|yiğit düştüğü|atamayana atarlar|izlediğim en güzel|haftanın en çok beklenen|tehlikeli pozisyonlar yakalıyor|alkışlamak lazım|tebrik etmek lazım|önemli bir fırsattan yararlanamadı)\b/i.test(s)
    );

  // Haberin en somut bilgi içeren (gol, oyuncu, teknik direktör, skor, karar) cümlelerini önceliklendir
  const scoredArticleSentences = articleSentences.map((s, idx) => {
    let score = 100 - idx * 3;
    if (/\b(Trabzonspor|Bordo-Mavi|gol|skor|dakika|puan|transfer|imza|başkan|teknik direktör|şampiyon)\b/i.test(s)) score += 25;
    if (/\b(2-0|1-0|3-0|2-1|3-1|iki sıfır|galip|kazandı|mağlup|transfer|sözleşme)\b/i.test(s)) score += 20;
    return { text: s, score, idx };
  }).sort((a, b) => b.score - a.score);

  const selectedTop = scoredArticleSentences.slice(0, 6).sort((a, b) => a.idx - b.idx).map(x => x.text);

  let combined = cleanLeadSentences.length > 0 ? cleanLeadSentences.join(' ') : `${cleanTitle}.`;

  for (const s of selectedTop) {
    const currentWords = combined.split(/\s+/).filter(Boolean).length;
    if (currentWords >= 51) break;
    const firstFew = s.split(/\s+/).slice(0, 4).join(' ').toLocaleLowerCase('tr-TR');
    if (!combined.toLocaleLowerCase('tr-TR').includes(firstFew)) {
      combined = `${combined} ${s}`.trim();
    }
  }

  // Eğer hala 50 kelimenin altındaysa kalan makale cümlelerinden ekle
  for (const s of articleSentences) {
    const currentWords = combined.split(/\s+/).filter(Boolean).length;
    if (currentWords >= 51) break;
    const firstFew = s.split(/\s+/).slice(0, 4).join(' ').toLocaleLowerCase('tr-TR');
    if (!combined.toLocaleLowerCase('tr-TR').includes(firstFew)) {
      combined = `${combined} ${s}`.trim();
    }
  }

  const closingCta = 'Peki siz bu gelişmeyi nasıl değerlendiriyorsunuz? Görüşlerinizi yorumlarda paylaşın.';
  let aiNarration = `${combined} ${closingCta}`.replace(/\s+/g, ' ').trim();

  // Maksimum 60 kelime tavanı (Kesin 25.5 - 28.5 saniye stüdyo spiker + video süresi için)
  const words = aiNarration.split(/\s+/).filter(Boolean);
  if (words.length > 60) {
    const allSentences = aiNarration.split(/(?<=[.?!])\s+/).filter(Boolean);
    let bounded = '';
    for (const s of allSentences) {
      if ((bounded + ' ' + s).trim().split(/\s+/).length <= 60) {
        bounded = (bounded + ' ' + s).trim();
      } else break;
    }
    aiNarration = bounded || words.slice(0, 58).join(' ') + '.';
  }

  aiNarration = convertNumbersToTurkishWords(aiNarration);

  // Haberin konusuna göre dinamik üretilen anket ve etkileşim butonları:
  // Sol: "✓ Evet, Beğen" | Sağ: "Hayır, Yorum Yap"
  const pollOption1 = 'Evet, Beğen';
  const pollOption2 = 'Hayır, Yorum Yap';

  const sentences = aiNarration.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  const finalWordCount = aiNarration.split(/\s+/).length;
  const estimatedDuration = Math.max(25, Math.min(30, Math.round(finalWordCount / 2.65)));
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
      badge: 'DETAY',
      subtitle: sentences[1] || cleanTitle,
      spokenText: sentences[1] || cleanTitle
    },
    {
      sceneIndex: 3,
      timeRange: `${(sceneDuration * 2).toFixed(1)} - ${(sceneDuration * 3).toFixed(1)} sn`,
      startSecond: +(sceneDuration * 2).toFixed(1),
      durationSeconds: sceneDuration,
      badge: 'ANALİZ',
      subtitle: sentences[2] || sentences[sentences.length - 2] || cleanSummary.slice(0, 80),
      spokenText: sentences[2] || sentences[sentences.length - 2] || cleanSummary.slice(0, 80)
    },
    {
      sceneIndex: 4,
      timeRange: `${(sceneDuration * 3).toFixed(1)} - ${estimatedDuration} sn`,
      startSecond: +(sceneDuration * 3).toFixed(1),
      durationSeconds: +(estimatedDuration - sceneDuration * 3).toFixed(1),
      badge: 'YORUM',
      subtitle: sentences[sentences.length - 1] || 'Görüşlerinizi yorumlarda paylaşın.',
      spokenText: sentences[sentences.length - 1] || 'Görüşlerinizi yorumlarda paylaşın.'
    }
  ];

  const facebookCaption = `🎬 ${cleanTitle}\n\n${aiNarration}\n\n💬 Siz bu gelişmeyi nasıl değerlendiriyorsunuz? Görüşlerinizi yorumlarda paylaşın!\n\n✍️ Editör\n\n#Trabzonspor #BordoMavi #SüperLig ${categoryTag} #Reels`;

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
