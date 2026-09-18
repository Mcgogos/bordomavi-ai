import { CanvaTemplateCategory } from './canva-service';
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from './brand-logo-data';

export interface AutoDesignOptions {
  title: string;
  subtitle?: string;
  playerName?: string;
  category: CanvaTemplateCategory;
  width?: number;
  height?: number;
  logoImage?: CanvasImageSource | null;
}

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

    // 1. DİNAMİK ARKA PLAN (10 Kategoriye Özel Gradyan)
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    if (options.category === "BREAKING") {
      bgGradient.addColorStop(0, "#7F1D1D"); // Canlı Bordo-Kırmızı
      bgGradient.addColorStop(0.5, "#0B1120"); // Gece Laciverti
      bgGradient.addColorStop(1, "#5A0A16"); // Koyu Bordo
    } else if (options.category === "TRANSFER") {
      bgGradient.addColorStop(0, "#5A0A16"); // Koyu Bordo
      bgGradient.addColorStop(0.5, "#0B1120"); // Gece Laciverti
      bgGradient.addColorStop(1, "#854D0E"); // Altın Parıltısı
    } else if (options.category === "MATCH_DAY") {
      bgGradient.addColorStop(0, "#164E7A"); // Karadeniz Mavisi
      bgGradient.addColorStop(0.5, "#0F172A");
      bgGradient.addColorStop(1, "#781324"); // Bordo
    } else if (options.category === "LINEUP") {
      bgGradient.addColorStop(0, "#064E3B"); // Zümrüt Taktik Saha Yeşili
      bgGradient.addColorStop(0.5, "#0F172A"); // Karadeniz Laciverti
      bgGradient.addColorStop(1, "#164E7A");
    } else if (options.category === "GOAL") {
      bgGradient.addColorStop(0, "#DC2626"); // Canlı Kırmızı
      bgGradient.addColorStop(0.6, "#0F172A");
      bgGradient.addColorStop(1, "#1E3A8A"); // Derin Mavi
    } else if (options.category === "PENALTY_CARD") {
      bgGradient.addColorStop(0, "#7F1D1D"); // Uyarı Kırmızısı
      bgGradient.addColorStop(0.6, "#18181B"); // Antrasit
      bgGradient.addColorStop(1, "#92400E"); // Amber Gold
    } else if (options.category === "RESULT") {
      bgGradient.addColorStop(0, "#781324"); // Şampiyon Bordosu
      bgGradient.addColorStop(0.5, "#0F172A");
      bgGradient.addColorStop(1, "#D97706"); // Zafer Altını
    } else if (options.category === "QUOTE") {
      bgGradient.addColorStop(0, "#0F172A"); // Ciddi Lacivert
      bgGradient.addColorStop(0.6, "#1E293B");
      bgGradient.addColorStop(1, "#164E7A"); // Karadeniz Mavisi
    } else if (options.category === "REELS") {
      bgGradient.addColorStop(0, "#0A0F1D"); // Dikey Gece
      bgGradient.addColorStop(0.4, "#1E1B4B");
      bgGradient.addColorStop(1, "#781324");
    } else {
      // OFFICIAL
      bgGradient.addColorStop(0, "#500712"); // Kurumsal Koyu Bordo
      bgGradient.addColorStop(0.7, "#0F172A");
      bgGradient.addColorStop(1, "#164E7A");
    }

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. IŞIK HÜZMELERİ, STADYUM PARILTILARI VEYA KATEGORİ DESENLERİ
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#FFFFFF";

    if (options.category === "QUOTE") {
      // Tırnak işareti filigranı
      ctx.font = "bold 260px Georgia, serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillText("“", 60, 320);
    } else if (options.category === "LINEUP") {
      // Taktik saha çizgileri
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 60, width - 120, height - 120);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, width * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Çapraz ışık hüzmeleri
      ctx.beginPath();
      ctx.moveTo(width * 0.1, 0);
      ctx.lineTo(width * 0.4, 0);
      ctx.lineTo(width * 0.8, height);
      ctx.lineTo(width * 0.5, height);
      ctx.closePath();
      ctx.fill();
    }

    // Sağ üst parıltı çemberi
    const radialGlow = ctx.createRadialGradient(width * 0.85, height * 0.15, 10, width * 0.85, height * 0.15, 400);
    radialGlow.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    radialGlow.addColorStop(0.5, options.category === "TRANSFER" ? "rgba(217, 119, 6, 0.25)" : "rgba(56, 189, 248, 0.2)");
    radialGlow.addColorStop(1, "transparent");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 3. DIŞ ÇERÇEVE & KURUMSAL BORDER
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // Köşe vurgu çizgileri (Gold / Cyan / Crimson)
    let cornerColor = "#38BDF8";
    if (options.category === "TRANSFER" || options.category === "RESULT") cornerColor = "#F59E0B";
    if (options.category === "BREAKING" || options.category === "GOAL" || options.category === "PENALTY_CARD") cornerColor = "#EF4444";
    if (options.category === "LINEUP") cornerColor = "#10B981";

    ctx.strokeStyle = cornerColor;
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

    // 4. SAĞ ÜST: KULLANICININ YÜKLEDİĞİ ORİJİNAL BORDOMAVİ LOGOSU (KESİN & GARANTİLİ)
    const logoBoxSize = Math.min(width, height) * 0.15;
    const logoX = width - logoBoxSize - 60;
    const logoY = 50;

    ctx.save();
    // Beyaz cam rozet zemin
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.arc(logoX + logoBoxSize / 2, logoY + logoBoxSize / 2, logoBoxSize / 2 + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const logoToDraw = options.logoImage || cachedUserLogo;
    if (logoToDraw && (logoToDraw as HTMLImageElement).complete && (logoToDraw as HTMLImageElement).naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoBoxSize / 2, logoY + logoBoxSize / 2, logoBoxSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoToDraw, logoX, logoY, logoBoxSize, logoBoxSize);
      ctx.restore();
    } else {
      try {
        const directLogo = new Image();
        directLogo.src = BORDOMAVI_BRAND_LOGO_DATA_URI;
        if (directLogo.complete && directLogo.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(logoX + logoBoxSize / 2, logoY + logoBoxSize / 2, logoBoxSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(directLogo, logoX, logoY, logoBoxSize, logoBoxSize);
          ctx.restore();
        }
      } catch {}
    }
    ctx.restore();

    // 5. OYUNCU / ÖZNE ETİKETİ (Varsa ve doluysa)
    let currentY = 120;
    if (options.playerName && options.playerName.trim()) {
      ctx.save();
      ctx.font = "bold 32px sans-serif";
      ctx.fillStyle = "#FBBF24"; // Altın sarısı
      ctx.fillText("★ " + options.playerName.toUpperCase(), 72, currentY);
      currentY += 55;
      ctx.restore();
    }

    // 7. ANA MANŞET (Metin Temizleme: ** ve * tamamen arındırılır, Otomatik Boyutlandırma)
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

    // 8. ALT METİN / SPOT AÇIKLAMA (** ve * temizliği yapılmış)
    currentY += 20;
    const rawSubtitle = options.subtitle || "Trabzonspor kulübünden taraftarı heyecanlandıran önemli adım.";
    const subText = rawSubtitle
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    ctx.save();
    ctx.font = "500 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#E2E8F0";
    ctx.globalAlpha = 0.88;

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

    // 9. ALT BİLGİ BANDI (SADECE 'BordoMavi' — PAPARA PARK ÖZEL YAYINI VE BENZERİ KALDIRILDI)
    ctx.save();
    const footerY = height - 90;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, footerY - 20);
    ctx.lineTo(width - 72, footerY - 20);
    ctx.stroke();

    ctx.font = "900 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText("BordoMavi", 72, footerY + 10);

    ctx.textAlign = "right";
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#38BDF8";
    ctx.fillText("#Trabzonspor #BordoMavi", width - 72, footerY + 10);
    ctx.restore();

    return canvas.toDataURL("image/png");
  }
}