export const revalidate = 15;
import { prisma } from "@/lib/db";
import ContentClient from "./ContentClient";

export default async function ContentPage() {
  const [contents, draftCount, readyCount, scheduledCount, publishedCount] = await Promise.all([
    prisma.content.findMany({
      where: {
        status: {
          not: 'REJECTED' // Don't send rejected items to the UI default list
        }
      },
      include: {
        sourceNews: {
          select: { title: true, importanceScore: true, viralScore: true }
        },
        analytics: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.content.count({ where: { status: 'DRAFT' } }),
    prisma.content.count({ where: { status: 'READY_TO_PUBLISH' } }),
    prisma.content.count({ where: { status: 'SCHEDULED' } }),
    prisma.content.count({ where: { status: 'PUBLISHED' } }),
  ]);

  const metrics = { draftCount, readyCount, scheduledCount, publishedCount };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <ContentClient initialContents={contents} metrics={metrics} />
    </div>
  );
}