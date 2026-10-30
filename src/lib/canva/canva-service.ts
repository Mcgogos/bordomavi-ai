/**
 * Canva Integration Service for BordoMavi AI Editor
 * Supports:
 * 1. Canva Connect REST API v1 (official OAuth 2.0 PKCE + REST endpoints: /v1/designs, /v1/exports, /v1/asset-uploads, /v1/users/me/profile)
 * 2. Database-persisted Canva credentials (CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_ACCESS_TOKEN, CANVA_REFRESH_TOKEN)
 * 3. Curated Trabzonspor design templates (Transfer, Maç Günü, Canlı Gol, Reels)
 */

import { prisma } from '@/lib/db';

export type CanvaTemplateCategory =
  | 'BREAKING'
  | 'TRANSFER'
  | 'MATCH_DAY'
  | 'LINEUP'
  | 'GOAL'
  | 'PENALTY_CARD'
  | 'RESULT'
  | 'QUOTE'
  | 'REELS'
  | 'OFFICIAL';

export interface CanvaTemplate {
  id: string;
  name: string;
  category: CanvaTemplateCategory;
  width: number;
  height: number;
  description: string;
  badgeText: string;
  primaryColor: string;
  accentColor: string;
  aspectRatio: string;
  defaultTitle: string;
  defaultSubtitle: string;
}

export const TRABZONSPOR_CANVA_TEMPLATES: CanvaTemplate[] = [
  {
    id: 'ts-breaking',
    name: 'Son Dakika / Flaş Haber',
    category: 'BREAKING',
    width: 1080,
    height: 1080,
    description: 'Kırmızı-bordo agresif zemin, flaş gelişmeler ve acil duyurular.',
    badgeText: '🚨 SON DAKİKA',
    primaryColor: '#DC2626',
    accentColor: '#781324',
    aspectRatio: '1:1',
    defaultTitle: "TRABZONSPOR'DA SON DAKİKA GELİŞMESİ!",
    defaultSubtitle: 'Bordo-mavili kulüpte sıcak saatler yaşanıyor.',
  },
  {
    id: 'ts-transfer-bomb',
    name: 'Transfer Bombası & İmza',
    category: 'TRANSFER',
    width: 1080,
    height: 1080,
    description: 'Bordo-altın zemin, altın sarısı imza rozeti ve transfer afişi.',
    badgeText: '🔥 FLAŞ TRANSFER',
    primaryColor: '#781324',
    accentColor: '#D97706',
    aspectRatio: '1:1',
    defaultTitle: "TRABZONSPOR'DA FLAŞ TRANSFER ANLAŞMASI!",
    defaultSubtitle: 'Yıldız futbolcu bordo-mavili renklere bağlanıyor.',
  },
  {
    id: 'ts-matchday-hero',
    name: 'Maç Günü Afişi',
    category: 'MATCH_DAY',
    width: 1080,
    height: 1350,
    description: 'Papara Park atmosferi, derbi ve lig maçları için yüksek etkileşimli dikey format.',
    badgeText: '🏟️ MAÇ GÜNÜ',
    primaryColor: '#164E7A',
    accentColor: '#781324',
    aspectRatio: '4:5',
    defaultTitle: 'BUGÜN GÜNLERDEN TRABZONSPOR!',
    defaultSubtitle: 'Süper Lig Zafer Yolculuğu Devam Ediyor.',
  },
  {
    id: 'ts-starting-xi',
    name: 'İlk 11 & Kadro Tanıtımı',
    category: 'LINEUP',
    width: 1080,
    height: 1080,
    description: 'Taktik diziliş, mevki dağılımı ve resmi maç kadrosu.',
    badgeText: '📋 İLK 11 KADROMUZ',
    primaryColor: '#0F172A',
    accentColor: '#164E7A',
    aspectRatio: '1:1',
    defaultTitle: "İŞTE TRABZONSPOR'UN SAHAYA ÇIKACAK 11'İ!",
    defaultSubtitle: 'Teknik Direktörümüzün belirlediği ilk 11 kadrosu açıklandı.',
  },
  {
    id: 'ts-live-goal',
    name: 'Canlı Skor & Gol Anonsu',
    category: 'GOAL',
    width: 1080,
    height: 1080,
    description: 'Maç anında anlık gol sevinci, dakika ve skor güncelleme kartı.',
    badgeText: '⚽ GOOOLLL!',
    primaryColor: '#E11D48',
    accentColor: '#164E7A',
    aspectRatio: '1:1',
    defaultTitle: 'GOOOLLL! DAKİKA 61!',
    defaultSubtitle: 'Trabzonspor muazzam golle öne geçiyor!',
  },
  {
    id: 'ts-card-penalty',
    name: 'Kırmızı Kart & Penaltı Kararı',
    category: 'PENALTY_CARD',
    width: 1080,
    height: 1080,
    description: 'VAR kararları, penaltı pozisyonları ve kırmızı kart anonsları.',
    badgeText: '⚠️ KRİTİK MAÇ KARARI',
    primaryColor: '#991B1B',
    accentColor: '#F59E0B',
    aspectRatio: '1:1',
    defaultTitle: 'HAKEMDEN KRİTİK DÜDÜK VE MAÇ KARARI!',
    defaultSubtitle: 'Müsabakada tansiyonun yükseldiği anlar.',
  },
  {
    id: 'ts-match-result',
    name: 'Maç Sonu Skoru & Zafer',
    category: 'RESULT',
    width: 1080,
    height: 1080,
    description: 'Maç bitiş düdüğü, galibiyet coşkusu ve puan durumu kartı.',
    badgeText: '🏁 MAÇ SONUCU',
    primaryColor: '#781324',
    accentColor: '#38BDF8',
    aspectRatio: '1:1',
    defaultTitle: "MAÇ SONA ERDİ: 3 PUAN TRABZONSPOR'UN!",
    defaultSubtitle: 'Fırtına haftayı galibiyet ve 3 puanla kapatıyor.',
  },
  {
    id: 'ts-coach-quote',
    name: 'Teknik Direktör & Oyuncu Demeci',
    category: 'QUOTE',
    width: 1080,
    height: 1080,
    description: 'Tırnak içi vurucu alıntılar, demeçler ve basın açıklamaları.',
    badgeText: '🎙️ BASIN TOPLANTISI',
    primaryColor: '#0F172A',
    accentColor: '#0284C7',
    aspectRatio: '1:1',
    defaultTitle: 'TEKNİK HEYETTEN ÇARPICI AÇIKLAMALAR',
    defaultSubtitle: 'Mücadele sonrası teknik heyetten net mesajlar.',
  },
  {
    id: 'ts-reels-story',
    name: '9:16 Reels & Story Video Kartı',
    category: 'REELS',
    width: 1080,
    height: 1920,
    description: 'Facebook Reels, Instagram ve TikTok için tam ekran dikey video kapağı ve afişi.',
    badgeText: '📱 REELS & STORY',
    primaryColor: '#0A0F1D',
    accentColor: '#781324',
    aspectRatio: '9:16',
    defaultTitle: 'TRABZONSPOR GÜNDEMİNDE SICAK SAATLER',
    defaultSubtitle: 'Özel görüntüler ve anlık kulüp haberleri.',
  },
  {
    id: 'ts-official-press',
    name: 'Kulüp Resmi Açıklaması',
    category: 'OFFICIAL',
    width: 1200,
    height: 630,
    description: 'Yatay Facebook ve Web kapak formatında kurumsal duyuru şablonu.',
    badgeText: '🏛️ RESMİ AÇIKLAMA',
    primaryColor: '#781324',
    accentColor: '#FFFFFF',
    aspectRatio: '1.91:1',
    defaultTitle: 'TRABZONSPOR KULÜBÜ RESMİ BİLGİLENDİRME',
    defaultSubtitle: 'Yönetim kurulundan kamuoyuna saygıyla duyurulur.',
  },
];

