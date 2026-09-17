"use client";

import { useState } from "react";
import { 
  Trophy, Flame, Send, Sparkles, CheckCircle, Clock, 
  Share2, Shield, Calendar, Users, Eye, Copy, RefreshCw, AlertCircle, Bot, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { publishMatchEventAction } from "./actions";
import { 
  CURRENT_TRABZONSPOR_SQUAD, 
  CURRENT_SUPER_LIG_OPPONENTS,
  THIS_WEEK_FIXTURE,
  MackolikLiveScoreClient,
  MackolikLiveMovement
} from "@/lib/matchday/match-engine";

interface MatchdayClientProps {
  initialNews?: any[];
}

export default function MatchdayClient({ initialNews }: MatchdayClientProps) {
  // Match Info State (2026/2027 Sezonu Bu Haftaki Maç: Trabzonspor vs Galatasaray)
  const [opponent, setOpponent] = useState(THIS_WEEK_FIXTURE.awayTeam);
  const [competition, setCompetition] = useState(`${THIS_WEEK_FIXTURE.league} (${THIS_WEEK_FIXTURE.week}. Hafta)`);
  const [venue, setVenue] = useState(`${THIS_WEEK_FIXTURE.stadium} (İç Saha)`);
  const [matchMinute, setMatchMinute] = useState("61'");
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAutonomousActive, setIsAutonomousActive] = useState(true);

  // Goal & Card State (2026/2027 TFF Resmi Kadrosu)
  const [scorer, setScorer] = useState("Paul Onuachu");
  const [assist, setAssist] = useState("Anthony Nwakaeme");
  const [goalMinute, setGoalMinute] = useState("61'");
  const [cardPlayer, setCardPlayer] = useState("Paul Onuachu");
  const [cardTeam, setCardTeam] = useState<"Trabzonspor" | "Rakip">("Rakip");

  // Mackolik Canlı Skor & Hareketler State
  const [liveMovements, setLiveMovements] = useState<MackolikLiveMovement[]>([
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
      description: "GOOOLLL! Ernest Muçi'nin derin pasında Edin Vişça ceza sahası sağ çaprazından sert vurdu!",
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
  ]);

  // Generated Post Preview State
  const [generatedPost, setGeneratedPost] = useState<{
    type: "LINEUP" | "GOAL" | "YELLOW_CARD" | "RED_CARD" | "HALF_TIME" | "FULL_TIME";
    title: string;
    body: string;
    ogUrl: string;
  }>({
    type: "GOAL",
    title: `⚽ GOOOLLL! Paul Onuachu! Trabzonspor 2 - 1 Galatasaray (61')`,
    body: `⚽ GOOOOOLLLL! DAKİKA 61'!\n\nTrabzonspor'umuz Paul Onuachu'nun attığı muhteşem kafa golüyle öne geçiyor! Anthony Nwakaeme'nin harika pasında Papara Park ayakta!\n\n🔴🔵 Trabzonspor 2 - 1 Galatasaray\n\n#Trabzonspor #BordoMavi #PaulOnuachu #Fırtına #Gol #TSvGS`,
    ogUrl: `/api/og?title=${encodeURIComponent("⚽ GOOOLLL! Paul Onuachu! (61')")}&template=GOAL&score=2-1&player=Paul+Onuachu&minute=61'`
  });

  // 1. Generate Official Starting Lineup Post (Maç Başlamadan Önce Açıklanan İlk 11)
  const handleGenerateLineupPost = () => {
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

    const newTitle = `📋 İLK 11'İMİZ AÇIKLANDI! | Trabzonspor - ${opponent}`;
    const newBody = `📋 Trabzonspor'umuzun ${opponent} maçı ilk 11'i resmi olarak açıklandı!\n\n${squadList}\n\n👔 Teknik Direktör: Şenol Güneş\n\nBaşarılar Fırtına! Zafer bizim olsun!\n\n#Trabzonspor #BordoMavi #İlk11 #SüperLig #Fırtına #TSvGS`;
    const newOg = `/api/og?title=${encodeURIComponent(`📋 İLK 11'İMİZ AÇIKLANDI!`)}&template=MATCH_DAY`;

    setGeneratedPost({
      type: "LINEUP",
      title: newTitle,
      body: newBody,
      ogUrl: newOg
    });

    toast.success("İlk 11 Kadro görseli ve Facebook gönderisi hazırlandı!");
  };

  // 2. Generate Goal Post (Gol + Atan + Dakika + Skor)
  const handleGenerateGoalPost = () => {
    const cleanScorer = (scorer || "Paul Onuachu").replace(/\*\*/g, "").replace(/\*/g, "").trim();
    const newTitle = `⚽ GOOOLLL! ${cleanScorer}! Trabzonspor ${homeScore} - ${awayScore} ${opponent} (${goalMinute})`;
    const assistText = assist ? ` ${assist.replace(/\*\*/g, '').replace(/\*/g, '').trim()}'nın harika pasında` : "";
    const playerTag = "#" + cleanScorer.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, "");
    
    const newBody = `⚽ GOOOOOLLLL! DAKİKA ${goalMinute}!\n\nTrabzonspor'umuz ${cleanScorer}'nın${assistText} attığı muazzam golle skoru ${homeScore} - ${awayScore} yapıyor! Papara Park'ta coşku tavan yaptı!\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nSizce maç kaç kaç biter? Skor tahminlerinizi yoruma yazın! 👇\n\n#Trabzonspor #BordoMavi ${playerTag} #Fırtına #Gol`;
    const newOg = `/api/og?title=${encodeURIComponent(`⚽ GOOOLLL! ${cleanScorer}! (${goalMinute})`)}&template=GOAL&score=${homeScore}-${awayScore}&player=${encodeURIComponent(cleanScorer)}&minute=${encodeURIComponent(goalMinute)}`;

    setGeneratedPost({
      type: "GOAL",
      title: newTitle,
      body: newBody,
      ogUrl: newOg
    });

    toast.success("Canlı Gol Kartı ve Facebook gönderisi hazırlandı!");
  };

  // 3. Generate Yellow Card Post (Sarı Kart + Oyuncu + Dakika + Takım)
  const handleGenerateYellowCardPost = () => {
    const cleanPlayer = (cardPlayer || "Oyuncu").replace(/\*\*/g, "").replace(/\*/g, "").trim();
    const teamName = cardTeam === "Trabzonspor" ? "Trabzonspor" : opponent;
    const newTitle = `🟨 SARI KART! ${cleanPlayer} (${goalMinute}) | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
    const newBody = `🟨 SARI KART! DAKİKA ${goalMinute}!\n\nHakem ${teamName} takımından ${cleanPlayer}'a sarı kart gösterdi.\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\n#Trabzonspor #BordoMavi #SarıKart #SüperLig`;
    const newOg = `/api/og?title=${encodeURIComponent(`🟨 SARI KART! ${cleanPlayer} (${goalMinute})`)}&template=MATCH_DAY&score=${homeScore}-${awayScore}&player=${encodeURIComponent(cleanPlayer)}&minute=${encodeURIComponent(goalMinute)}`;

    setGeneratedPost({
      type: "YELLOW_CARD",
      title: newTitle,
      body: newBody,
      ogUrl: newOg
    });

    toast.success("Sarı Kart infografiği ve Facebook gönderisi hazırlandı!");
  };

  // 4. Generate Red Card Post (Kırmızı Kart + Oyuncu + Dakika + Takım)
  const handleGenerateRedCardPost = () => {
    const cleanPlayer = (cardPlayer || "Oyuncu").replace(/\*\*/g, "").replace(/\*/g, "").trim();
    const teamName = cardTeam === "Trabzonspor" ? "Trabzonspor" : opponent;
    const newTitle = `🟥 KIRMIZI KART! ${cleanPlayer} (${goalMinute}) | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
    const newBody = `🟥 KIRMIZI KART! DAKİKA ${goalMinute}!\n\nMücadelede tansiyon zirveye çıktı! ${teamName} takımında ${cleanPlayer} kırmızı kart görerek oyun dışında kaldı!\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nBu karar hakkında ne düşünüyorsunuz? Yorumlarda buluşalım! 👇\n\n#Trabzonspor #BordoMavi #KırmızıKart #SüperLig`;
    const newOg = `/api/og?title=${encodeURIComponent(`🟥 KIRMIZI KART! ${cleanPlayer} (${goalMinute})`)}&template=RED_CARD&score=${homeScore}-${awayScore}&player=${encodeURIComponent(cleanPlayer)}&minute=${encodeURIComponent(goalMinute)}`;

    setGeneratedPost({
      type: "RED_CARD",
      title: newTitle,
      body: newBody,
      ogUrl: newOg
    });

    toast.success("Kırmızı Kart infografiği ve Facebook gönderisi hazırlandı!");
  };

  // 5. Generate Final Post (Maç Sonucu + Skor)
  const handleGenerateFinalPost = () => {
    const isWin = homeScore > awayScore;
    const isDraw = homeScore === awayScore;
    const resultWord = isWin ? "BÜYÜK GALİBİYET! 3 PUAN FIRTINA'NIN!" : isDraw ? "MÜCADELE SONA ERDİ" : "MAÇ SONUCU";
    
    const newTitle = `🏁 MAÇ SONUCU | Trabzonspor ${homeScore} - ${awayScore} ${opponent}`;
    const newBody = `🏁 ${resultWord}!\n\nTrendyol Süper Lig mücadelesinde Trabzonspor'umuz ${opponent} karşısında sahadan ${homeScore} - ${awayScore} skorla ayrılıyor.\n\n🔴🔵 Trabzonspor ${homeScore} - ${awayScore} ${opponent}\n\nMaçın adamı sizce kimdi? Maç hakkındaki tüm görüşlerinizi yorumlarda bekliyoruz! 👇\n\n#Trabzonspor #BordoMavi #MaçSonucu #SüperLig`;
    const newOg = `/api/og?title=${encodeURIComponent(`🏁 MAÇ SONUCU: Trabzonspor ${homeScore} - ${awayScore} ${opponent}`)}&template=FULL_TIME&score=${homeScore}-${awayScore}`;

    setGeneratedPost({
      type: "FULL_TIME",
      title: newTitle,
      body: newBody,
      ogUrl: newOg
    });

    toast.success("Maç Sonu Raporu ve görseli hazırlandı!");
  };

  // Publish Directly to Facebook
  const handlePublishPost = async () => {
    setIsPublishing(true);
    toast.info("Facebook Graph API üzerinden sayfanıza gönderiliyor...");
    
    try {
      const res = await publishMatchEventAction({
        type: generatedPost.type,
        opponent,
        homeScore,
        awayScore,
        minute: goalMinute,
        player: (generatedPost.type === "RED_CARD" || generatedPost.type === "YELLOW_CARD") ? cardPlayer : scorer,
        assist: generatedPost.type === "GOAL" ? assist : undefined,
        team: cardTeam === "Trabzonspor" ? "Trabzonspor" : opponent
      });

      const data = res as any;
      if (data.success) {
        toast.success(`🎉 ${data.message || "Yayınlandı!"} ${data.mockMode ? "(Mock Modu)" : ""}`);
      } else {
        toast.error(data.error || "Yayınlama hatası");
      }
    } catch (e: any) {
      toast.error(e.message || "Bilinmeyen bir hata oluştu");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto p-6 lg:p-8">
      {/* Üst Başlık & Otonom Robot Rozeti */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Maç Günü Canlı Modu (2026/2027 Sezonu)
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
              CANLI DERBİ MODU
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            TFF 2026/2027 resmi Trabzonspor kadrosu ve bu haftaki Galatasaray derbisi canlı akışı ile anında Facebook yayını yapın
          </p>
        </div>

        {/* 7/24 Otonom Canlı Maç Robotu Toggle */}
        <div className="flex items-center gap-3 p-2.5 px-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex items-center gap-2">
            <Bot className={`w-5 h-5 ${isAutonomousActive ? 'text-emerald-500 animate-bounce' : 'text-muted-foreground'}`} />
            <div className="text-left">
              <div className="text-xs font-bold text-foreground">Otonom Canlı Maç Robotu</div>
              <div className="text-[10px] text-muted-foreground">
                {isAutonomousActive ? "7/24 Otomatik Yayın Aktif" : "Manuel Mod"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAutonomousActive(!isAutonomousActive);
              toast.success(!isAutonomousActive ? "Otonom Maç Robotu Aktif Edildi!" : "Manuel moda geçildi.");
            }}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${isAutonomousActive ? 'bg-emerald-600' : 'bg-muted'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isAutonomousActive ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Canlı Skor & Maç Kontrol Masası */}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* Skor Kartı & Canlı Skor Paneli */}
        <Card className="lg:col-span-5 bg-gradient-to-br from-[#781324] via-[#1a1c2e] to-[#164E7A] text-white border-0 shadow-xl overflow-hidden relative">
          <div className="absolute inset-0 bg-radial-gradient from-white/10 to-transparent pointer-events-none" />
          
          <CardHeader className="relative z-10 pb-2">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span className="font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> {competition}
              </span>
              <span className="font-semibold px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
                {venue}
              </span>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 py-6 space-y-6 text-center">
            <div className="flex items-center justify-center gap-6">
              {/* Trabzonspor */}
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/30 backdrop-blur-md flex items-center justify-center text-xl font-black text-amber-400 shadow-lg">
                  TS
                </div>
                <span className="font-bold text-sm tracking-wide">Trabzonspor</span>
              </div>

              {/* Skor Göstergesi */}
              <div className="flex flex-col items-center space-y-1">
                <div className="flex items-center gap-3 font-mono text-5xl font-black tracking-tighter drop-shadow-lg">
                  <span className="text-white">{homeScore}</span>
                  <span className="text-white/40">:</span>
                  <span className="text-white">{awayScore}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Clock className="w-3 h-3 animate-spin" /> {matchMinute}
                </div>
              </div>

              {/* Rakip */}
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/30 backdrop-blur-md flex items-center justify-center text-xl font-black text-white/90 shadow-lg">
                  {opponent.substring(0, 3).toUpperCase()}
                </div>
                <span className="font-bold text-sm tracking-wide line-clamp-1 max-w-[100px]">{opponent}</span>
              </div>
            </div>

            {/* Skor Değiştirme Butonları */}
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  setHomeScore(prev => prev + 1);
                  toast.success("Trabzonspor skoru artırıldı!");
                }}
                className="h-8 text-xs font-bold bg-white text-slate-900 hover:bg-slate-100"
              >
                +1 Gol (Trabzonspor)
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setAwayScore(prev => prev + 1)}
                className="h-8 text-xs font-semibold text-white border-white/30 hover:bg-white/10"
              >
                +1 Gol ({opponent.split(" ")[0]})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Maç Ayarları & Güncel 2026/2027 Süper Lig Fikstürü */}
        <Card className="lg:col-span-7 bg-card border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">Güncel Maç Parametreleri</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              2026/2027 Trendyol Süper Lig rakiplerinden tek tıkla seçin veya canlı dakikayı ayarlayın
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Rakip Takım</label>
                <Input 
                  value={opponent} 
                  onChange={(e) => setOpponent(e.target.value)}
                  className="h-9 text-xs" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Turnuva / Lig</label>
                <Input 
                  value={competition} 
                  onChange={(e) => setCompetition(e.target.value)}
                  className="h-9 text-xs" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Saha / Mekan</label>
                <Input 
                  value={venue} 
                  onChange={(e) => setVenue(e.target.value)}
                  className="h-9 text-xs" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Maç Dakikası</label>
                <Input 
                  value={matchMinute} 
                  onChange={(e) => {
                    setMatchMinute(e.target.value);
                    setGoalMinute(e.target.value);
                  }}
                  className="h-9 text-xs font-mono" 
                  placeholder="Örn: 61'"
                />
              </div>
            </div>

            {/* Güncel Süper Lig Rakipleri Seçici */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                2026/2027 Süper Lig Rakipleri:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-[90px] overflow-y-auto pr-1">
                {CURRENT_SUPER_LIG_OPPONENTS.map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => setOpponent(team)}
                    className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${opponent === team ? 'bg-[#781324] text-white font-bold' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {team}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Bölüm: Maçkolik & TFF Canlı Maç Akışı (Canlı Hareketler) */}
      <Card className="bg-card border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                Maçkolik & TFF Canlı Maç Akışı (Anlık Hareketler)
              </CardTitle>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                CANLI VERİ AKIŞI
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              19 Eylül 2026 Cumartesi 20:00 • Papara Park • Trabzonspor vs Galatasaray (6. Hafta Derbisi)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Kaynak:</span>
            <Badge variant="secondary" className="text-[10px] font-mono">mackolik.com / tff.org</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="space-y-2">
            {liveMovements.map((event) => (
              <div 
                key={event.id}
                className="p-3 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-primary/10 text-primary shrink-0">
                    {event.minute}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">{event.player}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-semibold text-muted-foreground">
                        {event.team}
                      </span>
                      <span className="text-[11px] font-black text-amber-600 font-mono">
                        {event.score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5" /> Canlı Otonom Kaydedildi
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. Bölüm: Canlı Olay Üretici (Gol & Kırmızı Kart & Maç Sonu) */}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* Canlı Olay Formu */}
        <Card className="lg:col-span-5 bg-card border-border/80 shadow-xs space-y-4">
          <CardHeader className="pb-3 border-b border-border/70">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Canlı Olay Masası (Gol & Kırmızı Kart)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              2026/2027 TFF resmi A takım kadrosundaki futbolcuları seçerek tek tıkla canlı anons oluşturun
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Gol Seçimi */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Golü Atan Futbolcu</label>
              <Input 
                value={scorer} 
                onChange={(e) => setScorer(e.target.value)}
                className="h-9 text-xs font-semibold" 
              />
              <div className="flex flex-wrap gap-1 pt-1 max-h-[75px] overflow-y-auto pr-1">
                {CURRENT_TRABZONSPOR_SQUAD.map((player) => (
                  <button
                    key={player.name}
                    type="button"
                    onClick={() => setScorer(player.name)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${scorer === player.name ? 'bg-[#781324] text-white font-bold' : 'bg-muted/70 text-muted-foreground hover:bg-muted'}`}
                  >
                    {player.name} ({player.position})
                  </button>
                ))}
              </div>
            </div>

            {/* Asist & Dakika */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Asist Yapan</label>
                <Input 
                  value={assist} 
                  onChange={(e) => setAssist(e.target.value)}
                  className="h-9 text-xs" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Olay Dakikası</label>
                <Input 
                  value={goalMinute} 
                  onChange={(e) => setGoalMinute(e.target.value)}
                  className="h-9 text-xs font-mono" 
                />
              </div>
            </div>

            {/* Kart Olayı (Sarı / Kırmızı Kart & Oyuncu & Takım Seçimi) */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <span className="text-amber-500">🟨</span> / <span className="text-rose-500">🟥</span> Kart Olayı
                </span>
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCardTeam("Rakip")}
                    className={`px-2 py-0.5 rounded transition-colors ${cardTeam === "Rakip" ? "bg-[#164E7A] text-white font-bold" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    {opponent.split(" ")[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardTeam("Trabzonspor")}
                    className={`px-2 py-0.5 rounded transition-colors ${cardTeam === "Trabzonspor" ? "bg-[#781324] text-white font-bold" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    Trabzonspor
                  </button>
                </div>
              </div>
              <Input
                value={cardPlayer}
                onChange={(e) => setCardPlayer(e.target.value)}
                className="h-8 text-xs"
                placeholder="Kart gören futbolcu..."
              />
            </div>

            {/* Otonom Maç Eylem Masası Butonları */}
            <div className="pt-2 space-y-2">
              <Button 
                onClick={handleGenerateLineupPost}
                className="w-full bg-[#164E7A] hover:bg-[#123E62] text-white font-semibold text-xs h-9 shadow-xs"
              >
                <Users className="w-4 h-4 mr-1.5 text-sky-300" />
                📋 1. İlk 11 Kadrosunu Hazırla & Yayınla
              </Button>

              <Button 
                onClick={handleGenerateGoalPost}
                className="w-full bg-[#781324] hover:bg-[#5e0e1c] text-white font-semibold text-xs h-10 shadow-xs"
              >
                <Flame className="w-4 h-4 mr-1.5 text-amber-400" />
                ⚽ 2. Canlı Gol Anons Kartı Hazırla
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline"
                  onClick={handleGenerateYellowCardPost}
                  className="w-full text-xs font-semibold h-9 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                >
                  🟨 Sarı Kart Anonsu
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleGenerateRedCardPost}
                  className="w-full text-xs font-semibold h-9 border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                >
                  🟥 Kırmızı Kart Anonsu
                </Button>
              </div>

              <Button 
                variant="outline"
                onClick={handleGenerateFinalPost}
                className="w-full text-xs font-semibold h-9 border-border/80 hover:bg-muted"
              >
                🏁 3. Maç Sonu Raporu & Sonuç Kartı
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Canlı Önizleme & Facebook Anında Gönderim Alanı */}
        <Card className="lg:col-span-7 bg-card border-border/80 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/70">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">Üretilen Gönderi & Canlı Görsel</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Yapay zeka tarafından hazırlanan Facebook yayını ve otomatik logolu görsel
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {generatedPost.type}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="py-4 space-y-4 flex-1 flex flex-col justify-between">
            {/* Önizleme Görseli */}
            <div className="rounded-xl overflow-hidden border border-border/80 bg-slate-950 aspect-[1200/630] relative max-h-[260px] flex items-center justify-center">
              <img 
                src={generatedPost.ogUrl} 
                alt="OG Preview" 
                className="w-full h-full object-contain"
              />
            </div>

            {/* Gönderi Metni */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs font-sans whitespace-pre-line leading-relaxed max-h-[140px] overflow-y-auto">
              <div className="font-bold text-primary mb-1">{generatedPost.title}</div>
              {generatedPost.body}
            </div>

            {/* Yayınlama Butonları */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={handlePublishPost}
                disabled={isPublishing}
                className="flex-1 bg-gradient-to-r from-[#781324] to-[#164E7A] text-white hover:opacity-90 font-bold text-xs h-10 shadow-md"
              >
                {isPublishing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isPublishing ? "Facebook'ta Yayınlanıyor..." : "Facebook'ta Anında Yayınla (1-Tık)"}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${generatedPost.title}\n\n${generatedPost.body}`);
                  toast.success("Gönderi metni panoya kopyalandı!");
                }}
                className="text-xs font-semibold h-10 border-border/80"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Metni Kopyala
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}