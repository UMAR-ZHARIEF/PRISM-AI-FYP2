# PRISM-AI Supabase

This directory holds the SQL that turns the PRISM-AI primary school
management system from a mock-data prototype into a real Postgres-backed
application running on Supabase.

## What is in here

- `migrations/0001_initial_schema.sql` - Initial schema. Creates the
  `user_role` and `attendance_status` enums, all `public` tables
  (profiles, years, subjects, class_sections, subject_teachers,
  students, parent_students, attendance_records, teacher_notes,
  audit_logs, notifications, school_events, ai_models), indexes,
  triggers (auto-updated `updated_at`, auto-profile on signup),
  helper functions (`is_admin`, `is_staff`, `current_role`), and
  Row Level Security policies for every table.
- `seed.sql` - Reference data only: the 6 years, the 6 KSSR
  subjects, and the 30 class sections (5 classes per year) with their
  exact frontend colours. Safe to re-run; uses `on conflict` upserts.

## Migrations

Migrations live in `migrations/` and are intended to be applied **in
filename order** (two migrations share the `0003_` prefix; they are
independent of each other, so alphabetical order works):

1. `0001_initial_schema.sql` - tables, enums, indexes, triggers, RLS.
2. `0002_notifications_scope.sql` - adds the Option B "bulletin board"
   `scope` column to `notifications` (direct user, role, or global
   targeting) with matching RLS visibility rules.
3. `0003_consent_and_policies.sql` - PDPA consent and policy
   infrastructure: the `policy_documents`, `policy_acceptances`, and
   `biometric_consents` tables with their RLS policies.
4. `0003_notifications_staff_insert.sql` - lets any authenticated user
   insert into `notifications` (needed by the client-side attendance
   fanout); touches only the INSERT policy.
5. `0004_parent_read_homeroom_teacher.sql` - lets parents read the
   profile of their children's homeroom teacher (the Parent Portal
   contact card).
6. `0005_app_settings_and_checkout.sql` - adds
   `attendance_records.time_out` and the single-row `app_settings`
   table (school name, late cutoff, AI detection settings).
7. `0006_remove_assistant_teacher_scoping.sql` - removes the assistant
   role from every authorization path and scopes teacher read/write
   access to the classes they actually teach.
8. `0007_med_low_fixes.sql` - removes parent access to teacher notes,
   stops the admin inbox over-collecting notifications, and lets a
   note be edited by its author alone.
9. `0008_engagement.sql` - engagement tracking schema: raw
   frame-batch records, per-student per-day summaries, RLS, emotion
   knobs in `app_settings`, and the `aggregate_engagement` rollup
   function.
10. `0009_emotion_check_alignment.sql` - widens the
    `engagement_records.emotion` CHECK constraint to the ten emotion
    labels the deployed model actually emits.
11. `0010_autorestart_setting.sql` - adds the `autorestart_ai`
    `app_settings` toggle behind the server's crash auto-restart,
    default on.
12. `0011_risk_scores.sql` - `engagement_risk_scores`: rolling
    two-week per-student risk scores, bands, and trigger reasons
    computed server-side from the engagement history.

All twelve files are idempotent and safe to re-run.

## Applying to a hosted Supabase project

1. Open the Supabase dashboard for your project.
2. Go to **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Paste the entire contents of `migrations/0001_initial_schema.sql`
   into the editor and click **Run**. The script is idempotent;
   re-running it on an existing schema is safe.
5. Click **New query** again.
6. Paste the entire contents of `seed.sql` and click **Run**.
7. In **Table Editor**, confirm that `years` has 6 rows, `subjects`
   has 6 rows, and `class_sections` has 30 rows.

The dashboard steps above are not the only option: migrations can also
be applied through the Supabase MCP server, whose
`supabase_apply_migration` tool runs the SQL and records it in the
project's migration history.

After this you can sign up users through the normal Supabase Auth flow.
The `on_auth_user_created` trigger will automatically create a matching
row in `public.profiles`. If the new user's `raw_user_meta_data`
includes a `role` field (`admin`, `teacher`, `parent`, or `assistant`)
that role is used; otherwise the profile defaults to `parent`.

## Migration of students / teachers / attendance

The bulk import of the 90 mock students, 44 mock teachers, and any
attendance history is **intentionally deferred** to a later phase.
Those rows require real `auth.users` entries (so that RLS works and
teachers / parents can log in), and creating `auth.users` rows safely
needs the Supabase admin API or `service_role` key, which cannot be
exercised from a plain SQL migration.

Migrations are numbered sequentially (currently through
`0011_risk_scores.sql`), so the bulk import will land as the next
number in that sequence - a `0012_*.sql` file, or a Node script that
uses `@supabase/supabase-js` with the service role key - once auth
flows have been wired into the frontend.
