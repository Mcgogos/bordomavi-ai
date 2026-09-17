"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-muted/30 to-background p-4 select-none">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[#5a0c1a] border border-primary/40 shadow-lg shadow-primary/20 text-white font-extrabold text-xl mb-4 ring-1 ring-white/20">
            BM
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Bordo<span className="text-[#164E7A] dark:text-sky-400">Mavi</span> <span className="text-xs uppercase px-2 py-0.5 rounded bg-sky-500/10 text-[#164E7A] dark:text-sky-400 border border-sky-500/20 align-middle">AI</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            Kurumsal Editoryal Yönetim Platformu
          </p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/5 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">Giriş Yapın</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Sisteme erişmek için yönetici bilgilerinizi giriniz.</p>
          </div>
          
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Kullanıcı Adı veya E-posta
              </label>
              <input 
                name="email"
                type="text" 
                required
                className="w-full h-10 px-3.5 rounded-lg border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60" 
                placeholder="admin"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Şifre
              </label>
              <input 
                name="password"
                type="password"
                required
                className="w-full h-10 px-3.5 rounded-lg border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60" 
                placeholder="••••••••"
              />
            </div>
            
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 font-medium text-center">
                {errorMessage}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isPending}
              className="w-full h-10 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 focus:ring-2 focus:ring-primary/50 shadow-md shadow-primary/20 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                "Sisteme Giriş Yap"
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              SSL 256-bit Güvenli Bağlantı
            </span>
            <span>v2.4 Enterprise</span>
          </div>
        </div>
      </div>
    </div>
  );
}