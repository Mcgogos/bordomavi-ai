/**
 * BordoMavi AI — Etkileşim ve Topluluk Motoru (Engagement & Algorithm Engine)
 * Facebook algoritmasının yorumları ödüllendirmesini sağlayan otomatik CTA soruları,
 * A/B başlık varyasyonları ve itibar/risk denetimi sağlar.
 */

export interface ABHeadlineVariant {
  type: "VIRAL" | "CORPORATE" | "FAN";
  label: string;
  badge: string;
  headline: string;
  reason: string;
}

export interface RiskAnalysisResult {
  score: number; // 0-100 (100 = çok güvenli)
  status: "SAFE" | "ATTENTION" | "RISKY";
  sentiment: "POZİTİF" | "DENGELİ" | "KRİTİK";
  badgeColor: string;
  feedback: string;
}

export class EngagementEngine {
  /**
   * Facebook gönderisinin sonuna taraftarların yorum yapmasını tetikleyecek akıllı sorular ekler.
   */
  static generateEngagementCTA(title: string, body: string): string {
    const textLower = (title + " " + body).toLowerCase();

    if (textLower.includes("transfer") || textLower.includes("imza") || textLower.includes("bonservis") || textLower.includes("kulüp")) {
      const transferCTAs = [
        "Sizce bu transfer Trabzonspor'umuza güç katar mı? İlk 11 için yeterli mi? Görüşlerinizi yorumlarda paylaşın! 👇",
        "Bordo-Mavili taraftarlar ne düşünüyor? Bu hamle şampiyonluk yolunda doğru adım mı? Yorumlarda buluşalım! 🔴🔵",
        "Siz olsaydınız bu mevkiye kimi transfer ederdiniz? Fikirlerinizi bekliyoruz! 👇"
      ];
      return transferCTAs[Math.floor(Math.random() * transferCTAs.length)];
    }

    if (textLower.includes("şenol güneş") || textLower.includes("hoca") || textLower.includes("teknik direktör") || textLower.includes("taktik")) {
      const coachCTAs = [
        "Hocamızın bu kararını nasıl değerlendiriyorsunuz? Sizce doğru 11 sahada mı? Yorumlarınızı yazın! 👇",
        "Takımın taktiksel gelişimini nasıl buluyorsunuz? Fikirlerinizi bizimle paylaşın! 🔴🔵"
      ];
      return coachCTAs[Math.floor(Math.random() * coachCTAs.length)];
    }

    if (textLower.includes("maç") || textLower.includes("derbi") || textLower.includes("skor") || textLower.includes("rakip")) {
      const matchCTAs = [
        "Sizce maçın yıldızı kim olur? Skor tahminlerinizi yoruma yazın, bakalım kim bilecek! ⚽👇",
        "Fırtına bu maçtan nasıl bir sonuçla ayrılır? Skor tahminlerinizi bekliyoruz! 🔴🔵"
      ];
      return matchCTAs[Math.floor(Math.random() * matchCTAs.length)];
    }

    // Varsayılan genel etkileşim sorusu
    const defaultCTAs = [
      "Bordo-Mavili renklere gönül veren taraftarlarımız ne düşünüyor? Düşüncelerinizi yorumlarda belirtin! 🔴🔵",
      "Sizce bu gelişme takımın gidişatını nasıl etkiler? Yorumlarınızı bekliyoruz! 👇"
    ];
    return defaultCTAs[Math.floor(Math.random() * defaultCTAs.length)];
  }

  /**
   * Bir haber için 3 farklı açıda A/B başlık önerisi sunar.
   */
  static generateABHeadlines(title: string): ABHeadlineVariant[] {
    const clean = title.replace(/[^\w\sğüşıöçĞÜŞİÖÇ\-]/g, "").trim();

    return [
      {
        type: "VIRAL",
        label: "Viral & Merak Uyandırıcı",
        badge: "Yüksek Tıklama",
        headline: `Flaş Gelişme! Trabzonspor'da ${clean}: İşte Perde Arkasındaki Gerçekler`,
        reason: "Merak unsurunu öne çıkarır, Facebook akışında tıklanma oranını artırır."
      },
      {
        type: "CORPORATE",
        label: "Resmi & Kurumsal",
        badge: "Güvenilir & Ciddi",
        headline: `Trabzonspor Gündemi | ${clean}`,
        reason: "Kurumsal ve ciddi habercilik standardına tam uyum sağlar."
      },
      {
        type: "FAN",
        label: "Coşkulu Taraftar Dili",
        badge: "Duygusal Bağ",
        headline: `Bordo-Mavi Fırtına! ${clean} — Trabzonspor Camiası Kenetlendi!`,
        reason: "Taraftar ruhunu ateşler, beğeni ve paylaşım refleksini tetikler."
      }
    ];
  }

  /**
   * Haberin dedikodu, spekülasyon ve ceza riskini denetleyen İtibar & Risk Radarı.
   */
  static analyzeRiskAndReputation(title: string, body: string): RiskAnalysisResult {
    const combined = (title + " " + body).toLowerCase();

    // Riskli anahtar kelimeler
    const riskyKeywords = ["kavga", "ayrılık resti", "isyan", "tff ceza", "skandal", "ihanet", "yalan"];
    const hasRisk = riskyKeywords.some(kw => combined.includes(kw));

    if (hasRisk) {
      return {
        score: 65,
        status: "ATTENTION",
        sentiment: "KRİTİK",
        badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        feedback: "Hassas ifadeler içeriyor. Kulüp itibarını korumak için resmi teyit önerilir."
      };
    }

    if (combined.includes("tebrik") || combined.includes("galibiyet") || combined.includes("transfer tamam") || combined.includes("imza attı")) {
      return {
        score: 98,
        status: "SAFE",
        sentiment: "POZİTİF",
        badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        feedback: "Yüksek motivasyon ve olumlu taraftar algısı oluşturan güvenli içerik."
      };
    }

    return {
      score: 92,
      status: "SAFE",
      sentiment: "DENGELİ",
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      feedback: "Dengeli ve tarafsız habercilik standartlarına uygun içerik."
    };
  }
}
