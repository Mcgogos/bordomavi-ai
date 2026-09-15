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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-blue-600" />
          Facebook Entegrasyonu (OAuth 2.0)
        </CardTitle>
        <CardDescription>
          BordoMavi AI, haberleri Facebook Sayfanızda paylaşmak için yetkiye ihtiyaç duyar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Durum kontrol ediliyor...</p>
        ) : status?.isConnected ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Bağlantı Başarılı</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 opacity-80">
                  Sayfa: {status.pageName} (ID: {status.pageId})
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleConnect}>
              Yeniden Bağlan
            </Button>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400">Bağlı Değil (veya Süresi Dolmuş)</p>
                <p className="text-sm text-amber-600 dark:text-amber-500 opacity-80">
                  Otomatik paylaşım yapabilmek için Facebook ile giriş yapın.
                </p>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConnect}>
              Facebook ile Giriş Yap
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-4">
          Not: 60 günlük token kısıtlamasından etkilenmemek için bu entegrasyon "Uzun Ömürlü (Long-lived)" Page Access Token kullanır. Sistem, yetkili sayfalara erişip token'ı arka planda otomatik yeniler.
        </div>
      </CardContent>
    </Card>
  );
}