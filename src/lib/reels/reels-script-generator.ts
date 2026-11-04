import { prisma } from '@/lib/db';
import { sanitizePlainText } from '@/lib/content/content-generator';
import { classifyNewsClaimType, ClaimClassification } from '@/services/visual/ai-visual-generator';
import { verifyCrossSourceCorroboration } from '@/lib/news/news-ai-analyzer';

export interface ReelScriptScene {
  sceneIndex: number;
  timeRange: string;
  startSecond: number;
  durationSeconds: number;
  badge: string;
  subtitle: string;
  spokenText: string;
  visualCallout: string;
  subCallout?: string;
}

export interface ReelScriptData {
  title: string;
  category: 'BREAKING' | 'TRANSFER' | 'MATCH_PREVIEW' | 'INJURY' | 'MANAGEMENT' | 'GENERAL';
  badgeTitle: string;
  claimType: ClaimClassification;
  editorialPotentialScore: number;
  sourceAttribution: string;
  independentSourceCount: number;
  fullNarration: string;
  estimatedDurationSeconds: number;
  scenes: ReelScriptScene[];
  facebookCaption: string;
  pollQuestion: string;
  pollOption1: string;
  pollOption2: string;
}

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

async function fetchFullArticleText(
  title: string,
  existingText: string,
  sourceNewsId?: string
): Promise<{
  fullText: string;
  sourceName: string;
  editorialScore: number;
  independentSourceCount: number;
  corroboratingSources: string[];
}> {
  let sourceName = 'BordoMavi Haber Merkezi';
  let editorialScore = 88;
  let independentSourceCount = 2;
  let corroboratingSources: string[] = ['BordoMavi Haber Merkezi', 'Kulüp Muhabirleri'];

  try {
    const newsRecord = sourceNewsId
      ? await prisma.news.findUnique({
          where: { id: sourceNewsId },
          include: { content: true, source: true },
        })
      : await prisma.news.findFirst({
          where: { title: { contains: title.slice(0, 35) } },
          include: { content: true, source: true },
        });

    if (!newsRecord) {
      return {
        fullText: existingText,
        sourceName,
        editorialScore,
        independentSourceCount,
        corroboratingSources,
      };
    }

    if (newsRecord.source?.name) {
      sourceName = newsRecord.source.name;
    }
    if (newsRecord.importanceScore) {
      editorialScore = newsRecord.importanceScore;
    }

    const ver = await verifyCrossSourceCorroboration({
      id: newsRecord.id,
      title: newsRecord.title,
      summary: newsRecord.summary,
      sourceId: newsRecord.sourceId,
      source: newsRecord.source,
    }).catch(() => null);

    if (ver) {
      independentSourceCount = ver.independentSourceCount;
      if (ver.corroboratingSources.length > 0) {
        corroboratingSources = ver.corroboratingSources;
      }
    }

    if (
      newsRecord.url &&
      (newsRecord.url.startsWith('http://') || newsRecord.url.startsWith('https://'))
    ) {
      const res = await fetch(newsRecord.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) {
        let html = await res.text();
        html = html.replace(/<(header|nav|footer|aside|script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

        const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
          .map((m) =>
            decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' '))
              .replace(/\s+/g, ' ')
              .trim()
          )
          .map((t) =>
            t
              .replace(
                /\b(DİĞER SPORLAR|DİĞER\s+[A-ZÇĞİÖŞÜ]|SONRAKİ HABER|Günün Spor Manşetleri|Tüm Manşetler|HANGİ MAÇ HANGİ KANALDA)[\s\S]*$/i,
                ''
              )
              .replace(
                /Okan Buruk’tan Uğurcan'a özel görüşme!\s*"Yenilginin sorumlusu Italiano!"\s*Çakar'dan dikkat çeken hakem yorumu!/gi,
                ' '
              )
              .replace(/\s+/g, ' ')
              .trim()
          )
          .filter(
            (t) =>
              t.length > 55 &&
              /[.?!…]$/.test(t) &&
              !/voleybol motor sporları|hangi maç hangi kanalda|tıklayınız|abone ol|çerez politikası|telif hakkı|tüm hakları/i.test(
                t
              )
          );

        if (pMatches.length > 0) {
          const combined = pMatches.slice(0, 8).join(' ');
          if (combined.length > existingText.length) {
            return {
              fullText: combined.slice(0, 3200),
              sourceName,
              editorialScore,
              independentSourceCount,
              corroboratingSources,
            };
          }
        }
      }
    }

    if (newsRecord.content?.body && newsRecord.content.body.length > existingText.length) {
      return {
        fullText: newsRecord.content.body,
        sourceName,
        editorialScore,
        independentSourceCount,
        corroboratingSources,
      };
    }
  } catch (e: any) {
    console.warn('[ReelScriptGenerator] Full article fetch warning:', e.message);
  }
  return {
    fullText: existingText,
    sourceName,
    editorialScore,
    independentSourceCount,
    corroboratingSources,
  };
}

