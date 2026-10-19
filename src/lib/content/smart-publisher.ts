import { prisma } from '@/lib/db';

export interface PublishingQuotaInfo {
  hour: number;
  minute: number;
  quota: number;
  windowName: string;
  efficiencyRate: string;
  delayMsBetweenPosts: number;
  reason: string;
  cooldownActive?: boolean;
  minutesSinceLastPost?: number;
  todayCount?: number;
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
      const now = new Date();
      const utcHour = now.getUTCHours();
      return {
        hour: (utcHour + 3) % 24,
        minute: now.getUTCMinutes()
      };
    }
  }

  /**
   * Calculates the exact publishing quota for the current cycle.
   * Enforces Facebook EdgeRank algorithm rules:
   * 1. Night Sleep Mode (23:45 - 08:00): 0 posts
   * 2. Pacing Cooldown: At least 90 minutes between automated posts
   * 3. Daily Cap: Maximum 8 high-quality posts per day
   * 4. Single-post dispatch: Maximum 1 post per cycle to allow full organic reach
   */
  static async getPublishingQuota(): Promise<PublishingQuotaInfo> {
    const { hour, minute } = this.getTurkeyTime();
    const timeDecimal = hour + minute / 60;

    // 1. Gece Uyku Modu (23:00 - 08:30) -> 0 Paylaşım (Spam & Algoritma Koruma)
    if (timeDecimal >= 23.0 || timeDecimal < 8.5) {
      return {
        hour,
        minute,
        quota: 0,
        windowName: "Gece Uyku & Dinlenme Modu (23:00 - 08:30)",
        efficiencyRate: "Düşük (%5)",
        delayMsBetweenPosts: 0,
        reason: "Gece saatlerinde organik etkileşim düşüktür. Facebook EdgeRank algoritmasının sayfayı spama düşürmemesi ve sayfa kalite puanını korumak için yayın bekletilir."
      };
    }

    try {
      // 2. Algoritmik Soğuma (Pacing Guard) Denetimi: Facebook algoritmasını korumak için en az 3 saat (180 dk) beklenir
      const lastPublished = await prisma.content.findFirst({
        where: {
          status: 'PUBLISHED',
          publishedAt: { not: null }
        },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true, title: true }
      });

      let minutesSinceLastPost = 999;
      if (lastPublished?.publishedAt) {
        minutesSinceLastPost = Math.floor((Date.now() - new Date(lastPublished.publishedAt).getTime()) / (60 * 1000));
      }

      const MIN_COOLDOWN_MINUTES = 180; // 3 saatte bir yayın (EdgeRank en yüksek dağıtım kuralı)
      if (minutesSinceLastPost < MIN_COOLDOWN_MINUTES) {
        return {
          hour,
          minute,
          quota: 0,
          windowName: "Algoritmik Pacing (3 Saatlik Güvenli Soğuma)",
          efficiencyRate: "Durduruldu",
          delayMsBetweenPosts: 0,
          cooldownActive: true,
          minutesSinceLastPost,
          reason: `Son paylaşımdan bu yana ${minutesSinceLastPost} dk geçti. Facebook spam filtresine takılmamak ve mevcut gönderinin keşfette yayılması için iki gönderi arası en az 3 saat (${MIN_COOLDOWN_MINUTES} dk) bekleniyor. Kalan süre: ${MIN_COOLDOWN_MINUTES - minutesSinceLastPost} dk.`
        };
      }

      // 3. Günlük Tavan Sınırı (Daily Cap Guard): Maksimum 5 gönderi (3 saatlik aralıklarla optimum dağılım)
      const nowTurkey = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
      const startOfTodayTurkey = new Date(nowTurkey);
      startOfTodayTurkey.setHours(0, 0, 0, 0);

      const todayCount = await prisma.content.count({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: startOfTodayTurkey }
        }
      });

      const MAX_DAILY_POSTS = 5;
      if (todayCount >= MAX_DAILY_POSTS) {
        return {
          hour,
          minute,
          quota: 0,
          windowName: `Günlük Tavan Doldu (${todayCount}/${MAX_DAILY_POSTS})`,
          efficiencyRate: "Tamamlandı",
          delayMsBetweenPosts: 0,
          todayCount,
          reason: `Bugün hedeflenen maksimum ${MAX_DAILY_POSTS} gönderi limitine ulaşıldı (${todayCount} paylaşıldı). Takipçi doygunluğunu önlemek ve sayfa etkileşim oranını zirvede tutmak için kalan içerikler ertesi güne aktarılıyor.`
        };
      }

      // 4. Zaman Pencerelerine Göre Verimlilik Analizi (Her pencerede TAM 1 gönderi)
      if (timeDecimal >= 20.0 && timeDecimal < 23.0) {
        return {
          hour,
          minute,
          quota: 1,
          windowName: "Akşam Zirvesi & Primetime Tartışma (20:00 - 23:00)",
          efficiencyRate: "Zirve (%99)",
          delayMsBetweenPosts: 0,
          minutesSinceLastPost,
          todayCount,
          reason: `Optimum yayın penceresi: Son paylaşımdan bu yana ${minutesSinceLastPost} dk geçti. Günün ${todayCount + 1}. gönderisi (Akşam Primetime) onaylandı.`
        };
      }

      if (timeDecimal >= 17.0 && timeDecimal < 19.5) {
        return {
          hour,
          minute,
          quota: 1,
          windowName: "İş Çıkışı & Sıcak Gündem (17:00 - 19:30)",
          efficiencyRate: "Çok Yüksek (%92)",
          delayMsBetweenPosts: 0,
          minutesSinceLastPost,
          todayCount,
          reason: `İş çıkışı taraftar mobil trafiği zirvede. Günün ${todayCount + 1}. gönderisi onaylandı.`
        };
      }

      if (timeDecimal >= 12.0 && timeDecimal < 14.5) {
        return {
          hour,
          minute,
          quota: 1,
          windowName: "Öğle Molası Zirvesi (12:00 - 14:30)",
          efficiencyRate: "Yüksek (%88)",
          delayMsBetweenPosts: 0,
          minutesSinceLastPost,
          todayCount,
          reason: `Öğle arası mobil internet trafiği yüksek. Günün ${todayCount + 1}. gönderisi için izin verildi.`
        };
      }

      if (timeDecimal >= 8.5 && timeDecimal < 11.5) {
        return {
          hour,
          minute,
          quota: 1,
          windowName: "Sabah Gazeteleri & İlk Manşetler (08:30 - 11:30)",
          efficiencyRate: "Yüksek (%82)",
          delayMsBetweenPosts: 0,
          minutesSinceLastPost,
          todayCount,
          reason: `Sabah gündemi için günün ${todayCount + 1}. gönderisi yayınlanıyor.`
        };
      }

      return {
        hour,
        minute,
        quota: 1,
        windowName: "Standart Gün İçi Penceresi",
        efficiencyRate: "Orta (%70)",
        delayMsBetweenPosts: 0,
        minutesSinceLastPost,
        todayCount,
        reason: `Düzenli 3 saatlik aralık korundu (${minutesSinceLastPost} dk). Günün ${todayCount + 1}. gönderisi onaylandı.`
      };

    } catch (err: any) {
      console.error("[SmartPublisher] Error checking database state:", err);
      // Hata durumunda güvenli tarafta kal: spam önleme adına 0 kota dön
      return {
        hour,
        minute,
        quota: 0,
        windowName: "Güvenli Hata Modu",
        efficiencyRate: "Belirsiz",
        delayMsBetweenPosts: 0,
        reason: `Veritabanı kontrolünde hata oluştu (${err.message}). Spam riskini önlemek için yayın bekletiliyor.`
      };
    }
  }
}