import { prisma } from '@/lib/db';

/**
 * Türkçe harfleri düzgün şekilde küçük harfe dönüştürür ve özel karakterleri temizler.
 */
export function normalizeTurkishText(text: string): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/['’"”`«»]/g, '')
    .replace(/[.,:;!?()[\]{}<>\/\\+=*&%^$#@|~_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Türkçe haberlerde konu ve olay bilgisi taşımayan gürültü (stopword) kelimeleri.
 */
const TURKISH_STOPWORDS = new Set([
  've', 'ile', 'bir', 'bu', 'icin', 'için', 'da', 'de', 'ta', 'te', 'ki', 'mi', 'mu', 'mü', 'mı',
  'son', 'dakika', 'flas', 'flaş', 'sicak', 'sıcak', 'gelisme', 'gelişme', 'aciklama', 'açıklama',
  'bomba', 'resmi', 'resmen', 'cok', 'çok', 'daha', 'en', 'ise', 'gibi', 'kadar', 'sonra', 'once',
  'önce', 'olan', 'olarak', 'yapti', 'yaptı', 'etti', 'oldu', 'dedi', 'verdi', 'aldi', 'aldı',
  'gecti', 'geçti', 'geldi', 'gitti', 'yeni', 'iste', 'işte', 'o', 'su', 'şu', 'ama', 'fakat',
  'ancak', 'lakin', 'haber', 'haberi', 'haberleri', 'detay', 'detaylar', 'belli', 'acikladi',
  'açıkladı', 'soyledi', 'söyledi', 'konustu', 'konuştu', 'duyurdu', 'paylasti', 'paylaştı',
  'şok', 'sok', 'olay', 'büyük', 'buyuk', 'iddia', 'one', 'öne', 'suruldu', 'sürüldü', 'gundem',
  'gündem', 'flas', 'haberine', 'gore', 'göre', 'trabzon', 'trabzonspor', 'bordo', 'mavi', 'bordomavi',
  'firtina', 'fırtına'
]);

/**
 * Trabzonspor kadrosu, teknik heyet ve önemli şahıs varlıkları.
 */
const KNOWN_ENTITIES: Record<string, string[]> = {
  // Teknik Heyet & Yönetim
  'thomas_reis': ['thomas reis', 'thomas', 'reis'],
  'ertugrul_dogan': ['ertuğrul doğan', 'ertugrul dogan', 'doğan', 'dogan', 'baskan', 'başkan', 'yonetim kurulu', 'yönetim kurulu'],
  'fatih_tekke': ['fatih tekke', 'tekke'],
  'senol_gunes': ['şenol güneş', 'senol gunes', 'şenol hoca', 'gunes', 'güneş'],
  'abdullah_avci': ['abdullah avcı', 'abdullah avci', 'avcı', 'avci'],
  'nevzat_aydin': ['nevzat aydın', 'nevzat aydin', 'nevzat'],
  'ahmet_agaoglu': ['ahmet ağaoğlu', 'ahmet agaoglu', 'ağaoğlu', 'agaoglu'],
  
  // Süper Lig Rakipleri & Derbiler (Konu çeşitliliği için kritik)
  'rakip_besiktas': ['beşiktaş', 'besiktas', 'bjk', 'siyah beyaz', 'kara kartal', 'kartal'],
  'rakip_fenerbahce': ['fenerbahçe', 'fenerbahce', 'fb', 'sarı lacivert', 'kanarya'],
  'rakip_galatasaray': ['galatasaray', 'cimbom', 'gs', 'sarı kırmızı', 'aslan'],
  'rakip_basaksehir': ['başakşehir', 'basaksehir'],
  'rakip_samsunspor': ['samsunspor', 'samsun'],
  'rakip_rizespor': ['çaykur rizespor', 'rizespor', 'rize'],
  'rakip_antalyaspor': ['antalyaspor', 'antalya'],
  'rakip_konyaspor': ['konyaspor', 'konya'],
  'rakip_goztepe': ['göztepe', 'goztepe'],
  'rakip_eyupspor': ['eyüpspor', 'eyupspor'],

  // Kaleciler
  'ugurcan_cakir': ['uğurcan çakır', 'ugurcan cakir', 'uğurcan', 'ugurcan', 'kaptan'],
  'muhammet_taha_tepe': ['muhammet taha tepe', 'taha tepe'],
  'onuralp_cevikkan': ['onuralp çevikkan', 'onuralp cevikkan'],
  
  // Savunma
  'stefan_savic': ['stefan savic', 'savic', 'saviç'],
  'pedro_malheiro': ['pedro malheiro', 'malheiro'],
  'eren_elmali': ['eren elmalı', 'eren elmali', 'elmalı', 'elmali'],
  'borna_barisic': ['borna barisiç', 'borna barisic', 'barisic'],
  'arseniy_batagov': ['arseniy batagov', 'batagov'],
  'serdar_saatci': ['serdar saatçı', 'serdar saatci'],
  'huseyin_turkmen': ['hüseyin türkmen', 'huseyin turkmen'],
  'arif_bosluk': ['arif boşluk', 'arif bosluk'],
  'rayyan_baniya': ['rayyan baniya', 'baniya'],
  'stefano_denswil': ['stefano denswil', 'denswil'],
  'ali_sahin_yilmaz': ['ali şahin', 'ali sahin'],
  'ahmetcan_kaplan': ['ahmetcan kaplan', 'ahmetcan'],
  'taha_altikardes': ['taha altıkardeş', 'taha altikardes'],
  
  // Orta Saha
  'batista_mendy': ['batista mendy', 'mendy'],
  'john_lundstram': ['john lundstram', 'lundstram'],
  'okay_yokuslu': ['okay yokuşlu', 'okay yokuslu', 'yokuşlu', 'yokuslu'],
  'ozan_tufan': ['ozan tufan', 'tufan'],
  'muhammed_cham': ['muhammed cham', 'cham'],
  'cihan_canak': ['cihan çanak', 'cihan canak', 'çanak', 'canak'],
  'enis_bardhi': ['enis bardhi', 'bardhi'],
  'salih_malkocoglu': ['salih malkoçoğlu', 'salih malkocoglu'],
  
  // Hücum & Transfer Hedefleri
  'simon_banza': ['simon banza', 'banza'],
  'edin_visca': ['edin vişça', 'edin visca', 'vişça', 'visca'],
  'anthony_nwakaeme': ['anthony nwakaeme', 'nwakaeme', 'tony'],
  'denis_dragus': ['denis dragus', 'dragus'],
  'enis_destan': ['enis destan', 'destan'],
  'poyraz_yildirim': ['poyraz yıldırım', 'poyraz yildirim'],
  'mislav_orsic': ['mislav orsic', 'orşiç', 'orsic'],
  'paul_onuachu': ['paul onuachu', 'onuachu'],
  'danylo_sikan': ['danylo sikan', 'sikan'],
  'mustafa_eskihellac': ['mustafa eskihellaç', 'eskihellaç', 'eskihellac'],
  'marco_asensio': ['marco asensio', 'asensio'],
  'ruslan_malinovskyi': ['ruslan malinovskyi', 'malinovskyi', 'malinovsky', 'malinovski'],
  'oleksandr_zubkov': ['oleksandr zubkov', 'zubkov'],
  'felipe_augusto': ['felipe augusto', 'augusto'],
  'folcarelli': ['folcarelli', 'timothee folcarelli'],
  'corentin_tolisso': ['corentin tolisso', 'tolisso'],
  'umut_bozok': ['umut bozok', 'bozok'],

  // TFF, MHK & Hakem Gündemi
  'hakem_tff': ['mhk', 'tff', 'hacıosmanoğlu', 'haciosmanoglu', 'hakem', 'var hakemi', 'orta hakem', 'düdük', 'pfdk', 'tahkim'],

  // Tesisler & Finans
  'papara_park': ['papara park', 'akyazı', 'akyazi', 'stadyum'],
  'sponsorluk_finans': ['sponsor', 'anlaşma', 'sermaye artırımı', 'bedelli', 'kap bildirimi', 'borç tablosu', 'sponsorluk']
};

/**
 * Olay ve konu kategorileri (semantic topic markers).
 */
const EVENT_CATEGORIES: Record<string, string[]> = {
  'derbi': [
    'derbi', 'derbisi', 'derbiye', 'derbide', 'dev maç', 'büyük maç', 'zirve yarışı', 'kritik 90 dakika'
  ],
  'sakatlik': [
    'sakat', 'sakatlik', 'sakatlık', 'sakatlandi', 'sakatlandı', 'tedavi', 'mri', 'mr',
    'ameliyat', 'yirtik', 'yırtık', 'capraz bag', 'çapraz bağ', 'doktor', 'sakatligi', 'revir'
  ],
  'transfer': [
    'transfer', 'imza', 'sozlesme', 'sözleşme', 'anlasma', 'anlaşma', 'bonservis', 'kiralik',
    'kiralık', 'teklif', 'masada', 'gorusme', 'görüşme', 'kap', 'vedalasti', 'ayrildi', 'ayrıldı',
    'talip', 'imzayi atti', 'imzayı attı', 'resmi teklif'
  ],
  'kadro': [
    'kadro disi', 'kadro dışı', 'affedildi', 'kadroya alinmadi', 'kadroya alınmadı', 'kamp',
    'ilk 11', '11i', 'yedek', 'kafile', 'kadrosu', 'muhtemel 11'
  ],
  'idman_taktik': [
    'antrenman', 'idman', 'taktik', 'salonda çalıştı', 'mehmet ali yılmaz', 'tesisler', 'hazırlıklar sürdü', 'idman raporu'
  ],
  'ceza_hakem': [
    'kirmizi kart', 'kırmızı kart', 'sari kart', 'sarı kart', 'pfdk', 'tff', 'ceza',
    'disiplin', 'hakem', 'var', 'itiraz', 'sevk edildi', 'tahkim', 'hata', 'düdük astı'
  ],
  'bilet_tribun': [
    'bilet', 'passolig', 'satisa cikti', 'satışa çıktı', 'tukendi', 'tükendi', 'kombine',
    'deplasman tribunu', 'tribün', 'taraftar rekoru'
  ],
  'mac_sonuc': [
    'galibiyet', 'maglubiyet', 'mağlubiyet', 'beraberlik', '3 puan', 'puan kaybi', 'skor', 'maç sonucu'
  ]
};

/**
 * Türkçe çekim eklerini temizler (Kök bulucu / Rule-based Turkish Stemmer).
 */
export function stemTurkishWord(word: string): string {
  if (!word || word.length <= 3) return word;
  
  // Basit ve yaygın Türkçe çekim ekleri (en uzundan en kısaya)
  const suffixes = [
    'lerinden', 'larından', 'lerinin', 'larının', 'leriyle', 'larıyla',
    'lerinde', 'larında', 'lerini', 'larını',
    'sinden', 'sından', 'sindeki', 'sındaki',
    'inden', 'ından', 'unden', 'ünden',
    'lerin', 'ların', 'lerle', 'larla', 'lerde', 'larda',
    'den', 'dan', 'ten', 'tan',
    'deki', 'daki', 'teki', 'taki',
    'nin', 'nın', 'nun', 'nün',
    'in', 'ın', 'un', 'ün',
    'ye', 'ya', 'ne', 'na',
    'de', 'da', 'te', 'ta',
    'yi', 'yı', 'yu', 'yü',
    'le', 'la', 'li', 'lı', 'lu', 'lü',
    'si', 'sı', 'su', 'sü',
    'lik', 'lık', 'luk', 'lük',
    'siz', 'sız', 'suz', 'süz',
    'ci', 'cı', 'cu', 'cü',
    'ler', 'lar',
    'di', 'dı', 'du', 'dü', 'ti', 'tı', 'tu', 'tü',
    'mis', 'miş', 'mus', 'müş',
    'i', 'ı', 'u', 'ü', 'e', 'a'
  ];

  let stemmed = word;
  for (const suf of suffixes) {
    if (stemmed.endsWith(suf) && (stemmed.length - suf.length) >= 3) {
      stemmed = stemmed.slice(0, -suf.length);
      break;
    }
  }

  return stemmed;
}

/**
 * Metinden anlamlı kelime token'larını çıkartır (stopwords hariç, min 3 karakter, köklerine indirgenmiş).
 */
export function extractMeaningfulTokens(text: string): string[] {
  const normalized = normalizeTurkishText(text);
  const words = normalized.split(/\s+/);
  const result: string[] = [];

  for (const word of words) {
    if (word.length >= 3 && !TURKISH_STOPWORDS.has(word)) {
      result.push(stemTurkishWord(word));
    }
  }

  return result;
}

/**
 * 2'li kelime grupları (bi-grams) çıkartır.
 */
export function extractBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Metinde geçen şahısları (oyuncu/yönetici) ve olay kategorilerini tespit eder.
 */
export function extractEntitiesAndEvents(text: string): { entities: string[]; events: string[] } {
  const normalized = normalizeTurkishText(text);
  const foundEntities: string[] = [];
  const foundEvents: string[] = [];

  for (const [entityKey, keywords] of Object.entries(KNOWN_ENTITIES)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      foundEntities.push(entityKey);
    }
  }

  for (const [eventKey, keywords] of Object.entries(EVENT_CATEGORIES)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      foundEvents.push(eventKey);
    }
  }

  return { entities: foundEntities, events: foundEvents };
}

/**
 * İki token listesi arasındaki Jaccard benzerliğini hesaplar (0.0 - 1.0).
 */
export function computeJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionCount;
  if (unionSize === 0) return 0;
  return intersectionCount / unionSize;
}

