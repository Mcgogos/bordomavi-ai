import { prisma } from "@/lib/db";
import EditorClient from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  // We fetch DRAFT, PENDING_APPROVAL, and READY_TO_PUBLISH items to be editable
  const editableContents = await prisma.content.findMany({
    where: {
      status: {
        in: ['DRAFT', 'PENDING_APPROVAL', 'READY_TO_PUBLISH']
      }
    },
    include: {
      sourceNews: {
        select: { title: true, url: true }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ä°Ã§erik EditÃ¶rÃ¼</h1>
        <p className="text-muted-foreground mt-1">Yapay zekanÄ±n hazÄ±rladÄ±ÄŸÄ± metinleri inceleyin, dÃ¼zenleyin ve onaya gÃ¶nderin.</p>
      </div>

      <EditorClient initialContents={editableContents} />
    </div>
  );
}