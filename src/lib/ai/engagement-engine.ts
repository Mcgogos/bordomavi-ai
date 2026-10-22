/**
 * BordoMavi AI — Etkileşim ve Topluluk Motoru (Engagement & Algorithm Engine)
 * Facebook algoritmasının yorumları ödüllendirmesini sağlayan otomatik CTA soruları,
 * A/B başlık varyasyonları ve itibar/risk denetimi sağlar.
 */

import { OFFICIAL_MANAGER } from "@/lib/squad/squad-service";

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
    const titleLower = title.toLocaleLowerCase("tr-TR");
    const leadLower = (title + " " + body.slice(0, 300)).toLocaleLowerCase("tr-TR");

    // 1. Rakip Analizi & Avrupa / Kupa Maçları
    if (leadLower.includes("rakip") || leadLower.includes("hearts") || leadLower.includes("avrupa") || leadLower.includes("konferans")) {
      const opponentCTAs = [
        "Sizce Fırtına bu Avrupa sınavından galibiyetle ayrılır mı? (EVET: Beğen / HAYIR: Yorum Yaz) Fikirlerinizi paylaşın! 🔴🔵",
        "Bu kritik mücadelede maçın yıldızı kim olur? Skor tahminlerinizi yoruma bekliyoruz! ⚽👇"
      ];
      return opponentCTAs[Math.floor(Math.random() * opponentCTAs.length)];
    }

    // 2. Hakem & Disiplin Kararları
    if (titleLower.includes("hakem") || titleLower.includes("tff") || titleLower.includes("pfdk") || titleLower.includes("ceza") || titleLower.includes("mhk")) {
      return "Sizce verilen bu hakem ve disiplin kararları adil mi? (EVET / HAYIR) Görüşlerinizi yorumlarda buluşturalım! 👇";
    }

    // 3. Sakatlık & Sağlık
    if (titleLower.includes("sakat") || titleLower.includes("tedavi") || titleLower.includes("revir") || leadLower.includes("forma giyemeyecek")) {
      return "Sizce bu eksikler takımın sahadaki oyununu olumsuz etkiler mi? Fikirlerinizi yorumlarda paylaşın! 🔴🔵";
    }

    // 4. Teknik Heyet & Taktik & Kadro
    if (titleLower.includes(OFFICIAL_MANAGER.name.toLowerCase()) || titleLower.includes("reis") || titleLower.includes("hoca") || titleLower.includes("taktik") || titleLower.includes("ilk 11")) {
      const coachCTAs = [
        "Hocamızın bu kararını destekliyor musunuz? (EVET / HAYIR) Katılanlar 'BEĞEN' butonuna bassın, fikri olan yoruma yazsın! 👇",
        "Sizce sahaya hangi 11 ile çıkmalıyız? İdeal kadronuzu yoruma bırakın, en çok beğenilen kadroyu öne çıkaralım! 🔴🔵",
        "Takımın taktiksel gelişimini 1-10 arası puanlayın: 1️⃣ - 🔟? Fikirlerinizi bekliyoruz! 👇"
      ];
      return coachCTAs[Math.floor(Math.random() * coachCTAs.length)];
    }

    // 5. Gerçek Transfer & Sözleşme (Sadece başlıkta veya ilk cümlede açık transfer aksiyonu varsa)
    if (titleLower.includes("transfer") || titleLower.includes("imza attı") || titleLower.includes("bonservis") || titleLower.includes("sözleşme imzaladı") || titleLower.includes("kiralık") || titleLower.includes("yeni transfer")) {
      const transferCTAs = [
        "Sizce bu transfer ilk 11'in değişilmezi mi olmalı, yoksa hamle oyuncusu mu kalmalı? (1: İlk 11 / 2: Yedek) Yorumlarda buluşalım! 👇",
        "Bordo-Mavili taraftarlar ne düşünüyor? Bu hamle şampiyonluk yolunda doğru adım mı? (EVET / HAYIR) Fikirlerinizi paylaşın! 🔴🔵",
        "Bu transfer hamlesini 1 ile 10 arasında puanlayın: 1️⃣ - 🔟? Yorumlarda oyluyoruz! 👇"
      ];
      return transferCTAs[Math.floor(Math.random() * transferCTAs.length)];
    }

    // 6. Maç & Derbi Öncesi / Sonrası
    if (titleLower.includes("maç") || titleLower.includes("derbi") || titleLower.includes("skor") || titleLower.includes("beşiktaş") || titleLower.includes("galatasaray") || titleLower.includes("fenerbahçe")) {
      const matchCTAs = [
        "Sizce maçın kırılma anı veya yıldızı kim olur? Skor tahminlerinizi yoruma yazın, bakalım kim bilecek! ⚽👇",
        "Fırtına bu kritik virajdan nasıl bir sonuçla ayrılır? (GALİBİYET / BERABERLİK / MAĞLUBİYET) Tahminleri alalım! 🔴🔵"
      ];
      return matchCTAs[Math.floor(Math.random() * matchCTAs.length)];
    }

    // 7. Yönetim & Başkan
    if (titleLower.includes("ertuğrul doğan") || titleLower.includes("başkan") || titleLower.includes("yönetim")) {
      return "Yönetimin ve başkanımızın bu adımını destekliyor musunuz? (EVET / HAYIR) Yorumlarınızı bekliyoruz! 👇";
    }

    // Varsayılan genel etkileşim sorusu
    const defaultCTAs = [
      "Bordo-Mavili renklere gönül verenler ses versin! Bu gelişme hakkında ne düşünüyorsunuz? Yorumlarda buluşalım! 🔴🔵",
      "Sizce bu gelişme Trabzonspor'umuzun sezon sonu hedeflerini nasıl etkiler? (1-10 arası puanlayın!) 👇"
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
