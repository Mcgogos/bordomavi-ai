export const revalidate = 15;
import { prisma } from "@/lib/db";
import SimpleAutonomousHub from "@/components/dashboard/SimpleAutonomousHub";
import { SmartPublisher } from "@/lib/content/smart-publisher";

export default async function DashboardPage() {
  const { dateKey } = SmartPublisher.getTurkeyTime();
  const [recentPublished, trendingSetting, slotSettings] = await Promise.all([
    prisma.content.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        type: true,
        facebookPostId: true,
        aiReasoning: true,
      },
    }),
    prisma.setting.findUnique({
      where: { key: "DAILY_TRENDING_VIDEOS" },
    }),
    prisma.setting.findMany({
      where: {
        key: {
          startsWith: `PUBLISHED_SLOT_${dateKey}_`,
        },
      },
    }),
  ]);

  let trendingItems: any[] = [];
  let trendingUpdatedAt: string | null = null;
  if (trendingSetting?.value) {
    try {
      const parsed = JSON.parse(trendingSetting.value);
      if (Array.isArray(parsed?.items)) {
        trendingItems = parsed.items;
        trendingUpdatedAt = parsed.updatedAt || trendingSetting.updatedAt.toISOString();
      }
    } catch {}
  }

  const publishedSlotsToday = slotSettings.map((s) =>
    s.key.replace(`PUBLISHED_SLOT_${dateKey}_`, "")
  );

  const formattedPublished = recentPublished.map((item) => ({
    id: item.id,
    title: item.title,
    type: String(item.type || "NEWS"),
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    facebookPostId: item.facebookPostId || null,
    aiReasoning: item.aiReasoning || null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            BordoMavi AI — Otonom Yayın & Reels Merkezi
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Tüm sistem 7/24 otomatiktir. Paylaşılan Reels videolarını izleyebilir ve günlük belirlenen en trend Trabzonspor videolarını takip edebilirsiniz.
          </p>
        </div>
      </div>

      {/* Sadeleştirilmiş Tek Ekran Kontrol Merkezi */}
      <SimpleAutonomousHub
        publishedReelsAndPosts={formattedPublished}
        initialTrendingVideos={trendingItems}
        trendingUpdatedAt={trendingUpdatedAt}
        publishedSlotsToday={publishedSlotsToday}
      />
    </div>
  );
}
