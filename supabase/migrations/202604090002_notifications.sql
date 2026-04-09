create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  link_href text,
  role_target text check (role_target in ('admin', 'guru', 'siswa')),
  recipient_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_role_target_idx
  on public.notifications (role_target);

create index if not exists notifications_recipient_id_idx
  on public.notifications (recipient_id);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_related" on public.notifications;
create policy "notifications_select_related"
on public.notifications
for select
to authenticated
using (
  public.is_admin()
  or recipient_id = auth.uid()
  or role_target is null
  or role_target = (
    select p.role
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert"
on public.notifications
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "notifications_admin_update" on public.notifications;
create policy "notifications_admin_update"
on public.notifications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notifications_admin_delete" on public.notifications;
create policy "notifications_admin_delete"
on public.notifications
for delete
to authenticated
using (public.is_admin());

insert into public.notifications (title, body, type, link_href, role_target)
select * from (
  values
    (
      'Briefing Pagi',
      'Briefing guru dimulai pukul 07.00. Pastikan absensi briefing tercatat sebelum kegiatan dimulai.',
      'info',
      '/absensi',
      'guru'
    ),
    (
      'Sinkronisasi Kalender',
      'Kalender sekolah telah diperbarui. Periksa agenda terbaru untuk pekan ini.',
      'info',
      '/kalender',
      null
    ),
    (
      'Rekap Penilaian',
      'Admin dapat mengekspor laporan nilai siswa setelah guru menyelesaikan input bulan berjalan.',
      'success',
      '/laporan',
      'admin'
    )
) as seed(title, body, type, link_href, role_target)
where not exists (select 1 from public.notifications);
