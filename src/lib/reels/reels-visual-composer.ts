import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ReelScriptData } from './reels-script-generator';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

// 9:16 Dikey Formatlı Yüksek Çözünürlüklü Tematik Trabzonspor Arka Planları
export const CURATED_REEL_BACKGROUNDS = {
  stadium: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1080&h=1920&q=80',
  fans: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1080&h=1920&q=80',
  playerAction: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1080&h=1920&q=80',
  tactics: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1080&h=1920&q=80',
  pitchNight: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1080&h=1920&q=80',
};

export interface ComposedSlidesResult {
  slidePaths: string[];
  tempFilesToClean: string[];
}

/**
 * Windows / Linux ortamlarında font dosyasını tespit eder
 */
export function getAvailableFontPath(): string {
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR || 'C:\\Windows';
    const arialBd = path.join(windir, 'Fonts', 'arialbd.ttf');
    try {
      if (fs.statSync(arialBd)) {
        return arialBd.replace(/\\/g, '/').replace(':', '\\:');
      }
    } catch {}
    return 'arial';
  } else {
    const linuxDejaVu = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    try {
      if (fs.statSync(linuxDejaVu)) return linuxDejaVu;
    } catch {}
    return 'DejaVuSans';
  }
}

/**
 * Uzun başlıkları satırlara böler (drawtext için)
 */
function wrapTextToLines(text: string, maxCharsPerLine: number = 24): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 4); // En fazla 4 satır
}

/**
 * Harici görseli güvenle indirir
 */
async function downloadImageSafe(url: string, outputPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BordoMaviReels/2.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 500) {
        fs.writeFileSync(outputPath, buf);
        return true;
      }
    }
  } catch (e: any) {
    console.warn(`[VisualComposer] Image download error (${url}):`, e.message);
  }
  return false;
}

/**
 * 4 Sahneli, Canva kalitesinde 1080x1920 dikey slayt görsellerini üretir.
 */
