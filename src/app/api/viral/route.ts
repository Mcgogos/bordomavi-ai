import { NextResponse } from 'next/server';
import { verifyApiAuthorization } from '@/lib/api-auth';
import { discoverTrendingTrabzonsporVideos } from '@/lib/viral/viral-video-discoverer';
import { runAutonomousViralReelPublisher } from '@/lib/viral/viral-publisher';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized && authCheck.unauthorizedResponse) {
    return authCheck.unauthorizedResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(12, Math.max(1, Number(searchParams.get('limit') || 6)));
    const candidates = await discoverTrendingTrabzonsporVideos({ limit });

    return NextResponse.json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e.message || 'Viral videolar taranırken hata oluştu.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized && authCheck.unauthorizedResponse) {
    return authCheck.unauthorizedResponse;
  }

  try {
    let body: { customVideoUrl?: string; customHeadline?: string } = {};
    try {
      body = await request.json();
    } catch {}

    const result = await runAutonomousViralReelPublisher({
      customVideoUrl: body.customVideoUrl,
      customHeadline: body.customHeadline,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e.message || 'Otonom viral Reels yayınlanırken hata oluştu.',
      },
      { status: 500 }
    );
  }
}
