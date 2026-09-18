import { NormalizedNews } from './news-normalizer';
import { prisma } from '@/lib/db'; // Assumes a generic prisma client exists or we can use DB

// In a real app we might cache recent news to memory for faster duplicate checking
// but for V1 we can query DB
export async function isDuplicate(item: NormalizedNews): Promise<boolean> {
  // 1. External ID or Canonical URL match
  const exactMatch = await prisma.news.findFirst({
    where: {
      OR: [
        { externalId: item.externalId },
        { canonicalUrl: item.canonicalUrl },
        { url: item.url }
      ]
    },
    select: { id: true }
  });

  if (exactMatch) return true;

  // 2. Hash match + Time proximity (within 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const hashMatch = await prisma.news.findFirst({
    where: {
      contentHash: item.contentHash,
      publishedAt: {
        gte: thirtyDaysAgo
      }
    },
    select: { id: true }
  });

  if (hashMatch) return true;

  return false;
}

export function passesKeywordFilter(title: string, summary: string, sourceType: string): boolean {
  if (sourceType === 'CLUB') return true; // Rule 4: Resmi site her zaman geçer

  const targetText = `${title} ${summary}`.toLocaleLowerCase('tr-TR');
  
  // 1. DOĞRUDAN TRABZONSPOR KELİMELERİ (Rule 1)
  const directKeywords = [
    'trabzonspor',
    "trabzonspor'un",
    "trabzonspor'da",
    "trabzonspor'a",
    "trabzonspor'u",
    "trabzonspor ile",
    'bordo mavi',
    'bordo-mavi',
    'papara park',
    'süper lig'
  ];

  let hasDirectKeyword = directKeywords.some(kw => targetText.includes(kw));

  // Rule 4: Ulusal kaynaklarda daha sıkı bağlam ara. (Örn: Sadece "Süper Lig" geçiyorsa ulusalda yetmesin)
  if ((sourceType === 'NATIONAL' || sourceType === 'INTERNATIONAL') && hasDirectKeyword) {
    const onlySuperLig = targetText.includes('süper lig') && !targetText.includes('trabzonspor') && !targetText.includes('bordo');
    if (onlySuperLig) {
      hasDirectKeyword = false; // Sadece Süper Lig ise yetersiz say.
    }
  }

  if (hasDirectKeyword) return true;

  // 3. KİŞİ İSİMLERİ (Rule 3)
  const persons = [
    'uğurcan çakır', 
    'thomas reis',
    'ertuğrul doğan',
    'simon banza',
    'edin vişça',
    'anthony nwakaeme',
    'stefan savic',
    'batista mendy',
    'muhammed cham',
    'fatih tekke'
  ];
  
  const hasPerson = persons.some(kw => targetText.includes(kw));

  // Eğer kişi varsa, mutlaka Trabzonspor bağlamı olmalı (yukarıda 'trabzonspor' geçseydi hasDirectKeyword ile dönerdi, burada yan kelimelere bakıyoruz)
  const tsContextKeywords = [
    'bordo mavili', 'bordo-mavili', 'karadeniz ekibi', 'fırtına', 
    'başkan', 'yönetim', 'transfer', 'kamp'
  ];

  if (hasPerson && tsContextKeywords.some(kw => targetText.includes(kw))) {
    return true;
  }

  // 4. KAYNAK ÖNCELİĞİ - YEREL (Rule 4: Daha geniş filtre)
  if (sourceType === 'LOCAL') {
    const localBroadKeywords = [
      'karadeniz fırtınası', 'akyazı', 'bordo mavililer', 'bordo-mavililer'
    ];
    if (localBroadKeywords.some(kw => targetText.includes(kw))) {
      return true;
    }
    
    // "Trabzon" kelimesi tek başına yetmez (Rule 2), ama yerel kaynakta kişi ile beraber "Trabzon" geçiyorsa bağlam kabul edelim
    if (hasPerson && targetText.includes('trabzon')) {
      return true;
    }
  }

  return false;
}
