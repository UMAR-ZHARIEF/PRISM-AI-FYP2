-- 0004_parent_read_homeroom_teacher.sql
-- Parents cannot read teacher profiles (profiles RLS = self / staff / admin
-- only), so the Parent Portal's Contact Teacher card had no way to show the
-- real homeroom teacher. Allow parents to SELECT exactly the profile rows of
-- homeroom teachers whose class section contains one of their own children.
-- This is what the PostgREST embed students -> class_sections -> profiles
-- needs; every other profile row stays invisible to parents.

drop policy if exists profiles_select_homeroom_for_parent on public.profiles;
create policy profiles_select_homeroom_for_parent on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
        from public.class_sections cs
        join public.students s on s.class_section_id = cs.id
        join public.parent_students ps on ps.student_id = s.id
       where cs.homeroom_teacher_id = profiles.id
         and ps.parent_id = auth.uid()
    )
  );
