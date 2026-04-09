# Al-Fahmi School Platform

Platform administrasi sekolah berbasis `React + TypeScript + Vite + Supabase` untuk kebutuhan operasional guru, siswa, dan admin.

## Fitur Utama

- Dashboard multi-role untuk `admin`, `guru`, dan `siswa`
- Absensi guru berbasis lokasi
- Penilaian Al-Qur'an untuk siswa yang sudah di-assign
- Kalender akademik dan notifikasi in-app
- Pengaturan sekolah untuk radius absensi
- Laporan dan ekspor data
- Modul manajemen data guru dan siswa
  - CRUD guru dan siswa
  - validasi data
  - pencarian dan filter
  - import siswa dari Excel dan CSV
  - export Excel dan PDF
  - audit trail aktivitas
  - backup otomatis data siswa
  - upload foto profil siswa

## Stack

- Frontend: `React`, `TypeScript`, `Vite`, `Tailwind CSS`, `Zustand`
- Backend: `Supabase Auth`, `Supabase Database`, `Supabase Storage`
- Utility: `xlsx`

## Menjalankan Project

1. Install dependency:

```bash
npm install
```

2. Salin environment:

```bash
copy .env.example .env.local
```

3. Isi variabel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Jalankan development server:

```bash
npm run dev
```

## Verifikasi

- Type check:

```bash
npm run check
```

- Build produksi:

```bash
npm run build
```

## Backend Supabase

Dokumentasi migrasi dan query verifikasi tersedia di [supabase/README.md](file:///c:/Users/Onsyi/Downloads/Al-fahmi/supabase/README.md).

File penting:

- `supabase/migrations/202604090001_init_backend.sql`
- `supabase/migrations/202604090002_notifications.sql`
- `supabase/migrations/202604090003_demo_seed.sql`
- `supabase/migrations/202604090004_data_management.sql`
- `supabase/migrations/202604090005_fix_assessment_rls.sql`
- `supabase/queries/quick-check.sql`
- `supabase/queries/demo-cleanup.sql`
- `public/template-import-siswa.csv`

## Checklist Uji

Checklist QA dan pengujian alur tersedia di [TESTING-CHECKLIST.md](file:///c:/Users/Onsyi/Downloads/Al-fahmi/TESTING-CHECKLIST.md).

## Template Import

- Template import siswa siap pakai tersedia di `public/template-import-siswa.csv`.
- Unduh dari modul `Manajemen Data` lalu isi data dengan header kolom yang sama sebelum upload kembali.
- Format file yang didukung untuk impor siswa: `xlsx`, `xls`, dan `csv`.

## Operasional Demo

- Untuk mengisi data demo, jalankan seed `supabase/migrations/202604090003_demo_seed.sql`.
- Untuk membersihkan data demo tanpa menghapus struktur tabel, gunakan `supabase/queries/demo-cleanup.sql`.
