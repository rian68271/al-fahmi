import React, { useEffect, useState } from "react";
import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Sparkles, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { fetchNotifications, type NotificationRecord } from "@/lib/supabase-data";

interface HeaderProps {
  onMenuClick: () => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Dashboard",
    description: "Ringkasan aktivitas sekolah, absensi, dan penilaian dalam satu tampilan.",
  },
  "/absensi": {
    title: "Absensi Guru",
    description: "Kelola absensi harian berbasis lokasi dan absensi cepat tanggap.",
  },
  "/penilaian": {
    title: "Penilaian Al-Qur'an",
    description: "Input nilai Tahfidz dan Tahsin dengan alur yang lebih terstruktur.",
  },
  "/pengaturan": {
    title: "Pengaturan Sekolah",
    description: "Atur titik sekolah, radius absensi, dan konfigurasi inti aplikasi.",
  },
  "/laporan": {
    title: "Laporan",
    description: "Pantau rekap dan ekspor data absensi maupun penilaian ke Excel.",
  },
  "/nilai-saya": {
    title: "Nilai Saya",
    description: "Lihat progres capaian belajar Al-Qur'an dengan ringkas dan jelas.",
  },
  "/profil": {
    title: "Profil Pengguna",
    description: "Perbarui informasi akun agar data pengguna selalu akurat.",
  },
  "/kalender": {
    title: "Kalender Sekolah",
    description: "Lihat agenda penting sekolah dan kegiatan akademik mendatang.",
  },
  "/siswa": {
    title: "Manajemen Data",
    description: "Kelola master data guru dan siswa, audit trail, backup, serta import/export administrasi.",
  },
};

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  guru: "Guru",
  siswa: "Siswa",
};

export function Header({ onMenuClick, onToggleSidebar, isSidebarCollapsed }: HeaderProps) {
  const { user, signOut } = useAuthStore();
  const location = useLocation();
  const meta = pageMeta[location.pathname] ?? pageMeta["/"];
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) return;
      const { data } = await fetchNotifications({ role: user.role, recipientId: user.id, limit: 3 });
      setNotifications(data ?? []);
    };

    void loadNotifications();
  }, [user]);

  const notificationSummary = notifications[0]?.title ?? "Belum ada notifikasi";
  const notificationCount = notifications.length;

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="hidden md:inline-flex" onClick={onToggleSidebar}>
            {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Workspace Al-Fahmi
            </div>
            <h2 className="truncate text-lg font-semibold text-slate-900 md:text-xl">{meta.title}</h2>
            <p className="hidden truncate text-sm text-muted-foreground xl:block">{meta.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-border/80 bg-white/80 px-3 py-2 shadow-sm lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-slate-900">{notificationCount} notifikasi aktif</p>
              <p className="text-[11px] text-muted-foreground">{notificationSummary}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-white/85 px-2.5 py-2 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name || "User"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.role ? roleLabel[user.role] : "Guest"}
                {user?.sekolah ? ` • ${user.sekolah}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 lg:mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
