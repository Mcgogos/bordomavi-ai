"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, Play, Pause, RotateCcw, Film, 
  Volume2, VolumeX, Check, Copy, Send, Loader2,
  Image as ImageIcon, Wand2, Globe, Layers, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { publishReelAction, generateAiReelScriptAction } from "@/app/(dashboard)/media/actions";
import { generateDynamicReelScript, ReelScene, SuggestedVisual } from "@/lib/reels/reels-engine";
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from "@/lib/canva/brand-logo-data";
import { toast } from "sonner";

interface ReelStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  imageUrl?: string;
  summary?: string;
  body?: string;
  availableNews?: any[];
}

export function ReelStudioModal({ 
  isOpen, 
  onClose, 
  title: initialTitle, 
  imageUrl: initialImageUrl, 
  summary: initialSummary,
  body: initialBody,
  availableNews = []
}: ReelStudioModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [imageUrl, setImageUrl] = useState(initialImageUrl || "");
  const [summary, setSummary] = useState(initialSummary || "");
  const [body, setBody] = useState(initialBody || "");
  
  // Dynamic scenes and visuals
  const [scenes, setScenes] = useState<ReelScene[]>([]);
  const [visuals, setVisuals] = useState<SuggestedVisual[]>([]);
  const [selectedVisualUrl, setSelectedVisualUrl] = useState<string>("");
  const [customWebImageUrl, setCustomWebImageUrl] = useState<string>("");
  
  // Kesintisiz, tek parça akıcı seslendirme metni
  const [narrationText, setNarrationText] = useState<string>("");

  // Slayt gösterisi modu (Varsayılan olarak açık: 5-6 görsel arka planda akıcı döner)
  const [isSlideshowMode, setIsSlideshowMode] = useState<boolean>(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 20 seconds
  const [isMuted, setIsMuted] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.1);
  const [copied, setCopied] = useState(false);
  const [isPublishingReel, setIsPublishingReel] = useState(false);
  const [isAiRegenerating, setIsAiRegenerating] = useState(false);

  const totalDuration = 20;
  const timerRef = useRef<any>(null);

  // Initialize or re-generate dynamic script when props change
  useEffect(() => {
    if (!isOpen) return;

    setTitle(initialTitle);
    setImageUrl(initialImageUrl || "");
    setSummary(initialSummary || "");
    setBody(initialBody || "");
    setCurrentTime(0);
    setIsPlaying(false);

    const dynamicData = generateDynamicReelScript({
      title: initialTitle,
      summary: initialSummary,
      body: initialBody || initialSummary,
      imageUrl: initialImageUrl
    });

    setScenes(dynamicData.scenes);
    setVisuals(dynamicData.suggestedVisuals);
    setSelectedVisualUrl(dynamicData.suggestedVisuals[0]?.url || initialImageUrl || "");
    setNarrationText(dynamicData.fullNarration);
  }, [initialTitle, initialImageUrl, initialSummary, initialBody, isOpen]);

  // Kesintisiz & Akıcı Türkçe Seslendirme Motoru (SpeechSynthesis)
  // Haberin tamamı tek seferde kesintisiz seslendirilir; sahne geçişlerinde asla yarıda kesilmez.
  const startFullNarrationSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || isMuted) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(narrationText);
      utterance.lang = "tr-TR";
      utterance.rate = speechSpeed;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find(v => v.lang.includes("tr") || v.lang.includes("TR"));
      if (trVoice) utterance.voice = trVoice;

      utterance.onend = () => {
        // Seslendirme bittiğinde oynatmayı nazikçe tamamla
        setIsPlaying(false);
        setCurrentTime(0);
      };

      utterance.onerror = (e) => {
        console.warn("[ReelStudio] Speech synthesis error:", e);
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("[ReelStudio] Speech synthesis trigger error:", e);
    }
  };

  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopSpeech();
    } else {
      setIsPlaying(true);
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
      }
      startFullNarrationSpeech();
    }
  };

  // Oynatma süresini takip eden zamanlayıcı
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            stopSpeech();
            return 0;
          }
          return +(prev + 0.1).toFixed(1);
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Modal kapandığında veya unmount olduğunda sesi durdur
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      stopSpeech();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  if (!isOpen) return null;

  // Aktif Sahneyi Belirle (20 saniyelik senkron zaman çizelgesi)
  // 0-4s: Kanca, 4-9s: Manşet, 9-15s: Detay, 15-20s: Çağrı
  let currentSceneIdx = 1;
  let activeScene = scenes[0] || {
    name: "1. Giriş & Kanca",
    badge: "Flaş Başlangıç",
    caption: "🔥 Trabzonspor'da Sıcak Gelişme!",
    speechText: "Trabzonspor'da sıcak saatler yaşanıyor!",
    color: "text-amber-400"
  };

  if (currentTime >= 4 && currentTime < 9) {
    currentSceneIdx = 2;
    activeScene = scenes[1] || activeScene;
  } else if (currentTime >= 9 && currentTime < 15) {
    currentSceneIdx = 3;
    activeScene = scenes[2] || activeScene;
  } else if (currentTime >= 15) {
    currentSceneIdx = 4;
    activeScene = scenes[3] || activeScene;
  }

  // Slayt Gösterisi Hesaplaması (5-6 görsel süresince orantılı akış)
  const activeSlideIndex = visuals.length > 0
    ? Math.min(visuals.length - 1, Math.floor((currentTime / totalDuration) * visuals.length))
    : 0;

  const currentDisplayVisual = isSlideshowMode
    ? (visuals[activeSlideIndex]?.url || selectedVisualUrl)
    : selectedVisualUrl;

  const progressPercent = (currentTime / totalDuration) * 100;
  const wordCount = narrationText.trim() ? narrationText.trim().split(/\s+/).length : 0;

  // AI ile Yeniden Özetleme & Senaryo Yazma
  const handleAiRegenerate = async () => {
    setIsAiRegenerating(true);
    stopSpeech();
    setIsPlaying(false);
    try {
      const res = await generateAiReelScriptAction({
        title,
        body: body || summary
      });
      if (res.success && res.scriptText) {
        toast.success("✨ Yapay zeka haberi tam Reels süresine uygun akıcı tek parça seslendirmeye dönüştürdü!");
        setNarrationText(res.scriptText);
        
        // Yeni senaryoya göre sahneleri güncelle
        const regenerated = generateDynamicReelScript({
          title,
          summary: res.scriptText.substring(0, 150),
          body: res.scriptText,
          imageUrl: selectedVisualUrl
        });
        setScenes(regenerated.scenes);
        setCurrentTime(0);
      } else {
        toast.error(res.error || "AI senaryo üretilemedi.");
      }
    } catch (e: any) {
      toast.error("AI senaryo üretimi sırasında hata oluştu.");
    } finally {
      setIsAiRegenerating(false);
    }
  };

  // Facebook Reels Olarak Tek Tıkla Paylaş
  const handlePublishReel = async () => {
    setIsPublishingReel(true);
    try {
      const res = await publishReelAction({
        title,
        summary: summary || "Trabzonspor sıcak gelişmeleri.",
        scriptText: narrationText,
        imageUrl: selectedVisualUrl || imageUrl
      });
      if (res.success) {
        toast.success(`🎉 Reels Facebook'ta başarıyla yayınlandı! (ID: ${res.postId})`);
      } else {
        toast.error(res.error || "Reels yayınlanamadı.");
      }
    } catch (e: any) {
      toast.error("Reels yayınlama sırasında bir hata oluştu.");
    } finally {
      setIsPublishingReel(false);
    }
  };

  // Aktif haberlerden seçim yapma
  const handleSelectNews = (news: any) => {
    stopSpeech();
    setIsPlaying(false);
    setCurrentTime(0);

    setTitle(news.title);
    setImageUrl(news.imageUrl || "");
    setSummary(news.summary || news.content || "");
    setBody(news.content || news.summary || "");

    const dynamicData = generateDynamicReelScript({
      title: news.title,
      summary: news.summary || news.content,
      body: news.content || news.summary,
      imageUrl: news.imageUrl
    });

    setScenes(dynamicData.scenes);
    setVisuals(dynamicData.suggestedVisuals);
    setSelectedVisualUrl(dynamicData.suggestedVisuals[0]?.url || news.imageUrl || "");
    setNarrationText(dynamicData.fullNarration);
    toast.success(`"${news.title.substring(0, 30)}..." haberi Reels senaryosuna uyarlandı!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-card border border-border/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row gap-5 sm:gap-6 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto">
        
        {/* SOL: 9:16 Dikey Mobil Video Mockup Ekranı */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-[240px] sm:w-[280px] h-[420px] sm:h-[490px] max-h-[55vh] md:max-h-none rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 flex flex-col justify-between select-none">
            
            {/* Arka Plan Görselleri — Akıcı Slayt Geçiş Efekti (Ken Burns Zoom + Crossfade) */}
            <div className="absolute inset-0 overflow-hidden bg-slate-950">
              {visuals && visuals.length > 0 ? (
                visuals.map((v, idx) => {
                  const isCurrent = isSlideshowMode
                    ? idx === activeSlideIndex
                    : v.url === selectedVisualUrl;
                  return (
                    <div
                      key={v.id || idx}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                        isCurrent ? "opacity-100 z-0" : "opacity-0 pointer-events-none -z-10"
                      }`}
                    >
                      <img
                        src={v.url}
                        alt={v.label}
                        className={`w-full h-full object-cover transition-transform duration-[4000ms] ease-out ${
                          isCurrent && isPlaying ? "scale-110" : "scale-100"
                        }`}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="w-full h-full relative bg-gradient-to-b from-[#781324] via-[#0F172A] to-[#164E7A] flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-2 border-amber-400/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-2xl font-black text-amber-400 shadow-2xl">
                    TS
                  </div>
                </div>
              )}
              {/* Karartma Filtresi: Tipografi ve Logoların Her Zaman Net Okunması İçin */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-slate-950/75 pointer-events-none" />
            </div>

            {/* Sabit BordoMavi Filigran Logosu (Sağ Alt - Daimi Görünür) */}
            <div className="absolute bottom-3 right-3 z-20 pointer-events-none opacity-85">
              <img 
                src={BORDOMAVI_BRAND_LOGO_DATA_URI} 
                alt="BordoMavi Watermark" 
                className="w-8 h-8 rounded-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              />
            </div>

            {/* Üst Bar: İlerleme Çubuğu ve Sabit BordoMavi Rozeti */}
            <div className="relative z-10 p-3 sm:p-3.5 space-y-2">
              <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-100 ease-linear rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                {/* SABİT BORDOMAVİ KURUMSAL LOGO */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-lg">
                  <img 
                    src={BORDOMAVI_BRAND_LOGO_DATA_URI} 
                    alt="BordoMavi Logo" 
                    className="w-5 h-5 rounded-full object-contain bg-white/10 p-0.5 border border-amber-400/80 shadow-xs"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white tracking-wider leading-none">BORDOMAVI</span>
                    <span className="text-[7.5px] font-bold text-amber-400 tracking-widest leading-none mt-0.5">REELS</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                      if (!isMuted) stopSpeech();
                      toast.info(!isMuted ? "Ses kapatıldı." : "Doğal Türkçe seslendirme açıldı.");
                    }}
                    className="p-1.5 rounded-full bg-black/50 text-white/90 hover:text-white hover:bg-black/70 transition-colors"
                    title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <div className="text-[10px] font-mono text-white/90 px-2 py-0.5 rounded-md bg-black/50 border border-white/10">
                    {currentTime.toFixed(1)}s / {totalDuration}s
                  </div>
                </div>
              </div>

              {/* Slayt Bilgilendirme Rozeti (Slayt Modu Açıksa) */}
              {isSlideshowMode && visuals.length > 0 && (
                <div className="flex items-center justify-start">
                  <span className="text-[9px] font-semibold text-white/90 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-md border border-white/10 flex items-center gap-1">
                    <Film className="w-3 h-3 text-sky-400" />
                    Slayt {activeSlideIndex + 1}/{visuals.length}: {visuals[activeSlideIndex]?.label.replace(/^\d+\.\s*/, '')}
                  </span>
                </div>
              )}
            </div>

            {/* Orta: Oynat / Durdur Dokunmatik Alan */}
            <div 
              onClick={togglePlay}
              className="relative z-10 flex-1 flex items-center justify-center cursor-pointer"
            >
              {!isPlaying && (
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 hover:scale-105 transition-transform shadow-xl">
                  <Play className="w-6 h-6 ml-1 text-white" />
                </div>
              )}
            </div>

            {/* Alt: Dinamik Altyazı & Senkron Metin */}
            <div className="relative z-10 p-3 sm:p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-black/60 backdrop-blur-md text-[9px] font-semibold tracking-wider text-amber-400 border border-white/10">
                  {activeScene.name}
                </Badge>
                {!isMuted && isPlaying && (
                  <span className="text-[9px] font-bold text-emerald-400 animate-pulse flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-md">
                    <Volume2 className="w-3 h-3" /> Akıcı Seslendiriliyor
                  </span>
                )}
              </div>

              <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/15 shadow-xl min-h-[72px] flex items-center">
                <p className={`text-xs font-bold leading-snug tracking-tight text-center w-full transition-all duration-300 ${activeScene.color}`}>
                  {activeScene.caption}
                </p>
              </div>

              <div className="flex items-center justify-between pt-0.5 text-white/80 text-[10px]">
                <span>❤️ 5.8K</span>
                <span>💬 920</span>
                <span>↗️ Paylaş</span>
              </div>
            </div>

          </div>

          {/* Oynatma Kontrol Çubuğu */}
          <div className="flex items-center gap-2 mt-3.5">
            <Button
              size="sm"
              onClick={togglePlay}
              className="bg-[#781324] hover:bg-[#5e0e1c] text-white font-semibold text-xs h-9 px-4 shadow-sm"
            >
              {isPlaying ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
              {isPlaying ? "Durdur" : `Sesli Oynat (${totalDuration}s)`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(0);
                stopSpeech();
              }}
              className="h-9 w-9 p-0"
              title="Başa Sar"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const nextSpeed = speechSpeed === 1.0 ? 1.15 : speechSpeed === 1.15 ? 1.3 : 1.0;
                setSpeechSpeed(nextSpeed);
                toast.info(`Ses temposu: ${nextSpeed}x`);
              }}
              className="h-9 px-2 text-[11px] font-mono"
              title="Ses Hızı"
            >
              {speechSpeed}x
            </Button>
          </div>
        </div>

        {/* SAĞ: Senaryo Düzenleyici, Slayt Havuzu ve Yayın Kontrolü */}
        <div className="flex-1 flex flex-col justify-between space-y-3.5">
          <div className="space-y-3.5">
            
            {/* Üst Başlık & Aksiyon */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">AI Reels & Shorts Stüdyosu</h3>
                  <p className="text-xs text-muted-foreground">Sabit BordoMavi logo, kesintisiz Türkçe seslendirme ve 5-6 görselli slayt motoru</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAiRegenerate}
                  disabled={isAiRegenerating}
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Wand2 className={`w-3.5 h-3.5 mr-1 ${isAiRegenerating ? 'animate-spin' : ''}`} />
                  {isAiRegenerating ? "Özetleniyor..." : "AI ile Yeniden Özetle"}
                </Button>
                <button 
                  onClick={() => {
                    stopSpeech();
                    onClose();
                  }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 1. KESİNTİSİZ & AKICI TÜRKÇE SESLENDİRME METNİ */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-primary" /> Birebir Seslendirme Metni (Reels Süresine Uyarlanmış Tam Özet):
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {wordCount} kelime • ~{Math.round(wordCount / 2.6)} sn
                  </span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 text-emerald-600 border-emerald-500/30">
                    Tek Parça Akıcı
                  </Badge>
                </div>
              </div>

              <textarea
                value={narrationText}
                onChange={(e) => setNarrationText(e.target.value)}
                rows={3}
                placeholder="Seslendirme senaryosunu buradan düzenleyebilirsiniz..."
                className="w-full text-xs p-2.5 rounded-lg border border-border/70 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none font-medium"
              />
              <p className="text-[10px] text-muted-foreground">
                ℹ️ Haber ne kadar uzun olursa olsun, sistem bilgileri eksiksiz şekilde ~20 saniyede spiker akıcılığında seslendirir. Sahne geçişlerinde kesilme olmaz.
              </p>
            </div>

            {/* 2. 5-6 GÖRSELLİ DİNAMİK SLAYT HAVUZU VE MOD SEÇİMİ */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" /> Reels Arka Plan Slayt Havuzu (İçeriğe Özel 6 Görsel):
                </label>
                
                {/* Slayt Modu Açma / Sabitleme Butonu */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSlideshowMode(!isSlideshowMode);
                    toast.info(!isSlideshowMode ? "🎬 Otomatik slayt gösterisi açıldı (6 görsel döner)." : "📌 Tek görsel sabitleme moduna geçildi.");
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                    isSlideshowMode 
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-muted border-border text-muted-foreground'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  {isSlideshowMode ? "🎬 Slayt Gösterisi Açık" : "📌 Tek Görsel Sabit"}
                </button>
              </div>

              {/* Slayt Kartları Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {visuals.map((v, idx) => {
                  const isCurrentActive = isSlideshowMode && isPlaying && idx === activeSlideIndex;
                  const isSelected = selectedVisualUrl === v.url;

                  return (
                    <button
                      key={v.id || idx}
                      type="button"
                      onClick={() => {
                        setSelectedVisualUrl(v.url);
                        if (isSlideshowMode) {
                          // Tek görsele odaklanmak istenirse bilgilendir
                          toast.info(`"${v.label}" seçildi. Sabit mod için sağ üstten 'Tek Görsel Sabit' yapabilirsiniz.`);
                        }
                      }}
                      className={`p-2 rounded-lg text-left border text-[11px] transition-all flex flex-col justify-between h-[62px] relative overflow-hidden ${
                        isCurrentActive 
                          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 font-bold shadow-sm'
                          : isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border/70 bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate font-semibold text-[11px] block">{v.label}</span>
                        {isCurrentActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground truncate">{v.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* Özel Web Görseli / URL Girişi */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="İnternetten Görsel URL'si ekleyin (https://...)"
                    value={customWebImageUrl}
                    onChange={(e) => setCustomWebImageUrl(e.target.value)}
                    className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-border/70 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (customWebImageUrl.trim()) {
                      const newUrl = customWebImageUrl.trim();
                      setSelectedVisualUrl(newUrl);
                      // Slayt havuzuna da ekle
                      setVisuals(prev => [
                        {
                          id: `custom-${Date.now()}`,
                          type: 'NEWS',
                          label: 'Özel İnternet Görseli',
                          url: newUrl,
                          description: 'Kullanıcının eklediği görsel.'
                        },
                        ...prev
                      ]);
                      setCustomWebImageUrl("");
                      toast.success("Özel görsel slayt havuzuna eklendi ve seçildi!");
                    }
                  }}
                  className="h-8 text-xs shrink-0"
                >
                  Ekle
                </Button>
              </div>
            </div>

            {/* 3. AKTİF HABERLERDEN HIZLI DÖNÜŞTÜRÜCÜ */}
            {availableNews && availableNews.length > 0 && (
              <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Eye className="w-3 h-3 text-primary" /> Diğer Haberlerden Hızlıca Reels'e Dönüştür:
                </label>
                <div className="flex flex-wrap gap-1 max-h-[48px] overflow-y-auto pr-1">
                  {availableNews.slice(0, 6).map((n: any) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleSelectNews(n)}
                      className="text-[10px] px-2 py-0.5 rounded bg-card hover:bg-primary/10 border border-border/60 text-foreground truncate max-w-[170px]"
                    >
                      {n.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SAHNE SAHNE DİNAMİK ALTYAZILAR (Görsel Eşzamanlılık) */}
            <div className="space-y-1.5 text-xs max-h-[140px] overflow-y-auto pr-1">
              {scenes.map((s) => (
                <div 
                  key={s.index} 
                  className={`p-2 rounded-lg border transition-all ${
                    currentSceneIdx === s.index && isPlaying 
                      ? 'bg-primary/10 border-primary shadow-xs' 
                      : 'bg-muted/30 border-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-bold text-[11px] ${s.color}`}>
                      {s.name} • {s.timeRange}
                    </span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1">
                      {s.badge}
                    </Badge>
                  </div>
                  <p className="text-foreground/90 font-medium text-[11px] leading-snug">
                    "{s.caption}"
                  </p>
                </div>
              ))}
            </div>

          </div>

          {/* Alt: Yayınlama ve Kopyalama Aksiyonları */}
          <div className="space-y-2 pt-2 border-t border-border/70 shrink-0">
            <Button
              onClick={handlePublishReel}
              disabled={isPublishingReel}
              className="w-full bg-[#164E7A] hover:bg-[#123E62] text-white font-bold text-xs sm:text-sm h-11 shadow-md flex items-center justify-center gap-2 transition-all"
            >
              {isPublishingReel ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
              ) : (
                <Send className="w-4 h-4 text-sky-300" />
              )}
              {isPublishingReel ? "Reels Facebook'a Gönderiliyor..." : "Facebook Reels Olarak Yayınla (1-Tık)"}
            </Button>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  const fullText = `🎬 BORDO MAVİ REELS | ${title}\n\n${narrationText}\n\n#Trabzonspor #BordoMavi #Reels #Shorts #Fırtına`;
                  navigator.clipboard.writeText(fullText);
                  setCopied(true);
                  toast.success("Profesyonel Reels seslendirme senaryosu panoya kopyalandı!");
                  setTimeout(() => setCopied(false), 2000);
                }}
                variant="outline"
                className="flex-1 text-xs font-semibold h-10 border-border/80"
              >
                {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? "Kopyalandı!" : "Seslendirme Senaryosunu Kopyala"}
              </Button>

              <Button
                onClick={() => {
                  stopSpeech();
                  onClose();
                }}
                className="bg-[#781324] hover:bg-[#5e0e1c] text-white text-xs font-semibold h-10 px-6"
              >
                Kapat
              </Button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}