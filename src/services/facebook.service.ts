/**
 * FacebookService — BordoMavi AI Editor
 * 
 * SECURITY:
 * - Token is ONLY read from server-side env (FACEBOOK_PAGE_ACCESS_TOKEN)
 * - Token is NEVER logged, returned in responses, or exposed to the client
 * - Token is masked if it appears in error messages
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// In-memory guard to prevent duplicate concurrent publishes
const publishingLock = new Set<string>();

function maskToken(text: string, token: string | undefined): string {
  if (!token || !text) return text;
  return text.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[HIDDEN_TOKEN]');
}

export async function resolvePageToken(): Promise<string> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN tanımlanmamış.");
  if (!pageId) throw new Error("FACEBOOK_PAGE_ID tanımlanmamış.");

  try {
    // Check if token is user or page token by requesting page token
    console.log(`[resolvePageToken] Fetching page token for page ${pageId}`);
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=access_token&access_token=${token}`);
    const data = await res.json();
    
    if (data.access_token) {
      console.log(`[resolvePageToken] Successfully fetched page token.`);
      return data.access_token; // Return the actual page token
    }
    console.log(`[resolvePageToken] No access_token in response:`, JSON.stringify(data));
    return token; // Fallback to provided token if conversion fails or it's already a page token
  } catch (e: any) {
    console.error(`[resolvePageToken] Error fetching page token:`, e.message);
    return token; // If error, try using the original token
  }
}

export function getConfig() {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';

  if (!token) {
    throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN .env dosyasinda bulunamadi. Lutfen ekleyin.');
  }
  if (!pageId) {
    throw new Error('FACEBOOK_PAGE_ID .env dosyasinda bulunamadi.');
  }

  return { token, pageId, isMock };
}

export class FacebookService {
  /**
   * Publish a post to the Facebook Page.
   * Supports text-only or with image (multipart/form-data for localhost URLs).
   * 
   * @param message  Post caption/body
   * @param mediaUrl Optional URL for the image (localhost URLs are downloaded and uploaded as binary)
   * @param lockKey  Unique key to prevent duplicate concurrent publishes (e.g. content DB id)
   */
  static async publishPost(message: string, mediaUrl?: string, lockKey?: string) {
    const startTime = Date.now();

    // --- MOCK MODE ---
    const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';
    if (isMock) {
      console.log('[FacebookService] [MOCK] Publishing in MOCK MODE (FACEBOOK_MOCK_MODE=true)');
      await new Promise(r => setTimeout(r, 800));
      return { success: true, postId: `mock-post-${Date.now()}`, mockMode: true };
    }

    // --- DUPLICATE GUARD ---
    if (lockKey) {
      if (publishingLock.has(lockKey)) {
        throw new Error('Bu icerik zaten yayinlanma surecinde. Lutfen islemin tamamlanmasini bekleyin.');
      }
      publishingLock.add(lockKey);
    }

    let token: string | undefined;
    try {
      const config = getConfig();
      token = await resolvePageToken(); // Gerçek Page Token'ı al
      const { pageId } = config;

      const endpoint = mediaUrl
        ? `${GRAPH_API_BASE}/${pageId}/photos`
        : `${GRAPH_API_BASE}/${pageId}/feed`;

      console.log(`[FacebookService] POST ${endpoint.replace(GRAPH_API_BASE, '')} | mediaUrl: ${mediaUrl ? 'YES' : 'NO'}`);

      let response: Response;

      if (mediaUrl) {
        // Download image first (works for both localhost and remote URLs)
        const imgRes = await fetch(mediaUrl);
        if (!imgRes.ok) {
          throw new Error(`Gorsel indirilemedi: ${imgRes.status} ${imgRes.statusText}`);
        }
        const blob = await imgRes.blob();

        const formData = new FormData();
        formData.append('source', blob, 'bordomavi-post.png');
        formData.append('caption', message);

        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData as any,
        });
      } else {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        });
      }

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      // Structured log (NO TOKEN)
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        operation: 'publishPost',
        pageId: process.env.FACEBOOK_PAGE_ID,
        success: response.ok,
        httpStatus: response.status,
        facebookErrorCode: data.error?.code ?? null,
        responseTimeMs: responseTime,
      }));

      if (!response.ok) {
        const fbCode = data.error?.code;
        const rawMsg = data.error?.message || response.statusText;
        const safeMsg = maskToken(rawMsg, token);

        // Map Facebook error codes to human-readable messages
        const friendlyMessages: Record<number, string> = {
          190: 'Facebook access token gecersiz veya suresi dolmus. Lutfen yeni bir Page Access Token alin.',
          200: 'Yetki hatasi: Sayfa adina yayin yapma izni yok. pages_manage_posts ve pages_read_engagement izinlerini kontrol edin.',
          100: 'Gecersiz parametre. Mesaj icerigi veya gorsel URL kontrol edin.',
          368: 'Bu icerik Facebook politikalarina aykiri oldugu icin paylasilamadi.',
          4:   'Facebook rate limit asildi. Lutfen birkas dakika bekleyin.',
          613: 'Facebook API cagri limiti asildi.',
        };

        const friendlyMsg = fbCode && friendlyMessages[fbCode]
          ? friendlyMessages[fbCode]
          : `Facebook API Hatası (Kod: ${fbCode ?? response.status}): ${safeMsg}`;

        throw new Error(friendlyMsg);
      }

      return {
        success: true,
        postId: data.id,
        mockMode: false,
      };

    } catch (error: any) {
      const safeMsg = maskToken(error.message || 'Bilinmeyen hata', token);
      console.error('[FacebookService] Yayın hatası:', safeMsg);
      throw new Error(safeMsg);
    } finally {
      if (lockKey) publishingLock.delete(lockKey);
    }
  }

  /**
   * Quick config check — does NOT make an API call.
   * Returns token length and mode for admin display.
   */
  static async testConnection() {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';

    if (!pageId || !token) {
      return {
        success: false,
        message: 'Yapılandırma eksik: FACEBOOK_PAGE_ID veya FACEBOOK_PAGE_ACCESS_TOKEN bulunamadı.',
      };
    }

    return {
      success: true,
      message: `Yapılandırma tamam. Page ID: ${pageId} | Mod: ${isMock ? 'MOCK' : 'GERÇEK'} | Token: Yüklü (${token.length} karakter)`,
    };
  }

  /**
   * Live connection test — makes a real API call to verify the token.
   * GET /{PAGE_ID}?fields=id,name
   */
  static async verifyRealConnection() {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    let token: string | undefined;

    try {
      token = await resolvePageToken();
    } catch (e: any) {
      return { success: false, message: e.message };
    }

    if (!pageId || !token) {
      return {
        success: false,
        message: 'FACEBOOK_PAGE_ID veya FACEBOOK_PAGE_ACCESS_TOKEN yapılandırılmamış.',
      };
    }

    const startTime = Date.now();
    try {
      const url = `${GRAPH_API_BASE}/${pageId}?fields=id,name`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        operation: 'verifyRealConnection',
        pageId,
        success: response.ok,
        httpStatus: response.status,
        facebookErrorCode: data.error?.code ?? null,
        responseTimeMs: responseTime,
      }));

      if (!response.ok) {
        const fbCode = data.error?.code;
        const rawMsg = data.error?.message || response.statusText;
        return {
          success: false,
          errorCode: fbCode,
          message: fbCode === 190
            ? 'Token geçersiz veya süresi dolmuş (Kod: 190). Lütfen yeni bir Page Access Token alın.'
            : maskToken(rawMsg, token),
        };
      }

      // Verify we got the right page
      const isCorrectPage = data.id === pageId;
      return {
        success: true,
        pageName: data.name,
        pageId: data.id,
        verified: isCorrectPage,
        message: isCorrectPage
          ? `FACEBOOK CONNECTED ✅ — Sayfa: ${data.name} (ID: ${data.id})`
          : `Bağlantı kuruldu ancak dönen page ID (${data.id}) beklenen değerle eşleşmiyor.`,
      };

    } catch (error: any) {
      return {
        success: false,
        message: maskToken(error.message || 'Bilinmeyen bağlantı hatası', token),
      };
    }
  }
}
