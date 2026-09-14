import { prisma } from "@/lib/db";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const contents = await prisma.content.findMany({
    where: {
      status: {
        not: 'REJECTED'
      },
      // We want contents that have a created or published date
    },
    include: {
      sourceNews: {
        select: { title: true }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">İçerik Takvimi</h1>
        <p className="text-muted-foreground mt-1">Yapay zekanın planladığı ve yayınladığı tüm içeriklerin zaman çizelgesi.</p>
      </div>

      <CalendarClient initialEvents={contents} />
    </div>
  );
}
