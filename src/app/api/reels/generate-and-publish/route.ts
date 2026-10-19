import { NextResponse } from 'next/server';
import { runAutonomousReelWorkflow } from '@/lib/reels/reels-publisher';
import { auth } from '@/lib/auth';

export const maxDuration = 60; // 60s max for Vercel Hobby / Pro
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET || 'test_secret';

    let isAuthorized = Boolean(expectedSecret && secret === expectedSecret);
    if (!isAuthorized) {
      try {
        const session = await auth();
        if (session?.user) isAuthorized = true;
      } catch {}
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let bodyData: any = {};
    try {
      bodyData = await request.json();
    } catch {
      // Body can be empty for automated trigger
    }

    const force = searchParams.get('force') === 'true' || bodyData.force === true;
    const targetNewsId = searchParams.get('newsId') || bodyData.newsId;

    console.log(`[API /api/reels/generate-and-publish] Triggered (force: ${force}, newsId: ${targetNewsId || 'auto'})...`);

    const workflowResult = await runAutonomousReelWorkflow({
      force,
      targetNewsId
    });

    return NextResponse.json({
      success: workflowResult.success,
      data: workflowResult
    }, { status: workflowResult.success ? 200 : (workflowResult.skippedReason ? 200 : 500) });

  } catch (error: any) {
    console.error("[API /api/reels/generate-and-publish] Fatal error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
