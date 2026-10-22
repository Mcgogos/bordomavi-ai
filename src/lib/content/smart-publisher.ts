import { prisma } from '@/lib/db';

export type ScheduledSlotType = 'REELS' | 'TEXT' | 'NONE';

export interface DailySlotDefinition {
  id: 'SLOT_0700_REELS' | 'SLOT_1100_TEXT' | 'SLOT_1500_REELS' | 'SLOT_2030_REELS';
  timeLabel: '07:00' | '11:00' | '15:00' | '20:30';
  windowName: string;
  type: 'REELS' | 'TEXT';
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

/**
 * KESİN GÜNLÜK YAYIN TAKVİMİ (Türkiye Saati - Europe/Istanbul)
 * Bu 4 saat dilimi dışına kesinlikle çıkılmaz:
 * - 07:00 -> REELS (07:00 - 10:59 arası günde 1 adet)
 * - 11:00 -> METİN HABERİ (11:00 - 14:59 arası günde 1 adet)
 * - 15:00 -> REELS (15:00 - 20:29 arası günde 1 adet)
 * - 20:30 -> REELS (20:30 - 23:59 arası günde 1 adet)
 */
export const STRICT_DAILY_SCHEDULE: DailySlotDefinition[] = [
  {
    id: 'SLOT_0700_REELS',
    timeLabel: '07:00',
    windowName: '07:00 Sabah Reels Bülteni',
    type: 'REELS',
    startHour: 7,
    startMinute: 0,
    endHour: 10,
    endMinute: 59
  },
  {
    id: 'SLOT_1100_TEXT',
    timeLabel: '11:00',
    windowName: '11:00 Gün Ortası Metin Haberi',
    type: 'TEXT',
    startHour: 11,
    startMinute: 0,
    endHour: 14,
    endMinute: 59
  },
  {
    id: 'SLOT_1500_REELS',
    timeLabel: '15:00',
    windowName: '15:00 Öğleden Sonra Reels Bülteni',
    type: 'REELS',
    startHour: 15,
    startMinute: 0,
    endHour: 20,
    endMinute: 29
  },
  {
    id: 'SLOT_2030_REELS',
    timeLabel: '20:30',
    windowName: '20:30 Akşam Prime-Time Reels Bülteni',
    type: 'REELS',
    startHour: 20,
    startMinute: 30,
    endHour: 23,
    endMinute: 59
  }
];

export interface PublishingQuotaInfo {
  hour: number;
  minute: number;
  dateKey: string;
  quota: number;
  allowedType: ScheduledSlotType;
  activeSlotId?: DailySlotDefinition['id'];
  windowName: string;
  efficiencyRate: string;
  delayMsBetweenPosts: number;
  reason: string;
  cooldownActive?: boolean;
  minutesSinceLastPost?: number;
  todayCount?: number;
  nextSlotLabel?: string;
  /** Veritabanı denetimi başarısız olduysa hata mesajı (Güvenli Hata Modu). */
  error?: string;
}

export class SmartPublisher {
  /**
   * Türkiye saat dilimine (Europe/Istanbul) göre güncel tarih, saat ve dakikayı döndürür.
   */
  static getTurkeyTime(): { hour: number; minute: number; dateKey: string; nowTurkey: Date } {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(now);

      const map: Record<string, string> = {};
      for (const p of parts) {
        map[p.type] = p.value;
      }

      const year = map.year || '2026';
      const month = map.month || '01';
      const day = map.day || '01';
      const hour = parseInt(map.hour || '0', 10) % 24;
      const minute = parseInt(map.minute || '0', 10);
      const dateKey = `${year}-${month}-${day}`;

      const nowStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' });
      return { hour, minute, dateKey, nowTurkey: new Date(nowStr) };
    } catch {
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const trDate = new Date(utcMs + 3 * 3600000);
      const yyyy = trDate.getFullYear();
      const mm = String(trDate.getMonth() + 1).padStart(2, '0');
      const dd = String(trDate.getDate()).padStart(2, '0');
      return {
        hour: trDate.getHours(),
        minute: trDate.getMinutes(),
        dateKey: `${yyyy}-${mm}-${dd}`,
        nowTurkey: trDate
      };
    }
  }

