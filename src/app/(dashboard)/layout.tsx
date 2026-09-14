"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Newspaper, FileText, Edit, Calendar, 
  Image as ImageIcon, BarChart3, Brain, Settings, 
  Zap, ChevronRight
} from "lucide-react";

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Genel" },
  { name: "Haber Merkezi", href: "/news", icon: Newspaper, group: "İçerik" },
  { name: "İçerik Merkezi", href: "/content", icon: FileText, group: "İçerik" },
  { name: "Editör", href: "/editor", icon: Edit, group: "İçerik" },
  { name: "Takvim", href: "/calendar", icon: Calendar, group: "Planlama" },
  { name: "Medya", href: "/media", icon: ImageIcon, group: "Planlama" },
  { name: "Analitik", href: "/analytics", icon: BarChart3, group: "Raporlar" },
  { name: "AI Strateji", href: "/strategy", icon: Brain, group: "Raporlar" },
  { name: "Ayarlar", href: "/settings", icon: Settings, group: "Sistem" },
];

const groups = ["Genel", "İçerik", "Planlama", "Raporlar", "Sistem"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold text-sidebar-foreground leading-tight tracking-wide">
                <span className="text-primary">BORDO</span>
                <span className="text-blue-400">MAVİ</span>
              </div>
              <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">AI Editör</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {groups.map((group) => {
            const items = menu.filter((m) => m.group === group);
            return (
              <div key={group}>
                <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
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
                        className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all group ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{item.name}</span>
                        {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer status */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-[11px] text-sidebar-foreground/50">Oto-Yayın Aktif</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
