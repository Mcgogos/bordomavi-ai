"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, Play, Pause, RotateCcw, Sparkles, Film, 
  Volume2, VolumeX, Download, Check, Copy, Share2, Newspaper
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ReelStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  imageUrl?: string;
  summary?: string;
  availableNews?: any[];
}

export function ReelStudioModal({ 
  isOpen, 
  onClose, 
  title: initialTitle, 
  imageUrl: initialImageUrl, 
  summary: initialSummary,
  availableNews = []
}: ReelStudioModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [imageUrl, setImageUrl] = useState(initialImageUrl || "");
  const [summary, setSummary] = useState(initialSummary || "");
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 15 seconds
  const [isMuted, setIsMuted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastSpokenSceneRef = useRef<number>(-1);
  const totalDuration = 15;

  // Sync initial props when opened
  useEffect(() => {
    setTitle(initialTitle);
    setImageUrl(initialImageUrl || "");
    setSummary(initialSummary || "");
    setImgError(false);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [initialTitle, initialImageUrl, initialSummary, isOpen]);

  // Audio / Speech Synthesis Engine (Gerçek Türkçe Ses)
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || isMuted) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.rate = 1.1; // Dinamik hızlı tempo (Reels ritmi)
      utterance.pitch = 1.0;
      
      // Türkçe ses seçmeye çalış
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

  // Stop speech on unmount
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

  // Determine current scene based on time
  // 0-3s: Hook (1), 3-8s: Context (2), 8-12s: Detail (3), 12-15s: CTA (4)
  let currentSceneIdx = 1;
  let sceneName = "1. Kanca (Hook)";
  let currentCaption = "🔥 Trabzonspor'da Yer Yerinden Oynuyor!";
  let speechNarration = "Trabzonspor'da yer yerinden oynuyor! İşte son dakika gelişmesi:";
  let sceneColor = "text-amber-400";

  if (currentTime >= 3 && currentTime < 8) {
    currentSceneIdx = 2;
    sceneName = "2. Gelişme & Manşet";
    currentCaption = title;
    speechNarration = title;
    sceneColor = "text-white";
  } else if (currentTime >= 8 && currentTime < 12) {
    currentSceneIdx = 3;
    sceneName = "3. Detay & Perde Arkası";
    currentCaption = summary || "Bordo-Mavili kulüpte sıcak saatler yaşanıyor. Taraftarlar heyecanla resmi açıklamayı bekliyor.";
    speechNarration = currentCaption;
    sceneColor = "text-sky-300";
  } else if (currentTime >= 12) {
    currentSceneIdx = 4;
    sceneName = "4. Eylem Çağrısı (CTA)";
    currentCaption = "💬 Sizce bu karar doğru mu? Yorumlarda buluşalım, takipte kalın!";
    speechNarration = "Sizce bu karar doğru mu? Yorumlarda buluşalım! Sayfamızı takip etmeyi unutmayın.";
    sceneColor = "text-emerald-400";
  }

  // Trigger speech when entering a new scene
  if (isPlaying && !isMuted && lastSpokenSceneRef.current !== currentSceneIdx) {
    lastSpokenSceneRef.current = currentSceneIdx;
    speakText(speechNarration);
  }

  const progressPercent = (currentTime / totalDuration) * 100;

  // Select news helper
  const handleSelectNews = (news: any) => {
    setTitle(news.title);
    setImageUrl(news.imageUrl || "");
    setSummary(news.summary || news.content || "");
    setImgError(false);
    setCurrentTime(0);
    setIsPlaying(false);
    toast.success(`"${news.title.substring(0, 30)}..." haberi Reels senaryosuna aktarıldı!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-card border border-border/90 rounded-3xl p-6 shadow-2xl max-w-4xl w-full flex flex-col md:flex-row gap-6 max-h-[92vh] overflow-y-auto">
        
        {/* SOL: 9:16 Dikey Video Mockup Ekranı */}
        <div className="flex flex-col items-center">
          <div className="relative w-[280px] h-[500px] rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 flex flex-col justify-between select-none">
            
            {/* Arka Plan Görseli & Canlı Stadyum Fallback */}
            <div className="absolute inset-0 overflow-hidden">
              {imageUrl && !imgError ? (
                <img 
                  src={imageUrl} 
                  alt="Reel Background" 
                  onError={() => setImgError(true)}
                  className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                />
              ) : (
                /* Yüksek Kalite Bordo-Mavi Stadyum Simülasyonu */
                <div className="w-full h-full relative bg-gradient-to-b from-[#781324] via-[#0F172A] to-[#164E7A] flex items-center justify-center">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-400 via-transparent to-transparent" />
                  <div className="w-24 h-24 rounded-full border-2 border-amber-400/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-3xl font-black text-amber-400 shadow-2xl">
                    TS
                  </div>
                  <div className="absolute bottom-16 text-[11px] font-bold text-white/50 tracking-widest uppercase">
                    PAPARA PARK • TRABZON
                  </div>
                </div>
              )}
              {/* Koyu Karartma Filtresi */}
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
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-[#781324] flex items-center justify-center text-[9px] font-bold text-white">
                    BM
                  </div>
                  <span className="text-[10px] font-bold text-white tracking-wide">BordoMavi AI</span>
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
                  <div className="text-[10px] font-mono text-white/80 px-2 py-0.5 rounded-md bg-black/40">
                    {currentTime.toFixed(1)}s / 15s
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
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 hover:scale-105 transition-transform">
                  <Play className="w-6 h-6 ml-1 text-white" />
                </div>
              )}
            </div>

            {/* Alt: Dinamik Altyazı & Sesli Sahne Bilgisi */}
            <div className="relative z-10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-black/60 backdrop-blur-md text-[9px] font-semibold tracking-wider text-amber-400 border border-white/10">
                  {sceneName}
                </Badge>
                {!isMuted && isPlaying && (
                  <span className="text-[9px] font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Sesli Anlatım
                  </span>
                )}
              </div>

              <div className="bg-black/70 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-lg min-h-[72px] flex items-center">
                <p className={`text-xs font-bold leading-snug tracking-tight text-center w-full transition-all duration-300 ${sceneColor}`}>
                  {currentCaption}
                </p>
              </div>

              {/* Instagram / Reels Etkileşim Butonları */}
              <div className="flex items-center justify-between pt-1 text-white/70 text-[10px]">
                <span>❤️ 4.8K</span>
                <span>💬 582</span>
                <span>↗️ Paylaş</span>
              </div>
            </div>

          </div>

          {/* Oynatma Kontrol Çubuğu */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-[#781324] hover:bg-[#5e0e1c] text-white font-semibold text-xs h-9 px-4"
            >
              {isPlaying ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
              {isPlaying ? "Durdur" : "Sesli Oynat (15s)"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(0);
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className="h-9 w-9 p-0"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* SAĞ: Senaryo Düzenleyici & Aktif Haberlerden Seçme */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            
            {/* Üst Bar */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">AI Reels & Shorts Stüdyosu</h3>
                  <p className="text-xs text-muted-foreground">9:16 dikey mobil video senaryosu ve sesli anlatım</p>
                </div>
              </div>
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

            {/* Aktif Haberlerden Otomatik Doldurma Seçici */}
            {availableNews && availableNews.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5 text-primary" /> Aktif Haberlerden Otomatik Reels Oluştur:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[70px] overflow-y-auto pr-1">
                  {availableNews.slice(0, 6).map((news: any) => (
                    <button
                      key={news.id}
                      type="button"
                      onClick={() => handleSelectNews(news)}
                      className="text-[10px] px-2 py-1 rounded bg-card hover:bg-primary/10 border border-border/60 text-foreground truncate max-w-[200px]"
                    >
                      {news.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sahne Sahne Metin Akışı */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-amber-500">🎬 1. Kanca (Hook) • 0-3 sn</span>
                  <span className="text-[10px] text-muted-foreground">Ses: Türkçe Flaş Giriş</span>
                </div>
                <p className="text-muted-foreground italic">
                  "Trabzonspor'da yer yerinden oynuyor! İşte son dakika gelişmesi:"
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground">⚡ 2. Manşet & Gelişme • 3-8 sn</span>
                  <span className="text-[10px] text-muted-foreground">Ses: Haber Başlığı</span>
                </div>
                <p className="text-muted-foreground italic line-clamp-2">
                  {title}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sky-400">🔥 3. Perde Arkası • 8-12 sn</span>
                  <span className="text-[10px] text-muted-foreground">Ses: Detaylar</span>
                </div>
                <p className="text-muted-foreground italic line-clamp-2">
                  {summary || "Bordo-Mavili yönetim ve teknik heyet son kararı verdi."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-600">📢 4. Eylem Çağrısı (CTA) • 12-15 sn</span>
                  <span className="text-[10px] text-muted-foreground">Ses: Yorum Teşviki</span>
                </div>
                <p className="text-muted-foreground italic">
                  "Sizce bu karar doğru mu? Yorumlarda buluşalım, takipte kalın!"
                </p>
              </div>
            </div>

          </div>

          {/* Aksiyon Butonları */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/70">
            <Button
              onClick={() => {
                const fullText = `🎬 SAHNE 1 (0-3s): "Trabzonspor'da yer yerinden oynuyor!"\n⚡ SAHNE 2 (3-8s): ${title}\n🔥 SAHNE 3 (8-12s): ${summary}\n📢 SAHNE 4 (12-15s): Sizce bu karar doğru mu? Yorumlarda buluşalım!\n\n#Trabzonspor #BordoMavi #Reels`;
                navigator.clipboard.writeText(fullText);
                setCopied(true);
                toast.success("Reels senaryosu panoya kopyalandı!");
                setTimeout(() => setCopied(false), 2000);
              }}
              variant="outline"
              className="flex-1 text-xs font-semibold h-10 border-border/80"
            >
              {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copied ? "Kopyalandı!" : "Senaryoyu Kopyala"}
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
  );
}