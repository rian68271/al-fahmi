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

function getJakartaDayUtcRange(date) {
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

function getCurrentMonthValue(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });

  const [yearText, monthText] = formatter.format(date).split("-");
  return `${yearText}-${monthText}`;
}

function getMonthDateRange(monthValue) {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const startDate = `${yearText}-${monthText}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const nextMonthStartDate = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return {
    startDate,
    nextMonthStartDate,
  };
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
  const now = new Date();
  const currentMonth = getCurrentMonthValue(now);
  const { fromUtc: startOfDay, toUtc: endOfDay } = getJakartaDayUtcRange(now);
  const { startDate: currentMonthStart, nextMonthStartDate } = getMonthDateRange(currentMonth);

  const tempUsers = [
    { role: "admin", email: `dash-admin-${suffix}@example.com`, name: `Dash Admin ${suffix}` },
    { role: "guru", email: `dash-guru-${suffix}@example.com`, name: `Dash Guru ${suffix}` },
    { role: "siswa", email: `dash-siswa-${suffix}@example.com`, name: `Dash Siswa ${suffix}`, kelas: "8A", id_murid: `D-${suffix}` },
  ];
  const createdUsers = [];
  let teacherRowId = null;
  let studentRowId = null;
  let currentMonthEventId = null;
  let nextMonthEventId = null;

  try {
    console.log("Membuat user sementara dashboard...");
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
    assert(adminUser && teacherUser && studentUser, "User sementara dashboard tidak lengkap.");

    const adminClient = await signIn(supabaseUrl, anonKey, adminUser.email, password);
    const teacherClient = await signIn(supabaseUrl, anonKey, teacherUser.email, password);

    const teacherInsert = await adminBypass
      .from("teachers")
      .insert({
        profile_id: teacherUser.id,
        nip: `DASH-NIP-${suffix}`,
        full_name: teacherUser.name,
        subjects: ["Tahfidz"],
        education_history: ["S1"],
        employment_status: "tetap",
      })
      .select()
      .single();
    assert(!teacherInsert.error && teacherInsert.data, `Gagal insert teacher dashboard: ${teacherInsert.error?.message}`);
    teacherRowId = teacherInsert.data.id;

    const studentInsert = await adminBypass
      .from("students")
      .insert({
        profile_id: studentUser.id,
        nis: `DASH-NIS-${suffix}`,
        full_name: studentUser.name,
        class_name: "8A",
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
        address: "Alamat dashboard",
        phone: "0812",
        academic_history: ["Semester 1 - 90"],
        notes: "Seed dashboard",
      })
      .select()
      .single();
    assert(!studentInsert.error && studentInsert.data, `Gagal insert student dashboard: ${studentInsert.error?.message}`);
    studentRowId = studentInsert.data.id;

    const nextMonthDate = (() => {
      const [yearText, monthText] = currentMonth.split("-");
      const nextMonth = new Date(Date.UTC(Number(yearText), Number(monthText), 5));
      return `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-05`;
    })();

    const currentMonthEventInsert = await adminBypass
      .from("calendar_events")
      .insert({
        title: `Agenda Dashboard ${suffix}`,
        description: "Seed current month event",
        event_date: `${currentMonth}-20`,
      })
      .select()
      .single();
    assert(!currentMonthEventInsert.error && currentMonthEventInsert.data, `Gagal insert current month event: ${currentMonthEventInsert.error?.message}`);
    currentMonthEventId = currentMonthEventInsert.data.id;

    const nextMonthEventInsert = await adminBypass
      .from("calendar_events")
      .insert({
        title: `Agenda Dashboard Next ${suffix}`,
        description: "Seed next month event",
        event_date: nextMonthDate,
      })
      .select()
      .single();
    assert(!nextMonthEventInsert.error && nextMonthEventInsert.data, `Gagal insert next month event: ${nextMonthEventInsert.error?.message}`);
    nextMonthEventId = nextMonthEventInsert.data.id;

    await adminBypass.from("teacher_student_assignments").insert({
      teacher_id: teacherUser.id,
      student_id: studentUser.id,
    });

    const attendanceInsert = await teacherClient.from("attendances").insert([
      { user_id: teacherUser.id, type: "harian", status: "berhasil", lat: -6.2, lng: 106.816666, created_at: new Date(new Date(startOfDay).getTime() + 30 * 60 * 1000).toISOString() },
      { user_id: teacherUser.id, type: "briefing", status: "hadir", created_at: new Date(new Date(startOfDay).getTime() + 60 * 60 * 1000).toISOString() },
    ]);
    assert(!attendanceInsert.error, `Gagal insert attendance dashboard: ${attendanceInsert.error?.message}`);

    await adminBypass.from("quran_assessments").insert([
      {
        student_id: studentUser.id,
        teacher_id: teacherUser.id,
        category: "tahfidz",
        juz_jilid: "Juz 30",
        surah: "An-Naba",
        ayat_dari: "1",
        ayat_sampai: "5",
        halaman: null,
        nilai: 91,
        catatan: "Seed current month dashboard",
        kehadiran_siswa: "Hadir",
        date: `${currentMonth}-10`,
      },
      {
        student_id: studentUser.id,
        teacher_id: teacherUser.id,
        category: "tahsin",
        juz_jilid: "Jilid 2",
        surah: null,
        ayat_dari: null,
        ayat_sampai: null,
        halaman: "7",
        nilai: 87,
        catatan: "Seed next month dashboard",
        kehadiran_siswa: "Hadir",
        date: nextMonthDate,
      },
    ]);

    console.log("Mengambil statistik admin dari sumber dashboard...");
    const [teachersResult, studentsResult, attendancesResult, eventsResult] = await Promise.all([
      adminClient.from("teachers").select("id"),
      adminClient.from("students").select("id"),
      adminClient.from("attendances").select("id, type, created_at").gte("created_at", startOfDay).lte("created_at", endOfDay),
      adminClient.from("calendar_events").select("id, event_date"),
    ]);

    assert(!teachersResult.error && !studentsResult.error && !attendancesResult.error && !eventsResult.error, "Gagal mengambil statistik admin dari sumber dashboard.");

    const dashboardTeacherCount = teachersResult.data?.length ?? 0;
    const dashboardStudentCount = studentsResult.data?.length ?? 0;
    const dashboardTodayAttendanceCount = (attendancesResult.data ?? []).filter((item) => item.type === "harian").length;
    const dashboardMonthEvents = (eventsResult.data ?? []).filter((event) => event.event_date.startsWith(currentMonth)).length;

    const rawTeacherCount = await adminBypass.from("teachers").select("*", { count: "exact", head: true });
    const rawStudentCount = await adminBypass.from("students").select("*", { count: "exact", head: true });
    const rawTodayAttendance = await adminBypass.from("attendances").select("*", { count: "exact", head: true }).eq("type", "harian").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const rawMonthEvents = await adminBypass.from("calendar_events").select("id, event_date");

    assert(dashboardTeacherCount === (rawTeacherCount.count ?? 0), `Stat admin Total Guru mismatch. Dashboard=${dashboardTeacherCount}, raw=${rawTeacherCount.count ?? 0}`);
    assert(dashboardStudentCount === (rawStudentCount.count ?? 0), `Stat admin Total Siswa mismatch. Dashboard=${dashboardStudentCount}, raw=${rawStudentCount.count ?? 0}`);
    assert(dashboardTodayAttendanceCount === (rawTodayAttendance.count ?? 0), `Stat admin Absensi Hari Ini mismatch. Dashboard=${dashboardTodayAttendanceCount}, raw=${rawTodayAttendance.count ?? 0}`);
    assert(dashboardMonthEvents === (rawMonthEvents.data ?? []).filter((event) => event.event_date.startsWith(currentMonth)).length, `Stat admin Agenda Bulan Ini mismatch. Dashboard=${dashboardMonthEvents}`);

    console.log("Mengambil statistik guru dari sumber dashboard...");
    const [guruAttendanceResult, guruAssignmentsResult, guruAssessmentsResult] = await Promise.all([
      teacherClient.from("attendances").select("id, type, created_at").eq("user_id", teacherUser.id).gte("created_at", startOfDay).lte("created_at", endOfDay),
      teacherClient.from("teacher_student_assignments").select("id, teacher_id, student_id").eq("teacher_id", teacherUser.id),
      teacherClient.from("quran_assessments").select("id, date").eq("teacher_id", teacherUser.id).gte("date", currentMonthStart).lt("date", nextMonthStartDate),
    ]);

    assert(!guruAttendanceResult.error && !guruAssignmentsResult.error && !guruAssessmentsResult.error, "Gagal mengambil statistik guru dari sumber dashboard.");

    const dashboardGuruStatus = (guruAttendanceResult.data ?? []).some((item) => item.type === "harian") ? "Hadir" : "Belum Absen";
    const dashboardAssignmentCount = guruAssignmentsResult.data?.length ?? 0;
    const dashboardAssessmentCount = guruAssessmentsResult.data?.length ?? 0;

    const rawGuruAttendance = await adminBypass.from("attendances").select("*", { count: "exact", head: true }).eq("user_id", teacherUser.id).eq("type", "harian").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const rawGuruAssignments = await adminBypass.from("teacher_student_assignments").select("*", { count: "exact", head: true }).eq("teacher_id", teacherUser.id);
    const rawGuruAssessments = await adminBypass.from("quran_assessments").select("*", { count: "exact", head: true }).eq("teacher_id", teacherUser.id).gte("date", currentMonthStart).lt("date", nextMonthStartDate);

    assert(dashboardGuruStatus === ((rawGuruAttendance.count ?? 0) > 0 ? "Hadir" : "Belum Absen"), `Stat guru Status Kehadiran mismatch. Dashboard=${dashboardGuruStatus}`);
    assert(dashboardAssignmentCount === (rawGuruAssignments.count ?? 0), `Stat guru Siswa Tertugaskan mismatch. Dashboard=${dashboardAssignmentCount}, raw=${rawGuruAssignments.count ?? 0}`);
    assert(dashboardAssessmentCount === (rawGuruAssessments.count ?? 0), `Stat guru Sudah Dinilai mismatch. Dashboard=${dashboardAssessmentCount}, raw=${rawGuruAssessments.count ?? 0}`);

    console.log("Audit statistik dashboard admin dan guru lulus.");
  } finally {
    console.log("Membersihkan data audit dashboard...");
    await adminBypass
      .from("quran_assessments")
      .delete()
      .in(
        "teacher_id",
        createdUsers.filter((u) => u.role === "guru").map((u) => u.id),
      );
    await adminBypass
      .from("teacher_student_assignments")
      .delete()
      .in(
        "teacher_id",
        createdUsers.filter((u) => u.role === "guru").map((u) => u.id),
      );
    await adminBypass
      .from("attendances")
      .delete()
      .in(
        "user_id",
        createdUsers.map((u) => u.id),
      );
    if (currentMonthEventId) {
      await adminBypass.from("calendar_events").delete().eq("id", currentMonthEventId);
    }
    if (nextMonthEventId) {
      await adminBypass.from("calendar_events").delete().eq("id", nextMonthEventId);
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
    console.log("Dashboard stats audit selesai.");
  })
  .catch((error) => {
    console.error("Dashboard stats audit gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
