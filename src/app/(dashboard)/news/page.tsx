export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import NewsClientPage from './client-page';
import { deduplicateNewsBatch } from '@/lib/news/news-similarity-engine';

export default async function NewsPage() {
  const newsRecords = await prisma.news.findMany({
    // Only show news that haven't had content generated yet
    where: {
      content: null
    },
    // En son çıkan haberler en üste
    orderBy: [
      { publishedAt: 'desc' }
    ],
    take: 120,
    include: { source: true }
  });

  // Konu ve semantik benzerlik motoru ile aynı olayı anlatan mükerrer haberleri tekilleştir
  const { uniqueNews } = deduplicateNewsBatch(newsRecords);

  const formattedNews = uniqueNews.map((n) => ({
    id: n.id,
    title: n.title,
    source: n.source.name,
    publishedAt: n.publishedAt.toISOString(),
    status: n.isProcessed ? "ANALYZED" : "PENDING",
    aiScore: n.importanceScore || null,
    confidence: n.aiConfidence || n.confidenceLevel || "UNVERIFIED"
  }));

  return <NewsClientPage initialNews={formattedNews} />;
}
