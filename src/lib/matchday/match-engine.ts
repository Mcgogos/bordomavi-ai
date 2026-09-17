import { prisma } from "@/lib/db";
import { FacebookService } from "@/services/facebook.service";

export interface MatchEventParams {
  type: "LINEUP" | "GOAL" | "YELLOW_CARD" | "RED_CARD" | "HALF_TIME" | "FULL_TIME";
  opponent: string;
  homeScore: number;
  awayScore: number;
  minute: string;
  player?: string;
  assist?: string;
  team?: string; // "Trabzonspor" or opponent name
}

export const CURRENT_TRABZONSPOR_SQUAD = [
  { name: "Paul Onuachu", position: "Santrfor", number: "30" },
  { name: "Anthony Nwakaeme", position: "Sol Forvet & Lider", number: "9" },
  { name: "Denis Drăguș", position: "Hücum & Forvet", number: "70" },
  { name: "Edin Vişça", position: "Sağ Kanat & Asist", number: "7" },
  { name: "Muhammed Cham", position: "10 Numara & Oyun Kurucu", number: "10" },
  { name: "Ernest Muçi", position: "Ofansif Orta Saha", number: "10" },
  { name: "Oleksandr Zubkov", position: "Kanat Forvet", number: "22" },
  { name: "Okay Yokuşlu", position: "Milli Ön Libero", number: "5" },
  { name: "Ozan Tufan", position: "Merkez Orta Saha", number: "11" },
  { name: "Batista Mendy", position: "Dinamik Orta Saha", number: "6" },
  { name: "Tim Jabol Folcarelli", position: "Orta Saha", number: "26" },
  { name: "Cihan Çanak", position: "Genç Yetenek & Kanat", number: "61" },
  { name: "Umut Nayir", position: "Santrfor", number: "18" },
  { name: "Stefan Savić", position: "Savunma Lideri", number: "15" },
  { name: "Arseniy Batagov", position: "Stoper", number: "44" },
  { name: "Samet Akaydın", position: "Milli Stoper", number: "4" },
  { name: "Cenk Özkacar", position: "Stoper & Sol Bek", number: "39" },
  { name: "Serdar Saatçı", position: "Stoper", number: "29" },
  { name: "Wagner Pina", position: "Sağ Bek", number: "20" },
  { name: "Sidny Lopes Cabral", position: "Sol Bek", number: "55" },
  { name: "André Onana", position: "1. Kaleci", number: "24" },
  { name: "Onuralp Çevikkan", position: "Genç Kaleci", number: "25" },
  { name: "Şenol Güneş", position: "Teknik Direktör", number: "TD" },
];

