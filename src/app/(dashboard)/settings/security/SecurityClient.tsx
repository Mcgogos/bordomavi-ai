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
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/20 rounded-lg">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Şifre Değiştir</h3>
            <p className="text-sm text-muted-foreground">Hesap şifrenizi istediğiniz zaman güncelleyebilirsiniz.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium mb-1">Mevcut Şifre</label>
            <input 
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full p-2 bg-background border border-input rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yeni Şifre</label>
            <input 
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full p-2 bg-background border border-input rounded-md"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Bekleyin..." : "Şifreyi Güncelle"}
          </button>
        </form>
      </div>
    </div>
  );
}