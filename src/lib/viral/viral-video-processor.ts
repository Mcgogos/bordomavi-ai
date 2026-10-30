import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { getFFmpegPath } from '../reels/reel-video-generator';
import { wrapTextToLines } from '../reels/reels-visual-composer';
import { determineContextualReelPoll } from '../reels/reels-script-generator';
import { verifyReelQuality, ReelQualityCheckResult } from '../reels/reels-quality-checker';
import { getYtDlpPath, ViralVideoCandidate, sanitizeViralTitle, buildViralEditorialContext } from './viral-video-discoverer';

const execFileAsync = promisify(execFile);

export interface ProcessedViralReelResult {
  videoBuffer: Buffer;
  videoFilePath: string;
  previewFramePath: string;
  durationSeconds: number;
  cleanTitle: string;
  editorialSummary: string;
  pollQuestion: string;
  caption: string;
  qualityResult: ReelQualityCheckResult;
}

interface VideoProbeInfo {
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * FFmpeg -i çıktısından video çözünürlüğü, süresi ve ses kanalı bilgisini okur.
 */
export async function probeVideoFile(filePath: string): Promise<VideoProbeInfo> {
  const ffmpeg = getFFmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ['-hide_banner', '-i', filePath]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', () => {
      let width = 1080;
      let height = 1920;
      let durationSeconds = 20;
      const hasAudio = /Stream #\d+:\d+.*Audio:/i.test(stderr);

      const dimMatch = stderr.match(/Stream #\d+:\d+.*Video:.*?\b(\d{3,4})x(\d{3,4})\b/);
      if (dimMatch) {
        width = parseInt(dimMatch[1], 10);
        height = parseInt(dimMatch[2], 10);
      }

      const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
      if (durMatch) {
        durationSeconds =
          parseInt(durMatch[1], 10) * 3600 +
          parseInt(durMatch[2], 10) * 60 +
          parseFloat(durMatch[3]);
      }

      resolve({ width, height, durationSeconds, hasAudio });
    });
    proc.on('error', () => {
      resolve({ width: 1080, height: 1920, durationSeconds: 20, hasAudio: true });
    });
  });
}

/**
 * Viral videoyu yt-dlp ile en yüksek kalitede MP4 olarak indirir.
 */
export async function downloadViralSourceVideo(url: string, outputFilePath: string): Promise<void> {
  const ytdlp = await getYtDlpPath();
  const ffmpegPath = getFFmpegPath();

  await execFileAsync(
    ytdlp,
    [
      '-f',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format',
      'mp4',
      '--no-playlist',
      '--no-warnings',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      outputFilePath,
      url,
    ],
    { timeout: 90000, maxBuffer: 15 * 1024 * 1024 }
  );

  if (!fs.existsSync(outputFilePath) || fs.statSync(outputFilePath).size < 10000) {
    throw new Error(`Viral video indirilemedi veya dosya bozuk: ${url}`);
  }
}

/**
 * Paylaşılacak viral Reels için güçlü, etkileşim odaklı ve %100 özgün Türkçe Facebook açıklaması üretir.
 */
export function generateViralReelCaption(params: {
  cleanTitle: string;
  editorialSummary: string;
  pollQuestion?: string;
  category: string;
}): string {
  const { cleanTitle, editorialSummary, category } = params;
  const hashtags =
    category === 'Trabzon Yöresi'
      ? '#Trabzon #Karadeniz #TrabzonYöresi #Horon #Uzungöl #Trabzonspor #BordoMavi #Reels #Keşfet'
      : '#Trabzonspor #BordoMavi #Fırtına #Trabzon #TS #BordoMaviHaber #Reels #Keşfet';

  return [
    `🔥 ${cleanTitle.toLocaleUpperCase('tr-TR')}`,
    '',
    editorialSummary,
    '',
    `💬 Siz bu görüntüler hakkında ne düşünüyorsunuz? Görüşlerinizi yorumlarda paylaşın!`,
    '',
    `✍️ Editör`,
    '',
    hashtags,
  ].join('\n');
}

