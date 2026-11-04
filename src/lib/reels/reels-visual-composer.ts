import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { ReelScriptData } from './reels-script-generator';
import { CanvaService, TRABZONSPOR_CANVA_TEMPLATES } from '@/lib/canva/canva-service';
import { generateAiSlideVisual } from '@/services/visual/ai-visual-generator';

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

export function wrapTextToLines(
  text: string,
  maxCharsPerLine: number = 38,
  maxLines: number = 2
): string[] {
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

/**
 * 1080x1920 (9:16) %100 Yapay Zeka Görsel Üretimli, 6-8 Özgün Slaytlı Profesyonel Spor Medyası Reels Kompozitörü.
 * - Görsel Kimlik: Bordo (#7B0F1C), Mavi (#2E8BC9), Beyaz (#FFFFFF) ve Koyu Lacivert (#0A1122).
 * - Sahte istatistik, sahte forma, yanıltıcı logo veya dış sitelerden filigranlı/telifli fotoğraf KULLANMAZ.
 * - Her slayt için ayrı sinematik ışıklandırma, özgün kompozisyon ve az/okunabilir tipografi üretir.
 */
export async function composeReelSlides(
  scriptData: ReelScriptData,
  _unusedExternalImageUrl?: string | null
): Promise<ComposedSlidesResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const baseFramePath = path.join(tempDir, `bm_base_frame_${timestamp}.png`);
  const heroPhotoPath = path.join(tempDir, `bm_hero_photo_${timestamp}.png`);
  const overlayHudPath = path.join(tempDir, `bm_overlay_hud_${timestamp}.png`);
  const tempFilesToClean: string[] = [baseFramePath, heroPhotoPath, overlayHudPath];

  const width = 1080;
  const height = 1920;

  // 1. 6-8 Özgün Slayt Görselini %100 Yapay Zeka Sinematik Motoruyla Üret
  const scenes =
    scriptData.scenes && scriptData.scenes.length >= 6
      ? scriptData.scenes
      : scriptData.scenes || [];
  const totalSlides = Math.max(1, scenes.length);
  const slidePaths: string[] = [];

  for (let i = 0; i < totalSlides; i++) {
    const scene = scenes[i];
    const slidePath = path.join(tempDir, `bm_ai_slide_${timestamp}_${i + 1}.png`);
    await generateAiSlideVisual({
      slideIndex: i + 1,
      totalSlides,
      slideBadge: scene?.badge || `SLAYT ${i + 1}`,
      headlineCallout: scene?.visualCallout || scriptData.title,
      subCallout: scene?.subCallout,
      claimType: scriptData.claimType || 'DOĞRULANMIŞ HABER',
      editorialScore: scriptData.editorialPotentialScore || 88,
      category: scriptData.category || 'GENERAL',
      sourceLabel: scriptData.sourceAttribution,
      outputPath: slidePath,
      width: 1080,
      height: 1200,
    });
    slidePaths.push(slidePath);
    tempFilesToClean.push(slidePath);
  }

  // İlk slaytı aynı zamanda heroPhotoPath olarak kopyala (geriye dönük uyumluluk ve kapak önizlemesi için)
  fs.copyFileSync(slidePaths[0], heroPhotoPath);

  // 2. Kulüp Logosu Tespiti & Hazırlığı (2x Büyütülmüş En Sağ Üst Köşe Sabit Logo - 148x148)
  const brandLogo = path.join(process.cwd(), 'public', 'assets', 'brand', 'bordomavi-logo.png');
  const fallbackLogo = path.join(process.cwd(), 'public', 'logo.png');
  const logoPath = fs.existsSync(brandLogo)
    ? brandLogo
    : fs.existsSync(fallbackLogo)
    ? fallbackLogo
    : null;

  let badgeLogoBuf: Buffer | null = null;
  if (logoPath) {
    try {
      badgeLogoBuf = await sharp(logoPath)
        .resize({
          width: 148,
          height: 148,
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch (e: any) {
      console.warn('[VisualComposer] Logo processing error:', e.message);
    }
  }

  // Canva Şablon Seçimi ve Connect API Senkronizasyonu
  const upperTitle = (scriptData.title || 'TRABZONSPOR GÜNDEMİ').toLocaleUpperCase('tr-TR');
  const isTransfer = /TRANSFER|İMZA|KADRO|ANLAŞMA|TEKLİF/.test(upperTitle);
  const isMatch = /MAÇ|SKOR|GOL|DERBİ|11/.test(upperTitle);
  const canvaCategory = isTransfer ? 'TRANSFER' : isMatch ? 'MATCH_DAY' : 'REELS';
  const canvaTpl =
    TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === canvaCategory) ||
    TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'REELS')!;

  CanvaService.createDesignWithConnectApi({
    title: `BordoMavi AI Slideshow Reels (${canvaCategory}) - ${upperTitle.slice(0, 60)}`,
    width: 1080,
    height: 1920,
  }).catch(() => {});

  const viewportW = 1024;
  const viewportH = 1140;
  const viewportX = 28;
  const viewportY = 64;

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

  // 4. Tam Ekran Koyu Lacivert (#0A1122), Bordo (#7B0F1C) ve Mavi (#2E8BC9) Atmosferik Stüdyo Arka Planı (1080x1920)
  const studioBgSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="studioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7B0F1C"/>
          <stop offset="35%" stop-color="#0A1122"/>
          <stop offset="75%" stop-color="#070D19"/>
          <stop offset="100%" stop-color="#040812"/>
        </linearGradient>
        <radialGradient id="topGlow" cx="50%" cy="8%" r="55%">
          <stop offset="0%" stop-color="#2E8BC9" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bordoGlow" cx="15%" cy="55%" r="50%">
          <stop offset="0%" stop-color="#7B0F1C" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#studioGrad)"/>
      <rect width="${width}" height="${height}" fill="url(#topGlow)"/>
      <rect width="${width}" height="${height}" fill="url(#bordoGlow)"/>
    </svg>
  `);

  const studioBgBuf = await sharp(studioBgSvg).ensureAlpha().png().toBuffer();

  // 5. Manşet Metnini Hazırla (x: 28, y: 1222, w: 1024, h: 210)
  const headlineLines = wrapTextToLines(upperTitle, 30, 3);

  let headlineSvgElements = '';
  if (headlineLines.length === 1) {
    headlineSvgElements = `
      <text x="540" y="1340" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="45" font-weight="900">${escapeXml(
        headlineLines[0]
      )}</text>
    `;
  } else if (headlineLines.length === 2) {
    headlineSvgElements = `
      <text x="540" y="1310" text-anchor="middle" fill="#38BDF8" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900">${escapeXml(
        headlineLines[0]
      )}</text>
      <text x="540" y="1366" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900">${escapeXml(
        headlineLines[1]
      )}</text>
    `;
  } else {
    headlineSvgElements = `
      <text x="540" y="1286" text-anchor="middle" fill="#38BDF8" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900">${escapeXml(
        headlineLines[0]
      )}</text>
      <text x="540" y="1338" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900">${escapeXml(
        headlineLines[1]
      )}</text>
      <text x="540" y="1390" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900">${escapeXml(
        headlineLines[2]
      )}</text>
    `;
  }

  const progX = 64;
  const progY = 1644;
  const progW = 952;
  const progH = 14;

  const hudSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2E8BC9"/>
          <stop offset="50%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#7B0F1C"/>
        </linearGradient>
        <linearGradient id="bordoGoldBar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#7B0F1C"/>
          <stop offset="50%" stop-color="#2E8BC9"/>
          <stop offset="100%" stop-color="#FFFFFF"/>
        </linearGradient>
        <filter id="dropShadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
        </filter>
      </defs>

      <!-- 2. DİKEY TAM KADRAJ HABER VİTRİN ÇERÇEVESİ (x: 28, y: 64, w: 1024, h: 1140) -->
      <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="none" stroke="url(#goldAccent)" stroke-width="4" filter="url(#dropShadow)"/>

      <!-- 3. MANŞET BLOĞU (x: 28, y: 1222, w: 1024, h: 210) -->
      <rect x="28" y="1222" width="1024" height="210" rx="28" ry="28" fill="#0A1122" fill-opacity="0.96" stroke="#2E8BC9" stroke-opacity="0.45" stroke-width="2" filter="url(#dropShadow)"/>
      <rect x="28" y="1222" width="14" height="210" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
      <rect x="1038" y="1222" width="14" height="210" rx="7" ry="7" fill="url(#bordoGoldBar)"/>
      ${headlineSvgElements}

      <!-- 4. ALTYAZI & CANLI İLERLEME KARTI (x: 28, y: 1448, w: 1024, h: 230) -->
      <rect x="28" y="1448" width="1024" height="230" rx="28" ry="28" fill="#070D19" fill-opacity="0.96" stroke="#1E293B" stroke-width="2" filter="url(#dropShadow)"/>
      <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="7" ry="7" fill="#1E293B" stroke="#334155" stroke-width="1"/>

      <!-- 5. TARAFTAR SORUSU & ETKİLEŞİM ÇAĞRISI ROZETİ (y: 1696 .. 1760) -->
      <rect x="90" y="1696" width="900" height="64" rx="32" fill="#7B0F1C" fill-opacity="0.95" stroke="#2E8BC9" stroke-width="2.5" filter="url(#dropShadow)"/>
      <text x="540" y="1736" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="1">${escapeXml(
        scriptData.pollQuestion.length > 56
          ? scriptData.pollQuestion.slice(0, 54) + '?'
          : scriptData.pollQuestion
      )}</text>
    </svg>
  `);

  const holeMaskSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="black"/>
      <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="7" ry="7" fill="black"/>
    </svg>
  `);

  const hudWithLayersBuf = await sharp(studioBgBuf)
    .composite([{ input: hudSvg, left: 0, top: 0 }])
    .ensureAlpha()
    .png()
    .toBuffer();

  const borderRestoreSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldAccent2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2E8BC9"/>
          <stop offset="50%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#7B0F1C"/>
        </linearGradient>
        <filter id="logoShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.65"/>
        </filter>
      </defs>
      <rect x="${viewportX}" y="${viewportY}" width="${viewportW}" height="${viewportH}" rx="28" ry="28" fill="none" stroke="url(#goldAccent2)" stroke-width="4"/>
      <rect x="48" y="84" width="330" height="50" rx="25" ry="25" fill="#7B0F1C" fill-opacity="0.94" stroke="#2E8BC9" stroke-width="2" filter="url(#logoShadow)"/>
      <circle cx="76" cy="109" r="7" fill="#FFFFFF"/>
      <text x="96" y="117" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" letter-spacing="1.2">${escapeXml(
        canvaTpl.badgeText
      )}</text>
      <circle cx="952" cy="142" r="82" fill="#FFFFFF" stroke="url(#goldAccent2)" stroke-width="4" filter="url(#logoShadow)"/>
      <rect x="${progX}" y="${progY}" width="${progW}" height="${progH}" rx="7" ry="7" fill="none" stroke="#475569" stroke-width="1.5"/>
    </svg>
  `);

  const hudOverlays: any[] = [
    { input: holeMaskSvg, blend: 'dest-out' },
    { input: borderRestoreSvg, blend: 'over' },
  ];
  if (badgeLogoBuf) {
    hudOverlays.push({ input: badgeLogoBuf, left: 878, top: 68, blend: 'over' });
  }

  await sharp(hudWithLayersBuf).composite(hudOverlays).png().toFile(overlayHudPath);

  const baseLayers: any[] = [
    { input: staticViewportPhotoBuf, left: viewportX, top: viewportY },
    { input: hudSvg, left: 0, top: 0 },
    { input: borderRestoreSvg, left: 0, top: 0 },
  ];
  if (badgeLogoBuf) {
    baseLayers.push({ input: badgeLogoBuf, left: 878, top: 68 });
  }

  await sharp(studioBgBuf).composite(baseLayers).png().toFile(baseFramePath);

  console.log(
    `[VisualComposer] ✅ 1080x1920 AI-Generated ${slidePaths.length}-Slide Broadcast Template ready: ${baseFramePath}`
  );

  return {
    baseFramePath,
    heroPhotoPath,
    overlayHudPath,
    slidePaths,
    tempFilesToClean,
  };
}
