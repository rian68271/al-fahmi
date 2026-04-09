-- Quick check setelah migrasi dan seed dijalankan

-- 1. Ringkasan jumlah data utama
select
  (select count(*) from public.profiles) as total_profiles,
  (select count(*) from public.teachers) as total_teachers,
  (select count(*) from public.students) as total_students,
  (select count(*) from public.settings) as total_settings,
  (select count(*) from public.calendar_events) as total_calendar_events,
  (select count(*) from public.attendances) as total_attendances,
  (select count(*) from public.teacher_student_assignments) as total_assignments,
  (select count(*) from public.quran_assessments) as total_assessments,
  (select count(*) from public.notifications) as total_notifications,
  (select count(*) from public.activity_logs) as total_activity_logs,
  (select count(*) from public.student_backups) as total_student_backups;

-- 2. Cek role user
select id, email, name, role, kelas
from public.profiles
order by role, email;

-- 3. Cek settings aktif
select *
from public.settings
order by created_at desc;

-- 4. Cek agenda sekolah
select title, event_date, created_by
from public.calendar_events
order by event_date asc;

-- 5. Cek assignment guru-siswa
select
  tsa.id,
  guru.email as guru_email,
  guru.name as guru_name,
  siswa.email as siswa_email,
  siswa.name as siswa_name,
  siswa.kelas
from public.teacher_student_assignments tsa
join public.profiles guru on guru.id = tsa.teacher_id
join public.profiles siswa on siswa.id = tsa.student_id
order by guru.name, siswa.name;

-- 6. Cek penilaian Al-Qur'an
select
  qa.date,
  qa.category,
  guru.name as guru_name,
  siswa.name as siswa_name,
  siswa.kelas,
  qa.nilai,
  qa.kehadiran_siswa
from public.quran_assessments qa
join public.profiles guru on guru.id = qa.teacher_id
join public.profiles siswa on siswa.id = qa.student_id
order by qa.date desc;

-- 7. Cek absensi guru
select
  a.created_at,
  p.name as guru_name,
  a.type,
  a.status,
  a.lat,
  a.lng
from public.attendances a
join public.profiles p on p.id = a.user_id
order by a.created_at desc;

-- 8. Cek notifikasi
select
  created_at,
  title,
  type,
  role_target,
  recipient_id
from public.notifications
order by created_at desc;

-- 9. Cek data guru
select
  nip,
  full_name,
  subjects,
  employment_status,
  contact_phone,
  contact_email
from public.teachers
order by full_name asc;

-- 10. Cek data siswa
select
  nis,
  full_name,
  class_name,
  major,
  student_status,
  guardian_info,
  phone
from public.students
order by class_name, full_name;

-- 11. Cek audit trail modul data
select
  created_at,
  module_name,
  action,
  entity_label,
  description
from public.activity_logs
order by created_at desc;

-- 12. Cek backup otomatis siswa
select
  created_at,
  backup_type,
  snapshot ->> 'full_name' as student_name,
  snapshot ->> 'nis' as student_nis
from public.student_backups
order by created_at desc;

-- 13. Ringkasan status guru
select
  employment_status,
  count(*) as total
from public.teachers
group by employment_status
order by employment_status;

-- 14. Ringkasan status siswa
select
  student_status,
  count(*) as total
from public.students
group by student_status
order by student_status;

-- 15. Cek data guru yang kontaknya belum lengkap
select
  nip,
  full_name,
  contact_phone,
  contact_email
from public.teachers
where contact_phone is null
   or contact_email is null
order by full_name;

-- 16. Cek data siswa yang belum punya alamat/telepon/riwayat akademik
select
  nis,
  full_name,
  class_name,
  major,
  address,
  phone,
  academic_history
from public.students
where trim(coalesce(address, '')) = ''
   or phone is null
   or jsonb_array_length(academic_history) = 0
order by class_name, full_name;

-- 17. Cek bucket foto siswa
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'student-photos';

-- 18. Cek jumlah file foto siswa yang tersimpan
select
  count(*) as total_student_photos
from storage.objects
where bucket_id = 'student-photos';

-- 19. Cek log ekspor, impor, upload, dan backup
select
  module_name,
  action,
  count(*) as total
from public.activity_logs
where action in ('export', 'import', 'upload', 'backup')
group by module_name, action
order by module_name, action;
