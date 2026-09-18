const { PrismaClient } = require('@prisma/client');
const Parser = require('rss-parser');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env directly
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

// Prefer direct Neon DB URL with connection_limit=1 to prevent connection pool exhaustion
let dbUrl = env.DIRECT_URL || env.DATABASE_URL;
if (!dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=1&connect_timeout=30';
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'BordoMaviAI/1.0 (Newsbot)' }
});

const LOG_FILE = path.join(__dirname, '..', 'autopublish.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (e) {}
}

const TRABZONSPOR_KEYWORDS = [
  'trabzonspor', 'bordo mavi', 'bordo-mavi', 'fırtına', 'papara park',
  'ertuğrul doğan', 'şampiyon trabzon', 'avni aker', 'ugurcan cakir',
  'uğurcan çakır', 'fatih tekke', 'şenol güneş', 'abdullah avcı'
];

function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^\w\sğüşöçığÜŞÖÇİ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function passesKeywordFilter(title, summary, sourceType) {
  if (sourceType === 'CLUB') return true;
  const combined = (title + ' ' + (summary || '')).toLowerCase();
  return TRABZONSPOR_KEYWORDS.some(k => combined.includes(k));
}

function normalizeNewsItem(item) {
  if (!item.title || !item.link) return null;
  const title = item.title.trim();
  const url = item.link.trim();
  let canonicalUrl = url.split('?')[0].split('#')[0];
  if (canonicalUrl.endsWith('/')) canonicalUrl = canonicalUrl.slice(0, -1);
  const normalizedTitle = normalizeTitle(title);
  const contentHash = hashString(normalizedTitle);

  let publishedAt = new Date();
  if (item.isoDate) publishedAt = new Date(item.isoDate);
  else if (item.pubDate) publishedAt = new Date(item.pubDate);
  if (isNaN(publishedAt.getTime())) publishedAt = new Date();

  const externalId = item.guid || item.id || canonicalUrl;

  let imageUrl = null;
  if (item.enclosure && item.enclosure.url && item.enclosure.url.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
    imageUrl = item.enclosure.url;
  } else if (item['content:encoded'] || item.content) {
    const contentToSearch = item['content:encoded'] || item.content;
    const imgMatch = contentToSearch.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) imageUrl = imgMatch[1];
  }

  let summary = item.contentSnippet || item.content || item.summary || null;
  if (summary) {
    summary = summary.replace(/<[^>]*>?/gm, '').trim();
    if (summary.length > 500) summary = summary.substring(0, 500) + '...';
  }

  return { externalId, title, url, canonicalUrl, summary, publishedAt, contentHash, imageUrl };
}

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

function reliableLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.resolve4(hostname, (err, addresses) => {
    if (!err && addresses && addresses.length > 0) {
      if (options && options.all) {
        return callback(null, addresses.map(a => ({ address: a, family: 4 })));
      }
      return callback(null, addresses[0], 4);
    }
    dns.lookup(hostname, options, callback);
  });
}

// ─── Gemini AI via Native HTTPS with Multi-Model Fallback ───────────────────
const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
];

async function callGemini(prompt, apiKey) {
  for (const model of GEMINI_MODELS) {
    try {
      const text = await callGeminiSingle(model, prompt, apiKey);
      if (text && text.trim().length > 0) return text;
    } catch (e) {
      log(`Gemini ${model} hatası (${e.message}), sıradaki modele geçiliyor...`);
    }
  }
  return '';
}

function callGeminiSingle(model, prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      lookup: reliableLookup,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 25000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400 || parsed.error) {
            return reject(new Error(`HTTP ${res.statusCode}: ${parsed.error?.message || 'Error'}`));
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          resolve(text || '');
        } catch (e) {
          resolve('');
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini HTTPS Zaman Aşımı'));
    });

    req.write(postData);
    req.end();
  });
}

