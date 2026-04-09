create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text unique,
  role text not null default 'guru' check (role in ('admin', 'guru', 'siswa')),
  class_id text,
  id_guru text unique,
  mata_pelajaran text,
  id_murid text unique,
  kelas text,
  sekolah text default 'SDIT Al-Fahmi',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and role = 'admin'
  );
$$;

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  school_lat numeric(10, 7) not null,
  school_lng numeric(10, 7) not null,
  max_radius integer not null check (max_radius > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('harian', 'briefing', 'rapat')),
  status text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teacher_student_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint teacher_student_assignments_unique unique (teacher_id, student_id)
);

create table if not exists public.quran_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('tahfidz', 'tahsin')),
  juz_jilid text not null,
  surah text,
  ayat_dari text,
  ayat_sampai text,
  halaman text,
  nilai numeric(5, 2) not null check (nilai >= 0 and nilai <= 100),
  catatan text,
  kehadiran_siswa text,
  date date not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists attendances_user_id_created_at_idx
  on public.attendances (user_id, created_at desc);

create index if not exists teacher_student_assignments_teacher_id_idx
  on public.teacher_student_assignments (teacher_id);

create index if not exists teacher_student_assignments_student_id_idx
  on public.teacher_student_assignments (student_id);

create index if not exists quran_assessments_student_id_date_idx
  on public.quran_assessments (student_id, date desc);

create index if not exists quran_assessments_teacher_id_date_idx
  on public.quran_assessments (teacher_id, date desc);

create index if not exists calendar_events_event_date_idx
  on public.calendar_events (event_date asc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
before update on public.settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inferred_role text;
begin
  inferred_role :=
    coalesce(
      new.raw_user_meta_data ->> 'role',
      case
        when lower(coalesce(new.email, '')) like '%admin%' then 'admin'
        when lower(coalesce(new.email, '')) like '%siswa%' then 'siswa'
        else 'guru'
      end
    );

  insert into public.profiles (
    id,
    name,
    email,
    role,
    class_id,
    id_guru,
    mata_pelajaran,
    id_murid,
    kelas,
    sekolah
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'user'), '@', 1)),
    new.email,
    inferred_role,
    new.raw_user_meta_data ->> 'class_id',
    new.raw_user_meta_data ->> 'id_guru',
    new.raw_user_meta_data ->> 'mata_pelajaran',
    new.raw_user_meta_data ->> 'id_murid',
    new.raw_user_meta_data ->> 'kelas',
    coalesce(new.raw_user_meta_data ->> 'sekolah', 'SDIT Al-Fahmi')
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    class_id = excluded.class_id,
    id_guru = excluded.id_guru,
    mata_pelajaran = excluded.mata_pelajaran,
    id_murid = excluded.id_murid,
    kelas = excluded.kelas,
    sekolah = excluded.sekolah,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.attendances enable row level security;
alter table public.teacher_student_assignments enable row level security;
alter table public.quran_assessments enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "settings_select_authenticated" on public.settings;
create policy "settings_select_authenticated"
on public.settings
for select
to authenticated
using (true);

drop policy if exists "settings_admin_insert" on public.settings;
create policy "settings_admin_insert"
on public.settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "settings_admin_update" on public.settings;
create policy "settings_admin_update"
on public.settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "settings_admin_delete" on public.settings;
create policy "settings_admin_delete"
on public.settings
for delete
to authenticated
using (public.is_admin());

drop policy if exists "calendar_select_authenticated" on public.calendar_events;
create policy "calendar_select_authenticated"
on public.calendar_events
for select
to authenticated
using (true);

drop policy if exists "calendar_admin_insert" on public.calendar_events;
create policy "calendar_admin_insert"
on public.calendar_events
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "calendar_admin_update" on public.calendar_events;
create policy "calendar_admin_update"
on public.calendar_events
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "calendar_admin_delete" on public.calendar_events;
create policy "calendar_admin_delete"
on public.calendar_events
for delete
to authenticated
using (public.is_admin());

drop policy if exists "attendances_select_own_or_admin" on public.attendances;
create policy "attendances_select_own_or_admin"
on public.attendances
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "attendances_insert_own_or_admin" on public.attendances;
create policy "attendances_insert_own_or_admin"
on public.attendances
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "attendances_delete_admin" on public.attendances;
create policy "attendances_delete_admin"
on public.attendances
for delete
to authenticated
using (public.is_admin());

drop policy if exists "assignments_select_related" on public.teacher_student_assignments;
create policy "assignments_select_related"
on public.teacher_student_assignments
for select
to authenticated
using (
  public.is_admin()
  or auth.uid() = teacher_id
  or auth.uid() = student_id
);

drop policy if exists "assignments_admin_insert" on public.teacher_student_assignments;
create policy "assignments_admin_insert"
on public.teacher_student_assignments
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "assignments_admin_update" on public.teacher_student_assignments;
create policy "assignments_admin_update"
on public.teacher_student_assignments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assignments_admin_delete" on public.teacher_student_assignments;
create policy "assignments_admin_delete"
on public.teacher_student_assignments
for delete
to authenticated
using (public.is_admin());

drop policy if exists "assessments_select_related" on public.quran_assessments;
create policy "assessments_select_related"
on public.quran_assessments
for select
to authenticated
using (
  public.is_admin()
  or auth.uid() = teacher_id
  or auth.uid() = student_id
);

drop policy if exists "assessments_insert_teacher_or_admin" on public.quran_assessments;
create policy "assessments_insert_teacher_or_admin"
on public.quran_assessments
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid() = teacher_id
    and exists (
      select 1
      from public.teacher_student_assignments tsa
      where tsa.teacher_id = teacher_id
        and tsa.student_id = student_id
    )
  )
);

drop policy if exists "assessments_update_teacher_or_admin" on public.quran_assessments;
create policy "assessments_update_teacher_or_admin"
on public.quran_assessments
for update
to authenticated
using (public.is_admin() or auth.uid() = teacher_id)
with check (public.is_admin() or auth.uid() = teacher_id);

drop policy if exists "assessments_delete_admin" on public.quran_assessments;
create policy "assessments_delete_admin"
on public.quran_assessments
for delete
to authenticated
using (public.is_admin());

insert into public.settings (school_lat, school_lng, max_radius)
select -6.2000000, 106.8166660, 100
where not exists (select 1 from public.settings);
