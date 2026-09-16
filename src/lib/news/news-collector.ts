import { fetchRss } from './rss-fetcher';
import { normalizeNewsItem } from './news-normalizer';
import { passesKeywordFilter } from './news-deduplicator';
import { prisma } from '@/lib/db';

export async function runNewsCollector() {
  const result = {
    success: true,
    sourcesProcessed: 0,
    itemsFetched: 0,
    newItems: 0,
    duplicates: 0,
    errors: 0
  };

  try {
    let sources = [];
    try {
      sources = await prisma.newsSource.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' }
      });
    } catch (e) {
      console.warn("[NEWS] DB connection failed. Using mock fallback sources.");
      sources = [
        { id: "1", name: "Haber61", rssUrl: "https://www.haber61.net/rss", type: "LOCAL", isActive: true },
        { id: "2", name: "Günebakış", rssUrl: "https://www.gunebakis.com.tr/rss", type: "LOCAL", isActive: true },
        { id: "3", name: "61saat", rssUrl: "https://www.61saat.com/rss", type: "LOCAL", isActive: true },
        { id: "4", name: "Taka Gazete", rssUrl: "https://www.takagazete.com.tr/rss", type: "LOCAL", isActive: true },
        { id: "5", name: "Kuzey Ekspres", rssUrl: "https://www.kuzeyekspres.com.tr/rss", type: "LOCAL", isActive: true },
        { id: "6", name: "HaberTS", rssUrl: "https://www.haberts.com/rss", type: "LOCAL", isActive: true },
      ] as any[];
    }

    const activeSources = sources.filter((s: any) => s.rssUrl);
    if (!activeSources.length) return result;
    result.sourcesProcessed = activeSources.length;

    // 1. Tüm kaynakları PARALEL çek
    const fetchResults = await Promise.allSettled(
      activeSources.map(async (source: any) => {
        const items = await fetchRss(source.rssUrl);
        return { source, items };
      })
    );

    // 2. Normalize edilmiş tüm haberleri topla
    const candidates: Array<{ normalized: any; sourceId: string; sourceName: string; sourceType: string }> = [];
    for (const settled of fetchResults) {
      if (settled.status === 'rejected' || !settled.value?.items) {
        result.errors++;
        continue;
      }
      const { source, items } = settled.value;
      for (const rawItem of items) {
        result.itemsFetched++;
        const normalized = normalizeNewsItem(rawItem);
        if (!normalized) continue;
        if (!passesKeywordFilter(normalized.title, normalized.summary || "", source.type)) continue;
        candidates.push({ normalized, sourceId: source.id, sourceName: source.name, sourceType: source.type });
      }
    }

    if (candidates.length === 0) return result;

    // 3. Tek sorguda mevcut tüm content hash'lerini çek (N sorgu yerine 1 sorgu)
    const allHashes = candidates.map(c => c.normalized.contentHash);
    let existingHashes = new Set<string>();
    try {
      const existing = await prisma.news.findMany({
        where: { contentHash: { in: allHashes } },
        select: { contentHash: true }
      });
      existingHashes = new Set(existing.map((e: any) => e.contentHash));
    } catch (e) {
      console.warn("[NEWS] Duplicate check failed, proceeding without dedup.");
    }

    // 4. Sadece yeni olanları filtrele
    const newItems = candidates.filter(c => !existingHashes.has(c.normalized.contentHash));
    result.duplicates = candidates.length - newItems.length;

    // 5. Toplu (batch) olarak veritabanına ekle — skipDuplicates ile güvenli
    if (newItems.length > 0) {
      try {
        const inserted = await prisma.news.createMany({
          data: newItems.map(({ normalized, sourceId }) => ({
            title: normalized.title,
            url: normalized.url,
            canonicalUrl: normalized.canonicalUrl,
            externalId: normalized.externalId,
            contentHash: normalized.contentHash,
            imageUrl: normalized.imageUrl ?? null,
            summary: normalized.summary ?? null,
            publishedAt: normalized.publishedAt,
            sourceId,
            isProcessed: false
          })),
          skipDuplicates: true
        });
        result.newItems = inserted.count;
        console.log(`[NEWS] ${inserted.count} yeni haber eklendi (${result.duplicates} mükerrer atlandı).`);
      } catch (dbErr: any) {
        console.error("[NEWS] Batch insert hatası:", dbErr.message);
        result.errors++;
      }
    }

    return result;

  } catch (error) {
    console.error("[NEWS] Collector fatal error:", error);
    result.success = false;
    return result;
  }
}
