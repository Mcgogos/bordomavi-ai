import 'dotenv/config';
import { runNewsCollector } from '../src/lib/news/news-collector';
import { analyzePendingNews } from '../src/lib/news/news-ai-analyzer';
import { generateAutomatedContent } from '../src/lib/content/content-generator';
import { checkContentQuality } from '../src/lib/content/content-quality-checker';
import { publishReadyContent } from '../src/lib/content/content-publisher';
import { runAutonomousReelWorkflow } from '../src/lib/reels/reels-publisher';
import { SmartPublisher } from '../src/lib/content/smart-publisher';

async function main() {
  console.log('[TRIGGER_WORKFLOW] 🚀 Starting 7/24 Autonomous Workflow...');
  console.log('[ENV_CHECK] DATABASE_URL present:', Boolean(process.env.DATABASE_URL));
  console.log('[ENV_CHECK] FACEBOOK_PAGE_ACCESS_TOKEN present:', Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN));
  console.log('[ENV_CHECK] NVIDIA_API_KEY present:', Boolean(process.env.NVIDIA_API_KEY));
  console.log('[ENV_CHECK] OPENROUTER_API_KEY present:', Boolean(process.env.OPENROUTER_API_KEY));

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
  const quota = await SmartPublisher.getPublishingQuota();
  console.log('Active Slot Info:', JSON.stringify(quota, null, 2));

  if (quota.quota > 0 && quota.allowedType === 'TEXT') {
    console.log('📰 11:00 Metin Haberi Slotu Aktif -> Yayınlanıyor...');
    const pub = await publishReadyContent(1, false);
    console.log('Publish result (Text):', pub);
  } else if (quota.quota > 0 && quota.allowedType === 'REELS') {
    console.log(`🎬 ${quota.windowName} Aktif -> Otonom Reels Videosu Üretiliyor & Yayınlanıyor...`);
    const reel = await runAutonomousReelWorkflow({ force: false });
    console.log('Publish result (Reels):', reel);
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
