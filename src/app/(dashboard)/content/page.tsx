export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/db";
import ContentClient from "./ContentClient";

export default async function ContentPage() {
  const contents = await prisma.content.findMany({
    where: {
      status: {
        not: 'REJECTED' // Don't send rejected items to the UI default list
      }
    },
    include: {
      sourceNews: {
        select: { title: true }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  const draftCount = await prisma.content.count({ where: { status: 'DRAFT' } });
  const readyCount = await prisma.content.count({ where: { status: 'READY_TO_PUBLISH' } });
  const scheduledCount = await prisma.content.count({ where: { status: 'SCHEDULED' } });
  const publishedCount = await prisma.content.count({ where: { status: 'PUBLISHED' } });

  const metrics = { draftCount, readyCount, scheduledCount, publishedCount };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <ContentClient initialContents={contents} metrics={metrics} />
    </div>
  );
}