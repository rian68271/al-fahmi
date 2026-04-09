import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Calendar, Home, MapPin, UserCircle, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  const links =
    user.role === "admin"
      ? [
          { name: "Home", href: "/", icon: Home },
          { name: "Kalender", href: "/kalender", icon: Calendar },
          { name: "Data", href: "/siswa", icon: Users },
          { name: "Profil", href: "/profil", icon: UserCircle },
        ]
      : user.role === "guru"
        ? [
            { name: "Home", href: "/", icon: Home },
            { name: "Absensi", href: "/absensi", icon: MapPin },
            { name: "Nilai", href: "/penilaian", icon: BookOpen },
            { name: "Profil", href: "/profil", icon: UserCircle },
          ]
        : [
            { name: "Home", href: "/", icon: Home },
            { name: "Kalender", href: "/kalender", icon: Calendar },
            { name: "Nilai", href: "/nilai-saya", icon: BookOpen },
            { name: "Profil", href: "/profil", icon: UserCircle },
          ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl md:hidden">
      <nav className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-3xl border border-border/70 bg-white/90 p-1.5 shadow-[0_-8px_30px_-24px_rgba(0,0,128,0.28)]">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.href || (link.href !== "/" && location.pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition",
                isActive ? "bg-[#eef0ff] text-[#000080]" : "text-slate-500"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
