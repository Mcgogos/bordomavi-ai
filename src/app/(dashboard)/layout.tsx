"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Newspaper, FileText, Edit, Calendar, 
  Image as ImageIcon, BarChart3, Brain, Settings, Shield,
  LogOut, Trophy
} from "lucide-react";
import { signOut } from "next-auth/react";

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Genel" },
  { name: "Haber Akışı", href: "/news", icon: Newspaper, group: "Genel" },
  { name: "İçerik Merkezi", href: "/content", icon: FileText, group: "İçerik" },
  { name: "Editör", href: "/editor", icon: Edit, group: "İçerik" },
  { name: "Maç Günü", href: "/matchday", icon: Trophy, group: "İçerik" },
  { name: "Takvim", href: "/calendar", icon: Calendar, group: "Planlama" },
  { name: "Medya", href: "/media", icon: ImageIcon, group: "Planlama" },
  { name: "Analitik", href: "/analytics", icon: BarChart3, group: "Raporlar" },
  { name: "AI Strateji", href: "/strategy", icon: Brain, group: "Raporlar" },
  { name: "Ayarlar", href: "/settings", icon: Settings, group: "Sistem" },
  { name: "Güvenlik", href: "/settings/security", icon: Shield, group: "Sistem" },
];

const groups = ["Genel", "İçerik", "Planlama", "Raporlar", "Sistem"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Executive Sidebar */}
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col select-none">
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
          {/* Autonomous engine pulse */}
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

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0 bg-background">
        {children}
      </main>
    </div>
  );
}