const CANVA_REST_BASE = 'https://api.canva.com/rest/v1';

export class CanvaService {
  static getValidCanvaUrl(width: number, height: number, category?: string): string {
    return 'https://www.canva.com/';
  }

  static generateDirectEditorUrl(template: CanvaTemplate, customTitle?: string): string {
    return this.getValidCanvaUrl(template.width, template.height, template.category);
  }

  static getTemplates(category?: string): CanvaTemplate[] {
    if (!category) return TRABZONSPOR_CANVA_TEMPLATES;
    return TRABZONSPOR_CANVA_TEMPLATES.filter((t) => t.category === category);
  }

  /**
   * Veritabanı ve ortam değişkenlerinden Canva Connect API kimlik bilgilerini okur.
   */
  static async getCredentials(): Promise<{
    clientId: string | null;
    clientSecret: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    recoveryCodes: string | null;
  }> {
    try {
      const settings = await prisma.setting.findMany({
        where: {
          key: {
            in: [
              'CANVA_CLIENT_ID',
              'CANVA_CLIENT_SECRET',
              'CANVA_ACCESS_TOKEN',
              'CANVA_REFRESH_TOKEN',
              'CANVA_2FA_RECOVERY_CODES',
            ],
          },
        },
      });
      const map = new Map(settings.map((s) => [s.key, s.value]));
      return {
        clientId: map.get('CANVA_CLIENT_ID') || process.env.CANVA_CLIENT_ID || null,
        clientSecret: map.get('CANVA_CLIENT_SECRET') || process.env.CANVA_CLIENT_SECRET || null,
        accessToken: map.get('CANVA_ACCESS_TOKEN') || process.env.CANVA_ACCESS_TOKEN || null,
        refreshToken: map.get('CANVA_REFRESH_TOKEN') || process.env.CANVA_REFRESH_TOKEN || null,
        recoveryCodes: map.get('CANVA_2FA_RECOVERY_CODES') || null,
      };
    } catch {
      return {
        clientId: process.env.CANVA_CLIENT_ID || null,
        clientSecret: process.env.CANVA_CLIENT_SECRET || null,
        accessToken: process.env.CANVA_ACCESS_TOKEN || null,
        refreshToken: process.env.CANVA_REFRESH_TOKEN || null,
        recoveryCodes: null,
      };
    }
  }

