import { NextResponse } from 'next/server';
import { runNewsCollector } from '@/lib/news/news-collector';
import { analyzePendingNews } from '@/lib/news/news-ai-analyzer';
import { generateAutomatedContent } from '@/lib/content/content-generator';
import { checkContentQuality } from '@/lib/content/content-quality-checker';
import { publishReadyContent, syncPublishedPostsStats } from '@/lib/content/content-publisher';
import { SmartPublisher } from '@/lib/content/smart-publisher';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || request.headers.get('authorization')?.replace('Bearer ', '');

    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
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

    // 5. Facebook'ta Yayınla — Algoritmik Pacing (20dk cooldown) & Günlük Tavan (24 post) denetimi
    const forcePublish = searchParams.get('force') === 'true';
    const quotaInfo = await SmartPublisher.getPublishingQuota();
    console.log(`[CRON] Phase 5: Publishing to Facebook (${quotaInfo.windowName} - Kota: ${quotaInfo.quota}, Force: ${forcePublish})...`);
    
    const quotaToUse = forcePublish ? 1 : quotaInfo.quota;
    let publishResult = { success: true, requested: quotaToUse, processed: 0, failed: 0, results: [] as any[] };
    if (quotaToUse > 0) {
      publishResult = await publishReadyContent(quotaToUse, forcePublish);
    } else {
      console.log(`[CRON] Phase 5 (PASSED): ${quotaInfo.reason}`);
    }

    // 6. Canlı Facebook İstatistiklerini Senkronize Et (Son 5 Gönderi)
    console.log("[CRON] Phase 6: Syncing live Facebook statistics for recent posts...");
    const statsResult = await syncPublishedPostsStats(5);

    console.log("[CRON] Workflow completed successfully.");

    return NextResponse.json({
      success: true,
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
      statsSync: statsResult
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CRON] Sync News Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
