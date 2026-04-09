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
    const { data, error } = await adminClient.from("profiles").select("id, role").eq("id", userId).maybeSingle();
    if (!error && data?.role === expectedRole) return;
    await wait(300);
  }

  throw new Error(`Profile ${userId} dengan role ${expectedRole} tidak tersedia.`);
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");
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
    { role: "admin", email: `absensi-admin-${suffix}@example.com`, name: `Absensi Admin ${suffix}` },
    { role: "guru", email: `absensi-guru-a-${suffix}@example.com`, name: `Absensi Guru A ${suffix}` },
    { role: "guru", email: `absensi-guru-b-${suffix}@example.com`, name: `Absensi Guru B ${suffix}` },
    { role: "siswa", email: `absensi-siswa-${suffix}@example.com`, name: `Absensi Siswa ${suffix}` },
  ];

  const createdUsers = [];
  let originalSettings = null;
  const failures = [];

  const recordCheck = (condition, message) => {
    if (!condition) {
      failures.push(message);
      console.error(`FAIL: ${message}`);
      return;
    }

    console.log(`OK: ${message}`);
  };

  try {
    console.log("Membuat user sementara absensi...");
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

      createdUsers.push({ ...tempUser, id: data.user.id });
      await waitForProfile(adminBypass, data.user.id, tempUser.role);
    }

    const adminUser = createdUsers.find((u) => u.role === "admin");
    const teacherA = createdUsers.find((u) => u.email.includes("-a-"));
    const teacherB = createdUsers.find((u) => u.email.includes("-b-"));
    const studentUser = createdUsers.find((u) => u.role === "siswa");

    assert(adminUser && teacherA && teacherB && studentUser, "User absensi sementara tidak lengkap.");

    const adminClient = await signIn(supabaseUrl, anonKey, adminUser.email, password);
    const teacherClientA = await signIn(supabaseUrl, anonKey, teacherA.email, password);
    const teacherClientB = await signIn(supabaseUrl, anonKey, teacherB.email, password);
    const studentClient = await signIn(supabaseUrl, anonKey, studentUser.email, password);

    console.log("Menyiapkan settings lokasi...");
    const settingsResult = await adminClient.from("settings").select("*").limit(1).maybeSingle();
    assert(!settingsResult.error && settingsResult.data, `Admin gagal membaca settings: ${settingsResult.error?.message}`);
    originalSettings = settingsResult.data;

    const testSettings = {
      id: originalSettings.id,
      school_lat: -6.2,
      school_lng: 106.816666,
      max_radius: 120,
    };

    const settingsUpdate = await adminClient.from("settings").upsert(testSettings).select().single();
    assert(!settingsUpdate.error, `Gagal memperbarui settings untuk uji absensi: ${settingsUpdate.error?.message}`);

    console.log("Uji guru A: absen briefing berhasil...");
    const briefingInsert = await teacherClientA
      .from("attendances")
      .insert({
        user_id: teacherA.id,
        type: "briefing",
        status: "hadir",
      })
      .select()
      .single();
    recordCheck(!briefingInsert.error && Boolean(briefingInsert.data), `Guru A dapat absen briefing. Detail: ${briefingInsert.error?.message ?? "ok"}`);

    console.log("Uji guru A: absen harian dalam radius berhasil...");
    const insideDaily = await teacherClientA
      .from("attendances")
      .insert({
        user_id: teacherA.id,
        type: "harian",
        status: "berhasil",
        lat: -6.2,
        lng: 106.816666,
      })
      .select()
      .single();
    recordCheck(!insideDaily.error && Boolean(insideDaily.data), `Guru A dapat absen harian dalam radius. Detail: ${insideDaily.error?.message ?? "ok"}`);

    console.log("Uji guru A: absen harian ganda di hari yang sama harus ditolak...");
    const duplicateDaily = await teacherClientA
      .from("attendances")
      .insert({
        user_id: teacherA.id,
        type: "harian",
        status: "berhasil",
        lat: -6.2,
        lng: 106.816666,
      })
      .select();
    recordCheck(Boolean(duplicateDaily.error), "Guru A tidak bisa absen harian dua kali di hari yang sama.");

    console.log("Uji guru B: absen harian di luar radius harus ditolak...");
    const outsideDaily = await teacherClientB
      .from("attendances")
      .insert({
        user_id: teacherB.id,
        type: "harian",
        status: "berhasil",
        lat: -6.25,
        lng: 106.85,
      })
      .select();
    recordCheck(Boolean(outsideDaily.error), "Guru B tidak bisa absen harian di luar radius.");

    console.log("Uji siswa: insert absensi sendiri harus ditolak...");
    const studentAttendance = await studentClient
      .from("attendances")
      .insert({
        user_id: studentUser.id,
        type: "briefing",
        status: "hadir",
      })
      .select();
    recordCheck(Boolean(studentAttendance.error), "Siswa tidak bisa membuat absensi.");

    console.log("Uji guru A: insert absensi untuk guru B harus ditolak...");
    const foreignAttendance = await teacherClientA
      .from("attendances")
      .insert({
        user_id: teacherB.id,
        type: "briefing",
        status: "hadir",
      })
      .select();
    recordCheck(Boolean(foreignAttendance.error), "Guru A tidak bisa membuat absensi untuk guru lain.");

    console.log("Uji visibilitas histori absensi...");
    const teacherOwnRead = await teacherClientA.from("attendances").select("id, user_id, type, status");
    recordCheck(!teacherOwnRead.error && (teacherOwnRead.data?.length ?? 0) === 2, "Guru A hanya melihat 2 absensi miliknya.");

    const studentRead = await studentClient.from("attendances").select("id, user_id, type, status");
    recordCheck(!studentRead.error && (studentRead.data?.length ?? 0) === 0, "Siswa tidak melihat data absensi.");

    const adminRead = await adminClient.from("attendances").select("id, user_id, type, status");
    recordCheck(!adminRead.error && (adminRead.data?.length ?? 0) >= 2, "Admin bisa membaca absensi guru.");

    if (failures.length > 0) {
      throw new Error(`Ditemukan ${failures.length} kegagalan absensi:\n- ${failures.join("\n- ")}`);
    }

    console.log("Semua smoke test absensi lulus.");
  } finally {
    console.log("Membersihkan data uji absensi...");
    await adminBypass
      .from("attendances")
      .delete()
      .in(
        "user_id",
        createdUsers.map((u) => u.id),
      );

    if (originalSettings?.id) {
      await adminBypass.from("settings").upsert({
        id: originalSettings.id,
        school_lat: originalSettings.school_lat,
        school_lng: originalSettings.school_lng,
        max_radius: originalSettings.max_radius,
      });
    }

    for (const user of createdUsers.reverse()) {
      await adminBypass.auth.admin.deleteUser(user.id);
    }
  }
}

main()
  .then(() => {
    console.log("Attendance smoke test selesai.");
  })
  .catch((error) => {
    console.error("Attendance smoke test gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
