-- =====================================================================
-- PRISM-AI - Notifications: Option B "bulletin board" scope column
-- Adds a `scope` column so a single notification row can target either a
-- specific user (direct message), all users with a given role, or
-- everyone. Direct messages keep per-recipient `read_at` semantics;
-- broadcast rows (scope <> 'user') have a null recipient_id and no
-- per-user read state. RLS is updated so the visibility rules live in
-- the database instead of being duplicated in every client query.
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1. Add the scope column with a safe default so existing direct rows
--    keep their meaning ("user" = recipient_id is the addressee).
alter table public.notifications
  add column if not exists scope text not null default 'user';

-- 2. Whitelist the values scope is allowed to take.
alter table public.notifications
  drop constraint if exists notifications_scope_chk;
alter table public.notifications
  add constraint notifications_scope_chk check (
    scope in ('user', 'global', 'role:admin', 'role:teacher', 'role:parent', 'role:assistant')
  );

-- 3. Broadcast rows have no single recipient, so the column has to be
--    nullable. Existing rows are unaffected (default scope = 'user').
alter table public.notifications
  alter column recipient_id drop not null;

-- 4. Cross-column integrity: user-scope rows must have a recipient,
--    everything else must NOT have one.
alter table public.notifications
  drop constraint if exists notifications_scope_recipient_chk;
alter table public.notifications
  add constraint notifications_scope_recipient_chk check (
    (scope = 'user' and recipient_id is not null)
    or (scope <> 'user' and recipient_id is null)
  );

-- 5. Broadcasts are read by scope, not by recipient, so give that path
--    its own index.
create index if not exists idx_notifications_scope
  on public.notifications (scope);

-- 6. RLS SELECT: drop both the old and the new policy name (in case
--    this migration has been partially applied before), then re-create
--    a single policy covering direct + global + role-targeted rows.
--    Note: `read_at` on broadcast rows is unused under Option B - we
--    don't track per-user "seen" state for scope <> 'user'.
drop policy if exists "notifications_recipient_read" on public.notifications;
drop policy if exists "notifications_select_own"    on public.notifications;
drop policy if exists "notifications_select_for_me" on public.notifications;
create policy "notifications_select_for_me" on public.notifications
  for select to authenticated
  using (
    -- direct message addressed to me
    (scope = 'user' and recipient_id = auth.uid())
    -- or a global broadcast visible to every authenticated user
    or scope = 'global'
    -- or a role-targeted broadcast where the suffix matches my role
    or (scope like 'role:%' and substr(scope, 6) = (public.current_role())::text)
  );

-- 7. RLS UPDATE: only direct messages have per-user read state, so
--    broadcasts cannot be marked read by an individual user.
drop policy if exists "notifications_recipient_update" on public.notifications;
drop policy if exists "notifications_update_own"       on public.notifications;
create policy "notifications_recipient_update" on public.notifications
  for update to authenticated
  using (scope = 'user' and recipient_id = auth.uid())
  with check (scope = 'user' and recipient_id = auth.uid());

-- Admin insert / delete / read policies from 0001 are intentionally left
-- in place: notifications_select_admin, notifications_insert_admin,
-- notifications_delete_admin still apply unchanged.
