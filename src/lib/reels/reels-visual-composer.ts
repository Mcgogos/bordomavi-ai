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
  heroPhotoPath: string;
  overlayHudPath: string;
  slidePaths: string[];
  tempFilesToClean: string[];
}

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

export function escapeFFmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(':', '\\:');
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function wrapTextToLines(text: string, maxCharsPerLine: number = 38, maxLines: number = 2): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) {
        if (lines.length < maxLines - 1) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = (currentLine + ' ' + word).trim();
        }
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function downloadImageSafe(url: string, outputPath: string): Promise<boolean> {
  const urlsToTry = [url];
  if (url.includes('?u=http')) {
    try {
      const directUrl = decodeURIComponent(url.split('?u=')[1]);
      if (directUrl.startsWith('http')) urlsToTry.push(directUrl);
    } catch {}
  }

  for (const candidateUrl of urlsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(candidateUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(14000)
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 500) {
            fs.writeFileSync(outputPath, buf);
            return true;
          }
        }
      } catch (e: any) {
        console.warn(`[VisualComposer] Image download attempt ${attempt} warning (${candidateUrl}):`, e.message);
      }
    }
  }
  return false;
}

/**
 * 1080x1920 (9:16) Sade, Modern ve Yüksek Etkileşimli Spor Haber Reels Şablonu.
 * 
 * - Üst Bar (y: 75 - 195): Yalnızca Bordo Mavi kulüp arması ve "BORDO MAVİ HABER" başlığı (Kategori rozeti yok).
 * - 16:9 Tam Kadraj Haber Vitrini (x: 36, y: 220, w: 1008, h: 567):
 *   Fotoğraf üzerinde hiçbir yazı/etiket olmadan %100 net ve kesintisiz görüntü.
 * - Manşet Kartı (y: 815 - 1060): Fazla üst başlıklar kaldırıldı; yalnızca vurucu haber başlığı dikey ortalı.
 * - Altyazı & Canlı İlerleme Kartı (y: 1085 - 1380): Üst yazılar kaldırıldı; yalnızca konuşmayla senkronize altyazı ve
 *   30fps kesintisiz akan gerçek zamanlı altın ilerleme çubuğu (y: 1344, h: 12).
 * - Taraftar Etkileşim Kartı (y: 1405 - 1655):
 *   Sol Buton: [✓ Evet, 👍 Beğen] | Sağ Buton: [✕ Hayır, 💬 Yorum Yap]
 */
