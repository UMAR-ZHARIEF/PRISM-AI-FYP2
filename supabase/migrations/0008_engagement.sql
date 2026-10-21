-- =====================================================================
-- PRISM-AI - 0008_engagement.sql
-- Engagement tracking schema for the classroom emotion engine.
--
-- The camera pipeline classifies each detected frame into an emotion
-- (Happy/Sad/Angry/Fear/Disgust/Neutral) and an engagement state
-- (attentive/disengaged/no_face). This migration gives those signals a
-- home and turns them into one per-student-per-day risk flag:
--
--   (a) engagement_records - one raw row per classified frame batch.
--   (b) engagement_summaries - one rollup row per student per day,
--       with the share of attentive/disengaged/no_face frames and the
--       day's dominant emotion.
--   (c) RLS policies. Reads mirror the 0006 teacher scoping: admins see
--       everything, teachers only students in teacher_class_ids().
--       Writes are staff-only (is_staff(), admin-or-teacher since 0006).
--       DELIBERATE: no parent policies - parents never see engagement
--       data (same stance 0007 took for teacher notes).
--   (d) app_settings gains three emotion-engine knobs: emotion_enabled,
--       emotion_interval_seconds and engagement_at_risk_threshold.
--   (e) aggregate_engagement(student_id, date) - counts the day's raw
--       records, computes the state shares, upserts the summary row and
--       flags at_risk when the disengaged + no_face share exceeds the
--       configured threshold.
--
-- Scale note for (b)/(e): the *_pct columns hold fractions on a 0-1
-- scale (0.42 means 42%), matching the engagement_at_risk_threshold
-- default of 0.60, so the at-risk comparison reads exactly like the
-- spec: disengaged_pct + no_face_pct > threshold.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS before every CREATE
-- POLICY / CREATE OR REPLACE FUNCTION.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) engagement_records: raw per-frame-batch classifications.
-- emotion keeps the model label even on no_face rows so the day's
-- dominant emotion stays computable; confidence is the model's own
-- score (0-1) when it reports one. classroom_id is the camera's section
-- tag, free text because cameras may be moved between sections.
-- ---------------------------------------------------------------------
create table if not exists public.engagement_records (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  date             date not null,
  detected_at      timestamptz not null default now(),
  emotion          text not null check (emotion in ('Happy','Sad','Angry','Fear','Disgust','Neutral')),
  engagement_state text not null check (engagement_state in ('attentive','disengaged','no_face')),
  confidence       real,
  classroom_id     text
);

create index if not exists idx_engagement_student_date
  on public.engagement_records(student_id, date);
create index if not exists idx_engagement_date
  on public.engagement_records(date);

-- ---------------------------------------------------------------------
-- (b) engagement_summaries: the per-student per-day rollup. Shares are
-- 0-1 fractions (see header). unique(student_id, date) backs the
-- upsert in aggregate_engagement below.
-- ---------------------------------------------------------------------
create table if not exists public.engagement_summaries (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  date             date not null,
  attentive_pct    real default 0,
  disengaged_pct   real default 0,
  no_face_pct      real default 0,
  dominant_emotion text,
  at_risk          boolean default false,
  updated_at       timestamptz default now(),
  unique(student_id, date)
);

alter table public.engagement_records enable row level security;
alter table public.engagement_summaries enable row level security;

-- ---------------------------------------------------------------------
-- (c) RLS policies. Read scoping mirrors attendance_select_staff from
-- 0006 exactly: admin sees all rows, a teacher only rows whose student
-- sits in one of their class sections (teacher_class_ids(), SECURITY
-- DEFINER in 0006, so no RLS recursion here either).
-- ---------------------------------------------------------------------

-- engagement_records reads: admin all / teacher own classes
drop policy if exists engagement_records_select_staff on public.engagement_records;
create policy engagement_records_select_staff on public.engagement_records
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and student_id in (
        select s.id from public.students s
         where s.class_section_id in (select public.teacher_class_ids(auth.uid()))
      )
    )
  );

-- engagement_records writes: staff only (is_staff() = admin or teacher
-- since 0006). No class scoping on insert: the pipeline lands batches
-- through the server's service-role key (bypasses RLS anyway) and staff
-- corrections are trusted house-wide, same as notifications_insert_staff
-- and audit_logs_insert_auth.
drop policy if exists engagement_records_insert_staff on public.engagement_records;
create policy engagement_records_insert_staff on public.engagement_records
  for insert to authenticated
  with check (public.is_staff());

