import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { SmartPublisher } from '../src/lib/content/smart-publisher';

async function main() {
  const quota = await SmartPublisher.getPublishingQuota();
  console.log('--- CURRENT QUOTA INFO ---');
  console.log(JSON.stringify(quota, null, 2));

  const turkeyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  console.log('Turkey Time Now:', turkeyNow.toISOString(), 'Hours:', turkeyNow.getHours(), 'Minutes:', turkeyNow.getMinutes());

  const startOfDay = new Date(turkeyNow);
  startOfDay.setHours(0, 0, 0, 0);

  const postsToday = await prisma.content.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: startOfDay }
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      type: true,
      title: true,
      facebookPostId: true,
      publishedAt: true
    }
  });

  console.log(`--- POSTS PUBLISHED TODAY (${postsToday.length}) ---`);
  console.log(postsToday);
}

main().catch(console.error).finally(() => process.exit(0));
