/**
 * Canva Autonomous Design Engine (CanvaAutoDesigner)
 * Automatically designs pixel-perfect, high-resolution (1080x1080 / 1080x1350)
 * Trabzonspor graphics with zero manual design work.
 */

export interface AutoDesignOptions {
  title: string;
  subtitle?: string;
  playerName?: string;
  category: "TRANSFER" | "MATCH_DAY" | "GOAL" | "REELS" | "OFFICIAL";
  width?: number;
  height?: number;
  logoImage?: CanvasImageSource | null;
}

import { BORDOMAVI_BRAND_LOGO_DATA_URI } from './brand-logo-data';

// Client-side logo cache for the user's authentic uploaded logo
let cachedUserLogo: HTMLImageElement | null = null;
if (typeof window !== "undefined") {
  try {
    const img = new Image();
    img.src = BORDOMAVI_BRAND_LOGO_DATA_URI;
    cachedUserLogo = img;
  } catch {}
}

export class CanvaAutoDesigner {
  /**
   * Helper to draw a stylized Trabzonspor vector crest on the canvas.
   */
  private static drawCrest(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save();
    ctx.translate(x, y);

    // 1. Şampiyonluk Yıldızı (Üstte Altın Yıldız)
    ctx.fillStyle = "#F59E0B";
    const starY = -size * 0.58;
    const starR = size * 0.13;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const sx = Math.cos(angle) * starR;
      const sy = starY + Math.sin(angle) * starR;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Kalkan Dış Çizgisi (Kalkan Şekli)
    const w = size * 0.44;
    const h = size * 0.5;
    
    // Sol Yarı (Bordo)
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(-w, -h);
    ctx.lineTo(-w, 0);
    ctx.quadraticCurveTo(-w, h * 0.6, 0, h);
    ctx.lineTo(0, -h);
    ctx.closePath();
    ctx.fillStyle = "#781324";
    ctx.fill();

    // Sağ Yarı (Karadeniz Mavisi)
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, -h);
    ctx.lineTo(w, 0);
    ctx.quadraticCurveTo(w, h * 0.6, 0, h);
    ctx.lineTo(0, -h);
    ctx.closePath();
    ctx.fillStyle = "#164E7A";
    ctx.fill();

    // 3. Altın Kalkan Çerçevesi
    ctx.beginPath();
    ctx.moveTo(-w, -h);
    ctx.lineTo(w, -h);
    ctx.lineTo(w, 0);
    ctx.quadraticCurveTo(w, h * 0.6, 0, h);
    ctx.quadraticCurveTo(-w, h * 0.6, -w, 0);
    ctx.closePath();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 4;
    ctx.stroke();

