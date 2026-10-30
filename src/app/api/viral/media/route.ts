import { NextResponse } from 'next/server';
import { resolvePageToken } from '@/services/facebook.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId')?.trim();

    if (!postId) {
      return NextResponse.json({ success: false, error: 'postId gerekli' }, { status: 400 });
    }

    const { token } = await resolvePageToken();
    const isCompositePost = postId.includes('_');
    const fields = isCompositePost
      ? 'full_picture,permalink_url,message'
      : 'source,picture,permalink_url,description,title';

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}?fields=${fields}&access_token=${token}`,
      {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      }
    );

    const data = await res.json();
    if (data?.error) {
      return NextResponse.json(
        { success: false, error: data.error.message || 'Facebook medya bilgisi alınamadı' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      postId,
      videoSourceUrl: data.source || null,
      thumbnailUrl: data.picture || data.full_picture || null,
      permalinkUrl: data.permalink_url
        ? data.permalink_url.startsWith('http')
          ? data.permalink_url
          : `https://www.facebook.com${data.permalink_url}`
        : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Medya sorgulama hatası' },
      { status: 500 }
    );
  }
}
