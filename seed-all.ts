import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sources = [
    // RESMÝ KURUMLAR (CLUB) - En Yüksek Öncelik
    { name: 'Trabzonspor Resmi Site', url: 'https://www.trabzonspor.org.tr', rssUrl: 'https://www.trabzonspor.org.tr/rss', type: 'CLUB', priority: 100, isActive: true },
    { name: 'TFF (Türkiye Futbol Federasyonu)', url: 'https://www.tff.org', rssUrl: 'https://www.tff.org/rss.aspx', type: 'CLUB', priority: 99, isActive: true },

    // EK YEREL BASIN (Öncekiler 61Saat, Günebakýþ vb. duruyor, eksikleri ekliyoruz)
    { name: 'HaberTS', url: 'https://www.haberts.com', rssUrl: 'https://www.haberts.com/rss', type: 'LOCAL', priority: 89, isActive: true },
    { name: 'Sonnokta Gazetesi', url: 'https://www.gazetesonnokta.com', rssUrl: 'https://www.gazetesonnokta.com/rss', type: 'LOCAL', priority: 88, isActive: true },
    { name: 'Trabzon Haber', url: 'https://www.trabzonhaber.com.tr', rssUrl: 'https://www.trabzonhaber.com.tr/rss', type: 'LOCAL', priority: 87, isActive: true },
    { name: 'Viravira Trabzon', url: 'https://www.viratrabzon.com', rssUrl: 'https://www.viratrabzon.com/rss', type: 'LOCAL', priority: 86, isActive: true },
    
    // ULUSAL SPOR MEDYASI
    { name: 'A Spor Trabzonspor', url: 'https://www.aspor.com.tr', rssUrl: 'https://www.aspor.com.tr/rss/trabzonspor.xml', type: 'NATIONAL', priority: 50, isActive: true },
    { name: 'Sporx Trabzonspor', url: 'https://www.sporx.com', rssUrl: 'https://www.sporx.com/rss/trabzonspor.xml', type: 'NATIONAL', priority: 49, isActive: true },
    { name: 'NTV Spor', url: 'https://www.ntvspor.net', rssUrl: 'https://www.ntvspor.net/rss', type: 'NATIONAL', priority: 48, isActive: true },
    { name: 'BeIN Sports', url: 'https://beinsports.com.tr', rssUrl: 'https://beinsports.com.tr/rss', type: 'NATIONAL', priority: 47, isActive: true },
    { name: 'Sabah Spor', url: 'https://www.sabah.com.tr', rssUrl: 'https://www.sabah.com.tr/rss/spor.xml', type: 'NATIONAL', priority: 46, isActive: true }
  ]
  
  for (const source of sources) {
    const existing = await prisma.newsSource.findFirst({ where: { name: source.name } })
    if (!existing) {
      try {
        await prisma.newsSource.create({ data: source as any })
        console.log('Added:', source.name)
      } catch (e: any) {
        console.error('Failed to add:', source.name, e.message)
      }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