export const CURRENT_SUPER_LIG_OPPONENTS = [
  "Galatasaray",
  "Fenerbahçe",
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

export interface LiveMatchFixture {
  homeTeam: string;
  awayTeam: string;
  league: string;
  week: number;
  date: string;
  time: string;
  stadium: string;
  status: "UPCOMING" | "LIVE" | "FINISHED";
  minute?: number;
  homeScore: number;
  awayScore: number;
}

export const THIS_WEEK_FIXTURE: LiveMatchFixture = {
  homeTeam: "Trabzonspor",
  awayTeam: "Galatasaray",
  league: "Trendyol Süper Lig 2026/2027 Sezonu",
  week: 6,
  date: "19 Eylül 2026 Cumartesi",
  time: "20:00",
  stadium: "Papara Park, Trabzon",
  status: "UPCOMING",
  homeScore: 0,
  awayScore: 0
};

export interface MackolikLiveMovement {
  id: string;
  minute: string;
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION" | "VAR" | "DANGEROUS_ATTACK";
  team: string;
  player: string;
  description: string;
  score: string;
}

export class MackolikLiveScoreClient {
  /**
   * Fetches or simulates the latest live match movements and stats (Mackolik/TFF style).
   */
  static async fetchLatestMovements(): Promise<MackolikLiveMovement[]> {
    return [
      {
        id: "ev-1",
        minute: "61'",
        type: "GOAL",
        team: "Trabzonspor",
        player: "Paul Onuachu",
        description: "GOOOLLL! Anthony Nwakaeme sol kanattan ortaladı, Paul Onuachu kafayla topu ağlara gönderdi!",
        score: "2 - 1"
      },
      {
        id: "ev-2",
        minute: "54'",
        type: "YELLOW_CARD",
        team: "Trabzonspor",
        player: "Stefan Savić",
        description: "Hakem Stefan Savić'e orta alandaki müdahalesi nedeniyle sarı kart gösterdi.",
        score: "1 - 1"
      },
      {
        id: "ev-3",
        minute: "38'",
        type: "GOAL",
        team: "Galatasaray",
        player: "Mauro Icardi",
        description: "Gol. Ceza sahasında yaşanan karambolde Icardi skora denge getirdi.",
        score: "1 - 1"
      },
      {
        id: "ev-4",
        minute: "17'",
        type: "GOAL",
        team: "Trabzonspor",
        player: "Edin Vişça",
        description: "GOOOLLL! Ernest Muçi'nin derin pasında Edin Vişça ceza sahası sağ çaprazından sert vurdu ve takımımızı öne geçirdi!",
        score: "1 - 0"
      },
      {
        id: "ev-5",
        minute: "1'",
        type: "DANGEROUS_ATTACK",
        team: "Trabzonspor",
        player: "Muhammed Cham",
        description: "Papara Park'ta dev derbi hakemin düdüğüyle başladı! Fırtına ilk dakikada baskıyla başladı.",
        score: "0 - 0"
      }
    ];
  }
}

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
    const cleanPlayer = (player || "Paul Onuachu").replace(/\*\*/g, '').replace(/\*/g, '').trim();
    const playerHashtag = "#" + cleanPlayer.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, "");

    switch (type) {
      case "LINEUP": {
        template = "MATCH_DAY";
        title = `📋 İLK 11'İMİZ AÇIKLANDI! | Trabzonspor - ${opponent}`;
        const squadList = [
          "🧤 24. André Onana",
          "🛡️ 15. Stefan Savić",
          "🛡️ 44. Arseniy Batagov",
          "🛡️ 20. Wagner Pina",
          "🛡️ 39. Cenk Özkacar",
          "⚙️ 5. Okay Yokuşlu",
          "⚙️ 11. Ozan Tufan",
          "🎯 10. Muhammed Cham",
          "⚡ 7. Edin Vişça",
          "⚡ 9. Anthony Nwakaeme",
          "🎯 30. Paul Onuachu"
        ].join("\n");

        body = `📋 Trabzonspor'umuzun ${opponent} derbisi ilk 11'i açıklandı!\n\n${squadList}\n\n👔 Teknik Direktör: Şenol Güneş\n\nBaşarılar Fırtına! Zafer bizim olsun!\n\n#Trabzonspor #BordoMavi #İlk11 #SüperLig #Fırtına #TSvGS`;
        break;
      }

      case "GOAL": {
        template = "GOAL";
        const isTrabzonsporGoal = !team || team === "Trabzonspor";
        if (isTrabzonsporGoal) {
          title = `⚽ GOOOLLL! ${cleanPlayer}! Trabzonspor ${homeScore} - ${awayScore} ${opponent} (${minute})`;
          const assistText = assist ? ` ${assist.replace(/\*\*/g, '')}'nın enfes asistinde` : "";
          body = `⚽ GOOOOOLLLL! DAKİKA ${minute}!\n\nTrabzonspor'umuz ${cleanPlayer}'nın${assistText} attığı muazzam golle skoru ${homeScore} - ${awayScore} yapıyor! Papara Park ayakta!\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nSizce bu maçı kaç kaç kazanırız? Yorumlarda buluşalım! 👇\n\n#Trabzonspor #BordoMavi ${playerHashtag} #Fırtına #Gol`;
        } else {
          title = `⚽ Rakip Golü | Trabzonspor ${homeScore} - ${awayScore} ${opponent} (${minute})`;
          body = `⚽ Gol (${minute}) - ${opponent} takımı ${cleanPlayer} ile golü buldu.\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nHaydi Fırtına! Şimdi toparlanma ve baskı zamanı!\n\n#Trabzonspor #BordoMavi #Fırtına`;
        }
        break;
      }

      case "YELLOW_CARD": {
        template = "MATCH_DAY";
        const isOpponent = team && team !== "Trabzonspor";
        const teamLabel = isOpponent ? opponent : "Trabzonspor";
        title = `🟨 SARI KART! ${cleanPlayer} (${minute}) | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
        body = `🟨 SARI KART! DAKİKA ${minute}!\n\nHakem ${teamLabel} takımından ${cleanPlayer}'a sarı kart gösterdi.\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\n#Trabzonspor #BordoMavi #SarıKart #SüperLig`;
        break;
      }

      case "RED_CARD": {
        template = "RED_CARD";
        const isOpponent = team && team !== "Trabzonspor";
        const teamLabel = isOpponent ? opponent : "Trabzonspor";
        title = `🟥 KIRMIZI KART! ${cleanPlayer} (${minute}) | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
        body = `🟥 KIRMIZI KART! DAKİKA ${minute}!\n\nMücadelede tansiyon zirveye çıktı! ${teamLabel} takımında ${cleanPlayer} kırmızı kart görerek oyun dışında kaldı!\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nBu kart maçı nasıl etkiler? Görüşlerinizi yorumda belirtin! 👇\n\n#Trabzonspor #BordoMavi #KırmızıKart #SüperLig`;
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

    // Markdown yıldız işaretlerini (**) kesin olarak temizle
    title = title.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    body = body.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();

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