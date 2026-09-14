import type { Config } from "@netlify/functions";

// Netlify Scheduled Function — Windows Task Scheduler yerine çalışır
// Her 30 dakikada bir otomatik tetiklenir (saatte 2 haber yayınlar)
export default async function handler() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!appUrl || !cronSecret) {
    console.error("[Netlify Cron] NEXT_PUBLIC_APP_URL veya CRON_SECRET tanımlanmamış.");
    return;
  }

  const url = `${appUrl}/api/cron/sync-news?secret=${cronSecret}`;
  console.log(`[Netlify Cron] Tetikleniyor: ${url}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(270_000), // 4.5 dakika timeout
    });

    if (!res.ok) {
      console.error(`[Netlify Cron] HTTP Hatası: ${res.status}`);
      return;
    }

    const data = await res.json();
    console.log("[Netlify Cron] Başarılı:", JSON.stringify(data));
  } catch (err: any) {
    console.error("[Netlify Cron] Hata:", err.message);
  }
}

// Her 30 dakikada bir çalıştır
export const config: Config = {
  schedule: "*/30 * * * *",
};
