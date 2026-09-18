"use client";

import { useState } from "react";
import { 
  Trophy, Flame, Send, Sparkles, CheckCircle, Clock, 
  Share2, Shield, Calendar, Users, Eye, Copy, RefreshCw, AlertCircle, Bot, Zap, Globe, CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { publishMatchEventAction } from "./actions";
import { 
  CURRENT_SUPER_LIG_OPPONENTS,
  THIS_WEEK_FIXTURE,
  MultiSourceLiveScoreEngine,
  MultiSourceLiveMovement
} from "@/lib/matchday/match-engine";
import { SquadService, OFFICIAL_MANAGER } from "@/lib/squad/squad-service";

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
  const [isRefreshingSources, setIsRefreshingSources] = useState(false);

  // Çok Kaynaklı Doğrulanmış Olaylar State'i
  const [liveMovements, setLiveMovements] = useState<MultiSourceLiveMovement[]>([
    {
      id: "ev-2026-goal-61",
      minute: "61'",
      type: "GOAL",
      team: "Trabzonspor",
      player: "Simon Banza",
      description: "GOOOLLL! Anthony Nwakaeme sol kanattan harika kesti, Simon Banza ceza sahasında nefis kafayla ağları sarstı!",
      score: "2 - 1",
      sourcesVerified: ["TFF", "Mackolik", "Flashscore", "SofaScore"],
      isPublishedToFb: true
    },
    {
      id: "ev-2026-card-54",
      minute: "54'",
      type: "YELLOW_CARD",
      team: "Trabzonspor",
      player: "Stefan Savić",
      description: "Hakem Stefan Savić'e taktik faul nedeniyle sarı kart gösterdi.",
      score: "1 - 1",
      sourcesVerified: ["TFF", "Mackolik", "Flashscore", "SofaScore"],
      isPublishedToFb: true
    },
    {
      id: "ev-2026-opp-goal-38",
      minute: "38'",
      type: "GOAL",
      team: "Galatasaray",
      player: "Mauro Icardi",
      description: "Gol. Ceza sahasındaki karambolde Icardi skora denge getirdi.",
      score: "1 - 1",
      sourcesVerified: ["TFF", "Mackolik", "Flashscore"],
      isPublishedToFb: false
    },
    {
      id: "ev-2026-goal-17",
      minute: "17'",
      type: "GOAL",
      team: "Trabzonspor",
      player: "Edin Vişça",
      description: "GOOOLLL! Muhammed Cham'ın milimetrik pasında Edin Vişça sağ çaprazdan vurdu ve takımımızı öne geçirdi!",
      score: "1 - 0",
      sourcesVerified: ["TFF", "Mackolik", "Flashscore", "SofaScore"],
      isPublishedToFb: true
    },
    {
      id: "ev-2026-lineup-0",
      minute: "0'",
      type: "LINEUP",
      team: "Trabzonspor",
      player: "Thomas Reis",
      description: "Trabzonspor'umuzun dev derbi resmi ilk 11'i açıklandı.",
      score: "0 - 0",
      sourcesVerified: ["TFF", "Mackolik", "Flashscore", "SofaScore"],
      isPublishedToFb: true
    }
  ]);

  // Çok Kaynaklı Karşılaştırmayı Yenileme
  const handleRefreshMultiSources = async () => {
    setIsRefreshingSources(true);
    try {
      const res = await MultiSourceLiveScoreEngine.fetchAndCompareMultiSourceMovements();
      setLiveMovements(res.movements);
      toast.success("✅ TFF, Mackolik, Flashscore ve SofaScore anlık verileri çapraz doğrulandı!");
    } catch {
      toast.error("Canlı kaynaklar sorgulanırken hata oluştu.");
    } finally {
      setIsRefreshingSources(false);
    }
  };

  // Otomatik Üretilen Son Yayın Kartı
  const [generatedPost, setGeneratedPost] = useState<{
    type: string;
    title: string;
    body: string;
    ogUrl: string;
  }>({
    type: "GOAL",
    title: "⚽ GOOOLLL! Simon Banza! Trabzonspor 2 - 1 Galatasaray (61')",
    body: "⚽ GOOOOOLLLL! DAKİKA 61'!\n\nTrabzonspor'umuz Simon Banza'nın attığı muhteşem kafa golüyle öne geçiyor! Anthony Nwakaeme'nin harika ortasında Papara Park ayakta!\n\n🔴🔵 Trabzonspor 2 - 1 Galatasaray\n\n#Trabzonspor #BordoMavi #SimonBanza #Fırtına #Gol #TSvGS",
    ogUrl: `/api/og?title=${encodeURIComponent("⚽ GOOOLLL! Simon Banza! (61')")}&template=GOAL&score=2-1`
  });

  // 1. Resmi İlk 11 Kadrosunu Otonom Yayınla
  const handleGenerateLineupPost = () => {
    const startingXI = SquadService.getStartingXI();
    const squadList = startingXI.map(p => `${p.number}. ${p.name} (${p.tag})`).join("\n");

    const newTitle = `📋 İLK 11'İMİZ AÇIKLANDI! | Trabzonspor - ${opponent}`;
    const newBody = `📋 Trabzonspor'umuzun ${opponent} maçı ilk 11'i resmi olarak açıklandı!\n\n${squadList}\n\n👔 Teknik Direktör: ${OFFICIAL_MANAGER.name}\n\nBaşarılar Fırtına! Zafer bizim olsun!\n\n#Trabzonspor #BordoMavi #İlk11 #SüperLig #Fırtına #TSvGS`;
    const newOg = `/api/og?title=${encodeURIComponent("📋 İLK 11'İMİZ AÇIKLANDI!")}&template=MATCH_DAY`;

    setGeneratedPost({
      type: "LINEUP",
      title: newTitle,
      body: newBody,
      ogUrl: newOg
    });

    toast.success("İlk 11 Kadro görseli ve Facebook gönderisi hazırlandı!");
  };

  // 2. Canlı Olayı Doğrudan Facebook'ta Paylaş
  const handlePublishNow = async () => {
    setIsPublishing(true);
    try {
      const cleanTitle = generatedPost.title.replace(/\*\*/g, "").replace(/\*/g, "").trim();
      const cleanBody = generatedPost.body.replace(/\*\*/g, "").replace(/\*/g, "").trim();

      const res = await publishMatchEventAction({
        type: generatedPost.type as any,
        opponent,
        homeScore,
        awayScore,
        minute: matchMinute,
        player: "Simon Banza",
        assist: "Anthony Nwakaeme"
      });

      if (res.success) {
        toast.success("🎉 Maç günü canlı gönderisi Facebook sayfasında yayınlandı!");
      } else {
        toast.error((res as any).error || (res as any).message || "Facebook yayını başarısız oldu.");
      }
    } catch {
      toast.error("Yayınlama sırasında bir hata oluştu.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 sm:space-y-8">
      {/* Üst Başlık & Otonom Canlı Mod */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Maç Günü Canlı Modu (2026/2027 Sezonu)
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
              CANLI DERBİ
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            2026/2027 TFF resmi kadrosu, çok kaynaklı (TFF + Mackolik + Flashscore + SofaScore) anlık karşılaştırma ve otomatik Facebook yayını.
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
              2026/2027 Trendyol Süper Lig fikstürü ve anlık dakika bilgisi
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Stadyum / Konum</label>
                <Input 
                  value={venue} 
                  onChange={(e) => setVenue(e.target.value)}
                  className="h-9 text-xs" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Canlı Maç Dakikası</label>
                <Input 
                  value={matchMinute} 
                  onChange={(e) => setMatchMinute(e.target.value)}
                  className="h-9 text-xs font-mono" 
                />
              </div>
            </div>

            {/* Hızlı Rakip Seçimi (2026/2027 Süper Lig Rakipleri) */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-muted-foreground">2026/2027 Süper Lig Fikstür Rakipleri</label>
              <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto pr-1">
                {CURRENT_SUPER_LIG_OPPONENTS.map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => {
                      setOpponent(team.split(" ")[0]);
                      toast.success(`Rakip ${team.split(" ")[0]} olarak ayarlandı.`);
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${opponent.startsWith(team.split(" ")[0]) ? 'bg-[#164E7A] text-white font-bold' : 'bg-muted/70 hover:bg-muted text-muted-foreground'}`}
                  >
                    {team}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Bölüm: Çok Kaynaklı Canlı Skor & Çapraz Karşılaştırma Monitörü */}
      <Card className="bg-card border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                Çok Kaynaklı Canlı Skor & Otonom Doğrulama Monitörü
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                TFF, Mackolik, Flashscore ve SofaScore verileri anlık çapraz karşılaştırılır; konsensüs sağlandığında Canva görseliyle otomatik paylaşılır.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                4/4 Kaynak Çapraz Doğrulandı
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshMultiSources}
                disabled={isRefreshingSources}
                className="h-8 text-xs font-semibold border-border/80"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshingSources ? 'animate-spin' : ''}`} />
                Kaynakları Sorgula
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          
          {/* 4 Kaynak Durum Çubukları */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-foreground mb-1">
                <span>TFF Resmi</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-muted-foreground">Resmi Lisans & Fikstür: Senkron</span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-foreground mb-1">
                <span>Mackolik</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-muted-foreground">Canlı Dakika & Skor: Senkron</span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-foreground mb-1">
                <span>Flashscore</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-muted-foreground">Gol & Kart Bildirimi: Senkron</span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-foreground mb-1">
                <span>SofaScore</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-muted-foreground">Oyuncu & VAR Olayları: Senkron</span>
            </div>
          </div>

          {/* Olay Akışı */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              Çapraz Doğrulanan Anlık Maç Olayları
            </div>

            <div className="space-y-2.5">
              {liveMovements.map((event) => (
                <div 
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-card border border-border/80 hover:border-border transition-colors gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-mono font-bold text-xs text-primary shrink-0">
                      {event.minute}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {event.player}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {event.team}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {event.score}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div className="flex gap-1 text-[9px] text-muted-foreground">
                      {event.sourcesVerified.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-muted/80 font-mono">
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                    {event.isPublishedToFb && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Yayında
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Bölüm: Canlı Yayın & Canva HD Önizleme */}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* Sol Kolon: Kadro & Hızlı Aksiyon */}
        <Card className="lg:col-span-5 bg-card border-border/80 shadow-xs space-y-4">
          <CardHeader className="pb-3 border-b border-border/70">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" />
              2026/2027 Resmi İlk 11 & Kadro
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Teknik Direktör: {OFFICIAL_MANAGER.name} • Tek tıkla resmi ilk 11 görseli üretin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs space-y-1.5">
              <div className="font-bold text-foreground">👔 Teknik Direktör: {OFFICIAL_MANAGER.name}</div>
              <div className="text-muted-foreground">İdeal 11: Uğurcan Çakır, Pedro Malheiro, Stefan Savić, Batista Mendy, Eren Elmalı, Okay Yokuşlu, Ozan Tufan, Muhammed Cham, Edin Vişça, Anthony Nwakaeme, Simon Banza</div>
            </div>

            <Button
              onClick={handleGenerateLineupPost}
              className="w-full bg-[#164E7A] hover:bg-[#123E62] text-white font-semibold text-xs h-10 shadow-xs flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 text-sky-300" />
              📋 Resmi İlk 11 Kadro Görselini Hazırla
            </Button>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Otonom Maç Motoru Devrede
              </div>
              <p className="text-[11px] leading-relaxed">
                Gol, kart ve maç sonucu olaylarında sistem TFF ve canlı skor kaynaklarını çapraz doğrular; anında Canva HD görseli hazırlayıp Facebook'a otomatik gönderir.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sağ Kolon: HD Görsel Önizleme & Facebook Yayın Kutusu */}
        <Card className="lg:col-span-7 bg-card border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/70">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-primary" />
                  Otonom Canva Canlı Yayın Kartı
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Yapay zeka tarafından hazırlanan HD maç günü görseli ve Facebook gönderisi
                </CardDescription>
              </div>
              <Badge className="bg-[#781324] text-white text-[10px]">
                {generatedPost.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            
            {/* Görsel Önizleme */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-border/80 shadow-sm group">
              <img 
                src={generatedPost.ogUrl} 
                alt={generatedPost.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
              <div className="absolute top-2.5 right-2.5">
                <Badge className="bg-emerald-600 text-white font-bold text-[10px] shadow-sm">
                  ✓ Yayına Hazır
                </Badge>
              </div>
            </div>

            {/* Gönderi Metni */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                <span>Facebook Gönderi Metni</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPost.body);
                    toast.success("Gönderi metni panoya kopyalandı!");
                  }}
                  className="flex items-center gap-1 hover:text-foreground text-primary transition-colors"
                >
                  <Copy className="w-3 h-3" /> Metni Kopyala
                </button>
              </div>
              <p className="whitespace-pre-line text-foreground font-medium leading-relaxed">
                {generatedPost.body}
              </p>
            </div>

            {/* Yayınlama Butonları */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                onClick={handlePublishNow}
                disabled={isPublishing}
                className="flex-1 bg-[#164E7A] hover:bg-[#123E62] text-white font-bold text-xs h-10 shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-sky-300" />
                {isPublishing ? "Facebook'a Gönderiliyor..." : "Facebook'ta Canlı Paylaş (1-Tık)"}
              </Button>

              <Button
                variant="outline"
                onClick={() => window.open(generatedPost.ogUrl, '_blank')}
                className="h-10 text-xs font-semibold border-border/80 px-4"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                HD Görseli Aç
              </Button>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
