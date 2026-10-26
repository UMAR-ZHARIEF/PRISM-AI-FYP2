-- =====================================================================
-- PRISM-AI - 0013_teacher_note_delete_own.sql
-- One new teacher_notes DELETE policy: teacher_notes_delete_own
-- (defect D8, server half).
--
-- Defect: the UI's note-delete call returned success (204) while RLS
-- silently deleted nothing. teacher_notes only had a delete path for
-- admins (teacher_notes_delete_admin), so a teacher deleting their own
-- note matched zero rows. Postgres raises no error for a DELETE that
-- RLS filters down to nothing: the statement succeeds with 0 affected
-- rows, the API reports success, and the note reappears on the next
-- load.
--
-- Fix: allow the note's author to delete it, via using (teacher_id =
-- auth.uid()). RLS policies are permissive (OR-combined), so admins
-- keep their existing teacher_notes_delete_admin path while authors
-- gain a path of their own. This mirrors the authorship rule of
-- teacher_notes_update_own (relaxed to authorship alone in 0007).
--
-- Idempotent: DROP POLICY IF EXISTS before the CREATE POLICY; the
-- drop alone is a no-op on re-run.
-- =====================================================================

drop policy if exists teacher_notes_delete_own on public.teacher_notes;
create policy teacher_notes_delete_own on public.teacher_notes
  for delete to authenticated
  using (teacher_id = auth.uid());
