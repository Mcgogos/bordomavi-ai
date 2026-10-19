import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { generateReelScript, ReelScriptData } from './reels-script-generator';
import { synthesizeTurkishSpeech } from './reels-audio-synthesizer';
import { composeReelSlides, getAvailableFontPath } from './reels-visual-composer';
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

    // 3. 4 Sahneli Canva Kalitesinde 1080x1920 Görselleri Oluştur
    const composedSlides = await composeReelSlides(scriptData, params.imageUrl);
    filesToClean.push(...composedSlides.tempFilesToClean);

    const [slide1, slide2, slide3, slide4] = composedSlides.slidePaths;

    // 4. Senkronize Altyazı ve Dinamik Sahne Geçişleri
    const font = getAvailableFontPath();
    const t1 = sceneDuration;
    const t2 = +(sceneDuration * 2).toFixed(2);
    const t3 = +(sceneDuration * 3).toFixed(2);

    // Her sahne için okunabilir altyazı metni
    const sub1 = (scriptData.scenes[0]?.subtitle || scriptData.title).replace(/'/g, '').replace(/:/g, '\\:').trim();
    const sub2 = (scriptData.scenes[1]?.subtitle || scriptData.title).replace(/'/g, '').replace(/:/g, '\\:').trim();
    const sub3 = (scriptData.scenes[2]?.subtitle || params.summary || 'Detaylar bültende').replace(/'/g, '').replace(/:/g, '\\:').trim();
    const sub4 = (scriptData.scenes[3]?.subtitle || 'Fikirlerinizi yorumlarda paylasin!').replace(/'/g, '').replace(/:/g, '\\:').trim();

    // FFmpeg Filtre Grafiği: 4 Slayt Geçişi + Güvenli Alan Altyazıları + Arka Plan Ses Katmanı
    const ffmpegArgs: string[] = [
      '-y',
      // Girdi 0: Slayt 1 (0 -> t1)
      '-loop', '1', '-t', String(t1), '-i', slide1,
      // Girdi 1: Slayt 2 (t1 -> t2)
      '-loop', '1', '-t', String(sceneDuration), '-i', slide2,
      // Girdi 2: Slayt 3 (t2 -> t3)
      '-loop', '1', '-t', String(sceneDuration), '-i', slide3,
      // Girdi 3: Slayt 4 (t3 -> totalDuration)
      '-loop', '1', '-t', String(+(totalDuration - t3).toFixed(2)), '-i', slide4,
      // Girdi 4: Türkçe Seslendirme Dosyası
      '-i', audioResult.audioPath,
      // Girdi 5: Dinamik spor ambiyans fısıltısı (Düşük sesli dolgu)
      '-f', 'lavfi', '-i', `sine=frequency=110:duration=${totalDuration}`,
      '-filter_complex',
      // 4 Video parçasını kesintisiz ardışık bağla
      `[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[vRaw];` +
      // Güvenli alan altyazılarını bindir (y=1400, sarı metin, siyah cam kutu)
      `[vRaw]` +
      `drawtext=fontfile='${font}':text='${sub1}':fontsize=38:fontcolor=0xFCD34D:x=(w-text_w)/2:y=1420:box=1:boxcolor=black@0.75:boxborderw=18:enable='between(t,0,${t1})',` +
      `drawtext=fontfile='${font}':text='${sub2}':fontsize=38:fontcolor=0xFCD34D:x=(w-text_w)/2:y=1420:box=1:boxcolor=black@0.75:boxborderw=18:enable='between(t,${t1},${t2})',` +
      `drawtext=fontfile='${font}':text='${sub3}':fontsize=38:fontcolor=0xFCD34D:x=(w-text_w)/2:y=1420:box=1:boxcolor=black@0.75:boxborderw=18:enable='between(t,${t2},${t3})',` +
      `drawtext=fontfile='${font}':text='${sub4}':fontsize=42:fontcolor=0xF59E0B:x=(w-text_w)/2:y=1420:box=1:boxcolor=black@0.85:boxborderw=20:enable='gte(t,${t3})'[vOut];` +
      // Seslendirme + Ambiyans Miksi (Konuşma net, ambiyans -24dB)
      `[5:a]volume=0.03[ambience];` +
      `[4:a][ambience]amix=inputs=2:duration=first:dropout_transition=2[aOut]`,
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

    console.log(`[ReelVideoGenerator] Rendering 1080x1920 MP4 (${totalDuration}s, 4 scenes)...`);
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
      sourceNewsId: params.sourceNewsId
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
