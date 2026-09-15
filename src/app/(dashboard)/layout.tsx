"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Newspaper, FileText, Edit, Calendar, 
  Image as ImageIcon, BarChart3, Brain, Settings, Shield,
  LogOut
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

const groups = ["Genel", "İçerik", "Planlama", "Raporlar", "Sistem"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">
              BM
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-sidebar-foreground">BordoMavi<span className="text-[oklch(0.488_0.243_264.376)]">AI</span></span>
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
                        <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-70 group-hover:opacity-100"}`} />
                        {item.name}
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
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}