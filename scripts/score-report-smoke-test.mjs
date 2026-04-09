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

function getMonthDateRange(monthValue) {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const startDate = `${yearText}-${monthText}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const nextMonthStartDate = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return { startDate, nextMonthStartDate };
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
  const tempUsers = [
    { role: "admin", email: `nilai-admin-${suffix}@example.com`, name: `Nilai Admin ${suffix}` },
    { role: "guru", email: `nilai-guru-${suffix}@example.com`, name: `Nilai Guru ${suffix}` },
    { role: "siswa", email: `nilai-siswa-a-${suffix}@example.com`, name: `Nilai Siswa A ${suffix}`, kelas: "7A", id_murid: `S-${suffix}-A` },
    { role: "siswa", email: `nilai-siswa-b-${suffix}@example.com`, name: `Nilai Siswa B ${suffix}`, kelas: "7B", id_murid: `S-${suffix}-B` },
  ];
  const createdUsers = [];

  try {
    console.log("Membuat user sementara laporan nilai...");
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
    assert(adminUser && teacherUser && studentA && studentB, "User sementara laporan nilai tidak lengkap.");

    const adminClient = await signIn(supabaseUrl, anonKey, adminUser.email, password);

    console.log("Menyiapkan assignment dan data nilai batas bulan...");
    await adminBypass.from("teacher_student_assignments").insert([
      { teacher_id: teacherUser.id, student_id: studentA.id },
      { teacher_id: teacherUser.id, student_id: studentB.id },
    ]);

    const assessmentSeeds = [
      { student_id: studentA.id, category: "tahfidz", date: "2026-03-31", shouldInclude: false, shouldClass7A: false, label: "31 Mar" },
      { student_id: studentA.id, category: "tahfidz", date: "2026-04-01", shouldInclude: true, shouldClass7A: true, label: "1 Apr" },
      { student_id: studentB.id, category: "tahsin", date: "2026-04-15", shouldInclude: true, shouldClass7A: false, label: "15 Apr kelas 7B" },
      { student_id: studentA.id, category: "tahsin", date: "2026-05-01", shouldInclude: false, shouldClass7A: false, label: "1 Mei" },
    ];

    for (const [index, seed] of assessmentSeeds.entries()) {
      const insert = await adminBypass
        .from("quran_assessments")
        .insert({
          student_id: seed.student_id,
          teacher_id: teacherUser.id,
          category: seed.category,
          juz_jilid: seed.category === "tahfidz" ? "Juz 30" : "Jilid 2",
          surah: seed.category === "tahfidz" ? "An-Naba" : null,
          ayat_dari: seed.category === "tahfidz" ? "1" : null,
          ayat_sampai: seed.category === "tahfidz" ? "5" : null,
          halaman: seed.category === "tahsin" ? "7" : null,
          nilai: 85 + index,
          catatan: `Seed laporan nilai ${index + 1}`,
          kehadiran_siswa: "Hadir",
          date: seed.date,
        })
        .select()
        .single();

      assert(!insert.error, `Gagal insert assessment ${seed.label}: ${insert.error?.message}`);
    }

    const { startDate, nextMonthStartDate } = getMonthDateRange("2026-04");

    console.log("Mengambil assessment untuk April 2026...");
    const assessmentsResult = await adminClient
      .from("quran_assessments")
      .select("id, student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date")
      .gte("date", startDate)
      .lt("date", nextMonthStartDate)
      .order("date", { ascending: true });

    assert(!assessmentsResult.error, `Admin gagal mengambil assessments laporan: ${assessmentsResult.error?.message}`);

    const aprilRows = assessmentsResult.data ?? [];
    const aprilDates = aprilRows.map((item) => item.date);
    assert(aprilRows.length === 2, `Jumlah nilai April tidak sesuai. Dapat ${aprilRows.length}, expected 2.`);
    assert(aprilDates.includes("2026-04-01"), "Nilai tanggal 2026-04-01 semestinya masuk laporan April.");
    assert(aprilDates.includes("2026-04-15"), "Nilai tanggal 2026-04-15 semestinya masuk laporan April.");
    assert(!aprilDates.includes("2026-03-31"), "Nilai tanggal 2026-03-31 semestinya tidak masuk laporan April.");
    assert(!aprilDates.includes("2026-05-01"), "Nilai tanggal 2026-05-01 semestinya tidak masuk laporan April.");

    console.log("Memverifikasi filter kelas 7A...");
    const profileIds = Array.from(new Set(aprilRows.flatMap((item) => [item.student_id, item.teacher_id])));
    const profilesResult = await adminClient.from("profiles").select("id, name, kelas").in("id", profileIds);
    assert(!profilesResult.error, `Admin gagal mengambil profiles laporan nilai: ${profilesResult.error?.message}`);
    const profiles = profilesResult.data ?? [];

    const class7ARows = aprilRows.filter((item) => {
      const student = profiles.find((profile) => profile.id === item.student_id);
      return (student?.kelas ?? "") === "7A";
    });

    assert(class7ARows.length === 1, `Filter kelas 7A tidak sesuai. Dapat ${class7ARows.length}, expected 1.`);
    assert(class7ARows[0]?.date === "2026-04-01", "Filter kelas 7A semestinya hanya mengembalikan nilai siswa 7A pada April.");

    console.log("Smoke test laporan nilai siswa lulus.");
  } finally {
    console.log("Membersihkan data uji laporan nilai...");
    await adminBypass
      .from("quran_assessments")
      .delete()
      .in("teacher_id", createdUsers.filter((u) => u.role === "guru").map((u) => u.id));
    await adminBypass
      .from("teacher_student_assignments")
      .delete()
      .in("teacher_id", createdUsers.filter((u) => u.role === "guru").map((u) => u.id));

    for (const user of createdUsers.reverse()) {
      await adminBypass.auth.admin.deleteUser(user.id);
    }
  }
}

main()
  .then(() => {
    console.log("Score report smoke test selesai.");
  })
  .catch((error) => {
    console.error("Score report smoke test gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