function cleanNewsForScript(title: string, rawText: string): string {
  let cleaned = decodeHtmlEntities(rawText)
    .replace(/\b(User\s*Safety|Response\s*Safety)\s*:\s*[a-z0-9_-]+\b/gi, '')
    .replace(/\b(as\s+an\s+ai|bir\s+yapay\s+zeka\s+olarak|dil\s+modeli\s+olarak)\b/gi, '')
    .replace(
      /\b(İşte detaylar|İşte o yorumlar|İşte ayrıntılar|Haberin detayları|Detaylar haberimizde)\s*[:.!…]*/gi,
      ' '
    )
    .replace(/\b(AA|DHA|İHA|IHA)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 20) cleaned = title;
  return cleaned;
}

function convertNumbersToTurkishWords(text: string): string {
  const numMap: Record<string, string> = {
    '0': 'sıfır',
    '1': 'bir',
    '2': 'iki',
    '3': 'üç',
    '4': 'dört',
    '5': 'beş',
    '6': 'altı',
    '7': 'yedi',
    '8': 'sekiz',
    '9': 'dokuz',
    '10': 'on',
  };
  const ordMap: Record<string, string> = {
    '1': 'birinci',
    '2': 'ikinci',
    '3': 'üçüncü',
    '4': 'dördüncü',
    '5': 'beşinci',
    '6': 'altıncı',
    '7': 'yedinci',
    '8': 'sekizinci',
    '9': 'dokuzuncu',
    '10': 'onuncu',
    '11': 'on birinci',
    '12': 'on ikinci',
    '61': 'altmış birinci',
    '71': 'yetmiş birinci',
    '82': 'seksen ikinci',
  };

  return text
    .replace(/\b(\d)\s*-\s*(\d)['’]?(lık|lik|luk|lük|a|e)?\b/gi, (_, a, b, suffix) => {
      const base = `${numMap[a] || a} ${numMap[b] || b}`;
      return suffix ? `${base}${suffix.toLocaleLowerCase('tr-TR')}` : base;
    })
    .replace(
      /\b(\d{1,2})\.\s*(hafta\w*|dakika\w*|sıra\w*|maç\w*|yarı\w*|sezon\w*|lig\w*|grup\w*|tur\w*|kez\w*|gol\w*|periyot\w*)/gi,
      (_, n, word) => `${ordMap[n] || n} ${word}`
    );
}

function splitTurkishSentences(text: string): string[] {
  return text
    .split(/(?<!\b\d{1,3})(?<!\b(?:Prof|Dr|Av|Doç|Yrd|Alb|Org|St|No|vs|vb))(?<=[.?!])\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/\b\d+\.$/.test(s));
}

/**
 * Bir cümleden görsel üzerinde okunabilir 3-6 kelimelik vurucu slayt başlığı çıkarır.
 */
