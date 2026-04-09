# Supabase Backend Migration

Folder ini berisi migrasi backend Supabase yang diselaraskan dengan frontend aktif pada project `Al-fahmi`.

## File Utama

- `migrations/202604090001_init_backend.sql`
- `migrations/202604090002_notifications.sql`
- `migrations/202604090003_demo_seed.sql`
- `migrations/202604090004_data_management.sql`
- `migrations/202604090005_fix_assessment_rls.sql`
- `migrations/202604090006_attendance_hardening.sql`
- `queries/quick-check.sql`
- `queries/demo-cleanup.sql`
- `CREATE-DEMO-USERS.md`

## Yang Dibuat Oleh Migrasi

- Tabel `profiles`
- Tabel `settings`
- Tabel `attendances`
- Tabel `teacher_student_assignments`
- Tabel `quran_assessments`
- Tabel `calendar_events`
- Tabel `notifications`
- Tabel `teachers`
- Tabel `students`
- Tabel `activity_logs`
- Tabel `student_backups`
- Trigger sinkronisasi `auth.users -> profiles`
- Trigger `updated_at`
- Trigger audit trail guru
- Trigger audit trail dan backup otomatis siswa
- RLS policy per role
- Bucket storage `student-photos`
- Seed awal `settings`
- Seed awal `notifications`
- Seed demo untuk akun `admin@test.com`, `guru@test.com`, `siswa@test.com`

## Cara Apply Ke Supabase

### Opsi 1: Supabase SQL Editor

1. Buka dashboard project Supabase.
2. Masuk ke menu `SQL Editor`.
3. Jalankan file `migrations/202604090001_init_backend.sql`.
4. Lanjutkan dengan `migrations/202604090002_notifications.sql`.
5. Jalankan `migrations/202604090004_data_management.sql`.
6. Jalankan `migrations/202604090005_fix_assessment_rls.sql`.
7. Jalankan `migrations/202604090006_attendance_hardening.sql`.
8. Jika ingin data demo, lanjutkan dengan `migrations/202604090003_demo_seed.sql`.

### Opsi 2: Supabase CLI

Jika project Anda sudah terkoneksi dengan Supabase CLI:

```bash
npx supabase db push
```

Atau jika ingin menjalankan file SQL manual:

```bash
npx supabase migration up
```

## Catatan

- Migrasi ini dirancang agar cocok dengan query frontend di `src/lib/supabase-data.ts`.
- Role yang digunakan: `admin`, `guru`, `siswa`.
- Frontend hanya memakai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` harus tetap dipakai hanya untuk server-side / admin task, bukan browser client.
- Jika migrasi awal sudah dijalankan sebelumnya, jalankan migrasi `202604090004_data_management.sql` untuk mengaktifkan modul manajemen data guru dan siswa.
- Jalankan migrasi `202604090005_fix_assessment_rls.sql` untuk memastikan guru tidak dapat menilai siswa yang belum di-assign.
- Jalankan migrasi `202604090006_attendance_hardening.sql` untuk memastikan fitur absensi hanya berlaku untuk guru, absensi harian tervalidasi radius, dan tidak bisa dobel di hari yang sama.
- Seed demo ketiga mengasumsikan akun `admin@test.com`, `guru@test.com`, dan `siswa@test.com` sudah ada di `auth.users`.
- Seed demo juga akan mengisi tabel master `teachers` dan `students` bila migrasi `202604090004_data_management.sql` sudah aktif.
- File `queries/quick-check.sql` bisa dijalankan di SQL Editor untuk memastikan data utama sudah terisi dengan benar setelah migrasi dan seed.
- File `queries/demo-cleanup.sql` dapat dipakai untuk membersihkan data demo sebelum menjalankan seed ulang.
- Ikuti `CREATE-DEMO-USERS.md` jika akun demo auth belum ada.
