export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import NewsClientPage from './client-page';


export default async function NewsPage() {
  const newsRecords = await prisma.news.findMany({
    // Only show news that haven't had content generated yet
    where: {
      content: null
    },
    // En son Ã§Ä±kan haberler en Ã¼ste
    orderBy: [
      { publishedAt: 'desc' }
    ],
    take: 100,
    include: { source: true }
  });

  const formattedNews = newsRecords.map((n) => ({
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
