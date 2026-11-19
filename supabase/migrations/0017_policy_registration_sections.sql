-- =====================================================================
-- PRISM-AI - 0017_policy_registration_sections.sql
-- Two new policy_documents rows for the user-registration sections
-- added to the legal documents (privacy 1.2.0, terms 1.1.0, effective
-- 2026-11-19; plan: .pi/plans/user-registration-legal.md) and matching
-- the version bumps in PRISM-ai--web/src/legal/version.js.
--
-- WHY: current_policy_version(kind) returns the latest effective row
-- per kind from policy_documents, and policyAcceptance.js
-- resolveDocumentId() looks rows up by (kind, version). Without these
-- rows the LegalGate re-consent modal could never be satisfied for the
-- new versions and acceptance recording fail-closes (the same failure
-- mode migration 0014 fixed for privacy 1.1.0).
--
-- SHAPE: mirrors the 0003 seeds exactly - same kind, title and summary
-- text (neither mentions a version number, so copied verbatim),
-- metadata only (the document text lives in
-- PRISM-ai--web/src/legal/*.md bundled with the frontend) - with
-- effective_at set to the date the new sections took effect.
--
-- Idempotent: the unique (kind, version) constraint declared in 0003
-- is the conflict target, so ON CONFLICT DO NOTHING makes re-running
-- this file safe.
-- =====================================================================

insert into public.policy_documents (kind, version, title, summary, effective_at)
values
  ('privacy', '1.2.0', 'PRISM-AI Privacy Policy',
   'How PRISM-AI collects, uses, stores, and protects personal data under Malaysian PDPA 2010 + Amendment 2024.',
   '2026-11-19T00:00:00Z'),
  ('terms', '1.1.0', 'PRISM-AI Terms of Service',
   'Rules for using the PRISM-AI school attendance system.',
   '2026-11-19T00:00:00Z')
on conflict (kind, version) do nothing;
