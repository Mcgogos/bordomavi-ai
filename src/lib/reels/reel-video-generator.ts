import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { generateReelScript, ReelScriptData } from './reels-script-generator';
import { synthesizeTurkishSpeech } from './reels-audio-synthesizer';
import { composeReelSlides, getAvailableFontPath, escapeFFmpegPath, wrapTextToLines } from './reels-visual-composer';
import { verifyReelQuality, ReelQualityCheckResult } from './reels-quality-checker';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

export interface GenerateReelParams {
  title: string;
  summary?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  sourceNewsId?: string;
  durationSeconds?: number;
  skipHistoryCheck?: boolean;
}

export interface GeneratedReelResult {
  videoBuffer: Buffer;
  videoFilePath: string;
  durationSeconds: number;
  scriptData: ReelScriptData;
  qualityResult: ReelQualityCheckResult;
}

/**
 * 9:16 Dikey, 1080x1920 Çözünürlüklü, Tam Otomatik Profesyonel Facebook Reels Video Üreticisi
 * 
 * İş Akışı:
 * 1. Habere özel yapay zekâ seslendirme senaryosu oluşturur (Statik şablon içermez).
 * 2. Doğal Türkçe seslendirme (TTS) üretir ve net konuşma süresini milisaniyelik ölçer.
 * 3. 4 Sahneli, Canva kalitesinde 1080x1920 dikey görsel afişleri hazırlar.
 * 4. Senkronize Türkçe altyazıları mobil güvenli alana yerleştirir.
 * 5. FFmpeg ile görsel, ses ve altyazıları 1080x1920 dikey H.264/AAC MP4 olarak render eder.
 * 6. Otomatik Kalite Kontrolü (QA) yaparak videonun sağlamlığını teyit eder.
 */
