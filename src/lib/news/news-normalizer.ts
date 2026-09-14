import crypto from 'crypto';

export interface NormalizedNews {
  externalId: string;
  title: string;
  url: string;
  canonicalUrl: string;
  summary: string | null;
  publishedAt: Date;
  contentHash: string;
}

export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^\w\sğüşıöç]/g, ' ')
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
    contentHash
  };
}
