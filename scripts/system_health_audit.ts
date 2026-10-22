import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { SmartPublisher } from '../src/lib/content/smart-publisher';
import { deduplicateNewsBatch } from '../src/lib/news/news-similarity-engine';

async function main() {
  console.log('====================================================');
  console.log('🔍 BORDO MAVİ AI - SİSTEM SAĞLIK VE DURUM RAPORU');
  console.log('====================================================');

  // 1. Veritabanı ve Yayın Durumu
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const todayPosts = await prisma.content.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: startOfToday }
    },
    orderBy: { publishedAt: 'asc' },
    select: {
      id: true,
      title: true,
      type: true,
      publishedAt: true,
      facebookPostId: true
    }
  });

  console.log(`\n📌 1. BUGÜN YAYINLANAN PAYLAŞIMLAR (${todayPosts.length}/4 Hedef):`);
  for (const post of todayPosts) {
    const pubTime = post.publishedAt
      ? new Date(post.publishedAt).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
      : '--:--';
    console.log(`   ✅ [${pubTime}] [${post.type}] ID: ${post.facebookPostId} -> "${post.title?.slice(0, 50)}..."`);
  }

  // 2. Takvim ve Slot Kilitleri
  const locks = await prisma.setting.findMany({
    where: { key: { startsWith: `PUBLISHED_SLOT_${SmartPublisher.getTurkeyTime().dateKey}` } }
  });
  console.log(`\n🔒 2. AKTİF SLOT KİLİTLERİ (Mükerrer Paylaşım Koruması):`);
  for (const lock of locks) {
    console.log(`   🔒 ${lock.key} = ${lock.value}`);
  }

  // 3. SmartPublisher Mevcut Kotası
  const quota = await SmartPublisher.getPublishingQuota();
  console.log(`\n⏱️ 3. SMART PUBLISHER DURUMU:`);
  console.log(`   - Şu Anki TR Saati: ${String(quota.hour).padStart(2, '0')}:${String(quota.minute).padStart(2, '0')}`);
  console.log(`   - Pencere Adı: ${quota.windowName}`);
  console.log(`   - İzin Verilen Tip: ${quota.allowedType}`);
  console.log(`   - Kalan Slot Kotası: ${quota.quota}`);
  console.log(`   - Soğuma/Kilit Aktif: ${quota.cooldownActive ? 'EVET' : 'HAYIR'}`);
  console.log(`   - Sıradaki Yayın: ${quota.nextSlotLabel}`);
  console.log(`   - Durum Açıklaması: ${quota.reason}`);

  // 4. Facebook API Doğrulaması (Son paylaşılan Reel ve metin gönderi canlı mı?)
  console.log(`\n🌐 4. FACEBOOK CANLI YAYIN KONTROLÜ:`);
  const pageTokenSetting = await prisma.setting.findUnique({ where: { key: 'FACEBOOK_PAGE_TOKEN' } });
  const token = pageTokenSetting?.value || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.log('   ❌ Facebook token bulunamadı!');
  } else {
    for (const post of todayPosts) {
      if (!post.facebookPostId) continue;
      try {
        const fbRes = await fetch(`https://graph.facebook.com/v21.0/${post.facebookPostId}?fields=id,created_time&access_token=${token}`);
        const fbData = await fbRes.json();
        if (fbData.error) {
          console.log(`   ⚠️ Post ID ${post.facebookPostId}: Facebook API uyarısı (${fbData.error.message})`);
        } else {
          console.log(`   ✅ Post ID ${post.facebookPostId}: Facebook'ta AKTİF ve YAYINDA (Yayına Giriş: ${fbData.created_time})`);
        }
      } catch (err: any) {
        console.log(`   ⚠️ Post ID ${post.facebookPostId}: Ağ kontrolü hatası (${err.message})`);
      }
    }
  }

  // 5. 20:30 Akşam Prime-Time Reels Bülteni için Aday Haber Havuzu
  console.log(`\n📰 5. 20:30 REELS BÜLTENİ İÇİN ADAY HABER HAVUZU:`);
  const candidateLookback = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const candidates = await prisma.news.findMany({
    where: {
      isProcessed: true,
      OR: [
        { isTrabzonsporRelated: true },
        { isTrabzonsporRelated: null }
      ],
      aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
      importanceScore: { gte: 70 },
      publishedAt: { gte: candidateLookback },
      imageUrl: { not: null }
    },
    orderBy: [
      { importanceScore: 'desc' },
      { viralScore: 'desc' }
    ],
    take: 10
  });

  const { uniqueNews } = deduplicateNewsBatch(candidates);
  console.log(`   Toplam Kaliteli & Görselli Aday: ${uniqueNews.length}`);
  for (const item of uniqueNews.slice(0, 5)) {
    console.log(`   ⭐ [Puan: ${item.importanceScore}] "${item.title.slice(0, 55)}..." (Görsel: ${item.imageUrl ? 'VAR ✅' : 'YOK ❌'})`);
  }

  console.log('\n====================================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
