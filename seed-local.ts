import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Önce mevcutlarý silelim ki tertemiz liste olsun
  await prisma.newsSource.deleteMany({})

  const sources = [
    // YEREL BASIN (En Yüksek Öncelik)
    { name: '61 Saat', url: 'https://www.61saat.com', rssUrl: 'https://www.61saat.com/rss', type: 'LOCAL', priority: 100, isActive: true },
    { name: 'Günebakýþ', url: 'https://www.gunebakis.com.tr', rssUrl: 'https://www.gunebakis.com.tr/rss', type: 'LOCAL', priority: 95, isActive: true },
    { name: 'Haber61', url: 'https://www.haber61.net', rssUrl: 'https://www.haber61.net/rss', type: 'LOCAL', priority: 90, isActive: true },
    { name: 'Karadeniz Gazetesi', url: 'https://www.karadenizgazete.com.tr', rssUrl: 'https://www.karadenizgazete.com.tr/rss', type: 'LOCAL', priority: 85, isActive: true },
    { name: 'Kuzey Ekspres', url: 'https://www.kuzeyekspres.com.tr', rssUrl: 'https://www.kuzeyekspres.com.tr/rss', type: 'LOCAL', priority: 80, isActive: true },
    { name: 'Taka Gazete', url: 'https://www.takagazete.com.tr', rssUrl: 'https://www.takagazete.com.tr/rss', type: 'LOCAL', priority: 75, isActive: true },
    
    // ULUSAL BASIN (Düþük Öncelik - Sadece destekleyici olarak)
    { name: 'Fotomaç Trabzonspor', url: 'https://www.fotomac.com.tr', rssUrl: 'https://www.fotomac.com.tr/rss/trabzonspor.xml', type: 'NATIONAL', priority: 50, isActive: true },
    { name: 'TRT Spor Trabzonspor', url: 'https://www.trtspor.com.tr', rssUrl: 'https://www.trtspor.com.tr/rss/kategori/trabzonspor.xml', type: 'NATIONAL', priority: 40, isActive: true },
    { name: 'Fanatik Trabzonspor', url: 'https://www.fanatik.com.tr', rssUrl: 'https://www.fanatik.com.tr/rss/trabzonspor', type: 'NATIONAL', priority: 30, isActive: true }
  ]
  
  for (const source of sources) {
    try {
      await prisma.newsSource.create({ data: source as any })
      console.log('Added:', source.name)
    } catch (e: any) {
      console.error('Failed to add:', source.name, e.message)
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
