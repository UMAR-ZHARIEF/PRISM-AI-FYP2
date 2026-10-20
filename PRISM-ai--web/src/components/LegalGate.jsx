import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  hasAcceptedCurrentPolicies,
  recordTermsAndPrivacyAcceptance,
} from '../lib/policyAcceptance';
import './LegalGate.css';

// Wraps a tree that requires the user to have accepted the current
// Terms and Privacy Policy versions. If they haven't (e.g., they were
// already signed in when we shipped a new version), shows a modal that
// forces them to accept or sign out. If the acceptance check itself fails
// (RPC/network error), the gate fails closed: a retry card is shown and the
// guarded tree is never rendered unverified.
export default function LegalGate({ children }) {
  const { session, signOut } = useAuth();
  // Verification result, tagged with the user it belongs to. The tag lets
  // render discard a previous user's result on session switch without any
  // synchronous setState inside the effect (react-hooks/set-state-in-effect).
  // state: null=checking, true=ok, false=needs accept, 'error'=check failed
  const userId = session?.user?.id ?? null;
  const [result, setResult] = useState({ userId: null, state: null });
  const [retryTick, setRetryTick] = useState(0); // bumped by Retry to re-run the check
  const [recording, setRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    hasAcceptedCurrentPolicies()
      .then((ok) => {
        if (cancelled) return;
        // The lib resolves null (never throws) when the auth lookup or the
        // has_accepted_current_policies RPC fails — verification failed, not
        // "no acceptance recorded". Map it to 'error' so the gate fails
        // closed instead of silently passing the guarded tree through.
        setResult({ userId, state: ok === null ? 'error' : ok });
      })
      .catch(() => {
        // Unexpected rejection (e.g. the auth lookup blew up) — also fail closed.
        if (!cancelled) setResult({ userId, state: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, retryTick]);

  const handleRetryCheck = () => {
    setRetryTick((n) => n + 1);
  };

  const handleAccept = async () => {
    if (!agreed) {
      setErrorMessage('Please tick the box to confirm your acceptance.');
      return;
    }
    setRecording(true);
    setErrorMessage('');
    const { error } = await recordTermsAndPrivacyAcceptance();
    if (error) {
      setErrorMessage(error.message || 'Could not record acceptance. Please try again.');
      setRecording(false);
      return;
    }
    setResult({ userId, state: true });
    setRecording(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Verified result for the CURRENT user; null while checking, after a
  // session switch, or before the first check completes.
  const accepted = result.userId === userId ? result.state : null;

  // No session → render children (other guards will deal with auth).
  // Still checking → render children (avoid layout flash). The gate will
  // appear once the async check completes.
  // Check errored → fail closed: only the retry card, never the children.
  if (!session) return children;

  if (accepted === 'error') {
    return (
      <div className="legal-gate-overlay" role="alertdialog" aria-modal="true">
        <div className="legal-gate-modal">
          <span className="tape tl" />
          <span className="tape tr" />

          <div className="legal-gate-header">
            <AlertCircle size={28} />
            <h2>
              <span className="word k">Connection</span>{' '}
              <span className="word r">Problem</span>
            </h2>
          </div>

          <p className="legal-gate-lead">
            We couldn&rsquo;t verify your policy acceptance. Please check your
            connection and try again.
          </p>

          <div className="legal-gate-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRetryCheck}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (accepted === null || accepted === true) {
    return children;
  }

  return (
    <>
      {children}
      <div className="legal-gate-overlay" role="dialog" aria-modal="true">
        <div className="legal-gate-modal">
          <span className="tape tl" />
          <span className="tape tr" />

          <div className="legal-gate-header">
            <AlertCircle size={28} />
            <h2>
              <span className="word k">Policy</span>{' '}
              <span className="word r">Update</span>
            </h2>
          </div>

          <p className="legal-gate-lead">
            We&rsquo;ve updated our policies. Before you can continue using PRISM-AI,
            please review and accept the latest versions.
          </p>

          <ul className="legal-gate-links">
            <li>
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="pencil-link">
                Read Terms of Service <ExternalLink size={14} />
              </Link>
            </li>
            <li>
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="pencil-link">
                Read Privacy Policy <ExternalLink size={14} />
              </Link>
            </li>
          </ul>

          <label className="legal-gate-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I have read and agree to the updated <Link to="/terms" target="_blank">Terms of Service</Link>{' '}
              and <Link to="/privacy" target="_blank">Privacy Policy</Link>.
            </span>
          </label>

          {errorMessage && (
            <p className="legal-gate-error" role="alert">{errorMessage}</p>
          )}

          <div className="legal-gate-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={recording || !agreed}
            >
              {recording ? 'Saving…' : 'I Agree and Continue'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSignOut}
              disabled={recording}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
