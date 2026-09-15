"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 rounded-xl border border-border bg-card">
        <h1 className="text-2xl font-bold text-center mb-6">
          <span className="text-[oklch(0.488_0.243_264.376)]">BORDO </span>MAVİ
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">AI Editör Girişi</p>
        
        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kullanıcı Adı</label>
            <input 
              name="email"
              type="text" 
              className="w-full p-2 rounded-md border border-input bg-background" 
              placeholder="Kullanıcı Adı"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Şifre</label>
            <input 
              name="password"
              type="password"
              className="w-full p-2 rounded-md border border-input bg-background" 
            />
          </div>
          
          {errorMessage && (
            <div className="text-sm text-destructive text-center font-medium">{errorMessage}</div>
          )}
          
          <button 
            type="submit" 
            disabled={isPending}
            className="w-full py-2 px-4 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Bekleyin..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}