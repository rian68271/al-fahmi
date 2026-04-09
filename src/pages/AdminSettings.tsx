import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Settings } from "lucide-react";
import { fetchSettings, upsertSettings } from "@/lib/supabase-data";

export function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [settingsId, setSettingsId] = useState<string | undefined>(undefined);
  const [lat, setLat] = useState("-6.200000");
  const [lng, setLng] = useState("106.816666");
  const [radius, setRadius] = useState("100");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await fetchSettings();
      if (error) {
        setMessage(`Gagal memuat pengaturan: ${error.message}`);
        return;
      }
      if (!data) return;

      setSettingsId(data.id);
      setLat(String(data.school_lat));
      setLng(String(data.school_lng));
      setRadius(String(data.max_radius));
    };

    void loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error, data } = await upsertSettings({
      id: settingsId,
      school_lat: Number(lat),
      school_lng: Number(lng),
      max_radius: Number(radius),
    });

    if (error) {
      setMessage(`Gagal menyimpan pengaturan: ${error.message}`);
      setLoading(false);
      return;
    }

    setSettingsId(data.id);
    setMessage("Pengaturan berhasil disimpan.");
    setLoading(false);
  };

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
          setMessage("Lokasi saat ini berhasil diambil.");
        },
        (error) => {
          setMessage(`Gagal mendapatkan lokasi: ${error.message}`);
        },
      );
    } else {
      setMessage("Browser Anda tidak mendukung geolocation.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <SectionHeader title="Pengaturan Sekolah" description="Konfigurasi titik sekolah dan batas radius absensi dengan tampilan yang lebih rapi dan mudah dipantau." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Latitude" value={lat} icon={Settings} />
        <StatCard label="Longitude" value={lng} icon={Settings} />
        <StatCard label="Radius Aktif" value={`${radius} m`} icon={Settings} />
      </div>

      <div className="rounded-[2rem] border border-white/25 bg-[#000080] px-4 py-5 text-white sm:px-6 sm:py-6">
        <p className="text-sm text-white/75">Kontrol Sistem</p>
        <p className="mt-2 text-xl font-semibold">Pengaturan Radius Absensi Aktif</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">Perubahan pada koordinat dan radius akan memengaruhi validasi absensi harian seluruh guru. Pastikan titik sekolah dan radius sudah benar sebelum menyimpan.</p>
      </div>

      {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Gagal") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pengaturan Lokasi Absensi</CardTitle>
          <CardDescription>Tentukan titik pusat sekolah dan maksimal radius yang diperbolehkan untuk absensi harian guru.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Latitude Sekolah</Label>
                <Input type="text" value={lat} onChange={(e) => setLat(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Longitude Sekolah</Label>
                <Input type="text" value={lng} onChange={(e) => setLng(e.target.value)} required />
              </div>
            </div>
            <div className="flex justify-stretch sm:justify-start">
              <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} className="w-full sm:w-auto">
                Gunakan Lokasi Saat Ini
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Maksimal Radius (meter)</Label>
              <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Guru hanya dapat melakukan absensi harian jika jarak mereka dengan sekolah kurang dari atau sama dengan {radius} meter.</p>
            </div>

            <div className="flex justify-stretch pt-4 sm:justify-end">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
