"use client";

import { useState, useEffect } from "react";
import { 
  Save, Send, Trash, Wand2, Sparkles, Scissors, Zap, 
  LayoutTemplate, Globe, MoreHorizontal, ThumbsUp, MessageCircle, Share2, 
  Loader2, CheckCircle, Search, ExternalLink, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveContentAction, deleteContentAction, publishContentDirectlyAction } from "./actions";

export default function EditorClient({ initialContents }: { initialContents: any[] }) {
  const [contents, setContents] = useState(initialContents);
  const [selectedId, setSelectedId] = useState<string | null>(initialContents.length > 0 ? initialContents[0].id : null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const selectedContent = contents.find(c => c.id === selectedId);

  // Local edits for the selected content
  const [localTitle, setLocalTitle] = useState("");
  const [localBody, setLocalBody] = useState("");

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
      const res = await publishContentDirectlyAction(selectedContent.id, {
        title: selectedContent.title,
        body: selectedContent.body
      });
      
      if (res.success) {
        toast.success(`İçerik anında Facebook'ta yayınlandı! ${res.mockMode ? '(Mock Mode)' : ''}`);
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
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[620px]">
      
      {/* SOL: İçerik Listesi (Master) */}
      <Card className="w-full lg:w-1/3 xl:w-1/4 flex flex-col bg-card border-border/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/70 bg-muted/20">
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
              onClick={() => setSelectedId(c.id)}
              className={`p-4 cursor-pointer transition-colors ${selectedId === c.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent hover:bg-muted/30'}`}
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
        <div className="flex-1 flex flex-col xl:flex-row gap-6 overflow-hidden">
          
          {/* Editör Alanı */}
          <Card className="flex-1 flex flex-col border-border/80 bg-card shadow-xs overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/70 bg-muted/20">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <CardTitle className="text-base font-bold text-foreground">Metin Düzenleyici</CardTitle>
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
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Başlık</label>
                <Input 
                  value={localTitle} 
                  onChange={(e) => setLocalTitle(e.target.value)} 
                  className="font-semibold text-foreground border-border/80 focus-visible:ring-primary h-10" 
                  placeholder="Haber başlığı..."
                />
              </div>
              
              <div className="space-y-1.5 flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gönderi Metni (Facebook Post)</label>
                  <span className={`text-xs font-medium ${localBody.length > 2000 ? 'text-rose-600 font-bold' : 'text-muted-foreground'}`}>
                    {localBody.length} / 2200 karakter
                  </span>
                </div>
                <Textarea 
                  value={localBody} 
                  onChange={(e) => setLocalBody(e.target.value)}
                  className="flex-1 min-h-[220px] resize-none text-sm font-sans leading-relaxed border-border/80 focus-visible:ring-primary"
                  placeholder="İçeriğinizi buraya yazın..."
                />
              </div>

              {/* AI Araç Kutusu */}
              <div className="bg-primary/5 border border-primary/15 p-3 rounded-xl flex flex-wrap gap-2 items-center">
                <div className="flex items-center text-xs font-bold text-primary mr-2">
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  AI Yardımcıları:
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 text-xs bg-card hover:bg-muted border-border/80" 
                  onClick={() => handleAIAction("shorten")} 
                  disabled={isProcessing !== null}
                >
                  {isProcessing === "shorten" ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5 mr-1.5 text-amber-500" />}
                  Kısalt
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 text-xs bg-card hover:bg-muted border-border/80" 
                  onClick={() => handleAIAction("enhance")} 
                  disabled={isProcessing !== null}
                >
                  {isProcessing === "enhance" ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />}
                  Güçlendir (Harekete Geçirici Mesaj Ekle)
                </Button>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-border/70 p-4 flex flex-wrap justify-between items-center gap-3 bg-muted/10">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 text-xs font-medium" 
                onClick={handleDelete} 
                disabled={isSaving}
              >
                <Trash className="w-3.5 h-3.5 mr-1.5" /> İçeriği Sil
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-9 text-xs font-medium border-border/80"
                  onClick={() => handleSave()} 
                  disabled={isSaving || isPublishing}
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Taslağı Kaydet
                </Button>
                {selectedContent.status !== 'READY_TO_PUBLISH' && (
                  <Button 
                    size="sm"
                    className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" 
                    onClick={() => handleSave('READY_TO_PUBLISH')} 
                    disabled={isSaving || isPublishing}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    Onayla & Sıraya Al
                  </Button>
                )}
                <Button 
                  size="sm"
                  className="h-9 text-xs font-semibold bg-[#164E7A] hover:bg-[#123E62] text-white shadow-xs" 
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
          <Card className="w-full xl:w-[410px] border-border/80 bg-card shadow-xs flex flex-col shrink-0 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/70 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center text-foreground">
                  <LayoutTemplate className="w-4 h-4 mr-2 text-[#164E7A]" />
                  Facebook Önizleme
                </CardTitle>
                <span className="text-[10px] font-semibold text-muted-foreground">Canlı Görünüm</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 bg-muted/30 flex justify-center items-start overflow-y-auto">
              {/* Authentic Facebook Post UI */}
              <div className="bg-card border border-border/80 rounded-xl shadow-sm w-full overflow-hidden text-left">
                <div className="p-3.5 flex items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#164E7A] p-0.5 flex items-center justify-center shadow-xs">
                      <div className="w-full h-full rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs">
                        BM
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[14px] leading-tight text-foreground">Bordo Mavi AI</span>
                        <svg className="w-3.5 h-3.5 text-blue-500 fill-current" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        Şimdi <Globe className="w-3 h-3 ml-0.5 opacity-70" />
                      </div>
                    </div>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                </div>
                
                <div className="px-3.5 py-3 text-[13px] text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {localBody || <span className="text-muted-foreground italic text-xs">Gönderi metni buraya gelecektir...</span>}
                </div>

                {/* Dynamic OG Image Preview */}
                <div className="w-full aspect-video bg-muted border-y border-border/60 overflow-hidden relative">
                   <img
                      src={`/api/og?title=${encodeURIComponent(localTitle)}`}
                      alt="Preview"
                      className="object-cover w-full h-full"
                    />
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
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
