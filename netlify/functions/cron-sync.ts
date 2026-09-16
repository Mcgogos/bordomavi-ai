import type { Config } from "@netlify/functions";

/**
 * NETLIFY SCHEDULED FUNCTION — Sadece tetikleyici
 * Her 30 dakikada bir çalışır ve Background Function'ı başlatır.
 * Ağır işleri yapmaz — sadece HTTP çağrısı yapar (1-2sn yeterli).
 */
export default async function handler(req: Request) {
  const appUrl =
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bordomavi-ai-editor.netlify.app";

  const secret = process.env.CRON_SECRET || "test_secret";

  console.log(`[CRON] Trigger başlatıldı: ${new Date().toISOString()}`);

  try {
    // Background Function'ı tetikle (anında 200 döner, arka planda çalışır)
    const res = await fetch(
      `${appUrl}/.netlify/functions/auto-publish-background?secret=${secret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": secret },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data = await res.text();
    console.log(`[CRON] Background function tetiklendi: ${res.status} — ${data}`);
  } catch (e: any) {
    console.error("[CRON] Trigger hatası:", e.message);
  }
}

// Her 30 dakikada bir çalış
export const config: Config = {
  schedule: "*/30 * * * *",
};
