# Checklist Uji End-to-End

Dokumen ini dipakai untuk memverifikasi alur utama aplikasi setelah migrasi Supabase dan seed demo dijalankan.

## Prasyarat

- Migrasi `202604090001_init_backend.sql` sudah dijalankan.
- Migrasi `202604090002_notifications.sql` sudah dijalankan.
- Migrasi `202604090004_data_management.sql` sudah dijalankan.
- Seed `202604090003_demo_seed.sql` sudah dijalankan.
- Akun berikut sudah ada di Supabase Auth:
  - `admin@test.com`
  - `guru@test.com`
  - `siswa@test.com`

## Alur Admin

- Login dengan `admin@test.com`.
- Pastikan diarahkan ke dashboard admin.
- Verifikasi kartu statistik `Total Guru`, `Total Siswa`, `Absensi Hari Ini`, dan `Agenda Bulan Ini` tampil.
- Buka menu `Kalender`, lalu:
  - lihat agenda yang berasal dari seed
  - tambah agenda baru
  - edit agenda yang ada
  - hapus agenda
- Buka menu `Pengaturan`, lalu:
  - lihat nilai latitude, longitude, dan radius
  - ubah radius
  - simpan pengaturan
- Buka menu `Manajemen Data`, lalu:
  - pada tab `Modul Guru`, tambah guru baru
  - uji validasi NIP, email, mapel, dan riwayat pendidikan
  - cari guru berdasarkan nama/NIP
  - filter guru berdasarkan mapel dan status
  - edit dan hapus data guru
  - export data guru ke Excel
  - export data guru ke PDF
- Pada tab `Modul Siswa`, lalu:
  - unduh file `template-import-siswa.csv`
  - tambah siswa baru lengkap dengan data orang tua/wali
  - uji validasi NIS, kelas, jurusan, alamat, dan riwayat akademik
  - upload foto profil siswa
  - cari siswa berdasarkan NIS/nama/kelas/jurusan/telepon
  - filter siswa berdasarkan kelas, jurusan, dan status
  - import data siswa dari Excel
  - edit dan hapus data siswa
  - export data siswa ke Excel
  - export data siswa ke PDF
- Pada tab `Audit & Backup`, lalu:
  - pastikan log create, update, delete, import, export, upload tampil
  - pastikan backup otomatis siswa bertambah setelah ada perubahan data
- Buka menu `Laporan`, lalu:
  - export laporan absensi
  - export laporan nilai
- Pastikan notifikasi admin tampil di header dan dashboard.

## Alur Guru

- Login dengan `guru@test.com`.
- Pastikan diarahkan ke dashboard guru.
- Verifikasi statistik:
  - `Status Kehadiran`
  - `Siswa Tertugaskan`
  - `Sudah Dinilai`
- Buka menu `Absensi`, lalu:
  - lakukan `Absen Harian` saat geolocation aktif
  - lakukan `Absen Briefing`
  - lakukan `Absen Rapat`
  - pastikan histori absensi bertambah
- Buka menu `Penilaian`, lalu:
  - pastikan hanya siswa yang di-assign yang muncul
  - input penilaian Tahfidz
  - input penilaian Tahsin
  - simpan
- Kembali ke dashboard dan pastikan jumlah penilaian ikut berubah.
- Pastikan notifikasi guru tampil di header dan dashboard.

## Alur Siswa

- Login dengan `siswa@test.com`.
- Pastikan diarahkan ke dashboard siswa.
- Verifikasi statistik:
  - `Nilai Rata-Rata`
  - `Agenda Terdekat`
  - `Status Belajar`
- Buka menu `Kalender` dan pastikan agenda tampil.
- Buka menu `Nilai Saya`, lalu:
  - pastikan riwayat nilai tampil
  - pastikan guru, kategori, nilai, dan catatan sesuai
- Pastikan notifikasi siswa tampil di header dan dashboard.

## Validasi Teknis

- Jalankan `npm run check`.
- Pastikan tidak ada diagnostics TypeScript.
- Pastikan RLS tidak mengizinkan:
  - siswa membuka halaman admin
  - guru membuka pengaturan admin
  - guru atau siswa membaca tabel `teachers`, `students`, `activity_logs`, dan `student_backups` milik admin
  - siswa melihat data penilaian siswa lain
  - guru menilai siswa yang tidak di-assign

## Jika Ada Masalah

- Cek tabel `profiles` apakah role terisi benar.
- Cek tabel `teacher_student_assignments` apakah relasi guru-siswa sudah ada.
- Cek tabel `quran_assessments` apakah data berhasil masuk.
- Cek tabel `notifications` apakah notifikasi sesuai role/recipient sudah tersedia.
- Cek tabel `teachers` dan `students` apakah master data sudah masuk.
- Cek tabel `activity_logs` apakah audit trail terbentuk.
- Cek tabel `student_backups` apakah backup otomatis tercatat.
- Cek browser console dan respons query Supabase.
