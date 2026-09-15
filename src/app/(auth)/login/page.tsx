"use client";

import { useActionState, useEffect, useState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(loginAction, undefined);
  const [needs2FA, setNeeds2FA] = useState(false);

  useEffect(() => {
    if (errorMessage === "2FA_REQUIRED") {
      setNeeds2FA(true);
    }
  }, [errorMessage]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 rounded-xl border border-border bg-card">
        <h1 className="text-2xl font-bold text-center mb-6">
          <span className="text-[oklch(0.488_0.243_264.376)]">BORDO </span>MAVİ
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">AI Editör Girişi</p>
        
        <form action={formAction} className="space-y-4">
          <div className={needs2FA ? "hidden" : "block"}>
            <label className="block text-sm font-medium mb-1">E-posta</label>
            <input 
              name="email"
              type="email" 
              className="w-full p-2 rounded-md border border-input bg-background" 
              placeholder="admin@bordomavi.com"
            />
          </div>
          <div className={needs2FA ? "hidden" : "block"}>
            <label className="block text-sm font-medium mb-1">Şifre</label>
            <input 
              name="password"
              type="password"
              className="w-full p-2 rounded-md border border-input bg-background" 
            />
          </div>

          {needs2FA && (
            <div>
              <label className="block text-sm font-medium mb-1 text-primary">Authenticator Kodu (2FA)</label>
              <input 
                name="token"
                type="text"
                autoComplete="one-time-code"
                placeholder="123456"
                className="w-full p-2 rounded-md border border-input bg-background text-center text-2xl tracking-widest" 
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Google Authenticator uygulamanızdaki 6 haneli kodu girin.
              </p>
            </div>
          )}
          
          {errorMessage && errorMessage !== "2FA_REQUIRED" && (
            <div className="text-sm text-destructive text-center font-medium">{errorMessage}</div>
          )}
          
          <button 
            type="submit" 
            disabled={isPending}
            className="w-full py-2 px-4 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Bekleyin..." : (needs2FA ? "Kodu Doğrula" : "Giriş Yap")}
          </button>
        </form>
      </div>
    </div>
  );
}