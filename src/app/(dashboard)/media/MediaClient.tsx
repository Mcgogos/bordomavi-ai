"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, ExternalLink, Film, Play, Sparkles, Filter } from "lucide-react";
import { ReelStudioModal } from "@/components/media/ReelStudioModal";

export default function MediaClient({ dbMedia, generatedImages }: { dbMedia: any[], generatedImages: any[] }) {
  const [activeTab, setActiveTab] = useState<"generated" | "uploaded">("generated");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("ALL");
  
  // Reel Studio Modal State
  const [reelModalOpen, setReelModalOpen] = useState(false);
  const [activeReel, setActiveReel] = useState<{ title: string; imageUrl?: string; summary?: string }>({
    title: "Trabzonspor'da Flaş Gelişme!",
    imageUrl: "",
    summary: ""
  });

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const openReelStudio = (title: string, imageUrl?: string, summary?: string) => {
    setActiveReel({
      title,
      imageUrl: imageUrl || "",
      summary: summary || ""
    });
    setReelModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Üst Eylem ve Sekme Çubuğu */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="inline-flex h-10 items-center justify-center rounded-xl bg-muted/60 p-1 border border-border/80 text-muted-foreground w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab("generated")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none ${activeTab === "generated" ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"}`}
          >
            AI Haber Kartları (Logolu OG)
          </button>
          <button 
            onClick={() => setActiveTab("uploaded")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none ${activeTab === "uploaded" ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"}`}
          >
            Manuel Yüklenenler
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => openReelStudio(generatedImages[0]?.title || "Trabzonspor'da Son Dakika Gelişmesi!")}
            className="bg-gradient-to-r from-[#781324] to-[#164E7A] text-white hover:opacity-90 font-semibold text-xs h-9 shadow-xs"
          >
            <Film className="mr-1.5 h-4 w-4" /> AI Reels & Video Stüdyosu
          </Button>

          <Button variant="outline" className="font-semibold text-xs h-9 border-border/80">
            <Upload className="mr-2 h-4 w-4" /> Yeni Görsel
          </Button>
        </div>
      </div>

      {activeTab === "generated" && (
        <div className="mt-6 space-y-4">
          {/* Şablon Filtre Pilleri */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Şablon:
            </span>
            <button
              onClick={() => setSelectedTemplate("ALL")}
              className={`px-3 py-1 rounded-full font-semibold shrink-0 transition-colors ${selectedTemplate === "ALL" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Tüm Şablonlar ({generatedImages.length})
            </button>
            <button
              onClick={() => setSelectedTemplate("TRANSFER")}
              className={`px-3 py-1 rounded-full font-semibold shrink-0 transition-colors ${selectedTemplate === "TRANSFER" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              🔥 Transfer Ateşi
            </button>
            <button
              onClick={() => setSelectedTemplate("GOAL")}
              className={`px-3 py-1 rounded-full font-semibold shrink-0 transition-colors ${selectedTemplate === "GOAL" ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              ⚽ Canlı Gol Kartı
            </button>
            <button
              onClick={() => setSelectedTemplate("MATCH_DAY")}
              className={`px-3 py-1 rounded-full font-semibold shrink-0 transition-colors ${selectedTemplate === "MATCH_DAY" ? "bg-sky-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              🏟️ Maç Günü
            </button>
          </div>

          {generatedImages.length === 0 ? (
            <div className="text-center py-16 border border-border/80 rounded-2xl bg-card shadow-xs">
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-20" />
              <h3 className="text-base font-bold text-foreground">Henüz Üretilmiş Görsel Yok</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Haberler analiz edilip içerik üretildikçe BordoMavi logolu özel haber kartları burada sergilenecektir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {generatedImages.map((img) => {
                const queryTemplate = selectedTemplate !== "ALL" ? `&template=${selectedTemplate}` : "";
                const ogUrl = `/api/og?title=${encodeURIComponent(img.title)}${queryTemplate}`;

                return (
                  <Card key={img.id} className="overflow-hidden group border-border/80 bg-card shadow-xs hover:shadow-md transition-all">
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      <img
                        src={ogUrl}
                        alt={img.title}
                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                        {img.status === "PUBLISHED" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                            Yayında
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#164E7A] text-white shadow-xs">
                            {img.status}
                          </span>
                        )}
                      </div>

                      {/* Video Reels Hover Butonu */}
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => openReelStudio(img.title, undefined, img.body)}
                          className="h-8 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 shadow-lg"
                        >
                          <Play className="w-3.5 h-3.5 mr-1 text-[#781324]" />
                          Reels İzle
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-xs text-foreground line-clamp-2 leading-snug" title={img.title}>
                        {img.title}
                      </h3>
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatDate(img.createdAt)}</span>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                            title="Reels / 9:16 Video Stüdyosunu Aç" 
                            onClick={() => openReelStudio(img.title, undefined, img.body)}
                          >
                            <Film className="h-3.5 w-3.5 text-rose-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                            title="Büyük Görseli Aç" 
                            onClick={() => window.open(ogUrl, '_blank')}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "uploaded" && (
        <div className="mt-6">
          {dbMedia.length === 0 ? (
            <div className="text-center py-16 border border-border/80 rounded-2xl bg-card shadow-xs">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-20" />
              <h3 className="text-base font-bold text-foreground">Yüklenen Medya Bulunamadı</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Sisteme henüz manuel bir fotoğraf veya video yüklenmemiş.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {dbMedia.map((media) => (
                <Card key={media.id} className="overflow-hidden group border-border/80 shadow-xs">
                  <div className="relative aspect-square bg-muted">
                    <img
                      src={media.url}
                      alt="Media"
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-foreground truncate">{media.type}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(media.createdAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9:16 Reels Video Stüdyosu Modalı */}
      <ReelStudioModal
        isOpen={reelModalOpen}
        onClose={() => setReelModalOpen(false)}
        title={activeReel.title}
        imageUrl={activeReel.imageUrl}
        summary={activeReel.summary}
      />
    </div>
  );
}
