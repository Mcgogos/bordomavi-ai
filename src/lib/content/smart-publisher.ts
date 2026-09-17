/**
 * Smart Publishing Quota Engine based on Turkey Time (UTC+3)
 * Maximizes engagement based on Hourly Heatmap while strictly protecting
 * the Facebook Page from spam bans or velocity rate limits.
 */

export interface PublishingQuotaInfo {
  hour: number;
  minute: number;
  quota: number;
  windowName: string;
  efficiencyRate: string;
  delayMsBetweenPosts: number;
  reason: string;
}

export class SmartPublisher {
  /**
   * Returns current hour and minute in Turkey Time (Europe/Istanbul)
   */
  static getTurkeyTime(): { hour: number; minute: number } {
    try {
      const nowStr = new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" });
      const turkeyDate = new Date(nowStr);
      return {
        hour: turkeyDate.getHours(),
        minute: turkeyDate.getMinutes()
      };
    } catch {
      // Fallback: UTC + 3
      const now = new Date();
      const utcHour = now.getUTCHours();
      return {
        hour: (utcHour + 3) % 24,
        minute: now.getUTCMinutes()
      };
    }
  }

  /**
   * Calculates the exact publishing quota for the current 30-min cycle
   * Peak hours (19:30 - 23:00): up to 3 posts with safe spacing
   * Noon peak (12:00 - 14:00): 2 posts
   * Morning press (08:30 - 11:00): 2 posts
   * Low/Day: 1 post
   * Night (00:00 - 07:30): 0 posts (spam protection)
   */
  static getPublishingQuota(): PublishingQuotaInfo {
    const { hour, minute } = this.getTurkeyTime();
    const timeDecimal = hour + minute / 60;

    // 1. Akşam Zirvesi & Maç Saatleri (19:30 - 23:00) -> 3 Paylaşım
    if (timeDecimal >= 19.5 && timeDecimal < 23.0) {
      return {
        hour,
        minute,
        quota: 3,
        windowName: "Akşam Zirvesi & Maç Saatleri (19:30 - 23:00)",
        efficiencyRate: "Çok Yüksek (%98)",
        delayMsBetweenPosts: 3500,
        reason: "İş/okul çıkışı ve maç akşamları en yoğun Facebook trafiği. Güvenli aralıkla 3 içerik yayınlanıyor."
      };
    }

    // 2. Öğle Molası (12:00 - 14:00) -> 2 Paylaşım
    if (timeDecimal >= 12.0 && timeDecimal < 14.0) {
      return {
        hour,
        minute,
        quota: 2,
        windowName: "Öğle Molası (12:00 - 14:00)",
        efficiencyRate: "Yüksek (%85)",
        delayMsBetweenPosts: 3000,
        reason: "Öğle arası mobil internet kullanımı yüksek. 2 kaliteli içerik yayınlanıyor."
      };
    }

    // 3. Sabah Gazeteleri & İlk Manşetler (08:30 - 11:00) -> 2 Paylaşım
    if (timeDecimal >= 8.5 && timeDecimal < 11.0) {
      return {
        hour,
        minute,
        quota: 2,
        windowName: "Sabah Gazeteleri & İlk Manşetler (08:30 - 11:00)",
        efficiencyRate: "İyi (%75)",
        delayMsBetweenPosts: 3000,
        reason: "Günün ilk transfer ve antrenman haberleri için 2 içerik yayınlanıyor."
      };
    }

    // 4. Gece Uyku Modu (00:00 - 07:30) -> 0 Paylaşım (Spam & Algoritma Koruma)
    if (timeDecimal >= 0.0 && timeDecimal < 7.5) {
      return {
        hour,
        minute,
        quota: 0,
        windowName: "Gece Uyku Modu (00:00 - 07:30)",
        efficiencyRate: "Düşük (%15)",
        delayMsBetweenPosts: 0,
        reason: "Gece saatlerinde organik erişim düşük olduğundan Facebook algoritmasının sayfayı spama düşürmemesi için yayın ertelenir."
      };
    }

    // 5. Normal Gündüz Pencereleri (14:00 - 19:30 & 07:30 - 08:30) -> 1 Paylaşım
    return {
      hour,
      minute,
      quota: 1,
      windowName: "Normal Gün İçi Penceresi",
      efficiencyRate: "Orta (%60)",
      delayMsBetweenPosts: 0,
      reason: "Standart yayın temposu: 1 adet yüksek kaliteli onaylı içerik."
    };
  }
}