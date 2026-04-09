import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
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

function getJakartaMonthUtcRange(selectedMonth) {
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

function normalizeAttendanceTypeLabel(type) {
  const normalized = String(type).toLowerCase();
  if (normalized === "briefing") return "Briefing";
  if (normalized === "rapat") return "Rapat";
  return "Harian";
}

function buildWorkbookRowsForAttendance(attendances, teacherMap) {
  return attendances
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
}

function buildWorkbookRowsForScores(assessments, profiles, selectedClass) {
  return assessments
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
}

function parseWorkbookRows(rows) {
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Tidak ada data untuk filter yang dipilih." }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const readWorkbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = readWorkbook.Sheets[readWorkbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
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
  const selectedMonth = "2026-04";
  const tempUsers = [
    { role: "admin", email: `wb-admin-${suffix}@example.com`, name: `Workbook Admin ${suffix}` },
    { role: "guru", email: `wb-guru-${suffix}@example.com`, name: `Workbook Guru ${suffix}` },
    { role: "siswa", email: `wb-siswa-a-${suffix}@example.com`, name: `Workbook Siswa A ${suffix}`, kelas: "7A", id_murid: `WB-${suffix}-A` },
    { role: "siswa", email: `wb-siswa-b-${suffix}@example.com`, name: `Workbook Siswa B ${suffix}`, kelas: "7B", id_murid: `WB-${suffix}-B` },
  ];
  const createdUsers = [];
  let teacherRowId = null;
  const studentRowIds = [];

  try {
    console.log("Membuat user sementara audit workbook...");
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
    const studentA = createdUsers.find((u) => u.email.includes("-a-"));
    const studentB = createdUsers.find((u) => u.email.includes("-b-"));
    assert(adminUser && teacherUser && studentA && studentB, "User workbook sementara tidak lengkap.");

    const adminClient = await signIn(supabaseUrl, anonKey, adminUser.email, password);
    const teacherClient = await signIn(supabaseUrl, anonKey, teacherUser.email, password);

    const teacherInsert = await adminBypass
      .from("teachers")
      .insert({
        profile_id: teacherUser.id,
        nip: `WB-NIP-${suffix}`,
        full_name: teacherUser.name,
        subjects: ["Tahfidz"],
        education_history: ["S1"],
        employment_status: "tetap",
      })
      .select()
      .single();
    assert(!teacherInsert.error && teacherInsert.data, `Gagal insert teacher workbook: ${teacherInsert.error?.message}`);
    teacherRowId = teacherInsert.data.id;

    for (const student of [studentA, studentB]) {
      const insert = await adminBypass
        .from("students")
        .insert({
          profile_id: student.id,
          nis: `WB-NIS-${suffix}-${student.kelas}`,
          full_name: student.name,
          class_name: student.kelas,
          major: "Tahfidz",
          student_status: "aktif",
          guardian_info: {
            fatherName: "Ayah",
            motherName: "Ibu",
            guardianName: "",
            relationship: "Orang Tua",
            phone: "0812",
            occupation: "Wiraswasta",
          },
          address: `Alamat ${student.kelas}`,
          phone: "0812",
          academic_history: ["Semester 1 - 88"],
          notes: "Seed workbook",
        })
        .select()
        .single();

      assert(!insert.error && insert.data, `Gagal insert student workbook ${student.kelas}: ${insert.error?.message}`);
      studentRowIds.push(insert.data.id);
    }

    console.log("Menyiapkan data absensi dan nilai untuk workbook...");
    const assignmentInsert = await adminBypass.from("teacher_student_assignments").insert([
      { teacher_id: teacherUser.id, student_id: studentA.id },
      { teacher_id: teacherUser.id, student_id: studentB.id },
    ]);
    assert(!assignmentInsert.error, `Gagal insert assignment workbook: ${assignmentInsert.error?.message}`);

    const attendanceInsert = await teacherClient.from("attendances").insert([
      { user_id: teacherUser.id, type: "briefing", status: "hadir", created_at: "2026-03-31T17:30:00.000Z" },
      { user_id: teacherUser.id, type: "rapat", status: "hadir", created_at: "2026-04-30T16:30:00.000Z" },
    ]);
    assert(!attendanceInsert.error, `Gagal insert attendance workbook: ${attendanceInsert.error?.message}`);

    const assessmentInsert = await adminBypass.from("quran_assessments").insert([
      {
        student_id: studentA.id,
        teacher_id: teacherUser.id,
        category: "tahfidz",
        juz_jilid: "Juz 30",
        surah: "An-Naba",
        ayat_dari: "1",
        ayat_sampai: "5",
        halaman: null,
        nilai: 90,
        catatan: "Seed workbook A",
        kehadiran_siswa: "Hadir",
        date: "2026-04-01",
      },
      {
        student_id: studentB.id,
        teacher_id: teacherUser.id,
        category: "tahsin",
        juz_jilid: "Jilid 2",
        surah: null,
        ayat_dari: null,
        ayat_sampai: null,
        halaman: "7",
        nilai: 88,
        catatan: "Seed workbook B",
        kehadiran_siswa: "Izin",
        date: "2026-04-15",
      },
    ]);
    assert(!assessmentInsert.error, `Gagal insert assessment workbook: ${assessmentInsert.error?.message}`);

    const teacherProfilesResult = await adminClient.from("profiles").select("id, name, email, role, class_id, kelas, sekolah").eq("role", "guru");
    assert(!teacherProfilesResult.error, `Gagal ambil profiles guru workbook: ${teacherProfilesResult.error?.message}`);

    const { fromUtc, toUtc } = getJakartaMonthUtcRange(selectedMonth);
    const attendanceResult = await adminClient.from("attendances").select("id, user_id, type, status, lat, lng, created_at").gte("created_at", fromUtc).lte("created_at", toUtc).order("created_at", { ascending: false });
    assert(!attendanceResult.error, `Gagal ambil attendance workbook: ${attendanceResult.error?.message}`);
    console.log(
      "Attendance dalam rentang laporan:",
      (attendanceResult.data ?? []).map((item) => ({
        user_id: item.user_id,
        type: item.type,
        created_at: item.created_at,
      })),
    );

    const teacherMap = new Map((teacherProfilesResult.data ?? []).map((teacher) => [teacher.id, teacher]));
    const attendanceRows = buildWorkbookRowsForAttendance(attendanceResult.data ?? [], teacherMap);
    const attendanceWorkbookRows = parseWorkbookRows(attendanceRows);

    assert(attendanceWorkbookRows.length === 2, `Workbook absensi harus berisi 2 baris data, dapat ${attendanceWorkbookRows.length}.`);
    assert(
      attendanceWorkbookRows.every((row) => row.Nama_Guru === teacherUser.name),
      "Workbook absensi kolom Nama_Guru tidak sesuai.",
    );
    const attendanceTypes = attendanceWorkbookRows.map((row) => row.Tipe_Absen).sort();
    assert(attendanceTypes.includes("Briefing"), "Workbook absensi harus menyimpan label briefing.");
    assert(attendanceTypes.includes("Rapat"), "Workbook absensi harus menyimpan label rapat.");

    const assessmentsResult = await adminClient
      .from("quran_assessments")
      .select("id, student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date")
      .gte("date", "2026-04-01")
      .lt("date", "2026-05-01")
      .order("date", { ascending: true });
    assert(!assessmentsResult.error, `Gagal ambil assessments workbook: ${assessmentsResult.error?.message}`);

    const profileIds = Array.from(new Set((assessmentsResult.data ?? []).flatMap((item) => [item.student_id, item.teacher_id])));
    const profilesResult = await adminClient.from("profiles").select("id, name, email, role, class_id, kelas, sekolah").in("id", profileIds);
    assert(!profilesResult.error, `Gagal ambil profiles workbook nilai: ${profilesResult.error?.message}`);

    const scoreRows = buildWorkbookRowsForScores(assessmentsResult.data ?? [], profilesResult.data ?? [], "Semua Kelas");
    const scoreWorkbookRows = parseWorkbookRows(scoreRows);

    assert(scoreWorkbookRows.length === 2, `Workbook nilai harus berisi 2 baris data, dapat ${scoreWorkbookRows.length}.`);
    assert(scoreWorkbookRows[0]?.Nama_Siswa === studentA.name, "Workbook nilai kolom Nama_Siswa baris 1 tidak sesuai.");
    assert(scoreWorkbookRows[0]?.Kelas === "7A", "Workbook nilai kolom Kelas baris 1 tidak sesuai.");
    assert(scoreWorkbookRows[0]?.Kategori === "tahfidz", "Workbook nilai kategori baris 1 tidak sesuai.");
    assert(scoreWorkbookRows[1]?.Kehadiran === "Izin", "Workbook nilai kolom Kehadiran baris 2 tidak sesuai.");

    console.log("Audit isi workbook .xlsx laporan absensi dan nilai lulus.");
  } finally {
    console.log("Membersihkan data audit workbook...");
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
    if (teacherRowId) {
      await adminBypass.from("teachers").delete().eq("id", teacherRowId);
    }
    if (studentRowIds.length > 0) {
      await adminBypass.from("students").delete().in("id", studentRowIds);
      await adminBypass.from("student_backups").delete().in("student_id", studentRowIds);
      await adminBypass.from("activity_logs").delete().in("entity_id", studentRowIds);
    }
    for (const user of createdUsers.reverse()) {
      await adminBypass.auth.admin.deleteUser(user.id);
    }
  }
}

main()
  .then(() => {
    console.log("Report workbook audit selesai.");
  })
  .catch((error) => {
    console.error("Report workbook audit gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
