"use client";

import { useState } from "react";
import { 
  FileText, CheckCircle2, CalendarClock, Radio, Eye, Send, 
  Trash, Filter, Search, Loader2, RefreshCw, ThumbsUp, MessageSquare, Share2, BarChart2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { deleteContentAction, publishContentNowAction, syncFacebookStatsAction } from "./actions";

interface ContentClientProps {
  initialContents: any[];
  metrics: {
    draftCount: number;
    readyCount: number;
    scheduledCount: number;
    publishedCount: number;
  };
}

export default function ContentClient({ initialContents, metrics }: ContentClientProps) {
  const router = useRouter();
  const [contents, setContents] = useState(initialContents);

  useEffect(() => {
    setContents(initialContents);
  }, [initialContents]);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewContent, setPreviewContent] = useState<any | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSyncingStats, setIsSyncingStats] = useState(false);

  const handlePublishNow = async (id: string) => {
    setIsPublishing(id);
    try {
      const res = await publishContentNowAction(id);
      if (res.success) {
        toast.success("🎉 İçerik başarıyla Facebook'ta yayınlandı!");
        setContents(prev => prev.map(c => c.id === id ? { ...c, status: "PUBLISHED", facebookPostId: res.postId, publishedAt: new Date() } : c));
      } else {
        toast.error(res.error || "Yayınlama başarısız oldu.");
      }
    } catch {
      toast.error("Yayınlama sırasında bir hata oluştu.");
    } finally {
      setIsPublishing(null);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const res = await deleteContentAction(id);
      if (res.success) {
        toast.success("İçerik havuzdan kaldırıldı.");
        setContents(prev => prev.filter(c => c.id !== id));
      } else {
        toast.error(res.error || "Silinemedi.");
      }
    } catch {
      toast.error("Silme işlemi sırasında hata oluştu.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSyncFacebookStats = async () => {
    setIsSyncingStats(true);
    try {
      const res = await syncFacebookStatsAction();
      if (res.success) {
        toast.success(`✅ Facebook istatistikleri güncellendi (${res.updatedCount} gönderi senkronize edildi).`);
        router.refresh();
      } else {
        toast.error(res.error || "İstatistikler güncellenemedi.");
      }
    } catch {
      toast.error("Facebook istatistikleri çekilirken hata oluştu.");
    } finally {
      setIsSyncingStats(false);
    }
  };

  const cleanText = (str?: string) => {
    if (!str) return "";
    return str.replace(/\*\*/g, "").replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3").trim();
  };

  const getEffectiveScore = (c: any): number => {
    if (typeof c.qualityScore === "number" && c.qualityScore > 0) return c.qualityScore;
    if (typeof c.sourceNews?.importanceScore === "number" && c.sourceNews.importanceScore > 0) return c.sourceNews.importanceScore;
    if (typeof c.viralScore === "number" && c.viralScore > 0) return c.viralScore;
    return 86; // Standart kaliteli Trabzonspor editoryal puanı
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Yayında
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-[#164E7A] dark:text-sky-400 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Planlandı
          </span>
        );
      case "READY_TO_PUBLISH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Yayına Hazır
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/80">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            Taslak
          </span>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScoreBadge = (score: number) => {
    let colorClasses = "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20";
    if (score >= 90) {
      colorClasses = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30";
    } else if (score >= 75) {
      colorClasses = "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/30";
    } else if (score >= 60) {
      colorClasses = "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/30";
    }

    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ring-1 ${colorClasses}`}
        title="Kalite & Güvenilirlik Skoru"
      >
        {score}
      </span>
    );
  };

  const filteredContent = contents.filter((c) => {
    if (c.status === "REJECTED") return false;
    if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
    if (searchTerm && !c.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const statCards = [
    { label: "Taslak", value: metrics.draftCount, icon: FileText, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
    { label: "Yayına Hazır", value: metrics.readyCount, icon: CheckCircle2, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { label: "Planlandı", value: metrics.scheduledCount, icon: CalendarClock, color: "text-[#164E7A] dark:text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
    { label: "Yayında", value: metrics.publishedCount, icon: Radio, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">İçerik Merkezi</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Editoryal Havuz
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bordo-Mavi yapay zeka tarafından üretilen içerikler, kalite puanları ve Facebook canlı etkileşim metrikleri.
          </p>
        </div>

        <Button
          onClick={handleSyncFacebookStats}
          disabled={isSyncingStats}
          variant="outline"
          className="h-9 text-xs font-semibold border-border/80 self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingStats ? 'animate-spin text-primary' : ''}`} />
          Facebook İstatistiklerini Güncelle
        </Button>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="bg-card border-border/80 shadow-xs">
              <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">{card.label}</p>
                  <p className="text-xl sm:text-2xl font-black text-foreground mt-0.5 tracking-tight">{card.value}</p>
                </div>
                <div className={`p-2 rounded-xl ${card.bg} ${card.border} border`}>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Arama & Filtreleme */}
      <Card className="bg-card border-border/80 shadow-xs">
        <div className="p-3.5 sm:p-4 border-b border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="İçerik başlıklarında ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-background border-border/80"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
              <SelectTrigger className="w-full sm:w-44 h-9 bg-background border-border/80 text-xs">
                <SelectValue placeholder="Durum filtrele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm Durumlar</SelectItem>
                <SelectItem value="DRAFT">Taslak</SelectItem>
                <SelectItem value="READY_TO_PUBLISH">Yayına Hazır</SelectItem>
                <SelectItem value="SCHEDULED">Planlandı</SelectItem>
                <SelectItem value="PUBLISHED">Yayında</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* MOBİL KART GÖRÜNÜMÜ (md:hidden) — Telefonlarda ve Yan Çevrildiğinde Tam Sığar */}
        <div className="block md:hidden divide-y divide-border/60">
          {filteredContent.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Kayıt bulunamadı.
            </div>
          ) : (
            filteredContent.map((content) => {
              const score = getEffectiveScore(content);
              const latestAnalytics = content.analytics?.[0];
              const titleClean = cleanText(content.title);

              return (
                <div key={content.id} className="p-4 space-y-3 bg-card hover:bg-muted/10 transition-colors">
                  {/* Kart Üst Bilgisi */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(content.status)}
                      {getScoreBadge(score)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(content.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Başlık */}
                  <h3 className="font-bold text-xs text-foreground leading-snug">
                    {titleClean}
                  </h3>

                  {/* Kaynak */}
                  {content.sourceNews?.title && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                      Kaynak: {cleanText(content.sourceNews.title)}
                    </p>
                  )}

                  {/* Facebook Canlı İstatistikleri (Yayınlandıysa) */}
                    {latestAnalytics ? (
                      <div className="p-2 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-around text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-semibold text-foreground" title="Erişim / Görüntülenme">
                          <BarChart2 className="w-3 h-3 text-sky-500" />
                          {latestAnalytics.reach || latestAnalytics.impressions || 0}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground" title="Beğeni / Reaksiyon">
                          <ThumbsUp className="w-3 h-3 text-emerald-500" />
                          {latestAnalytics.reactions ?? 0}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground" title="Yorumlar">
                          <MessageSquare className="w-3 h-3 text-amber-500" />
                          {latestAnalytics.comments ?? 0}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground" title="Paylaşımlar">
                          <Share2 className="w-3 h-3 text-purple-500" />
                          {latestAnalytics.shares ?? 0}
                        </span>
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-muted/30 border border-border/40 text-center text-[10px] text-muted-foreground">
                        ⏳ İstatistikler canlı ölçülüyor...
                      </div>
                    )}

                  {/* Mobil Aksiyon Butonları — Asla Kesilmez, Tam Dokunmatik */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewContent(content)}
                      className="h-8 text-xs font-semibold border-border/80"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Önizle
                    </Button>

                    {content.status !== "PUBLISHED" ? (
                      <Button
                        size="sm"
                        onClick={() => handlePublishNow(content.id)}
                        disabled={isPublishing === content.id}
                        className="col-span-2 h-8 text-xs font-bold bg-[#164E7A] hover:bg-[#123E62] text-white shadow-xs flex items-center justify-center gap-1"
                      >
                        {isPublishing === content.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Hemen Yayınla
                      </Button>
                    ) : (
                      <div className="col-span-2 flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yayında
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3">İçerik Başlığı</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Kaynak</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Durum</TableHead>
                <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Kalite</TableHead>
                <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">FB Etkileşimi</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Tarih</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-muted-foreground pr-4">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                    Görüntülenecek içerik bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContent.map((content) => {
                  const score = getEffectiveScore(content);
                  const latestAnalytics = content.analytics?.[0];
                  const titleClean = cleanText(content.title);

                  return (
                    <TableRow key={content.id} className="hover:bg-muted/20 transition-colors border-b border-border/60">
                      <TableCell className="max-w-[320px] py-3.5">
                        <span className="text-xs font-semibold text-foreground block line-clamp-2 leading-relaxed">
                          {titleClean}
                        </span>
                      </TableCell>

                      <TableCell className="max-w-[180px] text-xs text-muted-foreground py-3.5">
                        <span className="line-clamp-1 italic">
                          {cleanText(content.sourceNews?.title) || "—"}
                        </span>
                      </TableCell>

                      <TableCell className="py-3.5 whitespace-nowrap">
                        {getStatusBadge(content.status)}
                      </TableCell>

                      <TableCell className="text-center py-3.5 whitespace-nowrap">
                        {getScoreBadge(score)}
                      </TableCell>

                      {/* Facebook İstatistikleri Sütunu */}
                      <TableCell className="text-center py-3.5 whitespace-nowrap">
                        {content.status === "PUBLISHED" ? (
                          latestAnalytics ? (
                            <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-0.5 text-foreground font-semibold" title="Görüntülenme / Erişim">
                                <BarChart2 className="w-3 h-3 text-sky-500" />
                                {latestAnalytics.reach || latestAnalytics.impressions || 0}
                              </span>
                              <span className="flex items-center gap-0.5 text-foreground font-semibold" title="Beğeni">
                                <ThumbsUp className="w-3 h-3 text-emerald-500" />
                                {latestAnalytics.reactions ?? 0}
                              </span>
                              <span className="flex items-center gap-0.5 text-foreground font-semibold" title="Yorum">
                                <MessageSquare className="w-3 h-3 text-amber-500" />
                                {latestAnalytics.comments ?? 0}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Ölçülüyor...</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap py-3.5">
                        {new Date(content.createdAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>

                      <TableCell className="text-right pr-4 py-3.5 whitespace-nowrap">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => setPreviewContent(content)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Önizle
                          </Button>

                          {content.status !== "PUBLISHED" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs font-semibold bg-[#164E7A] text-white hover:bg-[#123E62] shadow-xs"
                              onClick={() => handlePublishNow(content.id)}
                              disabled={isPublishing === content.id}
                            >
                              {isPublishing === content.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              Hemen Yayınla
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                            onClick={() => handleDelete(content.id)}
                            disabled={isDeleting === content.id}
                            title="Sil"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Önizleme Modalı */}
      {previewContent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {cleanText(previewContent?.title)}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  İçerik Metni ve Yayın Önizlemesi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewContent(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 text-xs leading-relaxed whitespace-pre-line text-foreground">
                {cleanText(previewContent?.body)}
              </div>
              {previewContent?.hashtags && (
                <div className="text-xs text-primary font-semibold">
                  {previewContent.hashtags}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
                <Button variant="outline" onClick={() => setPreviewContent(null)} className="h-9 text-xs">
                  Kapat
                </Button>
                {previewContent?.status !== "PUBLISHED" && (
                  <Button
                    onClick={() => {
                      handlePublishNow(previewContent.id);
                      setPreviewContent(null);
                    }}
                    className="h-9 text-xs font-semibold bg-[#164E7A] hover:bg-[#123E62] text-white"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Şimdi Yayınla
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
