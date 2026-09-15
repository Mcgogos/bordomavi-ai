import crypto from 'crypto';

export interface NormalizedNews {
  externalId: string;
  title: string;
  url: string;
  canonicalUrl: string;
  summary: string | null;
  publishedAt: Date;
  contentHash: string;
  imageUrl?: string | null;
}

export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^\w\sğüşöçığÜŞÖÇİ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function normalizeNewsItem(item: any): NormalizedNews | null {
  if (!item.title || !item.link) return null;
  
  const title = item.title.trim();
  const url = item.link.trim();
  
  // Basic URL canonicalization
  let canonicalUrl = url.split('?')[0].split('#')[0];
  if (canonicalUrl.endsWith('/')) {
    canonicalUrl = canonicalUrl.slice(0, -1);
  }

  const normalizedTitle = normalizeTitle(title);
  const contentHash = hashString(normalizedTitle);
  
  let publishedAt = new Date();
  if (item.isoDate) {
    publishedAt = new Date(item.isoDate);
  } else if (item.pubDate) {
    publishedAt = new Date(item.pubDate);
  }

  // Handle invalid dates
  if (isNaN(publishedAt.getTime())) {
    publishedAt = new Date();
  }

  const externalId = item.guid || item.id || canonicalUrl;

  // Extract Image URL
  let imageUrl = null;
  if (item.enclosure && item.enclosure.url && item.enclosure.url.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
    imageUrl = item.enclosure.url;
  } else if (item['content:encoded'] || item.content) {
    const contentToSearch = item['content:encoded'] || item.content;
    const imgMatch = contentToSearch.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) {
      imageUrl = imgMatch[1];
    }
  }

  // Basic HTML strip for summary
  let summary = item.contentSnippet || item.content || item.summary || null;
  if (summary) {
    summary = summary.replace(/<[^>]*>?/gm, '').trim();
    if (summary.length > 500) summary = summary.substring(0, 500) + '...';
  }

  return {
    externalId,
    title,
    url,
    canonicalUrl,
    summary,
    publishedAt,
    contentHash,
    imageUrl
  };
}
