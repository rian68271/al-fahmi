import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProfile(adminClient, userId, expectedRole) {
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await adminClient.from("profiles").select("id, role").eq("id", userId).maybeSingle();
    if (!error && data?.role === expectedRole) {
      return data;
    }
    await wait(300);
  }

  throw new Error(`Profile ${userId} dengan role ${expectedRole} tidak muncul tepat waktu.`);
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

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local tidak ditemukan.");
  }

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

  const tempUsers = [
    { role: "admin", email: `trae-admin-${suffix}@example.com`, name: `Temp Admin ${suffix}` },
    { role: "guru", email: `trae-guru-${suffix}@example.com`, name: `Temp Guru ${suffix}` },
    { role: "siswa", email: `trae-siswa-a-${suffix}@example.com`, name: `Temp Siswa A ${suffix}` },
    { role: "siswa", email: `trae-siswa-b-${suffix}@example.com`, name: `Temp Siswa B ${suffix}` },
  ];

  const createdUsers = [];
  let calendarEventId = null;
  let teacherRowId = null;
  let studentRowIdA = null;
  let studentRowIdB = null;
  let photoObjectPath = null;
  let originalSettings = null;
  let assessmentId = null;

  try {
    console.log("Membuat user sementara untuk pengujian role...");

    for (const tempUser of tempUsers) {
      const { data, error } = await adminBypass.auth.admin.createUser({
        email: tempUser.email,
        password,
        email_confirm: true,
        user_metadata: {
          role: tempUser.role,
          name: tempUser.name,
          sekolah: "SDIT Al-Fahmi",
        },
      });

      if (error || !data.user) {
        throw new Error(`Gagal membuat user ${tempUser.email}: ${error?.message ?? "user kosong"}`);
      }

      createdUsers.push({
        ...tempUser,
        id: data.user.id,
      });

      await waitForProfile(adminBypass, data.user.id, tempUser.role);
    }

    const adminUser = createdUsers.find((user) => user.role === "admin");
    const teacherUser = createdUsers.find((user) => user.role === "guru");
    const studentUserA = createdUsers.find((user) => user.email.includes("-a-"));
    const studentUserB = createdUsers.find((user) => user.email.includes("-b-"));

    assert(adminUser && teacherUser && studentUserA && studentUserB, "User sementara tidak lengkap.");

    console.log("Login sebagai masing-masing role...");
    const adminClient = await signIn(supabaseUrl, anonKey, adminUser.email, password);
    const teacherClient = await signIn(supabaseUrl, anonKey, teacherUser.email, password);
    const studentClient = await signIn(supabaseUrl, anonKey, studentUserA.email, password);

    console.log("Mengambil settings untuk baseline...");
    const settingsResult = await adminClient.from("settings").select("*").limit(1).maybeSingle();
    assert(!settingsResult.error && settingsResult.data, `Admin gagal membaca settings: ${settingsResult.error?.message}`);
    originalSettings = settingsResult.data;

    console.log("Uji admin: update settings...");
    const updatedRadius = Number(originalSettings.max_radius) + 5;
    const settingsUpdate = await adminClient
      .from("settings")
      .upsert({
        id: originalSettings.id,
        school_lat: originalSettings.school_lat,
        school_lng: originalSettings.school_lng,
        max_radius: updatedRadius,
      })
      .select()
      .single();
    assert(!settingsUpdate.error, `Admin gagal update settings: ${settingsUpdate.error?.message}`);

    console.log("Uji guru: update settings harus ditolak...");
    const teacherSettingsUpdate = await teacherClient
      .from("settings")
      .update({ max_radius: updatedRadius + 1 })
      .eq("id", originalSettings.id)
      .select();
    const settingsAfterTeacherAttempt = await adminClient.from("settings").select("id, max_radius").eq("id", originalSettings.id).single();
    assert(!settingsAfterTeacherAttempt.error, `Gagal memverifikasi settings pasca update guru: ${settingsAfterTeacherAttempt.error?.message}`);
    assert(Number(settingsAfterTeacherAttempt.data.max_radius) === updatedRadius, `Guru semestinya tidak bisa update settings. Respons update: ${teacherSettingsUpdate.error?.message ?? "tanpa error eksplisit"}`);

    console.log("Uji admin: CRUD kalender...");
    const calendarInsert = await adminClient
      .from("calendar_events")
      .insert({
        title: `Agenda Uji ${suffix}`,
        description: "Agenda smoke test role",
        event_date: "2026-12-31",
      })
      .select()
      .single();
    assert(!calendarInsert.error && calendarInsert.data, `Admin gagal insert agenda: ${calendarInsert.error?.message}`);
    calendarEventId = calendarInsert.data.id;

    const calendarUpdate = await adminClient
      .from("calendar_events")
      .update({ title: `Agenda Uji Update ${suffix}` })
      .eq("id", calendarEventId)
      .select()
      .single();
    assert(!calendarUpdate.error, `Admin gagal update agenda: ${calendarUpdate.error?.message}`);

    const studentCalendarRead = await studentClient.from("calendar_events").select("id, title").eq("id", calendarEventId);
    assert(!studentCalendarRead.error && (studentCalendarRead.data?.length ?? 0) === 1, "Siswa semestinya bisa membaca agenda.");

    const studentCalendarInsert = await studentClient
      .from("calendar_events")
      .insert({ title: `Tidak Boleh ${suffix}`, description: null, event_date: "2026-11-01" })
      .select();
    assert(studentCalendarInsert.error, "Siswa semestinya tidak bisa menambah agenda.");

    console.log("Uji admin: CRUD master guru dan siswa...");
    const teacherInsert = await adminClient
      .from("teachers")
      .insert({
        profile_id: teacherUser.id,
        nip: `NIP-${suffix}`,
        full_name: teacherUser.name,
        subjects: ["Tahfidz", "Tahsin"],
        education_history: ["S1 PAI", "Pelatihan Tahsin"],
        employment_status: "tetap",
        contact_phone: "081200000001",
        contact_email: teacherUser.email,
        contact_address: "Alamat guru uji",
        notes: "Data guru sementara",
      })
      .select()
      .single();
    assert(!teacherInsert.error && teacherInsert.data, `Admin gagal insert guru: ${teacherInsert.error?.message}`);
    teacherRowId = teacherInsert.data.id;

    const studentInsertA = await adminClient
      .from("students")
      .insert({
        profile_id: studentUserA.id,
        nis: `NIS-${suffix}-A`,
        full_name: studentUserA.name,
        class_name: "7A",
        major: "Tahfidz",
        student_status: "aktif",
        guardian_info: {
          fatherName: "Ayah A",
          motherName: "Ibu A",
          guardianName: "",
          relationship: "Orang Tua",
          phone: "081300000001",
          occupation: "Wiraswasta",
        },
        address: "Alamat siswa A",
        phone: "081355500001",
        academic_history: ["Semester 1 - 88"],
        notes: "Data siswa A sementara",
      })
      .select()
      .single();
    assert(!studentInsertA.error && studentInsertA.data, `Admin gagal insert siswa A: ${studentInsertA.error?.message}`);
    studentRowIdA = studentInsertA.data.id;

    const studentInsertB = await adminClient
      .from("students")
      .insert({
        profile_id: studentUserB.id,
        nis: `NIS-${suffix}-B`,
        full_name: studentUserB.name,
        class_name: "7B",
        major: "Tahsin",
        student_status: "aktif",
        guardian_info: {
          fatherName: "Ayah B",
          motherName: "Ibu B",
          guardianName: "",
          relationship: "Orang Tua",
          phone: "081300000002",
          occupation: "Karyawan",
        },
        address: "Alamat siswa B",
        phone: "081355500002",
        academic_history: ["Semester 1 - 87"],
        notes: "Data siswa B sementara",
      })
      .select()
      .single();
    assert(!studentInsertB.error && studentInsertB.data, `Admin gagal insert siswa B: ${studentInsertB.error?.message}`);
    studentRowIdB = studentInsertB.data.id;

    console.log("Uji owner-scope: guru/siswa hanya melihat data master miliknya...");
    const teacherOwnRead = await teacherClient.from("teachers").select("id, profile_id, full_name");
    assert(!teacherOwnRead.error && (teacherOwnRead.data?.length ?? 0) === 1, "Guru semestinya hanya melihat 1 baris data guru miliknya.");

    const studentOwnRead = await studentClient.from("students").select("id, profile_id, full_name");
    assert(!studentOwnRead.error && (studentOwnRead.data?.length ?? 0) === 1, "Siswa semestinya hanya melihat 1 baris data siswa miliknya.");

    const teacherInsertByGuru = await teacherClient
      .from("teachers")
      .insert({
        nip: `NIP-FORBIDDEN-${suffix}`,
        full_name: "Tidak Boleh",
        subjects: ["Tahfidz"],
        education_history: ["S1"],
        employment_status: "tetap",
      })
      .select();
    assert(teacherInsertByGuru.error, "Guru semestinya tidak bisa menambah data guru master.");

    console.log("Uji storage: admin upload foto siswa...");
    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlJawAAAABJRU5ErkJggg==", "base64");
    photoObjectPath = `${studentRowIdA}/smoke-${suffix}.png`;
    const uploadResult = await adminClient.storage.from("student-photos").upload(photoObjectPath, tinyPng, {
      contentType: "image/png",
      upsert: true,
    });
    assert(!uploadResult.error, `Admin gagal upload foto siswa: ${uploadResult.error?.message}`);

    console.log("Uji admin: assignment guru-siswa...");
    const assignmentInsert = await adminClient
      .from("teacher_student_assignments")
      .insert({
        teacher_id: teacherUser.id,
        student_id: studentUserA.id,
      })
      .select()
      .single();
    assert(!assignmentInsert.error, `Admin gagal membuat assignment: ${assignmentInsert.error?.message}`);

    console.log("Uji guru: baca assignment sendiri...");
    const assignmentReadByGuru = await teacherClient.from("teacher_student_assignments").select("id, teacher_id, student_id");
    assert(!assignmentReadByGuru.error && (assignmentReadByGuru.data?.length ?? 0) === 1, "Guru semestinya melihat assignment miliknya.");

    console.log("Uji guru: insert attendance sendiri...");
    const attendanceInsert = await teacherClient
      .from("attendances")
      .insert({
        user_id: teacherUser.id,
        type: "briefing",
        status: "hadir",
      })
      .select()
      .single();
    assert(!attendanceInsert.error, `Guru gagal insert attendance sendiri: ${attendanceInsert.error?.message}`);

    const forbiddenAttendance = await teacherClient
      .from("attendances")
      .insert({
        user_id: studentUserA.id,
        type: "briefing",
        status: "hadir",
      })
      .select();
    assert(forbiddenAttendance.error, "Guru semestinya tidak bisa insert attendance milik user lain.");

    console.log("Uji guru: penilaian assigned student boleh, unassigned student ditolak...");
    const assessmentInsert = await teacherClient
      .from("quran_assessments")
      .insert({
        student_id: studentUserA.id,
        teacher_id: teacherUser.id,
        category: "tahfidz",
        juz_jilid: "Juz 30",
        surah: "An-Naba",
        ayat_dari: "1",
        ayat_sampai: "5",
        halaman: null,
        nilai: 90,
        catatan: "Penilaian smoke test",
        kehadiran_siswa: "Hadir",
        date: "2026-04-10",
      })
      .select()
      .single();
    assert(!assessmentInsert.error && assessmentInsert.data, `Guru gagal insert penilaian assigned student: ${assessmentInsert.error?.message}`);
    assessmentId = assessmentInsert.data.id;

    const forbiddenAssessment = await teacherClient
      .from("quran_assessments")
      .insert({
        student_id: studentUserB.id,
        teacher_id: teacherUser.id,
        category: "tahsin",
        juz_jilid: "Jilid 2",
        surah: null,
        ayat_dari: null,
        ayat_sampai: null,
        halaman: "5",
        nilai: 80,
        catatan: "Tidak boleh",
        kehadiran_siswa: "Hadir",
        date: "2026-04-10",
      })
      .select();
    assert(forbiddenAssessment.error, "Guru semestinya tidak bisa menilai siswa yang tidak di-assign.");

    console.log("Uji siswa: baca nilai sendiri...");
    const assessmentReadByStudent = await studentClient.from("quran_assessments").select("id, student_id, teacher_id, nilai");
    assert(!assessmentReadByStudent.error && (assessmentReadByStudent.data?.some((item) => item.id === assessmentId) ?? false), "Siswa semestinya bisa membaca nilai miliknya.");

    console.log("Uji audit dan backup hanya admin...");
    const logsReadByAdmin = await adminClient.from("activity_logs").select("id, module_name, action");
    assert(!logsReadByAdmin.error && (logsReadByAdmin.data?.length ?? 0) > 0, "Admin semestinya bisa membaca activity logs.");

    const backupsReadByAdmin = await adminClient.from("student_backups").select("id, student_id, backup_type");
    assert(!backupsReadByAdmin.error && (backupsReadByAdmin.data?.length ?? 0) > 0, "Admin semestinya bisa membaca student backups.");

    const logsReadByGuru = await teacherClient.from("activity_logs").select("id");
    assert(!logsReadByGuru.error && (logsReadByGuru.data?.length ?? 0) === 0, "Guru semestinya tidak bisa membaca activity logs.");

    const backupsReadByStudent = await studentClient.from("student_backups").select("id");
    assert(!backupsReadByStudent.error && (backupsReadByStudent.data?.length ?? 0) === 0, "Siswa semestinya tidak bisa membaca student backups.");

    console.log("Semua smoke test backend role-based lulus.");
  } finally {
    console.log("Membersihkan data sementara...");

    if (originalSettings?.id) {
      await adminBypass.from("settings").upsert({
        id: originalSettings.id,
        school_lat: originalSettings.school_lat,
        school_lng: originalSettings.school_lng,
        max_radius: originalSettings.max_radius,
      });
    }

    if (photoObjectPath) {
      await adminBypass.storage.from("student-photos").remove([photoObjectPath]);
    }

    await adminBypass.from("quran_assessments").delete().gte("date", "2026-04-10").ilike("catatan", "%smoke test%");
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
    if (calendarEventId) {
      await adminBypass.from("calendar_events").delete().eq("id", calendarEventId);
    }
    if (teacherRowId) {
      await adminBypass.from("teachers").delete().eq("id", teacherRowId);
    }
    if (studentRowIdA) {
      await adminBypass.from("students").delete().eq("id", studentRowIdA);
    }
    if (studentRowIdB) {
      await adminBypass.from("students").delete().eq("id", studentRowIdB);
    }
    if (studentRowIdA || studentRowIdB) {
      await adminBypass.from("student_backups").delete().in("student_id", [studentRowIdA, studentRowIdB].filter(Boolean));
    }
    if (teacherRowId || studentRowIdA || studentRowIdB) {
      await adminBypass.from("activity_logs").delete().in("entity_id", [teacherRowId, studentRowIdA, studentRowIdB].filter(Boolean));
    }

    for (const user of createdUsers.reverse()) {
      await adminBypass.auth.admin.deleteUser(user.id);
    }
  }
}

main()
  .then(() => {
    console.log("Smoke test selesai.");
  })
  .catch((error) => {
    console.error("Smoke test gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
