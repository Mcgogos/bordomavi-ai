import MatchdayClient from "./MatchdayClient";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MatchdayPage() {
  const recentNews = await prisma.news.findMany({
    take: 10,
    orderBy: { publishedAt: "desc" },
    include: { source: true }
  });

  return <MatchdayClient initialNews={recentNews} />;
}
