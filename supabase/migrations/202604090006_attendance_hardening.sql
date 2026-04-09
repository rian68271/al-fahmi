-- Hardening fitur absensi:
-- 1) hanya guru atau admin yang dapat mengakses absensi
-- 2) absensi harian wajib berada dalam radius sekolah
-- 3) absensi harian hanya boleh satu kali per hari per guru

drop policy if exists "attendances_select_own_or_admin" on public.attendances;
create policy "attendances_select_own_or_admin"
on public.attendances
for select
to authenticated
using (
  public.is_admin()
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'guru'
    )
  )
);

drop policy if exists "attendances_insert_own_or_admin" on public.attendances;
create policy "attendances_insert_own_or_admin"
on public.attendances
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'guru'
    )
  )
);

create or replace function public.validate_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.settings;
  v_distance double precision;
begin
  if new.created_at is null then
    new.created_at := timezone('utc', now());
  end if;

  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception 'Anda tidak berwenang membuat absensi untuk user lain.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'guru'
  ) then
    raise exception 'Hanya guru yang dapat melakukan absensi.';
  end if;

  if new.type = 'harian' then
    if new.lat is null or new.lng is null then
      raise exception 'Absensi harian wajib menyertakan koordinat lokasi.';
    end if;

    select *
    into v_settings
    from public.settings
    order by created_at asc
    limit 1;

    if v_settings.id is null then
      raise exception 'Pengaturan lokasi sekolah belum tersedia.';
    end if;

    v_distance :=
      2 * 6371000 * asin(
        sqrt(
          power(sin(radians((new.lat - v_settings.school_lat) / 2)), 2) +
          cos(radians(v_settings.school_lat)) *
          cos(radians(new.lat)) *
          power(sin(radians((new.lng - v_settings.school_lng) / 2)), 2)
        )
      );

    if v_distance > v_settings.max_radius then
      raise exception 'Lokasi absensi berada di luar radius sekolah.';
    end if;

    new.status := coalesce(nullif(new.status, ''), 'berhasil');
  else
    new.status := coalesce(nullif(new.status, ''), 'hadir');
    new.lat := null;
    new.lng := null;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_attendance_insert_trigger on public.attendances;
create trigger validate_attendance_insert_trigger
before insert on public.attendances
for each row
execute function public.validate_attendance_insert();

create unique index if not exists attendances_harian_once_per_day_idx
on public.attendances (
  user_id,
  ((timezone('Asia/Jakarta', created_at))::date)
)
where type = 'harian';
