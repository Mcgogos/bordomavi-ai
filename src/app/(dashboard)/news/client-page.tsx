"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Filter, Sparkles, PenTool, CheckCircle, Clock, 
  AlertCircle, Loader2, RefreshCw, ChevronDown
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
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium">
            ✓ Analiz Edildi
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 font-medium">
            ⏳ Bekliyor
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 font-medium">
            ✗ Reddedildi
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceIcon = (conf: string | null) => {
    if (conf === "VERIFIED") return <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (conf === "CLAIM") return <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300";
    if (score >= 60) return "bg-amber-100 text-amber-700 ring-1 ring-amber-300";
    return "bg-red-100 text-red-600 ring-1 ring-red-200";
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
        // Remove from list since content was generated
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Haber Merkezi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Trabzonspor gündemine düşen son haberler
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollect}
            disabled={isCollecting}
            className="h-9"
          >
            {isCollecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Haberleri Güncelle
          </Button>
          <Button
            size="sm"
            onClick={handleAnalyzeAll}
            disabled={isAnalyzingAll}
            className="h-9"
          >
            {isAnalyzingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Tümünü Analiz Et
            {pendingCount > 0 && (
              <span className="ml-1.5 bg-primary-foreground/20 text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Toplam", value: newsData.length, color: "text-foreground" },
          { label: "Bekleyen", value: pendingCount, color: "text-amber-600" },
          { label: "Analiz Edildi", value: analyzedCount, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-lg px-4 py-2 flex items-center gap-2">
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b bg-muted/30">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Haber veya kaynak ara..."
              className="pl-8 h-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
              <SelectTrigger className="w-44 h-9 bg-background">
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
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[420px] font-semibold">Haber Başlığı</TableHead>
                <TableHead className="font-semibold">Kaynak</TableHead>
                <TableHead className="font-semibold">Tarih</TableHead>
                <TableHead className="font-semibold">Durum</TableHead>
                <TableHead className="text-center font-semibold">AI Skoru</TableHead>
                <TableHead className="text-right font-semibold pr-4">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Newspaper className="w-8 h-8 opacity-30" />
                      <span className="text-sm">Haber bulunamadı.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNews.map((news) => (
                  <TableRow key={news.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[400px]">
                        {getConfidenceIcon(news.confidence)}
                        <span className="text-sm font-medium line-clamp-2 leading-snug">
                          {news.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground">
                        {news.source}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(news.publishedAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(news.status)}</TableCell>
                    <TableCell className="text-center">
                      {news.aiScore !== null ? (
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm ${getScoreColor(news.aiScore)}`}
                        >
                          {news.aiScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleAnalyze(news.id, news.title)}
                          disabled={analyzingId === news.id}
                        >
                          {analyzingId === news.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                          )}
                          Analiz Et
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleGenerate(news.id, news.title)}
                          disabled={generatingId === news.id}
                        >
                          {generatingId === news.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <PenTool className="w-3.5 h-3.5 mr-1" />
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
          <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            {filteredNews.length} haber listeleniyor
          </div>
        )}
      </div>
    </div>
  );
}

// Needed import for the empty state icon
import { Newspaper } from "lucide-react";