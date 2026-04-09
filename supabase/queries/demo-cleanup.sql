-- Cleanup data demo tanpa menghapus struktur tabel
-- Jalankan hanya jika ingin mengulang seed demo pada project development/staging.

do $$
declare
  admin_id uuid;
  guru_id uuid;
  siswa_id uuid;
begin
  select id into admin_id from public.profiles where lower(email) = 'admin@test.com' limit 1;
  select id into guru_id from public.profiles where lower(email) = 'guru@test.com' limit 1;
  select id into siswa_id from public.profiles where lower(email) = 'siswa@test.com' limit 1;

  delete from public.notifications
  where title in ('Monitoring Absensi', 'Penilaian Mingguan', 'Nilai Baru Tersedia');

  delete from public.quran_assessments
  where (guru_id is not null and teacher_id = guru_id)
     or (siswa_id is not null and student_id = siswa_id);

  delete from public.teacher_student_assignments
  where (guru_id is not null and teacher_id = guru_id)
     or (siswa_id is not null and student_id = siswa_id);

  delete from public.attendances
  where guru_id is not null
    and user_id = guru_id;

  delete from public.calendar_events
  where title in ('Ujian Tengah Semester', 'Rapat Kerja Guru', 'Pembagian Raport');

  delete from public.activity_logs
  where (entity_id in (select id from public.teachers where profile_id = guru_id))
     or (entity_id in (select id from public.students where profile_id = siswa_id))
     or (actor_id in (admin_id, guru_id, siswa_id))
     or (entity_label in ('Ustadz Ahmad', 'Ahmad Fauzi'));

  delete from public.student_backups
  where student_id in (select id from public.students where profile_id = siswa_id);

  delete from public.teachers
  where profile_id = guru_id
     or nip = '198812012010011001';

  delete from public.students
  where profile_id = siswa_id
     or nis = '2026001';

  raise notice 'Demo cleanup selesai. admin_id=%, guru_id=%, siswa_id=%', admin_id, guru_id, siswa_id;
end $$;
