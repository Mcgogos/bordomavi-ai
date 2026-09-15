"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Clock, Target, BarChart3, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { generateStrategyAction } from "./actions";

// Mock Stats Data
const CONTENT_TYPES = [
  { name: "Maç Analizi", percentage: 45, color: "bg-blue-500" },
  { name: "Transfer Söylentileri", percentage: 30, color: "bg-yellow-500" },
  { name: "Antrenman Notları", percentage: 15, color: "bg-green-500" },
  { name: "Kulüp Açıklamaları", percentage: 10, color: "bg-red-500" },
];

const TOPICS = ["#UğurcanÇakır", "#ÅampiyonlukYolunda", "#Transfer", "#BordoMavi", "#Avcı"];
const BEST_TIMES = ["19:00 (Maç Sonu)", "12:30 (Öğle Arası)", "21:00 (Prime Time)"];

export default function StrategyPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategies, setStrategies] = useState<{title: string, description: string, impact: string}[] | null>(null);

  const handleGenerateStrategy = async () => {
    setIsGenerating(true);
    try {
      const response = await generateStrategyAction();
      if (response.success && response.data) {
        setStrategies(response.data);
        toast.success("AI Strateji başarıyla oluşturuldu.");
      } else {
        toast.error(response.error || "Strateji oluşturulurken hata oluştu.");
      }
    } catch (error) {
      toast.error("Bir hata oluştu.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Strateji Merkezi</h1>
          <p className="text-muted-foreground">Trabzonspor kitlesi için veriye dayalı içerik önerileri ve trend analizleri.</p>
        </div>
        <Button 
          onClick={handleGenerateStrategy} 
          disabled={isGenerating}
          className="bg-primary text-primary-foreground"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          AI Strateji Oluştur
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1 */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Genel AI Skoru Ortalaması</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92.4%</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-green-500">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              +4% son 30 güne göre
            </p>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İçerik Etkileşim Artışı</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12.8%</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-green-500">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              Geçen haftaya göre daha aktif kitle
            </p>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İdeal Paylaşım Saatleri</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1 mt-2">
              {BEST_TIMES.map((time, i) => (
                <div key={i} className="text-sm font-medium bg-secondary/50 px-2 py-1 rounded text-secondary-foreground inline-block w-fit">
                  {time}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Types Chart (Mock) */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary" />
              En Başarılı İçerik Türleri
            </CardTitle>
            <CardDescription>Son 30 günlük etkileşim oranlarına göre (Yapay Zeka tahmini)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CONTENT_TYPES.map((ct) => (
              <div key={ct.name} className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>{ct.name}</span>
                  <span>{ct.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${ct.color} rounded-full`} style={{ width: `${ct.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trends & AI Recommendations */}
        <Card className="bg-card border-border flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              Yükselen Trendler
            </CardTitle>
            <CardDescription>Taraftarın en çok ilgilendiği konular ve etiketler</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <Badge key={topic} variant="secondary" className="text-sm py-1 hover:bg-secondary/80 cursor-default">
                  {topic}
                </Badge>
              ))}
            </div>
            
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 mt-auto">
              <h4 className="text-sm font-semibold text-primary mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Otomatik AI Gözlemi
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Son 7 gün içindeki verilere göre, maç sonrası yapılan kısa video analizleri (1-2 dk) düz metin haberlere göre %140 daha fazla etkileşim alıyor. Önümüzdeki günlerde görsel ağırlıklı içeriklere odaklanmanız tavsiye edilir.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Strategies */}
      {strategies && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-xl font-bold flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-primary" />
            AI Tarafından Üretilen Stratejiler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {strategies.map((str, i) => (
              <Card key={i} className="bg-card border-border border-l-4 border-l-primary">
                <CardHeader>
                  <CardTitle className="text-lg">{str.title}</CardTitle>
                  <CardDescription>
                    Beklenen Etki: <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 ml-1">{str.impact}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{str.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}