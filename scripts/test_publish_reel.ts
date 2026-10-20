import { prisma } from '../src/lib/db';
import { runAutonomousReelWorkflow } from '../src/lib/reels/reels-publisher';

async function main() {
  console.log('🚀 Starting Autonomous Reel Generation & Publish Workflow...');

  // 1. Inspect all news in DB
  const allNews = await prisma.news.findMany({
    where: {
      isProcessed: true,
      imageUrl: { not: null }
    },
    include: { content: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('--- DB Recent News with Images ---');
  for (const n of allNews) {
    const isReel = n.content?.type === 'REELS_SCRIPT' && n.content?.status === 'PUBLISHED';
    console.log(`[${n.id}] Score: ${n.importanceScore} | Action: ${n.aiRecommendedAction} | ReelPublished: ${isReel} | Title: "${n.title}" | PubDate: ${n.publishedAt}`);
  }

  // Find candidate that is not yet published as Reel
  const availableCandidate = allNews.find(n => !(n.content?.type === 'REELS_SCRIPT' && n.content?.status === 'PUBLISHED'));

  const result = await runAutonomousReelWorkflow({
    force: true,
    targetNewsId: availableCandidate?.id
  });

  console.log('\n================ WORKFLOW RESULT ================');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n🎉 SUCCESS! Facebook Reel Published.`);
    console.log(`📌 News Title: "${result.title}"`);
    console.log(`🔗 Facebook Post ID: ${result.facebookPostId}`);
    console.log(`⏱️ Duration: ${result.durationSeconds}s`);
  } else {
    console.error(`\n❌ Workflow did not publish: ${result.step}`);
    console.error(`Reason: ${result.error || result.skippedReason}`);
  }
}

main()
  .catch(err => {
    console.error('Fatal error running test:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
