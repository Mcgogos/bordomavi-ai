import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ReelScriptData } from './reels-script-generator';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

export const CURATED_REEL_BACKGROUNDS = {
  stadium: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1080&h=1920&q=80',
  fans: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1080&h=1920&q=80',
  tactics: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1080&h=1920&q=80',
  pitchNight: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1080&h=1920&q=80',
};

export interface ComposedSlidesResult {
  slidePaths: string[];
  tempFilesToClean: string[];
}

/**
 * Windows / Linux ortamlarında font dosyasını dinamik olarak tespit eder.
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
 * FFmpeg drawtext için dosya yolundaki iki noktayı kaçış karakteriyle korur.
 */
export function escapeFFmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(':', '\\:');
}

/**
 * Uzun başlıkları satırlara böler (taşmaları önlemek için).
 */
export function wrapTextToLines(text: string, maxCharsPerLine: number = 24, maxLines: number = 2): string[] {
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
  return lines.slice(0, maxLines);
}

/**
 * Harici görseli güvenle indirir.
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
 * 4 Sahneli, Profesyonel TV Yayını Standardında 1080x1920 Dikey Görseller Üretir.
 * 
 * Güvenli Alan Mimarisi:
 * - Üst Header (y: 170 - 350): Telefon çentiği ve Facebook üst butonlarının ALTINDA tam görünür alan.
 * - Orta Görsel (y: 370 - 1140): 1000x770 Altın Çerçeveli HD Haber Fotoğrafı.
 * - Alt Altyazı Sahnesi (y: 1160 - 1520): 1000x360 Koyu Cam Konteyner (Sesle senkronize altyazılar buraya oturur).
 * - Alt Arayüz Alanı (y: 1530 - 1920): Facebook mobil arayüzü ile sıfır çakışma için boş bırakılır.
 */
