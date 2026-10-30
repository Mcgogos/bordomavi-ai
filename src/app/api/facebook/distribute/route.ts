import { NextResponse } from 'next/server';
import { FacebookService, FollowedOrTargetPage } from '@/services/facebook.service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveFacebookPageMetadata(handleOrUrl: string): Promise<{ handle: string; name: string; fbId?: string }> {
  let clean = handleOrUrl.trim();
  const urlMatch = clean.match(/facebook\.com\/([a-zA-Z0-9._-]+)/i);
  if (urlMatch && urlMatch[1]) {
    clean = urlMatch[1];
  }
  clean = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  if (!clean) return { handle: '', name: '' };

  try {
    const res = await fetch(`https://www.facebook.com/${clean}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(7_000),
    });
    if (res.ok) {
      const html = await res.text();
      const nameMatch = html.match(/"__isProfile":"User","name":"([^"]+)"/);
      const idMatch = html.match(/"selectedID":"([0-9]+)"/) || html.match(/"userID":"([0-9]+)"/);
      if (nameMatch) {
        let decodedName = nameMatch[1];
        try {
          decodedName = JSON.parse(`"${nameMatch[1]}"`);
        } catch {}
        return {
          handle: clean,
          name: decodedName.trim() || clean,
          fbId: idMatch ? idMatch[1] : undefined,
        };
      }
    }
  } catch {}

  return { handle: clean, name: clean };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shouldSync = searchParams.get('sync') !== 'false';
    const { followedPages, connectedPages } = await FacebookService.getFollowedAndConnectedPages(shouldSync);

    const lastLogRow = await prisma.setting.findUnique({
      where: { key: 'LAST_CROSS_SHARE_LOG' },
    });

    let lastCrossShareLog = null;
    if (lastLogRow?.value) {
      try {
        lastCrossShareLog = JSON.parse(lastLogRow.value);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      followedPages: followedPages.map((p) => ({
        name: p.name,
        handle: p.idOrHandle,
        fbId: p.fbId,
        source: p.source || 'facebook_following',
        enabled: true,
      })),
      connectedPages: connectedPages.map((p) => ({
        id: p.id,
        name: p.name,
        username: p.username,
      })),
      lastCrossShareLog,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'sync_from_facebook') {
      const synced = await FacebookService.syncFollowedPagesFromFacebook(true);
      return NextResponse.json({
        success: true,
        followedPages: synced.map((p) => ({
          name: p.name,
          handle: p.idOrHandle,
          fbId: p.fbId,
          source: p.source || 'facebook_following',
          enabled: true,
        })),
      });
    }

    const { followedPages } = await FacebookService.getFollowedAndConnectedPages(false);

    if (action === 'add_page') {
      const rawInput = String(body.handle || body.name || '').trim();
      const tokens = rawInput
        .split(/[\s,;|\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      if (tokens.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Sayfa kullanıcı adı (@handle) veya linki gerekli.' },
          { status: 400 }
        );
      }

      const updated: FollowedOrTargetPage[] = [...followedPages];
      for (const tok of tokens) {
        const meta = await resolveFacebookPageMetadata(tok);
        if (!meta.handle) continue;
        const exists = updated.some(
          (p) => p.idOrHandle.toLowerCase() === meta.handle.toLowerCase()
        );
        if (!exists) {
          updated.push({
            idOrHandle: meta.handle,
            name: meta.name,
            fbId: meta.fbId,
            source: 'manual',
          });
        }
      }

      await FacebookService.saveFollowedPages(updated);
      return NextResponse.json({
        success: true,
        followedPages: updated.map((p) => ({
          name: p.name,
          handle: p.idOrHandle,
          fbId: p.fbId,
          source: p.source || 'manual',
          enabled: true,
        })),
      });
    }

    if (action === 'remove_page') {
      const rawHandle = String(body.handle || '').trim().replace(/^@/, '');
      const updated = followedPages.filter(
        (p) => p.idOrHandle.toLowerCase() !== rawHandle.toLowerCase()
      );
      await FacebookService.saveFollowedPages(updated);
      return NextResponse.json({
        success: true,
        followedPages: updated.map((p) => ({
          name: p.name,
          handle: p.idOrHandle,
          fbId: p.fbId,
          source: p.source,
          enabled: true,
        })),
      });
    }

    if (action === 'distribute_post') {
      const fbPostId = String(body.facebookPostId || '').trim();
      const title = String(body.title || 'BordoMavi Özel Paylaşım').trim();
      const isReel = Boolean(body.isReel);

      if (!fbPostId) {
        return NextResponse.json(
          { success: false, error: 'Paylaşılacak gönderinin Facebook ID bilgisi bulunamadı.' },
          { status: 400 }
        );
      }

      await FacebookService.syncFollowedPagesFromFacebook(true);
      const result = await FacebookService.autoDistributePublishedPost({
        postId: fbPostId,
        isReel,
        caption: title,
      });

      return NextResponse.json({
        success: true,
        result,
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
