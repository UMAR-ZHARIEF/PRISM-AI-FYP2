-- =====================================================================
-- PRISM-AI - 0015_notifications_insert_staff_alignment.sql
-- Codify the live notifications_insert_staff policy (with check
-- (is_staff())) so fresh installs match the hosted database.
--
-- WHY (defect R2 of the full-test round, ft-phase3-rls.md Finding 2):
-- the live Supabase project's notifications_insert_staff policy allows
-- inserts only for staff, but the last migration file that creates the
-- policy (0003_notifications_staff_insert.sql) allows ANY authenticated
-- user ("auth.uid() is not null"), parents included. The RLS suite's
-- assertion 12 (parent INSERT notifications scope='global' -> error)
-- passes against the live project only because the live policy was
-- tightened out-of-band; a fresh install built from the migration files
-- alone would let a parent post global broadcasts. The files and the
-- live database disagree, and the files are the looser of the two.
--
-- DIVERGENCE HISTORY: the tightening to is_staff() was applied to the
-- hosted project (noyafradgbejnufoxdoy) out-of-band, the same pattern
-- as the out-of-band patches codified by 0009 (emotion CHECK) and 0014
-- (privacy policy_documents row). No migration file recorded it, so
-- this migration codifies the live policy text verbatim. Live policy
-- captured before and after applying this file (supabase MCP
-- execute_sql, pg_policies): both read
--   with_check = is_staff()
-- byte-identical; see .pi/work-reports/fix-pkgB.md.
--
-- EFFECT ON THE LIVE PROJECT: none. The live policy already is
-- is_staff(); this file drops and recreates the same policy with the
-- same name, role and expression, so effective RLS semantics are
-- unchanged and re-running the suite stays green (13/13 REST + the
-- 28-policy pg_policies expectation). The drop-then-create window is
-- momentary and the policy is recreated identically.
--
-- IDENTITY, NOT TIGHTENING: the expression is written exactly as the
-- live policy deparses ("is_staff()", the helper defined in
-- 0001_initial_schema.sql as public.is_staff(): admin-or-teacher), not
-- restated or widened. Fresh installs from 0001..0015 therefore behave
-- exactly like the live project: staff-only notification inserts,
-- parents rejected with 42501 (suite assertions 10-13).
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE POLICY, mirroring
-- 0003_notifications_staff_insert.sql, so re-running this file is safe
-- on both fresh installs and the live project.
-- =====================================================================

drop policy if exists notifications_insert_staff on public.notifications;

create policy notifications_insert_staff on public.notifications
  for insert to authenticated
  with check (is_staff());