-- engagement_summaries reads: same teacher scoping as the raw records.
drop policy if exists engagement_summaries_select_staff on public.engagement_summaries;
create policy engagement_summaries_select_staff on public.engagement_summaries
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and student_id in (
        select s.id from public.students s
         where s.class_section_id in (select public.teacher_class_ids(auth.uid()))
      )
    )
  );

-- engagement_summaries writes: staff only. Split insert/update policies
-- follow the attendance_insert_staff / attendance_update_staff naming
-- shape; INSERT takes WITH CHECK, UPDATE takes USING + WITH CHECK so a
-- staff member cannot retarget a summary to another student.
drop policy if exists engagement_summaries_insert_staff on public.engagement_summaries;
create policy engagement_summaries_insert_staff on public.engagement_summaries
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists engagement_summaries_update_staff on public.engagement_summaries;
create policy engagement_summaries_update_staff on public.engagement_summaries
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- DELIBERATE: no parent policies on either table. Parents do not see
-- engagement data (matching the 0007 teacher-notes decision).

-- ---------------------------------------------------------------------
-- (d) app_settings: three emotion-engine knobs. Nullable by design
-- (no NOT NULL), so aggregate_engagement can COALESCE a missing
-- threshold back to 0.60. Existing rows (id=1) report the defaults
-- automatically: PostgreSQL 11+ fills added columns from their default
-- on read, no rewrite, no re-seed needed.
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column if not exists emotion_enabled boolean default true,
  add column if not exists emotion_interval_seconds int default 2,
  add column if not exists engagement_at_risk_threshold real default 0.60;

-- ---------------------------------------------------------------------
-- (e) aggregate_engagement(student_id, date): roll the day's raw
-- records into one summary row and flag at_risk.
--
--   - counts attentive / disengaged / no_face records for the pair;
--   - no records for the day -> returns without touching any existing
--     summary (re-runs never clobber a real day with an empty one);
--   - shares are fractions of the day's total (0-1, see header);
--   - dominant_emotion = the most frequent emotion label of the day
--     (ties broken alphabetically so re-runs are deterministic);
--   - at_risk = disengaged_pct + no_face_pct > threshold, with the
--     threshold COALESCEd from app_settings.engagement_at_risk_threshold
--     down to the 0.60 default when the row or column value is missing.
--
-- SECURITY INVOKER on purpose (default, no clause): RLS keeps applying
-- to the caller. The server invokes it with the service role (RLS
-- bypassed), while a staff caller only ever rolls up rows their own
-- select scope can see, and still passes the staff-only write policies
-- above.
-- ---------------------------------------------------------------------
create or replace function public.aggregate_engagement(p_student_id uuid, p_date date)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_total     int;
  v_attentive int;
  v_disengaged int;
  v_no_face   int;
  v_dominant  text;
  v_threshold real;
begin
  select count(*),
         count(*) filter (where engagement_state = 'attentive'),
         count(*) filter (where engagement_state = 'disengaged'),
         count(*) filter (where engagement_state = 'no_face')
    into v_total, v_attentive, v_disengaged, v_no_face
    from public.engagement_records
   where student_id = p_student_id
     and date = p_date;

  -- Nothing recorded for this day: leave any existing summary as-is.
  if v_total = 0 then
    return;
  end if;

  select emotion
    into v_dominant
    from public.engagement_records
   where student_id = p_student_id
     and date = p_date
   group by emotion
   order by count(*) desc, emotion asc
   limit 1;

  select coalesce((
    select engagement_at_risk_threshold
      from public.app_settings
     where id = 1
  ), 0.60)
    into v_threshold;

  insert into public.engagement_summaries (
    student_id, date,
    attentive_pct, disengaged_pct, no_face_pct,
    dominant_emotion, at_risk, updated_at
  )
  values (
    p_student_id, p_date,
    round(v_attentive::numeric  / v_total, 4),
    round(v_disengaged::numeric / v_total, 4),
    round(v_no_face::numeric    / v_total, 4),
    v_dominant,
    (v_disengaged + v_no_face)::real / v_total > v_threshold,
    now()
  )
  on conflict (student_id, date) do update
    set attentive_pct     = excluded.attentive_pct,
        disengaged_pct    = excluded.disengaged_pct,
        no_face_pct       = excluded.no_face_pct,
        dominant_emotion  = excluded.dominant_emotion,
        at_risk           = excluded.at_risk,
        updated_at        = now();
end;
$$;
