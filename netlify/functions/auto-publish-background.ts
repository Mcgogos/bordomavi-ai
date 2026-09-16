import { PrismaClient } from "@prisma/client";

/**
 * NETLIFY BACKGROUND FUNCTION
 * Dosya adındaki "-background" suffix'i Netlify'a bu fonksiyonun
 * 15 dakikaya kadar çalışabileceğini belirtir.
 * URL: /.netlify/functions/auto-publish-background
 */

const prisma = new PrismaClient();

async function callAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function collectNews(appUrl: string) {
  try {
    const res = await fetch(`${appUrl}/api/news/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json();
    console.log("[BG] Haber toplama:", JSON.stringify(data));
    return data;
  } catch (e: any) {
    console.error("[BG] Haber toplama hatası:", e.message);
    return { success: false };
  }
}

async function analyzePending(apiKey: string, limit = 10) {
  const pending = await prisma.news.findMany({
    where: { isProcessed: false },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });

  console.log(`[BG] Analiz edilecek: ${pending.length}`);
  let processed = 0;

  for (const news of pending) {
    try {
      const prompt = `Aşağıdaki haberi analiz et ve SADECE JSON döndür:
Başlık: ${news.title}
Özet: ${news.summary ?? ""}

{"isTrabzonsporRelated":true/false,"importanceScore":0-100,"aiRecommendedAction":"IGNORE"|"MONITOR"|"CREATE_CONTENT"|"URGENT","aiSummary":"kısa özet"}`;

      const text = await callAI(prompt, apiKey);
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) continue;
      const analysis = JSON.parse(jsonMatch[0]);

      await prisma.news.update({
        where: { id: news.id },
        data: {
          isProcessed: true,
          isTrabzonsporRelated: analysis.isTrabzonsporRelated ?? false,
          importanceScore: analysis.importanceScore ?? 0,
          aiRecommendedAction: analysis.aiRecommendedAction ?? "IGNORE",
          aiSummary: analysis.aiSummary ?? "",
          aiAnalyzedAt: new Date(),
        },
      });
      processed++;
    } catch (e: any) {
      try { await prisma.news.update({ where: { id: news.id }, data: { isProcessed: true, importanceScore: 0 } }); } catch {}
      console.error(`[BG] Analiz hatası (${news.id}):`, e.message);
    }
  }
  return { total: pending.length, processed };
}

async function generateContent(apiKey: string, limit = 2) {
  const candidates = await prisma.news.findMany({
    where: {
      isProcessed: true,
      isTrabzonsporRelated: true,
      aiRecommendedAction: { in: ["CREATE_CONTENT", "URGENT"] },
      importanceScore: { gte: 85 },
      content: null,
    },
    include: { source: true },
    orderBy: { importanceScore: "desc" },
    take: limit,
  });

  console.log(`[BG] İçerik üretilecek: ${candidates.length}`);
  let processed = 0;

  for (const news of candidates) {
    try {
      const prompt = `Trabzonspor taraftar sayfası için dikkat çekici Facebook gönderisi yaz:

Haber: ${news.title}
Kaynak: ${news.source?.name ?? ""}
Özet: ${news.summary ?? news.aiSummary ?? ""}

Kurallar: Dikkat çekici başlık, 2-4 paragraf, Bordo Mavi tarzı yorum, 3-5 hashtag. Sadece gönderi metnini yaz.`;

      const body = await callAI(prompt, apiKey);
      if (!body) continue;

      await prisma.content.create({
        data: {
          title: news.title,
          body,
          type: "NEWS",
          status: "READY_TO_PUBLISH",
          sourceNewsId: news.id,
        },
      });
      processed++;
    } catch (e: any) {
      console.error(`[BG] İçerik hatası (${news.id}):`, e.message);
    }
  }
  return { candidates: candidates.length, processed };
}

async function publishToFacebook(appUrl: string, limit = 1) {
  const pageTokenSetting = await prisma.setting.findUnique({ where: { key: "FACEBOOK_PAGE_TOKEN" } });
  const pageIdSetting = await prisma.setting.findUnique({ where: { key: "FACEBOOK_PAGE_ID" } });

  const token = pageTokenSetting?.value ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = pageIdSetting?.value ?? process.env.FACEBOOK_PAGE_ID;

  if (!token || !pageId) {
    console.error("[BG] Facebook token veya Page ID eksik.");
    return { published: 0 };
  }

  const readyItems = await prisma.content.findMany({
    where: {
      status: "READY_TO_PUBLISH",
      facebookPostId: null,
      OR: [
        { aiReasoning: null },
        { NOT: { aiReasoning: { contains: "Yayinlama Hatasi" } } },
        { updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
      ],
    },
    include: { sourceNews: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  console.log(`[BG] Yayınlanacak: ${readyItems.length}`);
  let published = 0;

  for (const item of readyItems) {
    try {
      let payload: any = { message: item.body, access_token: token };

      if (item.sourceNews?.imageUrl) {
        try {
          const ogUrl = `${appUrl}/api/og?title=${encodeURIComponent(item.title)}&imageUrl=${encodeURIComponent(item.sourceNews.imageUrl)}`;
          const photoRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: ogUrl, published: false, access_token: token }),
            signal: AbortSignal.timeout(30_000),
          });
          const photoData = await photoRes.json();
          if (!photoData.error && photoData.id) {
            payload.attached_media = [{ media_fbid: photoData.id }];
          }
        } catch (photoErr: any) {
          console.warn("[BG] Görsel upload hatası:", photoErr.message);
        }
      }

      const feedRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const feedData = await feedRes.json();

      if (feedData.error) throw new Error(JSON.stringify(feedData.error));

      await prisma.content.update({
        where: { id: item.id },
        data: { status: "PUBLISHED", facebookPostId: feedData.post_id ?? feedData.id, publishedAt: new Date() },
      });
      published++;
      console.log(`[BG] ✅ Yayınlandı: ${feedData.post_id ?? feedData.id}`);
    } catch (e: any) {
      const retries = (item.aiReasoning?.match(/Yayinlama Hatasi/g) ?? []).length;
      await prisma.content.update({
        where: { id: item.id },
        data: {
          status: retries >= 3 ? "FAILED" : "READY_TO_PUBLISH",
          aiReasoning: (item.aiReasoning ?? "") + `\n[RETRY ${retries + 1}/3] Yayinlama Hatasi: ${e.message}`,
        },
      });
      console.error(`[BG] Yayınlama hatası (${item.id}):`, e.message);
    }
  }
  return { ready: readyItems.length, published };
}

// ─── Background Function Handler ─────────────────────────────────────────────
export default async function handler(req: Request) {
  // Güvenlik: Secret header kontrolü
  const secret = new URL(req.url).searchParams.get("secret") ||
    req.headers.get("x-cron-secret");

  if (secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const appUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "https://bordomavi-ai-editor.netlify.app";

  if (!apiKey) {
    console.error("[BG] GEMINI_API_KEY eksik!");
    return new Response("Missing API key", { status: 500 });
  }

  // ✅ Background Function: 202 döndürür, işlem 15 dakikaya kadar arka planda devam eder
  (async () => {
    console.log(`[BG] ===== Otomatik Yayınlama Başladı: ${new Date().toISOString()} =====`);
    try {
      console.log("[BG] Aşama 1: Haberler toplanıyor...");
      await collectNews(appUrl);

      console.log("[BG] Aşama 2: AI analizi yapılıyor...");
      const analyzeResult = await analyzePending(apiKey, 10);
      console.log("[BG] Analiz:", analyzeResult);

      console.log("[BG] Aşama 3: İçerik üretiliyor (85+ puan)...");
      const generateResult = await generateContent(apiKey, 2);
      console.log("[BG] Üretim:", generateResult);

      console.log("[BG] Aşama 4: Facebook'ta yayınlanıyor...");
      const publishResult = await publishToFacebook(appUrl, 1);
      console.log("[BG] Yayınlama:", publishResult);

      console.log(`[BG] ===== Tamamlandı: ${new Date().toISOString()} =====`);
    } catch (e: any) {
      console.error("[BG] Kritik hata:", e.message);
    } finally {
      await prisma.$disconnect();
    }
  })();

  // Anında 200 dön — işlem arka planda devam eder
  return new Response(JSON.stringify({ status: "started", time: new Date().toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
