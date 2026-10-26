// Current versions of each policy document.
// These MUST match the rows seeded in supabase/migrations/0003_consent_and_policies.sql.
// Bump the version here AND insert a new row into policy_documents whenever you
// change the corresponding markdown file in this directory.

export const POLICY_VERSIONS = {
  terms: '1.0.0',
  // privacy 1.1.0 (Route A reword) requires a matching policy_documents row
  // (kind='privacy', version='1.1.0') before use; otherwise acceptance
  // recording fail-closes. See .pi/work-reports/fix-fx7.md for the insert.
  privacy: '1.1.0',
  biometric: '1.0.0',
  staff: '1.0.0',
};

export const POLICY_KINDS = ['terms', 'privacy', 'biometric', 'staff'];
