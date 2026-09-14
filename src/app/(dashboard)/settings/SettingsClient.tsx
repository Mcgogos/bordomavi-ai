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
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📘</span> Facebook / Meta Bağlantısı
          </CardTitle>
          <CardDescription>
            Page Access Token geçerliliğini ve BordoMavi sayfasına erişimi doğrulayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFacebookTest}
              disabled={fbTestLoading}
              variant="outline"
              className="min-w-[200px]"
            >
              {fbTestLoading ? '🔄 Test ediliyor...' : '🔌 Facebook Bağlantısını Test Et'}
            </Button>
          </div>
          {fbTestResult && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              fbTestResult.success
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <span className="text-xl">{fbTestResult.success ? '🟢' : '🔴'}</span>
              <div>
                <p className="font-semibold text-sm">
                  {fbTestResult.success ? 'Facebook bağlantısı başarılı' : 'Facebook bağlantısı başarısız'}
                </p>
                <p className="text-xs mt-1 opacity-80">{fbTestResult.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── HABER KAYNAKLARI ── */}
      <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Haber Kaynakları</CardTitle>
          <CardDescription>Otomatik haber toplanacak kaynakları belirleyin ve önceliklendirin.</CardDescription>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "İptal" : "+ Yeni Kaynak Ekle"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <form onSubmit={handleAddSubmit} className="bg-muted/30 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end border">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kaynak Adı</label>
              <Input required placeholder="Örn: Haber61" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Web Site URL</label>
              <Input required type="url" placeholder="https://..." value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RSS URL</label>
              <Input type="url" placeholder="https://.../rss" value={formData.rssUrl} onChange={(e) => setFormData({...formData, rssUrl: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Türü</label>
              <Select value={formData.type} onValueChange={(val: any) => setFormData({...formData, type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCAL">Yerel</SelectItem>
                  <SelectItem value="NATIONAL">Ulusal</SelectItem>
                  <SelectItem value="CLUB">Kulüp</SelectItem>
                  <SelectItem value="INTERNATIONAL">Uluslararası</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Ekleniyor..." : "Kaydet"}
            </Button>
          </form>
        )}

        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Kaynak Adı</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead>RSS URL</TableHead>
              <TableHead>Öncelik</TableHead>
              <TableHead className="text-right">Durum / İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Kayıtlı haber kaynağı bulunamadı.</TableCell>
              </TableRow>
            )}
            {sources.map(source => (
              <TableRow key={source.id}>
                <TableCell className="font-semibold text-primary">{source.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={source.type === 'CLUB' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-500'}>
                    {source.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono truncate max-w-[200px]">{source.rssUrl || "-"}</TableCell>
                <TableCell>{source.priority}</TableCell>
                <TableCell className="text-right flex items-center justify-end gap-3">
                  <Switch checked={source.isActive} onCheckedChange={() => handleToggle(source.id, source.isActive)} />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(source.id)}>
                    Sil
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}
