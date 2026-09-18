"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Filter, Sparkles, PenTool, CheckCircle, Clock, 
  AlertCircle, Loader2, RefreshCw, ChevronDown, Newspaper
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateContentAction } from "./actions";
import { toast } from "sonner";

export default function NewsClientPage({ initialNews }: { initialNews: any[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [newsData, setNewsData] = useState(initialNews);
  const [isCollecting, setIsCollecting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);

  const pendingCount = newsData.filter(n => n.status === "PENDING").length;
  const analyzedCount = newsData.filter(n => n.status === "ANALYZED").length;

  const filteredNews = newsData.filter((news) => {
    const matchesSearch =
      news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      news.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "ALL" || news.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ANALYZED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Analiz Edildi
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Bekliyor
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Reddedildi
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceIcon = (conf: string | null) => {
    if (conf === "VERIFIED") return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (conf === "CLAIM") return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
    return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
    let colorClasses = "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20";
    if (score >= 85) {
      colorClasses = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30";
    } else if (score >= 60) {
      colorClasses = "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/30";
    }

    return (
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ring-1 ${colorClasses}`}
      >
        {score}
      </span>
    );
  };

  const handleCollect = async () => {
    setIsCollecting(true);
    const toastId = toast.loading("Haber kaynakları taranıyor...");
    try {
      const res = await fetch("/api/news/collect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `${data.sourcesProcessed} kaynak tarandı · ${data.newItems} yeni haber · ${data.duplicates} mükerrer`,
          { id: toastId }
        );
        router.refresh();
      } else {
        toast.error("Haber toplama başarısız.", { id: toastId });
      }
    } catch {
      toast.error("Bağlantı hatası.", { id: toastId });
    } finally {
      setIsCollecting(false);
    }
  };

  const handleAnalyze = async (id: string, title: string) => {
    setAnalyzingId(id);
    try {
      const res = await fetch(`/api/news/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setNewsData((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "ANALYZED", aiScore: data.importanceScore } : n
          )
        );
        toast.success("Haber başarıyla analiz edildi.");
      } else {
        toast.error(data.error || "Analiz sırasında hata oluştu.");
      }
    } catch {
      toast.error("İletişim hatası.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAnalyzeAll = async () => {
    setIsAnalyzingAll(true);
    const toastId = toast.loading("Bekleyen haberler analiz ediliyor...");
    try {
      const res = await fetch("/api/news/analyze-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.processed} haber analiz edildi`, { id: toastId });
        setTimeout(() => router.refresh(), 1000);
      } else {
        toast.error(data.error || "Analiz başarısız.", { id: toastId });
      }
    } catch {
      toast.error("İletişim hatası.", { id: toastId });
    } finally {
      setIsAnalyzingAll(false);
    }
  };

  const handleGenerate = async (id: string, title: string) => {
    setGeneratingId(id);
    const toastId = toast.loading("İçerik üretiliyor...");
    try {
      const response = await generateContentAction(id, title);
      if (response.success) {
        toast.success("İçerik başarıyla üretildi! İçerik Merkezi'ne kaydedildi.", { id: toastId });
        setNewsData((prev) => prev.filter((n) => n.id !== id));
      } else {
        toast.error((response as any).error || "İçerik üretilemedi.", { id: toastId });
      }
    } catch {
      toast.error("İçerik üretilirken hata oluştu.", { id: toastId });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Haber Merkezi</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              RSS Feed
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Trabzonspor gündemine düşen son haberlerin akışı ve AI değerlendirmeleri
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollect}
            disabled={isCollecting}
            className="flex-1 sm:flex-initial h-10 px-3.5 border-border/80 hover:bg-muted font-medium shadow-xs text-xs"
          >
            {isCollecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2 text-muted-foreground" />
            )}
            Haberleri Güncelle
          </Button>
          <Button
            size="sm"
            onClick={handleAnalyzeAll}
            disabled={isAnalyzingAll}
            className="flex-1 sm:flex-initial h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs"
          >
            {isAnalyzingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Tümünü Analiz Et
            {pendingCount > 0 && (
              <span className="ml-2 bg-white/20 text-white text-xs px-1.5 py-0.2 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {[
          { label: "Toplam Akış", value: newsData.length, color: "text-foreground", badgeBg: "bg-muted/40" },
          { label: "Analiz Bekleyen", value: pendingCount, color: "text-amber-700 dark:text-amber-400", badgeBg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Analiz Edildi", value: analyzedCount, color: "text-emerald-700 dark:text-emerald-400", badgeBg: "bg-emerald-500/10 border-emerald-500/20" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border/80 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-xs">
            <span className={`text-xl font-extrabold ${s.color}`}>{s.value}</span>
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-3.5 sm:p-4 border-b border-border/70 bg-muted/20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Haber başlığı veya kaynak ara..."
              className="pl-9 h-10 bg-background border-border/80 focus-visible:ring-primary text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
              <SelectTrigger className="w-full sm:w-44 h-10 bg-background border-border/80 text-xs">
                <SelectValue placeholder="Durum filtrele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm Haberler</SelectItem>
                <SelectItem value="PENDING">Bekleyenler</SelectItem>
                <SelectItem value="ANALYZED">Analiz Edilenler</SelectItem>
                <SelectItem value="REJECTED">Reddedilenler</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                <TableHead className="w-[420px] font-bold text-xs uppercase tracking-wider text-muted-foreground">Haber Başlığı</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Kaynak</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Tarih</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Durum</TableHead>
                <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">AI Skoru</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-muted-foreground pr-4">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-6">
                      <Newspaper className="w-10 h-10 opacity-25" />
                      <span className="text-sm font-medium">Haber akışı boş veya filtrelere uygun haber bulunamadı.</span>
                      <p className="text-xs text-muted-foreground/70">"Haberleri Güncelle" butonuna basarak yeni kaynak taraması yapabilirsiniz.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNews.map((news) => (
                  <TableRow key={news.id} className="hover:bg-muted/25 transition-colors border-b border-border/60">
                    <TableCell>
                      <div className="flex items-start gap-2.5 max-w-[420px]">
                        <div className="mt-0.5">{getConfidenceIcon(news.confidence)}</div>
                        <span className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                          {news.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                        {news.source}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                      {new Date(news.publishedAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(news.status)}</TableCell>
                    <TableCell className="text-center">
                      {getScoreBadge(news.aiScore)}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs font-medium border-border/80 hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-all"
                          onClick={() => handleAnalyze(news.id, news.title)}
                          disabled={analyzingId === news.id}
                        >
                          {analyzingId === news.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-primary" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                          )}
                          Analiz Et
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all"
                          onClick={() => handleGenerate(news.id, news.title)}
                          disabled={generatingId === news.id}
                        >
                          {generatingId === news.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <PenTool className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          İçerik Üret
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer count */}
        {filteredNews.length > 0 && (
          <div className="px-4 py-3 border-t border-border/70 bg-muted/20 text-xs font-medium text-muted-foreground flex items-center justify-between">
            <span>Toplam {filteredNews.length} haber listeleniyor</span>
            <span>Sayfa Başına Gösterim: Tümü</span>
          </div>
        )}
      </div>
    </div>
  );
}