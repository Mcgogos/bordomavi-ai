import { NextResponse } from 'next/server';
import { runNewsCollector } from '@/lib/news/news-collector';

export async function POST() {
  try {
    const result = await runNewsCollector();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