    // 4. TS Harf Monogramı (Ortada Altın Sarısı)
    ctx.fillStyle = "#FBBF24";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(size * 0.4)}px serif`;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText("TS", 0, -h * 0.05);

    // 5. 1967 Kuruluş Yılı (Kalkan Altında)
    ctx.font = `bold ${Math.round(size * 0.15)}px sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowBlur = 4;
    ctx.fillText("1967", 0, h + size * 0.18);

    ctx.restore();
  }

  /**
   * Automatically draws a complete Canva-grade graphic onto an HTML5 canvas.
   * Returns base64 PNG data URL.
   */
  static render(canvas: HTMLCanvasElement, options: AutoDesignOptions): string {
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const width = options.width || 1080;
    const height = options.height || 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. DİNAMİK ARKA PLAN (Bordo - Karadeniz Laciverti Gradyan)
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    if (options.category === "TRANSFER") {
      bgGradient.addColorStop(0, "#5A0A16"); // Koyu Bordo
      bgGradient.addColorStop(0.5, "#0B1120"); // Gece Laciverti
      bgGradient.addColorStop(1, "#854D0E"); // Altın Parıltısı
    } else if (options.category === "GOAL") {
      bgGradient.addColorStop(0, "#7F1D1D"); // Canlı Kırmızı
      bgGradient.addColorStop(0.6, "#0F172A");
      bgGradient.addColorStop(1, "#1E3A8A"); // Derin Mavi
    } else if (options.category === "MATCH_DAY") {
      bgGradient.addColorStop(0, "#164E7A"); // Karadeniz Mavisi
      bgGradient.addColorStop(0.5, "#0F172A");
      bgGradient.addColorStop(1, "#781324"); // Bordo
    } else {
      bgGradient.addColorStop(0, "#781324");
      bgGradient.addColorStop(0.7, "#0F172A");
      bgGradient.addColorStop(1, "#164E7A");
    }

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. STADYUM IŞIKLARI & GEOMETRİK PARILTILAR
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#FFFFFF";

    // Çapraz ışık hüzmeleri
    ctx.beginPath();
    ctx.moveTo(width * 0.1, 0);
    ctx.lineTo(width * 0.4, 0);
    ctx.lineTo(width * 0.8, height);
    ctx.lineTo(width * 0.5, height);
    ctx.closePath();
    ctx.fill();

    // Sağ üst parıltı çemberi
    const radialGlow = ctx.createRadialGradient(width * 0.85, height * 0.15, 10, width * 0.85, height * 0.15, 400);
    radialGlow.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    radialGlow.addColorStop(0.5, "rgba(217, 119, 6, 0.2)");
    radialGlow.addColorStop(1, "transparent");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 3. DIŞ ÇERÇEVE & KURUMSAL BORDER
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // Köşe vurgu çizgileri (Gold / Cyan)
    ctx.strokeStyle = options.category === "TRANSFER" ? "#F59E0B" : "#38BDF8";
    ctx.lineWidth = 8;
    // Sol üst
    ctx.beginPath();
    ctx.moveTo(36, 96);
    ctx.lineTo(36, 36);
    ctx.lineTo(96, 36);
    ctx.stroke();
    // Sağ alt
    ctx.beginPath();
    ctx.moveTo(width - 36, height - 96);
    ctx.lineTo(width - 36, height - 36);
    ctx.lineTo(width - 96, height - 36);
    ctx.stroke();
    ctx.restore();

    // 4. ÜST ROZET (Kategori Rozeti)
    let badgeText = "ÖZEL HABER";
    let badgeBg = "#164E7A";
    if (options.category === "TRANSFER") {
      badgeText = "🔥 FLAŞ TRANSFER BOMBASI";
      badgeBg = "#D97706";
    } else if (options.category === "GOAL") {
      badgeText = "⚽ CANLI GOL ANONS KARTI";
      badgeBg = "#DC2626";
    } else if (options.category === "MATCH_DAY") {
      badgeText = "🏟️ MAÇ GÜNÜ & STADYUM";
      badgeBg = "#0284C7";
    } else if (options.category === "OFFICIAL") {
      badgeText = "🏛️ RESMİ KULÜP AÇIKLAMASI";
      badgeBg = "#781324";
    }

    ctx.save();
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const badgeWidth = ctx.measureText(badgeText).width + 48;
    const badgeHeight = 52;
    const badgeX = 72;
    const badgeY = 72;

    // Rozet Arka Planı (Hafif yuvarlak)
    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 10);
    ctx.fill();

    // Rozet Metni
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, badgeX + 24, badgeY + badgeHeight / 2);

    // Sağ Üst: Kullanıcının Yüklediği Orijinal BordoMavi Logosu (Garantili)
    const logoBoxSize = Math.min(width, height) * 0.14;
    const logoX = width - logoBoxSize - 60;
    const logoY = 50;

    // Şık beyaz/şeffaf cam zemin rozeti
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(logoX - 8, logoY - 8, logoBoxSize + 16, logoBoxSize + 16, 16);
    ctx.fill();

    const logoToDraw = options.logoImage || cachedUserLogo;
    if (logoToDraw && (logoToDraw as HTMLImageElement).complete && (logoToDraw as HTMLImageElement).naturalWidth > 0) {
      ctx.drawImage(logoToDraw, logoX, logoY, logoBoxSize, logoBoxSize);
    } else {
      try {
        const directLogo = new Image();
        directLogo.src = BORDOMAVI_BRAND_LOGO_DATA_URI;
        ctx.drawImage(directLogo, logoX, logoY, logoBoxSize, logoBoxSize);
      } catch {
        this.drawCrest(ctx, width - 110, 110, logoBoxSize);
      }
    }
    ctx.restore();

    // 5. OYUNCU / ÖZNE ETİKETİ (Varsa)
    let currentY = 240;
    if (options.playerName) {
      ctx.save();
      ctx.font = "bold 32px sans-serif";
      ctx.fillStyle = "#FBBF24"; // Altın sarısı
      ctx.fillText("★ " + options.playerName.toUpperCase(), 72, currentY);
      currentY += 60;
      ctx.restore();
    }

    // 6. ANA MANŞET (Metin Temizleme: ** ve * kaldırılır, Otomatik Kelime Bölme & Boyutlandırma)
    const cleanTitle = (options.title || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    let fontSize = 64;
    if (cleanTitle.length > 70) fontSize = 52;
    if (cleanTitle.length > 100) fontSize = 44;

    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textBaseline = "top";

    const maxLineWidth = width - 144;
    const words = cleanTitle.split(" ");
    let currentLine = "";
    const lines: string[] = [];

    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxLineWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Başlık Satırlarını Çiz
    const lineHeight = fontSize * 1.25;
    for (const line of lines.slice(0, 4)) {
      ctx.fillText(line, 72, currentY);
      currentY += lineHeight;
    }
    ctx.restore();

    // 7. ALT METİN / SPOT AÇIKLAMA (** ve * temizliği yapılmış)
    currentY += 20;
    const rawSubtitle = options.subtitle || "Trabzonspor kulübünden taraftarı heyecanlandıran önemli adım.";
    const subText = rawSubtitle
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    ctx.save();
    ctx.font = "500 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#E2E8F0";
    ctx.globalAlpha = 0.85;

    const subWords = subText.split(" ");
    let subLine = "";
    const subLines: string[] = [];
    for (const w of subWords) {
      const test = subLine ? subLine + " " + w : w;
      if (ctx.measureText(test).width > maxLineWidth && subLine) {
        subLines.push(subLine);
        subLine = w;
      } else {
        subLine = test;
      }
    }
    if (subLine) subLines.push(subLine);

    for (const line of subLines.slice(0, 2)) {
      ctx.fillText(line, 72, currentY);
      currentY += 40;
    }
    ctx.restore();

    // 8. ALT BİLGİ BANDI (Sadece 'BORDO MAVİ' & Kulüp Etiketi)
    ctx.save();
    const footerY = height - 90;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, footerY - 20);
    ctx.lineTo(width - 72, footerY - 20);
    ctx.stroke();

    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText("BORDO MAVİ", 72, footerY + 10);

    ctx.textAlign = "right";
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#38BDF8";
    ctx.fillText("#Trabzonspor #BordoMavi", width - 72, footerY + 10);
    ctx.restore();

    return canvas.toDataURL("image/png");
  }
}