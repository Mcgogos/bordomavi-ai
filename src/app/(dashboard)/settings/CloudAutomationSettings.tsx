'use client';

import React, { useState } from 'react';
import { Cloud, Check, Copy, Laptop, ShieldCheck, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CloudAutomationSettings() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = "https://bordomavi-ai.vercel.app/api/cron/sync-news?secret=test_secret";

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border/80 rounded-xl p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Bulut & Web Otomasyonu (7/24)
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Bilgisayardan Bağımsız
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bilgisayarınız açık olmadan haberlerin toplanması, analiz edilmesi ve Facebook’a yayınlanmasını sağlayan bulut yapılandırması.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Yerel Windows Görevi: Devre Dışı
          </span>
        </div>
      </div>

      {/* Durum Bilgilendirme Kutuları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Web Sitesi Üzerinden */}
        <div className="p-4 rounded-lg border border-border/70 bg-muted/20 space-y-2">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
            <RefreshCw className="w-4 h-4 text-primary" />
            <span>Web Sitesi & Dashboard Kalp Atışı</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Siz veya herhangi bir editör web sitesini açık tuttuğu sürece, sistem arka planda her 10 dakikada bir otomatik senkronizasyon ve yayın kontrolü gerçekleştirir.
          </p>
        </div>

        {/* GitHub Cloud Actions */}
        <div className="p-4 rounded-lg border border-border/70 bg-muted/20 space-y-2">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>GitHub Actions Bulut Otomasyonu (7/24)</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Bilgisayarınız ve web siteniz tamamen kapalıyken bile, GitHub Actions bulut iş parçacığı her 30 dakikada bir otonom olarak devreye girip haberleri işler.
          </p>
        </div>
      </div>

      {/* Webhook Endpoint */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Doğrudan Bulut Tetikleme (Webhook) Adresi</span>
          <span className="text-[11px] font-normal text-muted-foreground">GET veya POST destekler</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="flex-1 bg-muted/50 border border-border text-foreground text-xs px-3 py-2 rounded-lg font-mono focus:outline-none select-all"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kopyala</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dış Servis Entegrasyon Notu */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-900 dark:text-sky-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
        <div className="space-y-1">
          <p className="font-semibold">Alternatif Harici Bulut Zamanlayıcılar (İsteğe Bağlı):</p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Dilerseniz tamamen ücretsiz olan <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="underline font-medium text-foreground inline-flex items-center gap-0.5">cron-job.org <ExternalLink className="w-2.5 h-2.5" /></a> veya UptimeRobot gibi servislerde yukarıdaki Webhook adresini tanımlayarak her 10-15 dakikada bir harici tetikleme sağlayabilirsiniz. Bilgisayarınızın açık kalmasına hiçbir şekilde gerek yoktur.
          </p>
        </div>
      </div>
    </div>
  );
}
