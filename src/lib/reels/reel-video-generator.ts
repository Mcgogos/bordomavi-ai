import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { generateReelScript, ReelScriptData } from './reels-script-generator';
import { synthesizeTurkishSpeech } from './reels-audio-synthesizer';
import {
  composeReelSlides,
  getAvailableFontPath,
  escapeFFmpegPath,
  wrapTextToLines,
} from './reels-visual-composer';
import { verifyReelQuality, ReelQualityCheckResult } from './reels-quality-checker';
import { buildSrtFromCues } from './caption-srt-generator';
import { renderEarshotSfxTrackForReel, measureReelAudioWithEarshot } from './earshot-engine';

export function getFFmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
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
 * 9:16 Dikey, 1080x1920 Çözünürlüklü, 25-35 Saniyelik, 6-8 Özgün AI Slaytlı Broadcast Reels Video Üreticisi
 */
export async function generateCompleteReelVideo(
  params: GenerateReelParams
): Promise<GeneratedReelResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputVideoPath = path.join(tempDir, `bm_final_reel_${timestamp}.mp4`);
  const srtFilePath = path.join(tempDir, `bm_reel_cc_${timestamp}.srt`);
  const filesToClean: string[] = [srtFilePath];

  console.log(
    `[ReelVideoGenerator] 🎬 Starting 6-8 Slide AI Broadcast Reel Production for: "${params.title}"`
  );

  try {
    // 1. Haberin Orijinal Kaynağından ve Bağımsız Doğrulamasından 6-8 Slaytlı Senaryo Oluştur
    const scriptData = await generateReelScript({
      title: params.title,
      summary: params.summary,
      body: params.body,
      category: params.category,
      sourceNewsId: params.sourceNewsId,
    });

    console.log(
      `[ReelVideoGenerator] Script generated (${scriptData.fullNarration.split(/\s+/).length} words, ${
        scriptData.scenes.length
      } AI slides, Claim: ${scriptData.claimType}, Score: ${scriptData.editorialPotentialScore}/100): "${
        scriptData.title
      }"`
    );

    // 2. Doğal Türkçe TV Spikeri Seslendirmesi Üret
    const audioResult = await synthesizeTurkishSpeech(scriptData.fullNarration);
    filesToClean.push(audioResult.audioPath);

    const speechDuration = audioResult.durationSeconds;
    const totalDuration = +(speechDuration + 1.0).toFixed(2);

    console.log(
      `[ReelVideoGenerator] Audio ready: ${speechDuration}s (${audioResult.engine}) -> Total video target: ${totalDuration}s`
    );

    // 3. 1080x1920 %100 Yapay Zeka 6-8 Özgün Slayt Görsellerini Oluştur
    const composedSlides = await composeReelSlides(scriptData, params.imageUrl);
    filesToClean.push(...composedSlides.tempFilesToClean);

    // 4. Seslendirme ile %100 Senkronize Altyazılar + .SRT Kapalı Açıklamalı Altyazı
    const font = getAvailableFontPath();
    const cues =
      audioResult.cues && audioResult.cues.length > 0
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
          `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(
            lineFile
          )}':fontsize=39:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=1534:enable='between(t,${startT},${endT})'`
        );
      } else if (cueLines.length >= 2) {
        const line1File = path.join(tempDir, `bm_cue_${timestamp}_${idx}_0.txt`);
        const line2File = path.join(tempDir, `bm_cue_${timestamp}_${idx}_1.txt`);
        fs.writeFileSync(line1File, cueLines[0], 'utf8');
        fs.writeFileSync(line2File, cueLines[1], 'utf8');
        filesToClean.push(line1File, line2File);

        filterParts.push(
          `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(
            line1File
          )}':fontsize=38:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=1506:enable='between(t,${startT},${endT})'`
        );
        filterParts.push(
          `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(
            line2File
          )}':fontsize=38:fontcolor=0x38BDF8:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=1564:enable='between(t,${startT},${endT})'`
        );
      }
    });

    const subtitleChain = filterParts.join(',');

    // 5. 6-8 Özgün Slaytın Gerçek Ses Süresine (totalDuration) Göre Zamanlamalarını Hesapla
    const slidePaths =
      composedSlides.slidePaths.length > 0
        ? composedSlides.slidePaths
        : [composedSlides.heroPhotoPath];
    const numSlides = slidePaths.length;

    const sceneWeights = scriptData.scenes
      .slice(0, numSlides)
      .map((s) => Math.max(2.0, s.durationSeconds || 4.0));
    while (sceneWeights.length < numSlides) sceneWeights.push(4.0);
    const totalWeight = sceneWeights.reduce((a, b) => a + b, 0);

    const slideDurations: number[] = [];
    const slideTransitionTimes: number[] = [0];
    let accDur = 0;

    for (let i = 0; i < numSlides; i++) {
      const isLast = i === numSlides - 1;
      const d = isLast
        ? Math.max(1.5, +(totalDuration - accDur).toFixed(2))
        : Math.max(2.2, +((sceneWeights[i] / totalWeight) * totalDuration).toFixed(2));
      slideDurations.push(d);
      accDur = +(accDur + d).toFixed(2);
      if (!isLast) slideTransitionTimes.push(accDur);
    }

    // 6. Earshot v0.4.0 Ses Tasarım Bankası ile Slayt Geçişlerine Senkronize SFX Katmanı Üret
    const earshotSfxPath = await renderEarshotSfxTrackForReel({
      durationSeconds: totalDuration,
      cueTimesSeconds: slideTransitionTimes,
      isViralReel: false,
    });
    if (earshotSfxPath) {
      filesToClean.push(earshotSfxPath);
    }

    // Girdi 0: baseFramePath
    // Girdi 1: overlayHudPath
    // Girdi 2: audioResult.audioPath (Voice)
    // Girdi 3: bgmInputs (Ambience)
    // Girdi 4: srtFilePath (Closed Captions)
    // Girdi 5 .. 5+numSlides-1: slidePaths[i]
    // Girdi 5+numSlides (Opsiyonel): earshotSfxPath
    const customBgm = path.join(
      process.cwd(),
      'public',
      'assets',
      'audio',
      'sports_broadcast_bed.mp3'
    );
    const hasCustomBgm = fs.existsSync(customBgm);
    const bgmInputs = hasCustomBgm
      ? ['-stream_loop', '-1', '-i', customBgm]
      : [
          '-f',
          'lavfi',
          '-i',
          `anoisesrc=color=pink:sample_rate=48000:amplitude=0.01:duration=${totalDuration}`,
        ];

    const slideInputs: string[] = [];
    const slideFilterChains: string[] = [];
    const slideConcatLabels: string[] = [];

    for (let i = 0; i < numSlides; i++) {
      const inputIdx = 5 + i;
      const dur = slideDurations[i];
      const frames = Math.max(30, Math.ceil(dur * 30));
      slideInputs.push('-loop', '1', '-framerate', '30', '-t', String(dur), '-i', slidePaths[i]);
      slideFilterChains.push(
        `[${inputIdx}:v]zoompan=z='min(zoom+0.0008,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1024x1140:fps=30,setpts=PTS-STARTPTS[sl${i}]`
      );
      slideConcatLabels.push(`[sl${i}]`);
    }

    const earshotInputIdx = 5 + numSlides;
    const earshotInputs = earshotSfxPath ? ['-i', earshotSfxPath] : [];
    const audioMixFilter = earshotSfxPath
      ? `[3:a]aresample=48000,volume=0.08[ambience];[2:a]aresample=48000[voice];[${earshotInputIdx}:a]aresample=48000,volume=0.38[earshotSfx];[voice][ambience][earshotSfx]amix=inputs=3:duration=first:dropout_transition=2:normalize=0,alimiter=limit=0.95[aOut]`
      : `[3:a]aresample=48000,volume=0.08[ambience];[2:a]aresample=48000[voice];[voice][ambience]amix=inputs=2:duration=first:dropout_transition=2[aOut]`;

    const ffmpegArgs: string[] = [
      '-y',
      '-loop',
      '1',
      '-framerate',
      '30',
      '-t',
      String(totalDuration),
      '-i',
      composedSlides.baseFramePath,
      '-loop',
      '1',
      '-framerate',
      '30',
      '-t',
      String(totalDuration),
      '-i',
      composedSlides.overlayHudPath,
      '-i',
      audioResult.audioPath,
      ...bgmInputs,
      '-i',
      srtFilePath,
      ...slideInputs,
      ...earshotInputs,
      '-filter_complex',
      `color=c=0x2E8BC9:s=952x18:r=30:d=${totalDuration}[goldBar];` +
        `${slideFilterChains.join(';')};` +
        `${slideConcatLabels.join('')}concat=n=${numSlides}:v=1:a=0[heroAnim];` +
        `[0:v][heroAnim]overlay=28:64:shortest=1[withHero];` +
        `[withHero][goldBar]overlay=x='64-952+952*(t/${totalDuration})':y=1642:shortest=1[withProg];` +
        `[withProg][1:v]overlay=0:0:format=auto:shortest=1[withHud];` +
        `[withHud]${subtitleChain},setsar=1:1,setdar=9/16[vOut];` +
        audioMixFilter,
      '-map',
      '[vOut]',
      '-map',
      '[aOut]',
      '-map',
      '4:s:0',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level:v',
      '4.2',
      '-preset',
      'fast',
      '-crf',
      '19',
      '-r',
      '30',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '6500k',
      '-maxrate',
      '8500k',
      '-bufsize',
      '12000k',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-c:s',
      'mov_text',
      '-metadata:s:s:0',
      'language=tur',
      '-metadata:s:s:0',
      'title=Türkçe',
      '-movflags',
      '+faststart',
      '-t',
      String(totalDuration),
      outputVideoPath,
    ];

    const ffmpegPath = getFFmpegPath();
    console.log(
      `[ReelVideoGenerator] Rendering 1080x1920 30fps ${numSlides}-Slide AI Broadcast MP4 (${totalDuration}s) with Turkish Closed Captions using FFmpeg...`
    );
    const startTime = Date.now();

    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, ffmpegArgs);
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputVideoPath)) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg Reel render failed (code ${code}): ${stderr.slice(-2000)}`));
        }
      });
    });

    const elapsed = Date.now() - startTime;
    console.log(`[ReelVideoGenerator] Video rendered in ${elapsed}ms: ${outputVideoPath}`);

    // 7. Earshot BS.1770 Ses Kalite Ölçümü + Yayın Kontrolü (Quality & Editorial Assurance)
    await measureReelAudioWithEarshot(outputVideoPath).catch(() => {});

    const qualityResult = await verifyReelQuality({
      videoFilePath: outputVideoPath,
      title: params.title,
      summary: params.summary || undefined,
      sourceNewsId: params.sourceNewsId,
      skipHistoryCheck: params.skipHistoryCheck,
      slideCount: numSlides,
      hasClosedCaptions: srtContent.trim().length > 10,
      isAiVisualVerified: true,
    });

    if (!qualityResult.passed) {
      throw new Error(`Reel Yayın Kontrolü Başarısız: ${qualityResult.errors.join(', ')}`);
    }

    const videoBuffer = fs.readFileSync(outputVideoPath);

    return {
      videoBuffer,
      videoFilePath: outputVideoPath,
      durationSeconds: totalDuration,
      scriptData,
      srtContent,
      qualityResult,
    };
  } finally {
    for (const f of filesToClean) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
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
