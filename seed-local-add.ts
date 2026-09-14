import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Eski ulusal kaynaklarin onceligini dusurelim
  await prisma.newsSource.updateMany({
    where: { type: 'NATIONAL' },
    data: { priority: 10 }
  })

  const sources = [
    // YEREL BASIN (En Yüksek Öncelik)
    { name: '61 Saat', url: 'https://www.61saat.com', rssUrl: 'https://www.61saat.com/rss', type: 'LOCAL', priority: 100, isActive: true },
    { name: 'Günebakýþ', url: 'https://www.gunebakis.com.tr', rssUrl: 'https://www.gunebakis.com.tr/rss', type: 'LOCAL', priority: 95, isActive: true },
    { name: 'Haber61', url: 'https://www.haber61.net', rssUrl: 'https://www.haber61.net/rss', type: 'LOCAL', priority: 90, isActive: true },
    { name: 'Karadeniz Gazetesi', url: 'https://www.karadenizgazete.com.tr', rssUrl: 'https://www.karadenizgazete.com.tr/rss', type: 'LOCAL', priority: 85, isActive: true },
    { name: 'Kuzey Ekspres', url: 'https://www.kuzeyekspres.com.tr', rssUrl: 'https://www.kuzeyekspres.com.tr/rss', type: 'LOCAL', priority: 80, isActive: true },
    { name: 'Taka Gazete', url: 'https://www.takagazete.com.tr', rssUrl: 'https://www.takagazete.com.tr/rss', type: 'LOCAL', priority: 75, isActive: true }
  ]
  
  for (const source of sources) {
    // Eger onceden eklendiyse atla
    const existing = await prisma.newsSource.findFirst({ where: { name: source.name } })
    if (!existing) {
      try {
        await prisma.newsSource.create({ data: source as any })
        console.log('Added:', source.name)
      } catch (e: any) {
        console.error('Failed to add:', source.name, e.message)
      }
    } else {
        // Varsa guncelle
        await prisma.newsSource.update({
            where: { id: existing.id },
            data: { priority: source.priority, type: 'LOCAL' }
        })
        console.log('Updated:', source.name)
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
