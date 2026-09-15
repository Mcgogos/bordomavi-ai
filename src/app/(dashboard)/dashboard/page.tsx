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
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      label: "Analiz Bekleyen",
      value: pendingNews,
      sub: "AI incelemesi gerekiyor",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100"
    },
    {
      label: "Ãœretilen Ä°Ã§erik",
      value: totalContent,
      sub: "AI tarafÄ±ndan yazÄ±ldÄ±",
      icon: FileText,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-100"
    },
    {
      label: "Facebook'ta YayÄ±nda",
      value: publishedContent,
      sub: "Sayfaya baÅŸarÄ±yla gÃ¶nderildi",
      icon: Send,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100"
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Genel BakÄ±ÅŸ</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Yapay Zeka destekli haber otomasyonunun gÃ¼ncel durumu
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
          <Activity className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-medium text-green-700">Sistem Aktif</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`bg-card border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${stat.border}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${stat.color}`} />
                </div>
              </div>
              <div>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* System Status */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Otomasyon Durumu</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Haber Toplama (RSS)", status: "Aktif", ok: true },
              { label: "AI Analiz (Gemini)", status: "Aktif", ok: true },
              { label: "Ä°Ã§erik Ãœretimi", status: "Aktif", ok: true },
              { label: "Facebook YayÄ±nÄ±", status: "Aktif", ok: true },
              { label: "YayÄ±nlanmayÄ± Bekleyen", status: `${readyContent} iÃ§erik`, ok: readyContent > 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <span className={`font-medium text-xs ${item.ok ? 'text-green-700' : 'text-amber-700'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Published */}
        <div className="bg-card border rounded-xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-sm">Son YayÄ±nlanan Ä°Ã§erikler</h3>
          </div>
          {recentPublished.length === 0 ? (
            <p className="text-sm text-muted-foreground">HenÃ¼z yayÄ±nlanmÄ±ÅŸ iÃ§erik bulunmuyor.</p>
          ) : (
            <div className="space-y-3">
              {recentPublished.map((c) => (
                <div key={c.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-7 h-7 rounded-md bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Send className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.publishedAt ? new Date(c.publishedAt).toLocaleString('tr-TR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : 'â€”'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium uppercase tracking-wide">
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
      <div className="bg-primary/5 border border-primary/15 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Otomatik YayÄ±n Aktif</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Sistem her 30 dakikada bir haberleri tarar, AI puanÄ± <strong>85 ve Ã¼zeri</strong> olan haberleri 
              otomatik iÅŸleyerek saatte 2 haber Facebook sayfanÄ±zda paylaÅŸÄ±r.
              HiÃ§bir manuel mÃ¼dahale gerektirmez.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}