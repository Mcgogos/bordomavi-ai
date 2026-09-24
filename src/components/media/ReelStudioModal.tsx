"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, Play, Pause, RotateCcw, Sparkles, Film, 
  Volume2, VolumeX, Download, Check, Copy, Share2, Newspaper, Send, Loader2,
  Image as ImageIcon, RefreshCw, Wand2, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { publishReelAction, generateAiReelScriptAction } from "@/app/(dashboard)/media/actions";
import { generateDynamicReelScript, ReelScene, SuggestedVisual } from "@/lib/reels/reels-engine";
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 18 seconds
  const [isMuted, setIsMuted] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.1);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPublishingReel, setIsPublishingReel] = useState(false);
  const [isAiRegenerating, setIsAiRegenerating] = useState(false);

  const lastSpokenSceneRef = useRef<number>(-1);
  const totalDuration = 18;

  // Initialize or re-generate dynamic script when props change
  useEffect(() => {
    if (!isOpen) return;

    setTitle(initialTitle);
    setImageUrl(initialImageUrl || "");
    setSummary(initialSummary || "");
    setBody(initialBody || "");
    setImgError(false);
    setCurrentTime(0);
    setIsPlaying(false);
    lastSpokenSceneRef.current = -1;

    const dynamicData = generateDynamicReelScript({
      title: initialTitle,
      summary: initialSummary,
      body: initialBody || initialSummary,
      imageUrl: initialImageUrl
    });

    setScenes(dynamicData.scenes);
    setVisuals(dynamicData.suggestedVisuals);
    setSelectedVisualUrl(dynamicData.suggestedVisuals[0]?.url || initialImageUrl || "");
  }, [initialTitle, initialImageUrl, initialSummary, initialBody, isOpen]);

  // Audio / Speech Synthesis Engine (Türkçe Doğal Seslendirme)
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || isMuted) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.rate = speechSpeed; // Dinamik hızlı tempo (Reels ritmi)
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find(v => v.lang.includes("tr") || v.lang.includes("TR"));
      if (trVoice) utterance.voice = trVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  // Stop speech when paused or modal closed
  useEffect(() => {
    if (!isPlaying && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      lastSpokenSceneRef.current = -1;
    }
  }, [isPlaying, isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Timer & Scene Flow
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
            return 0;
          }
          return +(prev + 0.1).toFixed(1);
        });
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!isOpen) return null;

  // Determine current active scene
  // 0-3s: Scene 1 (Hook), 3-8s: Scene 2 (Headline), 8-14s: Scene 3 (Detail), 14-18s: Scene 4 (CTA)
  let currentSceneIdx = 1;
  let activeScene = scenes[0] || {
    name: "1. Kanca (Hook)",
    badge: "Flaş Başlangıç",
    caption: "🔥 Trabzonspor'da Sıcak Gelişme!",
    speechText: "Trabzonspor'da sıcak saatler yaşanıyor!",
    color: "text-amber-400"
  };

  if (currentTime >= 3 && currentTime < 8) {
    currentSceneIdx = 2;
    activeScene = scenes[1] || activeScene;
  } else if (currentTime >= 8 && currentTime < 14) {
    currentSceneIdx = 3;
    activeScene = scenes[2] || activeScene;
  } else if (currentTime >= 14) {
    currentSceneIdx = 4;
    activeScene = scenes[3] || activeScene;
  }

  // Trigger speech when entering a new scene
  if (isPlaying && !isMuted && lastSpokenSceneRef.current !== currentSceneIdx) {
    lastSpokenSceneRef.current = currentSceneIdx;
    if (activeScene?.speechText) {
      speakText(activeScene.speechText);
    }
  }

  const progressPercent = (currentTime / totalDuration) * 100;

  // AI ile Yeniden Özetleme & Senaryo Yazma
  const handleAiRegenerate = async () => {
    setIsAiRegenerating(true);
    try {
      const res = await generateAiReelScriptAction({
        title,
        body: body || summary
      });
      if (res.success && res.scriptText) {
        toast.success("✨ Yapay zeka yeni ve daha vurucu bir seslendirme senaryosu hazırladı!");
        // Re-generate scenes
        const regenerated = generateDynamicReelScript({
          title,
          summary: res.scriptText.substring(0, 150),
          body: res.scriptText,
          imageUrl: selectedVisualUrl
        });
        setScenes(regenerated.scenes);
        setCurrentTime(0);
        setIsPlaying(false);
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
      const scriptText = scenes.map(s => `🎬 SAHNE ${s.index} (${s.timeRange}): "${s.speechText}"`).join("\n\n");
      const res = await publishReelAction({
        title,
        summary: summary || "Trabzonspor sıcak gelişmeleri.",
        scriptText,
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
    setTitle(news.title);
    setImageUrl(news.imageUrl || "");
    setSummary(news.summary || news.content || "");
    setBody(news.content || news.summary || "");
    setImgError(false);
    setCurrentTime(0);
    setIsPlaying(false);
    lastSpokenSceneRef.current = -1;

    const dynamicData = generateDynamicReelScript({
      title: news.title,
      summary: news.summary || news.content,
      body: news.content || news.summary,
      imageUrl: news.imageUrl
    });

    setScenes(dynamicData.scenes);
    setVisuals(dynamicData.suggestedVisuals);
    setSelectedVisualUrl(dynamicData.suggestedVisuals[0]?.url || news.imageUrl || "");
    toast.success(`"${news.title.substring(0, 30)}..." haberi Reels senaryosuna uyarlandı!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-card border border-border/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row gap-5 sm:gap-6 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto">
        
        {/* SOL: 9:16 Dikey Mobil Video Mockup Ekranı */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-[240px] sm:w-[280px] h-[400px] sm:h-[490px] max-h-[55vh] md:max-h-none rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 flex flex-col justify-between select-none">
            
            {/* Arka Plan Görseli */}
            <div className="absolute inset-0 overflow-hidden">
              {selectedVisualUrl && !imgError ? (
                <img 
                  src={selectedVisualUrl} 
                  alt="Reel Background" 
                  onError={() => setImgError(true)}
                  className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                />
              ) : (
                <div className="w-full h-full relative bg-gradient-to-b from-[#781324] via-[#0F172A] to-[#164E7A] flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-2 border-amber-400/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-2xl font-black text-amber-400 shadow-2xl">
                    TS
                  </div>
                </div>
              )}
              {/* Karartma Filtresi */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/70" />
            </div>

            {/* Üst Bar: İlerleme Çubuğu ve Logo */}
            <div className="relative z-10 p-3.5 space-y-2">
              <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-100 ease-linear rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-[#781324] flex items-center justify-center text-[9px] font-bold text-white">
                    BM
                  </div>
                  <span className="text-[10px] font-bold text-white tracking-wide">BordoMavi Reels</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                      if (!isMuted && typeof window !== "undefined" && "speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                      }
                      toast.info(!isMuted ? "Ses kapatıldı." : "Türkçe sesli anlatım açıldı.");
                    }}
                    className="p-1 rounded-full bg-black/40 text-white/80 hover:text-white"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <div className="text-[10px] font-mono text-white/90 px-2 py-0.5 rounded-md bg-black/40">
                    {currentTime.toFixed(1)}s / {totalDuration}s
                  </div>
                </div>
              </div>
            </div>

            {/* Orta: Oynat / Durdur Dokunmatik Alan */}
            <div 
              onClick={() => setIsPlaying(!isPlaying)}
              className="relative z-10 flex-1 flex items-center justify-center cursor-pointer"
            >
              {!isPlaying && (
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 hover:scale-105 transition-transform shadow-xl">
                  <Play className="w-6 h-6 ml-1 text-white" />
                </div>
              )}
            </div>

            {/* Alt: Dinamik Altyazı & Sesli Sahne Bilgisi */}
            <div className="relative z-10 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-black/60 backdrop-blur-md text-[9px] font-semibold tracking-wider text-amber-400 border border-white/10">
                  {activeScene.name}
                </Badge>
                {!isMuted && isPlaying && (
                  <span className="text-[9px] font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Türkçe Seslendiriliyor
                  </span>
                )}
              </div>

              <div className="bg-black/75 backdrop-blur-md rounded-xl p-3 border border-white/10 shadow-lg min-h-[70px] flex items-center">
                <p className={`text-xs font-bold leading-snug tracking-tight text-center w-full transition-all duration-300 ${activeScene.color}`}>
                  {activeScene.caption}
                </p>
              </div>

              <div className="flex items-center justify-between pt-0.5 text-white/70 text-[10px]">
                <span>❤️ 5.4K</span>
                <span>💬 740</span>
                <span>↗️ Paylaş</span>
              </div>
            </div>

          </div>

          {/* Oynatma Kontrol Çubuğu */}
          <div className="flex items-center gap-2 mt-3.5">
            <Button
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-[#781324] hover:bg-[#5e0e1c] text-white font-semibold text-xs h-9 px-4"
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
                lastSpokenSceneRef.current = -1;
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
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
                toast.info(`Ses hızı: ${nextSpeed}x`);
              }}
              className="h-9 px-2 text-[11px] font-mono"
              title="Ses Hızı"
            >
              {speechSpeed}x
            </Button>
          </div>
        </div>

        {/* SAĞ: Senaryo Düzenleyici, Görsel Seçici ve Yayın Kontrolü */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            
            {/* Üst Başlık & Aksiyon */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">AI Reels & Shorts Stüdyosu</h3>
                  <p className="text-xs text-muted-foreground">9:16 Dikey video senaryosu, dinamik Türkçe seslendirme ve internet görsel desteği</p>
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
                    if (typeof window !== "undefined" && "speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                    onClose();
                  }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 1. Görsel Seçici & İnternet Tarama Bölümü */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" /> Reels Arka Plan Görseli Seç (İçeriğe Özel):
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Seçilen: {visuals.find(v => v.url === selectedVisualUrl)?.label || "Özel Görsel"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {visuals.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVisualUrl(v.url);
                      setImgError(false);
                      toast.info(`Arka plan: ${v.label}`);
                    }}
                    className={`p-2 rounded-lg text-left border text-[11px] transition-all flex flex-col justify-between h-[65px] ${
                      selectedVisualUrl === v.url 
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' 
                        : 'border-border/70 bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="truncate block font-semibold">{v.label}</span>
                    <span className="text-[9px] text-muted-foreground truncate">{v.description}</span>
                  </button>
                ))}
              </div>

              {/* Özel Web Görseli / URL Girişi */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="İnternetten Görsel URL'si yapıştırın (https://...)"
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
                      setSelectedVisualUrl(customWebImageUrl.trim());
                      setImgError(false);
                      toast.success("Özel web görseli Reels arka planına uygulandı!");
                    }
                  }}
                  className="h-8 text-xs shrink-0"
                >
                  Uygula
                </Button>
              </div>
            </div>

            {/* 2. Aktif Haberlerden Seçme */}
            {availableNews && availableNews.length > 0 && (
              <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Newspaper className="w-3 h-3 text-primary" /> Diğer Haberlerden Hızlıca Reels'e Dönüştür:
                </label>
                <div className="flex flex-wrap gap-1 max-h-[50px] overflow-y-auto pr-1">
                  {availableNews.slice(0, 5).map((n: any) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleSelectNews(n)}
                      className="text-[10px] px-2 py-0.5 rounded bg-card hover:bg-primary/10 border border-border/60 text-foreground truncate max-w-[180px]"
                    >
                      {n.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Sahne Sahne Dinamik Seslendirme Metinleri */}
            <div className="space-y-2 text-xs max-h-[220px] overflow-y-auto pr-1">
              {scenes.map((s, idx) => (
                <div 
                  key={s.index} 
                  className={`p-2.5 rounded-xl border transition-all ${
                    currentSceneIdx === s.index && isPlaying 
                      ? 'bg-primary/10 border-primary shadow-sm' 
                      : 'bg-muted/30 border-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold ${s.color}`}>
                      {s.name} • {s.timeRange}
                    </span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                      {s.badge}
                    </Badge>
                  </div>
                  <p className="text-foreground/90 font-medium leading-relaxed">
                    "{s.speechText}"
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
                  const fullText = scenes.map(s => `🎬 SAHNE ${s.index} (${s.timeRange}): "${s.speechText}"`).join("\n\n") + "\n\n#Trabzonspor #BordoMavi #Reels #Shorts";
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
                  if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
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