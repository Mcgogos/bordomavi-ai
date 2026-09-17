"use client";

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink, Copy, Check, Sparkles, Palette, Layers, Download, Bot, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TRABZONSPOR_CANVA_TEMPLATES, CanvaTemplate, CanvaService } from "@/lib/canva/canva-service";
import { CanvaAutoDesigner } from "@/lib/canva/canva-auto-designer";
import { toast } from "sonner";

interface CanvaStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialSubtitle?: string;
}

export function CanvaStudioModal({
  isOpen,
  onClose,
  initialTitle = "TRABZONSPOR'DA FLAŞ GELİŞME!",
  initialSubtitle = "Bordo-mavili kulüpten taraftarı heyecanlandıran önemli adım."
}: CanvaStudioModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<CanvaTemplate>(TRABZONSPOR_CANVA_TEMPLATES[0]);
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [playerName, setPlayerName] = useState("Paul Onuachu");
  const [copied, setCopied] = useState(false);
  
  // Otomatik Üretilen HD Görsel State'i
  const [renderedDataUrl, setRenderedDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync props
  useEffect(() => {
    setTitle(initialTitle);
    setSubtitle(initialSubtitle);
  }, [initialTitle, initialSubtitle]);

  // Otomatik Tasarım Motoru: Her parametre değişiminde anında render eder
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvasRef.current = canvas;

      try {
        const dataUrl = CanvaAutoDesigner.render(canvas, {
          title,
          subtitle,
          playerName,
          category: selectedTemplate.category,
          width: selectedTemplate.width,
          height: selectedTemplate.height
        });
        setRenderedDataUrl(dataUrl);
      } catch (e) {
        console.warn("Auto design render error:", e);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [title, subtitle, playerName, selectedTemplate, isOpen]);

  if (!isOpen) return null;

  const SQUAD_PRESETS = [
    "Paul Onuachu",
    "André Onana",
    "Ernest Muçi",
    "Anthony Nwakaeme",
    "Edin Vişça",
    "Muhammed Cham",
    "Denis Drăguș",
    "Stefan Savić",
    "Okay Yokuşlu",
    "Ozan Tufan",
    "Oleksandr Zubkov",
    "Umut Nayir",
    "Şenol Güneş"
  ];

  const handleOpenInCanva = () => {
    const url = CanvaService.generateDirectEditorUrl(selectedTemplate, title);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Canva editörü yeni sekmede başlatıldı!");
  };

  const handleDownloadHD = () => {
    if (!renderedDataUrl) return;
    const link = document.createElement("a");
    link.download = `Trabzonspor_${selectedTemplate.category}_${Date.now()}.png`;
    link.href = renderedDataUrl;
    link.click();
    toast.success("🎉 HD Görsel başarıyla indirildi!");
  };

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        toast.success("📋 HD Görsel panoya kopyalandı! (Ctrl+V ile yapıştırabilirsiniz)");
      });
    } catch {
      toast.error("Tarayıcı görsel kopyalamayı kısıtladı, lütfen İndir butonunu kullanın.");
    }
  };

  const handleBoostHeadline = () => {
    let clean = title.replace(/^(SON DAKİKA|FLAŞ|RESMİ|TRABZONSPOR'DA BOMBA!)\s*[:|-]?\s*/i, "").trim();
    const prefixes = ["SON DAKİKA | ", "FLAŞ HABER! ", "TRABZONSPOR'DA BOMBA! "];
    const chosen = prefixes[Math.floor(Math.random() * prefixes.length)];
    setTitle(`${chosen}${clean.toUpperCase()}`);
    toast.success("Manşet yapay zeka tarafından güçlendirildi!");
  };

  const handleCopyText = () => {
    const text = `[${selectedTemplate.badgeText}]\n${title}\n${subtitle}\n#Trabzonspor #BordoMavi`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Metin panoya kopyalandı!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Gizli HD Canvas Çizim Motoru */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-4xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Başlığı */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-gradient-to-r from-[#781324]/10 via-background to-[#164E7A]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#781324] to-[#164E7A] flex items-center justify-center text-white font-bold shadow-md">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Canva Otonom Tasarım Stüdyosu</h2>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> %100 Otomatik Tasarım
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Siz hiçbir şey tasarlamadan yapay zeka hazır bordo-mavi afişi piksellerine kadar kendisi tamamlar.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Gövdesi */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto">
          
          {/* Sol: Şablon ve Parametreler (7 Kolon) */}
          <div className="md:col-span-7 space-y-5">
            
            {/* Şablon Seçimi */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Şablon Türü Seçin (AI Otomatik Tasarlar)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRABZONSPOR_CANVA_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(tmpl);
                        if (title === selectedTemplate.defaultTitle) {
                          setTitle(tmpl.defaultTitle);
                        }
                        if (subtitle === selectedTemplate.defaultSubtitle) {
                          setSubtitle(tmpl.defaultSubtitle);
                        }
                      }}
                      className={`p-3 rounded-xl text-left border transition-all text-xs flex flex-col gap-1.5 ${
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40" 
                          : "border-border/80 bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-foreground">{tmpl.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                          {tmpl.aspectRatio}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metin Düzenleme */}
            <div className="space-y-3 pt-2 border-t border-border/70">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Afiş / Görsel Başlığı</label>
                  <button
                    type="button"
                    onClick={handleBoostHeadline}
                    className="text-[10px] text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> Manşeti Güçlendir
                  </button>
                </div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs font-semibold h-9"
                  placeholder="Görsel başlığı..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Alt Başlık / Spot Açıklama</label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="text-xs h-9"
                  placeholder="Açıklama veya detay..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Futbolcu / Özne (Hızlı Seçim)</label>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="text-xs h-9 mb-1.5"
                  placeholder="Örn: Paul Onuachu, André Onana, Ernest Muçi"
                />
                <div className="flex flex-wrap gap-1">
                  {SQUAD_PRESETS.map((player) => (
                    <button
                      key={player}
                      type="button"
                      onClick={() => setPlayerName(player)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                        playerName === player
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold"
                          : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {player}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Sağ: Otomatik Tasarlanan Bitmiş HD Görsel (5 Kolon) */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Tamamlanmış HD Görsel
              </label>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Tasarım Hazır
              </span>
            </div>

            {/* Gerçek Render Edilen HD Görsel */}
            <div className="w-full rounded-2xl overflow-hidden border border-border/80 shadow-xl relative bg-slate-950 aspect-square flex items-center justify-center">
              {renderedDataUrl ? (
                <img 
                  src={renderedDataUrl} 
                  alt="Auto Designed Canva Visual" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-muted-foreground animate-pulse">
                  Görsel tasarlanıyor...
                </div>
              )}
            </div>

            {/* Eylem Butonları */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleDownloadHD}
                  className="w-full bg-[#781324] hover:bg-[#5e0e1c] text-white font-bold text-xs h-10 shadow-md flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  HD İndir (PNG)
                </Button>

                <Button
                  onClick={handleCopyImage}
                  variant="outline"
                  className="w-full font-bold text-xs h-10 border-primary/40 hover:bg-primary/10 flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4 text-primary" />
                  Görseli Kopyala
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenInCanva}
                  className="w-full font-semibold text-[11px] h-9 border-[#00C4CC]/40 text-[#00C4CC] hover:bg-[#00C4CC]/10 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Canva'da İnce Ayar
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCopyText}
                  className="w-full font-semibold text-[11px] h-9 border-border/80 flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Kopyalandı" : "Metni Kopyala"}
                </Button>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/60 border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">Otonom Tasarım:</span> Yapay zeka başlık boyutu, satır bölmeleri, bordo-mavi stadyum ışıkları ve kurumsal armayı otomatik yerleştirdi. Tasarımınız şu an yayına hazırdır.
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}