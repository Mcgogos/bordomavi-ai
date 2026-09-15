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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analitik ve Performans</h1>
        <p className="text-muted-foreground mt-1">Sistemin genel performansı ve AI başarı metrikleri.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İşlenen Toplam Haber</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNews}</div>
            <p className="text-xs text-muted-foreground mt-1">RSS kaynaklarından çekildi</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Üretilen İçerik</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContent}</div>
            <p className="text-xs text-muted-foreground mt-1">Yapay zeka tarafından yazıldı</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yayınlanan İçerik</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedContent}</div>
            <p className="text-xs text-muted-foreground mt-1">Facebook'ta paylaşıldı</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ortalama AI Skoru</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">%{avgScore}</div>
            <p className="text-xs text-muted-foreground mt-1">İçerik kalite ortalaması</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8 text-center py-12 border rounded-lg bg-muted/20">
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-20" />
        <h3 className="text-lg font-medium text-muted-foreground">Detaylı Grafikler Hazırlanıyor</h3>
        <p className="text-sm text-muted-foreground mt-1">Daha fazla etkileşim verisi toplandığında burada grafikler aktif olacaktır.</p>
      </div>
    </div>
  );
}