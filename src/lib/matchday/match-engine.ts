import { prisma } from "@/lib/db";
import { FacebookService } from "@/services/facebook.service";

export interface MatchEventParams {
  type: "GOAL" | "RED_CARD" | "HALF_TIME" | "FULL_TIME";
  opponent: string;
  homeScore: number;
  awayScore: number;
  minute: string;
  player?: string;
  assist?: string;
  team?: string; // "Trabzonspor" or opponent name
}

export const CURRENT_TRABZONSPOR_SQUAD = [
  { name: "Simon Banza", position: "Santrfor", number: "17" },
  { name: "Muhammed Cham", position: "10 Numara", number: "10" },
  { name: "Denis Drăguș", position: "Forvet", number: "70" },
  { name: "Anthony Nwakaeme", position: "Hücum", number: "9" },
  { name: "Edin Vişça", position: "Kanat & Asist", number: "7" },
  { name: "Pedro Malheiro", position: "Sağ Bek", number: "79" },
  { name: "Stefan Savić", position: "Lider Stoper", number: "15" },
  { name: "Batista Mendy", position: "Orta Saha", number: "6" },
  { name: "Okay Yokuşlu", position: "Milli Orta Saha", number: "35" },
  { name: "John Lundstram", position: "Orta Saha", number: "5" },
  { name: "Cihan Çanak", position: "Genç Kanat", number: "61" },
  { name: "Enis Destan", position: "Genç Golcü", number: "99" },
  { name: "Eren Elmalı", position: "Sol Bek", number: "18" },
  { name: "Arseniy Batagov", position: "Stoper", number: "4" },
  { name: "Serdar Saatçı", position: "Stoper", number: "29" },
  { name: "Uğurcan Çakır", position: "Kaptan & Kaleci", number: "1" },
];

export const CURRENT_SUPER_LIG_OPPONENTS = [
  "Fenerbahçe",
  "Galatasaray",
  "Beşiktaş",
  "Samsunspor (Karadeniz Derbisi)",
  "Çaykur Rizespor",
  "Eyüpspor",
  "Göztepe",
  "Başakşehir",
  "Sivasspor",
  "Konyaspor",
  "Antalyaspor",
  "Alanyaspor",
  "Kasımpaşa",
  "Gaziantep FK",
  "Kayserispor",
  "Bodrum FK",
  "Hatayspor",
  "Adana Demirspor"
];

export class MatchAutomationEngine {
  /**
   * Generates Facebook post content and OG image, then publishes directly
   * to Facebook without requiring any manual action from the user.
   */
  static async publishMatchEventDirectly(params: MatchEventParams) {
    const { type, opponent, homeScore, awayScore, minute, player, assist, team } = params;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";

    let title = "";
    let body = "";
    let template = "GOAL";
    const cleanPlayer = player || "Simon Banza";
    const playerHashtag = "#" + cleanPlayer.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, "");

    switch (type) {
      case "GOAL": {
        template = "GOAL";
        const isTrabzonsporGoal = !team || team === "Trabzonspor";
        if (isTrabzonsporGoal) {
          title = `⚽ GOOOLLL! ${cleanPlayer}! Trabzonspor ${homeScore} - ${awayScore} ${opponent} (${minute})`;
          const assistText = assist ? ` ${assist}'nın enfes asistinde` : "";
          body = `⚽ GOOOOOLLLL! DAKİKA ${minute}!\n\nTrabzonspor'umuz ${cleanPlayer}'nın${assistText} attığı muazzam golle skoru ${homeScore} - ${awayScore} yapıyor! Papara Park ayakta!\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nSizce bu maçı kaç kaç kazanırız? Yorumlarda buluşalım! 👇\n\n#Trabzonspor #BordoMavi ${playerHashtag} #Fırtına #Gol`;
        } else {
          title = `⚽ Rakip Golü | Trabzonspor ${homeScore} - ${awayScore} ${opponent} (${minute})`;
          body = `⚽ Gol (${minute}) - ${opponent} takımı ${cleanPlayer} ile golü buldu.\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nHaydi Fırtına! Şimdi toparlanma ve baskı zamanı!\n\n#Trabzonspor #BordoMavi #Fırtına`;
        }
        break;
      }

      case "RED_CARD": {
        template = "RED_CARD";
        const isOpponent = team && team !== "Trabzonspor";
        title = `🟥 KIRMIZI KART! ${cleanPlayer} (${minute}) | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
        body = `🟥 KIRMIZI KART! DAKİKA ${minute}!\n\nMücadelede tansiyon zirveye çıktı! ${isOpponent ? opponent : "Trabzonspor"} takımında ${cleanPlayer} kırmızı kart görerek oyun dışında kaldı!\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nBu kart maçı nasıl etkiler? Görüşlerinizi yorumda belirtin! 👇\n\n#Trabzonspor #BordoMavi #KırmızıKart #SüperLig`;
        break;
      }

      case "HALF_TIME": {
        template = "MATCH_DAY";
        title = `⏸️ İLK YARI SONUCU | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
        body = `⏸️ İLK YARI SONA ERDİ!\n\nPapara Park'ta ilk 45 dakika tamamlandı. Takımlar soyunma odasına bu skorla gidiyor:\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nİkinci yarıda Şenol Güneş'ten hangi hamleleri bekliyorsunuz? 👇\n\n#Trabzonspor #BordoMavi #İlkYarı #Fırtına`;
        break;
      }

      case "FULL_TIME": {
        template = "FULL_TIME";
        const isWin = homeScore > awayScore;
        const isDraw = homeScore === awayScore;
        const resultHeader = isWin 
          ? "🎉 FIRTINA'DAN DEV ZAFER! 3 PUAN TRABZONSPOR'UN!" 
          : isDraw 
          ? "🤝 MÜCADELE SONA ERDİ" 
          : "🏁 MAÇ SONUCU";

        title = `🏁 MAÇ SONUCU | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
        body = `${resultHeader}\n\nTrendyol Süper Lig mücadelesinde Trabzonspor'umuz sahadan ${homeScore} - ${awayScore} skorla ayrılıyor.\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nMaçın adamı sizce kimdi? Maç değerlendirmenizi bekliyoruz! 👇\n\n#Trabzonspor #BordoMavi #MaçSonucu #SüperLig`;
        break;
      }
    }

    const ogUrl = `${appUrl}/api/og?title=${encodeURIComponent(title)}&template=${template}&score=${homeScore}-${awayScore}&player=${encodeURIComponent(cleanPlayer)}&minute=${encodeURIComponent(minute)}`;

    // 1. Publish directly to Facebook via FacebookService
    console.log(`[Match Engine] Publishing ${type} event to Facebook...`);
    const fbResponse = await FacebookService.publishPost(body, ogUrl);

    // 2. Save in database as PUBLISHED content
    try {
      await prisma.content.create({
        data: {
          title,
          body,
          status: "PUBLISHED",
          facebookPostId: fbResponse.postId,
          publishedAt: new Date(),
          type: "MATCH_REPORT",
          hashtags: "#Trabzonspor #BordoMavi #CanlıMaç",
          qualityScore: 95,
          viralScore: 98,
          discussionScore: 92
        }
      });
    } catch (dbErr) {
      console.warn("[Match Engine] Could not persist to DB, but FB publish completed:", dbErr);
    }

    return {
      success: true,
      title,
      body,
      ogUrl,
      postId: fbResponse.postId,
      mockMode: fbResponse.mockMode,
      message: `${type} anonsu Facebook'ta başarıyla yayınlandı!`
    };
  }
}