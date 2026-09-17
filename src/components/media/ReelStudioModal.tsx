"use client";

import { useState, useEffect } from "react";
import { 
  X, Play, Pause, RotateCcw, Sparkles, Film, 
  Volume2, VolumeX, Download, Check, Copy, Share2
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
}

export function ReelStudioModal({ isOpen, onClose, title, imageUrl, summary }: ReelStudioModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 15 seconds
  const [isMuted, setIsMuted] = useState(false);
  const totalDuration = 15;

  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
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
  // 0-3s: Hook, 3-8s: Context, 8-12s: Detail, 12-15s: CTA
  let sceneName = "1. Kanca (Hook)";
  let currentCaption = "🔥 Trabzonspor'da Yer Yerinden Oynuyor!";
  let sceneColor = "text-amber-400";

  if (currentTime >= 3 && currentTime < 8) {
    sceneName = "2. Gelişme & Manşet";
    currentCaption = title;
    sceneColor = "text-white";
  } else if (currentTime >= 8 && currentTime < 12) {
    sceneName = "3. Detay & Perde Arkası";
    currentCaption = summary || "Bordo-Mavili yönetim ve teknik heyet son kararı verdi. Taraftarlar heyecanla resmi açıklamayı bekliyor.";
    sceneColor = "text-sky-300";
  } else if (currentTime >= 12) {
    sceneName = "4. Eylem Çağrısı (CTA)";
    currentCaption = "💬 Sizce bu karar doğru mu? Yorumlarda buluşalım, takipte kalın!";
    sceneColor = "text-emerald-400";
  }

  const progressPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-card border border-border/90 rounded-3xl p-6 shadow-2xl max-w-4xl w-full flex flex-col md:flex-row gap-6 max-h-[92vh] overflow-y-auto">
        
        {/* SOL: 9:16 Dikey Video Mockup Ekranı */}
        <div className="flex flex-col items-center">
          <div className="relative w-[280px] h-[500px] rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 flex flex-col justify-between select-none">
            
            {/* Arka Plan Görseli & Ken Burns Zum Efekti */}
            <div className="absolute inset-0 overflow-hidden">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Reel Background" 
                  className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-[#781324] via-[#0F172A] to-[#164E7A]" />
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

                <div className="text-[10px] font-mono text-white/80 px-2 py-0.5 rounded-md bg-black/40">
                  {currentTime.toFixed(1)}s / 15s
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
                  <Play className="w-7 h-7 ml-1" />
                </div>
              )}
            </div>

            {/* Alt: Altyazı ve Dinamik Metin Alanı */}
            <div className="relative z-10 p-4 space-y-2.5">
              <div className="space-y-1">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${sceneColor}`}>
                  {sceneName}
                </span>
                <p className="text-sm font-bold text-white leading-snug drop-shadow-md line-clamp-3">
                  {currentCaption}
                </p>
              </div>

              {/* Ses Dalgası & Müzik Efekti Simülasyonu */}
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-white/70 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-primary rounded-full animate-bounce" />
                  <span className="w-1 h-4 bg-white rounded-full animate-bounce delay-75" />
                  <span className="w-1 h-2 bg-sky-400 rounded-full animate-bounce delay-150" />
                  <span className="ml-1 text-[10px] font-medium">Tribün Coşkusu Ritim</span>
                </div>
                <button onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ: Video Senaryosu & Kontroller */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-rose-500" />
                  <h3 className="text-lg font-bold text-foreground">AI Reels & Shorts Stüdyosu</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  9:16 dikey video formatında Facebook Reels, Instagram ve TikTok için otomatik kurgu
                </p>
              </div>
              <button 
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Oynatıcı Kontrolleri */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/70">
              <Button 
                size="sm" 
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 bg-[#781324] hover:bg-[#5e0e1c] text-white text-xs font-semibold"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                {isPlaying ? "Durdur" : "Oynat"}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                className="h-8 text-xs border-border/80"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Başa Sar
              </Button>
              <div className="flex-1 text-right text-xs font-mono font-semibold text-muted-foreground">
                Süre: {currentTime.toFixed(1)} / 15.0 sn
              </div>
            </div>

            {/* Senaryo Zaman Çizelgesi (Timeline) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Otomatik Kurgu Zaman Çizelgesi (15 sn)
              </h4>

              <div className={`p-2.5 rounded-xl border text-xs transition-colors ${currentTime < 3 ? 'bg-primary/10 border-primary/40' : 'bg-muted/20 border-border/60'}`}>
                <div className="flex justify-between font-bold text-foreground mb-0.5">
                  <span>🎬 1. Kanca (0-3 sn)</span>
                  <span className="font-mono text-[10px]">3.0 sn</span>
                </div>
                <p className="text-muted-foreground text-[11px]">"Trabzonspor'da yer yerinden oynuyor! İşte son dakika bombası..."</p>
              </div>

              <div className={`p-2.5 rounded-xl border text-xs transition-colors ${currentTime >= 3 && currentTime < 8 ? 'bg-primary/10 border-primary/40' : 'bg-muted/20 border-border/60'}`}>
                <div className="flex justify-between font-bold text-foreground mb-0.5">
                  <span>⚡ 2. Manşet & Gelişme (3-8 sn)</span>
                  <span className="font-mono text-[10px]">5.0 sn</span>
                </div>
                <p className="text-muted-foreground text-[11px] line-clamp-1">{title}</p>
              </div>

              <div className={`p-2.5 rounded-xl border text-xs transition-colors ${currentTime >= 8 && currentTime < 12 ? 'bg-primary/10 border-primary/40' : 'bg-muted/20 border-border/60'}`}>
                <div className="flex justify-between font-bold text-foreground mb-0.5">
                  <span>🔥 3. Perde Arkası (8-12 sn)</span>
                  <span className="font-mono text-[10px]">4.0 sn</span>
                </div>
                <p className="text-muted-foreground text-[11px] line-clamp-1">Detaylı kulüp analizi ve teknik heyet kararı.</p>
              </div>

              <div className={`p-2.5 rounded-xl border text-xs transition-colors ${currentTime >= 12 ? 'bg-primary/10 border-primary/40' : 'bg-muted/20 border-border/60'}`}>
                <div className="flex justify-between font-bold text-foreground mb-0.5">
                  <span>📢 4. Eylem Çağrısı (12-15 sn)</span>
                  <span className="font-mono text-[10px]">3.0 sn</span>
                </div>
                <p className="text-muted-foreground text-[11px]">"Sizce bu karar doğru mu? Yorumlarda buluşalım, takipte kalın!"</p>
              </div>
            </div>
          </div>

          {/* Alt Aksiyon Butonları */}
          <div className="flex items-center justify-between pt-4 border-t border-border/70">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const scriptText = `Reels Senaryosu:\n0-3s: Kanca\n3-8s: ${title}\n8-12s: Detay\n12-15s: Yorumlarda buluşalım!`;
                navigator.clipboard.writeText(scriptText);
                toast.success("Senaryo metni panoya kopyalandı!");
              }}
              className="text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Senaryoyu Kopyala
            </Button>

            <Button
              size="sm"
              className="bg-[#164E7A] hover:bg-[#123E62] text-white text-xs font-semibold shadow-xs"
              onClick={() => {
                toast.success("15 saniyelik video şablonu dışa aktarmaya hazırlandı!");
                onClose();
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Şablonu Dışa Aktar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
