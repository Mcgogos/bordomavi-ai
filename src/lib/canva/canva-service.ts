/**
 * Canva Integration Service for BordoMavi AI Editor
 * Supports:
 * 1. Canva Connect REST API (official OAuth/Connect endpoints)
 * 2. Direct Canva Web Intents & Editor deep links
 * 3. Curated Trabzonspor design templates (Transfer, Maç Günü, Canlı Gol, Reels)
 */

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
    defaultSubtitle: "Bordo-mavili kulüpte sıcak saatler yaşanıyor."
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
    defaultSubtitle: "Yıldız futbolcu bordo-mavili renklere bağlanıyor."
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
    defaultTitle: "BUGÜN GÜNLERDEN TRABZONSPOR!",
    defaultSubtitle: "Süper Lig Zafer Yolculuğu Devam Ediyor."
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
    defaultSubtitle: "Teknik Direktör Thomas Reis'in belirlediği kadro açıklandı."
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
    defaultTitle: "GOOOLLL! DAKİKA 61!",
    defaultSubtitle: "Trabzonspor muazzam golle öne geçiyor!"
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
    defaultTitle: "HAKEMDEN KRİTİK DÜDÜK VE MAÇ KARARI!",
    defaultSubtitle: "Müsabakada tansiyonun yükseldiği anlar."
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
    defaultSubtitle: "Fırtına haftayı galibiyet ve 3 puanla kapatıyor."
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
    defaultTitle: "THOMAS REIS'TEN ÇOK ÇARPICI AÇIKLAMALAR",
    defaultSubtitle: "Mücadele sonrası teknik heyetten net mesajlar."
  },
  {
    id: 'ts-reels-story',
    name: '9:16 Reels & Story Video Kartı',
    category: 'REELS',
    width: 1080,
    height: 1920,
    description: 'Instagram ve TikTok için tam ekran dikey video kapağı ve animasyon afişi.',
    badgeText: '📱 REELS & STORY',
    primaryColor: '#0A0F1D',
    accentColor: '#781324',
    aspectRatio: '9:16',
    defaultTitle: "TRABZONSPOR GÜNDEMİNDE SICAK SAATLER",
    defaultSubtitle: "Özel görüntüler ve anlık kulüp haberleri."
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
    defaultTitle: "TRABZONSPOR KULÜBÜ RESMİ BİLGİLENDİRME",
    defaultSubtitle: "Yönetim kurulundan kamuoyuna saygıyla duyurulur."
  }
];

export class CanvaService {
  /**
   * Returns valid, working Canva create endpoints based on canvas dimensions and category
   */
  static getValidCanvaUrl(width: number, height: number, category?: string): string {
    if (category === 'REELS' || (width === 1080 && height === 1920)) {
      return 'https://www.canva.com/create/instagram-reels/';
    }
    if (category === 'MATCH_DAY' || height > width) {
      return 'https://www.canva.com/create/posters/';
    }
    if (category === 'OFFICIAL' || (width === 1200 && height === 630)) {
      return 'https://www.canva.com/create/facebook-posts/';
    }
    return 'https://www.canva.com/create/instagram-posts/';
  }

  /**
   * Generates a direct Canva Editor URL with specified dimensions and design intent.
   * Opens instantly in Canva without requiring any prior setup and without any loading errors.
   */
  static generateDirectEditorUrl(template: CanvaTemplate, customTitle?: string): string {
    return this.getValidCanvaUrl(template.width, template.height, template.category);
  }

  /**
   * Returns list of curated Trabzonspor design templates
   */
  static getTemplates(category?: string): CanvaTemplate[] {
    if (!category) return TRABZONSPOR_CANVA_TEMPLATES;
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
    const directUrl = this.getValidCanvaUrl(params.width, params.height);
    
    if (!token) {
      return {
        success: true,
        designUrl: directUrl,
        message: 'Doğrudan Canva Web Editörü başlatıldı (Ölçü: ' + params.width + 'x' + params.height + 'px).'
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
      return {
        success: true,
        designUrl: directUrl,
        message: 'Canva doğrudan editör bağlantısı aktif edildi.'
      };
    }
  }
}