export async function generateCompleteReelVideo(params: GenerateReelParams): Promise<GeneratedReelResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputVideoPath = path.join(tempDir, `bm_final_reel_${timestamp}.mp4`);
  const filesToClean: string[] = [];

  console.log(`[ReelVideoGenerator] 🎬 Starting Full Automated Reel Production for: "${params.title}"`);

  try {
    // 1. Habere Özel Orijinal Senaryo Oluştur
    const scriptData = await generateReelScript({
      title: params.title,
      summary: params.summary,
      body: params.body,
      category: params.category
    });

    console.log(`[ReelVideoGenerator] Script generated: "${scriptData.title}" (${scriptData.badgeTitle})`);

    // 2. Doğal Türkçe Seslendirme Üret
    const audioResult = await synthesizeTurkishSpeech(scriptData.fullNarration);
    filesToClean.push(audioResult.audioPath);

    const speechDuration = audioResult.durationSeconds;
    // Toplam video süresi: Konuşma süresi + 1.2 saniye kapanış payı
    const totalDuration = +(speechDuration + 1.2).toFixed(2);
    const sceneDuration = +(totalDuration / 4).toFixed(2);

    console.log(`[ReelVideoGenerator] Audio ready: ${speechDuration}s -> Total video target: ${totalDuration}s`);

    // 3. Canva / Referans Kalitesinde 1080x1920 Şablon Görselini Oluştur
    const composedSlides = await composeReelSlides(scriptData, params.imageUrl);
    filesToClean.push(...composedSlides.tempFilesToClean);
    const baseFrame = composedSlides.baseFramePath;

    // 4. Seslendirme ile 100% Senkronize Dinamik Altyazı Cueları
    const font = getAvailableFontPath();
    const cues = audioResult.cues && audioResult.cues.length > 0
      ? audioResult.cues
      : [
          { text: scriptData.title, startTime: 0, endTime: totalDuration }
        ];

    let subtitleFilters = '';
    cues.forEach((cue, idx) => {
      const cueLines = wrapTextToLines(cue.text, 44, 2);
      const cueFile = path.join(tempDir, `bm_cue_${timestamp}_${idx}.txt`);
      fs.writeFileSync(cueFile, cueLines.join('\n'), 'utf8');
      filesToClean.push(cueFile);

      // Koyu lacivert başlık/altyazı alanına (y: 1372 - 1520) dikey ortalı, beyaz bold spiker yazısı
      const filterPart = `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(cueFile)}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=1375+(145-text_h)/2:line_spacing=12:enable='between(t,${cue.startTime.toFixed(2)},${cue.endTime.toFixed(2)})'`;
      if (subtitleFilters) {
        subtitleFilters += `,${filterPart}`;
      } else {
        subtitleFilters = filterPart;
      }
    });

    // Girdi 2: Habere uygun televizyon haber yayını ve spor ambiyansı arka plan müziği
    const customBgm = path.join(process.cwd(), 'public', 'assets', 'audio', 'sports_broadcast_bed.mp3');
    const hasCustomBgm = fs.existsSync(customBgm);
    const bgmInputs = hasCustomBgm
      ? ['-stream_loop', '-1', '-i', customBgm]
      : ['-f', 'lavfi', '-i', `anoisesrc=color=pink:sample_rate=44100:amplitude=0.01:duration=${totalDuration}`];

    // FFmpeg Filtre Grafiği: 1080x1920 Referans Şablon + Canlı Senkronize Altyazı + Seslendirme & Spor Ambiyansı
    const ffmpegArgs: string[] = [
      '-y',
      // Girdi 0: 1080x1920 Şablon Görseli
      '-loop', '1', '-t', String(totalDuration), '-i', baseFrame,
      // Girdi 1: Türkçe Seslendirme Dosyası
      '-i', audioResult.audioPath,
      // Girdi 2: Habere uygun spor ambiyans müziği
      ...bgmInputs,
      '-filter_complex',
      // Seslendirme ile tam senkronize altyazıları alt koyu lacivert alana yerleştir
      `[0:v]${subtitleFilters}[vOut];` +
      // Seslendirme + TV Haber Ambiyansı Miksi (Seslendirme kristal net, arka plan dengeli)
      `[2:a]volume=0.08[ambience];` +
      `[1:a][ambience]amix=inputs=2:duration=first:dropout_transition=2[aOut]`,
      '-map', '[vOut]',
      '-map', '[aOut]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-b:v', '4200k',
      '-maxrate', '5000k',
      '-bufsize', '8000k',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-t', String(totalDuration),
      '-shortest',
      outputVideoPath
    ];

    console.log(`[ReelVideoGenerator] Rendering 1080x1920 MP4 (${totalDuration}s)...`);
    const startTime = Date.now();

    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, ffmpegArgs);
      let stderr = '';
      child.stderr.on('data', d => stderr += d.toString());
      child.on('close', code => {
        if (code === 0 && fs.existsSync(outputVideoPath)) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg Reel render failed (code ${code}): ${stderr.slice(-350)}`));
        }
      });
    });

    const elapsed = Date.now() - startTime;
    console.log(`[ReelVideoGenerator] Video rendered in ${elapsed}ms: ${outputVideoPath}`);

    // 5. Otomatik Kalite Kontrolü (Quality Assurance)
    const qualityResult = await verifyReelQuality({
      videoFilePath: outputVideoPath,
      title: params.title,
      summary: params.summary || undefined,
      sourceNewsId: params.sourceNewsId,
      skipHistoryCheck: params.skipHistoryCheck
    });

    if (!qualityResult.passed) {
      throw new Error(`Reel Kalite Kontrolü Başarısız: ${qualityResult.errors.join(', ')}`);
    }

    const videoBuffer = fs.readFileSync(outputVideoPath);

    return {
      videoBuffer,
      videoFilePath: outputVideoPath,
      durationSeconds: totalDuration,
      scriptData,
      qualityResult
    };

  } finally {
    // Geçici slayt ve parçaları temizle
    for (const f of filesToClean) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }
}

/**
 * Geriye dönük uyumluluk yardımcısı: Doğrudan video buffer döner.
 */
export async function generateReelVideoBuffer(params: GenerateReelParams): Promise<Buffer> {
  const res = await generateCompleteReelVideo(params);
  // Geçici final video dosyasını iş bittikten sonra sil
  try {
    if (res.videoFilePath) {
      fs.unlinkSync(res.videoFilePath);
    }
  } catch {}
  return res.videoBuffer;
}
