-- =====================================================================
-- PRISM-AI - 0006_remove_assistant_teacher_scoping.sql
-- Removes the assistant role from every authorization path and scopes
-- teacher access to the classes they actually teach.
--
-- Summary of changes (order matters):
--   (a) Delete the sole assistant account (rina@prismai.edu). The
--       profiles.id FK (on delete cascade, 0001) removes the profile
--       row and its parent_students / policy_acceptances links.
--   (b) is_staff() now means admin or teacher only; 'assistant' no
--       longer satisfies any staff check.
--   (c) New helper teacher_class_ids(uid): homeroom sections UNION all
--       class sections of the year groups the teacher teaches a
--       subject in (subject_teachers is per-year, not per-section).
--   (d) READ scoping: students_select_staff, class_sections_select_staff
--       and attendance_select_staff - admin sees all, a teacher only
--       rows belonging to teacher_class_ids(auth.uid()).
--   (e) WRITE scoping: attendance_insert_staff and
--       attendance_update_staff use the same teacher scoping.
--   (f) biometric_consents_update_parent: any parent linked to the
--       child via parent_students can update the consent row, not just
--       the originally recorded guardian_user_id.
--   (g) notifications_insert_staff tightened: was auth.uid() IS NOT
--       NULL (any user could write to any inbox), now public.is_staff().
--   (h) audit_logs_insert_auth tightened: was auth.role() =
--       'authenticated', now public.is_staff().
-- Idempotent: CREATE OR REPLACE for functions, DROP POLICY IF EXISTS
-- before every CREATE POLICY, DELETE is a no-op on re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) Remove the sole assistant account
-- One delete covers everything: profiles.id references auth.users(id)
-- on delete cascade (0001), so the profile, its parent_students links
-- and its policy_acceptances go with the auth user. No profiles-side
-- delete is needed (profiles has no email column to filter on).
-- ---------------------------------------------------------------------
delete from auth.users where email = 'rina@prismai.edu';

-- ---------------------------------------------------------------------
-- (b) is_staff(): admin or teacher only
-- The 'assistant' value stays in the user_role enum and in the 0002
-- notifications scope whitelist, but no authorization path accepts it
-- any more. Same SECURITY DEFINER shape as the 0001 original.
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('admin', 'teacher');
$$;

-- ---------------------------------------------------------------------
-- (c) teacher_class_ids(uid): the class sections a teacher may touch.
-- Homeroom assignments (class_sections.homeroom_teacher_id) UNION the
-- class sections of every year the teacher teaches a subject for.
-- subject_teachers carries (subject_id, teacher_id, year_num), so the
-- link to sections goes through class_sections.year_num.
-- SECURITY DEFINER is required: the function must bypass RLS on
-- class_sections, otherwise class_sections_select_staff below would
-- recurse infinitely.
-- ---------------------------------------------------------------------
create or replace function public.teacher_class_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cs.id
    from public.class_sections cs
   where cs.homeroom_teacher_id = uid
  union
  select cs.id
    from public.subject_teachers st
    join public.class_sections cs on cs.year_num = st.year_num
   where st.teacher_id = uid;
$$;

-- ---------------------------------------------------------------------
-- (d) READ policies: admin sees all, teacher sees own classes
-- ---------------------------------------------------------------------

-- students: teacher limited to students in their classes
drop policy if exists students_select_staff on public.students;
create policy students_select_staff on public.students
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and class_section_id in (select public.teacher_class_ids(auth.uid()))
    )
  );

-- class_sections: teacher limited to their own sections
drop policy if exists class_sections_select_staff on public.class_sections;
create policy class_sections_select_staff on public.class_sections
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and id in (select public.teacher_class_ids(auth.uid()))
    )
  );

-- attendance: teacher limited to records of students in their classes
drop policy if exists attendance_select_staff on public.attendance_records;
create policy attendance_select_staff on public.attendance_records
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

-- ---------------------------------------------------------------------
-- (e) WRITE policies on attendance_records: same scoping as reads.
-- INSERT policies take WITH CHECK (USING is not allowed for INSERT).
-- ---------------------------------------------------------------------

drop policy if exists attendance_insert_staff on public.attendance_records;
create policy attendance_insert_staff on public.attendance_records
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and student_id in (
        select s.id from public.students s
         where s.class_section_id in (select public.teacher_class_ids(auth.uid()))
      )
    )
  );

drop policy if exists attendance_update_staff on public.attendance_records;
create policy attendance_update_staff on public.attendance_records
  for update to authenticated
  using (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and student_id in (
        select s.id from public.students s
         where s.class_section_id in (select public.teacher_class_ids(auth.uid()))
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.current_role() = 'teacher'
      and student_id in (
        select s.id from public.students s
         where s.class_section_id in (select public.teacher_class_ids(auth.uid()))
      )
    )
  );

-- ---------------------------------------------------------------------
-- (f) Biometric consent revocation: any linked parent, not just the
-- recorded guardian. Rows are matched through parent_students, so any
-- parent linked to the child can update (revoke or re-grant) the
-- consent row. WITH CHECK keeps the same link so a parent cannot
-- retarget a row to a child that is not theirs.
-- ---------------------------------------------------------------------
drop policy if exists biometric_consents_update_parent on public.biometric_consents;
create policy biometric_consents_update_parent on public.biometric_consents
  for update to authenticated
  using (
    exists (
      select 1 from public.parent_students ps
       where ps.student_id = biometric_consents.student_id
         and ps.parent_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.parent_students ps
       where ps.student_id = biometric_consents.student_id
         and ps.parent_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- (g) Notifications insert: staff only. 0003_notifications_staff_insert
-- opened this to every authenticated user, letting any logged-in user
-- write into anyone's inbox. INSERT policies take WITH CHECK, matching
-- the 0001 notifications_insert_admin house pattern.
-- ---------------------------------------------------------------------
drop policy if exists notifications_insert_staff on public.notifications;
create policy notifications_insert_staff on public.notifications
  for insert to authenticated
  with check (public.is_staff());

-- ---------------------------------------------------------------------
-- (h) Audit log insert: staff only. Was writable by every authenticated
-- user (auth.role() = 'authenticated'). Policy name kept so existing
-- drop/re-create cycles stay aligned with 0001.
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_insert_auth on public.audit_logs;
create policy audit_logs_insert_auth on public.audit_logs
  for insert to authenticated
  with check (public.is_staff());
