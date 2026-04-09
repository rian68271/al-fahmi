# Buat Akun Demo Supabase Auth

Seed `202604090003_demo_seed.sql` tidak membuat akun login baru. Seed hanya mengisi data demo untuk akun yang **sudah ada** di `auth.users` dan `public.profiles`.

## Akun Yang Harus Dibuat
- `admin@test.com`
- `guru@test.com`
- `siswa@test.com`

## Cara Buat Di Supabase Dashboard
1. Buka project Supabase Anda.
2. Masuk ke menu `Authentication`.
3. Buka tab `Users`.
4. Klik `Add user`.
5. Buat tiga akun berikut:
   - `admin@test.com`
   - `guru@test.com`
   - `siswa@test.com`
6. Isi password untuk masing-masing akun.

## Setelah User Dibuat
1. Pastikan trigger dari migrasi `202604090001_init_backend.sql` sudah aktif.
2. Jalankan query ini:

```sql
select id, email, name, role
from public.profiles
where email in ('admin@test.com', 'guru@test.com', 'siswa@test.com');
```

3. Jika ketiga profile sudah muncul, jalankan:
   - `migrations/202604090003_demo_seed.sql`

## Hasil Yang Diharapkan
- Profile demo terisi role dan data tambahan
- Assignment guru-siswa masuk
- Attendance demo masuk
- Penilaian demo masuk
- Notifikasi personal masuk

## Jika Profile Tidak Muncul
- Pastikan akun benar-benar sudah dibuat di `Authentication > Users`
- Cek trigger `on_auth_user_created` dari migrasi pertama
- Buat user baru lagi jika trigger belum aktif saat user sebelumnya dibuat
