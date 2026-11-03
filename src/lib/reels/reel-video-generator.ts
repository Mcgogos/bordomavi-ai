import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { generateReelScript, ReelScriptData } from './reels-script-generator';
import { synthesizeTurkishSpeech } from './reels-audio-synthesizer';
import { composeReelSlides, getAvailableFontPath, escapeFFmpegPath, wrapTextToLines } from './reels-visual-composer';
import { verifyReelQuality, ReelQualityCheckResult } from './reels-quality-checker';
import { buildSrtFromCues } from './caption-srt-generator';

export function getFFmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  // Linux / Ubuntu runner ortamında libfreetype & drawtext içeren sistem ffmpeg'i önceliklidir
  if (process.platform === 'linux') {
    if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
    if (fs.existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch {}
  return 'ffmpeg';
}

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
  baseFramePreviewPath?: string;
  durationSeconds: number;
  scriptData: ReelScriptData;
  srtContent: string;
  qualityResult: ReelQualityCheckResult;
}

/**
 * 9:16 Dikey, 1080x1920 Çözünürlüklü, 25-30 Saniyelik Tam Haber İçerikli Broadcast Reels Video Üreticisi
 */
export async function generateCompleteReelVideo(params: GenerateReelParams): Promise<GeneratedReelResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputVideoPath = path.join(tempDir, `bm_final_reel_${timestamp}.mp4`);
  const srtFilePath = path.join(tempDir, `bm_reel_cc_${timestamp}.srt`);
  const filesToClean: string[] = [srtFilePath];

  console.log(`[ReelVideoGenerator] 🎬 Starting Viral Broadcast Reel Production for: "${params.title}"`);

  try {
    // 1. Haberin Orijinal Kaynağından Tüm İçeriği Çekerek 25-30 Saniyelik Eksiksiz Senaryo Oluştur
    const scriptData = await generateReelScript({
      title: params.title,
      summary: params.summary,
      body: params.body,
      category: params.category,
      sourceNewsId: params.sourceNewsId
    });

    console.log(`[ReelVideoGenerator] Script generated (${scriptData.fullNarration.split(/\s+/).length} words): "${scriptData.title}"`);

    // 2. Doğal Türkçe TV Spikeri Seslendirmesi Üret
    const audioResult = await synthesizeTurkishSpeech(scriptData.fullNarration);
    filesToClean.push(audioResult.audioPath);

    const speechDuration = audioResult.durationSeconds;
    const totalDuration = +(speechDuration + 1.0).toFixed(2);
    const totalFrames = Math.ceil(totalDuration * 30);

    console.log(`[ReelVideoGenerator] Audio ready: ${speechDuration}s (${audioResult.engine}) -> Total video target: ${totalDuration}s`);

    // 3. 1080x1920 Broadcast Görsel Katmanlarını Oluştur
    const composedSlides = await composeReelSlides(scriptData, params.imageUrl);
    filesToClean.push(...composedSlides.tempFilesToClean);

    // 4. Seslendirme ile %100 Senkronize, Her Satırı Birebir Ortalanmış Altyazılar (y: 1085 - 1340 arası) + .SRT Kapalı Açıklamalı Altyazı
    const font = getAvailableFontPath();
    const cues = audioResult.cues && audioResult.cues.length > 0
      ? audioResult.cues
      : [{ text: scriptData.title, startTime: 0, endTime: totalDuration }];

    const srtContent = buildSrtFromCues(cues);
    fs.writeFileSync(srtFilePath, srtContent, 'utf8');

    const filterParts: string[] = [];
    cues.forEach((cue, idx) => {
      const cueLines = wrapTextToLines(cue.text, 38, 2);
      const startT = cue.startTime.toFixed(2);
      const endT = (idx === cues.length - 1 ? totalDuration : cue.endTime).toFixed(2);

      if (cueLines.length === 1) {
        const lineFile = path.join(tempDir, `bm_cue_${timestamp}_${idx}_0.txt`);
        fs.writeFileSync(lineFile, cueLines[0], 'utf8');
        filesToClean.push(lineFile);

        filterParts.push(
          `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(lineFile)}':fontsize=39:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=1192:enable='between(t,${startT},${endT})'`
        );
      } else if (cueLines.length >= 2) {
        const line1File = path.join(tempDir, `bm_cue_${timestamp}_${idx}_0.txt`);
        const line2File = path.join(tempDir, `bm_cue_${timestamp}_${idx}_1.txt`);
        fs.writeFileSync(line1File, cueLines[0], 'utf8');
        fs.writeFileSync(line2File, cueLines[1], 'utf8');
        filesToClean.push(line1File, line2File);

        filterParts.push(
          `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(line1File)}':fontsize=38:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=1160:enable='between(t,${startT},${endT})'`
        );
        filterParts.push(
          `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(line2File)}':fontsize=38:fontcolor=0xFDE68A:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=1222:enable='between(t,${startT},${endT})'`
        );
      }
    });

    const subtitleChain = filterParts.join(',');

    // Girdi 4: Habere uygun televizyon haber yayını ve spor ambiyansı arka plan müziği
    const customBgm = path.join(process.cwd(), 'public', 'assets', 'audio', 'sports_broadcast_bed.mp3');
    const hasCustomBgm = fs.existsSync(customBgm);
    const bgmInputs = hasCustomBgm
      ? ['-stream_loop', '-1', '-i', customBgm]
      : ['-f', 'lavfi', '-i', `anoisesrc=color=pink:sample_rate=48000:amplitude=0.01:duration=${totalDuration}`];

    // FFmpeg Filtre Grafiği:
    // - [1:v] (Hero Fotoğraf): 30fps yumuşak Ken Burns sinematik zoom hareketi (1008x567 tam 16:9 vitrin içinde)
    // - [goldBar]: 30fps saniyede 30 kare kesintisiz akan gerçek zamanlı altın ilerleme çubuğu (x = 64-952+952*(t/totalDuration))
    // - [2:v] (Broadcast HUD Overlay): Şeffaf pencereli koyu mod stüdyo arayüzü (ilerleme çubuğunu yuvarlatılmış pencere içinde maskeler)
    // - Her satırı birebir ortalanmış senkronize altyazılar + MP4 gömülü Türkçe Kapalı Açıklamalı Altyazı (mov_text)
    const ffmpegArgs: string[] = [
      '-y',
      '-loop', '1', '-framerate', '30', '-t', String(totalDuration), '-i', composedSlides.baseFramePath,
      '-i', composedSlides.heroPhotoPath,
      '-loop', '1', '-framerate', '30', '-t', String(totalDuration), '-i', composedSlides.overlayHudPath,
      '-i', audioResult.audioPath,
      ...bgmInputs,
      '-i', srtFilePath,
      '-filter_complex',
      `color=c=0xFBBF24:s=952x18:r=30:d=${totalDuration}[goldBar];` +
      `[1:v]zoompan=z='min(zoom+0.00035,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1008x567:fps=30[heroAnim];` +
      `[0:v][heroAnim]overlay=36:220:shortest=1[withHero];` +
      `[withHero][goldBar]overlay=x='64-952+952*(t/${totalDuration})':y=1342:shortest=1[withProg];` +
      `[withProg][2:v]overlay=0:0:format=auto:shortest=1[withHud];` +
      `[withHud]${subtitleChain},setsar=1:1,setdar=9/16[vOut];` +
      `[4:a]aresample=48000,volume=0.07[ambience];` +
      `[3:a]aresample=48000[voice];` +
      `[voice][ambience]amix=inputs=2:duration=first:dropout_transition=2[aOut]`,
      '-map', '[vOut]',
      '-map', '[aOut]',
      '-map', '5:s:0',
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-level:v', '4.2',
      '-preset', 'fast',
      '-crf', '19',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-b:v', '6500k',
      '-maxrate', '8500k',
      '-bufsize', '12000k',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      '-c:s', 'mov_text',
      '-metadata:s:s:0', 'language=tur',
      '-metadata:s:s:0', 'title=Türkçe',
      '-movflags', '+faststart',
      '-t', String(totalDuration),
      outputVideoPath
    ];

    const ffmpegPath = getFFmpegPath();
    console.log(`[ReelVideoGenerator] Rendering 1080x1920 30fps Broadcast MP4 (${totalDuration}s) with Turkish Closed Captions using FFmpeg: ${ffmpegPath}...`);
    const startTime = Date.now();

    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, ffmpegArgs);
      let stderr = '';
      child.stderr.on('data', d => stderr += d.toString());
      child.on('close', code => {
        if (code === 0 && fs.existsSync(outputVideoPath)) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg Reel render failed (code ${code}): ${stderr.slice(-2000)}`));
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
      srtContent,
      qualityResult
    };

  } finally {
    for (const f of filesToClean) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }
}

export async function generateReelVideoBuffer(params: GenerateReelParams): Promise<Buffer> {
  const res = await generateCompleteReelVideo(params);
  try {
    if (res.videoFilePath) {
      fs.unlinkSync(res.videoFilePath);
    }
  } catch {}
  return res.videoBuffer;
}