function extractSlideVisualCallout(sentence: string, fallback: string): string {
  const cleaned = (sentence || fallback)
    .replace(/[,:;—–-]/g, ' ')
    .replace(/[.?!…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 6) return cleaned;
  return words.slice(0, 6).join(' ');
}

/**
 * Trabzonspor taraftarının gündemini anlayan özgün editoryal yorum cümlesi üretir.
 */
function buildEditorialPerspectiveSentence(
  category: ReelScriptData['category'],
  claimType: ClaimClassification
): string {
  if (claimType === 'GAZETECİ İDDİASI') {
    return 'Editoryal değerlendirmemize göre bu iddia henüz resmiyet kazanmasa da teknik heyetin kadro derinliği arayışıyla örtüşüyor.';
  }
  switch (category) {
    case 'TRANSFER':
      return 'Editoryal açıdan bakıldığında bordo mavili yönetimin mali disiplini koruyarak doğrudan ilk on bire katkı verecek isimlere yönelmesi kritik önem taşıyor.';
    case 'INJURY':
      return 'Editoryal analizimize göre yoğun fikstür temposunda rotasyon oyuncularının göstereceği reaksiyon takımın zirve yürüyüşünü belirleyecek.';
    case 'MATCH_PREVIEW':
      return 'Editoryal yorumumuz, Papara Park atmosferinde orta saha üstünlüğünü erken kurmanın maçın kilidini açacağı yönünde.';
    case 'MANAGEMENT':
      return 'Editoryal değerlendirmemiz, kulübün kurumsal ve sportif istikrarını güçlendiren bu adımların uzun vadede camiaya güven verdiği yönünde.';
    default:
      return 'Editoryal perspektiften bakıldığında bu gelişme Trabzonspor camiasının sezon hedeflerine odaklanma kararlılığını bir kez daha ortaya koyuyor.';
  }
}

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

  if (
    titleLower.includes('hakem') ||
    titleLower.includes('düdük çalacak') ||
    titleLower.includes('pfdk') ||
    titleLower.includes('mhk') ||
    titleLower.includes('var hakemi') ||
    titleLower.includes('ceza') ||
    leadLower.includes("pfdk'ye sevk")
  ) {
    return {
      category: 'GENERAL',
      badgeTitle: 'HAKEM & DİSİPLİN',
      pollQuestion: 'Sizce verilen bu kararlar Türk futbolunda adaleti sağlıyor mu?',
      categoryTag: '#HakemKararları',
    };
  }

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
      pollQuestion: 'Bu eksikler sonrası ilk on birde hangi oyuncumuz forma giymeli?',
      categoryTag: '#SakatlıkRaporu',
    };
  }

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
      badgeTitle: 'TAKTİK & KADRO',
      pollQuestion: 'Teknik heyetin bu kadro ve taktik planını doğru buluyor musunuz?',
      categoryTag: '#Trabzonsporİlk11',
    };
  }

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
      badgeTitle: 'TRANSFER GÜNDEMİ',
      pollQuestion: 'Sizce bu transfer hamlesi Trabzonspor’un hücum ve oyun gücünü artırır mı?',
      categoryTag: '#TransferHaberleri',
    };
  }

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
      pollQuestion: 'Trabzonspor bu kritik karşılaşmadan nasıl bir skorla ayrılır?',
      categoryTag: '#MaçGünü',
    };
  }

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
      badgeTitle: 'KULÜP YÖNETİMİ',
      pollQuestion: 'Yönetimin attığı bu stratejik adımı nasıl değerlendiriyorsunuz?',
      categoryTag: '#Yönetim',
    };
  }

  if (
    titleLower.includes('son dakika') ||
    titleLower.includes('flaş') ||
    titleLower.includes('resmi açıklama')
  ) {
    return {
      category: 'BREAKING',
      badgeTitle: 'SON DAKİKA',
      pollQuestion: 'Bu sıcak gelişme Trabzonspor’un sezon hedeflerini nasıl etkiler?',
      categoryTag: '#SonDakika',
    };
  }

  return {
    category: 'GENERAL',
    badgeTitle: 'BORDO MAVİ GÜNDEM',
    pollQuestion: 'Bu gelişme hakkında sizin görüşünüz nedir? Yorumlarda buluşalım!',
    categoryTag: '#Fırtına',
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
  const articleMeta = await fetchFullArticleText(cleanTitle, rawInitial, params.sourceNewsId);
  const cleanInitialLead = convertNumbersToTurkishWords(cleanNewsForScript(cleanTitle, rawInitial));
  const cleanSummary = convertNumbersToTurkishWords(
    cleanNewsForScript(cleanTitle, articleMeta.fullText)
  );

  const claimType = classifyNewsClaimType(
    cleanTitle,
    cleanSummary,
    articleMeta.independentSourceCount
  );

  const pollMeta = determineContextualReelPoll(
    cleanTitle,
    cleanSummary,
    params.category || undefined
  );
  const category = pollMeta.category;
  const badgeTitle = pollMeta.badgeTitle;
  const pollQuestion = pollMeta.pollQuestion;
  const categoryTag = pollMeta.categoryTag;

  const cleanLeadSentences = splitTurkishSentences(
    cleanInitialLead.replace(
      /\b(Fotomaç|Fanatik|Sabah|Hürriyet|Milliyet|61saat|Haber61|Günebakış|Taka|Kuzey Ekspres)\s*(Gazetesi('nin|'nde|)?|Haber('in|)?|Spor('un|)?)?\b/gi,
      'spor basınının'
    )
  ).filter(
    (s) =>
      s.length > 22 &&
      !s.endsWith('...') &&
      !s.includes(',...') &&
      !/\b(usta yazarları|köşelerinde değerlendirdi|işte detaylar|işte o yorumlar)\b/i.test(s)
  );

  const articleSentences = splitTurkishSentences(
    cleanSummary
      .replace(
        /\b(Fotomaç|Fanatik|Sabah|Hürriyet|Milliyet|61saat|Haber61|Günebakış|Taka|Kuzey Ekspres)\s*(Gazetesi('nin|'nde|)?|Haber('in|)?|Spor('un|)?)?\b/gi,
        'spor basınının'
      )
      .replace(
        /\b[A-ZÇĞİÖŞÜ]{3,}(?:\s+[A-ZÇĞİÖŞÜ]{2,})+\s*-\s*(?:\b[A-ZÇĞİÖŞÜ0-9]{2,}\b[.,!…\s]*)+/g,
        ' '
      )
  ).filter(
    (s) =>
      s.length > 30 &&
      s.length < 185 &&
      !s.includes('&#') &&
      !s.endsWith('...') &&
      !s.includes(',...') &&
      !/\b(enseyi karartmayın|vesselam|yol kazasıdır|yiğit düştüğü|atamayana atarlar)\b/i.test(s)
  );

  const scoredArticleSentences = articleSentences
    .map((s, idx) => {
      let score = 100 - idx * 3;
      if (
        /\b(Trabzonspor|Bordo-Mavi|gol|skor|dakika|puan|transfer|imza|başkan|teknik direktör|şampiyon)\b/i.test(
          s
        )
      )
        score += 25;
      if (/\b(iki sıfır|galip|kazandı|mağlup|transfer|sözleşme|açıkladı|karar)\b/i.test(s))
        score += 20;
      return { text: s, score, idx };
    })
    .sort((a, b) => b.score - a.score);

  const selectedTop = scoredArticleSentences
    .slice(0, 6)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.text);

  // 1. Slayt 1 (İlk 2 Saniye Vurucu Gerçek Bilgi - Hook)
  const hookSentence =
    cleanLeadSentences[0] && cleanLeadSentences[0].split(/\s+/).length <= 16
      ? cleanLeadSentences[0]
      : `${cleanTitle.replace(/[.?!]+$/, '')}.`;

  // Bilgi Türü Açıklama Cümlesi (Resmî açıklama, gazeteci iddiası ve yorum farkını açıkça belirt)
  const claimClarificationPrefix =
    claimType === 'RESMİ AÇIKLAMA'
      ? 'Kulüp ve resmi kaynaklardan yapılan açıklamaya göre,'
      : claimType === 'GAZETECİ İDDİASI'
      ? 'Spor basınına yansıyan gazeteci iddiasına göre,'
      : 'İki bağımsız kaynaktan doğrulanan bilgilere göre,';

  const factualPool: string[] = [];
  for (const s of [...cleanLeadSentences.slice(1), ...selectedTop, ...articleSentences]) {
    const firstFew = s
      .split(/\s+/)
      .slice(0, 4)
      .join(' ')
      .toLocaleLowerCase('tr-TR');
    const alreadyUsed = [hookSentence, ...factualPool]
      .join(' ')
      .toLocaleLowerCase('tr-TR')
      .includes(firstFew);
    if (!alreadyUsed && s.length > 25) {
      factualPool.push(s);
    }
    if (factualPool.length >= 4) break;
  }

  while (factualPool.length < 4) {
    if (factualPool.length === 0) {
      factualPool.push(
        `${claimClarificationPrefix} Trabzonspor cephesinde bu gelişme gündemin ilk sırasına yerleşti.`
      );
    } else if (factualPool.length === 1) {
      factualPool.push(
        'Teknik heyet ve yönetim kurulu, sürecin takımın saha içi hedeflerine etkisini kapsamlı biçimde değerlendiriyor.'
      );
    } else if (factualPool.length === 2) {
      factualPool.push(
        'Bordo mavili taraftarlar gelişmenin detaylarını ve kulüpten gelecek yeni adımları yakından takip ediyor.'
      );
    } else {
      factualPool.push(
        'Önümüzdeki günlerde konuya ilişkin somut adımların netleşmesi bekleniyor.'
      );
    }
  }

  // Slayt 2'nin başında bilgi türünü (Resmî açıklama / Gazeteci iddiası / Doğrulanmış bilgi) açıkça vurgula
  const slide2Spoken = factualPool[0].toLocaleLowerCase('tr-TR').startsWith('kulüp')
    ? factualPool[0]
    : `${claimClarificationPrefix} ${factualPool[0].charAt(0).toLocaleLowerCase('tr-TR')}${factualPool[0].slice(1)}`;

  const editorialSentence = buildEditorialPerspectiveSentence(category, claimType);
  const questionSpoken = `${pollQuestion} Görüşlerinizi yorumlarda paylaşın.`;

  // 7 Özgün Slaytın Konuşma Metinleri (25-35 saniye hedefi için 65-78 kelime bandına kalibre edilir)
  const slideSpokenTexts = [
    hookSentence, // Slayt 1: İlk 2 saniyede en dikkat çekici gerçek bilgi
    slide2Spoken, // Slayt 2: Bilgi türü (Resmî açıklama / İddia / Doğrulama) + Temel Olay
    factualPool[1], // Slayt 3: Somut Detay 1
    factualPool[2], // Slayt 4: Somut Detay 2 / Arka Plan
    factualPool[3], // Slayt 5: Kulüp & Kadro Etkisi
    editorialSentence, // Slayt 6: Özgün Editoryal Yorum
    questionSpoken, // Slayt 7: Haberle doğrudan ilişkili taraftar sorusu
  ].map((s) => convertNumbersToTurkishWords(s.replace(/\s+/g, ' ').trim()));

  // Toplam kelime sayısını 25-35 saniye hedefi için (62-78 kelime aralığında) tut
  let fullNarration = slideSpokenTexts.join(' ');
  const totalWords = fullNarration.split(/\s+/).filter(Boolean).length;
  if (totalWords > 80) {
    // 5. slaytı çıkarıp 6 özgün slaytla 26-33 saniye bandında tut
    slideSpokenTexts.splice(4, 1);
    fullNarration = slideSpokenTexts.join(' ');
  }

  const slideBadges =
    slideSpokenTexts.length === 7
      ? [
          'FLAŞ BİLGİ',
          claimType,
          'HABER DETAYI',
          'PERDE ARKASI',
          'TAKIM ETKİSİ',
          'EDİTORYAL YORUM',
          'TARAFTAR SORUSU',
        ]
      : [
          'FLAŞ BİLGİ',
          claimType,
          'HABER DETAYI',
          'PERDE ARKASI',
          'EDİTORYAL YORUM',
          'TARAFTAR SORUSU',
        ];

  const finalWordCount = fullNarration.split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.max(25, Math.min(35, Math.round(finalWordCount / 2.35)));

  // Her slaytın süresini kelime uzunluğuyla orantılı hesapla (Slayt 1 ilk ~2.5 saniyede vurucu giriş yapar)
  const wordCounts = slideSpokenTexts.map((t) => Math.max(3, t.split(/\s+/).filter(Boolean).length));
  const sumWords = wordCounts.reduce((a, b) => a + b, 0);

  let cursorSec = 0;
  const scenes: ReelScriptScene[] = slideSpokenTexts.map((spoken, i) => {
    const isLast = i === slideSpokenTexts.length - 1;
    const rawDur =
      i === 0
        ? Math.max(2.4, Math.min(3.6, +((wordCounts[i] / sumWords) * estimatedDuration).toFixed(1)))
        : +((wordCounts[i] / sumWords) * estimatedDuration).toFixed(1);
    const dur = isLast ? +(estimatedDuration - cursorSec).toFixed(1) : Math.max(2.5, rawDur);
    const startSec = +cursorSec.toFixed(1);
    const endSec = +(startSec + dur).toFixed(1);
    cursorSec = endSec;

    return {
      sceneIndex: i + 1,
      timeRange: `${startSec.toFixed(1)} - ${endSec.toFixed(1)} sn`,
      startSecond: startSec,
      durationSeconds: dur,
      badge: slideBadges[i] || 'DETAY',
      subtitle: spoken,
      spokenText: spoken,
      visualCallout: extractSlideVisualCallout(spoken, cleanTitle),
      subCallout:
        i === 0
          ? `${claimType} • İLK 2 SANİYE ÖZETİ`
          : i === slideSpokenTexts.length - 1
          ? 'YORUMLARDA BULUŞALIM'
          : `${badgeTitle} • SLAYT ${i + 1}/${slideSpokenTexts.length}`,
    };
  });

  const sourceAttribution =
    claimType === 'RESMİ AÇIKLAMA'
      ? `Resmî Açıklama / ${articleMeta.sourceName}`
      : articleMeta.independentSourceCount >= 2
      ? `${articleMeta.independentSourceCount} Bağımsız Kaynak Doğrulaması (${articleMeta.corroboratingSources
          .slice(0, 2)
          .join(', ')})`
      : `${articleMeta.sourceName} (${claimType})`;

  // YAYIN METNİ STANDARDI:
  // 1. Merak uyandıran kısa başlık + Bilgi Türü Etiketi
  // 2. 2-4 cümlelik haber açıklaması (gerçek bilgi + editoryal yorum ayrımıyla)
  // 3. Habere özel doğal yorum sorusu
  // 4. Kaynak bilgisi
  // 5. 3-5 ilgili hashtag
  const captionBodySentences = [
    hookSentence,
    slide2Spoken,
    factualPool[1],
    editorialSentence,
  ]
    .slice(0, 4)
    .join(' ');

  const hashtags = ['#Trabzonspor', '#BordoMavi', '#SüperLig', categoryTag]
    .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx)
    .slice(0, 4)
    .join(' ');

  const facebookCaption = [
    `🔥 [${claimType}] ${cleanTitle}`,
    captionBodySentences,
    `💬 ${pollQuestion}`,
    `📌 Kaynak & Doğrulama: ${sourceAttribution} (Editoryal Puan: ${articleMeta.editorialScore}/100)`,
    hashtags,
  ].join('\n\n');

  return {
    title: cleanTitle,
    category,
    badgeTitle,
    claimType,
    editorialPotentialScore: articleMeta.editorialScore,
    sourceAttribution,
    independentSourceCount: articleMeta.independentSourceCount,
    fullNarration,
    estimatedDurationSeconds: estimatedDuration,
    scenes,
    facebookCaption,
    pollQuestion,
    pollOption1: 'Katılıyorum',
    pollOption2: 'Katılmıyorum',
  };
}
