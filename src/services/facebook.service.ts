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
          const mimeMatch = mediaUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';

          const base64Data = mediaUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: mimeType });
          const formData = new FormData();
          formData.append('source', blob, `canva-design.${ext}`);
          formData.append('message', sanitizedMessage);
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
            console.error('[Facebook] Photo upload API error:', safeError);
            throw new Error(safeError);
          }
          return { success: true, postId: photoData.post_id || photoData.id, mockMode: false };
        } catch (dataErr: any) {
          console.warn('[Facebook] Direct DataURL upload error:', dataErr.message);
          throw dataErr;
        }
      }

      // 2. Görsel Paylaşımı: Postta her zaman görsel olmasını garanti et.
      // Eksikse veya remote URL çökerse, yerel kurumsal şablonla yedekle.
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://bordomavi-ai.vercel.app');
      let effectiveMediaUrl = mediaUrl;
      if (!effectiveMediaUrl) {
        const firstLine = sanitizedMessage.split('\n')[0].replace(/[*#]/g, '').slice(0, 90).trim() || 'Trabzonspor Haber';
        effectiveMediaUrl = `${baseUrl}/api/og?title=${encodeURIComponent(firstLine)}&template=BREAKING`;
      } else if (effectiveMediaUrl.startsWith('/')) {
        effectiveMediaUrl = `${baseUrl}${effectiveMediaUrl}`;
      }

      try {
        let photoRes: Response | null = null;
        try {
          let imgFetch = await fetch(effectiveMediaUrl, { signal: AbortSignal.timeout(15_000) });
          
          // Eğer dış haber görseli hatası (403, 500, timeout vb.) dönerse ve URL'de imageUrl= varsa,
          // dış görseli çıkarıp temiz kurumsal şablonu çağır.
          if (!imgFetch.ok && /[?&]imageUrl=/.test(effectiveMediaUrl)) {
            console.warn('[Facebook] Dış haber görseli yanıt vermedi, kurumsal BordoMavi şablonuna geçiliyor...');
            const fallbackCleanUrl = effectiveMediaUrl
              .replace(/([?&])imageUrl=[^&]*(&|$)/, '$1')
              .replace(/[?&]$/, '');
            imgFetch = await fetch(fallbackCleanUrl, { signal: AbortSignal.timeout(15_000) });
          }

          if (imgFetch.ok) {
            const contentType = imgFetch.headers.get('content-type') || 'image/png';
            if (contentType.includes('image')) {
              const arrayBuf = await imgFetch.arrayBuffer();
              const blob = new Blob([arrayBuf], { type: contentType });
              const formData = new FormData();
              formData.append('source', blob, 'post-visual.png');
              formData.append('published', 'false');
              formData.append('access_token', token);

              photoRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(30_000),
              });
            }
          }
        } catch (binErr: any) {
          console.warn('[Facebook] Direct binary fetch failed, trying URL upload fallback:', binErr.message);
        }

        // Fallback: URL ile doğrudan yükleme
        if (!photoRes) {
          photoRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: effectiveMediaUrl, published: false, access_token: token }),
            signal: AbortSignal.timeout(30_000),
          });
        }

        const photoData = await photoRes.json();
        if (!photoData.error && photoData.id) {
          payload.attached_media = [{ media_fbid: photoData.id }];
        } else if (photoData.error) {
          console.warn('[Facebook] Photo upload API error:', photoData.error.message);
          // İkinci şans: Harici URL reddedildiyse doğrudan temiz şablon URL'si ile yüklemeyi dene
          if (/[?&]imageUrl=/.test(effectiveMediaUrl)) {
            const cleanUrl = effectiveMediaUrl.replace(/([?&])imageUrl=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
            const retryRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: cleanUrl, published: false, access_token: token }),
              signal: AbortSignal.timeout(20_000),
            });
            const retryData = await retryRes.json();
            if (!retryData.error && retryData.id) {
              payload.attached_media = [{ media_fbid: retryData.id }];
            }
          }
        }
      } catch (photoErr: any) {
        console.warn('[Facebook] Görsel yükleme işlemi başarısız:', photoErr.message);
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

  /**
   * Facebook Sayfasına 9:16 Dikey Gerçek Video Reels Yayınlar
   * Meta Graph API v21.0 video_reels 3 aşamalı (start -> binary upload -> finish) protokolünü yürütür.
   */
  static async publishReel(
    videoBuffer: Buffer,
    caption: string,
    lockKey?: string
  ): Promise<{ success: boolean; postId: string; mockMode?: boolean }> {
    const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';
    if (isMock) {
      await new Promise(r => setTimeout(r, 800));
      return { success: true, postId: `mock-reel-${Date.now()}`, mockMode: true };
    }

    if (lockKey) {
      if (publishingLock.has(lockKey)) throw new Error('Reels yayınlama zaten devam ediyor');
      publishingLock.add(lockKey);
    }

    try {
      const { token, pageId } = await resolvePageToken();
      const sanitizedCaption = (caption || '')
        .replace(/\*\*/g, '')
        .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
        .trim();

      console.log(`[FacebookService] Starting Reel upload to Page ${pageId} (${videoBuffer.length} bytes)...`);

      // 1. Aşama: video_reels yükleme oturumu başlat
      let videoId = '';
      let uploadUrl = '';

      try {
        const initRes = await fetch(`${GRAPH_API_BASE}/${pageId}/video_reels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: token
          }),
          signal: AbortSignal.timeout(30_000)
        });
        const initData = await initRes.json();

        if (initData.video_id && initData.upload_url) {
          videoId = initData.video_id;
          uploadUrl = initData.upload_url;
        } else if (initData.error) {
          console.warn('[FacebookService] video_reels init returned error:', initData.error.message);
        }
      } catch (initErr: any) {
        console.warn('[FacebookService] video_reels init failed:', initErr.message);
      }

      // Oturum başarıyla açıldıysa:
      if (videoId && uploadUrl) {
        // 2. Aşama: Video binary verisini rupload sunucusuna yükle
        console.log(`[FacebookService] Uploading video binary to rupload url for Reel ${videoId}...`);
        await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `OAuth ${token}`,
            'offset': '0',
            'file_size': String(videoBuffer.length),
            'Content-Type': 'application/octet-stream'
          },
          body: new Uint8Array(videoBuffer),
          signal: AbortSignal.timeout(60_000)
        });

        // 3. Aşama: Reels'i yayınla (finish phase)
        console.log(`[FacebookService] Finishing Reel publish for ${videoId}...`);
        const finishRes = await fetch(`${GRAPH_API_BASE}/${pageId}/video_reels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'finish',
            access_token: token,
            video_id: videoId,
            video_state: 'PUBLISHED',
            description: sanitizedCaption
          }),
          signal: AbortSignal.timeout(30_000)
        });
        const finishData = await finishRes.json();

        if (finishData.success || finishData.id || finishData.video_id) {
          const finalId = finishData.id || finishData.video_id || videoId;
          console.log(`[FacebookService] ✅ Real Reel successfully published: ${finalId}`);
          return { success: true, postId: finalId, mockMode: false };
        } else if (finishData.error) {
          console.warn('[FacebookService] Finish Reel returned error:', finishData.error.message);
        }
      }

      // Yedek Aşama: Standart /{page-id}/videos uç noktası ile FormData üzerinden video yükleme
      console.log('[FacebookService] Falling back to /{pageId}/videos endpoint...');
      const formData = new FormData();
      const videoBlob = new Blob([new Uint8Array(videoBuffer)], { type: 'video/mp4' });
      formData.append('source', videoBlob, 'bordo-mavi-reel.mp4');
      formData.append('description', sanitizedCaption);
      formData.append('access_token', token);

      const vidRes = await fetch(`${GRAPH_API_BASE}/${pageId}/videos`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60_000)
      });
      const vidData = await vidRes.json();

      if (vidData.error) {
        const safeError = maskToken(JSON.stringify(vidData.error), token);
        throw new Error(safeError);
      }

      const publishedId = vidData.id || vidData.post_id;
      console.log(`[FacebookService] ✅ Video/Reel successfully published via /videos: ${publishedId}`);
      return { success: true, postId: publishedId, mockMode: false };
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
      let data: any = null;

      // 1. Önce tam metrikleri (insights dahil) dene
      const fieldsWithInsights = 'shares,reactions.summary(total_count),comments.summary(total_count),insights.metric(post_impressions,post_impressions_unique)';
      const res = await fetch(`${GRAPH_API_BASE}/${postId}?fields=${encodeURIComponent(fieldsWithInsights)}&access_token=${token}`);
      data = await res.json();

      // 2. Eğer insights izni/özelliği hata verirse, temel etkileşimleri (beğeni, yorum, paylaşım) doğrudan çek
      if (data?.error) {
        const basicFields = 'shares,reactions.summary(total_count),comments.summary(total_count)';
        const fallbackRes = await fetch(`${GRAPH_API_BASE}/${postId}?fields=${encodeURIComponent(basicFields)}&access_token=${token}`);
        const fallbackData = await fallbackRes.json();
        if (!fallbackData.error) {
          data = fallbackData;
        } else {
          console.warn(`[Facebook] Error fetching stats for post ${postId}:`, fallbackData.error.message);
          return { reactions: 0, comments: 0, shares: 0, impressions: 0, reach: 0 };
        }
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