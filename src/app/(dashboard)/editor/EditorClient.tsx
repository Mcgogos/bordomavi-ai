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
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
      
      {/* SOL: İçerik Listesi (Master) */}
      <Card className="w-full lg:w-1/3 xl:w-1/4 flex flex-col bg-card border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="font-semibold mb-2">Bekleyen İçerikler ({contents.length})</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="İçerik ara..." className="pl-9 bg-background text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contents.map(c => (
            <div 
              key={c.id} 
              onClick={() => setSelectedId(c.id)}
              className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${selectedId === c.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <Badge variant={c.status === 'READY_TO_PUBLISH' ? 'default' : 'secondary'} className="text-[10px]">
                  {c.status === 'READY_TO_PUBLISH' ? 'Onaylandı' : c.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">AI: {c.qualityScore || 0}</span>
              </div>
              <h4 className="font-medium text-sm line-clamp-2 leading-tight">{c.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.sourceNews?.title}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* SAĞ: Editör ve Önizleme (Detail) */}
      {selectedContent && (
        <div className="flex-1 flex flex-col xl:flex-row gap-6 overflow-hidden">
          
          {/* Editör Alanı */}
          <Card className="flex-1 flex flex-col border-border bg-card overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Metin Düzenleyici</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-1">
                    Kaynak: 
                    <a href={selectedContent.sourceNews?.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center">
                      Haber Linki <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium">Başlık</label>
                <Input value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} className="font-semibold" />
              </div>
              
              <div className="space-y-2 flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Gönderi Metni (Body)</label>
                  <span className={`text-xs ${localBody.length > 2200 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                    {localBody.length} / 2200 karakter
                  </span>
                </div>
                <Textarea 
                  value={localBody} 
                  onChange={(e) => setLocalBody(e.target.value)}
                  className="flex-1 min-h-[250px] resize-none text-base font-sans"
                  placeholder="İçeriğinizi buraya yazın..."
                />
              </div>

              {/* AI Araç Kutusu */}
              <div className="bg-secondary/30 border border-secondary p-3 rounded-md flex flex-wrap gap-2 items-center">
                <div className="flex items-center text-sm font-medium text-primary mr-2">
                  <Sparkles className="w-4 h-4 mr-1" />
                  AI Araçları:
                </div>
                <Button variant="outline" size="sm" onClick={() => handleAIAction("shorten")} disabled={isProcessing !== null}>
                  {isProcessing === "shorten" ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Scissors className="w-3 h-3 mr-2 text-yellow-500" />}
                  Kısalt
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAIAction("enhance")} disabled={isProcessing !== null}>
                  {isProcessing === "enhance" ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Zap className="w-3 h-3 mr-2 text-green-500" />}
                  Güçlendir (Harekete Geçirici Mesaj Ekle)
                </Button>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-border/50 p-4 flex justify-between bg-muted/10">
              <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={handleDelete} disabled={isSaving}>
                <Trash className="w-4 h-4 mr-2" /> Sil
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave()} disabled={isSaving || isPublishing}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Değişiklikleri Kaydet
                </Button>
                {selectedContent.status !== 'READY_TO_PUBLISH' && (
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSave('READY_TO_PUBLISH')} disabled={isSaving || isPublishing}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Onayla & Yayın Sırasına Al
                  </Button>
                )}
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDirectPublish} disabled={isSaving || isPublishing}>
                  {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Direkt Yayınla
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Facebook Önizleme Alanı */}
          <Card className="w-full xl:w-[400px] border-border bg-card flex flex-col shrink-0">
            <CardHeader className="pb-3 border-b border-border/50 p-4">
              <CardTitle className="text-md flex items-center">
                <LayoutTemplate className="w-4 h-4 mr-2 text-muted-foreground" />
                Facebook Önizleme
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 bg-muted/20 flex justify-center items-start overflow-y-auto">
              {/* Fake Facebook Post UI */}
              <div className="bg-card border border-border rounded-lg shadow-sm w-full overflow-hidden text-left">
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#082a5c] flex items-center justify-center font-bold text-white text-xs">
                      BM
                    </div>
                    <div>
                      <div className="font-bold text-[14px] leading-tight text-foreground">Bordo Mavi</div>
                      <div className="text-[12px] text-muted-foreground flex items-center gap-1">
                        Şimdi <Globe className="w-3 h-3 ml-1" />
                      </div>
                    </div>
                  </div>
                  <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                </div>
                
                <div className="px-3 pb-3 text-[14px] whitespace-pre-wrap break-words leading-snug">
                  {localBody || <span className="text-muted-foreground italic">Gönderi metni...</span>}
                </div>

                {/* Dynamic OG Image Preview */}
                <div className="w-full aspect-video bg-muted border-y border-border overflow-hidden">
                   <img
                      src={`/api/og?title=${encodeURIComponent(localTitle)}`}
                      alt="Preview"
                      className="object-cover w-full h-full"
                    />
                </div>

                <div className="p-2 border-b border-border flex justify-between items-center text-muted-foreground text-[12px]">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white"><ThumbsUp className="w-2.5 h-2.5" /></div>
                    <span>Sen ve 134 diğer kişi</span>
                  </div>
                  <div className="flex gap-2">
                    <span>12 Yorum</span>
                  </div>
                </div>

                <div className="px-2 py-1 flex justify-between items-center text-muted-foreground">
                  <div className="flex-1 flex justify-center items-center font-semibold text-[13px] h-8 hover:bg-muted rounded cursor-pointer">
                    <ThumbsUp className="w-4 h-4 mr-2" /> Beğen
                  </div>
                  <div className="flex-1 flex justify-center items-center font-semibold text-[13px] h-8 hover:bg-muted rounded cursor-pointer">
                    <MessageCircle className="w-4 h-4 mr-2" /> Yorum Yap
                  </div>
                  <div className="flex-1 flex justify-center items-center font-semibold text-[13px] h-8 hover:bg-muted rounded cursor-pointer">
                    <Share2 className="w-4 h-4 mr-2" /> Paylaş
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
