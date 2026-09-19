"use client";

import { useState, useEffect } from "react";
import { 
  Save, Send, Trash, Wand2, Sparkles, Scissors, Zap, 
  LayoutTemplate, Globe, MoreHorizontal, ThumbsUp, MessageCircle, Share2, 
  Loader2, CheckCircle, Search, ExternalLink, ChevronRight,
  ShieldCheck, SplitSquareVertical, Film, Copy, X, Palette,
  FileText, Edit, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveContentAction, deleteContentAction, publishContentDirectlyAction } from "./actions";
import { EngagementEngine, ABHeadlineVariant } from "@/lib/ai/engagement-engine";
import { CanvaStudioModal } from "@/components/media/CanvaStudioModal";
import { FacebookGroupShareModal } from "@/components/social/FacebookGroupShareModal";
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from "@/lib/canva/brand-logo-data";

export default function EditorClient({ initialContents }: { initialContents: any[] }) {
  const [contents, setContents] = useState(initialContents);
  const [selectedId, setSelectedId] = useState<string | null>(initialContents.length > 0 ? initialContents[0].id : null);
  const [groupSharePost, setGroupSharePost] = useState<any | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Mobil Görünüm Sekmesi (queue | editor | preview)
  const [mobileTab, setMobileTab] = useState<"queue" | "editor" | "preview">("editor");

  // New Engagement & A/B State
  const [abVariants, setAbVariants] = useState<ABHeadlineVariant[] | null>(null);
  const [showAbModal, setShowAbModal] = useState(false);
  const [showReelModal, setShowReelModal] = useState(false);
  const [showCanvaModal, setShowCanvaModal] = useState(false);
  const [customVisuals, setCustomVisuals] = useState<Record<string, string>>({});

  const selectedContent = contents.find(c => c.id === selectedId);

  // Local edits for the selected content
  const [localTitle, setLocalTitle] = useState("");
  const [localBody, setLocalBody] = useState("");

  // Risk & Sentiment analysis
  const riskAnalysis = EngagementEngine.analyzeRiskAndReputation(localTitle, localBody);

  const detectCategory = (title: string, body: string) => {
    const text = `${title} ${body}`.toLowerCase();
    if (text.includes('transfer') || text.includes('imza') || text.includes('anlaşma')) return 'TRANSFER';
    if (text.includes('maç günü') || text.includes('derbi') || text.includes('stadyum')) return 'MATCH_DAY';
    if (text.includes('ilk 11') || text.includes('kadro')) return 'LINEUP';
    if (text.includes('gol') || text.includes('skor') || text.includes('goool')) return 'GOAL';
    if (text.includes('kırmızı kart') || text.includes('penaltı')) return 'PENALTY_CARD';
    if (text.includes('maç sonucu') || text.includes('galibiyet') || text.includes('3 puan')) return 'RESULT';
    if (text.includes('açıklama') || text.includes('thomas reis') || text.includes('reis')) return 'QUOTE';
    if (text.includes('reels') || text.includes('story')) return 'REELS';
    if (text.includes('kamuoyu') || text.includes('resmi açıklama')) return 'OFFICIAL';
    return 'BREAKING';
  };

  const handleApplyCanvaDesign = async (data: { dataUrl: string; templateCategory: string; title: string; subtitle: string; body?: string }) => {
    if (!selectedId) return;

    setCustomVisuals(prev => ({ ...prev, [selectedId]: data.dataUrl }));
    if (data.title) setLocalTitle(data.title);
    if (data.body) {
      setLocalBody(data.body);
    } else if (data.subtitle && !localBody) {
      setLocalBody(data.subtitle);
    }

    const targetTitle = data.title || localTitle;
    const targetBody = data.body || localBody || data.subtitle;

    setIsSaving(true);
    try {
      const res = await saveContentAction(selectedId, {
        title: targetTitle,
        body: targetBody,
      });
      if (res.success) {
        toast.success("🎉 Canva tasarımı başarıyla bu gönderiye uygulandı ve kaydedildi!");
        setContents(contents.map(c => 
          c.id === selectedId 
            ? { ...c, title: targetTitle, body: targetBody }
            : c
        ));
      }
    } catch (e) {
      console.error("Design save error:", e);
    } finally {
      setIsSaving(false);
    }

    setShowCanvaModal(false);
  };

  // Sync local state when selected content changes
  useEffect(() => {
    if (selectedContent) {
      setLocalTitle(selectedContent.title || "");
      setLocalBody(selectedContent.body || "");
    }
  }, [selectedContent]);

  if (contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-card">
        <Sparkles className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-xl font-semibold mb-2">Düzenlenecek İçerik Yok</h2>
        <p className="text-muted-foreground">Şu an taslak, onay bekleyen veya yayınlanmaya hazır bir içerik bulunmuyor.</p>
      </div>
    );
  }

  const handleSave = async (newStatus?: string) => {
    if (!selectedContent) return;
    setIsSaving(true);
    
    const updates = {
      title: localTitle,
      body: localBody,
      ...(newStatus && { status: newStatus })
    };

    const res = await saveContentAction(selectedContent.id, updates);
    if (res.success) {
      toast.success(newStatus === 'READY_TO_PUBLISH' ? "İçerik onaylandı ve yayın sırasına alındı!" : "Taslak başarıyla kaydedildi.");
      // Update local state
      setContents(contents.map(c => 
        c.id === selectedContent.id 
          ? { ...c, title: localTitle, body: localBody, status: newStatus || c.status } 
          : c
      ));
      if (newStatus === 'READY_TO_PUBLISH') {
         // Optionally move to next item
      }
    } else {
      toast.error(res.error || "Hata oluştu");
    }
    setIsSaving(false);
  };

  const handleDirectPublish = async () => {
    if (!selectedContent) return;
    setIsPublishing(true);
    
    try {
      let res = await publishContentDirectlyAction(selectedContent.id, {
        title: selectedContent.title,
        body: selectedContent.body,
        customImageUrl: selectedId ? customVisuals[selectedId] : undefined
      });
      
      if (!res.success && res.duplicateWarning) {
        const confirmForce = confirm(
          `${res.error}\n\nBu içerik daha önce yayınlanmış bir haberle neredeyse aynıdır. Yine de Facebook'ta YENİDEN YAYINLAMAK istiyor musunuz?`
        );
        if (confirmForce) {
          res = await publishContentDirectlyAction(selectedContent.id, {
            title: selectedContent.title,
            body: selectedContent.body,
            customImageUrl: selectedId ? customVisuals[selectedId] : undefined,
            forcePublish: true
          });
        } else {
          toast.info("Mükerrer yayın iptal edildi.");
          setIsPublishing(false);
          return;
        }
      }

      if (res.success) {
        toast.success(`İçerik anında Facebook'ta yayınlandı! ${res.mockMode ? '(Mock Mode)' : ''}`);
        const publishedPost = {
          id: selectedContent.id,
          title: selectedContent.title,
          body: selectedContent.body,
          facebookPostId: (res as any).data?.facebookPostId || (res as any).postId,
        };
        setGroupSharePost(publishedPost);
        setContents(contents.filter(c => c.id !== selectedContent.id));
        if (contents.length > 1) {
          const next = contents.find(c => c.id !== selectedContent.id);
          setSelectedId(next ? next.id : null);
        } else {
          setSelectedId(null);
        }
      } else {
        toast.error(res.error || "Yayınlama hatası");
      }
    } catch (e: any) {
      toast.error(e.message || "Bilinmeyen bir hata oluştu");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedContent) return;
    if (!confirm("Bu içeriği kalıcı olarak silmek (reddetmek) istediğinize emin misiniz?")) return;
    
    setIsSaving(true);
    const res = await deleteContentAction(selectedContent.id);
    if (res.success) {
      toast.success("İçerik reddedildi.");
      const nextContents = contents.filter(c => c.id !== selectedContent.id);
      setContents(nextContents);
      setSelectedId(nextContents.length > 0 ? nextContents[0].id : null);
    } else {
      toast.error(res.error || "Hata oluştu");
    }
    setIsSaving(false);
  };

  const handleAIAction = async (actionType: string) => {
    // Mock AI action for now. In a real scenario, this would call an API endpoint.
    setIsProcessing(actionType);
    toast.info("Yapay zeka işlemi başlatıldı...");
    
    setTimeout(() => {
      if (actionType === "shorten") {
         setLocalBody(localBody.substring(0, Math.floor(localBody.length / 2)) + "...");
         toast.success("İçerik kısaltıldı!");
      } else if (actionType === "enhance") {
         setLocalBody(localBody + "\n\n🔥 Daha fazlası için Bordo Mavi uygulamasını indirin!");
         toast.success("İçerik güçlendirildi!");
      }
      setIsProcessing(null);
    }, 1500);
  };

  return (
    <div className="space-y-3 lg:space-y-0 flex flex-col h-auto lg:h-[calc(100vh-8.5rem)]">
      
      {/* Mobil Görünüm Seçici Sekmeleri (Sadece < lg ekranlarda) */}
      <div className="lg:hidden flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab("queue")}
          className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "queue"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Bekleyenler ({contents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab("editor")}
          className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "editor"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Edit className="w-3.5 h-3.5 text-primary" />
          <span>Editör</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "preview"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5 text-[#164E7A]" />
          <span>Önizleme</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 overflow-hidden">
        
        {/* SOL: İçerik Listesi (Master) */}
        <Card className={`w-full lg:w-1/3 xl:w-1/4 flex-col bg-card border-border/80 shadow-xs overflow-hidden ${
          mobileTab === "queue" ? "flex h-[75vh] lg:h-auto" : "hidden lg:flex"
        }`}>
          <div className="p-3.5 sm:p-4 border-b border-border/70 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-foreground">Bekleyen İçerikler</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {contents.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input type="text" placeholder="İçerik başlığı ara..." className="pl-9 h-9 bg-background border-border/80 text-xs focus-visible:ring-primary" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {contents.map(c => (
              <div 
                key={c.id} 
                onClick={() => {
                  setSelectedId(c.id);
                  setMobileTab("editor");
                }}
                className={`p-3.5 sm:p-4 cursor-pointer transition-colors ${selectedId === c.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent hover:bg-muted/30'}`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    c.status === 'READY_TO_PUBLISH' 
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20' 
                      : 'bg-muted text-muted-foreground border border-border/80'
                  }`}>
                    {c.status === 'READY_TO_PUBLISH' ? 'Yayına Hazır' : 'Taslak'}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    AI: <strong className="text-foreground">{c.qualityScore || 0}</strong>
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">{c.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.sourceNews?.title}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* SAĞ: Editör ve Önizleme (Detail) */}
        {selectedContent && (
          <div className={`flex-1 flex-col xl:flex-row gap-4 lg:gap-6 min-h-0 overflow-hidden ${
            mobileTab !== "queue" ? "flex" : "hidden lg:flex"
          }`}>
            
            {/* Editör Alanı */}
            <Card className={`flex-1 flex-col border-border/80 bg-card shadow-xs overflow-hidden ${
              mobileTab === "editor" ? "flex" : "hidden xl:flex"
            }`}>
              <CardHeader className="pb-3 border-b border-border/70 bg-muted/20 p-3.5 sm:p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <CardTitle className="text-sm sm:text-base font-bold text-foreground">Metin Düzenleyici</CardTitle>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                        Canlı Editör
                      </span>
                    </div>
                    <CardDescription className="text-xs flex items-center gap-1 text-muted-foreground">
                      Orijinal Kaynak: 
                      <a href={selectedContent.sourceNews?.url} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline flex items-center">
                        Haber Bağlantısı <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </CardDescription>
                  </div>

                  {/* Canlı İtibar & Risk Radarı Rozeti */}
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${riskAnalysis.badgeColor}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Risk: %{100 - riskAnalysis.score}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-3.5 p-3.5 sm:p-5 overflow-y-auto">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Başlık</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const variants = EngagementEngine.generateABHeadlines(localTitle);
                        setAbVariants(variants);
                        setShowAbModal(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <SplitSquareVertical className="w-3 h-3" />
                      A/B Başlık Öner (3 Varyasyon)
                    </button>
                  </div>
                  <Input 
                    value={localTitle} 
                    onChange={(e) => setLocalTitle(e.target.value)} 
                    className="font-semibold text-foreground border-border/80 focus-visible:ring-primary h-10 text-sm" 
                    placeholder="Haber başlığı..."
                  />
                </div>
                
                <div className="space-y-1.5 flex-1 flex flex-col min-h-[160px]">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gönderi Metni (Facebook Post)</label>
                    <span className={`text-xs font-medium ${localBody.length > 2000 ? 'text-rose-600 font-bold' : 'text-muted-foreground'}`}>
                      {localBody.length} / 2200
                    </span>
                  </div>
                  <Textarea 
                    value={localBody} 
                    onChange={(e) => setLocalBody(e.target.value)}
                    className="flex-1 min-h-[160px] sm:min-h-[200px] resize-none text-sm font-sans leading-relaxed border-border/80 focus-visible:ring-primary"
                    placeholder="İçeriğinizi buraya yazın..."
                  />
                </div>

                {/* AI Araç Kutusu (Mobilde 2 Kolon Grid, Masaüstünde Flex) */}
                <div className="bg-primary/5 border border-primary/15 p-3 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center text-xs font-bold text-primary">
                    <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
                    Topluluk & Algoritma Araçları:
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-2.5 text-xs bg-card hover:bg-muted border-border/80 text-foreground justify-start sm:justify-center" 
                      onClick={() => {
                        const cta = EngagementEngine.generateEngagementCTA(localTitle, localBody);
                        setLocalBody(prev => prev.trim() + "\n\n" + cta);
                        toast.success("Etkileşim sorusu metnin sonuna eklendi!");
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-blue-500 shrink-0" />
                      <span className="truncate">Soru Ekle (CTA)</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-2.5 text-xs bg-card hover:bg-muted border-border/80 text-foreground justify-start sm:justify-center" 
                      onClick={() => {
                        const variants = EngagementEngine.generateABHeadlines(localTitle);
                        setAbVariants(variants);
                        setShowAbModal(true);
                      }}
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5 mr-1.5 text-purple-500 shrink-0" />
                      <span className="truncate">A/B Başlık Testi</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-2.5 text-xs bg-card hover:bg-muted border-border/80 text-foreground justify-start sm:justify-center" 
                      onClick={() => setShowReelModal(true)}
                    >
                      <Film className="w-3.5 h-3.5 mr-1.5 text-rose-500 shrink-0" />
                      <span className="truncate">Reels Senaryosu</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="col-span-2 sm:col-span-1 h-9 px-3 text-xs bg-[#00C4CC]/10 hover:bg-[#00C4CC]/20 border-[#00C4CC]/40 text-[#00C4CC] font-bold shadow-xs flex items-center justify-center gap-1.5" 
                      onClick={() => setShowCanvaModal(true)}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>⚡ Canva ile Otomatik Tasarla (%100 AI)</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-2.5 text-xs bg-card hover:bg-muted border-border/80 justify-start sm:justify-center" 
                      onClick={() => handleAIAction("shorten")} 
                      disabled={isProcessing !== null}
                    >
                      {isProcessing === "shorten" ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5 mr-1.5 text-amber-500 shrink-0" />}
                      <span>Kısalt</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
              
              {/* Sabit/Erişilebilir Eylem Çubuğu */}
              <CardFooter className="border-t border-border/70 p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 bg-muted/10 shrink-0">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 text-xs font-medium h-10 px-3" 
                    onClick={handleDelete} 
                    disabled={isSaving}
                  >
                    <Trash className="w-3.5 h-3.5 mr-1.5" /> Sil
                  </Button>

                  {/* Mobilde Önizlemeye Hızlı Geçiş */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="xl:hidden h-10 text-xs font-bold border-[#164E7A]/40 text-[#164E7A] hover:bg-[#164E7A]/10 px-3"
                    onClick={() => setMobileTab("preview")}
                  >
                    <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" /> Önizlemeye Bak
                  </Button>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 sm:flex-initial h-10 text-xs font-medium border-border/80"
                    onClick={() => handleSave()} 
                    disabled={isSaving || isPublishing}
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Taslak Kaydet
                  </Button>
                  {selectedContent.status !== 'READY_TO_PUBLISH' && (
                    <Button 
                      size="sm"
                      className="flex-1 sm:flex-initial h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" 
                      onClick={() => handleSave('READY_TO_PUBLISH')} 
                      disabled={isSaving || isPublishing}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      Onayla & Sırala
                    </Button>
                  )}
                  <Button 
                    size="sm"
                    className="w-full sm:w-auto h-10 text-xs font-bold bg-[#164E7A] hover:bg-[#123E62] text-white shadow-xs" 
                    onClick={handleDirectPublish} 
                    disabled={isSaving || isPublishing}
                  >
                    {isPublishing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    Direkt Yayınla
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Facebook Önizleme Alanı */}
            <Card className={`w-full xl:w-[410px] border-border/80 bg-card shadow-xs flex-col shrink-0 overflow-hidden ${
              mobileTab === "preview" ? "flex" : "hidden xl:flex"
            }`}>
              <CardHeader className="pb-3 border-b border-border/70 p-3.5 sm:p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center text-foreground">
                    <LayoutTemplate className="w-4 h-4 mr-2 text-[#164E7A]" />
                    Facebook Önizleme
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="xl:hidden h-8 text-xs font-bold text-primary hover:bg-primary/10"
                      onClick={() => setMobileTab("editor")}
                    >
                      ← Editöre Dön
                    </Button>
                    <span className="text-[10px] font-semibold text-muted-foreground hidden sm:inline">Canlı Görünüm</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-3.5 sm:p-4 bg-muted/30 flex justify-center items-start overflow-y-auto">
                {/* Authentic Facebook Post UI */}
                <div className="bg-card border border-border/80 rounded-xl shadow-sm w-full overflow-hidden text-left">
                  <div className="p-3 sm:p-3.5 flex items-center justify-between border-b border-border/40">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-amber-500/40 p-0.5 flex items-center justify-center shadow-xs overflow-hidden bg-white">
                        <img src={BORDOMAVI_BRAND_LOGO_DATA_URI} alt="BordoMavi" className="w-full h-full object-contain rounded-full" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[13px] sm:text-[14px] leading-tight text-foreground">Bordo Mavi AI</span>
                          <svg className="w-3.5 h-3.5 text-blue-500 fill-current" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          Şimdi <Globe className="w-3 h-3 ml-0.5 opacity-70" />
                        </div>
                      </div>
                    </div>
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                  </div>
                  
                  <div className="px-3.5 py-3 text-[13px] text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {localBody || <span className="text-muted-foreground italic text-xs">Gönderi metni buraya gelecektir...</span>}
                  </div>

                  {/* Dynamic Visual Preview */}
                  <div className="w-full aspect-video bg-muted border-y border-border/60 overflow-hidden relative group">
                    {selectedId && customVisuals[selectedId] ? (
                      <>
                        <img
                          src={customVisuals[selectedId]}
                          alt="AI Canva Design Preview"
                          className="object-contain w-full h-full bg-slate-950"
                        />
                        <div className="absolute top-2 left-2 z-10">
                          <span className="text-[10px] font-bold bg-emerald-600/95 text-white px-2 py-0.5 rounded-md shadow-md flex items-center gap-1.5 border border-emerald-400/30 backdrop-blur-xs">
                            <CheckCircle className="w-3 h-3 text-emerald-200" /> %100 AI Canva Tasarımı Aktif
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={`/api/og?title=${encodeURIComponent(localTitle)}&template=${detectCategory(localTitle, localBody)}${selectedContent?.sourceNews?.imageUrl ? `&imageUrl=${encodeURIComponent(selectedContent.sourceNews.imageUrl)}` : ''}`}
                          alt="Preview"
                          className="object-cover w-full h-full"
                        />
                        <div className="absolute top-2 right-2 z-10">
                          <span className="text-[10px] font-bold bg-black/75 text-amber-300 px-2 py-0.5 rounded-md shadow-md flex items-center gap-1 border border-amber-500/40 backdrop-blur-xs">
                            <span>★</span> Orijinal Logo Aktif
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="px-3.5 py-2 border-b border-border/60 flex justify-between items-center text-muted-foreground text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xs">
                        <ThumbsUp className="w-2.5 h-2.5" />
                      </div>
                      <span className="font-medium text-foreground/80">Sen ve 134 diğer kişi</span>
                    </div>
                    <div className="flex gap-2.5">
                      <span>12 Yorum</span>
                      <span>5 Paylaşım</span>
                    </div>
                  </div>

                  <div className="px-2 py-1 flex justify-between items-center text-muted-foreground">
                    <div className="flex-1 flex justify-center items-center font-semibold text-[12px] h-8 hover:bg-muted/80 rounded-md cursor-pointer transition-colors">
                      <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Beğen
                    </div>
                    <div className="flex-1 flex justify-center items-center font-semibold text-[12px] h-8 hover:bg-muted/80 rounded-md cursor-pointer transition-colors">
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Yorum Yap
                    </div>
                    <div className="flex-1 flex justify-center items-center font-semibold text-[12px] h-8 hover:bg-muted/80 rounded-md cursor-pointer transition-colors">
                      <Share2 className="w-3.5 h-3.5 mr-1.5" /> Paylaş
                    </div>
                  </div>

                  {/* Canva Otomatik Tasarla Hızlı Eylemi */}
                  <div className="p-3 border-t border-border/60 bg-muted/20">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full text-xs font-bold border-[#00C4CC]/40 text-[#00C4CC] hover:bg-[#00C4CC]/10 flex items-center justify-center gap-2 h-10 shadow-xs"
                      onClick={() => setShowCanvaModal(true)}
                    >
                      <Palette className="w-4 h-4 text-[#00C4CC]" />
                      🎨 Bu Gönderiyi Canva ile Otomatik Tasarla
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

      </div>

      {/* A/B Başlık Seçim Modalı */}
      {showAbModal && abVariants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/90 rounded-2xl p-6 shadow-2xl max-w-xl w-full space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <SplitSquareVertical className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">A/B Başlık Testi & Önerileri</h3>
              </div>
              <button 
                onClick={() => setShowAbModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Facebook algoritmasında daha yüksek tıklama ve paylaşım almak için yapay zeka tarafından üretilen 3 farklı başlık açısı:
            </p>

            <div className="space-y-3">
              {abVariants.map((variant) => (
                <div 
                  key={variant.type}
                  className="p-3.5 rounded-xl border border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{variant.label}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {variant.badge}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground/90 leading-snug">{variant.headline}</p>
                  <p className="text-[11px] text-muted-foreground">{variant.reason}</p>
                  <div className="pt-1 flex justify-end">
                    <Button 
                      size="sm" 
                      className="h-7 text-xs bg-[#781324] hover:bg-[#5e0e1c] text-white"
                      onClick={() => {
                        setLocalTitle(variant.headline);
                        setShowAbModal(false);
                        toast.success(`"${variant.label}" başlığı seçildi!`);
                      }}
                    >
                      Bu Başlığı Uygula
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reels / Video Senaryosu Modalı */}
      {showReelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/90 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-base text-foreground">15 Saniyelik Reels / Shorts Senaryosu</h3>
              </div>
              <button 
                onClick={() => setShowReelModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <span className="font-bold text-primary block mb-0.5">🎬 Sahne 1: Kanca / Dikkat Çekme (0-3 sn)</span>
                <p className="text-muted-foreground italic">"Trabzonspor'da yer yerinden oynuyor! İşte son dakika bombası..."</p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <span className="font-bold text-foreground block mb-0.5">⚡ Sahne 2: Gelişme & Detay (3-8 sn)</span>
                <p className="text-muted-foreground italic">{localTitle.substring(0, 90)}...</p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <span className="font-bold text-foreground block mb-0.5">🔥 Sahne 3: Perde Arkası (8-12 sn)</span>
                <p className="text-muted-foreground italic">{localBody.substring(0, 110)}...</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-bold text-emerald-600 block mb-0.5">📢 Sahne 4: Eylem Çağrısı (12-15 sn)</span>
                <p className="text-muted-foreground italic">"Sizce bu karar doğru mu? Yorumlarda buluşalım, takipte kalın!"</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`Sahne 1 (0-3s): "Trabzonspor'da flaş gelişme!"\nSahne 2 (3-8s): ${localTitle}\nSahne 3 (8-12s): ${localBody}\nSahne 4 (12-15s): Yorumlarda buluşalım!`);
                  toast.success("Reels senaryosu panoya kopyalandı!");
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Senaryoyu Kopyala
              </Button>
              <Button 
                size="sm" 
                className="bg-[#781324] hover:bg-[#5e0e1c] text-white"
                onClick={() => setShowReelModal(false)}
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Canva Tasarım Stüdyosu Modalı */}
      <CanvaStudioModal
        isOpen={showCanvaModal}
        onClose={() => setShowCanvaModal(false)}
        initialTitle={localTitle}
        initialSubtitle={localBody ? localBody.slice(0, 120) : "Trabzonspor flaş gündem"}
        initialBody={localBody}
        initialCategory={detectCategory(localTitle, localBody) as any}
        onApplyDesign={handleApplyCanvaDesign}
      />

      {/* Facebook Gruplarında Toplu Paylaşım Asistanı Modalı */}
      <FacebookGroupShareModal
        isOpen={!!groupSharePost}
        onClose={() => setGroupSharePost(null)}
        post={groupSharePost}
      />
    </div>
  );
}
