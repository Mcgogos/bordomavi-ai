"use client";

import { useState } from "react";
import {
  Search, Filter, Trash, Send, FileText,
  CheckCircle2, CalendarClock, Radio, Loader2, Eye, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { deleteContentAction, publishContentNowAction } from "./actions";

interface ContentItem {
  id: string;
  title: string;
  body: string;
  type: string;
  status: string;
  qualityScore: number | null;
  createdAt: string | Date;
  publishedAt: string | Date | null;
  facebookPostId: string | null;
  sourceNews?: { title: string } | null;
}

export default function ContentClient({
  initialContents,
  metrics,
}: {
  initialContents: ContentItem[];
  metrics: { draftCount: number; readyCount: number; scheduledCount: number; publishedCount: number };
}) {
  const [contents, setContents] = useState<ContentItem[]>(initialContents);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<ContentItem | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Bu içeriği reddetmek istediğinize emin misiniz?")) return;
    setIsDeleting(id);
    try {
      const res = await deleteContentAction(id);
      if (res.success) {
        setContents((prev) => prev.filter((c) => c.id !== id));
        toast.success("İçerik reddedildi ve listeden kaldırıldı.");
      } else {
        toast.error(res.error || "Hata oluştu.");
      }
    } catch {
      toast.error("İşlem başarısız.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePublishNow = async (id: string) => {
    setIsPublishing(id);
    const toastId = toast.loading("Facebook'a yayınlanıyor...");
    try {
      const res = await publishContentNowAction(id);
      if (res.success) {
        toast.success("İçerik Facebook sayfanızda başarıyla yayınlandı!", { id: toastId });
        setContents((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "PUBLISHED", facebookPostId: res.postId || null } : c
          )
        );
      } else {
        toast.error(res.error || "Yayınlama başarısız.", { id: toastId });
      }
    } catch {
      toast.error("Yayınlama sırasında hata oluştu.", { id: toastId });
    } finally {
      setIsPublishing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Yayında
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Planlandı
          </span>
        );
      case "READY_TO_PUBLISH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Yayına Hazır
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/80">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            Taslak
          </span>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
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
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ring-1 ${colorClasses}`}
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">İçerik Merkezi</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Editoryal Havuz
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Yapay zeka tarafından üretilen sosyal medya içeriklerini inceleyin, onaylayın ve yayınlayın.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border/80 rounded-xl p-4 flex items-center gap-4 shadow-xs hover:shadow-md transition-shadow">
              <div className={`w-11 h-11 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <div className="text-2xl font-extrabold tracking-tight text-foreground">{s.value}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border/70 bg-muted/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="İçerik başlığı ara..."
              className="pl-9 h-9 bg-background border-border/80 focus-visible:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
              <SelectTrigger className="w-48 h-9 bg-background border-border/80">
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

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                <TableHead className="w-[340px] font-bold text-xs uppercase tracking-wider text-muted-foreground">İçerik Başlığı</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Kaynak Haber</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Durum</TableHead>
                <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Kalite Skoru</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Tarih</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-muted-foreground pr-4">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-6">
                      <FileText className="w-10 h-10 opacity-25" />
                      <span className="text-sm font-medium">İçerik havuzunda görüntülenecek kayıt bulunamadı.</span>
                      <p className="text-xs text-muted-foreground/70">Yeni haberler analiz edildikten sonra burada listelenecektir.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredContent.map((content) => (
                  <TableRow key={content.id} className="hover:bg-muted/25 transition-colors border-b border-border/60">
                    <TableCell>
                      <span className="text-sm font-semibold line-clamp-2 leading-snug text-foreground">
                        {content.title}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                      <span className="line-clamp-2 font-medium" title={content.sourceNews?.title}>
                        {content.sourceNews?.title || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(content.status)}</TableCell>
                    <TableCell className="text-center">
                      {getScoreBadge(content.qualityScore)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {new Date(content.createdAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end items-center gap-1.5">
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
                            className="h-8 px-3 text-xs font-semibold bg-[#164E7A] text-white hover:bg-[#123E62] shadow-xs transition-all"
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
                        {content.status === "PUBLISHED" && content.facebookPostId && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Yayında
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                          onClick={() => handleDelete(content.id)}
                          disabled={isDeleting === content.id}
                          title="Reddet ve Sil"
                        >
                          {isDeleting === content.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredContent.length > 0 && (
          <div className="px-4 py-3 border-t border-border/70 bg-muted/20 text-xs font-medium text-muted-foreground flex items-center justify-between">
            <span>Toplam {filteredContent.length} içerik listeleniyor</span>
            <span>Sayfa Başına Gösterim: Tümü</span>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="font-bold text-sm text-foreground">İçerik Detay Önizlemesi</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full hover:bg-muted"
                onClick={() => setPreviewContent(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Başlık</span>
                <h4 className="font-bold text-base text-foreground mt-0.5">{previewContent.title}</h4>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">İçerik Metni</span>
                <div className="mt-1 p-4 rounded-xl bg-muted/30 border border-border/60 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {previewContent.body}
                </div>
              </div>
            </div>
            <div className="flex justify-end items-center gap-2.5 px-6 py-4 border-t border-border/70 bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setPreviewContent(null)}>
                Kapat
              </Button>
              {previewContent.status !== "PUBLISHED" && (
                <Button
                  size="sm"
                  className="bg-[#164E7A] text-white hover:bg-[#123E62] font-semibold"
                  onClick={() => {
                    handlePublishNow(previewContent.id);
                    setPreviewContent(null);
                  }}
                >
                  <Send className="w-3.5 h-3.5 mr-2" />
                  Hemen Yayınla
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
