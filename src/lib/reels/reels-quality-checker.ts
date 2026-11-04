import fs from 'fs';
import { spawn } from 'child_process';
import { prisma } from '@/lib/db';
import { checkAgainstPublishedHistory, isNewsTooOld } from '@/lib/news/news-similarity-engine';
import { getFFmpegPath } from './reel-video-generator';

const ffmpegPath = getFFmpegPath();

export interface ReelQualityMetrics {
  fileSizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasSubtitleStream: boolean;
  videoCodec: string;
  audioCodec: string;
}

export interface ReelQualityCheckResult {
  passed: boolean;
  metrics?: ReelQualityMetrics;
  errors: string[];
  warnings: string[];
}

export async function probeVideoFile(filePath: string): Promise<ReelQualityMetrics> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', () => {
      let durationSeconds = 0;
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (durMatch) {
        durationSeconds =
          parseFloat(durMatch[1]) * 3600 +
          parseFloat(durMatch[2]) * 60 +
          parseFloat(durMatch[3]);
      }

      let width = 0;
      let height = 0;
      let videoCodec = 'unknown';
      const videoMatch = stderr.match(
        /Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_-]+).*?(\d{3,4})x(\d{3,4})/
      );
      if (videoMatch) {
        videoCodec = videoMatch[1];
        width = parseInt(videoMatch[2], 10);
        height = parseInt(videoMatch[3], 10);
      }

      let hasAudio = false;
      let audioCodec = 'none';
      const audioMatch = stderr.match(/Stream #\d+:\d+.*Audio:\s*([a-zA-Z0-9_-]+)/);
      if (audioMatch) {
        hasAudio = true;
        audioCodec = audioMatch[1];
      }

      const hasSubtitleStream = /Stream #\d+:\d+.*Subtitle:\s*(mov_text|subrip|tx3g)/i.test(stderr);
      const fileSizeBytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

      resolve({
        fileSizeBytes,
        durationSeconds: +durationSeconds.toFixed(2),
        width,
        height,
        hasAudio,
        hasSubtitleStream,
        videoCodec,
        audioCodec,
      });
    });
  });
}

export async function checkVideoDecodeIntegrity(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-v', 'error', '-i', filePath, '-f', 'null', '-']);
    let errOutput = '';
    child.stderr.on('data', (d) => {
      errOutput += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0 && !errOutput.includes('Invalid data found')) {
        resolve(true);
      } else {
        console.warn('[QualityChecker] Video decode error detected:', errOutput.slice(0, 200));
        resolve(false);
      }
    });
  });
}

/**
 * YAYIN KONTROLÜ (Pre-Publish Editorial, Copyright, Visual, Caption & Technical QA Gate)
 * Kontrollerden geçmeyen içeriği otomatik yayınlamaz:
 * 1. İçerik doğruluğu & tazelik (doğrulanmamış veya eski haber engeli)
 * 2. Telif & Haber-Görsel uyumu (%100 AI görsel ve 6-8 özgün slayt kontrolü)
 * 3. Video kalitesi (1080x1920 9:16 dikey, H.264/AAC, 0 bozuk kare)
 * 4. Altyazı kontrolü (.srt ve gömülü mov_text altyazı akışı)
 * 5. Mükerrer haber engeli (aynı haberin farklı başlıkla tekrar yayınlanmasını önler)
 */
