"use client";

import { useState, useEffect } from "react";
import { 
  Users, X, Copy, ExternalLink, Check, Plus, Trash2, 
  Share2, CheckCircle2, ArrowRight, Sparkles, ShieldCheck,
  Compass, Globe, Zap, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface FacebookGroupItem {
  id: string;
  name: string;
  url: string;
  members?: string;
  isCustom?: boolean;
}

export interface FacebookGroupShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: {
    id: string;
    title: string;
    body?: string;
    facebookPostId?: string | null;
    publishedAt?: string | Date | null;
  } | null;
}

const STORAGE_KEY = "bordo_mavi_saved_fb_groups_v2";

export function FacebookGroupShareModal({
  isOpen,
  onClose,
  post,
}: FacebookGroupShareModalProps) {
  const [groups, setGroups] = useState<FacebookGroupItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [sharedGroupIds, setSharedGroupIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Yeni grup ekleme formu
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupUrl, setNewGroupUrl] = useState("");

  // Sıralı paylaşım adımı
  const [stepIndex, setStepIndex] = useState<number>(-1);

  // LocalStorage'dan kayıtlı grupları yükle
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Sahte/hayali eski placeholder URL'lerini temizle
            const cleanGroups = parsed.filter((g: FacebookGroupItem) => 
              g.url && !g.url.includes("trabzonspor.taraftarlari") &&
              !g.url.includes("bordomavifirtina") &&
              !g.url.includes("61trabzonsporlular") &&
              !g.url.includes("trabzonsporgundem") &&
              !g.url.includes("kuzeyinkrallari") &&
              !g.url.includes("trabzonsporsevdalilari")
            );
            setGroups(cleanGroups);
            return;
          }
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  // Modal açıldığında kayıtlı grupları seç
  useEffect(() => {
    if (isOpen) {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)));
      setSharedGroupIds(new Set());
      setStepIndex(-1);
    }
  }, [isOpen, groups]);

  if (!isOpen || !post) return null;

  // Gerçek genel paylaşım bağlantısı (Public Share URL)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://bordomavi-ai.vercel.app";
  const publicShareUrl = `${baseUrl}/share/${post.id}`;

  // Facebook post gerçek Permalink URL'si (pageId_postId formatını hatasız açar)
  const getPostFacebookUrl = () => {
    if (post.facebookPostId && post.facebookPostId.length > 5 && !post.facebookPostId.startsWith("mock-")) {
      if (post.facebookPostId.includes('_')) {
        const [pageId, postId] = post.facebookPostId.split('_');
        return `https://www.facebook.com/permalink.php?story_fbid=${postId}&id=${pageId}`;
      }
      return `https://www.facebook.com/${post.facebookPostId}`;
    }
    return publicShareUrl;
  };

  const postUrl = getPostFacebookUrl();

  const getFullShareMessage = () => {
    const cleanT = (post.title || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    const cleanB = (post.body || "")
      .replace(/\*\*/g, "")
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1$2$3")
      .trim();

    let text = cleanT;
    if (cleanB && cleanB !== cleanT) {
      text += `\n\n${cleanB}`;
    }
    if (!text.includes("#Trabzonspor")) {
      text += "\n\n#Trabzonspor #BordoMavi #Fırtına";
    }
    text += `\n\n🔗 Haberin Detayı ve Fotoğrafları: ${publicShareUrl}`;
    return text;
  };

  const handleCopyShareText = async () => {
    try {
      const fullText = getFullShareMessage();
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success("📋 Haber metni ve link otomatik panonuza kopyalandı! Gruplarda Ctrl+V ile yapıştırabilirsiniz.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Panoya kopyalanamadı.");
    }
  };

  // 1. YÖNTEM: Facebook Resmi Otomatik Kartlı Paylaşım Penceresi (Görsel ve Metin Kendiliğinden Gelir)
  const handleOpenAutomaticGroupSharer = () => {
    const sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicShareUrl)}&display=popup`;
    window.open(sharerUrl, "_blank", "width=650,height=650,scrollbars=yes,status=no");
    toast.success("✨ Facebook Paylaşım Penceresi açıldı! Üstteki açılır menüden 'Bir grupta paylaş' seçeneğini tıklayın; görsel ve başlık otomatik hazır gelir!");
  };

  // 2. YÖNTEM: Doğrudan Facebook Sayfa Gönderisini Açarak Paylaşma (Takipçi ve Beğeni Kazandırır)
  const handleOpenPostDirectly = async () => {
    await handleCopyShareText();
    window.open(postUrl, "_blank", "noopener,noreferrer");
    toast.success("Facebook gönderiniz açıldı! Gönderinin altındaki 'Paylaş' > 'Bir grupta paylaş' butonunu tıklayabilirsiniz.");
  };

  const toggleSelectGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupUrl.trim()) {
      toast.error("Grup adı ve Facebook adresi zorunludur.");
      return;
    }

    let validUrl = newGroupUrl.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      if (validUrl.startsWith("facebook.com") || validUrl.startsWith("www.facebook.com")) {
        validUrl = "https://" + validUrl;
      } else {
        validUrl = `https://www.facebook.com/groups/${validUrl.replace(/^\/+/, '')}`;
      }
    }

    const newGroup: FacebookGroupItem = {
      id: `custom-group-${Date.now()}`,
      name: newGroupName.trim(),
      url: validUrl,
      members: "Kayıtlı Grubum",
      isCustom: true,
    };

    const updated = [newGroup, ...groups];
    setGroups(updated);
    setSelectedGroupIds((prev) => new Set([...Array.from(prev), newGroup.id]));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    setNewGroupName("");
    setNewGroupUrl("");
    setIsAddingGroup(false);
    toast.success(`🎉 '${newGroup.name}' başarıyla grup listenize eklendi!`);
  };

  const handleDeleteGroup = (id: string) => {
    const updated = groups.filter((g) => g.id !== id);
    setGroups(updated);
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    toast.info("Grup listeden kaldırıldı.");
  };

  // Sıralı Paylaşım
  const selectedGroupsList = groups.filter((g) => selectedGroupIds.has(g.id));

  const handleStartSequentialShare = async () => {
    if (groups.length === 0) {
      toast.info("Grup listeniz henüz boş. Üyesi olduğunuz bir Trabzonspor grubunu ekleyin veya yukarıdaki 'Otomatik Kartlı Paylaş' butonunu kullanın.");
      setIsAddingGroup(true);
      return;
    }

    if (selectedGroupsList.length === 0) {
      toast.error("Lütfen açmak istediğiniz en az bir grubu işaretleyin.");
      return;
    }

    // Metni otomatik kopyala
    await handleCopyShareText();

    // 0. adımdan başla
    const firstGroup = selectedGroupsList[0];
    setStepIndex(0);
    setSharedGroupIds((prev) => new Set([...Array.from(prev), firstGroup.id]));

    window.open(firstGroup.url, "_blank", "noopener,noreferrer");
    toast.success(`1/${selectedGroupsList.length} grup açıldı: ${firstGroup.name}. Metin panonuzda, 'Gönderi oluştur' alanına Ctrl+V ile yapıştırın!`);
  };

  const handleNextSequentialGroup = async () => {
    await handleCopyShareText();
    const nextIdx = stepIndex + 1;
    if (nextIdx < selectedGroupsList.length) {
      const nextGroup = selectedGroupsList[nextIdx];
      setStepIndex(nextIdx);
      setSharedGroupIds((prev) => new Set([...Array.from(prev), nextGroup.id]));
      window.open(nextGroup.url, "_blank", "noopener,noreferrer");
      toast.success(`${nextIdx + 1}/${selectedGroupsList.length} grup açıldı: ${nextGroup.name}`);
    } else {
      setStepIndex(-1);
      toast.success("🎉 Tebrikler! Seçtiğiniz tüm gruplarda paylaşım süreci tamamlandı.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Üst Başlık Barı */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/70 bg-gradient-to-r from-[#1877F2]/10 via-background to-[#164E7A]/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-white font-bold shadow-md shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Facebook Gruplarında Paylaşım Asistanı
                </h2>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Otomatik Paylaşım Destekli
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Haberinizi Facebook gruplarında görseli ve başlığıyla birlikte en hızlı şekilde paylaşın.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Modal Gövdesi */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">

          {/* 🌟 1. YÖNTEM: KENDİLİĞİNDEN OTOMATİK OLUŞAN RESMİ PAYLAŞIM PENCERESİ */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-[#1877F2]/5 to-transparent border-2 border-emerald-500/40 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> 1. YÖNTEM: Otomatik Görsel ve Başlıklı Paylaşım (Tavsiye Edilen)
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground">
                  Tek Tıkla Facebook Paylaşım Penceresini Aç
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bu butona bastığınızda Facebook'un resmi paylaşım penceresi açılır. <strong>Haberin afiş görseli, başlığı ve detayları KENDİLİĞİNDEN OTOMATİK GELİR.</strong> Pencerenin üstündeki menüden <strong>"Bir grupta paylaş"</strong> seçeneğini tıklayıp istediğiniz grubu seçmeniz yeterlidir.
                </p>
              </div>

              <Button
                onClick={handleOpenAutomaticGroupSharer}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 shrink-0 shadow-md flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-emerald-200" />
                <span>Otomatik Paylaşımı Aç</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* 🌟 2. YÖNTEM: SAYFA GÖNDERİSİNİ GRUPTA PAYLAŞMA (TAKİPÇİ KAZANDIRAN YÖNTEM) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#1877F2]/10 via-[#1877F2]/5 to-transparent border border-[#1877F2]/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#1877F2] uppercase tracking-wider flex items-center gap-1">
                    <Share2 className="w-3.5 h-3.5" /> 2. YÖNTEM: Sayfanızın Gönderisini Grupta Paylaşın
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground">
                  Gönderiyi Aç &gt; "Paylaş" &gt; "Bir Grupta Paylaş"
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Facebook'ta yayınlanan gönderinizi açar. Gönderinin altındaki <strong>"Paylaş"</strong> butonuna basıp <strong>"Bir grupta paylaş"</strong> diyerek üye olduğunuz gruplara gönderirsiniz. <strong>Sayfanızın takipçi ve beğenilerini en hızlı artıran yöntem budur.</strong>
                </p>
              </div>

              <Button
                onClick={handleOpenPostDirectly}
                variant="outline"
                className="border-[#1877F2]/40 text-[#1877F2] hover:bg-[#1877F2]/10 font-bold text-xs h-10 px-4 shrink-0 shadow-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>Facebook'ta Gönderiyi Aç</span>
              </Button>
            </div>
          </div>
          
          {/* Haber Özeti ve Otomatik Panoya Kopyalama Alanı */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Panoya Hazır Metin (Ctrl+V İle Yapıştırılabilir)
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                  {post.title}
                </h3>
              </div>

              <Button
                size="sm"
                onClick={handleCopyShareText}
                className={`h-8 px-2.5 text-xs font-semibold shrink-0 transition-all ${
                  copied 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                    : "bg-background hover:bg-muted text-foreground border border-border"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-200" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Kopyalandı!" : "Metni Kopyala"}
              </Button>
            </div>

            <div className="p-2 rounded-lg bg-background/90 border border-border/60 text-[11px] text-muted-foreground max-h-16 overflow-y-auto leading-relaxed italic">
              "{post.body ? post.body.slice(0, 150) + "..." : post.title}"
            </div>
          </div>

          {/* 🌟 3. YÖNTEM: Kendi Özel Grup Listeniz (Sırayla Aç & Yapıştır) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-foreground">
                  3. YÖNTEM: Özel Grup Listeniz ({selectedGroupIds.size} / {groups.length} Seçili)
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {groups.length} Kayıtlı Grup
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href="https://www.facebook.com/groups/joins/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-muted/80 hover:bg-muted text-[11px] font-semibold text-foreground border border-border/80 transition-colors"
                  title="Facebook'ta Katıldığınız Tüm Grupları Görün"
                >
                  <Compass className="w-3 h-3 text-[#1877F2]" />
                  Katıldığım Gruplar
                </a>

                <a
                  href="https://www.facebook.com/search/groups/?q=trabzonspor"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-muted/80 hover:bg-muted text-[11px] font-semibold text-foreground border border-border/80 transition-colors"
                  title="Facebook'ta Trabzonspor Grupları Keşfet"
                >
                  <Globe className="w-3 h-3 text-sky-500" />
                  Grup Ara
                </a>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingGroup(!isAddingGroup)}
                  className="h-7 px-2 text-[11px] font-semibold text-[#1877F2] hover:bg-sky-500/10"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Grup Ekle
                </Button>
              </div>
            </div>

            {/* Yeni Grup Ekleme Paneli */}
            {isAddingGroup && (
              <form onSubmit={handleAddNewGroup} className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1877F2] flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Üyesi Olduğunuz Gerçek Bir Grup Ekleyin
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingGroup(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    İptal
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Grup Adı (Örn: Bordo Mavi Sevdalıları)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="h-8 text-xs bg-background"
                    required
                  />
                  <Input
                    placeholder="Grup Linki (Örn: facebook.com/groups/123456...)"
                    value={newGroupUrl}
                    onChange={(e) => setNewGroupUrl(e.target.value)}
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    💡 İpucu: Facebook'ta grubun adres çubuğundaki linkini buraya yapıştırın.
                  </p>
                  <Button type="submit" size="sm" className="h-7 text-xs font-bold bg-[#1877F2] text-white hover:bg-[#166fe5]">
                    Grubu Kaydet
                  </Button>
                </div>
              </form>
            )}

            {/* Grup Listesi Grid */}
            {groups.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center mx-auto">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">
                    Henüz listenize grup eklemediniz
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Yukarıdaki <strong>"1. YÖNTEM: Otomatik Paylaşımı Aç"</strong> butonunu kullanarak hiçbir grup eklemeden de üyesi olduğunuz tüm gruplara tek tıkla paylaşabilirsiniz. Dilerseniz <strong>"+ Grup Ekle"</strong> butonundan sık kullandığınız grupları listenize kaydedebilirsiniz.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingGroup(true)}
                    className="h-8 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-[#1877F2]" />
                    Grup Ekle
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1">
                {groups.map((group) => {
                  const isSelected = selectedGroupIds.has(group.id);
                  const isShared = sharedGroupIds.has(group.id);

                  return (
                    <div
                      key={group.id}
                      onClick={() => toggleSelectGroup(group.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                        isSelected
                          ? "border-[#1877F2] bg-sky-500/5 shadow-xs ring-1 ring-sky-500/30"
                          : "border-border/70 bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-border text-[#1877F2] focus:ring-[#1877F2] cursor-pointer shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate" title={group.name}>
                            {group.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                              {group.url.replace(/^https?:\/\/(www\.)?facebook\.com\/groups\//, '')}
                            </span>
                            {isShared && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> Açıldı
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={group.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={handleCopyShareText}
                          className="p-1 rounded text-muted-foreground hover:text-[#1877F2] hover:bg-sky-500/10 transition-colors"
                          title="Grubu Aç ve Metni Kopyala"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Listeden Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sıralı Paylaşım Modu Aktif İse Canlı İlerleme & Yönlendirme Barı */}
          {stepIndex >= 0 && stepIndex < selectedGroupsList.length && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Sıralı Grup Açma Devam Ediyor: {stepIndex + 1} / {selectedGroupsList.length}
                </span>
                <p className="text-xs font-bold text-foreground">
                  Açılan grup: <span className="underline">{selectedGroupsList[stepIndex]?.name}</span>
                </p>
                <p className="text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                  👉 <strong>Nasıl Paylaşılır?</strong> Metin panonuza kopyalandı. Açılan grupta <strong>'Gönderi oluştur'</strong> kutusuna tıklayıp klavyeden <strong>Ctrl + V (Yapıştır)</strong> yapın ve Paylaş'a basın.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyShareText}
                  className="h-9 px-2.5 text-xs font-semibold bg-background"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Tekrar Kopyala
                </Button>
                <Button
                  size="sm"
                  onClick={handleNextSequentialGroup}
                  className="h-9 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md flex items-center gap-1"
                >
                  <span>Sıradaki Grubu Aç</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Meta Güvenlik Notu & Bilgilendirme */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-start gap-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <HelpCircle className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground font-semibold">Paylaşım Neden Otomatik Gelir / Gelmez?</strong> Meta (Facebook) güvenlik kuralları gereği, harici web siteleri başka bir sitenin sekmesine (`facebook.com`) gizlice yazı yazamaz. Bu nedenle:
              <br />
              • <strong>1. Yöntem:</strong> Facebook'un resmi paylaşım diyalogunu açar ve afiş + başlığı <strong>otomatik oluşturur</strong>.
              <br />
              • <strong>3. Yöntem:</strong> Grubu yeni sekmede açar, metni <strong>otomatik panonuza kopyalar</strong>; tek yapmanız gereken <strong>Ctrl + V (Yapıştır)</strong> yapmaktır.
            </p>
          </div>

        </div>

        {/* Sabit Alt Eylem Çubuğu */}
        <div className="p-3 sm:px-6 sm:py-3.5 bg-card/95 backdrop-blur-md border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-lg shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAutomaticGroupSharer}
              className="text-xs font-semibold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 h-10 px-3 flex-1 sm:flex-none"
            >
              <Zap className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              Otomatik Kartlı Paylaşım Penceresi
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleStartSequentialShare}
              className="h-10 px-4 text-xs sm:text-sm font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-md flex items-center justify-center gap-1.5 flex-1 sm:flex-none transition-all"
            >
              <Users className="w-4 h-4 text-white shrink-0" />
              <span>Grupları Sırayla Aç & Yapıştır</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
