/**
 * Canva Integration Service for BordoMavi AI Editor
 * Supports:
 * 1. Canva Connect REST API (official OAuth/Connect endpoints)
 * 2. Direct Canva Web Intents & Editor deep links
 * 3. Curated Trabzonspor design templates (Transfer, Maç Günü, Canlı Gol, Reels)
 */

export interface CanvaTemplate {
  id: string;
  name: string;
  category: 'TRANSFER' | 'MATCH_DAY' | 'GOAL' | 'REELS' | 'OFFICIAL';
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
    id: 'ts-transfer-bomb',
    name: 'Transfer Bombası & İmza Afişi',
    category: 'TRANSFER',
    width: 1080,
    height: 1080,
    description: 'Bordo-mavi zemin, altın sarısı imza rozeti ve futbolcu odaklı kare afiş.',
    badgeText: 'FLAŞ TRANSFER',
    primaryColor: '#781324',
    accentColor: '#D97706',
    aspectRatio: '1:1',
    defaultTitle: 'TRABZONSPOR\'DA FLAŞ TRANSFER ANLAŞMASI!',
    defaultSubtitle: 'Yıldız futbolcu bordo-mavili renklere bağlanıyor.'
  },
  {
    id: 'ts-matchday-hero',
    name: 'Maç Günü Stadyum Afişi',
    category: 'MATCH_DAY',
    width: 1080,
    height: 1350,
    description: 'Papara Park atmosferi, derbi ve lig maçları için yüksek etkileşimli dikey format.',
    badgeText: 'MAÇ GÜNÜ',
    primaryColor: '#164E7A',
    accentColor: '#781324',
    aspectRatio: '4:5',
    defaultTitle: 'BUGÜN GÜNLERDEN TRABZONSPOR!',
    defaultSubtitle: 'Süper Lig • Papara Park • 20:00'
  },
  {
    id: 'ts-live-goal',
    name: 'Canlı Skor & Gol Anonsu',
    category: 'GOAL',
    width: 1080,
    height: 1080,
    description: 'Maç anında anlık gol sevinci ve skor güncelleme kartı.',
    badgeText: 'GOOOLL!',
    primaryColor: '#E11D48',
    accentColor: '#164E7A',
    aspectRatio: '1:1',
    defaultTitle: 'GOOOLLL! DAKİKA 61!',
    defaultSubtitle: 'Trabzonspor öne geçiyor!'
  },
  {
    id: 'ts-reels-story',
    name: '9:16 Reels & Story Video Kartı',
    category: 'REELS',
    width: 1080,
    height: 1920,
    description: 'Instagram ve TikTok için tam ekran dikey video kapağı ve animasyon afişi.',
    badgeText: 'ÖZEL HABER',
    primaryColor: '#0F172A',
    accentColor: '#781324',
    aspectRatio: '9:16',
    defaultTitle: 'TRABZONSPOR GÜNDEMİNDE SICAK SAATLER',
    defaultSubtitle: 'Detaylar ve perde arkası gelişmeleri'
  },
  {
    id: 'ts-official-press',
    name: 'Kulüp Resmi Açıklaması',
    category: 'OFFICIAL',
    width: 1200,
    height: 630,
    description: 'Yatay Facebook ve Web kapak formatında resmi duyuru şablonu.',
    badgeText: 'KAMUOYU DUYURUSU',
    primaryColor: '#781324',
    accentColor: '#FFFFFF',
    aspectRatio: '1.91:1',
    defaultTitle: 'TRABZONSPOR KULÜBÜ RESMİ BİLGİLENDİRME',
    defaultSubtitle: 'Yönetim kurulundan kamuoyuna saygıyla duyurulur.'
  }
];

export class CanvaService {
  /**
   * Generates a direct Canva Editor URL with specified dimensions and design intent.
   * Opens instantly in Canva without requiring any prior setup.
   */
  static generateDirectEditorUrl(template: CanvaTemplate, customTitle?: string): string {
    const encodedTitle = encodeURIComponent(customTitle || template.name);
    return 'https://www.canva.com/design?create=true&width=' + template.width + '&height=' + template.height + '&unit=px&title=' + encodedTitle;
  }

  /**
   * Returns list of curated Trabzonspor design templates
   */
  static getTemplates(category?: string): CanvaTemplate[] {
    if (!category || category === 'ALL') {
      return TRABZONSPOR_CANVA_TEMPLATES;
    }
    return TRABZONSPOR_CANVA_TEMPLATES.filter(t => t.category === category);
  }

  /**
   * Executes Canva Connect REST API call if token is configured
   */
  static async createDesignWithConnectApi(params: {
    title: string;
    width: number;
    height: number;
    token?: string;
  }): Promise<{ success: boolean; designUrl: string; designId?: string; message: string }> {
    const token = params.token || process.env.CANVA_ACCESS_TOKEN;
    
    if (!token) {
      const directUrl = 'https://www.canva.com/design?create=true&width=' + params.width + '&height=' + params.height + '&unit=px&title=' + encodeURIComponent(params.title);
      return {
        success: true,
        designUrl: directUrl,
        message: 'Doğrudan Canva Web Editörü başlatıldı (Tuval: ' + params.width + 'x' + params.height + 'px).'
      };
    }

    try {
      const response = await fetch('https://api.canva.com/rest/v1/designs', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: params.title,
          design_type: {
            type: 'preset',
            name: params.width === 1080 && params.height === 1080 ? 'social_media_post' : 'custom',
            width: params.width,
            height: params.height
          }
        })
      });

      if (!response.ok) {
        throw new Error('Canva API Hatası: ' + response.statusText);
      }

      const data = await response.json();
      return {
        success: true,
        designUrl: data.design?.urls?.edit_url || 'https://www.canva.com/design/' + data.design?.id,
        designId: data.design?.id,
        message: 'Canva Connect API ile tasarım oluşturuldu.'
      };
    } catch {
      const directUrl = 'https://www.canva.com/design?create=true&width=' + params.width + '&height=' + params.height + '&unit=px&title=' + encodeURIComponent(params.title);
      return {
        success: true,
        designUrl: directUrl,
        message: 'Canva doğrudan editör bağlantısı aktif edildi.'
      };
    }
  }
}
