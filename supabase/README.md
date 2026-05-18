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
filename order**:

1. `0001_initial_schema.sql` - tables, enums, indexes, triggers, RLS.
2. `0002_notifications_scope.sql` - adds the Option B "bulletin board"
   `scope` column to `notifications`. A single row can now target one
   user (`scope = 'user'`, `recipient_id` set), all users with a given
   role (`scope = 'role:teacher'` etc., `recipient_id` null), or
   everyone (`scope = 'global'`, `recipient_id` null). Per-user read
   state (`read_at`) applies **only** to `scope = 'user'` rows -
   broadcasts are not "marked read" per recipient. Visibility is
   enforced by RLS, so clients can `select *` and trust the database to
   return only the rows the current user is allowed to see.

Both files are idempotent and safe to re-run.

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

That migration will be added as `0002_*.sql` (or as a Node script that
uses `@supabase/supabase-js` with the service role key) once auth flows
have been wired into the frontend.
