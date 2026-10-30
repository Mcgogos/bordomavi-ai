"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Newspaper, Settings, LogOut, Menu, X } from "lucide-react";
import { signOut } from "next-auth/react";

const menu = [
  { name: "Ana Panel (Reels & Trendler)", href: "/dashboard", icon: LayoutDashboard },
  { name: "Haber Akışı", href: "/news", icon: Newspaper },
  { name: "Ayarlar", href: "/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const currentPage = menu.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col lg:flex-row">
      {/* 1. Mobil Üst Header Bar */}
      <header className="lg:hidden h-14 border-b border-border/80 bg-card/95 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#5a0c1a] border border-primary/40 flex items-center justify-center font-bold text-white shadow-xs">
            <span className="text-[11px] tracking-wider">BM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-foreground">
              Bordo<span className="text-sky-400 font-extrabold">Mavi</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
              AI
            </span>
          </div>
          {currentPage && (
            <span className="hidden sm:inline-flex text-[11px] font-medium text-muted-foreground ml-2 pl-2 border-l border-border/80">
              {currentPage.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>7/24 Otomatik</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menüyü Aç"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-foreground hover:bg-muted transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. Mobil Çekmece */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="w-64 max-w-[85vw] h-full bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border/80">
              <span className="font-bold text-xs text-sidebar-foreground">
                Bordo<span className="text-sky-400 font-extrabold">Mavi</span> AI Otomasyon
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1.5">
              {menu.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-sidebar-border/80">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center justify-between w-full px-3 py-2 text-xs text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent rounded-lg"
              >
                <span>Oturumu Kapat</span>
                <LogOut className="w-4 h-4 opacity-60" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 3. Sade Masaüstü Sol Menü */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex-col select-none">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border/80 bg-sidebar/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[#5a0c1a] border border-primary/40 flex items-center justify-center font-bold text-white shadow-sm">
              <span className="text-xs tracking-wider">BM</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-sidebar-foreground tracking-tight">
                  Bordo<span className="text-sky-400 font-extrabold">Mavi</span>
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
                  AI
                </span>
              </div>
              <div className="text-[10px] text-sidebar-foreground/50">7/24 Otonom Sistem</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border/80 bg-sidebar/40 space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sidebar-foreground/90 font-semibold">7/24 Oto-Yayın</span>
            </div>
            <span className="text-emerald-400 font-bold text-[10px]">AKTİF</span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-between w-full px-3 py-2 text-xs text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent rounded-lg transition-all"
          >
            <span className="font-medium">Oturumu Kapat</span>
            <LogOut className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      </aside>

      {/* 4. Ana İçerik Alanı */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-background pb-18 md:pb-0">
        {children}
      </main>

      {/* 5. Mobil Alt Navigasyon */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/80 flex items-center justify-around h-15 px-1 shadow-lg select-none">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="mt-0.5 tracking-tight">{item.name.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
