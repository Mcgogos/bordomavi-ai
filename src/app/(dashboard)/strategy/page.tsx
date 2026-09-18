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
  { name: "Maç Analizi", percentage: 45, color: "bg-[#164E7A]" },
  { name: "Transfer Söylentileri", percentage: 30, color: "bg-primary" },
  { name: "Antrenman Notları", percentage: 15, color: "bg-sky-500" },
  { name: "Kulüp Açıklamaları", percentage: 10, color: "bg-amber-500" },
];

const TOPICS = ["#Trabzonspor", "#SimonBanza", "#MuhammedCham", "#StefanSavic", "#EdinVisca", "#AnthonyNwakaeme", "#OkayYokuslu", "#ThomasReis", "#BordoMavi"];
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Strateji Merkezi</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Derin Öğrenme
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Trabzonspor taraftar kitlesi için veriye dayalı editoryal içerik önerileri ve trend analizleri.
          </p>
        </div>
        <Button 
          onClick={handleGenerateStrategy} 
          disabled={isGenerating}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs h-9 px-4"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Yeni AI Stratejisi Üret
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1 */}
        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Genel AI Skoru Ortalaması</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Target className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">%92.4</div>
            <p className="text-xs font-medium flex items-center mt-1 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
              +4% son 30 güne göre artış
            </p>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">İçerik Etkileşim Artışı</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-[#164E7A] dark:text-sky-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">+12.8%</div>
            <p className="text-xs font-medium flex items-center mt-1 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
              Geçen haftaya göre daha aktif kitle
            </p>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="bg-card border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">İdeal Paylaşım Saatleri</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {BEST_TIMES.map((time, i) => (
                <span key={i} className="text-xs font-semibold bg-muted px-2.5 py-1 rounded-md text-foreground border border-border/60">
                  {time}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Types Chart */}
        <Card className="bg-card border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center text-foreground">
              <BarChart3 className="w-4 h-4 mr-2 text-primary" />
              En Başarılı İçerik Türleri
            </CardTitle>
            <CardDescription className="text-xs">Son 30 günlük etkileşim oranlarına göre AI tahmin modeli</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {CONTENT_TYPES.map((ct) => (
              <div key={ct.name} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>{ct.name}</span>
                  <span className="text-muted-foreground">{ct.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${ct.color} rounded-full transition-all`} style={{ width: `${ct.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trends & AI Recommendations */}
        <Card className="bg-card border-border/80 shadow-xs flex flex-col">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center text-foreground">
              <TrendingUp className="w-4 h-4 mr-2 text-[#164E7A] dark:text-sky-400" />
              Yükselen Trendler ve Etiketler
            </CardTitle>
            <CardDescription className="text-xs">Trabzonspor gündeminde taraftarın en çok etkileşime girdiği başlıklar</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-5 pt-5">
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <span key={topic} className="text-xs font-semibold px-3 py-1 rounded-lg bg-muted text-foreground border border-border/70 hover:border-primary/40 transition-colors cursor-default">
                  {topic}
                </span>
              ))}
            </div>
            
            <div className="rounded-xl bg-gradient-to-r from-primary/10 via-sky-500/5 to-transparent border border-primary/20 p-4 shadow-xs">
              <h4 className="text-xs font-bold text-primary mb-1.5 flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Otomatik AI Editoryal Gözlemi
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Son 7 gün içindeki verilere göre, maç sonrası yapılan kısa analizler ve resmi kulüp açıklamaları düz metin haberlere kıyasla <strong>%140 daha fazla etkileşim</strong> alıyor. Önümüzdeki günlerde görsel ağırlıklı içeriklere odaklanmanız tavsiye edilir.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Strategies */}
      {strategies && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Yapay Zeka Tarafından Önerilen Özel Stratejiler
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {strategies.map((str, i) => (
              <Card key={i} className="bg-card border-border/80 border-l-4 border-l-primary shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold text-foreground">{str.title}</CardTitle>
                  <div className="mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1.5">Beklenen Etki:</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {str.impact}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{str.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}