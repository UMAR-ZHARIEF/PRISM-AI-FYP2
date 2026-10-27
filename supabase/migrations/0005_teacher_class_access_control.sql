-- =====================================================================
-- Migration 0005: Enforce strict teacher-to-class access control in RLS
-- 
-- Rules:
-- 1. Admins and school assistants have school-wide access to all classes.
-- 2. Teachers ONLY have access to the specific class sections assigned
--    to them (class_sections.homeroom_teacher_id = auth.uid()).
-- 3. Teachers cannot access, view, or mark attendance for any other class.
-- =====================================================================

-- 1. Helper: check if caller is an admin or school assistant
create or replace function public.is_admin_or_assistant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'assistant')
  );
$$;

-- 2. Security definer functions to prevent circular RLS recursion
create or replace function public.get_teacher_class_section_ids(t_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.class_sections where homeroom_teacher_id = t_id;
$$;

create or replace function public.get_teacher_student_ids(t_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.students
  where class_section_id in (select public.get_teacher_class_section_ids(t_id));
$$;

-- 3. Update class_sections policy
drop policy if exists class_sections_select_staff on public.class_sections;
create policy class_sections_select_staff on public.class_sections
  for select to authenticated
  using (
    public.is_admin_or_assistant()
    or id in (select public.get_teacher_class_section_ids(auth.uid()))
  );

-- 4. Update students policy
drop policy if exists students_select_staff on public.students;
create policy students_select_staff on public.students
  for select to authenticated
  using (
    public.is_admin_or_assistant()
    or id in (select public.get_teacher_student_ids(auth.uid()))
  );

-- 5. Update attendance_records policies
drop policy if exists attendance_select_staff on public.attendance_records;
create policy attendance_select_staff on public.attendance_records
  for select to authenticated
  using (
    public.is_admin_or_assistant()
    or student_id in (select public.get_teacher_student_ids(auth.uid()))
  );

drop policy if exists attendance_insert_staff on public.attendance_records;
create policy attendance_insert_staff on public.attendance_records
  for insert to authenticated
  with check (
    public.is_admin_or_assistant()
    or student_id in (select public.get_teacher_student_ids(auth.uid()))
  );

drop policy if exists attendance_update_staff on public.attendance_records;
create policy attendance_update_staff on public.attendance_records
  for update to authenticated
  using (
    public.is_admin_or_assistant()
    or student_id in (select public.get_teacher_student_ids(auth.uid()))
  )
  with check (
    public.is_admin_or_assistant()
    or student_id in (select public.get_teacher_student_ids(auth.uid()))
  );
