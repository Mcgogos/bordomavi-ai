import { prisma } from "@/lib/db";
import MediaClient from "./MediaClient";

export default async function MediaPage() {
  // Fetch actual media items from DB
  const dbMedia = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Fetch recent contents to display their dynamic OG images
  // This will show the user the BordoMavi logolu images we generate on the fly
  const recentContents = await prisma.content.findMany({
    where: {
      status: {
        in: ['PUBLISHED', 'READY_TO_PUBLISH', 'SCHEDULED', 'PENDING_APPROVAL']
      }
    },
    orderBy: { createdAt: "desc" },
    take: 12, // Show last 12 generated images
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true
    }
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Medya KÃ¼tÃ¼phanesi</h1>
        <p className="text-muted-foreground mt-1">Sisteme yÃ¼klenen medyalarÄ± ve AI tarafÄ±ndan anlÄ±k Ã¼retilen haber gÃ¶rsellerini yÃ¶netin.</p>
      </div>

      <MediaClient dbMedia={dbMedia} generatedImages={recentContents} />
    </div>
  );
}