"use client";

import { useState, useEffect } from "react";
import { 
  Users, X, Copy, ExternalLink, Check, Plus, Trash2, 
  Share2, CheckCircle2, ArrowRight, Sparkles, ShieldCheck
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

const STORAGE_KEY = "bordo_mavi_saved_fb_groups_v1";

const DEFAULT_TRABZONSPOR_GROUPS: FacebookGroupItem[] = [
  {
    id: "ts-group-1",
    name: "Trabzonspor Taraftarlar Platformu",
    url: "https://www.facebook.com/groups/trabzonspor.taraftarlari",
    members: "120K+ Üye",
  },
  {
    id: "ts-group-2",
    name: "Bordo Mavi Fırtına Dayanışma Grubu",
    url: "https://www.facebook.com/groups/bordomavifirtina",
    members: "85K+ Üye",
  },
  {
    id: "ts-group-3",
    name: "61 Trabzonsporlular Platformu",
    url: "https://www.facebook.com/groups/61trabzonsporlular",
    members: "65K+ Üye",
  },
  {
    id: "ts-group-4",
    name: "Trabzonspor Gündem & Transfer Kulübü",
    url: "https://www.facebook.com/groups/trabzonsporgundem",
    members: "45K+ Üye",
  },
  {
    id: "ts-group-5",
    name: "Kuzeyin Kralları - TS Fan Club",
    url: "https://www.facebook.com/groups/kuzeyinkrallari",
    members: "40K+ Üye",
  },
  {
    id: "ts-group-6",
    name: "Trabzonspor Sevdalıları Topluluğu",
    url: "https://www.facebook.com/groups/trabzonsporsevdalilari",
    members: "30K+ Üye",
  },
];

export function FacebookGroupShareModal({
  isOpen,
  onClose,
  post,
}: FacebookGroupShareModalProps) {
  const [groups, setGroups] = useState<FacebookGroupItem[]>(DEFAULT_TRABZONSPOR_GROUPS);
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
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGroups(parsed);
            return;
          }
        }
      } catch {
        // Fallback default
      }
    }
  }, []);

  // Modal açıldığında tüm grupları varsayılan olarak seç
  useEffect(() => {
    if (isOpen) {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)));
      setSharedGroupIds(new Set());
      setStepIndex(-1);
    }
  }, [isOpen, groups]);

  if (!isOpen || !post) return null;

  // Facebook post URL'sini çöz
  const getPostFacebookUrl = () => {
    if (post.facebookPostId && post.facebookPostId.length > 5 && !post.facebookPostId.startsWith("mock-")) {
      return `https://www.facebook.com/${post.facebookPostId}`;
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bordomavi-ai.vercel.app";
    return `${baseUrl}/content`;
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
    text += `\n\n🔗 Haberin Detayı: ${postUrl}`;
    return text;
  };

  const handleCopyShareText = async () => {
    try {
      const fullText = getFullShareMessage();
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success("📋 Haber metni ve bağlantı panoya kopyalandı! Gruplarda Ctrl+V ile yapıştırabilirsiniz.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Panoya kopyalanamadı.");
    }
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

  const handleToggleSelectAll = () => {
    if (selectedGroupIds.size === groups.length) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)));
    }
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
        validUrl = `https://www.facebook.com/groups/${validUrl}`;
      }
    }

    const newGroup: FacebookGroupItem = {
      id: `custom-group-${Date.now()}`,
      name: newGroupName.trim(),
      url: validUrl,
      members: "Kişisel Grup",
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

  // 1. Sıralı Akıllı Paylaşım: Kullanıcıyı adım adım gruplara yönlendirir (Pop-up engeline takılmaz)
  const selectedGroupsList = groups.filter((g) => selectedGroupIds.has(g.id));

  const handleStartSequentialShare = async () => {
    if (selectedGroupsList.length === 0) {
      toast.error("Lütfen en az bir grup seçin.");
      return;
    }

    // Metni otomatik kopyala
    await handleCopyShareText();

    // 0. adımdan başla
    const firstGroup = selectedGroupsList[0];
    setStepIndex(0);
    setSharedGroupIds((prev) => new Set([...Array.from(prev), firstGroup.id]));

    window.open(firstGroup.url, "_blank", "noopener,noreferrer");
    toast.success(`1/${selectedGroupsList.length} grup açıldı: ${firstGroup.name}. Metin panonuzda, yapıştırıp gönderin!`);
  };

  const handleNextSequentialGroup = () => {
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

  // 2. Tümünü Yeni Sekmelerde Aç
  const handleOpenAllSelected = async () => {
    if (selectedGroupsList.length === 0) {
      toast.error("Lütfen en az bir grup seçin.");
      return;
    }

    await handleCopyShareText();

    let openedCount = 0;
    selectedGroupsList.forEach((group) => {
      try {
        window.open(group.url, "_blank", "noopener,noreferrer");
        openedCount++;
        setSharedGroupIds((prev) => new Set([...Array.from(prev), group.id]));
      } catch {
        // Pop-up engeli
      }
    });

    if (openedCount > 0) {
      toast.success(`🚀 ${openedCount} grup yeni sekmede açıldı! Haber metni panonuzda kopyalandı.`);
    } else {
      toast.warning("Tarayıcınız çoklu sekmeleri engelledi. 'Sırayla Aç & Paylaş' butonunu kullanabilirsiniz.");
    }
  };

  // 3. Facebook Resmi Sharer Dialog'u Aç (Grupta Paylaş seçeneği için)
  const handleOpenOfficialSharer = () => {
    const sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    window.open(sharerUrl, "_blank", "width=640,height=600,scrollbars=yes");
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
                  Facebook Gruplarında Toplu Paylaşım Asistanı
                </h2>
                <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-500 border-sky-500/30">
                  1-Tıkla Gruplar
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Yayınlanan haberinizi üyesi olduğunuz Trabzonspor gruplarında güvenle ve toplu seçimle paylaşın.
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* 1. Haber Özeti ve Hızlı Kopyalama Kartı */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Paylaşılacak Gönderi
                </span>
                <h3 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 leading-snug">
                  {post.title}
                </h3>
              </div>

              <Button
                size="sm"
                onClick={handleCopyShareText}
                className={`h-9 px-3 text-xs font-semibold shrink-0 transition-all ${
                  copied 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                    : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-200" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Kopyalandı!" : "Metni & Linki Kopyala"}
              </Button>
            </div>

            {/* Gönderi Önizleme Alanı */}
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/60 text-xs text-muted-foreground max-h-24 overflow-y-auto leading-relaxed">
              <p className="line-clamp-3 italic">
                "{post.body ? post.body.slice(0, 200) + "..." : post.title}"
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-sky-600 dark:text-sky-400 font-mono">
                <span className="truncate">{postUrl}</span>
                <a 
                  href={postUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="hover:underline flex items-center shrink-0"
                >
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>
          </div>

          {/* 2. Grup Seçim Listesi (Toplu Onay Kutuları) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-foreground">
                  Hedef Gruplar ({selectedGroupIds.size} / {groups.length} Seçili)
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {groups.length} Grup
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectAll}
                  className="h-7 px-2.5 text-[11px] font-semibold border-border/80"
                >
                  {selectedGroupIds.size === groups.length ? "Seçimi Kaldır" : "Tümünü Seç"}
                </Button>

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
                    <Plus className="w-3.5 h-3.5" /> Üyesi Olduğunuz Yeni Bir Grup Ekleyin
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
                    placeholder="Grup Adı (Örn: Trabzonspor Aşkı)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                  <Input
                    placeholder="Grup Linki veya ID (Örn: facebook.com/groups/...)"
                    value={newGroupUrl}
                    onChange={(e) => setNewGroupUrl(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="sm" className="h-7 text-xs font-bold bg-[#1877F2] text-white hover:bg-[#166fe5]">
                    Grup Listeme Kaydet
                  </Button>
                </div>
              </form>
            )}

            {/* Grup Listesi Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
              {groups.map((group) => {
                const isSelected = selectedGroupIds.has(group.id);
                const isShared = sharedGroupIds.has(group.id);

                return (
                  <div
                    key={group.id}
                    onClick={() => toggleSelectGroup(group.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                      isSelected
                        ? "border-[#1877F2] bg-sky-500/5 shadow-xs ring-1 ring-sky-500/30"
                        : "border-border/70 bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // onClick parent handles it
                        className="w-4 h-4 rounded border-border text-[#1877F2] focus:ring-[#1877F2] cursor-pointer shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate" title={group.name}>
                            {group.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {group.members && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {group.members}
                            </span>
                          )}
                          {isShared && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Paylaşıldı
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
                        className="p-1 rounded text-muted-foreground hover:text-[#1877F2] hover:bg-sky-500/10 transition-colors"
                        title="Grubu Facebook'ta Aç"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {group.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Listeden Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Sıralı Paylaşım Modu Aktif İse İlerleme Barı */}
          {stepIndex >= 0 && stepIndex < selectedGroupsList.length && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                  <span>⏳</span> Sıralı Paylaşım Devam Ediyor: {stepIndex + 1} / {selectedGroupsList.length}
                </span>
                <p className="text-xs font-semibold text-foreground">
                  Açılan grup: <span className="underline">{selectedGroupsList[stepIndex]?.name}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Metin panoda kopyalandı. Gönderiyi yapıştırıp paylaştıktan sonra sıradaki gruba geçin.
                </p>
              </div>

              <Button
                size="sm"
                onClick={handleNextSequentialGroup}
                className="h-9 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shrink-0 flex items-center gap-1"
              >
                <span>Sıradaki Grubu Aç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Güvenlik Bilgilendirme Notu */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-start gap-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground font-semibold">Meta & Facebook Güvenlik Koruması:</strong> Gruplarda harici botlarla arka planda otomatik yazı bastırmak hesabınızın ve sayfanızın Facebook tarafından spam nedeniyle kapatılmasına yol açar. Bu asistan, metni panoya hazır kopyalayarak seçtiğiniz grupları açar ve en güvenli şekilde organik paylaşım yapmanızı sağlar.
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
              onClick={handleOpenOfficialSharer}
              className="text-xs font-semibold border-border text-muted-foreground hover:text-foreground h-10 px-3"
            >
              <Share2 className="w-3.5 h-3.5 mr-1 text-[#1877F2]" />
              Facebook Resmi Paylaşım Penceresi
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAllSelected}
              disabled={selectedGroupIds.size === 0}
              className="text-xs font-semibold border-border h-10 px-3 flex-1 sm:flex-none"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Tümünü Yeni Sekmelerde Aç ({selectedGroupIds.size})
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleStartSequentialShare}
              disabled={selectedGroupIds.size === 0}
              className="h-10 px-4 text-xs sm:text-sm font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-md flex items-center justify-center gap-1.5 flex-1 sm:flex-none transition-all"
            >
              <Users className="w-4 h-4 text-white shrink-0" />
              <span>Sırayla Grupları Aç & Paylaş</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
