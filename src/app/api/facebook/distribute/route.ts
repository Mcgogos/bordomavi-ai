import { NextResponse } from 'next/server';
import { FacebookService, FollowedOrTargetPage } from '@/services/facebook.service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
      const rawHandle = String(body.handle || body.name || '').trim().replace(/^@/, '');
      const rawName = String(body.name || rawHandle).trim();

      if (!rawHandle) {
        return NextResponse.json(
          { success: false, error: 'Sayfa kullanıcı adı (@handle) veya adı gerekli.' },
          { status: 400 }
        );
      }

      const exists = followedPages.some(
        (p) => p.idOrHandle.toLowerCase() === rawHandle.toLowerCase()
      );
      const updated: FollowedOrTargetPage[] = exists
        ? followedPages
        : [
            ...followedPages,
            {
              idOrHandle: rawHandle,
              name: rawName,
              source: 'manual',
            },
          ];

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
