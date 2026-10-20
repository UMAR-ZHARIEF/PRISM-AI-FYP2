-- =====================================================================
-- PRISM-AI - 0007_med_low_fixes.sql
-- Medium/low fixes: parent access to teacher notes, admin inbox
-- over-collection, and author-only note editing.
--
-- Summary of changes:
--   (a) Drop teacher_notes_select_parent (Option B, user-approved).
--       Parents no longer have any SELECT path to teacher_notes; the
--       remaining staff policy (teacher_notes_select_staff) uses
--       is_staff(), which since 0006 means admin-or-teacher only.
--       This is a deliberate design decision: teacher notes are
--       private staff observations, not parent-visible feedback.
--   (b) Drop notifications_select_admin. Admins previously matched the
--       is_admin() policy and saw everyone's direct notifications in
--       their inbox. They now fall back to notifications_select_for_me
--       (0002) like every other user: own direct messages, global
--       broadcasts, and role:admin broadcasts. The service-role fanout
--       in server/server.js is unaffected - the service key bypasses
--       RLS entirely.
--   (c) Recreate teacher_notes_update_own on authorship alone. The old
--       policy additionally required current_role() = 'teacher', so an
--       admin who wrote a note could not edit it. The new policy only
--       requires the author to match; the note must also still exist
--       in the same insert path (teacher_notes_insert_staff allows
--       admin-or-teacher since is_staff() was narrowed in 0006).
-- Idempotent: DROP POLICY IF EXISTS before every CREATE POLICY; the
-- drops alone are no-ops on re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) Parents can no longer read teacher notes
-- Deliberate design decision (Option B, chosen by the user): teacher
-- notes are private staff observations. Dropping the parent policy and
-- NOT recreating it removes the only parent SELECT path; staff access
-- continues via teacher_notes_select_staff (is_staff(): admin or
-- teacher). Idempotent by nature - the drop is a no-op on re-run.
-- ---------------------------------------------------------------------
drop policy if exists teacher_notes_select_parent on public.teacher_notes;

-- ---------------------------------------------------------------------
-- (b) Admin inbox shows only what is addressed to the admin
-- notifications_select_admin made every admin match every row, so the
-- admin inbox absorbed everyone's direct notifications. Without it,
-- admins read through notifications_select_for_me (0002) exactly like
-- other users: scope = 'user' with recipient_id = auth.uid(),
-- scope = 'global', or role broadcasts matching their role
-- (role:admin). Writes and deletes are unaffected: the fanout in
-- server/server.js uses the service-role key, which bypasses RLS.
-- ---------------------------------------------------------------------
drop policy if exists notifications_select_admin on public.notifications;

-- ---------------------------------------------------------------------
-- (c) Note authors can edit their own notes regardless of role
-- Old policy: teacher_id = auth.uid() AND current_role() = 'teacher'.
-- New policy: teacher_id = auth.uid() only, so an admin who wrote a
-- note can edit it too. Drop-if-exists keeps the migration idempotent.
-- ---------------------------------------------------------------------
drop policy if exists teacher_notes_update_own on public.teacher_notes;
create policy teacher_notes_update_own on public.teacher_notes
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());
