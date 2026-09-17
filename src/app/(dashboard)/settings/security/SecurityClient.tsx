"use client";

import { useState } from "react";
import { changePasswordAction } from "./actions";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function SecurityClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }
    
    setIsLoading(true);
    const res = await changePasswordAction(currentPassword, newPassword);
    if (res.success) {
      toast.success("Şifreniz başarıyla değiştirildi.");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      toast.error(res.error || "Şifre değiştirilirken bir hata oluştu.");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-card border border-border/80 rounded-2xl shadow-xs max-w-xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/60">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Yönetici Şifresini Değiştir</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Hesap erişim şifrenizi istediğiniz zaman güvenle güncelleyebilirsiniz.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Mevcut Şifre</label>
            <input 
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3.5 bg-background border border-border/80 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Yeni Şifre</label>
            <input 
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full h-10 px-3.5 bg-background border border-border/80 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              placeholder="En az 6 karakter"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-10 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 focus:ring-2 focus:ring-primary/50 shadow-sm shadow-primary/20 disabled:opacity-50 transition-all cursor-pointer mt-2"
          >
            {isLoading ? "Güncelleniyor..." : "Şifreyi Güvenle Güncelle"}
          </button>
        </form>
      </div>
    </div>
  );
}