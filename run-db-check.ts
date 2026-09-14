import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const ready = await prisma.content.findMany({ where: { status: 'READY_TO_PUBLISH' } });
  console.log('READY COUNT:', ready.length);
  if (ready.length > 0) {
    console.log('First Ready:', ready[0].title);
  } else {
    const drafts = await prisma.content.findMany({ where: { status: 'DRAFT' } });
    console.log('DRAFT COUNT:', drafts.length);
    if (drafts.length > 0) {
        await prisma.content.update({
            where: { id: drafts[0].id },
            data: { status: 'READY_TO_PUBLISH' }
        });
        console.log('Updated one draft to READY_TO_PUBLISH');
    } else {
        // Create a dummy one
        const n = await prisma.news.findFirst();
        await prisma.content.create({
            data: {
                type: 'NEWS',
                title: 'Otomatik Yayın Testi',
                body: 'Bu içerik, uçtan uca otomatik yayınlama sistemini test etmek için oluşturulmuştur.',
                hashtags: '#Test #OtomatikYayın',
                status: 'READY_TO_PUBLISH',
                sourceNewsId: n?.id
            }
        });
        console.log('Created a dummy READY_TO_PUBLISH content');
    }
  }
})();
