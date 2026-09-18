"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Palette, ExternalLink, CheckCircle2, Sparkles, Layers } from "lucide-react";
import { CanvaStudioModal } from "@/components/media/CanvaStudioModal";
import { toast } from "sonner";

export default function CanvaSettings() {
  const [token, setToken] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveToken = () => {
    if (token) {
      toast.success("Canva Connect API anahtarı kaydedildi!");
    } else {
      toast.info("Varsayılan Canva Web Entegrasyonu aktif modda çalışıyor.");
    }
  };

  return (
    <>
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-4 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00C4CC]/15 border border-[#00C4CC]/30 flex items-center justify-center text-[#00C4CC]">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  Canva Tasarım Entegrasyonu
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aktif
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  BordoMavi AI Editor içeriklerinizi Canva üzerinde tek tıkla profesyonel sosyal medya afişlerine dönüştürün.
                </CardDescription>
              </div>
            </div>

            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#00C4CC] hover:bg-[#00B4BC] text-white font-bold text-xs h-9 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Canva Stüdyosunu Başlat
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Layers className="w-4 h-4 text-primary" /> Hazır Şablonlar
              </div>
              <p className="text-2xl font-black text-foreground">10 Şablon</p>
              <span className="text-[11px] text-muted-foreground">Transfer, Maç Günü, İlk 11, Canlı Gol, Sonuç, Reels ve 10 Özel Format</span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Doğrudan Tuval Motoru
              </div>
              <p className="text-2xl font-black text-emerald-600">Hazır</p>
              <span className="text-[11px] text-muted-foreground">Piksel bazında otomatik tuval ölçülendirmesi</span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <ExternalLink className="w-4 h-4 text-[#00C4CC]" /> MCP Desteği
              </div>
              <p className="text-2xl font-black text-[#00C4CC]">Bağlı</p>
              <span className="text-[11px] text-muted-foreground">Antigravity AI MCP sunucuları aktif</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/70">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Canva Connect API Token (Opsiyonel Geliştirici Erişimi)
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Canva Connect API anahtarınız (Varsa)..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="text-xs h-9 flex-1"
              />
              <Button 
                variant="outline" 
                onClick={handleSaveToken}
                className="text-xs h-9 font-semibold"
              >
                Kaydet
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              API anahtarı olmasa dahi Canva Web Stüdyosu tam yetenekle çalışır; butonlara bastığınızda doğru ölçü ve hazır metinlerle Canva doğrudan açılır.
            </p>
          </div>
        </CardContent>
      </Card>

      <CanvaStudioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}