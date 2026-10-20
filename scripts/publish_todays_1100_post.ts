import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { publishReadyContent } from '../src/lib/content/content-publisher';

async function main() {
  console.log('📌 11:00 Metin Haberi için Güncel Trabzonspor İçeriği Hazırlanıyor...');

  const newsItem = await prisma.news.findUnique({
    where: { id: 'cmvgftbz40006upvgblrex5rl' }
  });

  if (!newsItem) {
    throw new Error('Haber bulunamadı');
  }

  const title = "Trabzonspor - Hearts Maçının Hakemi Belli Oldu! Belçikalı Lawrence Visser Düdük Çalacak";
  const body = `UEFA Konferans Ligi ikinci haftasında temsilcimiz Trabzonspor’un sahasında İskoç temsilcisi Hearts ile karşılaşacağı mücadelenin hakem kadrosu UEFA tarafından açıklandı.

Papara Park’ta oynanacak kritik karşılaşmada Belçika Futbol Federasyonu’ndan Lawrence Visser düdük çalacak. Visser’in yardımcılıklarını Ruben Wyns ve Mathias Hillaert üstlenecek. Mücadelede dördüncü hakem olarak Bert Verbeke görev alacak.

Zorlu karşılaşmanın Video Yardımcı Hakem (VAR) koltuğunda ise Jan Boterberg görev yapacak.

Trabzonspor - Hearts mücadelesi 22 Ekim Perşembe günü saat 19.45’te başlayacak. Bordo-Mavili temsilcimize Avrupa arenasındaki bu önemli sınavda başarılar dileriz.`;

  const hashtags = "#Trabzonspor #UECL #Hearts #Fırtına #BordoMavi";

  // Eski bekleyen içerik varsa temizle/güncelle veya yeni oluştur
  const content = await prisma.content.upsert({
    where: { sourceNewsId: newsItem.id },
    create: {
      type: 'NEWS',
      title,
      body,
      hashtags,
      targetAudience: 'ALL_FANS',
      tone: 'OBJECTIVE',
      status: 'READY_TO_PUBLISH',
      qualityScore: 92,
      confidenceScore: 95,
      viralScore: 78,
      newsValueScore: 88,
      sourceNewsId: newsItem.id
    },
    update: {
      type: 'NEWS',
      title,
      body,
      hashtags,
      status: 'READY_TO_PUBLISH',
      qualityScore: 92,
      confidenceScore: 95,
      viralScore: 78,
      newsValueScore: 88,
      updatedAt: new Date()
    }
  });

  console.log(`✅ İçerik oluşturuldu (ID: ${content.id}). Şimdi 11:00 Takvim Yayını yürütülüyor...`);

  const publishResult = await publishReadyContent(1, false);
  console.log('--- YAYIN SONUCU ---');
  console.log(JSON.stringify(publishResult, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
