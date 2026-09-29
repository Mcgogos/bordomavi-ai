'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  Cloud, RefreshCw, Send, CheckCircle2, AlertCircle, 
  Clock, Sparkles, Laptop, ShieldCheck, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncResult {
  success: boolean;
  error?: string;
  collection?: {
    sourcesProcessed?: number;
    itemsFetched?: number;
    newItems?: number;
    duplicates?: number;
    staleSkipped?: number;
  };
  analysis?: {
    requested: number;
    processed: number;
    failed: number;
  };
  generation?: {
    requested: number;
    processed: number;
    failed: number;
  };
  publish?: {
    success: boolean;
    requested: number;
    processed: number;
    failed: number;
    cooldownActive?: boolean;
    minutesSinceLastPost?: number;
    reason?: string;
    results?: Array<{
      contentId: string;
      status: string;
      facebookPostId?: string;
      error?: string;
    }>;
  };
}

export default function WebAutomationCard() {
  const [isPending, startTransition] = useTransition();
  const [forcePublish, setForcePublish] = useState(false);
  const [autoHeartbeat, setAutoHeartbeat] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [nextHeartbeatIn, setNextHeartbeatIn] = useState<number>(600); // 10 dk

  // localStorage'dan otomatik kalp atışı tercihini yükle
  useEffect(() => {
    const saved = localStorage.getItem('bm_auto_heartbeat');
    if (saved !== null) {
      setAutoHeartbeat(saved === 'true');
    }
  }, []);

  const handleToggleHeartbeat = (val: boolean) => {
    setAutoHeartbeat(val);
    localStorage.setItem('bm_auto_heartbeat', String(val));
  };

  const runSync = async (force: boolean = false) => {
    try {
      const url = `/api/cron/sync-news?secret=test_secret${force ? '&force=true' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      setLastSyncTime(new Date().toLocaleTimeString('tr-TR'));
      setNextHeartbeatIn(600);
    } catch (err: any) {
      setSyncResult({
        success: false,
        error: err.message || 'Senkronizasyon sırasında bir bağlantı hatası oluştu.'
      });
    }
  };

  const handleManualSync = () => {
    startTransition(() => {
      runSync(forcePublish);
    });
  };

  // Web Kalp Atışı (In-Browser Sync): Sayfa açıkken 10 dakikada bir otomatik çalıştırır
  useEffect(() => {
    if (!autoHeartbeat) return;

    const timer = setInterval(() => {
      setNextHeartbeatIn((prev) => {
        if (prev <= 1) {
          // Arka planda sessizce senkronize et
          runSync(false);
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoHeartbeat]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              Web & Bulut Otomasyonu
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                7/24 Bağımsız
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Bilgisayarınız kapalıyken de sistem web sitesi ve bulut üzerinden otonom yayın yapar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md border border-border/60">
            <Laptop className="w-3.5 h-3.5 text-emerald-500" />
            <span>PC Görevi: <strong className="text-foreground">Kapatıldı (Bağımsız)</strong></span>
          </div>
        </div>
      </div>

      {/* Kontroller & Aksiyon Butonu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Buton ve Zorlama */}
        <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            onClick={handleManualSync}
            disabled={isPending}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 px-4 flex items-center justify-center gap-2 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Senkronizasyon Yürütülüyor...' : 'Şimdi Web’den Eşitle & Yayınla'}
          </Button>

          <label className="flex items-center gap-2 cursor-pointer text-xs select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={forcePublish}
              onChange={(e) => setForcePublish(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span>Zorla Yayınla <span className="text-[10px] text-muted-foreground">(2 saatlik bekleme süresini atla)</span></span>
          </label>
        </div>

        {/* Web Kalp Atışı (In-Browser Cron) */}
        <div className="flex items-center justify-between md:justify-end gap-3 text-xs bg-muted/30 p-2 rounded-lg border border-border/50">
          <div className="flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${autoHeartbeat ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <span className="font-medium text-muted-foreground">Web Kalp Atışı:</span>
            <span className="font-semibold text-foreground">
              {autoHeartbeat ? `${formatCountdown(nextHeartbeatIn)}` : 'Kapalı'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleToggleHeartbeat(!autoHeartbeat)}
            className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
              autoHeartbeat 
                ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' 
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {autoHeartbeat ? 'Açık' : 'Aç'}
          </button>
        </div>
      </div>

      {/* Sonuç Özeti Alanı */}
      {syncResult && (
        <div className={`p-3.5 rounded-lg border text-xs space-y-2 ${
          syncResult.success 
            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-300' 
            : 'bg-rose-500/5 border-rose-500/20 text-rose-900 dark:text-rose-300'
        }`}>
          <div className="flex items-center justify-between font-semibold">
            <div className="flex items-center gap-1.5">
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500" />
              )}
              <span>{syncResult.success ? 'Web Senkronizasyonu Tamamlandı' : 'Hata Oluştu'}</span>
            </div>
            {lastSyncTime && (
              <span className="text-[10px] opacity-75">Son İşlem: {lastSyncTime}</span>
            )}
          </div>

          {syncResult.success && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="bg-background/80 p-2 rounded border border-border/40">
                <span className="text-muted-foreground block">Toplanan:</span>
                <strong>{syncResult.collection?.newItems ?? 0} yeni haber</strong>
              </div>
              <div className="bg-background/80 p-2 rounded border border-border/40">
                <span className="text-muted-foreground block">AI Analiz:</span>
                <strong>{syncResult.analysis?.processed ?? 0} incelendi</strong>
              </div>
              <div className="bg-background/80 p-2 rounded border border-border/40">
                <span className="text-muted-foreground block">İçerik Üretimi:</span>
                <strong>{syncResult.generation?.processed ?? 0} üretildi</strong>
              </div>
              <div className="bg-background/80 p-2 rounded border border-border/40">
                <span className="text-muted-foreground block">Facebook Yayını:</span>
                <strong>
                  {syncResult.publish?.processed && syncResult.publish.processed > 0
                    ? `✅ 1 Haber Paylaşıldı`
                    : syncResult.publish?.cooldownActive
                    ? `⏳ Soğuma (${syncResult.publish.minutesSinceLastPost}dk)`
                    : 'Kuyrukta Bekliyor'}
                </strong>
              </div>
            </div>
          )}

          {syncResult.publish?.reason && (
            <p className="text-[11px] opacity-80 pt-0.5">
              ℹ️ {syncResult.publish.reason}
            </p>
          )}

          {syncResult.error && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">
              {syncResult.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