export async function composeReelSlides(
  scriptData: ReelScriptData,
  sourceImageUrl?: string | null
): Promise<ComposedSlidesResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slidePaths: string[] = [];
  const tempFilesToClean: string[] = [];

  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const hasLogo = fs.existsSync(logoPath);
  const font = getAvailableFontPath();

  // Renk Paleti (BordoMavi kurumsal)
  const isTransfer = scriptData.category === 'TRANSFER';
  const isDerby = scriptData.category === 'MATCH_PREVIEW';
  const bgColor = isTransfer ? '0x3D040E' : isDerby ? '0x0B1B36' : '0x450A14';

  // 1. Haber Görselini İndir
  const downloadedNewsImg = path.join(tempDir, `bm_news_img_${timestamp}.jpg`);
  let hasNewsImg = false;
  if (sourceImageUrl && (sourceImageUrl.startsWith('http://') || sourceImageUrl.startsWith('https://'))) {
    hasNewsImg = await downloadImageSafe(sourceImageUrl, downloadedNewsImg);
    if (hasNewsImg) tempFilesToClean.push(downloadedNewsImg);
  }

  // Yedek stadyum görselini indir
  const downloadedStadiumImg = path.join(tempDir, `bm_stadium_${timestamp}.jpg`);
  const hasStadiumImg = await downloadImageSafe(CURATED_REEL_BACKGROUNDS.stadium, downloadedStadiumImg);
  if (hasStadiumImg) tempFilesToClean.push(downloadedStadiumImg);

  // -------------------------------------------------------------
  // SLAYT 1: Canva Kalitesinde Giriş ve Kapak Kartı (1080x1920)
  // -------------------------------------------------------------
  const slide1Path = path.join(tempDir, `bm_slide_1_${timestamp}.png`);
  tempFilesToClean.push(slide1Path);
  slidePaths.push(slide1Path);

  const titleLines = wrapTextToLines(scriptData.title, 22);
  let titleFilter = '';
  const startY = 820;
  titleLines.forEach((line, idx) => {
    const escapedLine = line.replace(/'/g, '').replace(/:/g, '\\:').trim();
    titleFilter += `,drawtext=fontfile='${font}':text='${escapedLine}':fontsize=62:fontcolor=white:x=(w-text_w)/2:y=${startY + idx * 75}`;
  });

  const escapedBadge = scriptData.badgeTitle.replace(/'/g, '').replace(/:/g, '\\:');
  const slide1Args: string[] = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=${bgColor}:s=1080x1920:d=1:r=1`,
  ];

  if (hasLogo) {
    slide1Args.push('-i', logoPath);
    slide1Args.push(
      '-filter_complex',
      `[1:v]scale=200:200[logo];` +
      `[0:v]drawbox=x=60:y=60:w=960:h=1800:color=white@0.08:t=fill,` +
      `drawbox=x=60:y=60:w=960:h=1800:color=0xF59E0B@0.4:t=3,` +
      `drawbox=x=290:y=420:w=500:h=70:color=0xDC2626@0.9:t=fill,` +
      `drawtext=fontfile='${font}':text='${escapedBadge}':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=440` +
      `${titleFilter},` +
      `drawbox=x=140:y=1220:w=800:h=140:color=black@0.65:t=fill,` +
      `drawtext=fontfile='${font}':text='BORDO MAVI OZEL HABER MERKEZI':fontsize=28:fontcolor=0x38BDF8:x=(w-text_w)/2:y=1255,` +
      `drawtext=fontfile='${font}':text='CANLI REELS BULTENI':fontsize=22:fontcolor=white@0.8:x=(w-text_w)/2:y=1300[bg];` +
      `[bg][logo]overlay=(W-w)/2:180[outv]`,
      '-map', '[outv]'
    );
  } else {
    slide1Args.push(
      '-filter_complex',
      `[0:v]drawbox=x=60:y=60:w=960:h=1800:color=white@0.08:t=fill,` +
      `drawbox=x=290:y=420:w=500:h=70:color=0xDC2626@0.9:t=fill,` +
      `drawtext=fontfile='${font}':text='${escapedBadge}':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=440` +
      `${titleFilter}[outv]`,
      '-map', '[outv]'
    );
  }

  slide1Args.push('-vframes', '1', slide1Path);
  await runFFmpeg(slide1Args);

  // -------------------------------------------------------------
  // SLAYT 2: Haber Görseli Odaklı Sahne (Blurred Backdrop + Sharp FG)
  // -------------------------------------------------------------
  const slide2Path = path.join(tempDir, `bm_slide_2_${timestamp}.png`);
  tempFilesToClean.push(slide2Path);
  slidePaths.push(slide2Path);

  const mainPhotoPath = hasNewsImg ? downloadedNewsImg : (hasStadiumImg ? downloadedStadiumImg : slide1Path);
  const slide2Args: string[] = [
    '-y',
    '-i', mainPhotoPath,
  ];

  if (hasLogo) {
    slide2Args.push('-i', logoPath);
    slide2Args.push(
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:10[blurBg];` +
      `[0:v]scale=980:980:force_original_aspect_ratio=decrease[fgImg];` +
      `[1:v]scale=120:120[logo];` +
      `[blurBg][fgImg]overlay=(W-w)/2:320[withFg];` +
      `[withFg]drawbox=x=0:y=1350:w=1080:h=350:color=black@0.75:t=fill,` +
      `drawbox=x=50:y=1380:w=320:h=50:color=0x2563EB@0.9:t=fill,` +
      `drawtext=fontfile='${font}':text='SICAK GELISME':fontsize=26:fontcolor=white:x=80:y=1392[withBox];` +
      `[withBox][logo]overlay=60:80[outv]`,
      '-map', '[outv]'
    );
  } else {
    slide2Args.push(
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:10[blurBg];` +
      `[0:v]scale=980:980:force_original_aspect_ratio=decrease[fgImg];` +
      `[blurBg][fgImg]overlay=(W-w)/2:320[outv]`,
      '-map', '[outv]'
    );
  }
  slide2Args.push('-vframes', '1', slide2Path);
  await runFFmpeg(slide2Args);

  // -------------------------------------------------------------
  // SLAYT 3: Papara Park & Taktik / Detay Sahnesi
  // -------------------------------------------------------------
  const slide3Path = path.join(tempDir, `bm_slide_3_${timestamp}.png`);
  tempFilesToClean.push(slide3Path);
  slidePaths.push(slide3Path);

  const stadiumPhotoPath = hasStadiumImg ? downloadedStadiumImg : (hasNewsImg ? downloadedNewsImg : slide1Path);
  const slide3Args: string[] = [
    '-y',
    '-i', stadiumPhotoPath,
  ];

  if (hasLogo) {
    slide3Args.push('-i', logoPath);
    slide3Args.push(
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[fullBg];` +
      `[1:v]scale=120:120[logo];` +
      `[fullBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.6:t=fill,` +
      `drawbox=x=60:y=1300:w=960:h=260:color=0x0F172A@0.85:t=fill,` +
      `drawbox=x=60:y=1300:w=960:h=260:color=0x38BDF8@0.5:t=3,` +
      `drawtext=fontfile='${font}':text='PERDE ARKASI':fontsize=30:fontcolor=0xFCD34D:x=(w-text_w)/2:y=1340,` +
      `drawtext=fontfile='${font}':text='BORDO MAVI TAKTIK VE KULIS':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=1400[withBox];` +
      `[withBox][logo]overlay=60:80[outv]`,
      '-map', '[outv]'
    );
  } else {
    slide3Args.push(
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[outv]`,
      '-map', '[outv]'
    );
  }
  slide3Args.push('-vframes', '1', slide3Path);
  await runFFmpeg(slide3Args);

  // -------------------------------------------------------------
  // SLAYT 4: Yorum & Tartışma Kancası (Outro CTA)
  // -------------------------------------------------------------
  const slide4Path = path.join(tempDir, `bm_slide_4_${timestamp}.png`);
  tempFilesToClean.push(slide4Path);
  slidePaths.push(slide4Path);

  const outroQuestion = scriptData.scenes[3]?.subtitle || 'Sizin gorusunuz nedir?';
  const outroLines = wrapTextToLines(outroQuestion, 24);
  let outroFilter = '';
  outroLines.forEach((line, idx) => {
    const escaped = line.replace(/'/g, '').replace(/:/g, '\\:').trim();
    outroFilter += `,drawtext=fontfile='${font}':text='${escaped}':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=${780 + idx * 70}`;
  });

  const slide4Args: string[] = [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=0x1E1B4B:s=1080x1920:d=1:r=1',
  ];

  if (hasLogo) {
    slide4Args.push('-i', logoPath);
    slide4Args.push(
      '-filter_complex',
      `[1:v]scale=220:220[logo];` +
      `[0:v]drawbox=x=60:y=60:w=960:h=1800:color=white@0.06:t=fill,` +
      `drawbox=x=60:y=60:w=960:h=1800:color=0xF59E0B@0.4:t=3,` +
      `drawbox=x=260:y=480:w=560:h=80:color=0xF59E0B@0.9:t=fill,` +
      `drawtext=fontfile='${font}':text='SIZIN GORUSUNUZ?':fontsize=36:fontcolor=black:x=(w-text_w)/2:y=504` +
      `${outroFilter},` +
      `drawbox=x=140:y=1250:w=800:h=120:color=0x781324@0.9:t=fill,` +
      `drawtext=fontfile='${font}':text='YORUMLARDA BULUSALIM':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=1290,` +
      `drawtext=fontfile='${font}':text='Bordo Mavi Haber Takip Et':fontsize=24:fontcolor=white@0.7:x=(w-text_w)/2:y=1440[bg];` +
      `[bg][logo]overlay=(W-w)/2:220[outv]`,
      '-map', '[outv]'
    );
  } else {
    slide4Args.push(
      '-filter_complex',
      `[0:v]drawbox=x=60:y=60:w=960:h=1800:color=white@0.06:t=fill${outroFilter}[outv]`,
      '-map', '[outv]'
    );
  }
  slide4Args.push('-vframes', '1', slide4Path);
  await runFFmpeg(slide4Args);

  console.log(`[VisualComposer] ✅ 4 Canva-grade 1080x1920 slides generated successfully!`);

  return {
    slidePaths,
    tempFilesToClean
  };
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args);
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg visual composer error (code ${code}): ${stderr.slice(-300)}`));
    });
  });
}