// ─── Phase 1: News Collector ────────────────────────────────────────────────
async function collectNews() {
  log('--- Aşama 1: Haber Toplama Başladı ---');

  const trustedSources = [
    { id: "s-haber61", name: "Haber61", rssUrl: "https://www.haber61.net/rss", type: "LOCAL" },
    { id: "s-gunebakis", name: "Günebakış", rssUrl: "https://www.gunebakis.com.tr/rss", type: "LOCAL" },
    { id: "s-61saat", name: "61saat", rssUrl: "https://www.61saat.com/rss", type: "LOCAL" },
    { id: "s-taka", name: "Taka Gazete", rssUrl: "https://www.takagazete.com.tr/rss", type: "LOCAL" },
    { id: "s-kuzey", name: "Kuzey Ekspres", rssUrl: "https://www.kuzeyekspres.com.tr/rss", type: "LOCAL" }
  ];

  let dbDefaultSource = await prisma.newsSource.findFirst({ where: { isActive: true } });
  const defaultSourceId = dbDefaultSource ? dbDefaultSource.id : "cmu4c6z8w0000vf23e20w3nls";

  log(`${trustedSources.length} ana kaynak paralel taranıyor...`);
  const fetchResults = await Promise.allSettled(
    trustedSources.map(async (src) => {
      try {
        const feed = await parser.parseURL(src.rssUrl);
        return { src, items: feed.items || [] };
      } catch (e) {
        return { src, items: [] };
      }
    })
  );

  const candidates = [];
  for (const settled of fetchResults) {
    if (settled.status === 'rejected' || !settled.value?.items) continue;
    const { src, items } = settled.value;
    for (const raw of items) {
      const norm = normalizeNewsItem(raw);
      if (!norm) continue;
      if (!passesKeywordFilter(norm.title, norm.summary, src.type)) continue;
      candidates.push({ norm, sourceId: defaultSourceId });
    }
  }

  if (candidates.length === 0) {
    log('Kaynaklarda yeni haber bulunamadı.');
    return { newItems: 0 };
  }

  const allHashes = candidates.map(c => c.norm.contentHash);
  const existing = await prisma.news.findMany({
    where: { contentHash: { in: allHashes } },
    select: { contentHash: true }
  });
  const existingSet = new Set(existing.map(e => e.contentHash));

  const newItems = candidates.filter(c => !existingSet.has(c.norm.contentHash));
  let insertedCount = 0;

  if (newItems.length > 0) {
    const inserted = await prisma.news.createMany({
      data: newItems.map(({ norm, sourceId }) => ({
        title: norm.title,
        url: norm.url,
        canonicalUrl: norm.canonicalUrl,
        externalId: norm.externalId,
        contentHash: norm.contentHash,
        imageUrl: norm.imageUrl,
        summary: norm.summary,
        publishedAt: norm.publishedAt,
        sourceId,
        isProcessed: false
      })),
      skipDuplicates: true
    });
    insertedCount = inserted.count;
  }

  log(`Haber Toplama Bitti: ${candidates.length} haber tarandı, ${insertedCount} YENİ haber kaydedildi.`);
  return { newItems: insertedCount };
}

// ─── Phase 2: Gemini AI Analysis ───────────────────────────────────────────
async function analyzePendingNews(apiKey, limit = 5) {
  log(`--- Aşama 2: AI Analizi Başladı (Limit: ${limit}) ---`);
  const pending = await prisma.news.findMany({
    where: { isProcessed: false },
    take: limit,
    orderBy: { publishedAt: 'desc' }
  });

  if (pending.length === 0) {
    log('Analiz edilecek bekleyen haber yok.');
    return { processed: 0 };
  }

  log(`${pending.length} bekleyen haber Gemini 3.6 Flash ile analiz ediliyor...`);
  let processed = 0;

  for (const news of pending) {
    try {
      const prompt = `Aşağıdaki haberi Trabzonspor taraftarı perspektifinden analiz et ve SADECE geçerli bir JSON döndür:
Haber Başlığı: ${news.title}
Özet: ${news.summary || ''}

İstenen JSON formatı:
{"isTrabzonsporRelated": true, "importanceScore": 85, "aiRecommendedAction": "CREATE_CONTENT", "aiSummary": "kısa özet"}`;

      const text = await callGemini(prompt, apiKey);
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        await prisma.news.update({ where: { id: news.id }, data: { isProcessed: true, importanceScore: 0 } });
        continue;
      }

      const analysis = JSON.parse(jsonMatch[0]);
      await prisma.news.update({
        where: { id: news.id },
        data: {
          isProcessed: true,
          isTrabzonsporRelated: analysis.isTrabzonsporRelated ?? false,
          importanceScore: analysis.importanceScore ?? 0,
          aiRecommendedAction: analysis.aiRecommendedAction ?? 'IGNORE',
          aiSummary: analysis.aiSummary ?? '',
          aiAnalyzedAt: new Date()
        }
      });
      processed++;
      log(`[Analiz] Puan: ${analysis.importanceScore} | Karar: ${analysis.aiRecommendedAction} | ${news.title.slice(0, 45)}...`);
    } catch (err) {
      log(`Analiz hatası (${news.id}): ${err.message}`);
      await prisma.news.update({ where: { id: news.id }, data: { isProcessed: true, importanceScore: 0 } }).catch(() => {});
    }
  }

  return { processed };
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')
    .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
    .trim();
}

