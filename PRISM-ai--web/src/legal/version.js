// Current versions of each policy document.
// These MUST match the rows seeded in supabase/migrations/0003_consent_and_policies.sql.
// Bump the version here AND insert a new row into policy_documents whenever you
// change the corresponding markdown file in this directory.

export const POLICY_VERSIONS = {
  // terms 1.1.0 (user-registration section) requires its policy_documents row
  // (kind='terms', version='1.1.0') to be effective; otherwise acceptance
  // recording fail-closes. Seeded by supabase/migrations/0017.
  terms: '1.1.0',
  // privacy 1.2.0 (user-registration section) requires its policy_documents
  // row (kind='privacy', version='1.2.0') to be effective; otherwise
  // acceptance recording fail-closes. Seeded by supabase/migrations/0017.
  // (Historical: privacy 1.1.0 (Route A reword) needed the same treatment;
  // see .pi/work-reports/fix-fx7.md and migration 0014.)
  privacy: '1.2.0',
  biometric: '1.0.0',
  staff: '1.0.0',
};

export const POLICY_KINDS = ['terms', 'privacy', 'biometric', 'staff'];
