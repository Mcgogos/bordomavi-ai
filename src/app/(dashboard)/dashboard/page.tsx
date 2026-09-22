export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/db";
import { 
  Newspaper, FileText, Send, TrendingUp, 
  Activity, Zap, Clock, CheckCircle2
} from "lucide-react";


export default async function DashboardPage() {
  const [totalNews, pendingNews, totalContent, publishedContent, readyContent, recentPublished] = await Promise.all([
    prisma.news.count(),
    prisma.news.count({ where: { isProcessed: false } }),
    prisma.content.count(),
    prisma.content.count({ where: { status: 'PUBLISHED' } }),
    prisma.content.count({ where: { status: 'READY_TO_PUBLISH' } }),
    prisma.content.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, publishedAt: true, type: true }
    })
  ]);

  const stats = [
    {
      label: "Toplam Haber",
      value: totalNews,
      sub: "Sisteme giren ham haberler",
      icon: Newspaper,
      color: "text-[#164E7A] dark:text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
    {
      label: "Analiz Bekleyen",
      value: pendingNews,
      sub: "AI incelemesi gerekiyor",
      icon: Clock,
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Üretilen İçerik",
      value: totalContent,
      sub: "AI tarafından yazıldı",
      icon: FileText,
      color: "text-[#781324] dark:text-rose-400",
      bg: "bg-rose-900/10",
      border: "border-rose-900/20",
    },
    {
      label: "Facebook'ta Yayında",
      value: publishedContent,
      sub: "Sayfaya başarıyla gönderildi",
      icon: Send,
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
  ];

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Genel Bakış</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Canlı Takip
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Yapay Zeka destekli haber otomasyonu ve editoryal içerik performansı
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-xs self-start sm:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">7/24 Otonom Motor Aktif</span>
        </div>
      </div>

      {/* KPI Cards (Mobilde 2 Kolon, Masaüstünde 4 Kolon) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card border border-border/80 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md hover:border-border transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </span>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.border} border flex items-center justify-center transition-transform group-hover:scale-105`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold tracking-tight text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* System Status */}
        <div className="bg-card border border-border/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">Otomasyon Durumu</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
              Cron Motoru
            </span>
          </div>

          <div className="space-y-3">
            {[
              { label: "Haber Toplama (RSS)", status: "Aktif", ok: true },
              { label: "AI Analiz (NVIDIA NIM)", status: "Aktif", ok: true },
              { label: "İçerik Üretimi", status: "Aktif", ok: true },
              { label: "Facebook Yayını", status: "Aktif", ok: true },
              { label: "Yayınlanmayı Bekleyen", status: `${readyContent} içerik`, ok: readyContent > 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground text-xs font-medium">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-amber-500 ring-2 ring-amber-500/20'}`} />
                  <span className={`font-semibold text-xs ${item.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Published */}
        <div className="bg-card border border-border/80 rounded-xl p-5 space-y-4 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">Son Yayınlanan İçerikler</h3>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Son 5 Gönderi</span>
          </div>

          {recentPublished.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz yayınlanmış içerik bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentPublished.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/20 px-2 rounded-lg transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate max-w-[500px]">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.publishedAt ? new Date(c.publishedAt).toLocaleString('tr-TR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        }) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className="text-[10px] px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                      {c.type || 'POST'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info panel */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-sky-500/5 to-transparent border border-primary/20 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-foreground">30 Dakikalık Otonom Yayın Aktif</h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 border border-emerald-500/20">
                Otomatik
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">
              Sistem her 30 dakikada bir yerel ve ulusal spor kaynaklarını tarar, AI değerlendirmesinde <strong>85 ve üzeri</strong> puan alan haberleri 
              özel BordoMavi editoryal tarzıyla zenginleştirip logolu haber kartlarıyla birlikte Facebook sayfanızda paylaşır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}