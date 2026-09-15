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
      let url = `${GRAPH_API_BASE}/${pageId}/feed`;
      let payload: any = { message, access_token: token };

      if (mediaUrl) {
        url = `${GRAPH_API_BASE}/${pageId}/photos`;
        payload = { caption: message, url: mediaUrl, access_token: token };
      }

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
}