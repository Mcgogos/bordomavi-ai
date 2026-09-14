import { NextResponse } from 'next/server';
import { analyzePendingNews } from '@/lib/news/news-ai-analyzer';

export async function POST(request: Request) {
  try {
    let limit = 10;
    try {
      const body = await request.json();
      if (body && typeof body.limit === 'number') {
        limit = body.limit;
      }
    } catch (e) {
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