  /**
   * Sıradaki yayın saatini hesaplar.
   */
  static getNextSlotLabel(currentMinutes: number): string {
    for (const slot of STRICT_DAILY_SCHEDULE) {
      const slotStart = slot.startHour * 60 + slot.startMinute;
      if (currentMinutes < slotStart) {
        return `${slot.timeLabel} (${slot.type === 'REELS' ? 'Reels' : 'Metin Haberi'})`;
      }
    }
    return `Yarın 07:00 (Reels)`;
  }

  /**
   * Türkiye saatine göre bir sonraki slotun başlangıcına kalan dakikayı ve slot tanımını döndürür.
   * Gün bittiyse ertesi günün ilk slotu (07:00) hesaplanır.
   */
  static getNextSlotStart(): { slot: DailySlotDefinition; minutesUntilStart: number } {
    const { hour, minute } = this.getTurkeyTime();
    const currentMinutes = hour * 60 + minute;
    for (const slot of STRICT_DAILY_SCHEDULE) {
      const slotStart = slot.startHour * 60 + slot.startMinute;
      if (currentMinutes < slotStart) {
        return { slot, minutesUntilStart: slotStart - currentMinutes };
      }
    }
    const firstSlot = STRICT_DAILY_SCHEDULE[0];
    const firstStart = firstSlot.startHour * 60 + firstSlot.startMinute;
    return { slot: firstSlot, minutesUntilStart: 24 * 60 - currentMinutes + firstStart };
  }

  /**
   * Belirtilen slotun başlangıcından bu yana geçen dakika (slot henüz başlamadıysa negatif).
   */
  static getMinutesSinceSlotStart(slotId: DailySlotDefinition['id']): number {
    const slot = STRICT_DAILY_SCHEDULE.find((s) => s.id === slotId);
    if (!slot) return 0;
    const { hour, minute } = this.getTurkeyTime();
    return hour * 60 + minute - (slot.startHour * 60 + slot.startMinute);
  }

  /**
   * Bir slot yayınlandığında veritabanına kaydeder ki aynı slotta ikinci kez paylaşım yapılmasın.
   */
  static async markSlotPublished(slotId: string, dateKey?: string): Promise<void> {
    try {
      const targetDate = dateKey || this.getTurkeyTime().dateKey;
      const settingKey = `PUBLISHED_SLOT_${targetDate}_${slotId}`;
      await prisma.setting.upsert({
        where: { key: settingKey },
        update: { value: new Date().toISOString() },
        create: { key: settingKey, value: new Date().toISOString() }
      });
    } catch (e: any) {
      console.warn('[SmartPublisher] markSlotPublished warning:', e.message);
    }
  }

