import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { getFFmpegPath } from '../reels/reel-video-generator';
import { wrapTextToLines, getAvailableFontPath, escapeFFmpegPath } from '../reels/reels-visual-composer';
import { determineContextualReelPoll } from '../reels/reels-script-generator';
import { verifyReelQuality, ReelQualityCheckResult } from '../reels/reels-quality-checker';
import { buildSubtitleCuesFromText, buildSrtFromCues } from '../reels/caption-srt-generator';
import { getYtDlpPath, ViralVideoCandidate, sanitizeViralTitle, buildViralEditorialContext } from './viral-video-discoverer';
import { CanvaService, TRABZONSPOR_CANVA_TEMPLATES } from '../canva/canva-service';

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
  srtContent: string;
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
 * Viral videoyu yt-dlp (çoklu istemci + bulut IP koruması) ve yedek akış sunucuları ile en yüksek kalitede MP4 olarak indirir.
 */
export async function downloadViralSourceVideo(url: string, outputFilePath: string): Promise<void> {
  const ytdlp = await getYtDlpPath();
  const ffmpegPath = getFFmpegPath();

  const clientProfiles = [
    'youtube:player_client=android_vr,ios,mweb,web',
    'youtube:player_client=tv,web_embedded,android',
  ];

  for (const profile of clientProfiles) {
    try {
      if (fs.existsSync(outputFilePath)) {
        try { fs.unlinkSync(outputFilePath); } catch {}
      }
      await execFileAsync(
        ytdlp,
        [
          '--extractor-args',
          profile,
          '-f',
          'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--merge-output-format',
          'mp4',
          '--no-playlist',
          '--no-warnings',
          '--no-check-certificates',
          '--ffmpeg-location',
          ffmpegPath,
          '-o',
          outputFilePath,
          url,
        ],
        { timeout: 75000, maxBuffer: 15 * 1024 * 1024 }
      );

      if (fs.existsSync(outputFilePath) && fs.statSync(outputFilePath).size >= 15000) {
        return;
      }
    } catch (err: any) {
      console.warn(`[ViralVideoProcessor] yt-dlp profile (${profile}) warning:`, err.message?.slice(0, 160));
    }
  }

  // Yedek Aşama: Bulut veri merkezi IP'lerinde YouTube kısıtlamasına karşı doğrudan MP4 akış aynaları
  const ytMatch = url.match(/(?:shorts\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    const vidId = ytMatch[1];
    const mirrors = [
      `https://inv.nadeko.net/latest_version?id=${vidId}&itag=18`,
      `https://invidious.nerdvpn.de/latest_version?id=${vidId}&itag=18`,
      `https://yewtu.be/latest_version?id=${vidId}&itag=18`,
    ];
    for (const mirrorUrl of mirrors) {
      try {
        const res = await fetch(mirrorUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0' },
          redirect: 'follow',
          signal: AbortSignal.timeout(25000),
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 25000) {
            fs.writeFileSync(outputFilePath, buf);
            return;
          }
        }
      } catch {}
    }
  }

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
  const { cleanTitle, editorialSummary, pollQuestion, category } = params;
  const hashtags =
    category === 'Trabzon Yöresi'
      ? '#Trabzon #Karadeniz #Trabzonspor #BordoMavi #Reels'
      : '#Trabzonspor #BordoMavi #Fırtına #Trabzon #Reels';

  const questionLine =
    pollQuestion || 'Siz bu görüntüler hakkında ne düşünüyorsunuz? Görüşlerinizi yorumlarda paylaşın!';

  return [
    `🔥 ${cleanTitle.toLocaleUpperCase('tr-TR')}`,
    '',
    editorialSummary,
    '',
    `💬 ${questionLine}`,
    '',
    `👉 Trabzonspor ve Trabzon gündemini kaçırmamak için BordoMavi sayfamızı TAKİP ETMEYİ unutmayın! 🔔❤️💙`,
    '',
    `✍️ Editör`,
    '',
    hashtags,
  ].join('\n');
}

