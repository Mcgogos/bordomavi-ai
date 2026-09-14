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
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab("generated")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeTab === "generated" ? "bg-background text-foreground shadow-sm" : ""}`}
          >
            AI Görselleri (OG)
          </button>
          <button 
            onClick={() => setActiveTab("uploaded")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeTab === "uploaded" ? "bg-background text-foreground shadow-sm" : ""}`}
          >
            Yüklenenler
          </button>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" /> Yeni Yükle
        </Button>
      </div>

      {activeTab === "generated" && (
        <div className="mt-6">
          {generatedImages.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-20" />
              <h3 className="text-lg font-medium text-muted-foreground">Henüz görsel üretilmemiş</h3>
              <p className="text-sm text-muted-foreground mt-1">İçerik Merkezinde yapay zeka tarafından içerik üretildikçe bu galeri dolacaktır.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {generatedImages.map((img) => (
                <Card key={img.id} className="overflow-hidden group border-border">
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    <img
                      src={`/api/og?title=${encodeURIComponent(img.title)}`}
                      alt={img.title}
                      className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      {img.status === "PUBLISHED" ? (
                        <Badge className="bg-green-500">Yayında</Badge>
                      ) : (
                        <Badge className="bg-blue-500">{img.status}</Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-sm line-clamp-2 leading-tight" title={img.title}>
                      {img.title}
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(img.createdAt)}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Yeni Sekmede Aç" onClick={() => window.open(`/api/og?title=${encodeURIComponent(img.title)}`, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
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
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-20" />
              <h3 className="text-lg font-medium text-muted-foreground">Yüklenen medya bulunamadı</h3>
              <p className="text-sm text-muted-foreground mt-1">Sisteme henüz manuel bir fotoğraf veya video yüklenmemiş.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {dbMedia.map((media) => (
                <Card key={media.id} className="overflow-hidden group">
                  <div className="relative aspect-square bg-muted">
                    <img
                      src={media.url}
                      alt="Media"
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground truncate">{media.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(media.createdAt)}</p>
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
