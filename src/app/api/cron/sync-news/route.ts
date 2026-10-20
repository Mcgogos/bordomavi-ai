import { NextResponse } from 'next/server';
import { runNewsCollector } from '@/lib/news/news-collector';
import { analyzePendingNews } from '@/lib/news/news-ai-analyzer';
import { generateAutomatedContent } from '@/lib/content/content-generator';
import { checkContentQuality } from '@/lib/content/content-quality-checker';
import { publishReadyContent, syncPublishedPostsStats } from '@/lib/content/content-publisher';
import { SmartPublisher } from '@/lib/content/smart-publisher';
import { runAutonomousReelWorkflow } from '@/lib/reels/reels-publisher';
import { auth } from '@/lib/auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || request.headers.get('authorization')?.replace('Bearer ', '');

    const expectedSecret = process.env.CRON_SECRET || 'test_secret';

    let isAuthorized = Boolean(expectedSecret && secret === expectedSecret);
    if (!isAuthorized) {
      try {
        const session = await auth();
        if (session?.user) {
          isAuthorized = true;
        }
      } catch {
        // auth session check failed
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log("[CRON] Starting News Sync Workflow (SMART PUBLISH MODE)...");

    // 1. Haberleri Topla
    console.log("[CRON] Phase 1: Collecting news...");
    const collectResult = await runNewsCollector();

    // 2. Bekleyen Haberleri Analiz Et (Max 15)
    console.log("[CRON] Phase 2: Analyzing pending news...");
    const analyzeResult = await analyzePendingNews(15);

    // 3. 65+ Puanlı Kaliteli Haberlerden İçerik Üret (Max 3) — otomatik READY_TO_PUBLISH
    console.log("[CRON] Phase 3: Generating automated content (score >= 65)...");
    const generateResult = await generateAutomatedContent(3);

    // 4. Üretilen İçerikleri Kalite Kontrolünden Geçir (Max 3)
    console.log("[CRON] Phase 4: Checking content quality...");
    const qualityResult = await checkContentQuality(3);

    // 5. KESİN GÜNLÜK YAYIN TAKVİMİ (07:00 Reels, 11:00 Metin Haberi, 15:00 Reels, 20:30 Reels)
    // Bu 4 saat dilimi dışına kesinlikle çıkılmaz!
    const forcePublish = searchParams.get('force') === 'true';
    const forcedSlotType = searchParams.get('slot')?.toUpperCase(); // 'REELS' | 'TEXT'
    const quotaInfo = await SmartPublisher.getPublishingQuota();

    console.log(`[CRON] Phase 5: Schedule Check (${quotaInfo.windowName} | Allowed: ${quotaInfo.allowedType} | Quota: ${quotaInfo.quota} | Force: ${forcePublish})...`);

    let publishResult: any = {
      success: true,
      requested: 0,
      processed: 0,
      failed: 0,
      cooldownActive: quotaInfo.cooldownActive,
      minutesSinceLastPost: quotaInfo.minutesSinceLastPost,
      todayCount: quotaInfo.todayCount,
      reason: quotaInfo.reason,
      results: [] as any[]
    };
    let reelResult: any = null;

    if (forcePublish) {
      if (forcedSlotType === 'REELS') {
        reelResult = await runAutonomousReelWorkflow({ force: true });
      } else {
        publishResult = await publishReadyContent(1, true);
      }
    } else if (quotaInfo.quota > 0 && quotaInfo.allowedType === 'TEXT') {
      // Saat 11:00 -> Metin Haberi Slotu
      console.log("[CRON] 🕚 11:00 Metin Haberi Slotu aktif -> Metin haberi yayınlanıyor...");
      publishResult = await publishReadyContent(1, false);
    } else if (quotaInfo.quota > 0 && quotaInfo.allowedType === 'REELS') {
      // Saat 07:00, 15:00 veya 20:30 -> Reels Slotu
      console.log(`[CRON] 🎬 ${quotaInfo.windowName} aktif -> Otonom Reels videosu üretiliyor ve yayınlanıyor...`);
      try {
        reelResult = await runAutonomousReelWorkflow({ force: false });
        if (reelResult?.success) {
          publishResult.processed = 1;
          publishResult.reason = `${quotaInfo.windowName} kapsamında Reels başarıyla yayınlandı.`;
        }
      } catch (reelErr: any) {
        console.warn("[CRON] Reels slot error:", reelErr.message);
      }
    } else {
      console.log(`[CRON] Phase 5 (LOCKED): ${quotaInfo.reason}`);
    }

    // 6. Canlı Facebook İstatistiklerini Senkronize Et (Son 5 Gönderi)
    console.log("[CRON] Phase 6: Syncing live Facebook statistics for recent posts...");
    const statsResult = await syncPublishedPostsStats(5);

    console.log("[CRON] Workflow completed successfully.");

    return NextResponse.json({
      success: true,
      scheduleSlot: quotaInfo,
      collection: collectResult,
      analysis: {
        requested: analyzeResult.requested,
        processed: analyzeResult.processed,
        failed: analyzeResult.failed
      },
      generation: {
        requested: generateResult.requested,
        processed: generateResult.processed,
        failed: generateResult.failed
      },
      qualityCheck: qualityResult,
      publish: publishResult,
      reelPublish: reelResult,
      statsSync: statsResult
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CRON] Sync News Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
