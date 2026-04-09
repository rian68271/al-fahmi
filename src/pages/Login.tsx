import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { supabase } from "@/lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { syncSupabaseUser } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message || "Login gagal. Periksa kembali email dan password Anda.");
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Sesi login tidak berhasil dibuat.");
      setLoading(false);
      return;
    }

    await syncSupabaseUser(data.user);
    setLoading(false);
    navigate("/");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-3 py-6 sm:px-4 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#000080]/16 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-2rem] h-80 w-80 rounded-full bg-[#000080]/12 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 shadow-[0_30px_120px_-40px_rgba(0,0,128,0.24)] backdrop-blur-xl sm:rounded-[2rem] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden overflow-hidden bg-[#000080] p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_30%)]" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-sm text-white/95">
              <Sparkles className="h-4 w-4" />
              Sistem Operasional Sekolah Modern
            </div>

            <div className="mt-10 space-y-5">
              <h1 className="max-w-xl text-4xl font-semibold leading-tight">Kelola absensi guru dan penilaian Al-Qur'an dalam satu dashboard profesional.</h1>
              <p className="max-w-xl text-base leading-7 text-white/90">Dirancang untuk admin, guru, dan siswa agar alur kerja sekolah lebih cepat, lebih jelas, dan lebih terpusat.</p>
            </div>

            <div className="mt-10 grid gap-4">
              <div className="rounded-3xl border border-white/20 bg-white/12 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Absensi Berbasis Lokasi</p>
                    <p className="text-sm text-white/85">Validasi radius sekolah dan absensi cepat untuk briefing atau rapat.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/20 bg-white/12 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Penilaian Tahfidz & Tahsin</p>
                    <p className="text-sm text-white/85">Form penilaian yang rapi, cepat diisi, dan siap direkap.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/20 bg-white/12 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Akses Sesuai Role</p>
                    <p className="text-sm text-white/85">Admin, guru, dan siswa melihat menu yang benar-benar relevan.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto rounded-3xl border border-white/20 bg-white/12 p-5">
              <p className="text-sm text-white/90">Login Supabase</p>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <p>Gunakan akun yang sudah terdaftar di Supabase Auth.</p>
                <p>Role akan dibaca dari metadata user atau fallback dari email.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-10">
          <Card className="border-none bg-transparent shadow-none">
            <CardHeader className="space-y-3 px-0 text-left">
              <div className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">Selamat datang di Al-Fahmi</div>
              <CardTitle className="text-2xl sm:text-3xl">Masuk ke akun Anda</CardTitle>
              <CardDescription>Gunakan akun Supabase Auth untuk mengakses dashboard sesuai role.</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-5 px-0">
                {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="nama@alfahmi.sch.id" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Masukkan password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-3 px-0">
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Memproses..." : "Masuk ke Dashboard"}
                  {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
                </Button>
                <p className="text-center text-xs leading-6 text-muted-foreground">Frontend kini siap memakai Supabase Auth. Pastikan email dan password pengguna sudah terdaftar.</p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