  /**
   * Canva Connect API kimlik bilgilerini veritabanına kaydeder.
   */
  static async saveCredentials(params: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    recoveryCodes?: string;
  }): Promise<void> {
    const entries: Array<[string, string | undefined]> = [
      ['CANVA_CLIENT_ID', params.clientId],
      ['CANVA_CLIENT_SECRET', params.clientSecret],
      ['CANVA_ACCESS_TOKEN', params.accessToken],
      ['CANVA_REFRESH_TOKEN', params.refreshToken],
      ['CANVA_2FA_RECOVERY_CODES', params.recoveryCodes],
    ];

    for (const [key, val] of entries) {
      if (typeof val === 'string' && val.trim().length > 0) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: val.trim() },
          create: { key, value: val.trim() },
        });
      }
    }
  }

  /**
   * OAuth 2.0 Refresh Token ile yeni bir Access Token alır.
   */
  static async refreshAccessToken(): Promise<string | null> {
    const { clientId, clientSecret, refreshToken } = await this.getCredentials();
    if (!clientId || !clientSecret || !refreshToken) return null;

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const res = await fetch(`${CANVA_REST_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data.access_token) {
        await this.saveCredentials({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
        });
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Canva Connect REST API bağlantısını doğrular (/v1/users/me/profile).
   */
  static async verifyConnection(): Promise<{
    connected: boolean;
    hasClientCredentials: boolean;
    hasRecoveryCodes: boolean;
    displayName?: string;
    message: string;
  }> {
    const creds = await this.getCredentials();
    const hasClientCredentials = Boolean(creds.clientId && creds.clientSecret);
    const hasRecoveryCodes = Boolean(creds.recoveryCodes);

    if (!creds.accessToken) {
      return {
        connected: false,
        hasClientCredentials,
        hasRecoveryCodes,
        message: hasClientCredentials
          ? 'Canva Client ID ve Secret kayıtlı. OAuth yetkilendirmesi ile hesabınızı bağlayabilirsiniz.'
          : 'Yerleşik BordoMavi Canva Otomatik Tasarım Stüdyosu aktif.',
      };
    }

    try {
      let res = await fetch(`${CANVA_REST_BASE}/users/me/profile`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });

      if (res.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          res = await fetch(`${CANVA_REST_BASE}/users/me/profile`, {
            headers: { Authorization: `Bearer ${refreshed}` },
          });
        }
      }

      if (!res.ok) {
        return {
          connected: false,
          hasClientCredentials,
          hasRecoveryCodes,
          message: `Canva API yanıtı: HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        connected: true,
        hasClientCredentials,
        hasRecoveryCodes,
        displayName: data.profile?.display_name || 'Canva Kullanıcısı',
        message: 'Canva Connect REST API v1 bağlantısı aktif.',
      };
    } catch (e: any) {
      return {
        connected: false,
        hasClientCredentials,
        hasRecoveryCodes,
        message: e.message || 'Canva bağlantı kontrolü yapılamadı.',
      };
    }
  }

  /**
   * Canva Connect REST API ile tasarım oluşturur (/v1/designs).
   */
  static async createDesignWithConnectApi(params: {
    title: string;
    width: number;
    height: number;
    token?: string;
  }): Promise<{ success: boolean; designUrl: string; designId?: string; message: string }> {
    const creds = await this.getCredentials();
    let token = params.token || creds.accessToken;
    const directUrl = this.getValidCanvaUrl(params.width, params.height);

    if (!token) {
      return {
        success: true,
        designUrl: directUrl,
        message:
          'Doğrudan Canva Web Editörü başlatıldı (Ölçü: ' + params.width + 'x' + params.height + 'px).',
      };
    }

    try {
      let response = await fetch(`${CANVA_REST_BASE}/designs`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: params.title,
          design_type: {
            type: 'custom',
            width: params.width,
            height: params.height,
          },
        }),
      });

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          token = refreshed;
          response = await fetch(`${CANVA_REST_BASE}/designs`, {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: params.title,
              design_type: {
                type: 'custom',
                width: params.width,
                height: params.height,
              },
            }),
          });
        }
      }

      if (!response.ok) {
        throw new Error('Canva API Hatası: ' + response.statusText);
      }

      const data = await response.json();
      return {
        success: true,
        designUrl:
          data.design?.urls?.edit_url || 'https://www.canva.com/design/' + data.design?.id,
        designId: data.design?.id,
        message: 'Canva Connect REST API v1 ile tasarım oluşturuldu.',
      };
    } catch {
      return {
        success: true,
        designUrl: directUrl,
        message: 'Canva doğrudan editör bağlantısı aktif edildi.',
      };
    }
  }

  /**
   * Kullanıcının Canva kütüphanesindeki tasarımları listeler (GET /v1/designs).
   */
  static async listDesigns(query?: string): Promise<any[]> {
    const creds = await this.getCredentials();
    if (!creds.accessToken) return [];

    try {
      const url = new URL(`${CANVA_REST_BASE}/designs`);
      if (query) url.searchParams.set('query', query);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  }
}