export interface NewsSimilarityResult {
  similarity: number;
  isDuplicate: boolean;
  sharedTokens: string[];
  sharedEntities: string[];
  sharedEvents: string[];
  reason: string;
}

/**
 * İki haber metninin semantik olarak aynı olayı / haberi anlatıp anlatmadığını hesaplar.
 */
export function computeNewsSimilarity(
  textA: string,
  textB: string,
  threshold: number = 0.45
): NewsSimilarityResult {
  const tokensA = extractMeaningfulTokens(textA);
  const tokensB = extractMeaningfulTokens(textB);

  // 1. Kök bazlı kelime Jaccard Benzerliği
  const wordJaccard = computeJaccardSimilarity(tokensA, tokensB);

  // 2. 2'li Kelime (Bi-gram) Benzerliği (Cümle kalıplarını ve tamlamaları yakalar)
  const bigramsA = extractBigrams(tokensA);
  const bigramsB = extractBigrams(tokensB);
  const bigramJaccard = computeJaccardSimilarity(bigramsA, bigramsB);

  // 3. Varlık ve Olay Eşleşmesi
  const analysisA = extractEntitiesAndEvents(textA);
  const analysisB = extractEntitiesAndEvents(textB);

  const sharedEntities = analysisA.entities.filter(e => analysisB.entities.includes(e));
  const sharedEvents = analysisA.events.filter(ev => analysisB.events.includes(ev));

  const setB = new Set(tokensB);
  const sharedTokens = tokensA.filter(t => setB.has(t));

  // Varlık skorlaması (Genel terimler olan hakem_tff, papara_park ve sponsorluk_finans tek başına strong match yapamaz)
  const specificSharedEntities = sharedEntities.filter(e => !['papara_park', 'hakem_tff', 'sponsorluk_finans'].includes(e));
  let entityMatchBonus = 0;
  let isStrongMatch = false;

  if (specificSharedEntities.length > 0 && sharedEvents.length > 0) {
    // Hem aynı futbolcu/özne hem de aynı olay (Örn: Banza + sakatlık veya Thomas Reis + kadro dışı)
    entityMatchBonus = 0.45;
    isStrongMatch = true;
  } else if (specificSharedEntities.length > 0 && sharedTokens.length >= 2) {
    entityMatchBonus = 0.30;
    isStrongMatch = true;
  } else if (specificSharedEntities.length > 0) {
    entityMatchBonus = 0.15;
  } else if (sharedEvents.length > 0 && sharedTokens.length >= 3) {
    entityMatchBonus = 0.20;
  }

  // Ağırlıklı genel benzerlik puanı (0.0 - 1.0)
  let overallSimilarity = (wordJaccard * 0.40) + (bigramJaccard * 0.25) + entityMatchBonus;
  if (isStrongMatch && overallSimilarity < 0.60) {
    overallSimilarity = 0.65;
  }
  if (overallSimilarity > 1.0) overallSimilarity = 1.0;

  // Özel karar kuralı:
  // Eğer aynı özne ve aynı olay varsa doğrudan mükerrerdir!
  const isDuplicate = overallSimilarity >= threshold || isStrongMatch;

  let reason = '';
  if (isDuplicate) {
    if (sharedEntities.length > 0 && sharedEvents.length > 0) {
      reason = `Aynı özne (${sharedEntities.join(', ')}) ve aynı olay konusu (${sharedEvents.join(', ')}) eşleşti. Mükerrer haber.`;
    } else if (sharedEntities.length > 0) {
      reason = `Aynı özne (${sharedEntities.join(', ')}) ve ortak anahtar kelimeler eşleşti (%${Math.round(overallSimilarity * 100)}). Mükerrer haber.`;
    } else {
      reason = `Semantik kelime ve kalıp benzerliği yüksek (%${Math.round(overallSimilarity * 100)}). Mükerrer haber.`;
    }
  } else {
    reason = 'Özgün haber.';
  }

  return {
    similarity: overallSimilarity,
    isDuplicate,
    sharedTokens,
    sharedEntities,
    sharedEvents,
    reason
  };
}

