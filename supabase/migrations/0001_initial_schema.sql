-- =====================================================================
-- PRISM-AI Primary School Management System
-- Initial database schema (Phase 1: reference data + RLS scaffolding)
-- Target: Supabase Postgres 15+
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'teacher', 'parent', 'assistant');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'absent', 'late');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- profiles: extends auth.users with role + display fields
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'parent',
  full_name   text not null,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- years: Year 1 .. Year 6
create table if not exists public.years (
  year_num smallint primary key check (year_num between 1 and 6),
  label    text not null
);

-- subjects: the 6 KSSR subjects
create table if not exists public.subjects (
  id   smallint primary key generated always as identity,
  name text not null unique
);

-- class_sections: one row per Year x Class (e.g. Year 1 Bestari)
create table if not exists public.class_sections (
  id                  uuid primary key default gen_random_uuid(),
  year_num            smallint not null references public.years(year_num) on update cascade,
  name                text not null,
  color               text not null,
  homeroom_teacher_id uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (year_num, name)
);

-- subject_teachers: which teacher teaches which subject for which year
create table if not exists public.subject_teachers (
  subject_id smallint not null references public.subjects(id) on delete cascade,
  teacher_id uuid     not null references public.profiles(id) on delete cascade,
  year_num   smallint not null references public.years(year_num) on update cascade,
  primary key (subject_id, teacher_id, year_num)
);

-- students
create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  student_number   text unique not null,
  full_name        text not null,
  dob              date,
  gender           text check (gender in ('male', 'female')),
  year_num         smallint not null references public.years(year_num) on update cascade,
  class_section_id uuid not null references public.class_sections(id) on delete restrict,
  photo_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- parent_students: many-to-many between parent profiles and students
create table if not exists public.parent_students (
  parent_id    uuid not null references public.profiles(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  relationship text,
  is_primary   boolean not null default false,
  primary key (parent_id, student_id)
);

-- attendance_records: one row per student per day
create table if not exists public.attendance_records (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  date         date not null,
  status       public.attendance_status not null,
  arrival_time time,
  marked_by    uuid references public.profiles(id) on delete set null,
  marked_at    timestamptz not null default now(),
  notes        text,
  unique (student_id, date)
);

-- teacher_notes: free-form notes by teachers about a student
create table if not exists public.teacher_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- audit_logs: append-only record of significant actions
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- notifications: per-user inbox
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- school_events: calendar / announcements
create table if not exists public.school_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  event_date  date not null,
  event_type  text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ai_models: registry of attendance / face-recognition model versions
create table if not exists public.ai_models (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  version     text not null,
  accuracy    numeric(5, 2),
  status      text default 'inactive',
  deployed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_students_class_section
  on public.students (class_section_id);

create index if not exists idx_students_year_num
  on public.students (year_num);

create index if not exists idx_attendance_student_date_desc
  on public.attendance_records (student_id, date desc);

create index if not exists idx_attendance_date_desc
  on public.attendance_records (date desc);

create index if not exists idx_notifications_recipient_read
  on public.notifications (recipient_id, read_at);

create index if not exists idx_audit_logs_actor_created_desc
  on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth.users row appears.
-- Reads full_name and role from raw_user_meta_data; falls back to email/'parent'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  resolved_role public.user_role;
begin
  meta_role := new.raw_user_meta_data ->> 'role';

  begin
    resolved_role := coalesce(meta_role, 'parent')::public.user_role;
  exception when invalid_text_representation then
    resolved_role := 'parent';
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    resolved_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Helper functions for RLS policies
-- ---------------------------------------------------------------------

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'teacher', 'assistant')
  );
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.years              enable row level security;
alter table public.subjects           enable row level security;
alter table public.class_sections     enable row level security;
alter table public.subject_teachers   enable row level security;
alter table public.students           enable row level security;
alter table public.parent_students    enable row level security;
alter table public.attendance_records enable row level security;
alter table public.teacher_notes      enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.notifications      enable row level security;
alter table public.school_events      enable row level security;
alter table public.ai_models          enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.is_staff());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- years ---------------------------------------------------------------
drop policy if exists years_select_auth on public.years;
create policy years_select_auth on public.years
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists years_admin_all on public.years;
create policy years_admin_all on public.years
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- subjects ------------------------------------------------------------
drop policy if exists subjects_select_auth on public.subjects;
create policy subjects_select_auth on public.subjects
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists subjects_admin_all on public.subjects;
create policy subjects_admin_all on public.subjects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- class_sections ------------------------------------------------------
drop policy if exists class_sections_select_staff on public.class_sections;
create policy class_sections_select_staff on public.class_sections
  for select to authenticated
  using (public.is_staff());

