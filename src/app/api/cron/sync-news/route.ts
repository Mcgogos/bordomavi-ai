import { NextResponse } from 'next/server';
import { runNewsCollector } from '@/lib/news/news-collector';
import { analyzePendingNews } from '@/lib/news/news-ai-analyzer';
import { generateAutomatedContent } from '@/lib/content/content-generator';
import { checkContentQuality } from '@/lib/content/content-quality-checker';
import { publishReadyContent } from '@/lib/content/content-publisher';
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

    // 5. Facebook'ta Yayınla — Saatlik Isı Haritasına göre dinamik akıllı kota (Pik saatlerde 3'e kadar)
    const quotaInfo = SmartPublisher.getPublishingQuota();
    console.log(`[CRON] Phase 5: Publishing to Facebook (${quotaInfo.windowName} - Kota: ${quotaInfo.quota})...`);
    
    let publishResult = { success: true, requested: quotaInfo.quota, processed: 0, failed: 0, results: [] as any[] };
    if (quotaInfo.quota > 0) {
      publishResult = await publishReadyContent(quotaInfo.quota);
    } else {
      console.log(`[CRON] Phase 5: ${quotaInfo.reason}`);
    }

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
      publish: publishResult
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CRON] Sync News Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
