export const revalidate = 15;
import { prisma } from "@/lib/db";
import SimpleAutonomousHub from "@/components/dashboard/SimpleAutonomousHub";
import { SmartPublisher } from "@/lib/content/smart-publisher";
import { resolvePageToken } from "@/services/facebook.service";

async function fetchFacebookMediaForPost(postId: string | null, token: string | null) {
  if (!postId || !token) {
    return { videoSourceUrl: null, thumbnailUrl: null };
  }
  try {
    const isCompositePost = postId.includes("_");
    const fields = isCompositePost ? "full_picture" : "source,picture";
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}?fields=${fields}&access_token=${token}`,
      { signal: AbortSignal.timeout(4500), next: { revalidate: 300 } }
    );
    if (!res.ok) return { videoSourceUrl: null, thumbnailUrl: null };
    const data = await res.json();
    return {
      videoSourceUrl: data.source || null,
      thumbnailUrl: data.picture || data.full_picture || null,
    };
  } catch {
    return { videoSourceUrl: null, thumbnailUrl: null };
  }
}

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

  let pageToken: string | null = null;
  try {
    const creds = await resolvePageToken();
    pageToken = creds.token;
  } catch {}

  const mediaResults = await Promise.all(
    recentPublished.map((item) => fetchFacebookMediaForPost(item.facebookPostId, pageToken))
  );

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

  const formattedPublished = recentPublished.map((item, idx) => ({
    id: item.id,
    title: item.title,
    type: String(item.type || "NEWS"),
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    facebookPostId: item.facebookPostId || null,
    aiReasoning: item.aiReasoning || null,
    videoSourceUrl: mediaResults[idx]?.videoSourceUrl || null,
    thumbnailUrl: mediaResults[idx]?.thumbnailUrl || null,
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
            Tüm sistem 7/24 otomatiktir. Paylaşılan Reels videolarını doğrudan panelden izleyebilir, Trabzonspor ve Trabzon yöresine ait günün en trend videolarını takip edebilirsiniz.
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
