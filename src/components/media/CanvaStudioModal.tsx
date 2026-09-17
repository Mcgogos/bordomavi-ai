"use client";

import { useState } from "react";
import { X, ExternalLink, Copy, Check, Sparkles, Palette, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TRABZONSPOR_CANVA_TEMPLATES, CanvaTemplate, CanvaService } from "@/lib/canva/canva-service";
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
  const [playerName, setPlayerName] = useState("Simon Banza");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleOpenInCanva = () => {
    const url = CanvaService.generateDirectEditorUrl(selectedTemplate, title);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Canva editörü yeni sekmede başlatıldı!");
  };

  const handleCopyText = () => {
    const text = `[${selectedTemplate.badgeText}]\n${title}\n${subtitle}\n#Trabzonspor #BordoMavi`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Metin panoya kopyalandı! Canva tasarımınıza yapıştırabilirsiniz.");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Başlığı */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-gradient-to-r from-[#781324]/10 via-background to-[#164E7A]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#781324] to-[#164E7A] flex items-center justify-center text-white font-bold shadow-md">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Canva Bordo-Mavi Tasarım Stüdyosu</h2>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  Canva Entegrasyonu
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Trabzonspor kurumsal kimliğine uygun hazır şablonlarla Canva üzerinde anında profesyonel görsel üretin.
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
                <Layers className="w-3.5 h-3.5" /> Şablon Seçin
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
                <label className="text-xs font-semibold text-foreground mb-1 block">Afiş / Görsel Başlığı</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs font-semibold h-9"
                  placeholder="Görsel başlığı..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Alt Başlık / Spot Metin</label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="text-xs h-9"
                  placeholder="Açıklama veya maç detayları..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Futbolcu / Ana Özne (Opsiyonel)</label>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="text-xs h-9"
                  placeholder="Örn: Simon Banza, Uğurcan Çakır"
                />
              </div>
            </div>

          </div>

          {/* Sağ: Canlı Görsel Önizleme & Eylemler (5 Kolon) */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Şablon Canlı Önizlemesi
            </label>

            {/* Tasarım Kartı Simülasyonu */}
            <div 
              className="w-full rounded-xl overflow-hidden border border-border/80 shadow-lg relative flex flex-col justify-between p-5 text-white min-h-[260px]"
              style={{
                background: `linear-gradient(135deg, ${selectedTemplate.primaryColor} 0%, #0F172A 70%, ${selectedTemplate.accentColor} 100%)`
              }}
            >
              {/* Üst Rozet & Logo */}
              <div className="flex justify-between items-start">
                <span 
                  className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase shadow-xs"
                  style={{ backgroundColor: selectedTemplate.accentColor, color: '#FFFFFF' }}
                >
                  {selectedTemplate.badgeText}
                </span>
                <span className="text-[11px] font-extrabold tracking-tight opacity-90">
                  BORDO MAVİ
                </span>
              </div>

              {/* Orta Başlık */}
              <div className="space-y-1.5 my-auto py-4">
                {playerName && (
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    ★ {playerName}
                  </div>
                )}
                <h3 className="text-sm md:text-base font-black leading-tight tracking-tight uppercase line-clamp-3">
                  {title}
                </h3>
                <p className="text-xs opacity-80 font-medium line-clamp-2 leading-relaxed">
                  {subtitle}
                </p>
              </div>

              {/* Alt Bilgi */}
              <div className="pt-3 border-t border-white/20 flex justify-between items-center text-[10px] opacity-75 font-mono">
                <span>{selectedTemplate.width} x {selectedTemplate.height} PX</span>
                <span>TRABZONSPOR AI</span>
              </div>
            </div>

            {/* Eylem Butonları */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handleOpenInCanva}
                className="w-full bg-[#00C4CC] hover:bg-[#00B4BC] text-white font-bold text-xs h-10 shadow-md flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Canva'da Aç ve Tasarla (1-Tık)
              </Button>

              <Button
                variant="outline"
                onClick={handleCopyText}
                className="w-full font-semibold text-xs h-9 border-border/80 flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Metinler Kopyalandı!" : "Canva İçin Metinleri Kopyala"}
              </Button>
            </div>

            <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">İpucu:</span> Canva butonuna bastığınızda seçtiğiniz şablonun tam piksel ölçülerinde hazır boş tuval açılır. Bordo-mavi kulüp renk kodları ve kopyaladığınız metinler doğrudan uygulanabilir.
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}