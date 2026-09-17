"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toggleNewsSource, addNewsSource, deleteNewsSource, testFacebookConnectionAction } from "./actions";
import { toast } from "sonner"; // If they use sonner (I saw sonner.tsx in ui folder)

export default function SettingsClient({ initialSources }: { initialSources: any[] }) {
  const [sources, setSources] = useState(initialSources);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', rssUrl: '', type: 'LOCAL', priority: 50 });
  const [isLoading, setIsLoading] = useState(false);
  const [fbTestLoading, setFbTestLoading] = useState(false);
  const [fbTestResult, setFbTestResult] = useState<{ success: boolean; message: string } | null>(null);


  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setSources(sources.map(s => s.id === id ? { ...s, isActive: !currentStatus } : s));
      await toggleNewsSource(id, !currentStatus);
      toast.success("Durum güncellendi.");
    } catch (e) {
      toast.error("Güncelleme başarısız.");
      // Revert on error
      setSources(sources.map(s => s.id === id ? { ...s, isActive: currentStatus } : s));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kaynağı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await deleteNewsSource(id);
      if (res.success) {
        setSources(sources.filter(s => s.id !== id));
        toast.success("Kaynak silindi.");
      } else {
        toast.error(res.error || "Silinemedi.");
      }
    } catch (e) {
      toast.error("Silme işlemi başarısız.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newSource = await addNewsSource(formData);
      setSources([newSource, ...sources]);
      setIsAdding(false);
      setFormData({ name: '', url: '', rssUrl: '', type: 'LOCAL', priority: 50 });
      toast.success("Yeni kaynak eklendi!");
    } catch (error) {
      toast.error("Kaynak eklenirken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookTest = async () => {
    setFbTestLoading(true);
    setFbTestResult(null);
    try {
      const result = await testFacebookConnectionAction();
      setFbTestResult({
        success: !!result.success,
        message: result.message || (result.success ? 'Bağlantı başarılı.' : 'Bağlantı başarısız.'),
      });
    } catch (e: any) {
      setFbTestResult({ success: false, message: e.message || 'Bilinmeyen hata.' });
    } finally {
      setFbTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── FACEBOOK BAĞLANTI TESTİ ── */}
      <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
            <div className="w-8 h-8 rounded-lg bg-[#164E7A]/10 border border-[#164E7A]/20 flex items-center justify-center">
              <span className="text-sm font-black text-[#164E7A] dark:text-sky-400">f</span>
            </div>
            Facebook / Meta Bağlantı Tanı Aracı
          </CardTitle>
          <CardDescription className="text-xs">
            Mevcut Page Access Token'ın geçerliliğini ve Facebook Graph API yanıtını gerçek zamanlı test edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFacebookTest}
              disabled={fbTestLoading}
              variant="outline"
              className="h-9 px-4 text-xs font-semibold border-border/80"
            >
              {fbTestLoading ? 'Bağlantı Test Ediliyor...' : 'Facebook Bağlantısını Şimdi Test Et'}
            </Button>
          </div>
          {fbTestResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
              fbTestResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="mt-0.5">
                {fbTestResult.success ? '🟢' : '🔴'}
              </div>
              <div>
                <p className="font-bold text-xs">
                  {fbTestResult.success ? 'Facebook Bağlantısı Başarılı' : 'Facebook Bağlantısı Başarısız'}
                </p>
                <p className="text-xs mt-0.5 opacity-90">{fbTestResult.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── HABER KAYNAKLARI ── */}
      <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Otomatik Haber Kaynakları</CardTitle>
            <CardDescription className="text-xs">Otonom botun 30 dakikada bir tarayacağı RSS beslemelerini yönetin ve önceliklendirin.</CardDescription>
          </div>
          <Button 
            onClick={() => setIsAdding(!isAdding)}
            variant={isAdding ? "outline" : "default"}
            size="sm"
            className={isAdding ? "h-8 text-xs border-border/80" : "h-8 text-xs bg-primary text-primary-foreground font-semibold"}
          >
            {isAdding ? "İptal" : "+ Yeni Kaynak Ekle"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {isAdding && (
            <form onSubmit={handleAddSubmit} className="bg-muted/20 p-5 rounded-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end border border-border/70 shadow-xs mb-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kaynak Adı</label>
                <Input required placeholder="Örn: Haber61" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="h-9 text-xs border-border/80 bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Web Site URL</label>
                <Input required type="url" placeholder="https://..." value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} className="h-9 text-xs border-border/80 bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RSS URL</label>
                <Input type="url" placeholder="https://.../rss" value={formData.rssUrl} onChange={(e) => setFormData({...formData, rssUrl: e.target.value})} className="h-9 text-xs border-border/80 bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Türü</label>
                <Select value={formData.type} onValueChange={(val: any) => setFormData({...formData, type: val})}>
                  <SelectTrigger className="h-9 text-xs border-border/80 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">Yerel Basın</SelectItem>
                    <SelectItem value="NATIONAL">Ulusal Basın</SelectItem>
                    <SelectItem value="CLUB">Resmi Kulüp</SelectItem>
                    <SelectItem value="INTERNATIONAL">Uluslararası</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-9 text-xs font-semibold bg-primary text-primary-foreground">
                {isLoading ? "Ekleniyor..." : "Kaydet ve Başlat"}
              </Button>
            </form>
          )}

          <div className="overflow-x-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/70">
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Kaynak Adı</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Tür</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">RSS URL</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Öncelik</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-muted-foreground pr-4">Durum / İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">Kayıtlı haber kaynağı bulunamadı.</TableCell>
                  </TableRow>
                )}
                {sources.map(source => (
                  <TableRow key={source.id} className="hover:bg-muted/25 border-b border-border/60 transition-colors">
                    <TableCell className="font-semibold text-xs text-foreground">{source.name}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        source.type === 'CLUB' 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'bg-sky-500/10 text-[#164E7A] dark:text-sky-400 border border-sky-500/20'
                      }`}>
                        {source.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono truncate max-w-[220px]">{source.rssUrl || "—"}</TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{source.priority}</TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-3">
                        <Switch checked={source.isActive} onCheckedChange={() => handleToggle(source.id, source.isActive)} />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(source.id)}
                          className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 px-2"
                        >
                          Sil
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