/**
 * İndirilen viral videodaki üçüncü parti sayfa logolarını/yazılarını temizler,
 * kendi Bordo-Mavi kurumsal logomuzu, manşetimizi ve senkronize kapalı açıklamalı altyazılarımızı (.srt + mov_text + ekran altyazısı)
 * ekleyerek 1080x1920 (9:16, SAR 1:1, DAR 9:16, 30fps, High Profile) yayına hazır Reels videosu üretir.
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
  const srtFilePath = path.join(tempDir, `bm_viral_cc_${timestamp}.srt`);
  const previewFramePath = path.join(tempDir, `bm_viral_preview_${timestamp}.jpg`);
  const outputVideoPath = path.join(tempDir, `bm_viral_final_${timestamp}.mp4`);
  const filesToClean: string[] = [rawVideoPath, sampleFramePath, overlayHudPath, srtFilePath];

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

    // 2.5. Senkronize Kapalı Açıklamalı Altyazı (.srt) ve Ekran Altyazı Dilimlerini Üret
    const subtitleCues = buildSubtitleCuesFromText(
      cleanTitle,
      editorialSummary,
      targetDuration,
      pollQuestion
    );
    const srtContent = buildSrtFromCues(subtitleCues);
    fs.writeFileSync(srtFilePath, srtContent, 'utf8');

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

    // 4. Kulüp Logosu Hazırlığı (En Sağ Üst Köşe 2x Büyütülmüş Kurumsal Logo Rozeti - 148x148)
    const brandLogo = path.join(process.cwd(), 'public', 'assets', 'brand', 'bordomavi-logo.png');
    const fallbackLogo = path.join(process.cwd(), 'public', 'logo.png');
    const logoPath = fs.existsSync(brandLogo) ? brandLogo : fs.existsSync(fallbackLogo) ? fallbackLogo : null;

    let badgeLogoBuf: Buffer | null = null;
    if (logoPath) {
      try {
        badgeLogoBuf = await sharp(logoPath)
          .resize({ width: 148, height: 148, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
      } catch (e: any) {
        console.warn('[ViralVideoProcessor] Logo resize warning:', e.message);
      }
    }

    // 5. 1080x1920 (Tam 9:16) Genişletilmiş Dikey Video Vitrini + Senkronize Kapalı Açıklamalı Altyazı Kartı
    // Üst bar kaldırıldı; dikey video ekranın %72'sini (1024x1280) kaplar, sağ üstte 2x Bordo-Mavi logosu yer alır.
    const width = 1080;
    const height = 1920;
    const viewportX = 28;
    const viewportY = 64;
    const viewportW = 1024;
    const viewportH = 1280;
    const progX = 64;
    const progY = 1474;
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

    // Canva Connect API ve Canva Şablon Motoru ile entegre renk ve kategori rozeti seçimi
    await CanvaService.createDesignWithConnectApi({
      title: cleanTitle,
      width: 1080,
      height: 1920,
    }).catch(() => {});

    const canvaTemplate =
      category === 'Transfer'
        ? TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'TRANSFER')!
        : category === 'Maç & Saha İçi'
        ? TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'GOAL')!
        : category === 'Taraftar & Tribün'
        ? TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'MATCH_DAY')!
        : TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'REELS')!;

    const canvaPrimary = category === 'Trabzon Yöresi' ? '#065F46' : canvaTemplate.primaryColor;
    const canvaAccent = category === 'Trabzon Yöresi' ? '#10B981' : canvaTemplate.accentColor;
    const canvaBadge =
      category === 'Trabzon Yöresi'
        ? '🌲 TRABZON YÖRESİ VİRAL'
        : canvaTemplate.badgeText;

    const atmosphereOverlaySvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="studioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${canvaPrimary}" stop-opacity="0.88"/>
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

    // Manşet satırları (x: 28, y: 1506, w: 1024, h: 190)
    const upperTitle = cleanTitle.toLocaleUpperCase('tr-TR');
    const headlineLines = wrapTextToLines(upperTitle, 31, 3);

    let headlineSvgElements = '';
    if (headlineLines.length === 1) {
      headlineSvgElements = `
        <text x="540" y="1615" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="900">${escapeXml(headlineLines[0])}</text>
      `;
    } else if (headlineLines.length === 2) {
      headlineSvgElements = `
        <text x="540" y="1588" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900">${escapeXml(headlineLines[0])}</text>
        <text x="540" y="1642" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900">${escapeXml(headlineLines[1])}</text>
      `;
    } else {
      headlineSvgElements = `
        <text x="540" y="1566" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900">${escapeXml(headlineLines[0])}</text>
        <text x="540" y="1614" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900">${escapeXml(headlineLines[1])}</text>
        <text x="540" y="1662" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900">${escapeXml(headlineLines[2])}</text>
      `;
    }

    const hudSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="50%" stop-color="#FDE68A"/>
            <stop offset="100%" stop-color="${canvaAccent}"/>
          </linearGradient>
          <linearGradient id="bordoGoldBar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${canvaPrimary}"/>
            <stop offset="50%" stop-color="#FBBF24"/>
            <stop offset="100%" stop-color="${canvaAccent}"/>
          </linearGradient>
          <filter id="dropShadow" x="-5%" y="-5%" width="110%" height="115%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
          </filter>
        </defs>

        <!-- 1. SENKRONİZE KAPALI AÇIKLAMALI ALTYAZI & İLERLEME KARTI (x: 28, y: 1358, w: 1024, h: 136) -->
        <rect x="28" y="1358" width="1024" height="136" rx="24" ry="24" fill="#070D19" fill-opacity="0.96" stroke="#1E293B" stroke-width="2" filter="url(#dropShadow)"/>
        <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="6" ry="6" fill="#1E293B" stroke="#334155" stroke-width="1"/>

        <!-- 2. MANŞET KARTI (x: 28, y: 1506, w: 1024, h: 190) -->
        <rect x="28" y="1506" width="1024" height="190" rx="28" ry="28" fill="#0B1426" fill-opacity="0.95" stroke="${canvaAccent}" stroke-opacity="0.5" stroke-width="2" filter="url(#dropShadow)"/>
        <rect x="28" y="1506" width="14" height="190" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
        <rect x="1038" y="1506" width="14" height="190" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
        ${headlineSvgElements}

        <!-- 3. TAKİPÇİ ARTIRMA & ETKİLEŞİM ÇAĞRISI (y: 1738) -->
        <rect x="160" y="1712" width="760" height="46" rx="23" ry="23" fill="${canvaPrimary}" fill-opacity="0.92" stroke="url(#goldAccent)" stroke-width="1.5"/>
        <text x="540" y="1742" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900" letter-spacing="2">🔔 BORDO MAVİ • TAKİP ET &amp; YORUM YAP</text>
      </svg>
    `);

    // Şeffaf video penceresi (28, 64, 1024, 1280) ve ilerleme çubuğu yuvası (64, 1474, 952, 12) açma maskesi
    const holeMaskSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="black"/>
        <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="6" ry="6" fill="black"/>
      </svg>
    `);

    // Video penceresi açıldıktan sonra en sağ üst köşeye 2x Bordo-Mavi Kurumsal Logo Rozetini (cx: 956, cy: 138, r: 82)
    // ve sol üst köşeye kompakt Canva kategori rozetini yerleştiriyoruz
    const videoWatermarkAndBorderSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldAccent2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="50%" stop-color="#FDE68A"/>
            <stop offset="100%" stop-color="${canvaAccent}"/>
          </linearGradient>
          <filter id="logoShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.65"/>
          </filter>
        </defs>
        <!-- Video Vitrini Altın Çerçevesi -->
        <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="none" stroke="url(#goldAccent2)" stroke-width="4"/>

        <!-- Sol Üst Kompakt Canva Kategori Rozeti -->
        <rect x="48" y="84" width="330" height="50" rx="25" ry="25" fill="${canvaPrimary}" fill-opacity="0.92" stroke="url(#goldAccent2)" stroke-width="2" filter="url(#logoShadow)"/>
        <circle cx="76" cy="109" r="7" fill="#FDE68A"/>
        <text x="96" y="117" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" letter-spacing="1.2">${escapeXml(canvaBadge)}</text>

        <!-- En Sağ Üst Köşe 2x Büyük Kurumsal Logo Rozeti (cx: 952, cy: 142, r: 82) -->
        <circle cx="952" cy="142" r="82" fill="#FFFFFF" stroke="url(#goldAccent2)" stroke-width="4" filter="url(#logoShadow)"/>

        <!-- Alt İlerleme Çubuğu Çerçevesi -->
        <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="6" ry="6" fill="none" stroke="#475569" stroke-width="1.5"/>
      </svg>
    `);

    const hudBase = await sharp(studioBgBuf)
      .composite([{ input: hudSvg, left: 0, top: 0 }])
      .ensureAlpha()
      .png()
      .toBuffer();

    const finalHudOverlays: any[] = [
      { input: holeMaskSvg, blend: 'dest-out' },
      { input: videoWatermarkAndBorderSvg, blend: 'over' },
    ];
    if (badgeLogoBuf) {
      finalHudOverlays.push({ input: badgeLogoBuf, left: 878, top: 68, blend: 'over' });
    }

    await sharp(hudBase).composite(finalHudOverlays).png().toFile(overlayHudPath);

    // 6. Senkronize Ekran Altyazısı (Closed Captions Overlay) Filtrelerini Hazırla
    const fontPath = getAvailableFontPath();
    const drawtextFilters: string[] = [];

    subtitleCues.forEach((cue, idx) => {
      const lines = wrapTextToLines(cue.text, 40, 2);
      const start = cue.startTime.toFixed(2);
      const end = cue.endTime.toFixed(2);

      lines.forEach((lineText, lineIdx) => {
        const cueFile = path.join(tempDir, `bm_vcue_${timestamp}_${idx}_${lineIdx}.txt`);
        fs.writeFileSync(cueFile, lineText, 'utf8');
        filesToClean.push(cueFile);

        const escapedCueFile = escapeFFmpegPath(cueFile);
        const yPos = lines.length === 1 ? 1402 : lineIdx === 0 ? 1380 : 1422;

        drawtextFilters.push(
          `drawtext=fontfile='${fontPath}':textfile='${escapedCueFile}':fontcolor=white:fontsize=31:x=(w-text_w)/2:y=${yPos}:shadowcolor=black@0.85:shadowx=0:shadowy=3:enable='between(t,${start},${end})'`
        );
      });
    });

    const subtitleFilterChain = drawtextFilters.length > 0 ? `,${drawtextFilters.join(',')}` : '';

    // 7. FFmpeg ile Üçüncü Parti Logoları/Yazıları Kırp + Temizle ve 9:16 Tam Kadraj Stüdyo Çerçevesine Oturt
    const isVertical = probe.height >= probe.width;
    const videoCleanFilter = isVertical
      ? `[0:v]crop=iw:ih*0.66:0:ih*0.15,scale=${viewportW}:${viewportH}:force_original_aspect_ratio=increase,crop=${viewportW}:${viewportH},eq=contrast=1.04:saturation=1.08,fps=30[cleanVid]`
      : `[0:v]scale=${viewportW}:${viewportH}:force_original_aspect_ratio=increase,crop=${viewportW}:${viewportH},eq=contrast=1.04:saturation=1.08,fps=30[cleanVid]`;

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
      '-i',
      srtFilePath,
    ];

    let audioFilter = '';
    if (probe.hasAudio) {
      audioFilter = `[0:a]aresample=48000,volume=1.05[aOut]`;
    } else if (hasCustomBgm) {
      ffmpegArgs.push('-stream_loop', '-1', '-t', String(targetDuration), '-i', customBgm);
      audioFilter = `[3:a]aresample=48000,volume=0.28[aOut]`;
    } else {
      ffmpegArgs.push(
        '-f',
        'lavfi',
        '-i',
        `anoisesrc=color=pink:sample_rate=48000:amplitude=0.01:duration=${targetDuration}`
      );
      audioFilter = `[3:a]volume=0.5[aOut]`;
    }

    const filterComplex = [
      `color=c=0x0F172A:s=${width}x${height}:r=30:d=${targetDuration}[bgCanvas]`,
      `color=c=0xFBBF24:s=${progW}x${progH}:r=30:d=${targetDuration}[goldBar]`,
      videoCleanFilter,
      `[bgCanvas][cleanVid]overlay=${viewportX}:${viewportY}:shortest=1[withVid]`,
      `[withVid][goldBar]overlay=x='${progX}-${progW}+${progW}*(t/${targetDuration})':y=${progY}:shortest=1[withProg]`,
      `[withProg][1:v]overlay=0:0:format=auto:shortest=1${subtitleFilterChain},setsar=1:1,setdar=9/16[vOut]`,
      audioFilter,
    ].join(';');

    ffmpegArgs.push(
      '-filter_complex',
      filterComplex,
      '-map',
      '[vOut]',
      '-map',
      '[aOut]',
      '-map',
      '2:s:0',
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

    // 8. Önizleme karesi çıkar (kalite kontrolü ve UI için)
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

    // 9. Kalite kontrolü
    const qualityResult = await verifyReelQuality({
      videoFilePath: outputVideoPath,
      title: cleanTitle,
      summary: editorialSummary,
      skipHistoryCheck: true,
    });

    const videoBuffer = fs.readFileSync(outputVideoPath);

    console.log(
      `[ViralVideoProcessor] ✅ Branded viral Reel ready with Turkish Closed Captions (.srt + mov_text): ${(
        videoBuffer.length /
        1024 /
        1024
      ).toFixed(2)} MB, ${targetDuration.toFixed(1)}s`
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
