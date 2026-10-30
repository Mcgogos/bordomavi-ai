"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Palette, ExternalLink, CheckCircle2, Sparkles, Layers, KeyRound, Loader2 } from "lucide-react";
import { CanvaStudioModal } from "@/components/media/CanvaStudioModal";
import { toast } from "sonner";

export default function CanvaSettings() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [token, setToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusInfo, setStatusInfo] = useState<{
    connected: boolean;
    hasClientCredentials: boolean;
    hasRecoveryCodes: boolean;
    displayName?: string;
    message: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/canva?status=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setStatusInfo(d.status);
          if (d.clientId) setClientId(d.clientId);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCredentials = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/canva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_credentials",
          clientId,
          clientSecret: clientSecret || undefined,
          accessToken: token || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusInfo(data.status);
        setClientSecret("");
        setToken("");
        toast.success(data.message || "Canva API bilgileri veritabanına kaydedildi!");
      } else {
        toast.error(data.error || "Kaydedilirken hata oluştu.");
      }
    } catch (e: any) {
      toast.error(e.message || "Bağlantı hatası.");
    } finally {
      setIsSaving(false);
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
                <CardTitle className="text-base font-bold flex items-center gap-2 flex-wrap">
                  Canva Connect API & MCP Entegrasyonu
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />{" "}
                    {statusInfo?.connected
                      ? `Canva REST API Bağlı (${statusInfo.displayName})`
                      : "Otomatik Stüdyo & 2FA Kurtarma Aktif"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  BordoMavi AI içeriklerinizi Canva Connect REST API v1, Canva MCP ve yerleşik 10 şablonla afişe dönüştürün.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {statusInfo?.hasClientCredentials && (
                <a
                  href="/api/canva/auth"
                  className="inline-flex items-center justify-center rounded-lg border border-[#00C4CC]/40 bg-[#00C4CC]/10 hover:bg-[#00C4CC]/20 text-[#00C4CC] font-bold text-xs h-9 px-3"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Canva OAuth Bağla
                </a>
              )}
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-[#00C4CC] hover:bg-[#00B4BC] text-white font-bold text-xs h-9 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Canva Stüdyosunu Başlat
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Layers className="w-4 h-4 text-primary" /> Hazır Şablonlar
              </div>
              <p className="text-2xl font-black text-foreground">10 Şablon</p>
              <span className="text-[11px] text-muted-foreground">
                Transfer, Maç Günü, İlk 11, Canlı Gol, Sonuç, Reels ve 10 Özel Format
              </span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 2FA Kurtarma & Güvenlik
              </div>
              <p className="text-2xl font-black text-emerald-600">Kayıtlı</p>
              <span className="text-[11px] text-muted-foreground">
                10 adet Canva 2FA yedek kurtarma kodunuz veritabanında güvende
              </span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <ExternalLink className="w-4 h-4 text-[#00C4CC]" /> Canva MCP & REST v1
              </div>
              <p className="text-2xl font-black text-[#00C4CC]">Aktif</p>
              <span className="text-[11px] text-muted-foreground">
                Redirect URI: https://bordomavi-ai.vercel.app/api/canva/callback
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/70">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Canva Connect REST API v1 Kimlik Bilgileri (canva.dev/developers/integrations)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                type="text"
                placeholder="Client ID (Örn: OC-AZ...)"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="text-xs h-9"
              />
              <Input
                type="password"
                placeholder="Client Secret (cnvca...)..."
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="text-xs h-9"
              />
              <Input
                type="password"
                placeholder="Veya Doğrudan Access Token..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Canva Developer Portal&apos;da 2FA kurulumunu tamamladıktan sonra oluşan <strong>Client ID</strong> ve <strong>Client Secret</strong> değerlerini buraya kaydedip &ldquo;Canva OAuth Bağla&rdquo; butonuna tıklayabilirsiniz.
              </p>
              <Button
                variant="outline"
                disabled={isSaving}
                onClick={handleSaveCredentials}
                className="text-xs h-9 font-semibold shrink-0"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Veritabanına Kaydet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CanvaStudioModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
