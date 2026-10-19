import { prisma } from '../src/lib/db';
import { runAutonomousReelWorkflow } from '../src/lib/reels/reels-publisher';

async function main() {
  console.log('🚀 Starting Test Reel Generation & Publish Workflow...');

  // 1. Find the top candidate news
  const candidates = await prisma.news.findMany({
    where: {
      isProcessed: true,
      imageUrl: { not: null },
      importanceScore: { gte: 70 }
    },
    orderBy: [
      { importanceScore: 'desc' },
      { viralScore: 'desc' },
      { publishedAt: 'desc' }
    ],
    take: 5
  });

  if (candidates.length === 0) {
    console.warn('No candidate news found with score >= 70. Fetching latest available news with image...');
    const fallback = await prisma.news.findFirst({
      where: { imageUrl: { not: null } },
      orderBy: { createdAt: 'desc' }
    });
    if (!fallback) {
      throw new Error('No news found in DB with an image.');
    }
    candidates.push(fallback);
  }

  const selectedNews = candidates[0];
  console.log(`📌 Selected Candidate News: "${selectedNews.title}" (Score: ${selectedNews.importanceScore}, ID: ${selectedNews.id})`);
  console.log(`🖼️ Image: ${selectedNews.imageUrl}`);

  // 2. Trigger the Autonomous Reel Workflow
  console.log('\n⚙️ Executing runAutonomousReelWorkflow (force: true)...');
  const result = await runAutonomousReelWorkflow({
    force: true,
    targetNewsId: selectedNews.id
  });

  console.log('\n================ WORKFLOW RESULT ================');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n🎉 SUCCESS! Facebook Reel Published.`);
    console.log(`🔗 Facebook Post ID: ${result.facebookPostId}`);
    console.log(`⏱️ Duration: ${result.durationSeconds}s`);
  } else {
    console.error(`\n❌ Workflow failed at step: ${result.step}`);
    console.error(`Error: ${result.error || result.skippedReason}`);
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
