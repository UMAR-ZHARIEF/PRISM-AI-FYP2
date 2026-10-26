-- =====================================================================
-- PRISM-AI - 0011_risk_scores.sql
-- engagement_risk_scores: one rolling two-week risk score per student
-- per day, computed server-side (updateRiskScore in server/server.js)
-- from the engagement_summaries history and read by the teacher
-- dashboard's risk panel (GET /api/engagement/risk and
-- GET /api/engagement/trends).
--
-- What each column means (the math lives in the server, in one place):
--   window_days        - lookback window in calendar days (14 = target
--                        date + the 13 days before it);
--   rolling_disengaged - mean disengaged_pct over the days WITH data in
--                        the window (0-1 fraction, the same scale the
--                        0008 engagement_summaries columns use);
--   recent_disengaged  - mean disengaged_pct of the last 3 available
--                        days in the window (0-1 fraction);
--   trend_slope        - least-squares slope of disengaged_pct against
--                        day index over the available days (fraction
--                        per day; positive = getting worse);
--   risk_score         - 0-100 int, null while there are fewer than 3
--                        days of history: round(min(100, max(0,
--                        level*100 + 25*trendFactor))) where
--                        level = 0.55*rolling + 0.35*recent and
--                        trendFactor = clamp(slope*10, -1, 1);
--   risk_band          - 'high' (score >= 60, aligning with the 0008
--                        same-day at-risk threshold of 0.60),
--                        'watch' (>= 35), else 'low';
--   trigger_reason     - the human-readable sentence behind the band,
--                        reused verbatim in teacher notifications;
--   computed_at        - when the server last rebuilt the row.
--
-- RLS: reads copy the 0008 engagement_summaries_select_staff pattern
-- exactly (admin sees all rows, a teacher only rows whose student sits
-- in one of their class sections via teacher_class_ids()); writes are
-- staff-only (is_staff(), INSERT WITH CHECK, UPDATE USING + WITH CHECK
-- so a row cannot be retargeted to another student). DELIBERATE: no
-- parent policies - parents never see engagement data (same stance
-- 0008 took for engagement_summaries, 0007 for teacher notes).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- DROP POLICY IF EXISTS before every CREATE POLICY.
-- =====================================================================

-- ---------------------------------------------------------------------
-- unique(student_id, date, window_days) backs the server's upsert: one
-- score per student per day per window size (the server only writes
-- window_days = 14 today, but the constraint keeps the door honest).
-- ---------------------------------------------------------------------
create table if not exists public.engagement_risk_scores (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete cascade,
  date               date not null,
  window_days        int not null default 14,
  rolling_disengaged real,
  recent_disengaged  real,
  trend_slope        real,
  risk_score         int,
  risk_band          text not null check (risk_band in ('low','watch','high')),
  trigger_reason     text,
  computed_at        timestamptz default now(),
  unique(student_id, date, window_days)
);

create index if not exists idx_engagement_risk_date
  on public.engagement_risk_scores(date);

alter table public.engagement_risk_scores enable row level security;

-- ---------------------------------------------------------------------
-- Reads: admin all / teacher own classes. Copied from the 0008
-- engagement_summaries_select_staff pattern: teacher_class_ids() is
-- SECURITY DEFINER (0006), so no RLS recursion here either.
-- ---------------------------------------------------------------------
drop policy if exists engagement_risk_scores_select_staff on public.engagement_risk_scores;
create policy engagement_risk_scores_select_staff on public.engagement_risk_scores
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

-- Writes: staff only, same shapes as the 0008 summary policies. The
-- pipeline lands rows through the server's service-role key (bypasses
-- RLS anyway); staff corrections stay trusted house-wide.
drop policy if exists engagement_risk_scores_insert_staff on public.engagement_risk_scores;
create policy engagement_risk_scores_insert_staff on public.engagement_risk_scores
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists engagement_risk_scores_update_staff on public.engagement_risk_scores;
create policy engagement_risk_scores_update_staff on public.engagement_risk_scores
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- DELIBERATE: no parent policies on this table. The score is derived
-- purely from engagement data, and parents do not see engagement data
-- (matching the 0008 engagement_summaries decision).