/**
 * Bir haberin veya içeriğin belirtilen saatten eski olup olmadığını denetler.
 */
export function isNewsTooOld(publishedAt: Date | string | number | null | undefined, maxHours: number = 24): boolean {
  if (!publishedAt) return false;
  const pubDate = new Date(publishedAt).getTime();
  if (isNaN(pubDate)) return false;
  const ageMs = Date.now() - pubDate;
  return ageMs > maxHours * 60 * 60 * 1000;
}

export interface DuplicateHistoryCheckResult {
  isDuplicate: boolean;
  similarity: number;
  matchedPost?: {
    id: string;
    title: string;
    publishedAt: Date | null;
    facebookPostId?: string | null;
  };
  reason?: string;
}

/**
 * Aday haberi, son N gün içinde veritabanında yayınlanmış (veya yayına hazır) içeriklerle kıyaslar.
 * Eğer geçmişte yayınlanmış bir haberle örtüşüyorsa mükerrer olarak işaretler.
 */
export async function checkAgainstPublishedHistory(
  candidate: { title: string; summary?: string | null; id?: string },
  lookbackDays: number = 14
): Promise<DuplicateHistoryCheckResult> {
  try {
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Son N günde yayınlanan ve sıraya alınan tüm içerikleri getir
    const pastContents = await prisma.content.findMany({
      where: {
        OR: [
          { status: 'PUBLISHED' },
          { status: 'READY_TO_PUBLISH' },
          { status: 'APPROVED' }
        ],
        createdAt: { gte: lookbackDate }
      },
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        publishedAt: true,
        facebookPostId: true,
        sourceNewsId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!pastContents || pastContents.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    const candidateFullText = `${candidate.title} ${candidate.summary || ''}`;
    let maxSimilarity = 0;
    let mostSimilarPost: any = null;
    let matchReason = '';

    for (const post of pastContents) {
      // Kendi kendine kıyaslamayı engelle
      if (candidate.id && post.sourceNewsId === candidate.id) {
        continue;
      }

      const postFullText = `${post.title} ${post.body || ''}`;
      const simResult = computeNewsSimilarity(candidateFullText, postFullText);

      if (simResult.similarity > maxSimilarity) {
        maxSimilarity = simResult.similarity;
        mostSimilarPost = post;
        matchReason = simResult.reason;
      }

      // Eğer doğrudan semantik benzerlik eşleşmesi bulunduysa erken çıkış yap
      if (simResult.isDuplicate) {
        return {
          isDuplicate: true,
          similarity: simResult.similarity,
          matchedPost: {
            id: post.id,
            title: post.title,
            publishedAt: post.publishedAt,
            facebookPostId: post.facebookPostId
          },
          reason: `Geçmiş yayın ile eşleşti (%${Math.round(simResult.similarity * 100)}): "${post.title}". ${simResult.reason}`
        };
      }

      // 24 saatlik aynı şahıs / konu koruması:
      // Eğer son 24 saat içinde bu futbolcu/yönetici/spesifik özne hakkında bir paylaşım yapıldıysa
      // ve ortak bir olay veya ortak 2+ kelime varsa veya benzerlik >= 0.28 ise
      // takipçileri aynı konuya boğmamak ve Facebook algoritmasını korumak için mükerrer say!
      // (NOT: Papara Park, stadyum, sponsor veya hakem gibi genel mekânsal varlıklar tek başına mükerrerlik tetiklemez)
      const postTimestamp = post.publishedAt || post.createdAt;
      const isWithin24h = postTimestamp 
        ? (Date.now() - new Date(postTimestamp).getTime()) < 24 * 60 * 60 * 1000 
        : true;

      const specificEntities = simResult.sharedEntities.filter(e => !['papara_park', 'hakem_tff', 'sponsorluk_finans'].includes(e));

      if (isWithin24h && specificEntities.length > 0) {
        if (simResult.sharedEvents.length > 0 || simResult.sharedTokens.length >= 2 || simResult.similarity >= 0.28) {
          return {
            isDuplicate: true,
            similarity: Math.max(simResult.similarity, 0.75),
            matchedPost: {
              id: post.id,
              title: post.title,
              publishedAt: post.publishedAt,
              facebookPostId: post.facebookPostId
            },
            reason: `Son 24 saat içinde aynı özne (${specificEntities.join(', ')}) hakkında zaten bir gönderi yayınlandı: "${post.title}". Sayfa kalitesini ve etkileşim oranını korumak için mükerrer sayıldı.`
          };
        }
      }
    }

    return {
      isDuplicate: false,
      similarity: maxSimilarity,
      matchedPost: mostSimilarPost ? {
        id: mostSimilarPost.id,
        title: mostSimilarPost.title,
        publishedAt: mostSimilarPost.publishedAt,
        facebookPostId: mostSimilarPost.facebookPostId
      } : undefined,
      reason: maxSimilarity > 0.35 ? `Düşük benzerlik (%${Math.round(maxSimilarity * 100)}), güvenli.` : 'Tamamen özgün.'
    };

  } catch (error: any) {
    console.error("[Similarity Engine] Error checking published history:", error);
    // Hata durumunda akışı kilitlememek için false dön
    return { isDuplicate: false, similarity: 0 };
  }
}

export interface FocalClusterInfo {
  primaryEntity: string | null;
  primaryEvent: string | null;
  clusterKey: string;
}

/**
 * Haberin odaklandığı ana özneyi (rakip takım, oyuncu, hoca, başkan vb.) ve olay tipini tespit eder.
 * Böylece aynı konuda peş peşe haber üretilmesi engellenir.
 */
export function getNewsFocalCluster(title: string, summary?: string | null): FocalClusterInfo {
  const fullText = `${title} ${summary || ''}`;
  const { entities, events } = extractEntitiesAndEvents(fullText);

  const primaryEntity = entities.length > 0 ? entities[0] : null;
  const primaryEvent = events.length > 0 ? events[0] : null;

  let clusterKey = 'genel_gundem';
  if (primaryEntity && primaryEvent) {
    clusterKey = `${primaryEntity}_${primaryEvent}`;
  } else if (primaryEntity) {
    clusterKey = `${primaryEntity}_genel`;
  } else if (primaryEvent) {
    clusterKey = `genel_${primaryEvent}`;
  }

  return {
    primaryEntity,
    primaryEvent,
    clusterKey
  };
}

/**
 * Birden çok kaynaktan aynı anda gelen aday haber listesini (batch) kendi içinde tekilleştirir.
 * Hem metin benzerliğini hem de konu/özne kümesini denetler:
 * Aynı olayı veya aynı kişiyi/derbiyi anlatan haberlerden sadece en yüksek puanlı olanı seçer, diğerlerini eler.
 */
export function deduplicateNewsBatch<T extends { id?: string; title: string; summary?: string | null; importanceScore?: number | null }>(
  newsList: T[]
): { uniqueNews: T[]; duplicateNews: Array<{ item: T; duplicateOf: T; similarity: number }> } {
  const uniqueNews: T[] = [];
  const duplicateNews: Array<{ item: T; duplicateOf: T; similarity: number }> = [];
  const seenClusters = new Map<string, T>();
  const seenEntities = new Map<string, T>();

  for (const item of newsList) {
    let duplicateMatch: { target: T; similarity: number } | null = null;
    const itemText = `${item.title} ${item.summary || ''}`;
    const itemCluster = getNewsFocalCluster(item.title, item.summary);

    // 1. Doğrudan semantik metin ve varlık benzerliği kontrolü
    for (const uniqueItem of uniqueNews) {
      const uniqueText = `${uniqueItem.title} ${uniqueItem.summary || ''}`;
      const sim = computeNewsSimilarity(itemText, uniqueText);
      if (sim.isDuplicate) {
        duplicateMatch = { target: uniqueItem, similarity: sim.similarity };
        break;
      }
    }

    // 2. Konu Kümesi ve Odak Varlık Tekilleştirmesi (Aynı derbi, aynı oyuncu veya aynı olaydan sadece 1 haber seçilsin)
    if (!duplicateMatch) {
      if (itemCluster.clusterKey !== 'genel_gundem' && seenClusters.has(itemCluster.clusterKey)) {
        const existing = seenClusters.get(itemCluster.clusterKey)!;
        duplicateMatch = { target: existing, similarity: 0.85 };
      } else if (itemCluster.primaryEntity && seenEntities.has(itemCluster.primaryEntity)) {
        // Eğer aynı özne hakkında başka bir haber zaten seçilmişse (Örn: Beşiktaş maçı veya Banza veya Malinovskyi)
        const existing = seenEntities.get(itemCluster.primaryEntity)!;
        duplicateMatch = { target: existing, similarity: 0.80 };
      }
    }

    if (duplicateMatch) {
      duplicateNews.push({
        item,
        duplicateOf: duplicateMatch.target,
        similarity: duplicateMatch.similarity
      });
    } else {
      uniqueNews.push(item);
      if (itemCluster.clusterKey !== 'genel_gundem') {
        seenClusters.set(itemCluster.clusterKey, item);
      }
      if (itemCluster.primaryEntity) {
        seenEntities.set(itemCluster.primaryEntity, item);
      }
    }
  }

  return { uniqueNews, duplicateNews };
}
