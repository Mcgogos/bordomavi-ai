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
        return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">✓ Yayında</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">⏰ Planlandı</Badge>;
      case "READY_TO_PUBLISH":
        return <Badge className="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100">● Hazır</Badge>;
      case "DRAFT":
        return <Badge variant="outline" className="text-muted-foreground">Taslak</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300";
    if (score >= 75) return "bg-blue-100 text-blue-700 ring-1 ring-blue-300";
    return "bg-amber-100 text-amber-700 ring-1 ring-amber-300";
  };

  const filteredContent = contents.filter((c) => {
    if (c.status === "REJECTED") return false;
    if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
    if (searchTerm && !c.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const statCards = [
    { label: "Taslak", value: metrics.draftCount, icon: FileText, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Yayına Hazır", value: metrics.readyCount, icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-100" },
    { label: "Planlandı", value: metrics.scheduledCount, icon: CalendarClock, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Yayında", value: metrics.publishedCount, icon: Radio, color: "text-green-600", bg: "bg-green-100" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">İçerik Merkezi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Yapay zeka tarafından üretilen içerikleri yönetin ve yayınlayın.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b bg-muted/30">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="İçerik başlığı ara..."
              className="pl-8 h-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
              <SelectTrigger className="w-48 h-9 bg-background">
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
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[320px] font-semibold">İçerik Başlığı</TableHead>
                <TableHead className="font-semibold">Kaynak Haber</TableHead>
                <TableHead className="font-semibold">Durum</TableHead>
                <TableHead className="text-center font-semibold">Kalite</TableHead>
                <TableHead className="font-semibold">Tarih</TableHead>
                <TableHead className="text-right font-semibold pr-4">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="w-8 h-8 opacity-30" />
                      <span className="text-sm">İçerik bulunamadı. AI'nın içerik üretmesini bekleyin.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredContent.map((content) => (
                  <TableRow key={content.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <span className="text-sm font-medium line-clamp-2 leading-snug text-primary">
                        {content.title}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                      <span className="line-clamp-2" title={content.sourceNews?.title}>
                        {content.sourceNews?.title || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(content.status)}</TableCell>
                    <TableCell className="text-center">
                      {content.qualityScore ? (
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm ${getScoreColor(content.qualityScore)}`}
                        >
                          {content.qualityScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(content.createdAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewContent(content)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Önizle
                        </Button>
                        {content.status !== "PUBLISHED" && (
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handlePublishNow(content.id)}
                            disabled={isPublishing === content.id}
                          >
                            {isPublishing === content.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5 mr-1" />
                            )}
                            Hemen Yayınla
                          </Button>
                        )}
                        {content.status === "PUBLISHED" && content.facebookPostId && (
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Yayında
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                          onClick={() => handleDelete(content.id)}
                          disabled={isDeleting === content.id}
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
          <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            {filteredContent.length} içerik listeleniyor
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">İçerik Önizleme</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setPreviewContent(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <h4 className="font-bold text-base mb-3">{previewContent.title}</h4>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {previewContent.body}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t bg-muted/30">
              <Button variant="outline" size="sm" onClick={() => setPreviewContent(null)}>
                Kapat
              </Button>
              {previewContent.status !== "PUBLISHED" && (
                <Button
                  size="sm"
                  onClick={() => {
                    handlePublishNow(previewContent.id);
                    setPreviewContent(null);
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
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
