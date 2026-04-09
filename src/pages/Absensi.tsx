import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapPin, CheckCircle, XCircle } from "lucide-react";
import { createAttendance, fetchAttendanceHistory, fetchSettings } from "@/lib/supabase-data";
import { EmptyState } from "@/components/ui/EmptyState";

interface AttendanceHistoryItem {
  id: string;
  type: "Harian" | "Briefing" | "Rapat";
  status: string;
  time: string;
  detail: string;
  createdAt: string;
}

export function Absensi() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [history, setHistory] = useState<AttendanceHistoryItem[]>([]);
  const [radius, setRadius] = useState<number>(100);
  const [schoolCoords, setSchoolCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadAttendanceDependencies = useCallback(async () => {
    if (!user) return;

    const [settingsResult, historyResult] = await Promise.all([fetchSettings(), fetchAttendanceHistory(user.id)]);

    if (settingsResult.data) {
      setRadius(settingsResult.data.max_radius);
      setSchoolCoords({
        lat: Number(settingsResult.data.school_lat),
        lng: Number(settingsResult.data.school_lng),
      });
    }

    if (historyResult.data) {
      setHistory(
        historyResult.data.map((item) => ({
          id: item.id,
          type: normalizeAttendanceType(item.type),
          status: item.status ?? "Tercatat",
          time: new Date(item.created_at).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          detail: buildAttendanceDetail(item.type, item.status),
          createdAt: item.created_at,
        })),
      );
    }
  }, [user]);

  useEffect(() => {
    void loadAttendanceDependencies();
  }, [loadAttendanceDependencies]);

  const todayStatus = useMemo(() => {
    return history.find((item) => item.type === "Harian" && isSameJakartaDate(item.createdAt, new Date()));
  }, [history]);

  const handleAbsen = (type: "Harian" | "Briefing" | "Rapat") => {
    setLoading(true);
    setStatus(null);

    if (type === "Harian") {
      if (todayStatus) {
        setStatus({ type: "error", message: "Absensi harian untuk hari ini sudah tercatat." });
        setLoading(false);
        return;
      }

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (!user || !schoolCoords) {
              setStatus({ type: "error", message: "Pengaturan lokasi sekolah belum tersedia." });
              setLoading(false);
              return;
            }

            const distance = getDistanceInMeters(position.coords.latitude, position.coords.longitude, schoolCoords.lat, schoolCoords.lng);

            if (distance > radius) {
              setStatus({ type: "error", message: `Di luar jangkauan sekolah. Jarak Anda ${Math.round(distance)} meter.` });
              setLoading(false);
              return;
            }

            const { error } = await createAttendance({
              user_id: user.id,
              type: "harian",
              status: "berhasil",
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });

            if (error) {
              setStatus({ type: "error", message: `Gagal menyimpan absensi: ${error.message}` });
              setLoading(false);
              return;
            }

            setStatus({ type: "success", message: "Absen Harian Berhasil! Posisi Anda sesuai radius." });
            await loadAttendanceDependencies();
            setLoading(false);
          },
          (error) => {
            setStatus({ type: "error", message: `Gagal mendapatkan lokasi: ${error.message}` });
            setLoading(false);
          },
        );
      } else {
        setStatus({ type: "error", message: "Browser Anda tidak mendukung Geolocation." });
        setLoading(false);
      }
    } else {
      void (async () => {
        if (!user) {
          setStatus({ type: "error", message: "User tidak ditemukan." });
          setLoading(false);
          return;
        }

        const typeKey = type.toLowerCase();
        const { error } = await createAttendance({
          user_id: user.id,
          type: typeKey,
          status: "hadir",
        });

        if (error) {
          setStatus({ type: "error", message: `Gagal menyimpan absensi: ${error.message}` });
          setLoading(false);
          return;
        }

        const detail = `Absen ${type} Berhasil direkam!`;
        setStatus({ type: "success", message: detail });
        await loadAttendanceDependencies();
        setLoading(false);
      })();
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Modul Absensi</h2>
          <p className="page-description">Catat kehadiran harian dan absensi cepat kegiatan sekolah dengan alur yang lebih jelas.</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/25 bg-[#000080] px-4 py-5 text-white sm:px-6 sm:py-6">
        <p className="text-sm text-white/75">Status Hari Ini</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium">{user?.name || "Guru"}</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm">Radius {radius} meter</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm">Briefing & Rapat Tersedia</span>
          {todayStatus && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm">Harian: {todayStatus.status}</span>}
        </div>
      </div>

      {status && (
        <div className={`flex flex-col items-start gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {status.type === "success" ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          <p className="font-medium">{status.message}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Absen Harian
            </CardTitle>
            <CardDescription>Absen wajib menggunakan lokasi GPS Anda. Harus berada dalam radius sekolah.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" size="lg" onClick={() => handleAbsen("Harian")} disabled={loading || Boolean(todayStatus)}>
              {loading ? "Memproses..." : todayStatus ? "Absen Harian Sudah Tercatat" : "Lakukan Absen Harian"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Absen Cepat Tanggap</CardTitle>
            <CardDescription>Gunakan tombol di bawah ini saat mengikuti kegiatan briefing pagi atau rapat sekolah (1-Klik).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => handleAbsen("Briefing")} disabled={loading}>
              Hadir Briefing Pagi
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleAbsen("Rapat")} disabled={loading}>
              Hadir Rapat Sekolah
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Absensi Saya</CardTitle>
          <CardDescription>Lihat riwayat absensi harian, briefing, dan rapat yang sudah tercatat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-medium text-[#000080]">{item.type}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{item.status}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900">{item.detail}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.time}</p>
              </div>
              <div className="text-sm text-muted-foreground">Guru: {user?.name || "Guru"}</div>
            </div>
          ))}
          {history.length === 0 && <EmptyState title="Belum Ada Riwayat Absensi" description="Riwayat absensi harian, briefing, dan rapat akan tampil di sini setelah Anda melakukan absensi." icon={MapPin} />}
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeAttendanceType(type: string): "Harian" | "Briefing" | "Rapat" {
  const normalized = type.toLowerCase();
  if (normalized === "briefing") return "Briefing";
  if (normalized === "rapat") return "Rapat";
  return "Harian";
}

function buildAttendanceDetail(type: string, status: string | null) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === "briefing") return "Absensi 1-klik briefing berhasil direkam.";
  if (normalizedType === "rapat") return "Absensi rapat sekolah berhasil direkam.";
  return status?.toLowerCase() === "berhasil" ? "Tercatat dalam radius sekolah." : "Riwayat absensi harian tersimpan.";
}

function getDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function isSameJakartaDate(input: string, compareDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(input)) === formatter.format(compareDate);
}
