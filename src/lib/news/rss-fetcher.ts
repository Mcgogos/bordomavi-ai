import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'BordoMaviAI/1.0 (Newsbot)',
  }
});

export async function fetchRss(url: string) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items || [];
  } catch (error) {
    console.error(`[NEWS] Error fetching RSS from ${url}:`, error);
    return null; // Signals an error, skip this source
  }
}