export async function composeReelSlides(
  scriptData: ReelScriptData,
  sourceImageUrl?: string | null
): Promise<ComposedSlidesResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const baseFramePath = path.join(tempDir, `bm_base_frame_${timestamp}.png`);
  const heroPhotoPath = path.join(tempDir, `bm_hero_photo_${timestamp}.png`);
  const overlayHudPath = path.join(tempDir, `bm_overlay_hud_${timestamp}.png`);
  const tempFilesToClean: string[] = [baseFramePath, heroPhotoPath, overlayHudPath];

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
    throw new Error(`Habere ait özgün ve geçerli bir görsel indirilemedi (${sourceImageUrl || 'Görsel URL bulunamadı'}). Kural gereği haberle ilgisiz generic görsel ile Reels üretilemez.`);
  }

  // 2. Kulüp Logosu Tespiti & Hazırlığı (92x92 Net Rozet)
  const brandLogo = path.join(process.cwd(), 'public', 'assets', 'brand', 'bordomavi-logo.png');
  const fallbackLogo = path.join(process.cwd(), 'public', 'logo.png');
  const logoPath = fs.existsSync(brandLogo) ? brandLogo : (fs.existsSync(fallbackLogo) ? fallbackLogo : null);

  let logoBuf: Buffer | null = null;
  if (logoPath) {
    try {
      logoBuf = await sharp(logoPath)
        .resize({ width: 92, height: 92, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
    } catch (e: any) {
      console.warn('[VisualComposer] Logo processing error:', e.message);
    }
  }

  // 3. Tam 16:9 Sinematik Haber Vitrini (1008x567 - Yatay 1280x720 fotoğraflarda SIFIR kırpma ve SIFIR üst yazı!)
  const viewportW = 1008;
  const viewportH = 567;
  const viewportX = 36;
  const viewportY = 220;

  const heroHiResW = 1280;
  const heroHiResH = 720;

  const heroBlurBg = await sharp(downloadedNewsImg)
    .resize(heroHiResW, heroHiResH, { fit: 'cover', position: 'center' })
    .blur(28)
    .modulate({ brightness: 0.5, saturation: 1.2 })
    .toBuffer();

  const heroFg = await sharp(downloadedNewsImg)
    .resize(heroHiResW, heroHiResH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(heroBlurBg)
    .composite([{ input: heroFg, left: 0, top: 0 }])
    .png()
    .toFile(heroPhotoPath);

  const roundedPhotoMask = Buffer.from(`
    <svg width="${viewportW}" height="${viewportH}">
      <rect width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="white"/>
    </svg>
  `);

  const staticViewportPhotoBuf = await sharp(heroPhotoPath)
    .resize(viewportW, viewportH, { fit: 'cover', position: 'center' })
    .composite([{ input: roundedPhotoMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 4. Tam Ekran Koyu Bordo-Mavi Atmosferik Stüdyo Arka Planı (1080x1920)
  const blurredBackdrop = await sharp(downloadedNewsImg)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .blur(48)
    .modulate({ brightness: 0.20, saturation: 1.35 })
    .ensureAlpha()
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
        <radialGradient id="topGlow" cx="50%" cy="8%" r="55%">
          <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bordoGlow" cx="15%" cy="55%" r="50%">
          <stop offset="0%" stop-color="#9F1239" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#studioGrad)"/>
      <rect width="${width}" height="${height}" fill="url(#topGlow)"/>
      <rect width="${width}" height="${height}" fill="url(#bordoGlow)"/>
    </svg>
  `);

  const studioBgBuf = await sharp(blurredBackdrop)
    .composite([{ input: atmosphereOverlaySvg, blend: 'over' }])
    .ensureAlpha()
    .png()
    .toBuffer();

  // 5. Manşet ve Anket Metinlerini Hazırla (Üst etiketler kaldırıldı, manşet kart içinde tam ortalandı)
  const upperTitle = (scriptData.title || 'TRABZONSPOR GÜNDEMİ').toLocaleUpperCase('tr-TR');
  const headlineLines = wrapTextToLines(upperTitle, 30, 3);
  const pollQuestion = escapeXml(scriptData.pollQuestion || 'Sizce bu gelişme doğru mu?');

  let headlineSvgElements = '';
  if (headlineLines.length === 1) {
    headlineSvgElements = `
      <text x="540" y="952" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="900">${escapeXml(headlineLines[0])}</text>
    `;
  } else if (headlineLines.length === 2) {
    headlineSvgElements = `
      <text x="540" y="920" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900">${escapeXml(headlineLines[0])}</text>
      <text x="540" y="984" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900">${escapeXml(headlineLines[1])}</text>
    `;
  } else {
    headlineSvgElements = `
      <text x="540" y="896" text-anchor="middle" fill="#FBBF24" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900">${escapeXml(headlineLines[0])}</text>
      <text x="540" y="952" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900">${escapeXml(headlineLines[1])}</text>
      <text x="540" y="1008" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900">${escapeXml(headlineLines[2])}</text>
    `;
  }

  // İlerleme çubuğu koordinatları (x: 64, y: 1344, w: 952, h: 14, rx: 7)
  const progX = 64;
  const progY = 1344;
  const progW = 952;
  const progH = 14;

  // 6. Broadcast HUD SVG Katmanı (Kategori rozeti, Sıcak Gündem, Özel Gündem Manşeti, Spiker Anlatımı kaldırıldı)
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
        <linearGradient id="pollCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0F1D36" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#2D0A1B" stop-opacity="0.96"/>
        </linearGradient>
        <linearGradient id="btnGreenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#10B981"/>
        </linearGradient>
        <linearGradient id="btnBordoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#9F1239"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </linearGradient>
        <filter id="dropShadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
        </filter>
      </defs>

      <!-- 1. ÜST KURUMSAL YAYIN BARI (y: 75 .. 195) - Kategori Rozetsiz Sade Kurumsal Başlık -->
      <rect x="36" y="75" width="1008" height="120" rx="30" ry="30" fill="#0B1324" fill-opacity="0.92" stroke="url(#goldAccent)" stroke-width="2" filter="url(#dropShadow)"/>
      <circle cx="104" cy="135" r="48" fill="#FFFFFF"/>
      <text x="176" y="132" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" letter-spacing="1.5">BORDO MAVİ HABER</text>
      <text x="176" y="166" fill="#38BDF8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="bold" letter-spacing="2.5">TRABZONSPOR ÖZEL YAYINI</text>

      <!-- 2. 16:9 TAM KADRAJ HABER VİTRİN ÇERÇEVESİ (x: 36, y: 220, w: 1008, h: 567) - Üst Etiketsiz -->
      <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="none" stroke="url(#goldAccent)" stroke-width="4" filter="url(#dropShadow)"/>

      <!-- 3. MANŞET BLOĞU (x: 36, y: 815, w: 1008, h: 245) - Üst Başlıksız, Tam Ortalı -->
      <rect x="36" y="815" width="1008" height="245" rx="28" ry="28" fill="#0B1426" fill-opacity="0.94" stroke="#334155" stroke-width="2" filter="url(#dropShadow)"/>
      <rect x="36" y="815" width="14" height="245" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
      <rect x="1030" y="815" width="14" height="245" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
      ${headlineSvgElements}

      <!-- 4. ALTYAZI & CANLI İLERLEME KARTI (x: 36, y: 1085, w: 1008, h: 295) - Üst Başlıksız -->
      <rect x="36" y="1085" width="1008" height="295" rx="28" ry="28" fill="#070D19" fill-opacity="0.95" stroke="#1E293B" stroke-width="2" filter="url(#dropShadow)"/>
      <!-- İlerleme Çubuğu Arka İzi -->
      <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="7" ry="7" fill="#1E293B" stroke="#334155" stroke-width="1"/>

      <!-- 5. İNTERAKTİF TARAFTAR ANKET & TARTIŞMA KARTI (x: 36, y: 1405, w: 1008, h: 250) -->
      <rect x="36" y="1405" width="1008" height="250" rx="28" ry="28" fill="url(#pollCardGrad)" stroke="url(#goldAccent)" stroke-width="2.5" filter="url(#dropShadow)"/>
      <text x="540" y="1472" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${pollQuestion.length > 44 ? 30 : pollQuestion.length > 36 ? 33 : 36}" font-weight="900">${pollQuestion}</text>

      <!-- Sol Seçenek Butonu: ✓ Evet, Parmak İşareti Beğen (Zümrüt Yeşili) -->
      <rect x="64" y="1504" width="456" height="116" rx="58" ry="58" fill="url(#btnGreenGrad)" stroke="#6EE7B7" stroke-width="2.5"/>
      <!-- Beyaz Parmak İşareti (Thumbs Up) Vektör İkonu -->
      <g transform="translate(106, 1538) scale(1.75)" fill="#FFFFFF">
        <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z"/>
      </g>
      <text x="318" y="1573" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900">✓ Evet, Beğen</text>

      <!-- Sağ Seçenek Butonu: Hayır, Yorum Yap (Bordo Kırmızı) -->
      <rect x="560" y="1504" width="456" height="116" rx="58" ry="58" fill="url(#btnBordoGrad)" stroke="#FDA4AF" stroke-width="2.5"/>
      <!-- Beyaz Yorum Balonu Vektör İkonu -->
      <g transform="translate(596, 1540) scale(1.7)" fill="#FFFFFF">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </g>
      <text x="808" y="1573" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900">Hayır, Yorum Yap</text>

      <!-- 6. ALT GÜVENLİ BÖLGE İMZASI (y: 1705) -->
      <text x="540" y="1705" text-anchor="middle" fill="#94A3B8" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" letter-spacing="3">BORDO MAVİ • TARAFTARIN SESİ • YORUMLARDA BULUŞALIM</text>
    </svg>
  `);

  // 7. FFmpeg Dinamik Ken Burns Hareketi ve 30fps Akıcı Altın İlerleme Çubuğu İçin Şeffaf Pencereli HUD Katmanı (overlayHudPath)
  // Hem 16:9 fotoğraf vitrinini (36, 220, 1008, 567) hem de ilerleme çubuğu yuvasını (64, 1344, 952, 14) şeffaf açıyoruz!
  const holeMaskSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="black"/>
      <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="7" ry="7" fill="black"/>
    </svg>
  `);

  const hudWithLayersBuf = await sharp(studioBgBuf)
    .composite([
      { input: hudSvg, left: 0, top: 0 },
      ...(logoBuf ? [{ input: logoBuf, left: 58, top: 89 }] : [])
    ])
    .ensureAlpha()
    .png()
    .toBuffer();

  // İlerleme çubuğu çerçevesi (delik açıldıktan sonra üstüne ince çerçeve çizmek için)
  const borderRestoreSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldAccent2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#FDE68A"/>
          <stop offset="100%" stop-color="#38BDF8"/>
        </linearGradient>
      </defs>
      <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="none" stroke="url(#goldAccent2)" stroke-width="4"/>
      <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="7" ry="7" fill="none" stroke="#475569" stroke-width="1.5"/>
    </svg>
  `);

  await sharp(hudWithLayersBuf)
    .composite([
      { input: holeMaskSvg, blend: 'dest-out' },
      { input: borderRestoreSvg, blend: 'over' }
    ])
    .png()
    .toFile(overlayHudPath);

  // 8. Tam Statik Önizleme Görseli (baseFramePath) Üret (Arka planda ilerleme çubuğu yuvası #1E293B koyu gri olarak hazır)
  const baseLayers: any[] = [
    { input: staticViewportPhotoBuf, left: viewportX, top: viewportY },
    { input: hudSvg, left: 0, top: 0 }
  ];
  if (logoBuf) {
    baseLayers.push({ input: logoBuf, left: 58, top: 89 });
  }

  await sharp(studioBgBuf)
    .composite(baseLayers)
    .png()
    .toFile(baseFramePath);

  console.log(`[VisualComposer] ✅ 1080x1920 Clean Viral Sports Broadcast Template generated: ${baseFramePath}`);

  return {
    baseFramePath,
    heroPhotoPath,
    overlayHudPath,
    slidePaths: [baseFramePath],
    tempFilesToClean
  };
}
