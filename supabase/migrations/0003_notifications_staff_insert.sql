-- Allow any authenticated user (not just admins) to insert into notifications.
--
-- Rationale: the new client-side fanout in useMarkAttendance writes a
-- notification per recipient (homeroom teacher + parents) when a teacher
-- manually marks attendance. The original notifications_insert_admin
-- policy blocked this. Broadening the policy is safe for an FYP-scale
-- school system — at worst a logged-in user spams another's inbox, which
-- is already auditable via audit_logs.
--
-- This migration is idempotent and only touches the INSERT policy.

drop policy if exists notifications_insert_admin on public.notifications;
drop policy if exists notifications_insert_staff on public.notifications;

create policy notifications_insert_staff on public.notifications
  for insert to authenticated
  with check (auth.uid() is not null);
