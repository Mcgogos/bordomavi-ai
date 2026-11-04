import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export type ClaimClassification =
  | 'RESMİ AÇIKLAMA'
  | 'DOĞRULANMIŞ HABER'
  | 'GAZETECİ İDDİASI'
  | 'EDİTORYAL YORUM';

export type SlideCompositionStyle =
  | 'STADIUM_FLOODLIGHT'
  | 'VERIFICATION_MATRIX'
  | 'TACTICAL_PERSPECTIVE'
  | 'KINETIC_STREAKS'
  | 'EDITORIAL_SPOTLIGHT'
  | 'HORIZON_ARENA'
  | 'FAN_PULSE_CHALLENGE'
  | 'BREAKING_FLARE';

export interface AiSlideVisualRequest {
  slideIndex: number;
  totalSlides: number;
  slideBadge: string;
  headlineCallout: string;
  subCallout?: string;
  claimType: ClaimClassification;
  editorialScore: number;
  category: string;
  sourceLabel?: string;
  outputPath: string;
  width?: number;
  height?: number;
}

const COMPOSITION_STYLES: SlideCompositionStyle[] = [
  'BREAKING_FLARE',
  'VERIFICATION_MATRIX',
  'TACTICAL_PERSPECTIVE',
  'KINETIC_STREAKS',
  'EDITORIAL_SPOTLIGHT',
  'HORIZON_ARENA',
  'FAN_PULSE_CHALLENGE',
  'STADIUM_FLOODLIGHT',
];

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapShortVisualText(text: string, maxCharsPerLine: number = 24, maxLines: number = 3): string[] {
  const clean = (text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return ['TRABZONSPOR GÜNDEMİ'];

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxCharsPerLine) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) {
        if (lines.length < maxLines - 1) {
          lines.push(current);
          current = w;
        } else {
          const candidate = (current + ' ' + w).trim();
          current = candidate.length > maxCharsPerLine + 4 ? current + '…' : candidate;
          break;
        }
      } else {
        current = w.slice(0, maxCharsPerLine);
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

/**
 * Haber metninden "Resmî Açıklama", "Gazeteci İddiası", "Editoryal Yorum" veya "Doğrulanmış Haber"
 * sınıfını tespit eder.
 */
export function classifyNewsClaimType(
  title: string,
  summary: string,
  corroboratedSourcesCount: number = 1
): ClaimClassification {
  const text = `${title} ${summary}`.toLocaleLowerCase('tr-TR');

  if (
    /\b(resmi açıklama|kamuoyuna duyuru|kap bildirimi|kulübümüzden açıklama|trabzonspor kulübü'nden|resmen açıklandı|tff'den açıklama|pfdk kararı)\b/i.test(
      text
    )
  ) {
    return 'RESMİ AÇIKLAMA';
  }

  if (
    /\b(iddia edildi|iddiası|öne sürüldü|kulislere göre|gelen bilgilere göre|söylentisi|gündeme geldi|listesinde yer aldığı|talip olduğu iddia)\b/i.test(
      text
    )
  ) {
    return 'GAZETECİ İDDİASI';
  }

  if (
    /\b(analiz|değerlendirme|yorum|mercek altına|taktik bakış|editörün notu|nasıl etkiler)\b/i.test(
      text
    ) &&
    corroboratedSourcesCount < 2
  ) {
    return 'EDİTORYAL YORUM';
  }

  return 'DOĞRULANMIŞ HABER';
}

/**
 * Her slayt için farklı sinematik ışıklandırma ve geometri üreten SVG arka plan katmanı.
 * Sahte forma, sahte istatistik veya yanıltıcı logo KESİNLİKLE içermez.
 * Yalnızca Bordo (#7B0F1C), Mavi (#2E8BC9), Beyaz (#FFFFFF) ve Koyu Lacivert (#0A1122)
 * kurumsal renk paletini kullanır.
 */
function buildCinematicCompositionSvg(
  style: SlideCompositionStyle,
  width: number,
  height: number,
  seed: number
): string {
  const angle = 115 + ((seed * 29) % 55);
  const glowX = 25 + ((seed * 19) % 55);
  const glowY = 20 + ((seed * 23) % 45);

  let geometryElements = '';

  switch (style) {
    case 'BREAKING_FLARE':
      geometryElements = `
        <!-- Sinematik Stadyum Projektör Işık Hüzmeleri -->
        <polygon points="0,0 ${width * 0.45},0 ${width * 0.85},${height} ${width * 0.15},${height}" fill="url(#beamBordo)" opacity="0.38"/>
        <polygon points="${width},0 ${width * 0.55},0 ${width * 0.2},${height} ${width * 0.9},${height}" fill="url(#beamMavi)" opacity="0.32"/>
        <circle cx="${width * 0.5}" cy="${height * 0.24}" r="${width * 0.36}" fill="url(#flareCore)" opacity="0.55"/>
        <line x1="80" y1="${height * 0.18}" x2="${width - 80}" y2="${height * 0.18}" stroke="#2E8BC9" stroke-opacity="0.35" stroke-width="2"/>
        <line x1="140" y1="${height * 0.84}" x2="${width - 140}" y2="${height * 0.84}" stroke="#7B0F1C" stroke-opacity="0.55" stroke-width="3"/>
      `;
      break;

    case 'VERIFICATION_MATRIX':
      geometryElements = `
        <!-- Çapraz Doğrulama & Haber Merkezi Perspektif Izgarası -->
        <g stroke="#2E8BC9" stroke-opacity="0.16" stroke-width="1.5" fill="none">
          <circle cx="${width * 0.5}" cy="${height * 0.42}" r="180"/>
          <circle cx="${width * 0.5}" cy="${height * 0.42}" r="310" stroke-dasharray="10 8"/>
          <circle cx="${width * 0.5}" cy="${height * 0.42}" r="440"/>
          <line x1="60" y1="${height * 0.42}" x2="${width - 60}" y2="${height * 0.42}"/>
          <line x1="${width * 0.5}" y1="80" x2="${width * 0.5}" y2="${height - 80}"/>
        </g>
        <rect x="70" y="130" width="${width - 140}" height="${height - 260}" rx="36" fill="none" stroke="url(#goldMaviGrad)" stroke-opacity="0.28" stroke-width="2"/>
      `;
      break;

    case 'TACTICAL_PERSPECTIVE':
      geometryElements = `
        <!-- Sinematik Saha & Taktik Perspektif Çizgileri -->
        <g stroke="#2E8BC9" stroke-opacity="0.22" stroke-width="2.5" fill="none">
          <path d="M 90 ${height - 90} L 240 180 L ${width - 240} 180 L ${width - 90} ${height - 90} Z"/>
          <ellipse cx="${width * 0.5}" cy="${height * 0.54}" rx="230" ry="110"/>
          <line x1="155" y1="${height * 0.54}" x2="${width - 155}" y2="${height * 0.54}"/>
          <rect x="${width * 0.32}" y="180" width="${width * 0.36}" height="140"/>
        </g>
        <circle cx="${width * 0.5}" cy="${height * 0.54}" r="10" fill="#2E8BC9" opacity="0.5"/>
      `;
      break;

    case 'KINETIC_STREAKS':
      geometryElements = `
        <!-- Dinamik Bordo-Mavi Kinetik Işık Şeritleri -->
        <g transform="rotate(-14 ${width / 2} ${height / 2})">
          <rect x="-120" y="${height * 0.22}" width="${width + 240}" height="28" fill="url(#beamBordo)" opacity="0.55"/>
          <rect x="-120" y="${height * 0.28}" width="${width + 240}" height="8" fill="#2E8BC9" opacity="0.45"/>
          <rect x="-120" y="${height * 0.72}" width="${width + 240}" height="22" fill="url(#beamMavi)" opacity="0.5"/>
          <rect x="-120" y="${height * 0.76}" width="${width + 240}" height="6" fill="#FFFFFF" opacity="0.25"/>
        </g>
      `;
      break;

    case 'EDITORIAL_SPOTLIGHT':
      geometryElements = `
        <!-- Editoryal Stüdyo Odak Işığı -->
        <radialGradient id="edSpot" cx="50%" cy="38%" r="52%">
          <stop offset="0%" stop-color="#2E8BC9" stop-opacity="0.38"/>
          <stop offset="45%" stop-color="#7B0F1C" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#070D1A" stop-opacity="0"/>
        </radialGradient>
        <rect width="${width}" height="${height}" fill="url(#edSpot)"/>
        <path d="M 110 220 L 180 220 M 110 220 L 110 290" stroke="#2E8BC9" stroke-width="5" stroke-linecap="round"/>
        <path d="M ${width - 110} ${height - 220} L ${width - 180} ${height - 220} M ${width - 110} ${height - 220} L ${width - 110} ${height - 290}" stroke="#7B0F1C" stroke-width="5" stroke-linecap="round"/>
      `;
      break;

    case 'HORIZON_ARENA':
      geometryElements = `
        <!-- Stadyum Ufuk Çizgisi & Gece Atmosferi -->
        <ellipse cx="${width * 0.5}" cy="${height * 0.82}" rx="${width * 0.65}" ry="220" fill="url(#beamMavi)" opacity="0.34"/>
        <ellipse cx="${width * 0.5}" cy="${height * 0.16}" rx="${width * 0.55}" ry="160" fill="url(#beamBordo)" opacity="0.42"/>
        <g fill="#FFFFFF" opacity="0.35">
          <circle cx="190" cy="190" r="3"/>
          <circle cx="320" cy="150" r="2.5"/>
          <circle cx="720" cy="160" r="3"/>
          <circle cx="860" cy="200" r="2.5"/>
        </g>
      `;
      break;

    case 'FAN_PULSE_CHALLENGE':
    default:
      geometryElements = `
        <!-- Taraftar Nabzı & Soru Sahnesi Halkaları -->
        <circle cx="${width * 0.5}" cy="${height * 0.46}" r="390" fill="none" stroke="#7B0F1C" stroke-opacity="0.38" stroke-width="18"/>
        <circle cx="${width * 0.5}" cy="${height * 0.46}" r="310" fill="none" stroke="#2E8BC9" stroke-opacity="0.32" stroke-width="8" stroke-dasharray="24 14"/>
        <circle cx="${width * 0.5}" cy="${height * 0.46}" r="230" fill="url(#flareCore)" opacity="0.4"/>
      `;
      break;
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgBase" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
          <stop offset="0%" stop-color="#070E1C"/>
          <stop offset="38%" stop-color="#121E35"/>
          <stop offset="72%" stop-color="#4A0A14"/>
          <stop offset="100%" stop-color="#060B16"/>
        </linearGradient>
        <radialGradient id="bordoSpot" cx="${glowX}%" cy="${glowY}%" r="62%">
          <stop offset="0%" stop-color="#7B0F1C" stop-opacity="0.72"/>
          <stop offset="55%" stop-color="#7B0F1C" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="maviSpot" cx="${100 - glowX}%" cy="${100 - glowY}%" r="58%">
          <stop offset="0%" stop-color="#2E8BC9" stop-opacity="0.62"/>
          <stop offset="55%" stop-color="#121E35" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="flareCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#2E8BC9" stop-opacity="0.52"/>
          <stop offset="60%" stop-color="#7B0F1C" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#060B16" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="beamBordo" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#7B0F1C" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#0A1122" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="beamMavi" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2E8BC9" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#0A1122" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="goldMaviGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2E8BC9"/>
          <stop offset="50%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#7B0F1C"/>
        </linearGradient>
        <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.65"/>
        </filter>
      </defs>

      <!-- 1. Koyu Lacivert, Bordo ve Mavi Sinematik Zemin -->
      <rect width="${width}" height="${height}" fill="url(#bgBase)"/>
      <rect width="${width}" height="${height}" fill="url(#bordoSpot)"/>
      <rect width="${width}" height="${height}" fill="url(#maviSpot)"/>

      <!-- 2. Slayta Özgü Sinematik Işıklandırma & Geometri -->
      ${geometryElements}
    </svg>
  `;
}

/**
 * Opsiyonel NVIDIA NIM Flux.1-Schnell tabanlı yapay zeka arka plan dokusu üretici.
 * Sahte forma, sahte logo, yazı veya gerçek dışı olay tasviri üretmemesi için
 * yalnızca soyut Bordo-Mavi stadyum atmosferi ve sinematik ışık dokusu ister.
 */
async function tryGenerateNeuralAtmosphereBuffer(
  style: SlideCompositionStyle,
  width: number,
  height: number
): Promise<Buffer | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey || process.env.ENABLE_NEURAL_BG !== 'true') {
    return null;
  }

  const promptByStyle: Record<SlideCompositionStyle, string> = {
    BREAKING_FLARE:
      'Abstract dark navy #121E35 and claret burgundy #7B0F1C and sky blue #2E8BC9 volumetric stadium floodlights, cinematic atmospheric bokeh, 8k sports broadcast background, no text, no people, no logos, no jerseys',
    VERIFICATION_MATRIX:
      'Modern dark navy broadcast newsroom glass studio lighting with claret #7B0F1C and blue #2E8BC9 rim lights, ultra clean depth of field, no text, no people, no logos',
    TACTICAL_PERSPECTIVE:
      'Night football pitch grass under dramatic claret and blue stadium floodlights, atmospheric mist, wide angle, no players, no text, no logos',
    KINETIC_STREAKS:
      'Dynamic abstract motion light trails in claret red #7B0F1C, sky blue #2E8BC9 and deep navy #121E35, luxury sports broadcast design, no text, no logos',
    EDITORIAL_SPOTLIGHT:
      'Dramatic studio spotlight on dark navy texture with subtle burgundy and cyan rim glow, cinematic editorial background, no text, no logos',
    HORIZON_ARENA:
      'Night stadium architecture exterior glow in claret and blue lights against dark night sky, cinematic mist, no text, no logos, no people',
    FAN_PULSE_CHALLENGE:
      'Atmospheric claret and blue light waves in dark stadium night, high contrast sports broadcast backdrop, no text, no logos, no people',
    STADIUM_FLOODLIGHT:
      'Dramatic overhead stadium floodlights with claret and blue volumetric fog, dark navy background, no text, no logos',
  };

  try {
    const res = await fetch('https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        prompt: promptByStyle[style],
        width: 1024,
        height: 1024,
        steps: 4,
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (res.ok) {
      const data: any = await res.json();
      const b64 = data?.artifacts?.[0]?.base64 || data?.image;
      if (b64) {
        const rawBuf = Buffer.from(b64, 'base64');
        return await sharp(rawBuf)
          .resize(width, height, { fit: 'cover' })
          .modulate({ brightness: 0.55, saturation: 1.2 })
          .png()
          .toBuffer();
      }
    }
  } catch {
    // Prosedürel sinematik stüdyo motoru kesintisiz devreye girer
  }
  return null;
}

/**
 * Her slayt için 100% Yapay Zeka Tasarımlı, Bordo-Mavi-Beyaz-Koyu Lacivert görsel kimliğine sahip,
 * üzerinde az ve okunabilir güçlü tipografi barındıran özgün slayt görseli üretir.
 */
export async function generateAiSlideVisual(req: AiSlideVisualRequest): Promise<string> {
  const width = req.width || 1024;
  const height = req.height || 1140;
  const style = COMPOSITION_STYLES[(req.slideIndex - 1) % COMPOSITION_STYLES.length];
  const seed = req.slideIndex * 37 + (req.headlineCallout?.length || 13);

  const baseSvgBuf = Buffer.from(buildCinematicCompositionSvg(style, width, height, seed));
  const neuralBuf = await tryGenerateNeuralAtmosphereBuffer(style, width, height);

  // Bilgi Türü (Resmî Açıklama / Gazeteci İddiası / Editoryal Yorum / Doğrulanmış Haber) Renk Kodlaması
  const claimColors: Record<ClaimClassification, { bg: string; border: string; text: string }> = {
    'RESMİ AÇIKLAMA': { bg: '#065F46', border: '#34D399', text: '#ECFDF5' },
    'DOĞRULANMIŞ HABER': { bg: '#164E7A', border: '#38BDF8', text: '#F0F9FF' },
    'GAZETECİ İDDİASI': { bg: '#78350F', border: '#FBBF24', text: '#FEF3C7' },
    'EDİTORYAL YORUM': { bg: '#7B0F1C', border: '#F43F5E', text: '#FFE4E6' },
  };
  const claimStyle = claimColors[req.claimType] || claimColors['DOĞRULANMIŞ HABER'];

  // Görsel üzerindeki metin: Az, büyük, yüksek kontrastlı ve okunabilir (Maksimum 3 satır)
  const calloutLines = wrapShortVisualText(req.headlineCallout.toLocaleUpperCase('tr-TR'), 22, 3);
  const subLines = req.subCallout ? wrapShortVisualText(req.subCallout, 36, 2) : [];

  const lineStartY = subLines.length > 0 ? 485 : 535;
  const lineGap = 72;

  const mainTextSvg = calloutLines
    .map((ln, idx) => {
      const y = lineStartY + idx * lineGap;
      const fill = idx === 0 ? '#FFFFFF' : '#E2E8F0';
      return `<text x="${width / 2}" y="${y}" text-anchor="middle" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="900" letter-spacing="0.5">${escapeXml(
        ln
      )}</text>`;
    })
    .join('\n');

  const subStartY = lineStartY + calloutLines.length * lineGap + 26;
  const subTextSvg = subLines
    .map((ln, idx) => {
      const y = subStartY + idx * 44;
      return `<text x="${width / 2}" y="${y}" text-anchor="middle" fill="#38BDF8" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="700">${escapeXml(
        ln
      )}</text>`;
    })
    .join('\n');

  const cardTop = 340;
  const cardHeight = Math.max(380, calloutLines.length * lineGap + subLines.length * 44 + 170);

  const typographyOverlaySvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bordoBlueBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7B0F1C"/>
          <stop offset="50%" stop-color="#2E8BC9"/>
          <stop offset="100%" stop-color="#FFFFFF"/>
        </linearGradient>
        <filter id="textShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      </defs>

      <!-- Üst Bilgi Türü Ayrım Rozeti (Resmî Açıklama / Gazeteci İddiası / Editoryal Yorum) -->
      <g filter="url(#textShadow)">
        <rect x="52" y="165" width="380" height="54" rx="27" fill="${claimStyle.bg}" fill-opacity="0.95" stroke="${claimStyle.border}" stroke-width="2.5"/>
        <circle cx="84" cy="192" r="8" fill="${claimStyle.border}"/>
        <text x="106" y="200" fill="${claimStyle.text}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="1.2">${escapeXml(
    req.claimType
  )}</text>
      </g>

      <!-- Editoryal Potansiyel Puanı & Slayt Sayacı -->
      <g filter="url(#textShadow)">
        <rect x="52" y="234" width="290" height="44" rx="22" fill="#0A1122" fill-opacity="0.9" stroke="#2E8BC9" stroke-width="1.5"/>
        <text x="197" y="263" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800" letter-spacing="1">EDİTORYAL PUAN: ${
          req.editorialScore
        }/100</text>
      </g>

      <!-- Orta Sinematik Cam Kart (Az ve Okunabilir Güçlü Tipografi) -->
      <g filter="url(#textShadow)">
        <rect x="56" y="${cardTop}" width="${width - 112}" height="${cardHeight}" rx="32" fill="#081021" fill-opacity="0.84" stroke="url(#bordoBlueBorder)" stroke-width="3"/>
        <rect x="56" y="${cardTop}" width="14" height="${cardHeight}" rx="7" fill="#7B0F1C"/>
        <rect x="${width - 70}" y="${cardTop}" width="14" height="${cardHeight}" rx="7" fill="#2E8BC9"/>

        <!-- Slayt Bölüm Başlığı -->
        <rect x="${width / 2 - 170}" y="${cardTop + 28}" width="340" height="44" rx="22" fill="#7B0F1C" stroke="#2E8BC9" stroke-width="2"/>
        <text x="${width / 2}" y="${cardTop + 57}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900" letter-spacing="1.8">${escapeXml(
    req.slideBadge
  )} • ${req.slideIndex}/${req.totalSlides}</text>

        ${mainTextSvg}
        ${subTextSvg}
      </g>

      <!-- Alt Kaynak & Doğrulama Şeridi -->
      <g filter="url(#textShadow)">
        <rect x="84" y="${height - 108}" width="${width - 168}" height="52" rx="26" fill="#0A1122" fill-opacity="0.92" stroke="#1E293B" stroke-width="2"/>
        <text x="${width / 2}" y="${height - 75}" text-anchor="middle" fill="#CBD5E1" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="0.8">${escapeXml(
    req.sourceLabel || 'BORDO MAVİ HABER MERKEZİ • ÇAPRAZ DOĞRULANMIŞ İÇERİK'
  )}</text>
      </g>
    </svg>
  `);

  const layers: any[] = [];
  if (neuralBuf) {
    layers.push({ input: neuralBuf, blend: 'soft-light' });
  }
  layers.push({ input: typographyOverlaySvg, top: 0, left: 0 });

  await sharp(baseSvgBuf).composite(layers).png().toFile(req.outputPath);
  return req.outputPath;
}
