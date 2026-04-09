import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuthStore } from "@/store/auth";
import { createQuranAssessment, fetchAssignmentsByTeacher, fetchStudentsByClass, type ProfileRecord } from "@/lib/supabase-data";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen } from "lucide-react";

export function Penilaian() {
  const { user } = useAuthStore();
  const [kategori, setKategori] = useState<"tahfidz" | "tahsin">("tahfidz");
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [students, setStudents] = useState<ProfileRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    juzJilid: "",
    surah: "",
    ayatDari: "",
    ayatSampai: "",
    halaman: "",
    nilai: "",
    kehadiranSiswa: "Hadir",
    catatan: "",
  });

  useEffect(() => {
    const loadAssignedStudents = async () => {
      if (!user) return;
      setLoading(true);

      const assignmentsResult = await fetchAssignmentsByTeacher(user.id);
      if (assignmentsResult.error) {
        setMessage(`Gagal memuat penugasan: ${assignmentsResult.error.message}`);
        setLoading(false);
        return;
      }

      const studentIds = (assignmentsResult.data ?? []).map((item) => item.student_id);
      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const studentsResult = await fetchStudentsByClass();
      if (studentsResult.error) {
        setMessage(`Gagal memuat data siswa: ${studentsResult.error.message}`);
        setLoading(false);
        return;
      }

      setStudents((studentsResult.data ?? []).filter((student) => studentIds.includes(student.id)));
      setLoading(false);
    };

    void loadAssignedStudents();
  }, [user]);

  const classOptions = useMemo(() => Array.from(new Set(students.map((student) => student.kelas ?? student.class_id ?? "-").filter(Boolean))), [students]);
  const filteredStudents = useMemo(() => students.filter((student) => !selectedClass || (student.kelas ?? student.class_id ?? "") === selectedClass), [students, selectedClass]);

  const juzOptions = ["Juz 29", "Juz 30"];
  const surahOptions = ["An-Naba", "An-Nazi'at", "Abasa", "At-Takwir"];
  const tahsinOptions = ["Jilid 1", "Jilid 2", "Jilid 3", "Jilid 4", "Surah Pendek"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    const payload =
      kategori === "tahfidz"
        ? {
            student_id: selectedStudent,
            teacher_id: user.id,
            category: kategori,
            juz_jilid: form.juzJilid,
            surah: form.surah,
            ayat_dari: form.ayatDari,
            ayat_sampai: form.ayatSampai,
            halaman: null,
            nilai: Number(form.nilai),
            catatan: form.catatan || null,
            kehadiran_siswa: form.kehadiranSiswa,
            date: form.date,
          }
        : {
            student_id: selectedStudent,
            teacher_id: user.id,
            category: kategori,
            juz_jilid: form.juzJilid,
            surah: null,
            ayat_dari: null,
            ayat_sampai: null,
            halaman: form.halaman,
            nilai: Number(form.nilai),
            catatan: form.catatan || null,
            kehadiran_siswa: form.kehadiranSiswa,
            date: form.date,
          };

    const { error } = await createQuranAssessment(payload);
    if (error) {
      setMessage(`Gagal menyimpan penilaian: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Penilaian berhasil disimpan.");
    setSelectedStudent("");
    setForm({
      date: new Date().toISOString().split("T")[0],
      juzJilid: "",
      surah: "",
      ayatDari: "",
      ayatSampai: "",
      halaman: "",
      nilai: "",
      kehadiranSiswa: "Hadir",
      catatan: "",
    });
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Penilaian Al-Qur'an</h2>
          <p className="page-description">Input nilai Tahfidz dan Tahsin untuk siswa yang ditugaskan dengan alur form yang lebih fokus.</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/25 bg-[#000080] px-4 py-5 text-white sm:px-6 sm:py-6">
        <p className="text-sm text-white/75">Mode Penilaian</p>
        <p className="mt-2 text-xl font-semibold">{kategori === "tahfidz" ? "Tahfidz" : "Tahsin"}</p>
        <p className="mt-2 text-sm text-white/85">Pilih kategori, kelas, dan siswa sebelum mengisi detail penilaian.</p>
      </div>

      {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Gagal") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}
      {loading && students.length === 0 && <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm text-muted-foreground">Memuat data penugasan siswa...</div>}

      {!loading && students.length === 0 && <EmptyState title="Belum Ada Siswa Tertugaskan" description="Admin perlu menambahkan assignment siswa ke guru terlebih dahulu sebelum Anda bisa menginput penilaian." icon={BookOpen} />}

      {students.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button className="w-full" variant={kategori === "tahfidz" ? "default" : "outline"} onClick={() => setKategori("tahfidz")}>
              Tahfidz
            </Button>
            <Button className="w-full" variant={kategori === "tahsin" ? "default" : "outline"} onClick={() => setKategori("tahsin")}>
              Tahsin
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Form Input Nilai {kategori === "tahfidz" ? "Tahfidz" : "Tahsin"}</CardTitle>
              <CardDescription>Pilih siswa dan masukkan detail penilaian.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Kelas</Label>
                    <select
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedStudent("");
                      }}
                      required
                    >
                      <option value="">Pilih Kelas</option>
                      {classOptions.map((kelas) => (
                        <option key={kelas} value={kelas}>
                          {kelas}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Siswa</Label>
                  <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} required>
                    <option value="">Pilih Siswa</option>
                    {filteredStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name ?? student.email}
                      </option>
                    ))}
                  </select>
                </div>

                {kategori === "tahfidz" ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Juz</Label>
                      <select value={form.juzJilid} onChange={(e) => setForm({ ...form, juzJilid: e.target.value })} required>
                        <option value="">Pilih Juz</option>
                        {juzOptions.map((juz) => (
                          <option key={juz} value={juz}>
                            {juz}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Surat</Label>
                      <select value={form.surah} onChange={(e) => setForm({ ...form, surah: e.target.value })} required>
                        <option value="">Pilih Surat</option>
                        {surahOptions.map((surah) => (
                          <option key={surah} value={surah}>
                            {surah}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ayat Dari</Label>
                      <Input type="text" placeholder="1" value={form.ayatDari} onChange={(e) => setForm({ ...form, ayatDari: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Ayat Sampai</Label>
                      <Input type="text" placeholder="10" value={form.ayatSampai} onChange={(e) => setForm({ ...form, ayatSampai: e.target.value })} required />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Jilid / Surah</Label>
                      <select value={form.juzJilid} onChange={(e) => setForm({ ...form, juzJilid: e.target.value })} required>
                        <option value="">Pilih Jilid / Surah</option>
                        {tahsinOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Halaman</Label>
                      <Input type="text" placeholder="12" value={form.halaman} onChange={(e) => setForm({ ...form, halaman: e.target.value })} required />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nilai</Label>
                    <Input type="number" min="0" max="100" placeholder="85" value={form.nilai} onChange={(e) => setForm({ ...form, nilai: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Kehadiran Siswa</Label>
                    <select value={form.kehadiranSiswa} onChange={(e) => setForm({ ...form, kehadiranSiswa: e.target.value })}>
                      <option value="Hadir">Hadir</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Izin">Izin</option>
                      <option value="Alpa">Alpa</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Catatan Guru</Label>
                  <Input type="text" placeholder="Catatan evaluasi bacaan..." value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
                </div>

                <div className="flex justify-stretch pt-4 sm:justify-end">
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    {loading ? "Menyimpan..." : "Simpan Penilaian"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
