import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const envSecret = process.env.CRON_SECRET || 'test_secret';

  if (secret !== envSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl =
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bordomavi-ai-editor.netlify.app";

  try {
    const res = await fetch(
      `${appUrl}/.netlify/functions/auto-publish-background?secret=${envSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": envSecret },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data = await res.text();
    return NextResponse.json({ success: true, status: res.status, message: data });
  } catch (e: any) {
    console.error("[EXTERNAL CRON] Trigger error:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
