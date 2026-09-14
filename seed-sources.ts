import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sources = [
    { name: 'Fotomaç Trabzonspor', url: 'https://www.fotomac.com.tr', rssUrl: 'https://www.fotomac.com.tr/rss/trabzonspor.xml', type: 'NATIONAL', priority: 10, isActive: true },
    { name: 'TRT Spor Trabzonspor', url: 'https://www.trtspor.com.tr', rssUrl: 'https://www.trtspor.com.tr/rss/kategori/trabzonspor.xml', type: 'NATIONAL', priority: 9, isActive: true },
    { name: 'Fanatik Trabzonspor', url: 'https://www.fanatik.com.tr', rssUrl: 'https://www.fanatik.com.tr/rss/trabzonspor', type: 'NATIONAL', priority: 8, isActive: true },
    { name: 'Haber61', url: 'https://www.haber61.net', rssUrl: 'https://www.haber61.net/rss', type: 'LOCAL', priority: 7, isActive: true }
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