drop policy if exists class_sections_select_parent on public.class_sections;
create policy class_sections_select_parent on public.class_sections
  for select to authenticated
  using (
    exists (
      select 1
        from public.students s
        join public.parent_students ps on ps.student_id = s.id
       where s.class_section_id = class_sections.id
         and ps.parent_id = auth.uid()
    )
  );

drop policy if exists class_sections_admin_all on public.class_sections;
create policy class_sections_admin_all on public.class_sections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- subject_teachers ----------------------------------------------------
drop policy if exists subject_teachers_select_staff on public.subject_teachers;
create policy subject_teachers_select_staff on public.subject_teachers
  for select to authenticated
  using (public.is_staff());

drop policy if exists subject_teachers_admin_all on public.subject_teachers;
create policy subject_teachers_admin_all on public.subject_teachers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- students ------------------------------------------------------------
drop policy if exists students_select_staff on public.students;
create policy students_select_staff on public.students
  for select to authenticated
  using (public.is_staff());

drop policy if exists students_select_parent on public.students;
create policy students_select_parent on public.students
  for select to authenticated
  using (
    exists (
      select 1 from public.parent_students ps
       where ps.student_id = students.id
         and ps.parent_id = auth.uid()
    )
  );

drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- parent_students -----------------------------------------------------
drop policy if exists parent_students_select_self on public.parent_students;
create policy parent_students_select_self on public.parent_students
  for select to authenticated
  using (parent_id = auth.uid());

drop policy if exists parent_students_select_staff on public.parent_students;
create policy parent_students_select_staff on public.parent_students
  for select to authenticated
  using (public.is_staff());

drop policy if exists parent_students_admin_all on public.parent_students;
create policy parent_students_admin_all on public.parent_students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attendance_records --------------------------------------------------
drop policy if exists attendance_select_staff on public.attendance_records;
create policy attendance_select_staff on public.attendance_records
  for select to authenticated
  using (public.is_staff());

drop policy if exists attendance_select_parent on public.attendance_records;
create policy attendance_select_parent on public.attendance_records
  for select to authenticated
  using (
    exists (
      select 1 from public.parent_students ps
       where ps.student_id = attendance_records.student_id
         and ps.parent_id = auth.uid()
    )
  );

drop policy if exists attendance_insert_staff on public.attendance_records;
create policy attendance_insert_staff on public.attendance_records
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists attendance_update_staff on public.attendance_records;
create policy attendance_update_staff on public.attendance_records
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists attendance_delete_admin on public.attendance_records;
create policy attendance_delete_admin on public.attendance_records
  for delete to authenticated
  using (public.is_admin());

-- teacher_notes -------------------------------------------------------
drop policy if exists teacher_notes_select_staff on public.teacher_notes;
create policy teacher_notes_select_staff on public.teacher_notes
  for select to authenticated
  using (public.is_staff());

drop policy if exists teacher_notes_select_parent on public.teacher_notes;
create policy teacher_notes_select_parent on public.teacher_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.parent_students ps
       where ps.student_id = teacher_notes.student_id
         and ps.parent_id = auth.uid()
    )
  );

drop policy if exists teacher_notes_insert_staff on public.teacher_notes;
create policy teacher_notes_insert_staff on public.teacher_notes
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists teacher_notes_update_own on public.teacher_notes;
create policy teacher_notes_update_own on public.teacher_notes
  for update to authenticated
  using (teacher_id = auth.uid() and public.current_role() = 'teacher')
  with check (teacher_id = auth.uid() and public.current_role() = 'teacher');

drop policy if exists teacher_notes_delete_admin on public.teacher_notes;
create policy teacher_notes_delete_admin on public.teacher_notes
  for delete to authenticated
  using (public.is_admin());

-- audit_logs ----------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_insert_auth on public.audit_logs;
create policy audit_logs_insert_auth on public.audit_logs
  for insert to authenticated
  with check (auth.role() = 'authenticated');

-- notifications -------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_select_admin on public.notifications;
create policy notifications_select_admin on public.notifications
  for select to authenticated
  using (public.is_admin());

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin on public.notifications
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists notifications_delete_admin on public.notifications;
create policy notifications_delete_admin on public.notifications
  for delete to authenticated
  using (public.is_admin());

-- school_events -------------------------------------------------------
drop policy if exists school_events_select_auth on public.school_events;
create policy school_events_select_auth on public.school_events
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists school_events_insert_staff on public.school_events;
create policy school_events_insert_staff on public.school_events
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists school_events_update_staff on public.school_events;
create policy school_events_update_staff on public.school_events
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists school_events_delete_admin on public.school_events;
create policy school_events_delete_admin on public.school_events
  for delete to authenticated
  using (public.is_admin());

-- ai_models -----------------------------------------------------------
drop policy if exists ai_models_admin_all on public.ai_models;
create policy ai_models_admin_all on public.ai_models
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