/**
 * İndirilen viral videodaki üçüncü parti sayfa logolarını/yazılarını temizler,
 * kendi Bordo-Mavi kurumsal logomuzu, manşetimizi ve bağlama duyarlı taraftar anketimizi ekleyerek
 * 1080x1920 (30fps) yayına hazır Reels videosu üretir.
 */
export async function processViralVideoIntoBrandedReel(params: {
  candidate: ViralVideoCandidate;
  customHeadline?: string;
  maxDurationSeconds?: number;
}): Promise<ProcessedViralReelResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const rawVideoPath = path.join(tempDir, `bm_viral_raw_${timestamp}.mp4`);
  const sampleFramePath = path.join(tempDir, `bm_viral_sample_${timestamp}.jpg`);
  const overlayHudPath = path.join(tempDir, `bm_viral_hud_${timestamp}.png`);
  const previewFramePath = path.join(tempDir, `bm_viral_preview_${timestamp}.jpg`);
  const outputVideoPath = path.join(tempDir, `bm_viral_final_${timestamp}.mp4`);
  const filesToClean: string[] = [rawVideoPath, sampleFramePath, overlayHudPath];

  const isRegion = params.candidate.category === 'Trabzon Yöresi';
  const cleanTitle = sanitizeViralTitle(
    params.customHeadline || params.candidate.cleanTitle || params.candidate.rawTitle,
    isRegion
  );
  const { summary: editorialSummary, category } = buildViralEditorialContext(
    cleanTitle,
    params.candidate.editorialSummary,
    isRegion ? 'Trabzon Yöresi' : undefined
  );
  const pollData = determineContextualReelPoll(cleanTitle, editorialSummary, category);
  const pollQuestion = typeof pollData === 'string' ? pollData : pollData.pollQuestion;
  const caption = generateViralReelCaption({
    cleanTitle,
    editorialSummary,
    pollQuestion,
    category,
  });

  console.log(`[ViralVideoProcessor] 🎬 Processing viral video: "${cleanTitle}" (${params.candidate.url})`);

  try {
    // 1. Kaynak videoyu indir
    await downloadViralSourceVideo(params.candidate.url, rawVideoPath);

    // 2. Çözünürlük, süre ve ses bilgisini analiz et
    const probe = await probeVideoFile(rawVideoPath);
    const maxDur = params.maxDurationSeconds || 42;
    const targetDuration = Math.max(6, Math.min(probe.durationSeconds, maxDur));

    console.log(
      `[ViralVideoProcessor] Source probed: ${probe.width}x${probe.height}, duration=${probe.durationSeconds.toFixed(
        1
      )}s -> target=${targetDuration.toFixed(1)}s, hasAudio=${probe.hasAudio}`
    );

    // 3. Arka plan atmosferi için videonun 1.5. saniyesinden bir kare çıkar
    const ffmpeg = getFFmpegPath();
    await execFileAsync(
      ffmpeg,
      [
        '-y',
        '-ss',
        String(Math.min(1.5, targetDuration / 2)),
        '-i',
        rawVideoPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        sampleFramePath,
      ],
      { timeout: 15000 }
    );

    // 4. Kulüp Logosu Hazırlığı (Üst Bar için 88x88 ve Video Üzeri Filigran için 54x54)
    const brandLogo = path.join(process.cwd(), 'public', 'assets', 'brand', 'bordomavi-logo.png');
    const fallbackLogo = path.join(process.cwd(), 'public', 'logo.png');
    const logoPath = fs.existsSync(brandLogo) ? brandLogo : fs.existsSync(fallbackLogo) ? fallbackLogo : null;

    let headerLogoBuf: Buffer | null = null;
    let badgeLogoBuf: Buffer | null = null;
    if (logoPath) {
      try {
        headerLogoBuf = await sharp(logoPath)
          .resize({ width: 88, height: 88, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
        badgeLogoBuf = await sharp(logoPath)
          .resize({ width: 112, height: 112, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
      } catch (e: any) {
        console.warn('[ViralVideoProcessor] Logo resize warning:', e.message);
      }
    }

    // 5. 1080x1920 Bordo-Mavi Viral Stüdyo HUD Katmanını Oluştur (Anket Kartı Kaldırıldı, Geniş Dikey Video Vitrini)
    // Dikey Video Vitrini: x=36, y=205, w=1008, h=1185
    const width = 1080;
    const height = 1920;
    const viewportX = 36;
    const viewportY = 205;
    const viewportW = 1008;
    const viewportH = 1185;
    const progX = 64;
    const progY = 1408;
    const progW = 952;
    const progH = 12;

    const blurredBackdrop = fs.existsSync(sampleFramePath)
      ? await sharp(sampleFramePath)
          .resize(width, height, { fit: 'cover', position: 'center' })
          .blur(45)
          .modulate({ brightness: 0.22, saturation: 1.35 })
          .ensureAlpha()
          .toBuffer()
      : await sharp({
          create: { width, height, channels: 4, background: { r: 12, g: 19, b: 36, alpha: 1 } },
        })
          .png()
          .toBuffer();

    const atmosphereOverlaySvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="studioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3B0718" stop-opacity="0.88"/>
            <stop offset="35%" stop-color="#091326" stop-opacity="0.93"/>
            <stop offset="75%" stop-color="#060B16" stop-opacity="0.96"/>
            <stop offset="100%" stop-color="#04070F" stop-opacity="0.98"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#studioGrad)"/>
      </svg>
    `);

    const studioBgBuf = await sharp(blurredBackdrop)
      .composite([{ input: atmosphereOverlaySvg, blend: 'over' }])
      .ensureAlpha()
      .png()
      .toBuffer();

    // Manşet satırları (x: 36, y: 1435, w: 1008, h: 215)
    const upperTitle = cleanTitle.toLocaleUpperCase('tr-TR');
    const headlineLines = wrapTextToLines(upperTitle, 31, 3);

    let headlineSvgElements = '';
    if (headlineLines.length === 1) {
      headlineSvgElements = `
        <text x="540" y="1556" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900">${escapeXml(headlineLines[0])}</text>
      `;
    } else if (headlineLines.length === 2) {
      headlineSvgElements = `
        <text x="540" y="1526" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="41" font-weight="900">${escapeXml(headlineLines[0])}</text>
        <text x="540" y="1584" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="41" font-weight="900">${escapeXml(headlineLines[1])}</text>
      `;
    } else {
      headlineSvgElements = `
        <text x="540" y="1504" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="37" font-weight="900">${escapeXml(headlineLines[0])}</text>
        <text x="540" y="1554" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="37" font-weight="900">${escapeXml(headlineLines[1])}</text>
        <text x="540" y="1604" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="37" font-weight="900">${escapeXml(headlineLines[2])}</text>
      `;
    }

    const hudSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="50%" stop-color="#FDE68A"/>
            <stop offset="100%" stop-color="#38BDF8"/>
          </linearGradient>
          <linearGradient id="bordoGoldBar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#E11D48"/>
            <stop offset="50%" stop-color="#FBBF24"/>
            <stop offset="100%" stop-color="#38BDF8"/>
          </linearGradient>
          <filter id="dropShadow" x="-5%" y="-5%" width="110%" height="115%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
          </filter>
        </defs>

        <!-- 1. ÜST KURUMSAL YAYIN BARI (y: 65 .. 185) -->
        <rect x="36" y="65" width="1008" height="120" rx="30" ry="30" fill="#0B1324" fill-opacity="0.94" stroke="url(#goldAccent)" stroke-width="2" filter="url(#dropShadow)"/>
        <circle cx="104" cy="125" r="46" fill="#FFFFFF"/>
        <text x="174" y="121" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="35" font-weight="900" letter-spacing="1.5">BORDO MAVİ HABER</text>
        <text x="174" y="156" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="bold" letter-spacing="2">🔥 SOSYAL MEDYADA VİRAL GÜNDEM</text>

        <!-- 2. MANŞET KARTI (x: 36, y: 1435, w: 1008, h: 215) -->
        <rect x="36" y="1435" width="1008" height="215" rx="28" ry="28" fill="#0B1426" fill-opacity="0.95" stroke="#334155" stroke-width="2" filter="url(#dropShadow)"/>
        <rect x="36" y="1435" width="14" height="215" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
        <rect x="1030" y="1435" width="14" height="215" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
        ${headlineSvgElements}

        <!-- 3. ALT GÜVENLİ BÖLGE İMZASI -->
        <text x="540" y="1700" text-anchor="middle" fill="#94A3B8" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" letter-spacing="3">BORDO MAVİ • TARAFTARIN SESİ • YORUMLARDA BULUŞALIM</text>
      </svg>
    `);

    // Şeffaf video penceresi (36, 205, 1008, 945) ve ilerleme çubuğu yuvası (64, 1166, 952, 12) açma maskesi
    const holeMaskSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="black"/>
        <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="6" ry="6" fill="black"/>
      </svg>
    `);

    // Video penceresi açıldıktan sonra videonun sağ üst köşesine kendi Bordo-Mavi Kurumsal Logo Filigran Rozetimizi
    // ve çerçeveyi yerleştiriyoruz (böylece videonun üzerinde kendi logomuz yer alır ve olası iç köşe izleri de kapanır)
    const videoWatermarkAndBorderSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldAccent2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="50%" stop-color="#FDE68A"/>
            <stop offset="100%" stop-color="#38BDF8"/>
          </linearGradient>
          <filter id="logoShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.55"/>
          </filter>
        </defs>
        <!-- Video Vitrini Altın Çerçevesi -->
        <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="none" stroke="url(#goldAccent2)" stroke-width="4"/>

        <!-- Video İçi En Sağ Üst Köşe 2x Büyük Kurumsal Logo Rozeti (Yazısız, cx: 962, cy: 285, r: 60) -->
        <circle cx="962" cy="285" r="60" fill="#FFFFFF" stroke="url(#goldAccent2)" stroke-width="3.5" filter="url(#logoShadow)"/>

        <!-- Alt İlerleme Çubuğu Çerçevesi -->
        <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="6" ry="6" fill="none" stroke="#475569" stroke-width="1.5"/>
      </svg>
    `);

    const hudBase = await sharp(studioBgBuf)
      .composite([
        { input: hudSvg, left: 0, top: 0 },
        ...(headerLogoBuf ? [{ input: headerLogoBuf, left: 60, top: 81 }] : []),
      ])
      .ensureAlpha()
      .png()
      .toBuffer();

    const finalHudOverlays: any[] = [
      { input: holeMaskSvg, blend: 'dest-out' },
      { input: videoWatermarkAndBorderSvg, blend: 'over' },
    ];
    if (badgeLogoBuf) {
      finalHudOverlays.push({ input: badgeLogoBuf, left: 906, top: 229, blend: 'over' });
    }

    await sharp(hudBase).composite(finalHudOverlays).png().toFile(overlayHudPath);

    // 6. FFmpeg ile Üçüncü Parti Logoları/Yazıları Kırp + Temizle ve Bordo-Mavi Stüdyo Çerçevesine Oturt
    // - Kaynak dikey videoda (9:16) üçüncü parti sayfalar (61saat, TikTok, Reels vb.) logolarını
    //   üst %16 (y: 0..307) ve alt %20 (y: 1536..1920) bantlarına koyar.
    // - Bu iki bandı tamamen kesip (crop=iw:ih*0.64:0:ih*0.16) ortadaki tertemiz aksiyon alanını
    //   1008x960 vitrinimize (increase + center crop) yerleştiriyoruz ve hafif renk canlılığı (contrast=1.03, saturation=1.06) ekliyoruz.
    const isVertical = probe.height >= probe.width;
    const videoCleanFilter = isVertical
      ? `[0:v]crop=iw:ih*0.64:0:ih*0.16,scale=${viewportW}:${viewportH}:force_original_aspect_ratio=increase,crop=${viewportW}:${viewportH},eq=contrast=1.03:saturation=1.06,fps=30[cleanVid]`
      : `[0:v]scale=${viewportW}:${viewportH}:force_original_aspect_ratio=increase,crop=${viewportW}:${viewportH},eq=contrast=1.03:saturation=1.06,fps=30[cleanVid]`;

    const customBgm = path.join(process.cwd(), 'public', 'assets', 'audio', 'sports_broadcast_bed.mp3');
    const hasCustomBgm = fs.existsSync(customBgm);

    const ffmpegArgs: string[] = [
      '-y',
      '-t',
      String(targetDuration),
      '-i',
      rawVideoPath,
      '-loop',
      '1',
      '-framerate',
      '30',
      '-t',
      String(targetDuration),
      '-i',
      overlayHudPath,
    ];

    let audioFilter = '';
    if (probe.hasAudio) {
      audioFilter = `[0:a]aresample=44100,volume=1.0[aOut]`;
    } else if (hasCustomBgm) {
      ffmpegArgs.push('-stream_loop', '-1', '-t', String(targetDuration), '-i', customBgm);
      audioFilter = `[2:a]aresample=44100,volume=0.25[aOut]`;
    } else {
      ffmpegArgs.push(
        '-f',
        'lavfi',
        '-i',
        `anoisesrc=color=pink:sample_rate=44100:amplitude=0.01:duration=${targetDuration}`
      );
      audioFilter = `[2:a]volume=0.5[aOut]`;
    }

    const filterComplex = [
      `color=c=0x0F172A:s=${width}x${height}:r=30:d=${targetDuration}[bgCanvas]`,
      `color=c=0xFBBF24:s=${progW}x${progH}:r=30:d=${targetDuration}[goldBar]`,
      videoCleanFilter,
      `[bgCanvas][cleanVid]overlay=${viewportX}:${viewportY}:shortest=1[withVid]`,
      `[withVid][goldBar]overlay=x='${progX}-${progW}+${progW}*(t/${targetDuration})':y=${progY}:shortest=1[withProg]`,
      `[withProg][1:v]overlay=0:0:format=auto:shortest=1[vOut]`,
      audioFilter,
    ].join(';');

    ffmpegArgs.push(
      '-filter_complex',
      filterComplex,
      '-map',
      '[vOut]',
      '-map',
      '[aOut]',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-r',
      '30',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '4500k',
      '-maxrate',
      '5500k',
      '-bufsize',
      '8500k',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '44100',
      '-movflags',
      '+faststart',
      '-t',
      String(targetDuration),
      outputVideoPath
    );

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, ffmpegArgs);
      let stderrLog = '';
      proc.stderr.on('data', (chunk) => {
        stderrLog += chunk.toString();
      });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputVideoPath)) {
          resolve();
        } else {
          reject(new Error(`FFmpeg viral render failed (code ${code}): ${stderrLog.slice(-600)}`));
        }
      });
      proc.on('error', (err) => reject(err));
    });

    // 7. Önizleme karesi çıkar (kalite kontrolü ve UI için)
    await execFileAsync(
      ffmpeg,
      [
        '-y',
        '-ss',
        String(Math.min(2.0, targetDuration / 2)),
        '-i',
        outputVideoPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        previewFramePath,
      ],
      { timeout: 15000 }
    );

    // 8. Kalite kontrolü
    const qualityResult = await verifyReelQuality({
      videoFilePath: outputVideoPath,
      title: cleanTitle,
      summary: editorialSummary,
      skipHistoryCheck: true,
    });

    const videoBuffer = fs.readFileSync(outputVideoPath);

    console.log(
      `[ViralVideoProcessor] ✅ Branded viral Reel ready: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB, ${targetDuration.toFixed(1)}s`
    );

    return {
      videoBuffer,
      videoFilePath: outputVideoPath,
      previewFramePath,
      durationSeconds: targetDuration,
      cleanTitle,
      editorialSummary,
      pollQuestion,
      caption,
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
