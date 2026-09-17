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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">İçerik Takvimi</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Zaman Çizelgesi
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Yapay zekanın planladığı ve Facebook'ta yayınladığı tüm içeriklerin editoryal takvimi.
        </p>
      </div>

      <CalendarClient initialEvents={contents} />
    </div>
  );
}
