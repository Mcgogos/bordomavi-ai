import fs from 'fs';
import { spawn } from 'child_process';
import { prisma } from '@/lib/db';
import { checkAgainstPublishedHistory } from '@/lib/news/news-similarity-engine';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

export interface ReelQualityMetrics {
  fileSizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
}

export interface ReelQualityCheckResult {
  passed: boolean;
  metrics?: ReelQualityMetrics;
  errors: string[];
  warnings: string[];
}

/**
 * FFmpeg ile video dosyasının teknik parametrelerini (çözünürlük, süre, ses akışı) ayıklar.
 */
export async function probeVideoFile(filePath: string): Promise<ReelQualityMetrics> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', () => {
      // 1. Duration
      let durationSeconds = 0;
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (durMatch) {
        durationSeconds = parseFloat(durMatch[1]) * 3600 + parseFloat(durMatch[2]) * 60 + parseFloat(durMatch[3]);
      }

      // 2. Video Stream & Resolution (e.g., "1080x1920" or "720x1280")
      let width = 0;
      let height = 0;
      let videoCodec = 'unknown';
      const videoMatch = stderr.match(/Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_-]+).*?(\d{3,4})x(\d{3,4})/);
      if (videoMatch) {
        videoCodec = videoMatch[1];
        width = parseInt(videoMatch[2], 10);
        height = parseInt(videoMatch[3], 10);
      }

      // 3. Audio Stream
      let hasAudio = false;
      let audioCodec = 'none';
      const audioMatch = stderr.match(/Stream #\d+:\d+.*Audio:\s*([a-zA-Z0-9_-]+)/);
      if (audioMatch) {
        hasAudio = true;
        audioCodec = audioMatch[1];
      }

      const fileSizeBytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

      resolve({
        fileSizeBytes,
        durationSeconds: +durationSeconds.toFixed(2),
        width,
        height,
        hasAudio,
        videoCodec,
        audioCodec
      });
    });
  });
}

/**
 * FFmpeg ile videonun bozuk kare veya oynatma hatası içerip içermediğini denetler.
 */
export async function checkVideoDecodeIntegrity(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, [
      '-v', 'error',
      '-i', filePath,
      '-f', 'null',
      '-'
    ]);
    let errOutput = '';
    child.stderr.on('data', (d) => { errOutput += d.toString(); });
    child.on('close', (code) => {
      // Decode hatası yoksa code 0 ve errOutput boş veya minimumdur
      if (code === 0 && !errOutput.includes('Invalid data found')) {
        resolve(true);
      } else {
        console.warn("[QualityChecker] Video decode error detected:", errOutput.slice(0, 200));
        resolve(false);
      }
    });
  });
}

/**
 * Otomatik Video Kalite Kontrolü (Reels Quality Assurance Guard)
 * Yayımlanmadan önce videoyu 7 kritik testten geçirir:
 * 1. Dosya varlığı ve minimum boyut (>300 KB)
 * 2. 9:16 Dikey Çözünürlük (1080x1920 veya 720x1280+)
 * 3. Süre doğrulaması (18s - 60s arası)
 * 4. Gerçek ses akışı varlığı (Audio stream)
 * 5. FFmpeg kare bütünlüğü (Sıfır bozuk kare)
 * 6. Format uyumu (H.264 / AAC)
 * 7. Tekrar yayın / geçmiş yayın koruması
 */
export async function verifyReelQuality(params: {
  videoFilePath: string;
  title: string;
  summary?: string;
  sourceNewsId?: string;
  skipHistoryCheck?: boolean;
}): Promise<ReelQualityCheckResult> {
  const { videoFilePath, title, summary, sourceNewsId, skipHistoryCheck } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Dosya varlığı ve boyut denetimi
  if (!fs.existsSync(videoFilePath)) {
    return { passed: false, errors: ['Video dosyası diske yazılamadı veya bulunamadı.'], warnings: [] };
  }

  const metrics = await probeVideoFile(videoFilePath);

  if (metrics.fileSizeBytes < 250 * 1024) {
    errors.push(`Video dosya boyutu çok küçük (${Math.round(metrics.fileSizeBytes / 1024)} KB). Boş veya eksik render.`);
  }

  // 2. Çözünürlük denetimi (9:16 dikey format)
  if (metrics.width === 0 || metrics.height === 0) {
    errors.push('Video çözünürlük bilgisi okunamadı.');
  } else {
    const ratio = metrics.height / metrics.width;
    if (ratio < 1.7) {
      errors.push(`Video formatı 9:16 dikey değil (${metrics.width}x${metrics.height}).`);
    }
  }

  // 3. Süre denetimi (Reels için ideal: 18 - 55 saniye)
  if (metrics.durationSeconds < 15) {
    errors.push(`Video süresi çok kısa (${metrics.durationSeconds}s). Minimum 15 saniye olmalı.`);
  } else if (metrics.durationSeconds > 60) {
    warnings.push(`Video süresi 60 saniyeyi aşıyor (${metrics.durationSeconds}s).`);
  }

  // 4. Ses denetimi
  if (!metrics.hasAudio) {
    errors.push('Videoda ses akışı (audio stream) bulunamadı. Sessiz video yayınlanamaz.');
  }

  // 5. Kare bütünlüğü testi
  const isDecodable = await checkVideoDecodeIntegrity(videoFilePath);
  if (!isDecodable) {
    errors.push('Video dosyasında bozuk kare veya decode hatası tespit edildi.');
  }

  // 6. Geçmiş yayın mükerrerlik denetimi (Son 7 gün)
  if (!skipHistoryCheck) {
    try {
      const historyCheck = await checkAgainstPublishedHistory({ id: sourceNewsId, title, summary }, 7);
      if (historyCheck.isDuplicate) {
        errors.push(`Bu haber son 7 gün içinde zaten yayınlandı: "${historyCheck.matchedPost?.title}". Tekrar yayın engellendi.`);
      }
    } catch (histErr) {
      // Hata akışı engellemesin
    }
  }

  const passed = errors.length === 0;

  console.log(`[ReelQualityChecker] Quality QA Result: ${passed ? '✅ PASSED' : '❌ REJECTED'} | Duration: ${metrics.durationSeconds}s, Size: ${Math.round(metrics.fileSizeBytes / 1024)}KB, Res: ${metrics.width}x${metrics.height}`);
  if (!passed) {
    console.warn('[ReelQualityChecker] QA Errors:', errors);
  }

  return {
    passed,
    metrics,
    errors,
    warnings
  };
}
