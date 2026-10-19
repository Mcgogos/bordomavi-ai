import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { ReelScriptData } from './reels-script-generator';

export const CURATED_REEL_BACKGROUNDS = {
  stadium: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1080&h=1920&q=80',
  fans: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1080&h=1920&q=80',
  tactics: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1080&h=1920&q=80',
  pitchNight: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1080&h=1920&q=80',
};

export interface ComposedSlidesResult {
  baseFramePath: string;
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
 * Uzun altyazı ve başlıkları satırlara böler (taşmaları önlemek için).
 */
export function wrapTextToLines(text: string, maxCharsPerLine: number = 44, maxLines: number = 2): string[] {
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
 * Kullanıcının referans tasarımına (media_1792400395682_1211e684.jpg) ve 
 * 2026 Meta Facebook Reels algoritma optimizasyonuna %100 uyumlu,
 * Sharp destekli ultra net 1080x1920 dikey yayın şablonu oluşturur.
 * 
 * Görsel Mimarisi:
 * - Üst Header (y: 0 - 275): Bembeyaz arka plan ve ortalanmış dairesel Bordo Mavi kulüp logosu.
 * - Orta Bölüm (y: 275 - 1372): 1008x1088 ebatlarında, 32px yuvarlatılmış köşeli HD haber fotoğrafı.
 * - Alt Koyu Lacivert Gövde (y: 1372 - 1920, #0F233E):
 *    - y: 1372 - 1520: Dinamik, konuşmayla senkronize kalın beyaz altyazı alanı.
 *    - y: 1520 - 1846: Beyaz yuvarlatılmış interaktif Anket / Quiz çıkartma kartı:
 *        * Soru Başlığı (Örn: "Sizce bu transfer doğru mu?")
 *        * Sol Buton: Yumuşak yeşil [✔ Evet, tam isabet]
 *        * Sağ Buton: Yumuşak gri [✖ Hayır, gereksiz]
 *    - y: 1846 - 1920: Facebook mobil arayüzü ile sıfır çakışma sağlayan 74px güvenlik payı.
 */
export async function composeReelSlides(
  scriptData: ReelScriptData,
  sourceImageUrl?: string | null
): Promise<ComposedSlidesResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const baseFramePath = path.join(tempDir, `bm_base_frame_${timestamp}.png`);
  const tempFilesToClean: string[] = [baseFramePath];

  const width = 1080;
  const height = 1920;

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

  // 2. Kulüp Logosu Tespiti & Hazırlığı
  const brandLogo = path.join(process.cwd(), 'public', 'assets', 'brand', 'bordomavi-logo.png');
  const fallbackLogo = path.join(process.cwd(), 'public', 'logo.png');
  const logoPath = fs.existsSync(brandLogo) ? brandLogo : (fs.existsSync(fallbackLogo) ? fallbackLogo : null);

  let logoBuf: Buffer | null = null;
  let logoX = 425;
  let logoY = 48;

  if (logoPath) {
    try {
      logoBuf = await sharp(logoPath).resize({ width: 230, height: 190, fit: 'inside' }).toBuffer();
      const meta = await sharp(logoBuf).metadata();
      logoX = Math.round((width - (meta.width || 230)) / 2);
    } catch (e: any) {
      console.warn('[VisualComposer] Logo processing error, proceeding without logo:', e.message);
    }
  }

  // 3. Yuvarlatılmış Köşeli Haber Görseli (1008x1088, rx: 32)
  const photoW = 1008;
  const photoH = 1088;
  const photoX = 36;
  const photoY = 275;

  const roundedMask = Buffer.from(`
    <svg width="${photoW}" height="${photoH}">
      <rect width="${photoW}" height="${photoH}" rx="32" ry="32" fill="white"/>
    </svg>
  `);

  const photoBuf = await sharp(downloadedNewsImg)
    .resize(photoW, photoH, { fit: 'cover', position: 'center' })
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .toBuffer();

  // 4. Temel Arka Plan (Üst Beyaz + Alt Koyu Lacivert #0F233E)
  const bgSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="1372" fill="#FFFFFF"/>
      <rect y="1372" width="${width}" height="548" fill="#0F233E"/>
    </svg>
  `);

  // 5. İnteraktif Anket (Poll Card) & Çıkartma Kartı
  const cardW = 996;
  const cardH = 326;
  const cardX = 42;
  const cardY = 1520;

  const btnW = 444;
  const btnH = 88;
  const btnY = cardY + 185;
  const btn1X = cardX + 36;
  const btn2X = cardX + cardW - 36 - btnW;

  const pollQuestion = (scriptData.pollQuestion || 'Sizce bu gelişme doğru mu?').replace(/[<>&"']/g, '');
  const pollOption1 = (scriptData.pollOption1 || 'Evet, tam isabet').replace(/[<>&"']/g, '');
  const pollOption2 = (scriptData.pollOption2 || 'Hayır, gereksiz').replace(/[<>&"']/g, '');

  const cardSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.22"/>
        </filter>
      </defs>

      <!-- White Poll Card -->
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="36" ry="36" fill="#FFFFFF" filter="url(#cardShadow)"/>

      <!-- Question -->
      <text x="${width / 2}" y="${cardY + 92}" text-anchor="middle" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold">${pollQuestion}</text>

      <!-- Left Button (Soft Green) -->
      <rect x="${btn1X}" y="${btnY}" width="${btnW}" height="${btnH}" rx="44" ry="44" fill="#A4D9B3"/>
      <text x="${btn1X + btnW / 2}" y="${btnY + 56}" text-anchor="middle" fill="#175128" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold">✔  ${pollOption1}</text>

      <!-- Right Button (Soft Gray) -->
      <rect x="${btn2X}" y="${btnY}" width="${btnW}" height="${btnH}" rx="44" ry="44" fill="#C6CBD3"/>
      <text x="${btn2X + btnW / 2}" y="${btnY + 56}" text-anchor="middle" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold">✖  ${pollOption2}</text>
    </svg>
  `);

  // 6. Sharp ile Tüm Katmanları Birleştir
  const compositeLayers: any[] = [
    { input: photoBuf, left: photoX, top: photoY },
    { input: cardSvg, left: 0, top: 0 }
  ];

  if (logoBuf) {
    compositeLayers.unshift({ input: logoBuf, left: logoX, top: logoY });
  }

  await sharp(bgSvg)
    .composite(compositeLayers)
    .png()
    .toFile(baseFramePath);

  console.log(`[VisualComposer] ✅ 1080x1920 Reference Card Template generated: ${baseFramePath}`);

  return {
    baseFramePath,
    slidePaths: [baseFramePath],
    tempFilesToClean
  };
}
