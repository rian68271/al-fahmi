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

function normalizeIsoTimestamp(value) {
  return new Date(value).toISOString();
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
    { role: "admin", email: `laporan-admin-${suffix}@example.com`, name: `Laporan Admin ${suffix}` },
    { role: "guru", email: `laporan-guru-${suffix}@example.com`, name: `Laporan Guru ${suffix}` },
  ];
  const createdUsers = [];

  try {
    console.log("Membuat user sementara laporan absensi...");
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
    const teacherUser = createdUsers.find((u) => u.role === "guru");
    assert(adminUser && teacherUser, "User sementara laporan tidak lengkap.");

    const adminClient = await signIn(supabaseUrl, anonKey, adminUser.email, password);
    const teacherClient = await signIn(supabaseUrl, anonKey, teacherUser.email, password);

    console.log("Menyiapkan data batas bulan untuk April 2026...");
    const attendanceSeeds = [
      { type: "briefing", created_at: "2026-03-31T16:30:00.000Z", shouldInclude: false, label: "31 Mar 23:30 WIB" },
      { type: "briefing", created_at: "2026-03-31T17:30:00.000Z", shouldInclude: true, label: "1 Apr 00:30 WIB" },
      { type: "rapat", created_at: "2026-04-30T16:30:00.000Z", shouldInclude: true, label: "30 Apr 23:30 WIB" },
      { type: "briefing", created_at: "2026-04-30T17:30:00.000Z", shouldInclude: false, label: "1 Mei 00:30 WIB" },
    ];

    for (const seed of attendanceSeeds) {
      const insert = await teacherClient
        .from("attendances")
        .insert({
          user_id: teacherUser.id,
          type: seed.type,
          status: "hadir",
          created_at: seed.created_at,
        })
        .select()
        .single();

      assert(!insert.error, `Gagal menyiapkan attendance seed ${seed.label}: ${insert.error?.message}`);
    }

    const { fromUtc, toUtc } = getJakartaMonthUtcRange("2026-04");
    console.log(`Mengambil range laporan April 2026: ${fromUtc} s/d ${toUtc}`);

    const attendanceResult = await adminClient.from("attendances").select("id, user_id, type, status, created_at").gte("created_at", fromUtc).lte("created_at", toUtc).eq("user_id", teacherUser.id).order("created_at", { ascending: true });

    assert(!attendanceResult.error, `Admin gagal mengambil attendance untuk laporan: ${attendanceResult.error?.message}`);

    const returned = attendanceResult.data ?? [];
    const returnedDates = returned.map((item) => normalizeIsoTimestamp(item.created_at));
    const expectedDates = attendanceSeeds.filter((item) => item.shouldInclude).map((item) => normalizeIsoTimestamp(item.created_at));
    const excludedDates = attendanceSeeds.filter((item) => !item.shouldInclude).map((item) => normalizeIsoTimestamp(item.created_at));

    console.log("Tanggal absensi yang kembali dari query laporan:", returnedDates);

    assert(returned.length === expectedDates.length, `Jumlah attendance laporan tidak sesuai. Dapat ${returned.length}, expected ${expectedDates.length}.`);

    for (const expected of expectedDates) {
      assert(returnedDates.includes(expected), `Attendance ${expected} semestinya masuk laporan April 2026.`);
    }

    for (const excluded of excludedDates) {
      assert(!returnedDates.includes(excluded), `Attendance ${excluded} semestinya tidak masuk laporan April 2026.`);
    }

    console.log("Smoke test rekap bulanan absensi lulus.");
  } finally {
    console.log("Membersihkan data uji laporan absensi...");
    await adminBypass
      .from("attendances")
      .delete()
      .in(
        "user_id",
        createdUsers.map((u) => u.id),
      );

    for (const user of createdUsers.reverse()) {
      await adminBypass.auth.admin.deleteUser(user.id);
    }
  }
}

main()
  .then(() => {
    console.log("Attendance report smoke test selesai.");
  })
  .catch((error) => {
    console.error("Attendance report smoke test gagal:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