function generateLocalFallback(news) {
  const cleanTitle = cleanText(news.title || '');
  const cleanSummary = cleanText(news.summary || news.aiSummary || '');
  const sourceName = news.source?.name ? `Kaynak: ${news.source.name}` : '';

  const category = (news.category || '').toUpperCase();
  let badge = 'BORDO MAVİ FLAŞ HABER';
  if (category.includes('TRANSFER')) badge = 'BORDO MAVİ TRANSFER GELİŞMESİ';
  else if (category.includes('MATCH')) badge = 'TRABZONSPOR MAÇ GÜNDEMİ';

  const fanQuestions = [
    'Bordo Mavi renklere gönül veren taraftarlarımız bu gelişme hakkında ne düşünüyor? Yorumlarda buluşalım!',
    'Fırtına yeni hedefleri için kenetlenmeye devam ediyor. Sizce bu hamle takımımıza nasıl yansır? Görüşlerinizi yazın!',
    'Bordo-Mavili sevdamızda yaşanan son gelişmeleri sıcağı sıcağına aktarıyoruz. Siz bu durumu nasıl değerlendiriyorsunuz?'
  ];
  const selectedQuestion = fanQuestions[Math.floor(Math.random() * fanQuestions.length)];

  let post = `${badge}\n\n${cleanTitle}\n\n`;
  if (cleanSummary && cleanSummary !== cleanTitle) {
    post += `${cleanSummary}\n\n`;
  }
  if (sourceName) {
    post += `${sourceName}\n\n`;
  }
  post += `${selectedQuestion}\n\n#Trabzonspor #BordoMavi #Fırtına #SüperLig`;
  return cleanText(post);
}

// ─── Phase 3: Content Generation ───────────────────────────────────────────
async function generateContent(apiKey, limit = 3) {
  log('--- Aşama 3: İçerik Üretimi (65+ Puanlı Haberler) ---');
  const candidates = await prisma.news.findMany({
    where: {
      isProcessed: true,
      OR: [
        { isTrabzonsporRelated: true },
        { isTrabzonsporRelated: null }
      ],
      aiRecommendedAction: { in: ['CREATE_CONTENT', 'URGENT'] },
      importanceScore: { gte: 65 },
      content: null
    },
    include: { source: true },
    orderBy: { importanceScore: 'desc' },
    take: limit
  });

  if (candidates.length === 0) {
    log('65+ puanlı yeni içerik adayı bulunamadı.');
    return { generated: 0 };
  }

  log(`${candidates.length} yüksek puanlı haber için Facebook gönderisi hazırlanıyor...`);
  let generated = 0;

  for (const news of candidates) {
    try {
      const prompt = `Trabzonspor taraftar platformu Bordo Mavi için dikkat çekici, heyecanlı bir Facebook gönderisi yaz:

Haber Başlığı: ${cleanText(news.title)}
Kaynak: ${news.source?.name || 'Bordo Mavi'}
Özet: ${cleanText(news.summary || news.aiSummary || '')}

Kurallar:
1. Dikkat çekici, güçlü bir başlıkla başla.
2. 2-3 kısa paragrafta olayı net ve akıcı şekilde özetle.
3. Sonuna Bordo Mavi taraftarlarına hitap eden kısa bir soru veya taraftar yorumu ekle.
4. En alta 3-5 hashtag ekle (#Trabzonspor #BordoMavi vb.).
5. KESİNLİKLE hiçbir yerde markdown yıldız işareti (**, *) KULLANMA.
6. SADECE Facebook'ta yayınlanacak metni yaz. Ekstra açıklama veya JSON ekleme.`;

      let body = '';
      try {
        body = await callGemini(prompt, apiKey);
      } catch (aiErr) {
        log(`AI üretim hatası (${aiErr.message}), kural motoruna geçiliyor...`);
      }

      if (!body || body.trim().length < 30) {
        body = generateLocalFallback(news);
      }

      const finalTitle = cleanText(news.title);
      const finalBody = cleanText(body);

      await prisma.content.create({
        data: {
          title: finalTitle,
          body: finalBody,
          type: (news.aiRecommendedContentType || 'NEWS'),
          status: 'READY_TO_PUBLISH',
          sourceNewsId: news.id
        }
      });
      generated++;
      log(`[İçerik Üretildi] ${finalTitle.slice(0, 45)}... -> READY_TO_PUBLISH`);
    } catch (err) {
      log(`İçerik üretim hatası (${news.id}): ${err.message}`);
    }
  }

  return { generated };
}

