import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileSpreadsheet } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { fetchAttendances, fetchProfilesByIds, fetchProfilesByRole, fetchQuranAssessments, fetchStudentsByClass } from "@/lib/supabase-data";

export function Laporan() {
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState("Semua Kelas");
  const [selectedMonth, setSelectedMonth] = useState("2026-04");
  const [message, setMessage] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<string[]>([]);

  useEffect(() => {
    const loadClassOptions = async () => {
      const { data, error } = await fetchStudentsByClass();
      if (error) {
        setMessage(`Gagal memuat daftar kelas: ${error.message}`);
        return;
      }

      const classes = Array.from(new Set((data ?? []).map((student) => student.kelas ?? student.class_id ?? "").filter(Boolean)));
      setClassOptions(classes);
    };

    void loadClassOptions();
  }, []);

  const effectiveClassOptions = useMemo(() => ["Semua Kelas", ...classOptions], [classOptions]);

  const handleExport = async (type: string) => {
    setLoading(true);
    setMessage(null);
    let data: Record<string, string | number | null>[] = [];
    let filename = "";

    if (type === "Absensi Guru") {
      const teachersResult = await fetchProfilesByRole("guru");
      if (teachersResult.error) {
        setMessage(`Gagal mengambil data guru: ${teachersResult.error.message}`);
        setLoading(false);
        return;
      }

      const teacherProfiles = teachersResult.data ?? [];
      const teacherMap = new Map(teacherProfiles.map((teacher) => [teacher.id, teacher]));
      const { fromUtc, toUtc } = getJakartaMonthUtcRange(selectedMonth);
      const attendanceResult = await fetchAttendances({ fromDate: fromUtc, toDate: toUtc });

      if (attendanceResult.error) {
        setMessage(`Gagal mengambil data absensi: ${attendanceResult.error.message}`);
        setLoading(false);
        return;
      }

      data = (attendanceResult.data ?? [])
        .filter((item) => teacherMap.has(item.user_id))
        .map((item, index) => {
          const teacher = teacherMap.get(item.user_id);

          return {
            No: index + 1,
            Nama_Guru: teacher?.name ?? teacher?.email ?? "Guru",
            Tipe_Absen: normalizeAttendanceTypeLabel(item.type),
            Status: item.status ?? "-",
            Tanggal: new Date(item.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
          };
        });
      filename = "Laporan_Absensi_Guru.xlsx";
    } else {
      const assessmentsResult = await fetchQuranAssessments({ fromMonth: selectedMonth });
      if (assessmentsResult.error) {
        setMessage(`Gagal mengambil nilai: ${assessmentsResult.error.message}`);
        setLoading(false);
        return;
      }

      const profileIds = Array.from(new Set((assessmentsResult.data ?? []).flatMap((item) => [item.student_id, item.teacher_id])));
      const profilesResult = await fetchProfilesByIds(profileIds);
      const profiles = profilesResult.data ?? [];

      data = (assessmentsResult.data ?? [])
        .filter((item) => {
          const student = profiles.find((profile) => profile.id === item.student_id);
          return selectedClass === "Semua Kelas" || (student?.kelas ?? student?.class_id ?? "") === selectedClass;
        })
        .map((item, index) => {
          const student = profiles.find((profile) => profile.id === item.student_id);
          return {
            No: index + 1,
            Nama_Siswa: student?.name ?? student?.email ?? "Siswa",
            Kelas: student?.kelas ?? student?.class_id ?? "-",
            Kategori: item.category,
            Detail: item.category === "tahfidz" ? `${item.juz_jilid ?? "-"} ${item.surah ?? ""} ${item.ayat_dari ?? ""}-${item.ayat_sampai ?? ""}`.trim() : `${item.juz_jilid ?? "-"}${item.halaman ? ` Hal ${item.halaman}` : ""}`,
            Nilai: item.nilai,
            Kehadiran: item.kehadiran_siswa ?? "-",
            Tanggal: item.date,
          };
        });
      filename = "Laporan_Nilai_Siswa.xlsx";
    }

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ Info: "Tidak ada data untuk filter yang dipilih." }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
    setMessage(`Export ${type} berhasil dibuat.`);
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <SectionHeader title="Laporan & Rekapitulasi" description="Unduh laporan absensi dan nilai Al-Qur'an ke format Excel dengan struktur yang lebih mudah dibaca." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Laporan Tersedia" value="2 Jenis" description="Absensi guru dan nilai siswa siap diekspor." icon={FileSpreadsheet} />
        <StatCard label="Format Output" value=".xlsx" description="Kompatibel untuk rekap administrasi sekolah." icon={FileSpreadsheet} />
        <StatCard label="Status Sistem" value="Siap Ekspor" description="Gunakan tombol di bawah untuk mengunduh data." icon={FileSpreadsheet} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
          <CardDescription>Pilih kelas dan bulan sebelum melakukan export rekap sesuai kebutuhan administrasi.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Filter Kelas</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              {effectiveClassOptions.map((kelas) => (
                <option key={kelas} value={kelas}>
                  {kelas}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Filter Bulan</label>
            <InputMonth value={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </CardContent>
      </Card>

      {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Gagal") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rekap Absensi Guru</CardTitle>
            <CardDescription>Unduh laporan absensi harian, briefing, dan rapat seluruh guru.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <p className="text-sm font-medium text-slate-900">Data yang diekspor</p>
              <p className="mt-2 text-sm text-muted-foreground">Nama guru, tipe absensi, status kehadiran, dan timestamp absensi.</p>
            </div>
            <Button className="w-full flex items-center gap-2" onClick={() => handleExport("Absensi Guru")} disabled={loading}>
              <FileSpreadsheet className="h-4 w-4" />
              {loading ? "Menyiapkan File..." : "Export Absensi ke Excel"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rekap Nilai Siswa</CardTitle>
            <CardDescription>Unduh laporan lengkap nilai Tahfidz dan Tahsin seluruh siswa atau per kelas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <p className="text-sm font-medium text-slate-900">Data yang diekspor</p>
              <p className="mt-2 text-sm text-muted-foreground">Kelas, kategori penilaian, detail materi, nilai, kehadiran, dan tanggal input.</p>
            </div>
            <Button className="w-full flex items-center gap-2" onClick={() => handleExport("Nilai Siswa")} disabled={loading}>
              <FileSpreadsheet className="h-4 w-4" />
              {loading ? "Menyiapkan File..." : "Export Nilai ke Excel"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InputMonth({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 w-full rounded-2xl border border-input bg-white/90 px-4 py-2.5 text-sm shadow-sm ring-offset-background outline-none focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-ring/10"
    />
  );
}

function getJakartaMonthUtcRange(selectedMonth: string) {
  const [yearText, monthText] = selectedMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const startUtc = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month, 1, -7, 0, 0, -1));

  return {
    fromUtc: startUtc.toISOString(),
    toUtc: endUtc.toISOString(),
  };
}

function normalizeAttendanceTypeLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "briefing") return "Briefing";
  if (normalized === "rapat") return "Rapat";
  return "Harian";
}
