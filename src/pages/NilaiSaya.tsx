import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useAuthStore } from "@/store/auth";
import { BookOpen } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchProfilesByIds, fetchQuranAssessments } from "@/lib/supabase-data";

interface AssessmentView {
  id: string;
  title: string;
  teacherName: string;
  date: string;
  note: string;
  nilai: number;
  attendance: string;
}

export function NilaiSaya() {
  const { user } = useAuthStore();
  const [assessments, setAssessments] = useState<AssessmentView[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAssessments = async () => {
      if (!user) return;
      setLoading(true);
      setMessage(null);

      const { data, error } = await fetchQuranAssessments({ studentId: user.id });
      if (error) {
        setMessage(`Gagal memuat nilai: ${error.message}`);
        setLoading(false);
        return;
      }

      const teacherIds = Array.from(new Set((data ?? []).map((item) => item.teacher_id)));
      const teachersResult = await fetchProfilesByIds(teacherIds);
      const teachers = teachersResult.data ?? [];

      setAssessments(
        (data ?? []).map((item) => {
          const teacher = teachers.find((profile) => profile.id === item.teacher_id);
          const detail =
            item.category === "tahfidz"
              ? `${item.juz_jilid ?? "-"}${item.surah ? ` (${item.surah} Ayat ${item.ayat_dari ?? "-"}-${item.ayat_sampai ?? "-"})` : ""}`
              : `${item.juz_jilid ?? "-"}${item.halaman ? ` - Halaman ${item.halaman}` : ""}`;

          return {
            id: item.id,
            title: `${item.category === "tahfidz" ? "Tahfidz" : "Tahsin"} - ${detail}`,
            teacherName: teacher?.name ?? teacher?.email ?? "Guru",
            date: new Date(item.date).toLocaleDateString("id-ID"),
            note: item.catatan ?? "Tidak ada catatan.",
            nilai: item.nilai,
            attendance: item.kehadiran_siswa ?? "Hadir",
          };
        })
      );
      setLoading(false);
    };

    void loadAssessments();
  }, [user?.id]);

  const averageScore = useMemo(() => {
    if (assessments.length === 0) return 0;
    return Math.round(assessments.reduce((total, item) => total + item.nilai, 0) / assessments.length);
  }, [assessments]);

  const recentAssessments = useMemo(() => assessments.slice(0, 5), [assessments]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <SectionHeader title="Nilai Al-Qur'an Saya" description="Lihat perkembangan capaian Tahfidz dan Tahsin Anda dalam tampilan riwayat yang lebih nyaman dibaca." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Siswa" value={user?.name || "Siswa"} description="Profil aktif yang sedang melihat riwayat nilai." icon={BookOpen} />
        <StatCard label="Riwayat Tersedia" value={`${assessments.length} Penilaian`} description="Menampilkan hasil evaluasi terbaru dari guru pengampu." icon={BookOpen} />
        <StatCard label="Nilai Rata-Rata" value={averageScore} description="Rata-rata capaian dari riwayat penilaian saat ini." icon={BookOpen} />
      </div>

      {message && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}
      {loading && <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm text-muted-foreground">Memuat riwayat nilai terbaru...</div>}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Penilaian</CardTitle>
          <CardDescription>Menampilkan 5 penilaian terakhir.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentAssessments.map((item) => (
              <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="font-semibold">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">Tanggal: {item.date} | Guru: {item.teacherName}</p>
                  <p className="text-sm mt-1 text-muted-foreground">Catatan: {item.note}</p>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-2xl font-bold text-primary">{item.nilai}</div>
                  <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-medium text-[#000080]">{item.attendance}</span>
                </div>
              </div>
            ))}
            {recentAssessments.length === 0 && <EmptyState title="Belum Ada Nilai" description="Nilai Al-Qur'an Anda akan muncul di sini setelah guru pengampu menginput penilaian." icon={BookOpen} />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
