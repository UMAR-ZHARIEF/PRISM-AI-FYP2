import { supabase } from './supabase';
import { POLICY_VERSIONS } from '../legal/version';

// Cache of (kind, version) -> document_id so we don't re-query for the same doc.
const docIdCache = new Map();

async function resolveDocumentId(kind, version) {
  const cacheKey = `${kind}:${version}`;
  if (docIdCache.has(cacheKey)) return docIdCache.get(cacheKey);

  const { data, error } = await supabase
    .from('policy_documents')
    .select('id')
    .eq('kind', kind)
    .eq('version', version)
    .single();

  if (error || !data) return null;
  docIdCache.set(cacheKey, data.id);
  return data.id;
}

// Record that the current authenticated user accepted a policy document.
export async function recordPolicyAcceptance(kind) {
  const version = POLICY_VERSIONS[kind];
  if (!version) {
    console.warn(`[policyAcceptance] Unknown kind: ${kind}`);
    return { error: new Error('Unknown policy kind') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('Not authenticated') };

  const documentId = await resolveDocumentId(kind, version);
  if (!documentId) {
    return {
      error: new Error(
        `Policy registry is not initialised. The administrator needs to apply ` +
        `supabase/migrations/0003_consent_and_policies.sql. ` +
        `(Missing: ${kind} v${version})`,
      ),
    };
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  const { error } = await supabase.from('policy_acceptances').insert({
    user_id: user.id,
    document_id: documentId,
    user_agent: userAgent,
  });

  return { error };
}

// Record acceptance of both terms AND privacy (typical click-wrap flow).
export async function recordTermsAndPrivacyAcceptance() {
  const r1 = await recordPolicyAcceptance('terms');
  const r2 = await recordPolicyAcceptance('privacy');
  return { error: r1.error || r2.error || null };
}

// Returns true if the current authenticated user has accepted the latest
// version of BOTH terms and privacy. Uses the SQL helper function
// has_accepted_current_policies() defined in migration 0003.
//
// Returns `null` when the underlying schema isn't reachable (e.g., migration
// not yet applied). LegalGate treats null as "unknown — don't block."
// We only return `false` when the database explicitly says the user has
// NOT accepted — that is the only case where we should block them.
export async function hasAcceptedCurrentPolicies() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('has_accepted_current_policies', {
    p_user: user.id,
  });

  if (error) {
    console.warn(
      '[policyAcceptance] hasAcceptedCurrentPolicies failed — fail-soft (treating as unknown). ' +
      'Most likely cause: supabase/migrations/0003_consent_and_policies.sql has not been applied. ' +
      'Error:', error.message,
    );
    return null;
  }
  return !!data;
}
