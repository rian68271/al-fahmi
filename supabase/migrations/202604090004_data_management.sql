create extension if not exists pg_trgm;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  nip text not null unique,
  full_name text not null,
  subjects jsonb not null default '[]'::jsonb,
  education_history jsonb not null default '[]'::jsonb,
  employment_status text not null default 'tetap' check (employment_status in ('tetap', 'honorer', 'kontrak', 'magang', 'nonaktif')),
  contact_phone text,
  contact_email text,
  contact_address text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint teachers_nip_not_blank check (char_length(trim(nip)) between 8 and 30),
  constraint teachers_name_not_blank check (char_length(trim(full_name)) >= 3),
  constraint teachers_subjects_array check (jsonb_typeof(subjects) = 'array'),
  constraint teachers_education_history_array check (jsonb_typeof(education_history) = 'array')
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  nis text not null unique,
  full_name text not null,
  class_name text not null,
  major text not null,
  student_status text not null default 'aktif' check (student_status in ('aktif', 'cuti', 'lulus', 'pindah', 'nonaktif')),
  guardian_info jsonb not null default '{}'::jsonb,
  address text not null default '',
  phone text,
  academic_history jsonb not null default '[]'::jsonb,
  photo_url text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint students_nis_not_blank check (char_length(trim(nis)) between 5 and 30),
  constraint students_name_not_blank check (char_length(trim(full_name)) >= 3),
  constraint students_class_not_blank check (char_length(trim(class_name)) >= 1),
  constraint students_major_not_blank check (char_length(trim(major)) >= 2),
  constraint students_guardian_info_object check (jsonb_typeof(guardian_info) = 'object'),
  constraint students_academic_history_array check (jsonb_typeof(academic_history) = 'array')
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  module_name text not null check (module_name in ('teachers', 'students', 'system')),
  entity_id uuid,
  entity_label text,
  action text not null check (action in ('create', 'update', 'delete', 'export', 'import', 'backup', 'upload')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.student_backups (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  backup_type text not null check (backup_type in ('insert', 'update', 'delete')),
  snapshot jsonb not null,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists teachers_full_name_idx
  on public.teachers (full_name);

create index if not exists teachers_employment_status_idx
  on public.teachers (employment_status);

create index if not exists teachers_nip_trgm_idx
  on public.teachers using gin (nip gin_trgm_ops);

create index if not exists teachers_full_name_trgm_idx
  on public.teachers using gin (full_name gin_trgm_ops);

create index if not exists students_class_major_status_idx
  on public.students (class_name, major, student_status);

create index if not exists students_nis_trgm_idx
  on public.students using gin (nis gin_trgm_ops);

create index if not exists students_full_name_trgm_idx
  on public.students using gin (full_name gin_trgm_ops);

create index if not exists activity_logs_module_created_at_idx
  on public.activity_logs (module_name, created_at desc);

create index if not exists activity_logs_entity_created_at_idx
  on public.activity_logs (entity_id, created_at desc);

create index if not exists student_backups_student_created_at_idx
  on public.student_backups (student_id, created_at desc);

drop trigger if exists set_teachers_updated_at on public.teachers;
create trigger set_teachers_updated_at
before update on public.teachers
for each row
execute function public.set_updated_at();

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at
before update on public.students
for each row
execute function public.set_updated_at();

create or replace function public.log_activity(
  p_module_name text,
  p_action text,
  p_description text,
  p_entity_id uuid default null,
  p_entity_label text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_before_data jsonb default null,
  p_after_data jsonb default null
)
returns public.activity_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.activity_logs;
begin
  insert into public.activity_logs (
    actor_id,
    module_name,
    entity_id,
    entity_label,
    action,
    description,
    metadata,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    p_module_name,
    p_entity_id,
    p_entity_label,
    p_action,
    p_description,
    coalesce(p_metadata, '{}'::jsonb),
    p_before_data,
    p_after_data
  )
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function public.handle_teacher_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'teachers',
      'create',
      format('Menambahkan data guru %s (%s).', new.full_name, new.nip),
      new.id,
      new.full_name,
      jsonb_build_object('nip', new.nip, 'employment_status', new.employment_status),
      null,
      to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(
      'teachers',
      'update',
      format('Memperbarui data guru %s (%s).', new.full_name, new.nip),
      new.id,
      new.full_name,
      jsonb_build_object('nip', new.nip, 'employment_status', new.employment_status),
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;

  perform public.log_activity(
    'teachers',
    'delete',
    format('Menghapus data guru %s (%s).', old.full_name, old.nip),
    old.id,
    old.full_name,
    jsonb_build_object('nip', old.nip, 'employment_status', old.employment_status),
    to_jsonb(old),
    null
  );
  return old;
end;
$$;

create or replace function public.handle_student_backup_and_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_row_id uuid;
  v_label text;
  v_nis text;
  v_class_name text;
  v_major text;
  v_status text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_snapshot := to_jsonb(new);
    v_row_id := new.id;
    v_label := new.full_name;
    v_nis := new.nis;
    v_class_name := new.class_name;
    v_major := new.major;
    v_status := new.student_status;
    v_description := format('Menambahkan data siswa %s (%s).', new.full_name, new.nis);
  elsif tg_op = 'UPDATE' then
    v_snapshot := to_jsonb(new);
    v_row_id := new.id;
    v_label := new.full_name;
    v_nis := new.nis;
    v_class_name := new.class_name;
    v_major := new.major;
    v_status := new.student_status;
    v_description := format('Memperbarui data siswa %s (%s).', new.full_name, new.nis);
  else
    v_snapshot := to_jsonb(old);
    v_row_id := old.id;
    v_label := old.full_name;
    v_nis := old.nis;
    v_class_name := old.class_name;
    v_major := old.major;
    v_status := old.student_status;
    v_description := format('Menghapus data siswa %s (%s).', old.full_name, old.nis);
  end if;

  insert into public.student_backups (student_id, backup_type, snapshot, actor_id)
  values (
    v_row_id,
    lower(tg_op),
    v_snapshot,
    auth.uid()
  );

  perform public.log_activity(
    'students',
    case
      when tg_op = 'INSERT' then 'create'
      when tg_op = 'UPDATE' then 'update'
      else 'delete'
    end,
    v_description,
    v_row_id,
    v_label,
    jsonb_build_object(
      'nis', v_nis,
      'class_name', v_class_name,
      'major', v_major,
      'student_status', v_status
    ),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  perform public.log_activity(
    'system',
    'backup',
    format('Menyimpan backup otomatis untuk siswa %s.', v_label),
    v_row_id,
    v_label,
    jsonb_build_object('source', 'trigger', 'backup_type', lower(tg_op)),
    null,
    v_snapshot
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists teachers_audit_trigger on public.teachers;
create trigger teachers_audit_trigger
after insert or update or delete on public.teachers
for each row
execute function public.handle_teacher_audit();

drop trigger if exists students_backup_audit_trigger on public.students;
create trigger students_backup_audit_trigger
after insert or update or delete on public.students
for each row
execute function public.handle_student_backup_and_audit();

alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.activity_logs enable row level security;
alter table public.student_backups enable row level security;

drop policy if exists "teachers_select_admin_or_owner" on public.teachers;
create policy "teachers_select_admin_or_owner"
on public.teachers
for select
to authenticated
using (
  public.is_admin()
  or auth.uid() = profile_id
);

drop policy if exists "teachers_admin_insert" on public.teachers;
create policy "teachers_admin_insert"
on public.teachers
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "teachers_admin_update" on public.teachers;
create policy "teachers_admin_update"
on public.teachers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "teachers_admin_delete" on public.teachers;
create policy "teachers_admin_delete"
on public.teachers
for delete
to authenticated
using (public.is_admin());

drop policy if exists "students_select_admin_or_owner" on public.students;
create policy "students_select_admin_or_owner"
on public.students
for select
to authenticated
using (
  public.is_admin()
  or auth.uid() = profile_id
);

drop policy if exists "students_admin_insert" on public.students;
create policy "students_admin_insert"
on public.students
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "students_admin_update" on public.students;
create policy "students_admin_update"
on public.students
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "students_admin_delete" on public.students;
create policy "students_admin_delete"
on public.students
for delete
to authenticated
using (public.is_admin());

drop policy if exists "activity_logs_admin_select" on public.activity_logs;
create policy "activity_logs_admin_select"
on public.activity_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "activity_logs_admin_insert" on public.activity_logs;
create policy "activity_logs_admin_insert"
on public.activity_logs
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "student_backups_admin_select" on public.student_backups;
create policy "student_backups_admin_select"
on public.student_backups
for select
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "student_photos_authenticated_read" on storage.objects;
create policy "student_photos_authenticated_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'student-photos');

drop policy if exists "student_photos_admin_insert" on storage.objects;
create policy "student_photos_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-photos'
  and public.is_admin()
);

drop policy if exists "student_photos_admin_update" on storage.objects;
create policy "student_photos_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-photos'
  and public.is_admin()
)
with check (
  bucket_id = 'student-photos'
  and public.is_admin()
);

drop policy if exists "student_photos_admin_delete" on storage.objects;
create policy "student_photos_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-photos'
  and public.is_admin()
);