function httpsPost(urlStr, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = JSON.stringify(data);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      lookup: reliableLookup,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Facebook HTTPS Zaman Aşımı'));
    });
    req.write(postData);
    req.end();
  });
}

// ─── Phase 4: Facebook Publishing ──────────────────────────────────────────
async function publishToFacebook(limit = 1) {
  log('--- Aşama 4: Facebook Yayınlama Başladı ---');
  const pageTokenSetting = await prisma.setting.findUnique({ where: { key: 'FACEBOOK_PAGE_TOKEN' } });
  const pageIdSetting = await prisma.setting.findUnique({ where: { key: 'FACEBOOK_PAGE_ID' } });

  const token = pageTokenSetting?.value || env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = pageIdSetting?.value || env.FACEBOOK_PAGE_ID;

  if (!token || !pageId) {
    log('HATA: Facebook Token veya Page ID bulunamadı!');
    return { published: 0 };
  }

  const readyItems = await prisma.content.findMany({
    where: {
      status: 'READY_TO_PUBLISH',
      facebookPostId: null,
      OR: [
        { aiReasoning: null },
        { NOT: { aiReasoning: { contains: 'Yayinlama Hatasi' } } },
        { updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }
      ]
    },
    include: { sourceNews: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  if (readyItems.length === 0) {
    log('Yayınlanmaya hazır (READY_TO_PUBLISH) içerik yok.');
    return { published: 0 };
  }

  log(`${readyItems.length} içerik Facebook'a gönderiliyor...`);
  let published = 0;
  const appUrl = 'https://bordomavi-ai.vercel.app';

  for (const item of readyItems) {
    try {
      let payload = { message: cleanText(item.body), access_token: token };

      // Görsel varsa önce gizli yükle, sonra feed'e iliştir (URL GÖRÜNMEZ!)
      if (item.sourceNews?.imageUrl) {
        try {
          const ogImageUrl = `${appUrl}/api/og?title=${encodeURIComponent(item.title)}&imageUrl=${encodeURIComponent(item.sourceNews.imageUrl)}`;
          const photoRes = await httpsPost(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
            url: ogImageUrl,
            published: false,
            access_token: token
          });

          if (photoRes.status === 200 && photoRes.data?.id) {
            payload.attached_media = [{ media_fbid: photoRes.data.id }];
            log(`[Görsel Yüklendi] Photo FBID: ${photoRes.data.id}`);
          } else {
            log(`[Görsel Bildirimi] Sadece metin paylaşılacak: ${JSON.stringify(photoRes.data?.error?.message || photoRes)}`);
          }
        } catch (photoErr) {
          log(`[Görsel Hatası] ${photoErr.message}`);
        }
      }

      const feedRes = await httpsPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, payload);

      if (feedRes.status !== 200 || feedRes.data?.error) {
        throw new Error(JSON.stringify(feedRes.data?.error || feedRes));
      }

      const postId = feedRes.data.post_id || feedRes.data.id;
      await prisma.content.update({
        where: { id: item.id },
        data: {
          status: 'PUBLISHED',
          facebookPostId: postId,
          publishedAt: new Date()
        }
      });
      published++;
      log(`🎉 ✅ [BAŞARILI] Facebook'ta Yayınlandı! Gönderi ID: ${postId}`);
    } catch (err) {
      log(`❌ [YAYINLAMA HATASI] (${item.id}): ${err.message}`);
      const currentReasoning = item.aiReasoning || '';
      const retryCount = (currentReasoning.match(/Yayinlama Hatasi/g) || []).length;
      await prisma.content.update({
        where: { id: item.id },
        data: {
          status: retryCount >= 3 ? 'FAILED' : 'READY_TO_PUBLISH',
          aiReasoning: currentReasoning + `\n[RETRY ${retryCount + 1}/3] Yayinlama Hatasi: ${err.message}`
        }
      }).catch(() => {});
    }
  }

  return { published };
}

// ─── Main Execution ─────────────────────────────────────────────────────────
async function main() {
  log('====================================================');
  log('=== BordoMavi AI Otomatik Yayınlayıcı Başlatıldı ===');
  log('====================================================');

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    log('HATA: GEMINI_API_KEY tanımlanmamış!');
    return;
  }

  try {
    await collectNews();
    await analyzePendingNews(apiKey, 5);
    await generateContent(apiKey, 2);
    await publishToFacebook(1);
    log('=== Otomatik Yayınlama Döngüsü Başarıyla Tamamlandı ===');
  } catch (error) {
    log(`KRİTİK HATA: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
