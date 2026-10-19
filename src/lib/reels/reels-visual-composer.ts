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

  // 2. Yedek Stadyum Görseli
  const downloadedStadiumImg = path.join(tempDir, `bm_stadium_${timestamp}.jpg`);
  const hasStadiumImg = await downloadImageSafe(CURATED_REEL_BACKGROUNDS.stadium, downloadedStadiumImg);
  if (hasStadiumImg) tempFilesToClean.push(downloadedStadiumImg);

  const heroPhotoPath = hasNewsImg ? downloadedNewsImg : (hasStadiumImg ? downloadedStadiumImg : null);

  // Kategoriye göre rozet
  const isTransfer = scriptData.category === 'TRANSFER';
  const badgeBg = isTransfer ? '0xDC2626@0.95' : '0x2563EB@0.95';
  const badgeBorder = isTransfer ? '0xF59E0B@0.9' : '0x38BDF8@0.9';
  const rawBadge = (scriptData.badgeTitle || (isTransfer ? 'FLAS TRANSFER' : 'SICAK HABER')).replace(/[':]/g, '').trim();

  // -------------------------------------------------------------
  // SLAYT 1: Kapak & Ana Haber Tanıtımı (1080x1920)
  // -------------------------------------------------------------
  const slide1Path = path.join(tempDir, `bm_slide_1_${timestamp}.png`);
  tempFilesToClean.push(slide1Path);
  slidePaths.push(slide1Path);

  const slide1Args: string[] = ['-y'];
  if (heroPhotoPath) slide1Args.push('-i', heroPhotoPath);
  else slide1Args.push('-f', 'lavfi', '-i', 'color=c=0x3D040E:s=1080x1920:d=1:r=1');

  let s1Filter = '';
  if (logoPath) {
    slide1Args.push('-i', logoPath);
    s1Filter = 
      // 1. Arka planı doldur ve koyulaştır
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];` +
      // 2. Ana görseli 1000x770 altın çerçeveli televizyon penceresi yap
      `[0:v]scale=1000:770:force_original_aspect_ratio=increase,crop=1000:770[fgCrop];` +
      `[fgCrop]drawbox=x=0:y=0:w=1000:h=770:color=0xF59E0B@0.95:t=4[fgBox];` +
      // 3. Logo
      `[1:v]scale=130:130[logo];` +
      // 4. Katmanları birleştir
      `[darkBg][fgBox]overlay=40:370[withFg];` +
      // 5. Üst kurumsal başlık bandı (y: 170 - 350 - Telefon çentiği ve Facebook butonlarının altında)
      `[withFg]drawbox=x=40:y=170:w=1000:h=180:color=0x0F172A@0.92:t=fill,` +
      `drawbox=x=40:y=170:w=1000:h=180:color=0xF59E0B@0.5:t=2,` +
      `drawbox=x=670:y=200:w=340:h=60:color=${badgeBg}:t=fill,` +
      `drawbox=x=670:y=200:w=340:h=60:color=${badgeBorder}:t=2,` +
      `drawtext=fontfile='${font}':text='${rawBadge}':fontsize=28:fontcolor=white:x=695:y=215,` +
      `drawtext=fontfile='${font}':text='BORDO MAVI HABER':fontsize=38:fontcolor=white:x=205:y=200,` +
      `drawtext=fontfile='${font}':text='CANLI REELS BULTENI':fontsize=24:fontcolor=0x38BDF8:x=205:y=255[withHeader];` +
      `[withHeader][logo]overlay=58:195[withLogo];` +
      // 6. Görsel üstü canlı haber ticker'ı
      `[withLogo]drawbox=x=60:y=390:w=360:h=50:color=0xDC2626@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='FLAS GELISME':fontsize=26:fontcolor=white:x=85:y=402,` +
      // 7. Alt Altyazı Cam Sahnesi (y: 1160 - 1520)
      `drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0xF59E0B@0.65:t=3,` +
      `drawbox=x=60:y=1180:w=260:h=40:color=0xDC2626@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='CANLI AKTARIM':fontsize=22:fontcolor=white:x=90:y=1190[outv]`;
  } else {
    s1Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];` +
      `[0:v]scale=1000:770:force_original_aspect_ratio=increase,crop=1000:770[fgCrop];` +
      `[fgCrop]drawbox=x=0:y=0:w=1000:h=770:color=0xF59E0B@0.95:t=4[fgBox];` +
      `[darkBg][fgBox]overlay=40:370[withFg];` +
      `[withFg]drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0xF59E0B@0.65:t=3[outv]`;
  }

  slide1Args.push('-filter_complex', s1Filter, '-map', '[outv]', '-vframes', '1', slide1Path);
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

  let s2Filter = '';
  if (logoPath) {
    slide2Args.push('-i', logoPath);
    s2Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];` +
      `[0:v]scale=1000:770:force_original_aspect_ratio=increase,crop=1000:770[fgCrop];` +
      `[fgCrop]drawbox=x=0:y=0:w=1000:h=770:color=0x2563EB@0.95:t=4[fgBox];` +
      `[1:v]scale=130:130[logo];` +
      `[darkBg][fgBox]overlay=40:370[withFg];` +
      // Üst Başlık (y: 170 - 350)
      `[withFg]drawbox=x=40:y=170:w=1000:h=180:color=0x0F172A@0.92:t=fill,` +
      `drawbox=x=40:y=170:w=1000:h=180:color=0x38BDF8@0.5:t=2,` +
      `drawbox=x=670:y=200:w=340:h=60:color=0x2563EB@0.95:t=fill,` +
      `drawbox=x=670:y=200:w=340:h=60:color=0x38BDF8@0.9:t=2,` +
      `drawtext=fontfile='${font}':text='CANLI GELISME':fontsize=28:fontcolor=white:x=695:y=215,` +
      `drawtext=fontfile='${font}':text='BORDO MAVI HABER':fontsize=38:fontcolor=white:x=205:y=200,` +
      `drawtext=fontfile='${font}':text='DETAYLI ANALIZ':fontsize=24:fontcolor=0x38BDF8:x=205:y=255[withHeader];` +
      `[withHeader][logo]overlay=58:195[withLogo];` +
      // Ticker
      `[withLogo]drawbox=x=60:y=390:w=380:h=50:color=0x2563EB@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='OZEL GELISME':fontsize=26:fontcolor=white:x=85:y=402,` +
      // Alt Altyazı Sahnesi
      `drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0x2563EB@0.65:t=3,` +
      `drawbox=x=60:y=1180:w=260:h=40:color=0x2563EB@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='DETAY HABER':fontsize=22:fontcolor=white:x=95:y=1190[outv]`;
  } else {
    s2Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];` +
      `[0:v]scale=1000:770:force_original_aspect_ratio=increase,crop=1000:770[fgCrop];` +
      `[fgCrop]drawbox=x=0:y=0:w=1000:h=770:color=0x2563EB@0.95:t=4[fgBox];` +
      `[darkBg][fgBox]overlay=40:370[withFg];` +
      `[withFg]drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0x2563EB@0.65:t=3[outv]`;
  }

  slide2Args.push('-filter_complex', s2Filter, '-map', '[outv]', '-vframes', '1', slide2Path);
  await runFFmpeg(slide2Args);

  // -------------------------------------------------------------
  // SLAYT 3: Papara Park & Taktik / Kulis Sahnesi
  // -------------------------------------------------------------
  const slide3Path = path.join(tempDir, `bm_slide_3_${timestamp}.png`);
  tempFilesToClean.push(slide3Path);
  slidePaths.push(slide3Path);

  const stadiumPhoto = hasStadiumImg ? downloadedStadiumImg : heroPhotoPath;
  const slide3Args: string[] = ['-y'];
  if (stadiumPhoto) slide3Args.push('-i', stadiumPhoto);
  else slide3Args.push('-f', 'lavfi', '-i', 'color=c=0x0F172A:s=1080x1920:d=1:r=1');

  let s3Filter = '';
  if (logoPath) {
    slide3Args.push('-i', logoPath);
    s3Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];` +
      `[0:v]scale=1000:770:force_original_aspect_ratio=increase,crop=1000:770[fgCrop];` +
      `[fgCrop]drawbox=x=0:y=0:w=1000:h=770:color=0xF59E0B@0.95:t=4[fgBox];` +
      `[1:v]scale=130:130[logo];` +
      `[darkBg][fgBox]overlay=40:370[withFg];` +
      // Üst Başlık (y: 170 - 350)
      `[withFg]drawbox=x=40:y=170:w=1000:h=180:color=0x0F172A@0.92:t=fill,` +
      `drawbox=x=40:y=170:w=1000:h=180:color=0xF59E0B@0.5:t=2,` +
      `drawbox=x=670:y=200:w=340:h=60:color=0xB45309@0.95:t=fill,` +
      `drawbox=x=670:y=200:w=340:h=60:color=0xFCD34D@0.9:t=2,` +
      `drawtext=fontfile='${font}':text='KULIS VE ANALIZ':fontsize=26:fontcolor=white:x=690:y=216,` +
      `drawtext=fontfile='${font}':text='BORDO MAVI HABER':fontsize=38:fontcolor=white:x=205:y=200,` +
      `drawtext=fontfile='${font}':text='PAPARA PARK GUNDEMI':fontsize=24:fontcolor=0xFCD34D:x=205:y=255[withHeader];` +
      `[withHeader][logo]overlay=58:195[withLogo];` +
      // Ticker
      `[withLogo]drawbox=x=60:y=390:w=440:h=50:color=0xB45309@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='PAPARA PARK TRABZON':fontsize=24:fontcolor=white:x=85:y=404,` +
      // Alt Altyazı Sahnesi
      `drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0xF59E0B@0.65:t=3,` +
      `drawbox=x=60:y=1180:w=260:h=40:color=0xB45309@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='KULIS HABERI':fontsize=22:fontcolor=white:x=95:y=1190[outv]`;
  } else {
    s3Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.65:t=fill[darkBg];` +
      `[0:v]scale=1000:770:force_original_aspect_ratio=increase,crop=1000:770[fgCrop];` +
      `[fgCrop]drawbox=x=0:y=0:w=1000:h=770:color=0xF59E0B@0.95:t=4[fgBox];` +
      `[darkBg][fgBox]overlay=40:370[withFg];` +
      `[withFg]drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0xF59E0B@0.65:t=3[outv]`;
  }

  slide3Args.push('-filter_complex', s3Filter, '-map', '[outv]', '-vframes', '1', slide3Path);
  await runFFmpeg(slide3Args);

  // -------------------------------------------------------------
  // SLAYT 4: Tartışma ve Yorum Çağrısı (Outro CTA)
  // -------------------------------------------------------------
  const slide4Path = path.join(tempDir, `bm_slide_4_${timestamp}.png`);
  tempFilesToClean.push(slide4Path);
  slidePaths.push(slide4Path);

  const outroQuestion = scriptData.scenes[3]?.subtitle || 'Sizce bu gelişme Trabzonspor için nasıl sonuçlanır?';
  const outroLines = wrapTextToLines(outroQuestion, 24, 2);
  const outroTextFile = path.join(tempDir, `bm_outro_${timestamp}.txt`);
  fs.writeFileSync(outroTextFile, outroLines.join('\n'), 'utf8');
  tempFilesToClean.push(outroTextFile);

  const slide4Args: string[] = ['-y'];
  if (heroPhotoPath) slide4Args.push('-i', heroPhotoPath);
  else slide4Args.push('-f', 'lavfi', '-i', 'color=c=0x1E1B4B:s=1080x1920:d=1:r=1');

  let s4Filter = '';
  if (logoPath) {
    slide4Args.push('-i', logoPath);
    s4Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.75:t=fill[darkBg];` +
      // Orta Tartışma Penceresi
      `[darkBg]drawbox=x=40:y=370:w=1000:h=770:color=0x0F172A@0.92:t=fill,` +
      `drawbox=x=40:y=370:w=1000:h=770:color=0xF59E0B@0.85:t=4,` +
      `drawbox=x=250:y=430:w=580:h=70:color=0xF59E0B@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='SIZIN GORUSUNUZ NE?':fontsize=34:fontcolor=black:x=(w-text_w)/2:y=450,` +
      `drawtext=fontfile='${font}':textfile='${escapeFFmpegPath(outroTextFile)}':fontsize=46:fontcolor=white:x=(w-text_w)/2:y=580:line_spacing=18[withQuestion];` +
      // Üst Başlık (y: 170 - 350)
      `[1:v]scale=130:130[logo];` +
      `[withQuestion]drawbox=x=40:y=170:w=1000:h=180:color=0x0F172A@0.92:t=fill,` +
      `drawbox=x=40:y=170:w=1000:h=180:color=0xF59E0B@0.5:t=2,` +
      `drawbox=x=670:y=200:w=340:h=60:color=0xDC2626@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='TARTISMA KANALI':fontsize=28:fontcolor=white:x=695:y=215,` +
      `drawtext=fontfile='${font}':text='BORDO MAVI HABER':fontsize=38:fontcolor=white:x=205:y=200,` +
      `drawtext=fontfile='${font}':text='TARAFTAR KORSESI':fontsize=24:fontcolor=0xF59E0B:x=205:y=255[withHeader];` +
      `[withHeader][logo]overlay=58:195[withLogo];` +
      // Alt CTA Kartı
      `[withLogo]drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0xF59E0B@0.65:t=3,` +
      `drawbox=x=200:y=1400:w=680:h=80:color=0x781324@0.95:t=fill,` +
      `drawtext=fontfile='${font}':text='FIKRINI YORUMLARDA YAZ!':fontsize=34:fontcolor=white:x=(w-text_w)/2:y=1422[outv]`;
  } else {
    s4Filter = 
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[blurBg];` +
      `[blurBg]drawbox=x=0:y=0:w=1080:h=1920:color=0x070B14@0.75:t=fill[darkBg];` +
      `[darkBg]drawbox=x=40:y=1160:w=1000:h=360:color=0x070B14@0.92:t=fill,` +
      `drawbox=x=40:y=1160:w=1000:h=360:color=0xF59E0B@0.65:t=3[outv]`;
  }

  slide4Args.push('-filter_complex', s4Filter, '-map', '[outv]', '-vframes', '1', slide4Path);
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
