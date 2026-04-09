import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }

  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function makeAnonClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(url, anonKey, email, password) {
  const client = makeAnonClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Gagal login ${email}: ${error?.message ?? "session kosong"}`);
  }
  return client;
}

async function waitForProfile(adminClient, userId, expectedRole) {
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await adminClient.from("profiles").select("id, role, kelas").eq("id", userId).maybeSingle();
    if (!error && data?.role === expectedRole) return;
    await wait(300);
  }

  throw new Error(`Profile ${userId} dengan role ${expectedRole} tidak tersedia.`);
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local tidak ditemukan.");

  const env = readEnvFile(envPath);
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  assert(supabaseUrl, "VITE_SUPABASE_URL belum diisi.");
  assert(anonKey, "VITE_SUPABASE_ANON_KEY belum diisi.");
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY belum diisi.");

  const adminBypass = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const suffix = Date.now();
  const password = "TempPass!12345";
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const laterFutureDate = new Date();
  laterFutureDate.setDate(laterFutureDate.getDate() + 10);
  const formatDate = (date) => date.toISOString().slice(0, 10);

  const tempUsers = [
    { role: "admin", email: `studentdash-admin-${suffix}@example.com`, name: `Student Dash Admin ${suffix}` },
    { role: "guru", email: `studentdash-guru-${suffix}@example.com`, name: `Student Dash Guru ${suffix}` },
    { role: "siswa", email: `studentdash-siswa-${suffix}@example.com`, name: `Student Dash Siswa ${suffix}`, kelas: "9A", id_murid: `SD-${suffix}` },
  ];
  const createdUsers = [];
  let teacherRowId = null;
  let studentRowId = null;
  let eventIds = [];

  try {
    console.log("Membuat user sementara dashboard siswa...");
    for (const tempUser of tempUsers) {
      const { data, error } = await adminBypass.auth.admin.createUser({
        email: tempUser.email,
        password,
        email_confirm: true,
        user_metadata: {
          role: tempUser.role,
          name: tempUser.name,
          sekolah: "SDIT Al-Fahmi",
          kelas: tempUser.kelas,
          id_murid: tempUser.id_murid,
        },
      });

      if (error || !data.user) {
        throw new Error(`Gagal membuat user ${tempUser.email}: ${error?.message ?? "user kosong"}`);
      }

      createdUsers.push({ ...tempUser, id: data.user.id });
      await waitForProfile(adminBypass, data.user.id, tempUser.role);
    }

    const adminUser = createdUsers.find((u) => u.role === "admin");
    const teacherUser = createdUsers.find((u) => u.role === "guru");
    const studentUser = createdUsers.find((u) => u.role === "siswa");
    assert(adminUser && teacherUser && studentUser, "User sementara dashboard siswa tidak lengkap.");

    const studentClient = await signIn(supabaseUrl, anonKey, studentUser.email, password);

    const teacherInsert = await adminBypass
      .from("teachers")
      .insert({
        profile_id: teacherUser.id,
        nip: `STDASH-NIP-${suffix}`,
        full_name: teacherUser.name,
        subjects: ["Tahfidz"],
        education_history: ["S1"],
        employment_status: "tetap",
      })
      .select()
      .single();
    assert(!teacherInsert.error && teacherInsert.data, `Gagal insert teacher dashboard siswa: ${teacherInsert.error?.message}`);
    teacherRowId = teacherInsert.data.id;

    const studentInsert = await adminBypass
      .from("students")
      .insert({
        profile_id: studentUser.id,
        nis: `STDASH-NIS-${suffix}`,
        full_name: studentUser.name,
        class_name: "9A",
        major: "Tahfidz",
        student_status: "aktif",
        guardian_info: {
          fatherName: "Ayah",
          motherName: "Ibu",
          guardianName: "",
          relationship: "Orang Tua",
          phone: "0812",
          occupation: "Karyawan",
        },
        address: "Alamat dashboard siswa",
        phone: "0812",
        academic_history: ["Semester 1 - 91"],
        notes: "Seed dashboard siswa",
      })
      .select()
      .single();
    assert(!studentInsert.error && studentInsert.data, `Gagal insert student dashboard siswa: ${studentInsert.error?.message}`);
    studentRowId = studentInsert.data.id;

    await adminBypass.from("teacher_student_assignments").insert({
      teacher_id: teacherUser.id,
      student_id: studentUser.id,
    });

    const eventsInsert = await adminBypass
      .from("calendar_events")
      .insert([
        { title: `Agenda Dekat ${suffix}`, description: "Agenda terdekat", event_date: formatDate(futureDate) },
        { title: `Agenda Jauh ${suffix}`, description: "Agenda berikutnya", event_date: formatDate(laterFutureDate) },
      ])
      .select("id, event_date");
    assert(!eventsInsert.error, `Gagal insert event dashboard siswa: ${eventsInsert.error?.message}`);
    eventIds = eventsInsert.data?.map((item) => item.id) ?? [];

    const assessmentInsert = await adminBypass
      .from("quran_assessments")
      .insert([
        {
          student_id: studentUser.id,
          teacher_id: teacherUser.id,
          category: "tahfidz",
          juz_jilid: "Juz 30",
          surah: "An-Naba",
          ayat_dari: "1",
          ayat_sampai: "5",
          halaman: null,
          nilai: 92,
          catatan: "Seed siswa 1",
          kehadiran_siswa: "Hadir",
          date: "2026-04-10",
        },
        {
          student_id: studentUser.id,
          teacher_id: teacherUser.id,
          category: "tahsin",
          juz_jilid: "Jilid 2",
          surah: null,
          ayat_dari: null,
          ayat_sampai: null,
          halaman: "9",
          nilai: 88,
          catatan: "Seed siswa 2",
          kehadiran_siswa: "Izin",
          date: "2026-04-17",
        },
      ])
      .select();
    assert(!assessmentInsert.error, `Gagal insert assessment dashboard siswa: ${assessmentInsert.error?.message}`);

    console.log("Mengambil sumber data dashboard siswa...");
    const [studentAssessmentsResult, calendarResult] = await Promise.all([
      studentClient
        .from("quran_assessments")
        .select("id, student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date")
        .eq("student_id", studentUser.id)
        .order("date", { ascending: false }),
      studentClient.from("calendar_events").select("id, title, event_date").order("event_date", { ascending: true }),
    ]);

    assert(!studentAssessmentsResult.error && !calendarResult.error, "Gagal mengambil sumber data dashboard siswa.");

    const studentAssessments = studentAssessmentsResult.data ?? [];
    const events = calendarResult.data ?? [];
    const today = new Date();
    const upcomingEvents = events.filter((event) => new Date(event.event_date) >= today);

    const dashboardAverage = studentAssessments.length > 0 ? Math.round(studentAssessments.reduce((sum, item) => sum + item.nilai, 0) / studentAssessments.length) : 0;
    const dashboardNearestAgenda = upcomingEvents[0] ? new Date(upcomingEvents[0].event_date).toLocaleDateString("id-ID") : "-";
    const dashboardStatusBelajar = studentAssessments.length > 0 ? "Aktif" : "Menunggu";

    console.log("Mengambil sumber data halaman Nilai Saya...");
    const nilaiSayaResult = await studentClient
      .from("quran_assessments")
      .select("id, student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date")
      .eq("student_id", studentUser.id)
      .order("date", { ascending: false });
    assert(!nilaiSayaResult.error, `Gagal mengambil sumber data Nilai Saya: ${nilaiSayaResult.error?.message}`);

    const nilaiSayaRows = nilaiSayaResult.data ?? [];
    const nilaiSayaAverage = nilaiSayaRows.length > 0 ? Math.round(nilaiSayaRows.reduce((sum, item) => sum + item.nilai, 0) / nilaiSayaRows.length) : 0;
    const recentNilaiSayaCount = nilaiSayaRows.slice(0, 5).length;

    assert(dashboardAverage === nilaiSayaAverage, `Dashboard siswa Nilai Rata-Rata mismatch. Dashboard=${dashboardAverage}, NilaiSaya=${nilaiSayaAverage}`);
    assert(dashboardNearestAgenda === new Date(formatDate(futureDate)).toLocaleDateString("id-ID"), `Dashboard siswa Agenda Terdekat mismatch. Dashboard=${dashboardNearestAgenda}`);
    assert(dashboardStatusBelajar === "Aktif", `Dashboard siswa Status Belajar mismatch. Dashboard=${dashboardStatusBelajar}`);
    assert(recentNilaiSayaCount === 2, `Nilai Saya recent list mismatch. Dapat ${recentNilaiSayaCount}, expected 2.`);

    console.log("Audit dashboard siswa dan konsistensi Nilai Saya lulus.");
  } finally {
    console.log("Membersihkan data audit dashboard siswa...");
    await adminBypass
      .from("quran_assessments")
      .delete()
      .in("teacher_id", createdUsers.filter((u) => u.role === "guru").map((u) => u.id));
    await adminBypass
      .from("teacher_student_assignments")
      .delete()
      .in("teacher_id", createdUsers.filter((u) => u.role === "guru").map((u) => u.id));
    if (eventIds.length > 0) {
      await adminBypass.from("calendar_events").delete().in("id", eventIds);
    }
    if (teacherRowId) {
      await adminBypass.from("teachers").delete().eq("id", teacherRowId);
    }
    if (studentRowId) {
      await adminBypass.from("students").delete().eq("id", studentRowId);
      await adminBypass.from("student_backups").delete().eq("student_id", studentRowId);
      await adminBypass.from("activity_logs").delete().eq("entity_id", studentRowId);
    }
    for (const user of createdUsers.reverse()) {
      await adminBypass.auth.admin.deleteUser(user.id);
    }
  }
}

main()
  .then(() => {
    console.log("Student dashboard audit selesai.");
  })
  .catch((error) => {
    console.error("Student dashboard audit gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
