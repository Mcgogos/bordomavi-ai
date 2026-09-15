import type { Config, Context } from "@netlify/functions";
import { PrismaClient } from "@prisma/client";

// Her Netlify Function kendi Prisma instance'ını oluşturur
const prisma = new PrismaClient();

// ─── Yardımcı: AI çağrısı ───────────────────────────────────────────────────
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

// ─── Aşama 1: Haber Topla ───────────────────────────────────────────────────
async function collectNews() {
  const appUrl =
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bordomavi-ai-editor.netlify.app";
  const cronSecret = process.env.CRON_SECRET;
  try {
    const res = await fetch(`${appUrl}/api/news/collect`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json();
    console.log("[CRON] Haber toplama:", JSON.stringify(data));
    return data;
  } catch (e: any) {
    console.error("[CRON] Haber toplama hatası:", e.message);
    return { error: e.message };
  }
}

// ─── Aşama 2: Bekleyen haberleri analiz et ──────────────────────────────────
async function analyzePending(apiKey: string, limit = 10) {
  const pending = await prisma.news.findMany({
    where: { isProcessed: false },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });

  console.log(`[CRON] Analiz edilecek haber sayısı: ${pending.length}`);
  let processed = 0;

  for (const news of pending) {
    try {
      const prompt = `Aşağıdaki haberi analiz et ve JSON formatında döndür:
Başlık: ${news.title}
Özet: ${news.summary ?? ""}

Lütfen sadece şu JSON'u döndür (başka açıklama ekleme):
{
  "isTrabzonsporRelated": true/false,
  "importanceScore": 0-100,
  "aiRecommendedAction": "IGNORE" | "MONITOR" | "CREATE_CONTENT" | "URGENT",
  "aiSummary": "kısa özet"
}`;

      const text = await callAI(prompt, apiKey);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
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
      console.error(`[CRON] Analiz hatası (${news.id}):`, e.message);
    }
  }
  return { total: pending.length, processed };
}

// ─── Aşama 3: 85+ puanlı haberlerden içerik üret ───────────────────────────
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

  console.log(`[CRON] İçerik üretilecek haber: ${candidates.length}`);
  let processed = 0;

  for (const news of candidates) {
    try {
      const prompt = `Trabzonspor taraftar platformu için dikkat çekici bir Facebook gönderisi yaz:

Haber Başlığı: ${news.title}
Kaynak: ${news.source?.name ?? ""}
Özet: ${news.summary ?? news.aiSummary ?? ""}

Kurallar:
1. Dikkat çekici başlık ile başla
2. 2-4 kısa paragraf yaz
3. Sonunda Bordo Mavi tarzı kısa yorum ekle
4. En alta 3-5 hashtag ekle (#Trabzonspor vb.)
5. Sadece paylaşılacak metni yaz, JSON veya açıklama ekleme`;

      const body = await callAI(prompt, apiKey);
      if (!body) continue;

      await prisma.content.create({
        data: {
          title: news.title,
          body,
          type: (news.aiRecommendedContentType as any) ?? "NEWS",
          status: "READY_TO_PUBLISH",
          sourceNewsId: news.id,
        },
      });
      processed++;
    } catch (e: any) {
      console.error(`[CRON] İçerik üretim hatası (${news.id}):`, e.message);
    }
  }
  return { candidates: candidates.length, processed };
}

// ─── Aşama 4: Facebook'ta yayınla ──────────────────────────────────────────
async function publishToFacebook(limit = 1) {
  const pageTokenSetting = await prisma.setting.findUnique({
    where: { key: "FACEBOOK_PAGE_TOKEN" },
  });
  const pageIdSetting = await prisma.setting.findUnique({
    where: { key: "FACEBOOK_PAGE_ID" },
  });

  const token =
    pageTokenSetting?.value ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = pageIdSetting?.value ?? process.env.FACEBOOK_PAGE_ID;

  if (!token || !pageId) {
    console.error("[CRON] Facebook token veya page ID eksik.");
    return { published: 0, error: "Token veya Page ID eksik" };
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

  console.log(`[CRON] Yayınlanacak içerik: ${readyItems.length}`);
  let published = 0;

  for (const item of readyItems) {
    try {
      const message = item.body;
      const appUrl =
        process.env.URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://bordomavi-ai-editor.netlify.app";
      let payload: any = { message, access_token: token };

      if (item.sourceNews?.imageUrl) {
        payload.link = `${appUrl}/api/og?title=${encodeURIComponent(item.title)}&imageUrl=${encodeURIComponent(item.sourceNews.imageUrl)}`;
      }

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        }
      );
      const data = await res.json();

      if (data.error) throw new Error(JSON.stringify(data.error));

      await prisma.content.update({
        where: { id: item.id },
        data: {
          status: "PUBLISHED",
          facebookPostId: data.post_id ?? data.id,
          publishedAt: new Date(),
        },
      });
      published++;
      console.log(`[CRON] Yayınlandı: ${data.post_id ?? data.id}`);
    } catch (e: any) {
      console.error(`[CRON] Yayınlama hatası (${item.id}):`, e.message);
      const retries = (item.aiReasoning?.match(/Yayinlama Hatasi/g) ?? []).length;
      await prisma.content.update({
        where: { id: item.id },
        data: {
          status: retries >= 3 ? "FAILED" : "READY_TO_PUBLISH",
          aiReasoning:
            (item.aiReasoning ?? "") +
            `\n[RETRY ${retries + 1}/3] Yayinlama Hatasi: ${e.message}`,
        },
      });
    }
  }
  return { ready: readyItems.length, published };
}

// ─── Ana Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[CRON] GEMINI_API_KEY eksik!");
    return;
  }

  console.log("[CRON] ===== Otomatik Yayınlama Döngüsü Başladı =====");

  try {
    // 1. Haber Topla
    console.log("[CRON] Aşama 1: Haberler toplanıyor...");
    await collectNews();

    // 2. Analiz Et
    console.log("[CRON] Aşama 2: Haberler analiz ediliyor...");
    const analyzeResult = await analyzePending(apiKey, 10);
    console.log("[CRON] Analiz tamamlandı:", analyzeResult);

    // 3. İçerik Üret
    console.log("[CRON] Aşama 3: İçerik üretiliyor (85+ puan)...");
    const generateResult = await generateContent(apiKey, 2);
    console.log("[CRON] Üretim tamamlandı:", generateResult);

    // 4. Yayınla
    console.log("[CRON] Aşama 4: Facebook'ta yayınlanıyor...");
    const publishResult = await publishToFacebook(1);
    console.log("[CRON] Yayınlama tamamlandı:", publishResult);

    console.log("[CRON] ===== Döngü Başarıyla Tamamlandı =====");
  } catch (e: any) {
    console.error("[CRON] Kritik hata:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Her 30 dakikada bir çalış — Background Function (15 dk limiti)
export const config: Config = {
  schedule: "*/30 * * * *",
};
