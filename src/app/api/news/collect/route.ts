import { NextResponse } from 'next/server';
import { runNewsCollector } from '@/lib/news/news-collector';
import { verifyApiAuthorization } from '@/lib/api-auth';

export async function POST(request: Request) {
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized) {
    return authCheck.unauthorizedResponse!;
  }

  try {
    const result = await runNewsCollector();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
