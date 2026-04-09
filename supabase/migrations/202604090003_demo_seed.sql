do $$
declare
  admin_id uuid;
  guru_id uuid;
  siswa_id uuid;
begin
  select id into admin_id from public.profiles where lower(email) = 'admin@test.com' limit 1;
  select id into guru_id from public.profiles where lower(email) = 'guru@test.com' limit 1;
  select id into siswa_id from public.profiles where lower(email) = 'siswa@test.com' limit 1;

  if admin_id is null then
    raise notice 'Demo seed: akun admin@test.com belum ditemukan di public.profiles.';
  end if;

  if guru_id is null then
    raise notice 'Demo seed: akun guru@test.com belum ditemukan di public.profiles.';
  end if;

  if siswa_id is null then
    raise notice 'Demo seed: akun siswa@test.com belum ditemukan di public.profiles.';
  end if;

  if admin_id is not null then
    update public.profiles
    set
      name = coalesce(name, 'Admin Sekolah'),
      role = 'admin',
      sekolah = coalesce(sekolah, 'SDIT Al-Fahmi')
    where id = admin_id;
  end if;

  if guru_id is not null then
    update public.profiles
    set
      name = coalesce(name, 'Ustadz Ahmad'),
      role = 'guru',
      id_guru = coalesce(id_guru, 'GR-001'),
      mata_pelajaran = coalesce(mata_pelajaran, 'Tahfidz Al-Quran'),
      kelas = coalesce(kelas, '7A'),
      sekolah = coalesce(sekolah, 'SDIT Al-Fahmi')
    where id = guru_id;

    insert into public.teachers (
      profile_id,
      nip,
      full_name,
      subjects,
      education_history,
      employment_status,
      contact_phone,
      contact_email,
      contact_address,
      notes
    )
    select
      guru_id,
      '198812012010011001',
      'Ustadz Ahmad',
      '["Tahfidz Al-Quran", "Tahsin"]'::jsonb,
      '["S1 Pendidikan Agama Islam", "Sertifikasi Tahsin Dasar"]'::jsonb,
      'tetap',
      '081234567890',
      'guru@test.com',
      'Jl. Pendidikan No. 10, Jakarta',
      'Guru demo untuk pengujian modul manajemen data.'
    where not exists (
      select 1
      from public.teachers t
      where t.profile_id = guru_id
         or t.nip = '198812012010011001'
    );
  end if;

  if siswa_id is not null then
    update public.profiles
    set
      name = coalesce(name, 'Ahmad Fauzi'),
      role = 'siswa',
      id_murid = coalesce(id_murid, 'SW-001'),
      kelas = coalesce(kelas, '7A'),
      sekolah = coalesce(sekolah, 'SDIT Al-Fahmi')
    where id = siswa_id;

    insert into public.students (
      profile_id,
      nis,
      full_name,
      class_name,
      major,
      student_status,
      guardian_info,
      address,
      phone,
      academic_history,
      notes
    )
    select
      siswa_id,
      '2026001',
      'Ahmad Fauzi',
      '7A',
      'Tahfidz',
      'aktif',
      '{
        "fatherName": "Bapak Fauzan",
        "motherName": "Ibu Aisyah",
        "guardianName": "",
        "relationship": "Orang Tua",
        "phone": "081298765432",
        "occupation": "Wiraswasta"
      }'::jsonb,
      'Jl. Melati No. 21, Jakarta',
      '081377788899',
      '["Semester 1 - Rata-rata 88", "Tahfidz Juz 30 selesai"]'::jsonb,
      'Siswa demo untuk pengujian import/export dan backup.'
    where not exists (
      select 1
      from public.students s
      where s.profile_id = siswa_id
         or s.nis = '2026001'
    );
  end if;

  if admin_id is not null then
    insert into public.calendar_events (title, description, event_date, created_by)
    select seed.title, seed.description, seed.event_date, admin_id
    from (
      values
        ('Ujian Tengah Semester', 'Pelaksanaan UTS Tahfidz dan Tahsin.', current_date + 7),
        ('Rapat Kerja Guru', 'Evaluasi bulanan guru dan tenaga kependidikan.', current_date + 10),
        ('Pembagian Raport', 'Pengambilan hasil belajar siswa.', current_date + 20)
    ) as seed(title, description, event_date)
    where not exists (
      select 1
      from public.calendar_events ce
      where ce.title = seed.title
        and ce.event_date = seed.event_date
    );
  end if;

  if guru_id is not null and siswa_id is not null then
    insert into public.teacher_student_assignments (teacher_id, student_id)
    values (guru_id, siswa_id)
    on conflict (teacher_id, student_id) do nothing;

    insert into public.quran_assessments (
      student_id,
      teacher_id,
      category,
      juz_jilid,
      surah,
      ayat_dari,
      ayat_sampai,
      halaman,
      nilai,
      catatan,
      kehadiran_siswa,
      date
    )
    select *
    from (
      values
        (
          siswa_id,
          guru_id,
          'tahfidz',
          'Juz 30',
          'An-Naba',
          '1',
          '10',
          null,
          88,
          'Bacaan baik, tajwid perlu sedikit ditingkatkan.',
          'Hadir',
          current_date - 2
        ),
        (
          siswa_id,
          guru_id,
          'tahsin',
          'Jilid 4',
          null,
          null,
          null,
          '12',
          85,
          'Makharijul huruf cukup baik, lanjutkan latihan halaman berikutnya.',
          'Hadir',
          current_date - 1
        )
    ) as seed(student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date)
    where not exists (
      select 1
      from public.quran_assessments qa
      where qa.student_id = seed.student_id
        and qa.teacher_id = seed.teacher_id
        and qa.category = seed.category
        and qa.date = seed.date
    );

    insert into public.attendances (user_id, type, status, lat, lng, created_at)
    select seed.user_id, seed.type, seed.status, seed.lat, seed.lng, seed.created_at
    from (
      values
        (guru_id, 'harian', 'berhasil', -6.2000000::numeric, 106.8166660::numeric, timezone('utc', now()) - interval '1 day'),
        (guru_id, 'briefing', 'hadir', null::numeric, null::numeric, timezone('utc', now()) - interval '1 day' + interval '10 minutes'),
        (guru_id, 'harian', 'berhasil', -6.2000000::numeric, 106.8166660::numeric, timezone('utc', now()))
    ) as seed(user_id, type, status, lat, lng, created_at)
    where not exists (
      select 1
      from public.attendances a
      where a.user_id = seed.user_id
        and a.type = seed.type
        and date_trunc('minute', a.created_at) = date_trunc('minute', seed.created_at)
    );
  end if;

  if admin_id is not null then
    insert into public.notifications (title, body, type, link_href, role_target)
    select 'Monitoring Absensi', 'Pantau absensi guru hari ini dan pastikan tidak ada data yang tertinggal.', 'info', '/laporan', 'admin'
    where not exists (
      select 1
      from public.notifications n
      where n.title = 'Monitoring Absensi'
        and n.role_target = 'admin'
    );
  end if;

  if guru_id is not null then
    insert into public.notifications (title, body, type, link_href, role_target, recipient_id)
    select 'Penilaian Mingguan', 'Lengkapi penilaian siswa yang sudah ditugaskan sebelum akhir pekan.', 'warning', '/penilaian', 'guru', guru_id
    where not exists (
      select 1
      from public.notifications n
      where n.title = 'Penilaian Mingguan'
        and n.recipient_id = guru_id
    );
  end if;

  if siswa_id is not null then
    insert into public.notifications (title, body, type, link_href, role_target, recipient_id)
    select 'Nilai Baru Tersedia', 'Guru telah menginput penilaian terbaru. Periksa halaman Nilai Saya.', 'success', '/nilai-saya', 'siswa', siswa_id
    where not exists (
      select 1
      from public.notifications n
      where n.title = 'Nilai Baru Tersedia'
        and n.recipient_id = siswa_id
    );
  end if;

  raise notice 'Demo seed selesai. admin_id=%, guru_id=%, siswa_id=%', admin_id, guru_id, siswa_id;
end $$;
