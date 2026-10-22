import 'dotenv/config';
import { runNewsCollector } from '../src/lib/news/news-collector';
import { analyzePendingNews } from '../src/lib/news/news-ai-analyzer';
import { generateAutomatedContent } from '../src/lib/content/content-generator';
import { checkContentQuality } from '../src/lib/content/content-quality-checker';
import { publishReadyContent } from '../src/lib/content/content-publisher';
import { runAutonomousReelWorkflow } from '../src/lib/reels/reels-publisher';
import { SmartPublisher, PublishingQuotaInfo } from '../src/lib/content/smart-publisher';

/**
 * GitHub Actions `schedule` tetikleri yoğunlukta gecikir veya hiç çalışmaz (günde ~56 planlı tetikten
 * yalnızca birkaçı gerçekleşiyor). Bu nedenle slot dışında başlayan bir çalışma, sıradaki slot
 * en fazla bu kadar dakika uzaktaysa kapanmak yerine slot saatine kadar bekler ve yayını kendisi yapar.
 * Workflow `timeout-minutes` değeri bu süre + yayın süresinden büyük olmalıdır.
 */
const SLOT_WAIT_MAX_MINUTES = Number(process.env.SLOT_WAIT_MAX_MINUTES || 300);

/**
 * 11:00 metin haberi Vercel cron'u tarafından tam saatinde yayınlanır. Aynı anda iki yayın
 * yapılmasını önlemek için bulut işçisi metin slotuna yalnızca bu kadar dakika sonra (yedek olarak) girer.
 */
const TEXT_SLOT_FALLBACK_DELAY_MINUTES = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getHealthyQuota(): Promise<PublishingQuotaInfo> {
  const quota = await SmartPublisher.getPublishingQuota();
  if (quota.error) {
    throw new Error(`Yayın takvimi veritabanından okunamadı: ${quota.error}`);
  }
  return quota;
}

/**
 * Yayın yapılabilir bir slot yoksa ve sıradaki slot yakınsa slot başlangıcına kadar bekler.
 * @returns Bekleme sonrası (veya hemen) yayın denemesi yapılmalıysa true.
 */
async function waitForPublishableSlot(): Promise<boolean> {
  const quota = await getHealthyQuota();

  if (quota.quota > 0 && quota.activeSlotId) {
    if (quota.allowedType === 'TEXT') {
      const sinceStart = SmartPublisher.getMinutesSinceSlotStart(quota.activeSlotId);
      if (sinceStart < TEXT_SLOT_FALLBACK_DELAY_MINUTES) {
        const waitMin = TEXT_SLOT_FALLBACK_DELAY_MINUTES - sinceStart;
        console.log(`⏳ Metin slotu aktif; birincil yayıncıya (Vercel cron) öncelik için ${waitMin} dk bekleniyor...`);
        await sleep(waitMin * 60_000);
      }
    }
    return true;
  }

  const { slot, minutesUntilStart } = SmartPublisher.getNextSlotStart();
  const wakeOffset = slot.type === 'TEXT' ? TEXT_SLOT_FALLBACK_DELAY_MINUTES : 1;
  const waitMinutes = minutesUntilStart + wakeOffset;

  if (waitMinutes > SLOT_WAIT_MAX_MINUTES) {
    console.log(`🔒 ${quota.reason} Sıradaki slot (${slot.timeLabel}) ${minutesUntilStart} dk uzakta; bekleme sınırı (${SLOT_WAIT_MAX_MINUTES} dk) aşıldığı için bu çalışma kapanıyor.`);
    return false;
  }

  console.log(`⏳ ${quota.reason} Sıradaki slot (${slot.timeLabel} ${slot.type}) için ${waitMinutes} dk bekleniyor (GitHub zamanlayıcı gecikmelerine karşı)...`);
  await sleep(waitMinutes * 60_000);
  return true;
}

async function main() {
  console.log('[TRIGGER_WORKFLOW] 🚀 Starting 7/24 Autonomous Workflow...');
  console.log('[ENV_CHECK] DATABASE_URL present:', Boolean(process.env.DATABASE_URL));
  console.log('[ENV_CHECK] FACEBOOK_PAGE_ACCESS_TOKEN present:', Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN));
  console.log('[ENV_CHECK] NVIDIA_API_KEY present:', Boolean(process.env.NVIDIA_API_KEY));
  console.log('[ENV_CHECK] OPENROUTER_API_KEY present:', Boolean(process.env.OPENROUTER_API_KEY));

  // Veritabanı olmadan hiçbir aşama çalışamaz; sessizce "başarılı" görünmek yerine çalışmayı başarısız say.
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL tanımlı değil (GitHub repository secret eksik). Otomatik yayın yapılamaz.');
  }

  const shouldPublish = await waitForPublishableSlot();
  if (!shouldPublish) return;

  console.log('--- 1. COLLECTING FRESH NEWS ---');
  const col = await runNewsCollector();
  console.log('Collection result:', col);

  console.log('--- 2. ANALYZING PENDING NEWS ---');
  const ana = await analyzePendingNews(10);
  console.log('Analysis result:', ana);

  console.log('--- 3. GENERATING AUTOMATED CONTENT ---');
  const gen = await generateAutomatedContent(3);
  console.log('Generation result:', gen);

  console.log('--- 4. CHECKING CONTENT QUALITY ---');
  const q = await checkContentQuality(3);
  console.log('Quality check result:', q);

  console.log('--- 5. CHECKING SCHEDULE QUOTA & PUBLISHING ---');
  const quota = await getHealthyQuota();
  console.log('Active Slot Info:', JSON.stringify(quota, null, 2));

  if (quota.quota > 0 && quota.allowedType === 'TEXT') {
    console.log('📰 11:00 Metin Haberi Slotu Aktif -> Yayınlanıyor...');
    const pub = await publishReadyContent(1, false);
    console.log('Publish result (Text):', pub);
    if (pub.processed < 1) {
      throw new Error(`Metin haberi slotu aktifti ancak yayın yapılamadı: ${JSON.stringify(pub.results ?? pub)}`);
    }
  } else if (quota.quota > 0 && quota.allowedType === 'REELS') {
    console.log(`🎬 ${quota.windowName} Aktif -> Otonom Reels Videosu Üretiliyor & Yayınlanıyor...`);
    const reel = await runAutonomousReelWorkflow({ force: false });
    console.log('Publish result (Reels):', reel);
    if (!reel.success) {
      throw new Error(`Reels slotu aktifti ancak yayın yapılamadı (adım: ${reel.step}): ${reel.error || reel.skippedReason || 'bilinmeyen neden'}`);
    }
  } else {
    console.log('🔒 Takvim Koruması Devrede (Slot Kilitli):', quota.reason);
  }
}

main()
  .then(() => {
    console.log('[TRIGGER_WORKFLOW] ✅ Workflow finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[TRIGGER_WORKFLOW CRITICAL ERROR]', err);
    process.exit(1);
  });
