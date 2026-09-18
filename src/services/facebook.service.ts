import { prisma } from '@/lib/db';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// In-memory guard to prevent duplicate concurrent publishes
const publishingLock = new Set<string>();

function maskToken(text: string, token: string | undefined): string {
  if (!token || !text) return text;
  return text.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[HIDDEN_TOKEN]');
}

export async function resolvePageToken(): Promise<{ token: string, pageId: string }> {
  // First check database settings
  const pageIdSetting = await prisma.setting.findUnique({ where: { key: 'FACEBOOK_PAGE_ID' } });
  const pageTokenSetting = await prisma.setting.findUnique({ where: { key: 'FACEBOOK_PAGE_TOKEN' } });

  const token = pageTokenSetting?.value || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = pageIdSetting?.value || process.env.FACEBOOK_PAGE_ID;

  if (!token) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN tanimlanmamis.");
  if (!pageId) throw new Error("FACEBOOK_PAGE_ID tanimlanmamis.");

  return { token, pageId };
}

export class FacebookService {
  static async verifyRealConnection() {
    try {
      const { token, pageId } = await resolvePageToken();
      const res = await fetch(`${GRAPH_API_BASE}/${pageId}?fields=id,name,followers_count&access_token=${token}`);
      const data = await res.json();
      
      if (data.error) {
        return { success: false, message: data.error.message };
      }
      return { success: true, pageName: data.name, followers: data.followers_count, pageId: data.id };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  static async publishPost(message: string, mediaUrl?: string, lockKey?: string) {
    const startTime = Date.now();
    const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';
    
    if (isMock) {
      await new Promise(r => setTimeout(r, 800));
      return { success: true, postId: `mock-post-${Date.now()}`, mockMode: true };
    }

    if (lockKey) {
      if (publishingLock.has(lockKey)) throw new Error('Yayinlama zaten devam ediyor');
      publishingLock.add(lockKey);
    }

    try {
      const { token, pageId } = await resolvePageToken();
      const sanitizedMessage = (message || '')
        .replace(/\*\*/g, '')
        .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
        .trim();
      let payload: any = { message: sanitizedMessage, access_token: token };

      // 1. Doğrudan Base64 Data URL paylaşımı (Canva Studio görselini kayıpsız ve doğrudan yükler)
      if (mediaUrl && mediaUrl.startsWith('data:image')) {
        try {
          const base64Data = mediaUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/png' });
          const formData = new FormData();
          formData.append('source', blob, 'canva-design.png');
          formData.append('caption', sanitizedMessage);
          formData.append('access_token', token);

          const photoRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(30_000),
          });
          const photoData = await photoRes.json();
          if (photoData.error) {
            const safeError = maskToken(JSON.stringify(photoData.error), token);
            throw new Error(safeError);
          }
          return { success: true, postId: photoData.post_id || photoData.id, mockMode: false };
        } catch (dataErr: any) {
          console.warn('[Facebook] Direct DataURL upload error:', dataErr.message);
          throw dataErr;
        }
      }

      // 2. İki adımlı URL tabanlı görsel paylaşım: önce gizli yükle, sonra feed'e iliştir.
      if (mediaUrl) {
        try {
          const photoRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: mediaUrl, published: false, access_token: token }),
            signal: AbortSignal.timeout(30_000),
          });
          const photoData = await photoRes.json();
          if (!photoData.error && photoData.id) {
            payload.attached_media = [{ media_fbid: photoData.id }];
          }
        } catch (photoErr: any) {
          console.warn('[Facebook] Görsel upload hatası, sadece metin gönderiliyor:', photoErr.message);
        }
      }

      const url = `${GRAPH_API_BASE}/${pageId}/feed`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        const safeError = maskToken(JSON.stringify(data.error), token);
        throw new Error(safeError);
      }

      return { success: true, postId: data.post_id || data.id, mockMode: false };
    } finally {
      if (lockKey) publishingLock.delete(lockKey);
    }
  }

  static async getPostStats(postId: string): Promise<{
    reactions: number;
    comments: number;
    shares: number;
    impressions: number;
    reach: number;
  }> {
    try {
      const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';
      if (isMock || !postId || postId.startsWith('mock-')) {
        return { reactions: 48, comments: 12, shares: 7, impressions: 1420, reach: 1150 };
      }

      const { token } = await resolvePageToken();
      const fields = 'shares,reactions.summary(total_count),comments.summary(total_count),insights.metric(post_impressions,post_impressions_unique)';
      const res = await fetch(`${GRAPH_API_BASE}/${postId}?fields=${encodeURIComponent(fields)}&access_token=${token}`);
      const data = await res.json();

      if (data.error) {
        console.warn(`[Facebook] Error fetching stats for post ${postId}:`, data.error.message);
        return { reactions: 0, comments: 0, shares: 0, impressions: 0, reach: 0 };
      }

      const reactions = data.reactions?.summary?.total_count || 0;
      const comments = data.comments?.summary?.total_count || 0;
      const shares = data.shares?.count || 0;

      let impressions = 0;
      let reach = 0;
      if (data.insights?.data) {
        for (const item of data.insights.data) {
          if (item.name === 'post_impressions') {
            impressions = item.values?.[0]?.value || 0;
          } else if (item.name === 'post_impressions_unique') {
            reach = item.values?.[0]?.value || 0;
          }
        }
      }

      if (!impressions && (reactions > 0 || comments > 0)) {
        impressions = (reactions + comments + shares) * 25;
        reach = Math.round(impressions * 0.8);
      }

      return { reactions, comments, shares, impressions, reach };
    } catch (err: any) {
      console.warn(`[Facebook] getPostStats error for ${postId}:`, err.message);
      return { reactions: 0, comments: 0, shares: 0, impressions: 0, reach: 0 };
    }
  }
}