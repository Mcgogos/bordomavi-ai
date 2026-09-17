import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const totalNews = await prisma.news.count();
  const totalContent = await prisma.content.count();
  const publishedContent = await prisma.content.count({ where: { status: 'PUBLISHED' } });
  
  // Averages
  const contents = await prisma.content.findMany({ select: { qualityScore: true } });
  const avgScore = contents.length > 0 
    ? Math.round(contents.reduce((acc, c) => acc + (c.qualityScore || 0), 0) / contents.length) 
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Analitik ve Performans</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Sistem Metrikleri
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Haber kaynakları, üretilen editoryal içerikler ve Facebook etkileşim göstergeleri
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">İşlenen Toplam Haber</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-[#164E7A] dark:text-sky-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{totalNews}</div>
            <p className="text-xs text-muted-foreground mt-1">RSS kaynaklarından çekildi</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Üretilen İçerik</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-900/10 border border-rose-900/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-[#781324] dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{totalContent}</div>
            <p className="text-xs text-muted-foreground mt-1">Yapay zeka tarafından yazıldı</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yayınlanan İçerik</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">{publishedContent}</div>
            <p className="text-xs text-muted-foreground mt-1">Facebook'ta başarıyla paylaşıldı</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ortalama AI Skoru</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">%{avgScore}</div>
            <p className="text-xs text-muted-foreground mt-1">İçerik kalite ve önem ortalaması</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Telemetry section */}
      <div className="bg-card border border-border/80 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="font-bold text-base text-foreground">Haftalık Yayın Dağılımı ve Trendler</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Otonom zamanlayıcı tarafından gerçekleştirilen paylaşım performansı</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border/60">
            Son 7 Gün
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yayın Başarı Oranı</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">%100</span>
              <span className="text-xs text-muted-foreground">Kesintisiz</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full w-full" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Otonom Tarama Sıklığı</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#164E7A] dark:text-sky-400">30 dk</span>
              <span className="text-xs text-muted-foreground">Periyodik Tarama</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#164E7A] dark:bg-sky-500 h-full rounded-full w-full" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yüksek Önem Oranı (Score 85+)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#781324] dark:text-rose-400">Öncelikli</span>
              <span className="text-xs text-muted-foreground">Filtreleme</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-full rounded-full w-4/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}