import { NextResponse } from 'next/server';
import { analyzePendingNews } from '@/lib/news/news-ai-analyzer';
import { verifyApiAuthorization } from '@/lib/api-auth';

export async function POST(request: Request) {
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized) {
    return authCheck.unauthorizedResponse!;
  }

  try {
    let limit = 10;
    try {
      const body = await request.json();
      if (body && typeof body.limit === 'number') {
        limit = Math.min(Math.max(body.limit, 1), 20); // Sanitize limit between 1 and 20
      }
    } catch {
      // Body might be empty or invalid json, just use default limit
    }

    const result = await analyzePendingNews(limit);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[API] analyze-pending Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
