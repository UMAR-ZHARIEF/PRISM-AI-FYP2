-- =====================================================================
-- PRISM-AI Consent & Policy infrastructure
-- Implements: PDPA s.7 (Notice & Choice), s.40 (explicit consent for
-- sensitive personal data including biometric data added by Act A1727),
-- s.38 (right of withdrawal).
-- See docs/legal/ for the full legal research base.
-- =====================================================================

-- ---------------------------------------------------------------------
-- policy_documents: registry of legal-document versions
-- The actual document text lives in PRISM-AI--web/src/legal/*.md
-- (bundled with the frontend). This table tracks which version is
-- current so we can audit who accepted which version.
-- ---------------------------------------------------------------------
create table if not exists public.policy_documents (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('terms', 'privacy', 'biometric', 'staff')),
  version      text not null,
  effective_at timestamptz not null default now(),
  title        text not null,
  summary      text,
  created_at   timestamptz not null default now(),
  unique (kind, version)
);

create index if not exists idx_policy_documents_kind_effective
  on public.policy_documents (kind, effective_at desc);

-- ---------------------------------------------------------------------
-- policy_acceptances: who accepted which policy_document and when
-- One row per (user, document) acceptance. IP and user_agent stored
-- for audit / dispute resolution (PDPA s.7 / ECA 2006 s.7).
-- ---------------------------------------------------------------------
create table if not exists public.policy_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.policy_documents(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  ip_address  inet,
  user_agent  text
);

create index if not exists idx_policy_acceptances_user
  on public.policy_acceptances (user_id, accepted_at desc);

create index if not exists idx_policy_acceptances_document
  on public.policy_acceptances (document_id);

-- ---------------------------------------------------------------------
-- biometric_consents: per-student parental consent for face data
-- Required by PDPA s.40 (explicit consent for sensitive personal data).
-- Granted=false rows are also kept (parent opted out) so the system
-- knows to permanently disable face enrollment for that student.
-- ---------------------------------------------------------------------
create table if not exists public.biometric_consents (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  guardian_user_id uuid references auth.users(id) on delete set null,
  granted          boolean not null,
  granted_at       timestamptz default now(),
  revoked_at       timestamptz,
  method           text not null default 'in_app'
                     check (method in ('in_app', 'paper_upload', 'admin_recorded')),
  document_url     text,
  policy_version   text not null,
  ip_address       inet,
  user_agent       text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_biometric_consents_student
  on public.biometric_consents (student_id, created_at desc);

create index if not exists idx_biometric_consents_active
  on public.biometric_consents (student_id)
  where granted = true and revoked_at is null;

drop trigger if exists trg_biometric_consents_updated_at on public.biometric_consents;
create trigger trg_biometric_consents_updated_at
  before update on public.biometric_consents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

-- current_policy_version(kind): the latest version row for a kind
create or replace function public.current_policy_version(p_kind text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select version from public.policy_documents
  where kind = p_kind
    and effective_at <= now()
  order by effective_at desc
  limit 1;
$$;

-- has_accepted_current_policies(user_id): has this user accepted the
-- currently-effective terms AND privacy documents?
create or replace function public.has_accepted_current_policies(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
        from public.policy_acceptances pa
        join public.policy_documents pd on pd.id = pa.document_id
       where pa.user_id = p_user
         and pd.kind = 'terms'
         and pd.version = public.current_policy_version('terms')
    )
    and
    exists (
      select 1
        from public.policy_acceptances pa
        join public.policy_documents pd on pd.id = pa.document_id
       where pa.user_id = p_user
         and pd.kind = 'privacy'
         and pd.version = public.current_policy_version('privacy')
    );
$$;

-- has_biometric_consent(student_id): is there an active grant?
create or replace function public.has_biometric_consent(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.biometric_consents
    where student_id = p_student
      and granted = true
      and revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.policy_documents    enable row level security;
alter table public.policy_acceptances  enable row level security;
alter table public.biometric_consents  enable row level security;

-- policy_documents: anyone authenticated can read; only admin can write
drop policy if exists policy_documents_select_auth on public.policy_documents;
create policy policy_documents_select_auth on public.policy_documents
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists policy_documents_admin_all on public.policy_documents;
create policy policy_documents_admin_all on public.policy_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- policy_acceptances: user reads/inserts own; admin reads all
drop policy if exists policy_acceptances_select_self on public.policy_acceptances;
create policy policy_acceptances_select_self on public.policy_acceptances
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists policy_acceptances_insert_self on public.policy_acceptances;
create policy policy_acceptances_insert_self on public.policy_acceptances
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists policy_acceptances_select_admin on public.policy_acceptances;
create policy policy_acceptances_select_admin on public.policy_acceptances
  for select to authenticated
  using (public.is_admin());

-- biometric_consents: parents manage own children's consents;
-- staff can read all; admin full access
drop policy if exists biometric_consents_select_parent on public.biometric_consents;
create policy biometric_consents_select_parent on public.biometric_consents
  for select to authenticated
  using (
    exists (
      select 1 from public.parent_students ps
       where ps.student_id = biometric_consents.student_id
         and ps.parent_id = auth.uid()
    )
  );

drop policy if exists biometric_consents_insert_parent on public.biometric_consents;
create policy biometric_consents_insert_parent on public.biometric_consents
  for insert to authenticated
  with check (
    guardian_user_id = auth.uid()
    and exists (
      select 1 from public.parent_students ps
       where ps.student_id = biometric_consents.student_id
         and ps.parent_id = auth.uid()
    )
  );

drop policy if exists biometric_consents_update_parent on public.biometric_consents;
create policy biometric_consents_update_parent on public.biometric_consents
  for update to authenticated
  using (
    guardian_user_id = auth.uid()
    and exists (
      select 1 from public.parent_students ps
       where ps.student_id = biometric_consents.student_id
         and ps.parent_id = auth.uid()
    )
  )
  with check (guardian_user_id = auth.uid());

drop policy if exists biometric_consents_select_staff on public.biometric_consents;
create policy biometric_consents_select_staff on public.biometric_consents
  for select to authenticated
  using (public.is_staff());

drop policy if exists biometric_consents_admin_all on public.biometric_consents;
create policy biometric_consents_admin_all on public.biometric_consents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Seed initial policy_document versions
-- These rows establish version '1.0.0' for each policy kind, which
-- the frontend constants in src/legal/version.js must match.
-- ---------------------------------------------------------------------
insert into public.policy_documents (kind, version, title, summary)
values
  ('terms',     '1.0.0', 'PRISM-AI Terms of Service',
   'Rules for using the PRISM-AI school attendance system.'),
  ('privacy',   '1.0.0', 'PRISM-AI Privacy Policy',
   'How PRISM-AI collects, uses, stores, and protects personal data under Malaysian PDPA 2010 + Amendment 2024.'),
  ('biometric', '1.0.0', 'Biometric Data Consent Notice',
   'Parental consent for processing a child''s face data for automated attendance.'),
  ('staff',     '1.0.0', 'Staff Data Handling Notice',
   'Duties of teachers and admin staff when handling pupil personal data.')
on conflict (kind, version) do nothing;
