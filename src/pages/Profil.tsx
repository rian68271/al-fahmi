import React, { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Profil() {
  const { user, setUser } = useAuthStore();

  // States for general info
  const [name, setName] = useState(user?.name || "");
  const [sekolah, setSekolah] = useState(user?.sekolah || "");
  const [kelas, setKelas] = useState(user?.kelas || "");

  // States for Guru specific
  const [idGuru, setIdGuru] = useState(user?.id_guru || "");
  const [mataPelajaran, setMataPelajaran] = useState(user?.mata_pelajaran || "");

  // States for Siswa specific
  const [idMurid, setIdMurid] = useState(user?.id_murid || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!user) return;

    setLoading(true);

    const payload = {
      name,
      sekolah,
      kelas,
      id_guru: user.role === "guru" ? idGuru || null : user.id_guru ?? null,
      mata_pelajaran: user.role === "guru" ? mataPelajaran || null : user.mata_pelajaran ?? null,
      id_murid: user.role === "siswa" ? idMurid || null : user.id_murid ?? null,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

    if (error) {
      setMessage(`Gagal memperbarui profil: ${error.message}`);
      setLoading(false);
      return;
    }

    const updatedUser = {
      ...user,
      name,
      sekolah,
      kelas,
      ...(user.role === "guru" ? { id_guru: idGuru, mata_pelajaran: mataPelajaran } : {}),
      ...(user.role === "siswa" ? { id_murid: idMurid } : {}),
    };

    setUser(updatedUser);
    setMessage("Profil berhasil diperbarui.");
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <SectionHeader title="Pengaturan Profil" description="Kelola informasi pribadi dan data akademik akun Anda dengan tampilan yang lebih konsisten." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Nama Pengguna" value={user.name} description="Nama yang tampil pada sistem." icon={UserCircle} />
        <StatCard label="Peran Akun" value={<span className="capitalize">{user.role}</span>} description="Hak akses aktif sesuai role pengguna." icon={UserCircle} />
        <StatCard label="Sekolah" value={user.sekolah || "-"} description="Institusi yang terhubung dengan akun ini." icon={UserCircle} />
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Informasi Pribadi</CardTitle>
          <CardDescription>Perbarui informasi detail akun Anda di sini.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Gagal") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled className="bg-[#f5f6ff]" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sekolah">Asal Sekolah</Label>
              <Input id="sekolah" value={sekolah} onChange={(e) => setSekolah(e.target.value)} />
            </div>

            {user.role === "guru" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="idGuru">ID Guru</Label>
                    <Input id="idGuru" value={idGuru} onChange={(e) => setIdGuru(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kelas">Kelas / Wali Kelas</Label>
                    <Input id="kelas" value={kelas} onChange={(e) => setKelas(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapel">Mata Pelajaran</Label>
                  <Input id="mapel" value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} />
                </div>
              </>
            )}

            {user.role === "siswa" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="idMurid">ID Murid</Label>
                    <Input id="idMurid" value={idMurid} onChange={(e) => setIdMurid(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kelas">Kelas</Label>
                    <Input id="kelas" value={kelas} onChange={(e) => setKelas(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-stretch border-t pt-6 sm:justify-end">
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
