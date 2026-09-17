"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, ExternalLink } from "lucide-react";

export default function MediaClient({ dbMedia, generatedImages }: { dbMedia: any[], generatedImages: any[] }) {
  const [activeTab, setActiveTab] = useState<"generated" | "uploaded">("generated");

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
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
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-9 shadow-xs">
          <Upload className="mr-2 h-4 w-4" /> Yeni Görsel Yükle
        </Button>
      </div>

      {activeTab === "generated" && (
        <div className="mt-6">
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
              {generatedImages.map((img) => (
                <Card key={img.id} className="overflow-hidden group border-border/80 bg-card shadow-xs hover:shadow-md transition-shadow">
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    <img
                      src={`/api/og?title=${encodeURIComponent(img.title)}`}
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
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-xs text-foreground line-clamp-2 leading-snug" title={img.title}>
                      {img.title}
                    </h3>
                    <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatDate(img.createdAt)}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                        title="Büyük Görseli Aç" 
                        onClick={() => window.open(`/api/og?title=${encodeURIComponent(img.title)}`, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
    </div>
  );
}
