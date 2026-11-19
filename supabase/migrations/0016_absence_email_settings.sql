-- =====================================================================
-- PRISM-AI - 0016_absence_email_settings.sql
-- Three new app_settings columns for the daily parent-absence email
-- digest (server/email-digest.js + the in-process scheduler in
-- server/server.js):
--   absence_email_enabled   boolean default true  — the admin toggle;
--     when false the 60s scheduler tick never fires the digest.
--   absence_email_cutoff    text    default '09:30' — local HH:MM
--     cutoff; once local time passes it on a day, that day's digest
--     runs once. Text (not `time` like late_cutoff) because the server
--     only parses 'HH:MM' and the Admin Panel edits it as plain text.
--   absence_email_last_sent date    nullable — the idempotence marker:
--     the last local school day a digest completed (a no-absence day
--     also counts as sent). The scheduler and POST /api/digest/run
--     compare it to today's local date so a day is never emailed
--     twice, even across server restarts. NULL means "never sent".
--
-- WHY: the digest must be configurable (on/off, cutoff) and exactly
-- once per local day. The single app_settings row (id=1) is already
-- the home of every server knob (0005), read through the 60s-cached
-- getAppSettings(), so new settings there are live-editable from the
-- Admin Panel without a restart — same precedent as autorestart_ai
-- (0010).
--
-- Nullable by design (no NOT NULL) for last_sent, matching the 0008
-- knob pattern: existing rows report the defaults automatically on
-- read (PostgreSQL 11+ fills added columns from their default, no
-- rewrite, no re-seed needed). No RLS change: the 0005 policies
-- already give staff read access and admins alone the update that
-- flipping these settings needs. The digest itself runs server-side
-- with the service-role key and reads the row directly.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS (one statement, like 0010)
-- plus an INSERT-if-missing seed of the single row, so re-running
-- this file is safe against both fresh and already-migrated DBs.
-- =====================================================================

alter table public.app_settings
  add column if not exists absence_email_enabled  boolean default true,
  add column if not exists absence_email_cutoff   text    default '09:30',
  add column if not exists absence_email_last_sent date;

-- Guarantee the single settings row exists so the digest and the
-- Admin Panel always have a row to read/update (same seed as 0005).
insert into public.app_settings (id) values (1)
on conflict (id) do nothing;