  /**
   * Kesin Günlük Yayın Takvimi Denetimi:
   * - 07:00 -> REELS
   * - 11:00 -> TEXT (Metin Haberi)
   * - 15:00 -> REELS
   * - 20:30 -> REELS
   * Bu 4 zaman dilimi dışında kesinlikle paylaşım yapılmaz (quota = 0, allowedType = 'NONE').
   */
  static async getPublishingQuota(): Promise<PublishingQuotaInfo> {
    const { hour, minute, dateKey, nowTurkey } = this.getTurkeyTime();
    const currentMinutes = hour * 60 + minute;
    const nextSlotLabel = this.getNextSlotLabel(currentMinutes);

    try {
      const startOfTodayTurkey = new Date(nowTurkey);
      startOfTodayTurkey.setHours(0, 0, 0, 0);

      const todayPublished = await prisma.content.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: startOfTodayTurkey }
        },
        orderBy: { publishedAt: 'desc' },
        select: { id: true, type: true, publishedAt: true, title: true }
      });

      const todayCount = todayPublished.length;
      const lastPublished = todayPublished[0];
      const minutesSinceLastPost = lastPublished?.publishedAt
        ? Math.floor((Date.now() - new Date(lastPublished.publishedAt).getTime()) / (60 * 1000))
        : 999;

      // Günlük maksimum 4 paylaşım (3 Reels + 1 Metin Haberi)
      const MAX_DAILY_POSTS = 4;
      if (todayCount >= MAX_DAILY_POSTS) {
        return {
          hour,
          minute,
          dateKey,
          quota: 0,
          allowedType: 'NONE',
          windowName: `Günlük Takvim Tamamlandı (${todayCount}/${MAX_DAILY_POSTS})`,
          efficiencyRate: 'Tamamlandı (%100)',
          delayMsBetweenPosts: 0,
          todayCount,
          minutesSinceLastPost,
          nextSlotLabel: 'Yarın 07:00 (Reels)',
          reason: `Günlük 4 paylaşım takvimi (07:00 Reels, 11:00 Metin, 15:00 Reels, 20:30 Reels) bugün için tamamlandı.`
        };
      }

      // Şu anki saatin 4 kesin slottan birinin içinde olup olmadığını kontrol et
      const matchedSlot = STRICT_DAILY_SCHEDULE.find((slot) => {
        const slotStart = slot.startHour * 60 + slot.startMinute;
        const slotEnd = slot.endHour * 60 + slot.endMinute;
        return currentMinutes >= slotStart && currentMinutes <= slotEnd;
      });

      if (!matchedSlot) {
        return {
          hour,
          minute,
          dateKey,
          quota: 0,
          allowedType: 'NONE',
          windowName: `Gece Dinlenme Modu (Saat ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')})`,
          efficiencyRate: 'Kilitli (Takvim Koruma)',
          delayMsBetweenPosts: 0,
          cooldownActive: true,
          todayCount,
          minutesSinceLastPost,
          nextSlotLabel,
          reason: `Kesin Yayın Takvimi aktif (07:00 Reels, 11:00 Metin Haberi, 15:00 Reels, 20:30 Reels). Şu an gece dinlenme penceresindeyiz. Sıradaki yayın: ${nextSlotLabel}.`
        };
      }

      // Bu slot bugün zaten yayınlandı mı kontrol et:
      // 1. Setting tablosundaki kilit (PUBLISHED_SLOT_2026-10-21_SLOT_0700_REELS)
      // 2. todayPublished listesinde bu slot aralığında veya bu tipte yayınlanmış içerik var mı?
      const settingKey = `PUBLISHED_SLOT_${dateKey}_${matchedSlot.id}`;
      const existingSlotLock = await prisma.setting.findUnique({ where: { key: settingKey } });

      const alreadyPublishedInWindow = Boolean(existingSlotLock) || todayPublished.some((item) => {
        if (!item.publishedAt) return false;
        const pubTrStr = new Date(item.publishedAt).toLocaleString('en-US', { timeZone: 'Europe/Istanbul' });
        const pubTr = new Date(pubTrStr);
        const pubMinutes = pubTr.getHours() * 60 + pubTr.getMinutes();
        const slotStart = matchedSlot.startHour * 60 + matchedSlot.startMinute;
        const slotEnd = matchedSlot.endHour * 60 + matchedSlot.endMinute;
        return pubMinutes >= slotStart && pubMinutes <= slotEnd;
      });

      if (alreadyPublishedInWindow) {
        return {
          hour,
          minute,
          dateKey,
          quota: 0,
          allowedType: 'NONE',
          activeSlotId: matchedSlot.id,
          windowName: `${matchedSlot.windowName} (Yayınlandı ✅)`,
          efficiencyRate: 'Tamamlandı',
          delayMsBetweenPosts: 0,
          cooldownActive: true,
          todayCount,
          minutesSinceLastPost,
          nextSlotLabel,
          reason: `${matchedSlot.windowName} dilimine ait paylaşım bugün başarıyla yapıldı. Sıradaki yayın: ${nextSlotLabel}.`
        };
      }

      // Slot aktif ve henüz yayınlanmadı -> Tam 1 adet (matchedSlot.type) yayına izin ver!
      return {
        hour,
        minute,
        dateKey,
        quota: 1,
        allowedType: matchedSlot.type,
        activeSlotId: matchedSlot.id,
        windowName: matchedSlot.windowName,
        efficiencyRate: 'Kesin Takvim (%100)',
        delayMsBetweenPosts: 0,
        todayCount,
        minutesSinceLastPost,
        nextSlotLabel,
        reason: `${matchedSlot.windowName} saati geldi. Otomatik ${matchedSlot.type === 'REELS' ? 'Reels Videosu' : 'Metin Haberi'} yayını onaylandı.`
      };
    } catch (err: any) {
      console.error('[SmartPublisher] Error checking database state:', err);
      return {
        hour,
        minute,
        dateKey,
        quota: 0,
        allowedType: 'NONE',
        windowName: 'Güvenli Hata Modu',
        efficiencyRate: 'Belirsiz',
        delayMsBetweenPosts: 0,
        error: err.message,
        reason: `Veritabanı kontrolünde hata oluştu (${err.message}). Takvim dışına çıkmamak için yayın bekletiliyor.`
      };
    }
  }
}