-- =====================================================================
-- PRISM-AI - 0010_autorestart_setting.sql
-- One new app_settings column: autorestart_ai, the admin toggle behind
-- the server's crash auto-restart (server/server.js). When true, a
-- Python child that exits on its own (a crash) is started again after
-- 3 seconds; explicit stops and restarts never re-trigger it, GPU
-- refusals (exit code 3) are never retried, and an in-memory circuit
-- breaker in the server caps the loop at 5 auto-restarts per rolling
-- 10 minutes.
--
-- Default ON per user decision 2026-10-21: an unattended classroom
-- camera should recover from a transient crash without waiting for an
-- admin to notice, and the admin can still switch the behaviour off
-- through the settings row.
--
-- Nullable by design (no NOT NULL), matching the 0008 knobs: existing
-- rows (id=1) report the default automatically on read (PostgreSQL 11+
-- fills added columns from their default, no rewrite, no re-seed
-- needed). No RLS change: the 0005 policies already give staff read
-- access and admins alone the update that flipping this toggle needs.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, so re-running this file is safe.
-- =====================================================================

alter table public.app_settings
  add column if not exists autorestart_ai boolean default true;