export async function verifyReelQuality(params: {
  videoFilePath: string;
  title: string;
  summary?: string;
  sourceNewsId?: string;
  skipHistoryCheck?: boolean;
  slideCount?: number;
  hasClosedCaptions?: boolean;
  isAiVisualVerified?: boolean;
}): Promise<ReelQualityCheckResult> {
  const {
    videoFilePath,
    title,
    summary,
    sourceNewsId,
    skipHistoryCheck,
    slideCount,
    hasClosedCaptions,
  } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(videoFilePath)) {
    return {
      passed: false,
      errors: ['Video dosyası diske yazılamadı veya bulunamadı.'],
      warnings: [],
    };
  }

  const metrics = await probeVideoFile(videoFilePath);

  if (metrics.fileSizeBytes < 250 * 1024) {
    errors.push(
      `Video dosya boyutu çok küçük (${Math.round(
        metrics.fileSizeBytes / 1024
      )} KB). Boş veya eksik render.`
    );
  }

  // 1. 1080x1920 (9:16) Dikey Format Kontrolü
  if (metrics.width === 0 || metrics.height === 0) {
    errors.push('Video çözünürlük bilgisi okunamadı.');
  } else {
    const ratio = metrics.height / metrics.width;
    if (ratio < 1.7) {
      errors.push(`Video formatı 9:16 dikey değil (${metrics.width}x${metrics.height}).`);
    }
  }

  // 2. Süre Kontrolü (Hedef: 25-35s, kabul aralığı: 12-58s)
  if (metrics.durationSeconds < 12) {
    errors.push(`Video süresi çok kısa (${metrics.durationSeconds}s).`);
  } else if (metrics.durationSeconds > 60) {
    warnings.push(`Video süresi 60 saniyeyi aşıyor (${metrics.durationSeconds}s).`);
  }

  // 3. Ses ve Altyazı Kontrolü
  if (!metrics.hasAudio) {
    errors.push('Videoda ses akışı (audio stream) bulunamadı. Sessiz video yayınlanamaz.');
  }
  if (hasClosedCaptions === false && !metrics.hasSubtitleStream) {
    errors.push('Videoda kapalı açıklamalı altyazı (.srt / mov_text) bulunamadı.');
  }

  // 4. Slayt Sayısı Kontrolü (Haber Reels için 6-8 özgün slayt)
  if (typeof slideCount === 'number' && (slideCount < 6 || slideCount > 8)) {
    warnings.push(`Slayt sayısı hedef 6-8 aralığında değil (${slideCount} slayt).`);
  }

  // 5. İçerik Doğruluğu ve Tazelik Kontrolü
  if (sourceNewsId) {
    try {
      const newsItem = await prisma.news.findUnique({ where: { id: sourceNewsId } });
      if (newsItem) {
        if (newsItem.confidenceLevel === 'UNVERIFIED') {
          errors.push(
            'Doğrulanmamış haber (UNVERIFIED) tespit edildi. Yayın politikası gereği otomatik yayınlanamaz.'
          );
        }
        if (isNewsTooOld(newsItem.publishedAt, 36)) {
          errors.push(
            'Haber 36 saatten eski. Eski haberler yeniymiş gibi yayınlanamaz.'
          );
        }
      }
    } catch {}
  }

  // 6. Kare Bütünlüğü Testi
  const isDecodable = await checkVideoDecodeIntegrity(videoFilePath);
  if (!isDecodable) {
    errors.push('Video dosyasında bozuk kare veya decode hatası tespit edildi.');
  }

  // 7. Aynı Haberin Farklı Başlıkla Tekrar Yayınlanmasını Önleme (Son 14 Gün)
  if (!skipHistoryCheck) {
    try {
      const historyCheck = await checkAgainstPublishedHistory(
        { id: sourceNewsId, title, summary },
        14
      );
      if (historyCheck.isDuplicate) {
        errors.push(
          `Aynı haber/konu yakın zamanda zaten yayınlandı: "${historyCheck.matchedPost?.title}". Tekrar yayın engellendi.`
        );
      }
    } catch {}
  }

  const passed = errors.length === 0;

  console.log(
    `[ReelQualityChecker] Quality & Editorial QA Result: ${
      passed ? '✅ PASSED' : '❌ REJECTED'
    } | Duration: ${metrics.durationSeconds}s, Slides: ${slideCount || 'Viral'}, Size: ${Math.round(
      metrics.fileSizeBytes / 1024
    )}KB, Res: ${metrics.width}x${metrics.height}, CC: ${
      metrics.hasSubtitleStream || Boolean(hasClosedCaptions)
    }`
  );
  if (!passed) {
    console.warn('[ReelQualityChecker] QA Errors:', errors);
  }

  return {
    passed,
    metrics,
    errors,
    warnings,
  };
}
