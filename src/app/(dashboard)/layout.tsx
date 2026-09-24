"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Newspaper, FileText, Edit, Calendar, 
  Image as ImageIcon, BarChart3, Brain, Settings, Shield,
  LogOut, Menu, X
} from "lucide-react";
import { signOut } from "next-auth/react";

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Genel" },
  { name: "Haber Akışı", href: "/news", icon: Newspaper, group: "Genel" },
  { name: "İçerik Merkezi", href: "/content", icon: FileText, group: "İçerik" },
  { name: "Editör", href: "/editor", icon: Edit, group: "İçerik" },
  { name: "Takvim", href: "/calendar", icon: Calendar, group: "Planlama" },
  { name: "Medya", href: "/media", icon: ImageIcon, group: "Planlama" },
  { name: "Analitik", href: "/analytics", icon: BarChart3, group: "Raporlar" },
  { name: "AI Strateji", href: "/strategy", icon: Brain, group: "Raporlar" },
  { name: "Ayarlar", href: "/settings", icon: Settings, group: "Sistem" },
  { name: "Güvenlik", href: "/settings/security", icon: Shield, group: "Sistem" },
];

const mobileBottomNav = [
  { name: "Özet", href: "/dashboard", icon: LayoutDashboard },
  { name: "Haberler", href: "/news", icon: Newspaper },
  { name: "İçerik", href: "/content", icon: FileText },
  { name: "Editör", href: "/editor", icon: Edit },
  { name: "Medya", href: "/media", icon: ImageIcon },
];

const groups = ["Genel", "İçerik", "Planlama", "Raporlar", "Sistem"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close drawer when pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Find current active page title for mobile header
  const currentPage = menu.find(m => pathname === m.href || pathname.startsWith(m.href + "/"));

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col lg:flex-row">
      
      {/* 1. Mobil Üst Header Bar (Sadece < lg ekranlarda görünür) */}
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
          {/* Otonom Canlı Göstergesi */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-sidebar-accent/50 border border-sidebar-border text-[10px] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">Oto-Yayın</span>
          </div>

          {/* Mobil Menü Butonu */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menüyü Aç"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-foreground hover:bg-muted active:scale-95 transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. Mobil Çekmece (Drawer / Sheet Menu) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside 
            className="w-72 max-w-[85vw] h-full bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border/80 bg-sidebar/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#5a0c1a] border border-primary/40 flex items-center justify-center font-bold text-white shadow-xs">
                  <span className="text-[11px] tracking-wider">BM</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xs text-sidebar-foreground">
                      Bordo<span className="text-sky-400 font-extrabold">Mavi</span> AI
                    </span>
                  </div>
                  <span className="text-[9px] text-sidebar-foreground/50">Yönetim Menüsü</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Links */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
              {groups.map((group) => {
                const items = menu.filter((m) => m.group === group);
                return (
                  <div key={group} className="space-y-1">
                    <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                      {group}
                    </div>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-white"
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-sidebar-foreground/60"}`} />
                            <span>{item.name}</span>
                            {isActive && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-sidebar-border/80 bg-sidebar/40 space-y-2">
              <button 
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent rounded-lg transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/30 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    A
                  </div>
                  <span className="font-medium">Oturumu Kapat</span>
                </div>
                <LogOut className="w-4 h-4 opacity-60" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 3. Masaüstü Executive Sidebar (Sadece lg ve üstü ekranlarda görünür) */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex-col select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border/80 bg-sidebar/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[#5a0c1a] border border-primary/40 flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-white/10">
              <span className="text-xs tracking-wider">BM</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-sidebar-foreground tracking-tight">
                  Bordo<span className="text-sky-400 font-extrabold">Mavi</span>
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase tracking-wide">
                  AI
                </span>
              </div>
              <div className="text-[10px] text-sidebar-foreground/50 tracking-wider">
                Kurumsal Editoryal Sistem
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {groups.map((group) => {
            const items = menu.filter((m) => m.group === group);
            return (
              <div key={group} className="space-y-1">
                <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-semibold"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-white"
                        }`}
                      >
                        <Icon className={`w-4 h-4 transition-transform group-hover:scale-105 ${isActive ? "text-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-white"}`} />
                        <span>{item.name}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer status & User Profile */}
        <div className="p-3 border-t border-sidebar-border/80 bg-sidebar/40 space-y-2">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-sidebar-accent/50 border border-sidebar-border/50 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sidebar-foreground/70 font-medium">Oto-Yayın Motoru</span>
            </div>
            <span className="text-emerald-400 font-semibold text-[10px]">Aktif</span>
          </div>

          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center justify-between w-full px-2.5 py-2 text-xs text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent rounded-lg transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/30 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                A
              </div>
              <span className="font-medium">Yönetici Oturumu</span>
            </div>
            <LogOut className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      </aside>

      {/* 4. Ana İçerik Alanı (Mobilde alttaki menü payı ile birlikte kaydırılabilir) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-background pb-18 md:pb-0">
        {children}
      </main>

      {/* 5. Mobil Başparmak Hızlı Erişim Alt Çubuğu (Bottom Navigation Bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/80 flex items-center justify-around h-16 px-1 shadow-lg select-none">
        {mobileBottomNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1 rounded-lg transition-all ${isActive ? "bg-primary/10 text-primary scale-110" : ""}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="mt-0.5 tracking-tight">{item.name}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-4 h-4" />
          </div>
          <span className="mt-0.5 tracking-tight">Daha Fazla</span>
        </button>
      </nav>

    </div>
  );
}