export const dynamic = 'force-dynamic';
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
      body: true,
      status: true,
      createdAt: true,
      media: {
        select: {
          url: true
        }
      },
      sourceNews: {
        select: {
          imageUrl: true,
          title: true,
          summary: true
        }
      }
    }
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Medya Kütüphanesi</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Görsel Havuzu
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Sisteme yüklenen medyaları ve AI tarafından BordoMavi logosuyla anlık üretilen haber kartlarını yönetin.
        </p>
      </div>

      <MediaClient dbMedia={dbMedia} generatedImages={recentContents} />
    </div>
  );
}