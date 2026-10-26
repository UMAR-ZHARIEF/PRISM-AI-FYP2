-- =====================================================================
-- PRISM-AI - 0014_policy_privacy_v1_1_0.sql
-- One new policy_documents row: privacy version 1.1.0, effective
-- 2026-10-26, the DB registry entry behind the privacy-policy reword
-- (FX-7) and the version bump in PRISM-ai--web/src/legal/version.js.
--
-- WHY (defect): the re-consent machinery and the login acceptance
-- recorder both need this row. current_policy_version('privacy')
-- returns the latest effective version from policy_documents, and
-- policyAcceptance.js resolveDocumentId() looks the row up by
-- (kind, version) with supabase-js .single(). With no row for
-- (privacy, 1.1.0) that lookup returned zero rows and PostgREST
-- answered HTTP 406 (PGRST116): every sign-in logged a 406, privacy
-- acceptance recording fail-closed, and the LegalGate re-consent
-- modal could never be satisfied.
--
-- DIVERGENCE HISTORY: the row was deployed to the live Supabase
-- project (noyafradgbejnufoxdoy) out-of-band via MCP on 2026-10-26 to
-- fix that 406 (see .pi/work-reports/w1-policy-deploy.md). That fixed
-- the live project but left the migration files behind: a fresh
-- install from migrations alone (0001..0013) would lack the row and
-- re-introduce the 406. This migration codifies the inserted row, so
-- the files and the live database agree again and fresh installs are
-- correct (same out-of-band-patch pattern as 0009).
--
-- SHAPE: mirrors the 1.0.0 privacy seed in 0003 exactly - same kind,
-- title and summary text, metadata only (the document text lives in
-- PRISM-ai--web/src/legal/privacy.*.md bundled with the frontend) -
-- with effective_at set to the date the reworded policy took effect.
--
-- Idempotent: the unique (kind, version) constraint declared in 0003
-- (and untouched since) is the conflict target, so ON CONFLICT
-- DO NOTHING makes re-running this file safe. The live DB already has
-- the row, so re-running against it is a no-op.
-- =====================================================================

insert into public.policy_documents (kind, version, title, summary, effective_at)
values
  ('privacy', '1.1.0', 'PRISM-AI Privacy Policy',
   'How PRISM-AI collects, uses, stores, and protects personal data under Malaysian PDPA 2010 + Amendment 2024.',
   '2026-10-26T00:00:00Z')
on conflict (kind, version) do nothing;