export async function composeReelSlides(
  scriptData: ReelScriptData,
  sourceImageUrl?: string | null
): Promise<ComposedSlidesResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slidePaths: string[] = [];
  const tempFilesToClean: string[] = [];

  // Kulüp logosu tespiti
  const brandLogo = path.join(process.cwd(), 'public', 'assets', 'brand', 'bordomavi-logo.png');
  const fallbackLogo = path.join(process.cwd(), 'public', 'logo.png');
  const logoPath = fs.existsSync(brandLogo) ? brandLogo : (fs.existsSync(fallbackLogo) ? fallbackLogo : null);
  const font = getAvailableFontPath();

  // 1. Haber Görselini İndir
  const downloadedNewsImg = path.join(tempDir, `bm_news_img_${timestamp}.jpg`);
  let hasNewsImg = false;
  if (sourceImageUrl && (sourceImageUrl.startsWith('http://') || sourceImageUrl.startsWith('https://'))) {
    hasNewsImg = await downloadImageSafe(sourceImageUrl, downloadedNewsImg);
    if (hasNewsImg) tempFilesToClean.push(downloadedNewsImg);
  }

  if (!hasNewsImg) {
    throw new Error(`Habere ait özgün ve geçerli bir görsel indirilemedi (${sourceImageUrl || 'Görsel URL bulunamadı'}). Kural 2 gereği haberle ilgisiz generic görsel ile Reels üretilemez.`);
  }

  const heroPhotoPath = downloadedNewsImg;

  // Kategoriye göre rozet başlığı
  const rawBadge = (scriptData.badgeTitle || 'BORDO MAVI OZEL').replace(/[':]/g, '').trim();

  // Outro sorusu için metin dosyası hazırla
  const outroQuestion = scriptData.scenes[3]?.subtitle || 'Sizce bu gelişme Trabzonspor için nasıl sonuçlanır?';
  const outroLines = wrapTextToLines(outroQuestion, 24, 2);
  const outroTextFile = path.join(tempDir, `bm_outro_${timestamp}.txt`);
  fs.writeFileSync(outroTextFile, outroLines.join('\n'), 'utf8');
  tempFilesToClean.push(outroTextFile);

  /**
   * Kurumsal, sade, gereksiz çizgilerden arındırılmış 100% 9:16 TV haber şablonu filtresi.
   * Görselin hiçbir kısmını kırpmaz (force_original_aspect_ratio=decrease),
   * renk karmaşası yapmadan tek ton şık koyu cam tasarım uygular.
   */
  const buildSlideFilter = (isOutro: boolean = false) => {
    let filter = 
      // 1. Arka plan: 1080x1920 ekranı doldur, derin blur ve koyulaştırma
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:10[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];`;

    if (!isOutro) {
      // 2. Ana Haber Görseli: 1000x960 alanına en-boy oranını bozmadan ve kesmeden tam sığdır
      filter += 
        `[0:v]scale=1000:960:force_original_aspect_ratio=decrease[fgScaled];` +
        `[fgScaled]pad=1000:960:(1000-iw)/2:(960-ih)/2:color=black@0[fgCentered];` +
        `[darkBg][fgCentered]overlay=40:340[withFg];`;
    } else {
      // Slayt 4 (Outro): Görsel yerine temiz koyu cam tartışma kartı
      filter += 
        `[darkBg]drawbox=x=40:y=340:w=1000:h=960:color=0x070B14@0.90:t=fill,` +
        `drawtext=fontfile='${font}':text='SIZIN GORUSUNUZ NE?':fontsize=36:fontcolor=0xFCD34D:x=(w-text_w)/2:y=450,` +
        `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(outroTextFile)}':fontsize=46:fontcolor=white:x=(w-text_w)/2:y=580:line_spacing=18,` +
        `drawbox=x=240:y=860:w=600:h=75:color=0x781324@0.95:t=fill,` +
        `drawtext=fontfile='${font}':text='YORUMLARDA BULUSALIM':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=882[withFg];`;
    }

    // 3. Üst Başlık Kartı (y: 160 - 310, telefon çentiğinin altında, sade koyu cam)
    if (logoPath) {
      filter += 
        `[1:v]scale=105:105[logo];` +
        `[withFg]drawbox=x=40:y=160:w=1000:h=150:color=0x070B14@0.92:t=fill[withHeaderCard];` +
        `[withHeaderCard][logo]overlay=60:182[withLogo];` +
        `[withLogo]drawtext=fontfile='${font}':text='BORDO MAVI HABER':fontsize=38:fontcolor=white:x=185:y=190,` +
        `drawtext=fontfile='${font}':text='HABER MERKEZI':fontsize=22:fontcolor=0x94A3B8:x=185:y=242,` +
        `drawbox=x=720:y=205:w=290:h=56:color=0x781324@0.95:t=fill,` +
        `drawtext=fontfile='${font}':text='${rawBadge}':fontsize=24:fontcolor=white:x=740:y=220[withHeader];`;
    } else {
      filter += 
        `[withFg]drawbox=x=40:y=160:w=1000:h=150:color=0x070B14@0.92:t=fill,` +
        `drawtext=fontfile='${font}':text='BORDO MAVI HABER':fontsize=38:fontcolor=white:x=60:y=190,` +
        `drawtext=fontfile='${font}':text='HABER MERKEZI':fontsize=22:fontcolor=0x94A3B8:x=60:y=242,` +
        `drawbox=x=720:y=205:w=290:h=56:color=0x781324@0.95:t=fill,` +
        `drawtext=fontfile='${font}':text='${rawBadge}':fontsize=24:fontcolor=white:x=740:y=220[withHeader];`;
    }

    // 4. Alt Altyazı Sahnesi (y: 1330 - 1630, sade koyu cam, gereksiz renkli çizgi yok)
    filter += 
      `[withHeader]drawbox=x=40:y=1330:w=1000:h=300:color=0x070B14@0.90:t=fill,` +
      `drawtext=fontfile='${font}':text='CANLI BULTEN':fontsize=22:fontcolor=0x94A3B8:x=70:y=1355[outv]`;

    return filter;
  };

  // -------------------------------------------------------------
  // SLAYT 1: Kapak & Ana Haber Tanıtımı (1080x1920)
  // -------------------------------------------------------------
  const slide1Path = path.join(tempDir, `bm_slide_1_${timestamp}.png`);
  tempFilesToClean.push(slide1Path);
  slidePaths.push(slide1Path);

  const slide1Args: string[] = ['-y'];
  if (heroPhotoPath) slide1Args.push('-i', heroPhotoPath);
  else slide1Args.push('-f', 'lavfi', '-i', 'color=c=0x3D040E:s=1080x1920:d=1:r=1');
  if (logoPath) slide1Args.push('-i', logoPath);

  slide1Args.push('-filter_complex', buildSlideFilter(false), '-map', '[outv]', '-vframes', '1', slide1Path);
  await runFFmpeg(slide1Args);

  // -------------------------------------------------------------
  // SLAYT 2: Olayın Gelişimi & Detay Kartı
  // -------------------------------------------------------------
  const slide2Path = path.join(tempDir, `bm_slide_2_${timestamp}.png`);
  tempFilesToClean.push(slide2Path);
  slidePaths.push(slide2Path);

  const slide2Args: string[] = ['-y'];
  if (heroPhotoPath) slide2Args.push('-i', heroPhotoPath);
  else slide2Args.push('-f', 'lavfi', '-i', 'color=c=0x1E1B4B:s=1080x1920:d=1:r=1');
  if (logoPath) slide2Args.push('-i', logoPath);

  slide2Args.push('-filter_complex', buildSlideFilter(false), '-map', '[outv]', '-vframes', '1', slide2Path);
  await runFFmpeg(slide2Args);

  // -------------------------------------------------------------
  // SLAYT 3: Papara Park & Taktik / Kulis Sahnesi
  // -------------------------------------------------------------
  const slide3Path = path.join(tempDir, `bm_slide_3_${timestamp}.png`);
  tempFilesToClean.push(slide3Path);
  slidePaths.push(slide3Path);

  const slide3Args: string[] = ['-y'];
  if (heroPhotoPath) slide3Args.push('-i', heroPhotoPath);
  else slide3Args.push('-f', 'lavfi', '-i', 'color=c=0x0F172A:s=1080x1920:d=1:r=1');
  if (logoPath) slide3Args.push('-i', logoPath);

  slide3Args.push('-filter_complex', buildSlideFilter(false), '-map', '[outv]', '-vframes', '1', slide3Path);
  await runFFmpeg(slide3Args);

  // -------------------------------------------------------------
  // SLAYT 4: Tartışma ve Yorum Çağrısı (Outro CTA)
  // -------------------------------------------------------------
  const slide4Path = path.join(tempDir, `bm_slide_4_${timestamp}.png`);
  tempFilesToClean.push(slide4Path);
  slidePaths.push(slide4Path);

  const slide4Args: string[] = ['-y'];
  if (heroPhotoPath) slide4Args.push('-i', heroPhotoPath);
  else slide4Args.push('-f', 'lavfi', '-i', 'color=c=0x1E1B4B:s=1080x1920:d=1:r=1');
  if (logoPath) slide4Args.push('-i', logoPath);

  slide4Args.push('-filter_complex', buildSlideFilter(true), '-map', '[outv]', '-vframes', '1', slide4Path);
  await runFFmpeg(slide4Args);

  console.log(`[VisualComposer] ✅ 4 Corporate Broadcast 1080x1920 slides generated successfully!`);

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
