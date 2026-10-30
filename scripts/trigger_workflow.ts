import 'dotenv/config';
import { runNewsCollector } from '../src/lib/news/news-collector';
import { analyzePendingNews } from '../src/lib/news/news-ai-analyzer';
import { generateAutomatedContent } from '../src/lib/content/content-generator';
import { checkContentQuality } from '../src/lib/content/content-quality-checker';
import { publishReadyContent } from '../src/lib/content/content-publisher';
import { runAutonomousReelWorkflow } from '../src/lib/reels/reels-publisher';
import { runAutonomousViralReelPublisher } from '../src/lib/viral/viral-publisher';
import { discoverTrendingTrabzonsporVideos } from '../src/lib/viral/viral-video-discoverer';
import { SmartPublisher, PublishingQuotaInfo } from '../src/lib/content/smart-publisher';
import { FacebookService } from '../src/services/facebook.service';

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
 * Slot durumunu kontrol eder. Slot aktifse ve henüz yayınlanmadıysa true döner.
 */
async function checkActiveSlot(): Promise<boolean> {
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

  console.log(`🔒 Takvim Koruması: ${quota.reason} Sıradaki slot: ${quota.nextSlotLabel}.`);
  return false;
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

  // Günlük en trend Trabzonspor videolarını tara ve veritabanında güncel tut (Arayüzde anında görünmesi için)
  try {
    await discoverTrendingTrabzonsporVideos({ limit: 8 });
  } catch (e: any) {
    console.warn('[TRIGGER_WORKFLOW] Viral discovery cache refresh warning:', e.message);
  }

  // BordoMavi (@cafegaa) Facebook sayfasının takip ettiği tüm sayfaları canlı olarak çek ve güncelle
  try {
    const syncedPages = await FacebookService.syncFollowedPagesFromFacebook(true);
    console.log(`[TRIGGER_WORKFLOW] 🔗 Takip edilen ${syncedPages.length} Facebook sayfası otomatik çapraz paylaşım için hazır.`);
  } catch (e: any) {
    console.warn('[TRIGGER_WORKFLOW] Facebook followed pages sync warning:', e.message);
  }

  const shouldPublish = await checkActiveSlot();
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
    console.log(`🎬 ${quota.windowName} (${quota.activeSlotId}) Aktif -> Otonom Reels Motoru Başlatılıyor...`);

    const preferViralFirst = quota.activeSlotId === 'SLOT_1500_REELS' || quota.activeSlotId === 'SLOT_2030_REELS';

    if (preferViralFirst) {
      const preferCategory = quota.activeSlotId === 'SLOT_1500_REELS' ? 'Trabzon Yöresi' : 'Trabzonspor';
      console.log(
        `🔥 1. Aşama: İnternetteki En Trend ${preferCategory} Viral Videosu Taranıyor & Logomuzla İşleniyor...`
      );
      const viralRes = await runAutonomousViralReelPublisher({ preferCategory });
      console.log('Viral Reel result:', viralRes);

      if (viralRes.success) {
        if (quota.activeSlotId) {
          await SmartPublisher.markSlotPublished(quota.activeSlotId, quota.dateKey);
        }
        console.log(`✅ Viral Reels Başarıyla Yayınlandı! FB Post ID: ${viralRes.facebookPostId}`);
      } else {
        console.warn(`⚠️ Viral video motoru tamamlanamadı (${viralRes.error}), Haber Reels motoruna (Fallback) geçiliyor...`);
        const reel = await runAutonomousReelWorkflow({ force: false });
        console.log('Fallback News Reel result:', reel);
        if (!reel.success) {
          throw new Error(`Reels slotu aktifti ancak her iki motorda da yayın yapılamadı: Viral(${viralRes.error}) | Haber(${reel.error || reel.skippedReason})`);
        }
      }
    } else {
      console.log('🎙️ 1. Aşama: Sabah Haber Bülteni Reels Videosu Üretiliyor...');
      const reel = await runAutonomousReelWorkflow({ force: false });
      console.log('News Reel result:', reel);

      if (!reel.success) {
        console.warn(`⚠️ Haber Reels tamamlanamadı (${reel.error || reel.skippedReason}), Viral Video motoruna (Fallback) geçiliyor...`);
        const viralRes = await runAutonomousViralReelPublisher();
        console.log('Fallback Viral Reel result:', viralRes);
        if (viralRes.success && quota.activeSlotId) {
          await SmartPublisher.markSlotPublished(quota.activeSlotId, quota.dateKey);
        } else if (!viralRes.success) {
          throw new Error(`Reels slotu aktifti ancak her iki motorda da yayın yapılamadı: Haber(${reel.error || reel.skippedReason}) | Viral(${viralRes.error})`);
        }
      }
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
