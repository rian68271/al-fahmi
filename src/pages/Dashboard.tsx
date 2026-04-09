import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, MapPin, Settings, Users } from "lucide-react";
import { fetchAssignmentsByTeacher, fetchAttendances, fetchCalendarEvents, fetchNotifications, fetchQuranAssessments, fetchStudents, fetchTeachers } from "@/lib/supabase-data";

interface DashboardStat {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;
      setDashboardNotice(null);

      const today = new Date();
      const { fromUtc: startOfDay, toUtc: endOfDay } = getJakartaDayUtcRange(today);

      const [calendarResult, notificationsResult] = await Promise.all([fetchCalendarEvents(), fetchNotifications({ role: user.role, recipientId: user.id, limit: 3 })]);
      if (calendarResult.error || notificationsResult.error) {
        setDashboardNotice("Sebagian data dashboard belum berhasil dimuat. Menampilkan data yang tersedia.");
      }
      const events = calendarResult.data ?? [];
      const notifications = notificationsResult.data ?? [];
      const upcomingEvents = events.filter((event) => new Date(event.event_date) >= today);
      const monthEvents = events.filter((event) => event.event_date.startsWith(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`));
      const notificationMessages = notifications.map((item) => item.body);

      if (user.role === "admin") {
        const [teachersResult, studentsResult, attendancesResult] = await Promise.all([fetchTeachers(), fetchStudents(), fetchAttendances({ fromDate: startOfDay, toDate: endOfDay })]);
        if (teachersResult.error || studentsResult.error || attendancesResult.error) {
          setDashboardNotice("Sebagian statistik admin belum berhasil dimuat.");
        }

        const teacherCount = teachersResult.data?.length ?? 0;
        const studentCount = studentsResult.data?.length ?? 0;
        const todayAttendanceCount = attendancesResult.data?.filter((item) => item.type === "harian").length ?? 0;

        setStats([
          { label: "Total Guru", value: String(teacherCount), detail: "Guru aktif pada sistem", icon: Users },
          { label: "Total Siswa", value: String(studentCount), detail: "Data siswa terdaftar", icon: BookOpen },
          { label: "Absensi Hari Ini", value: String(todayAttendanceCount), detail: `${todayAttendanceCount} absensi harian tercatat hari ini`, icon: MapPin },
          { label: "Agenda Bulan Ini", value: String(monthEvents.length), detail: "Kegiatan sekolah terjadwal pada bulan berjalan", icon: CalendarDays },
        ]);

        setAnnouncements(notificationMessages.length > 0 ? notificationMessages : upcomingEvents.slice(0, 3).map((event) => `${event.title} pada ${new Date(event.event_date).toLocaleDateString("id-ID")}.`));

        setActivities([`${teacherCount} guru aktif terdaftar pada sistem.`, `${studentCount} siswa siap dipantau melalui dashboard.`, `${monthEvents.length} agenda sekolah tercatat pada bulan ini.`]);
        return;
      }

      if (user.role === "guru") {
        const [attendanceResult, assignmentsResult, assessmentsResult] = await Promise.all([
          fetchAttendances({ userId: user.id, fromDate: startOfDay, toDate: endOfDay }),
          fetchAssignmentsByTeacher(user.id),
          fetchQuranAssessments({ teacherId: user.id, fromMonth: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` }),
        ]);
        if (attendanceResult.error || assignmentsResult.error || assessmentsResult.error) {
          setDashboardNotice("Sebagian statistik guru belum berhasil dimuat.");
        }

        const todayAttendance = attendanceResult.data?.find((item) => item.type === "harian");
        const assignmentCount = assignmentsResult.data?.length ?? 0;
        const assessmentCount = assessmentsResult.data?.length ?? 0;

        setStats([
          {
            label: "Status Kehadiran",
            value: todayAttendance ? "Hadir" : "Belum Absen",
            detail: todayAttendance ? `Tercatat ${new Date(todayAttendance.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Lakukan absensi harian berbasis lokasi.",
            icon: MapPin,
          },
          { label: "Siswa Tertugaskan", value: String(assignmentCount), detail: "Siswa yang dapat Anda nilai", icon: Users },
          { label: "Sudah Dinilai", value: String(assessmentCount), detail: "Penilaian yang Anda input bulan ini", icon: ClipboardCheck },
        ]);

        setAnnouncements(notificationMessages.length > 0 ? notificationMessages : upcomingEvents.slice(0, 3).map((event) => `${event.title} pada ${new Date(event.event_date).toLocaleDateString("id-ID")}.`));

        setActivities([
          todayAttendance ? "Absensi harian Anda sudah tercatat." : "Absensi harian Anda belum tercatat hari ini.",
          `${assignmentCount} siswa aktif telah ditugaskan kepada Anda.`,
          `${assessmentCount} penilaian sudah Anda input bulan ini.`,
        ]);
        return;
      }

      const assessmentsResult = await fetchQuranAssessments({ studentId: user.id });
      if (assessmentsResult.error) {
        setDashboardNotice("Sebagian statistik siswa belum berhasil dimuat.");
      }
      const studentAssessments = assessmentsResult.data ?? [];
      const average = studentAssessments.length > 0 ? Math.round(studentAssessments.reduce((sum, item) => sum + item.nilai, 0) / studentAssessments.length) : 0;

      setStats([
        { label: "Nilai Rata-Rata", value: String(average), detail: "Gabungan hasil penilaian Al-Qur'an", icon: BookOpen },
        { label: "Agenda Terdekat", value: upcomingEvents[0] ? new Date(upcomingEvents[0].event_date).toLocaleDateString("id-ID") : "-", detail: "Kegiatan sekolah terdekat", icon: CalendarDays },
        { label: "Status Belajar", value: studentAssessments.length > 0 ? "Aktif" : "Menunggu", detail: "Pantau progres penilaian setiap pekan", icon: ClipboardCheck },
      ]);

      setAnnouncements(notificationMessages.length > 0 ? notificationMessages : upcomingEvents.slice(0, 3).map((event) => `${event.title} pada ${new Date(event.event_date).toLocaleDateString("id-ID")}.`));

      setActivities([
        `${studentAssessments.length} riwayat penilaian tersedia untuk akun Anda.`,
        upcomingEvents[0] ? `Agenda terdekat: ${upcomingEvents[0].title}.` : "Belum ada agenda sekolah terdekat.",
        average > 0 ? `Nilai rata-rata Anda saat ini ${average}.` : "Nilai Anda akan muncul setelah guru menginput penilaian.",
      ]);
    };

    void loadDashboardData();
  }, [user]);

  const safeStats = useMemo<DashboardStat[]>(
    () =>
      stats.length > 0
        ? stats
        : user?.role === "admin"
          ? [
              { label: "Total Guru", value: "0", detail: "Guru aktif pada sistem", icon: Users },
              { label: "Total Siswa", value: "0", detail: "Data siswa terdaftar", icon: BookOpen },
              { label: "Absensi Hari Ini", value: "0", detail: "Belum ada absensi harian", icon: MapPin },
              { label: "Agenda Bulan Ini", value: "0", detail: "Belum ada agenda aktif", icon: CalendarDays },
            ]
          : user?.role === "guru"
            ? [
                { label: "Status Kehadiran", value: "Belum Absen", detail: "Lakukan absensi harian berbasis lokasi.", icon: MapPin },
                { label: "Siswa Tertugaskan", value: "0", detail: "Siswa yang dapat Anda nilai", icon: Users },
                { label: "Sudah Dinilai", value: "0", detail: "Penilaian yang Anda input bulan ini", icon: ClipboardCheck },
              ]
            : [
                { label: "Nilai Rata-Rata", value: "0", detail: "Gabungan hasil penilaian Al-Qur'an", icon: BookOpen },
                { label: "Agenda Terdekat", value: "-", detail: "Kegiatan sekolah terdekat", icon: CalendarDays },
                { label: "Status Belajar", value: "Menunggu", detail: "Pantau progres penilaian setiap pekan", icon: ClipboardCheck },
              ],
    [stats, user?.role],
  );

  const quickActions =
    user?.role === "admin"
      ? [
          { label: "Kelola Kalender", href: "/kalender", icon: CalendarDays },
          { label: "Kelola Data Master", href: "/siswa", icon: Users },
          { label: "Perbarui Pengaturan", href: "/pengaturan", icon: Settings },
        ]
      : user?.role === "guru"
        ? [
            { label: "Lakukan Absensi", href: "/absensi", icon: MapPin },
            { label: "Input Penilaian", href: "/penilaian", icon: BookOpen },
            { label: "Lihat Kalender", href: "/kalender", icon: CalendarDays },
          ]
        : [
            { label: "Lihat Nilai Saya", href: "/nilai-saya", icon: BookOpen },
            { label: "Agenda Sekolah", href: "/kalender", icon: CalendarDays },
            { label: "Perbarui Profil", href: "/profil", icon: Settings },
          ];

  const greeting =
    user?.role === "admin"
      ? "Pantau operasional sekolah dengan lebih cepat dan terorganisir."
      : user?.role === "guru"
        ? "Kelola absensi dan penilaian harian dengan alur yang lebih efisien."
        : "Ikuti perkembangan nilai dan agenda sekolah dengan tampilan yang lebih nyaman.";

  return (
    <div className="space-y-6">
      {dashboardNotice && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{dashboardNotice}</div>}
      <section className="overflow-hidden rounded-[2rem] border border-white/25 bg-[#000080] text-white shadow-[0_24px_70px_-36px_rgba(0,0,128,0.35)]">
        <div className="grid gap-6 px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10">
          <div className="relative z-10">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3 py-1 text-sm text-white/95">Dashboard {user?.role || "user"}</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Assalamu'alaikum, {user?.name || "Pengguna"}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/90 md:text-base">{greeting}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              {quickActions.slice(0, 2).map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    to={action.href}
                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-[#000080] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#eef0ff] sm:w-auto"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Link>
                );
              })}
              <Link to="/profil" className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 sm:w-auto">
                Lengkapi Profil
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {safeStats.slice(0, 2).map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-3xl border border-white/20 bg-white/12 p-5 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/85">{item.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/80">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {safeStats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="page-header">
            <div>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Akses fitur yang paling sering Anda gunakan tanpa pindah-pindah menu.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} to={action.href} className="group rounded-3xl border border-border/70 bg-secondary/40 p-5 transition hover:-translate-y-1 hover:border-primary/20 hover:bg-white">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{action.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Buka modul dan lanjutkan pekerjaan Anda dengan lebih cepat.</p>
                  <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                    Buka modul
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pengumuman Sekolah</CardTitle>
            <CardDescription>Informasi penting yang perlu segera diketahui oleh pengguna.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(announcements.length > 0 ? announcements : ["Belum ada pengumuman sekolah saat ini."]).map((item, index) => (
              <div key={item} className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                <div className="mb-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Update {index + 1}</div>
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terbaru</CardTitle>
            <CardDescription>Snapshot singkat dari kegiatan yang baru tercatat pada sistem.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(activities.length > 0 ? activities : ["Belum ada aktivitas terbaru yang tercatat."]).map((activity, index) => (
              <div key={activity} className="flex gap-4">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="text-sm font-semibold">0{index + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{activity}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Diperbarui beberapa saat yang lalu.</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-[#f5f6ff]">
          <CardHeader>
            <CardTitle>Ringkasan Mingguan</CardTitle>
            <CardDescription>Monitor progres operasional dan pembelajaran sekolah secara cepat.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Penyelesaian", value: "78%" },
              { label: "Kedisiplinan", value: "92%" },
              { label: "Kualitas Input", value: "89%" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function getJakartaDayUtcRange(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [yearText, monthText, dayText] = formatter.format(date).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const startUtc = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day + 1, -7, 0, 0, -1));

  return {
    fromUtc: startUtc.toISOString(),
    toUtc: endUtc.toISOString(),
  };
}
