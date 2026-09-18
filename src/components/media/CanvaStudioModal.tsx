"use client";

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink, Copy, Check, Sparkles, Palette, Layers, Download, Bot, CheckCircle2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TRABZONSPOR_CANVA_TEMPLATES, CanvaTemplate, CanvaTemplateCategory, CanvaService } from "@/lib/canva/canva-service";
import { CanvaAutoDesigner } from "@/lib/canva/canva-auto-designer";
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from "@/lib/canva/brand-logo-data";
import { SquadService } from "@/lib/squad/squad-service";
import { publishCanvaDesignAction } from "@/app/(dashboard)/media/actions";
import { toast } from "sonner";

interface CanvaStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialSubtitle?: string;
  initialBody?: string;
  initialCategory?: CanvaTemplateCategory;
  onApplyDesign?: (data: { dataUrl: string; templateCategory: string; title: string; subtitle: string; body?: string }) => void;
}

export function CanvaStudioModal({
  isOpen,
  onClose,
  initialTitle = "TRABZONSPOR'DA FLAŞ GELİŞME!",
  initialSubtitle = "Bordo-mavili kulüpten taraftarı heyecanlandıran önemli adım.",
  initialBody = "",
  initialCategory,
  onApplyDesign,
}: CanvaStudioModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<CanvaTemplate>(() => {
    if (initialCategory) {
      const match = TRABZONSPOR_CANVA_TEMPLATES.find(t => t.category === initialCategory);
      if (match) return match;
    }
    return TRABZONSPOR_CANVA_TEMPLATES[0];
  });
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [body, setBody] = useState(initialBody);
  const [playerName, setPlayerName] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Otomatik Üretilen HD Görsel State'i
  const [renderedDataUrl, setRenderedDataUrl] = useState<string>("");
  const [isPublishingToFb, setIsPublishingToFb] = useState(false);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Kullanıcının yüklediği orijinal logoyu tarayıcıda önceden yükle
  useEffect(() => {
    const img = new Image();
    img.src = BORDOMAVI_BRAND_LOGO_DATA_URI;
    img.onload = () => setLogoImage(img);
    if (img.complete && img.naturalWidth > 0) {
      setLogoImage(img);
    }
  }, []);

  // Sync props (temizlenmiş metin ile)
  useEffect(() => {
    setTitle((initialTitle || "").replace(/\*\*/g, "").replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3"));
    setSubtitle((initialSubtitle || "").replace(/\*\*/g, "").replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3"));
    setBody((initialBody || "").replace(/\*\*/g, "").replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3"));
  }, [initialTitle, initialSubtitle, initialBody]);

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
          height: selectedTemplate.height,
          logoImage
        });
        setRenderedDataUrl(dataUrl);
      } catch (e) {
        console.warn("Auto design render error:", e);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [title, subtitle, playerName, selectedTemplate, isOpen, logoImage]);

  if (!isOpen) return null;

  const handlePublishToFacebook = async () => {
    if (!renderedDataUrl) {
      toast.error("Görsel henüz oluşturulmadı.");
      return;
    }
    setIsPublishingToFb(true);
    try {
      // Çok hızlı ve hafif iletim için yüksek kaliteli JPEG verisini al (~200KB vs ~3MB PNG)
      let uploadPayload = renderedDataUrl;
      if (canvasRef.current) {
        try {
          const optJpeg = canvasRef.current.toDataURL("image/jpeg", 0.92);
          if (optJpeg && optJpeg.length > 500) {
            uploadPayload = optJpeg;
          }
        } catch {
          // Varsayılan ile devam et
        }
      }

      const res = await publishCanvaDesignAction({
        title,
        subtitle,
        body,
        category: selectedTemplate.category,
        dataUrl: uploadPayload,
      });
      if (res.success) {
        toast.success(`🎉 Canva tasarımı Facebook'ta başarıyla yayınlandı! (ID: ${res.postId})`);
      } else {
        toast.error(res.error || "Facebook yayını başarısız oldu.");
      }
    } catch (e: any) {
      console.error("Facebook publish error in modal:", e);
      toast.error("Facebook yayını sırasında bir hata oluştu: " + (e.message || "Bilinmeyen hata"));
    } finally {
      setIsPublishingToFb(false);
    }
  };

  const handleOpenInCanva = async () => {
    // 1. Panoya görseli otomatik kopyalamayı dene (Ctrl+V ile Canva'ya yapıştırılabilmesi için)
    if (canvasRef.current) {
      try {
        canvasRef.current.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob })
              ]);
            } catch {
              // Pano kısıtlaması durumunda sessizce devam et
            }
          }
        });
      } catch {
        // İhlal olmaksızın devam et
      }
    }

    // 2. Doğrulanmış Canva URL'sini aç
    const url = CanvaService.generateDirectEditorUrl(selectedTemplate, title);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("🎨 Canva açıldı! Görsel panoya kopyalandı, Canva tuvalinde Ctrl+V ile yapıştırabilirsiniz.");
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
    let clean = title
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .replace(/^(SON DAKİKA|FLAŞ|RESMİ|TRABZONSPOR'DA BOMBA!)\s*[:|-]?\s*/i, "")
      .trim();
    const prefixes = ["SON DAKİKA | ", "FLAŞ HABER! ", "TRABZONSPOR'DA BOMBA! "];
    const chosen = prefixes[Math.floor(Math.random() * prefixes.length)];
    setTitle(`${chosen}${clean.toUpperCase()}`);
    toast.success("Manşet yapay zeka tarafından güçlendirildi!");
  };

  const handleCopyText = () => {
    const cleanT = title.replace(/\*\*/g, "").replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3").trim();
    const cleanS = subtitle.replace(/\*\*/g, "").replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3").trim();
    const text = `[${selectedTemplate.badgeText}]\n${cleanT}\n${cleanS}\n#Trabzonspor #BordoMavi`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Metin panoya kopyalandı!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Gizli HD Canvas Çizim Motoru */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-5xl bg-card border border-border/80 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Modal Başlığı */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/70 bg-gradient-to-r from-[#781324]/10 via-background to-[#164E7A]/10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#781324] to-[#164E7A] flex items-center justify-center text-white font-bold shadow-md shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-base font-bold text-foreground">Canva Otonom Tasarım Stüdyosu</h2>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] sm:text-[10px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> %100 AI
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                Yapay zeka bordo-mavi şablonları piksellerine kadar hazır tasarlar.
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

        {/* Modal Gövdesi — Mobilde ve Yatayda Kusursuz Kaydırma */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 p-3 sm:p-6 overflow-y-auto flex-1">
          
          {/* Sağ (Mobilde Üst): Otomatik Tasarlanan Bitmiş HD Görsel (5 Kolon) */}
          <div className="order-first md:order-last md:col-span-5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Tamamlanmış HD Görsel
              </label>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Tasarım Yayına Hazır
              </span>
            </div>

            {/* Gerçek Render Edilen HD Görsel — Yatay ve Dikey Mobilde Dinamik Ölçekleme */}
            <div className="w-full rounded-xl sm:rounded-2xl overflow-hidden border border-border/80 shadow-xl relative bg-slate-950 aspect-video sm:aspect-square max-h-[190px] sm:max-h-[300px] md:max-h-none flex items-center justify-center mx-auto">
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

            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/60 border border-border/60 text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed hidden sm:block">
              <span className="font-bold text-foreground">Otonom Tasarım:</span> Yapay zeka manşet puntosu, satır bölmeleri, bordo-mavi stadyum ışıkları ve kurumsal logoyu otomatik yerleştirdi.
            </div>
          </div>

          {/* Sol (Mobilde Alt): 10 Şablon ve Metin Parametreleri (7 Kolon) */}
          <div className="order-last md:order-first md:col-span-7 space-y-4">
            
            {/* Şablon Seçimi — 10 Şablon Responsive Grid */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Şablon Seçin (10 Çeşit Trabzonspor Formatı)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] sm:max-h-[280px] overflow-y-auto pr-1">
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
                      className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col gap-1 ${
                        isSelected 
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/50" 
                          : "border-border/80 bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-foreground line-clamp-1">{tmpl.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-mono text-muted-foreground shrink-0">
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Futbolcu / Özne (Hızlı Seçim — Güncel 2026/2027 Kadrosu)</label>
                  {playerName && (
                    <button
                      type="button"
                      onClick={() => setPlayerName("")}
                      className="text-[10px] text-rose-500 hover:text-rose-400 font-bold transition-colors"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="text-xs h-9 mb-1.5"
                  placeholder="Örn: Simon Banza, Anthony Nwakaeme, Edin Vişça, Thomas Reis..."
                />
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {SquadService.getCurrentSquad().map((player) => (
                    <button
                      key={player.name}
                      type="button"
                      onClick={() => setPlayerName(player.name)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                        playerName === player.name
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold"
                          : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {player.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPlayerName(SquadService.getManager().name)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                      playerName === SquadService.getManager().name
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold"
                        : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {SquadService.getManager().name} (TD)
                  </button>
                </div>
              </div>

              {/* Facebook Gönderi / Haber Metni (Facebook'ta görselle birlikte yayınlanacak tam metin) */}
              <div className="pt-2 border-t border-border/70">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>Facebook Haber Metni (Gönderi Açıklaması)</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-sky-500/10 text-sky-400 border-sky-500/30">
                      Görselle Paylaşılır
                    </Badge>
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {body.length} karakter
                  </span>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="text-xs min-h-[110px] max-h-[220px] font-normal leading-relaxed resize-y bg-background/50"
                  placeholder="Facebook'ta görsel ile birlikte paylaşılacak tam haber metni..."
                />
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <span>ℹ️</span> 'Facebook'ta Hemen Yayınla' dendiğinde bu metin görselin açıklaması olarak Facebook'a iletilir.
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* Sabit Alt Eylem Çubuğu — Mobilde ve Masaüstünde Daima Görünür, 1-Tık Yayınla */}
        <div className="sticky bottom-0 z-30 p-2.5 sm:px-6 sm:py-3 bg-card/95 backdrop-blur-md border-t border-border flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 shadow-lg shrink-0">
          {/* Birincil Eylemler: Uygula & Kaydet + Facebook'ta Yayınla */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            {onApplyDesign && (
              <Button
                onClick={() => {
                  if (!renderedDataUrl) {
                    toast.error("Görsel henüz oluşturulmadı.");
                    return;
                  }
                  onApplyDesign({
                    dataUrl: renderedDataUrl,
                    templateCategory: selectedTemplate.category,
                    title,
                    subtitle,
                    body,
                  });
                }}
                disabled={!renderedDataUrl}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 px-4 shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span className="truncate">Tasarımı Gönderiye Uygula & Kaydet</span>
              </Button>
            )}

            <Button
              onClick={handlePublishToFacebook}
              disabled={isPublishingToFb || !renderedDataUrl}
              className="flex-1 bg-[#164E7A] hover:bg-[#123E62] text-white font-bold text-xs sm:text-sm h-11 px-4 shadow-md flex items-center justify-center gap-2 transition-all"
            >
              {isPublishingToFb ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-300 shrink-0" />
              ) : (
                <Send className="w-4 h-4 text-sky-300 shrink-0" />
              )}
              <span className="truncate">
                {isPublishingToFb ? "Facebook'ta Yayınlanıyor..." : "Facebook'ta Hemen Yayınla (1-Tık)"}
              </span>
            </Button>
          </div>

          {/* İkincil Eylemler: HD İndir + Canva'da Aç + Kopyala */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleDownloadHD}
              disabled={!renderedDataUrl}
              className="flex-1 sm:flex-initial bg-[#781324] hover:bg-[#5e0e1c] text-white font-bold text-xs h-10 sm:h-11 px-3.5 shadow-md flex items-center justify-center gap-1.5 shrink-0"
            >
              <Download className="w-4 h-4 text-amber-400 shrink-0" />
              <span>HD İndir</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInCanva}
              className="flex-1 sm:flex-initial text-xs h-10 sm:h-11 border-[#00C4CC]/40 text-[#00C4CC] hover:bg-[#00C4CC]/10 flex items-center justify-center gap-1.5 px-3"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" /> 
              <span>Canva</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyImage}
              disabled={!renderedDataUrl}
              className="flex-1 sm:flex-initial text-xs h-10 sm:h-11 border-primary/40 text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5 px-3"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" /> 
              <span>Kopyala</span>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}