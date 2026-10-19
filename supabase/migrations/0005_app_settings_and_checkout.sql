-- 0005_app_settings_and_checkout.sql
-- Two gaps the finished frontend work needs:
-- (1) attendance_records.time_out — the Dashboard now renders a Time Out
--     column from r.time_out, so the column must exist on the table for the
--     check-out (checkout) write to land.
-- (2) app_settings — one editable row (id=1, enforced by CHECK) holding the
--     school name, the late check-in cutoff the attendance bridge compares
--     arrivals against, and the AI detection size + match threshold the
--     server passes to the recognizer when it spawns it. Staff can read the
--     row; only admins can change it. The row is seeded here so the Admin
--     Panel's settings form has something to load from day one.

alter table public.attendance_records
  add column if not exists time_out time;

create table if not exists public.app_settings (
  id              int primary key check (id = 1),
  school_name     text not null default 'PRISM-AI Primary School',
  late_cutoff     time not null default '08:00',
  det_size        int not null default 320,
  match_threshold real not null default 0.40,
  updated_at      timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Staff (admin/teacher/assistant) may read the settings.
drop policy if exists app_settings_select_staff on public.app_settings;
create policy app_settings_select_staff on public.app_settings
  for select to authenticated
  using (public.is_staff());

-- Only admins may insert / update / delete. House pattern from 0003
-- (policy_documents_admin_all): a single FOR ALL policy with USING + CHECK.
drop policy if exists app_settings_write_admin on public.app_settings;
create policy app_settings_write_admin on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed the single settings row; defaults fill every column.
insert into public.app_settings (id) values (1)
on conflict (id) do nothing;
