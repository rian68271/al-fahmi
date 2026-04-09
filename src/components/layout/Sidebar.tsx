import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Calendar, Home, MapPin, Settings, UserCircle, Users, X } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
}

export function Sidebar({ open, onClose, collapsed }: SidebarProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  const links = [
    { name: "Dashboard", href: "/", icon: Home, roles: ["admin", "guru", "siswa"] },
    { name: "Absensi", href: "/absensi", icon: MapPin, roles: ["guru"] },
    { name: "Penilaian Al-Qur'an", href: "/penilaian", icon: BookOpen, roles: ["guru"] },
    { name: "Kalender", href: "/kalender", icon: Calendar, roles: ["admin", "guru", "siswa"] },
    { name: "Manajemen Data", href: "/siswa", icon: Users, roles: ["admin"] },
    { name: "Pengaturan", href: "/pengaturan", icon: Settings, roles: ["admin"] },
    { name: "Laporan", href: "/laporan", icon: BookOpen, roles: ["admin"] },
    { name: "Nilai Saya", href: "/nilai-saya", icon: BookOpen, roles: ["siswa"] },
    { name: "Profil", href: "/profil", icon: UserCircle, roles: ["admin", "guru", "siswa"] },
  ];

  const filteredLinks = links.filter((link) => user?.role && link.roles.includes(user.role));

  return (
    <>
      <div className={cn("fixed inset-0 z-40 bg-[#000080]/20 backdrop-blur-sm transition-opacity md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[280px] flex-col border-r border-white/20 bg-[#000080] px-3 py-4 text-white shadow-xl transition-all duration-300 sm:px-4 md:sticky md:top-0 md:z-20 md:h-screen md:max-w-none md:translate-x-0",
          collapsed ? "md:w-[92px]" : "md:w-[280px]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("mb-5 flex items-center justify-between px-2", collapsed && "md:justify-center")}>
          <div className="min-w-0">
            <p className={cn("text-[11px] font-medium uppercase tracking-[0.22em] text-white/75", collapsed && "md:hidden")}>Platform Sekolah</p>
            <h1 className={cn("mt-1 text-2xl font-semibold tracking-tight text-white", collapsed && "md:mt-0 md:text-lg")}>{collapsed ? "AF" : "Al-Fahmi"}</h1>
          </div>
          <Button variant="ghost" size="icon" className="text-white md:hidden hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className={cn("mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75", collapsed && "md:hidden")}>Navigasi</div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {filteredLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href || (link.href !== "/" && location.pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                  collapsed && "md:justify-center md:px-2",
                  isActive ? "bg-white text-[#000080] shadow-lg shadow-[rgba(0,0,128,0.14)]" : "text-white/95 hover:bg-white/12 hover:text-white",
                )}
                title={collapsed ? link.name : undefined}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors", isActive ? "bg-[#eef0ff] text-primary" : "bg-white/10 text-white/95 group-hover:bg-white/15")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={cn("min-w-0 flex-1 truncate", collapsed && "md:hidden")}>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-white/20 px-2 pt-4">
          <div className={cn("flex items-center gap-3", collapsed && "md:justify-center")}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sm font-semibold text-white">{(user?.name || "U").slice(0, 1)}</div>
            <div className={cn("min-w-0", collapsed && "md:hidden")}>
              <p className="truncate text-sm font-semibold text-white">{user?.name || "User"}</p>
              <p className="truncate text-xs text-white/75">
                {user?.role || "Guest"}
                {user?.sekolah ? ` • ${user.sekolah}` : ""}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
