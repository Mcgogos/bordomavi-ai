"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getFacebookStatusAction } from "./actions";

export default function FacebookSettings() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const res = await getFacebookStatusAction();
      setStatus(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    // Generate a secure state parameter (optional but recommended)
    // Redirect to our internal API endpoint which handles OAuth
    window.location.href = "/api/facebook/auth";
  };

  return (
    <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
          <div className="w-8 h-8 rounded-lg bg-[#164E7A]/10 border border-[#164E7A]/20 flex items-center justify-center">
            <Share2 className="w-4 h-4 text-[#164E7A] dark:text-sky-400" />
          </div>
          Facebook / Meta Entegrasyonu (OAuth 2.0)
        </CardTitle>
        <CardDescription className="text-xs">
          BordoMavi AI, haberleri Facebook Sayfanızda otomatik paylaşmak için yetkili Page Access Token kullanır.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Bağlantı durumu kontrol ediliyor...</p>
        ) : status?.isConnected ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Facebook Sayfa Bağlantısı Aktif</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                  Bağlı Sayfa: <strong className="font-semibold">{status.pageName}</strong> (Sayfa ID: {status.pageId})
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleConnect} className="h-8 text-xs font-semibold border-border/80">
              Yeniden Bağlan / Güncelle
            </Button>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Bağlı Değil (veya Token Süresi Dolmuş)</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Otomatik paylaşım yapabilmek için Facebook hesabınızla giriş yapıp sayfayı yetkilendirin.
                </p>
              </div>
            </div>
            <Button className="bg-[#164E7A] hover:bg-[#123E62] text-white text-xs font-semibold h-8" onClick={handleConnect}>
              Facebook ile Giriş Yap
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border/60 leading-relaxed">
          <strong>Kurumsal Güvenlik Notu:</strong> Sayfa erişim jetonları (Long-lived Page Token) 60 güne kadar geçerli olup, otonom motor tarafından periyodik olarak doğrulanır ve arka planda güvenle yenilenir.
        </div>
      </CardContent>
    </Card>
  );
}