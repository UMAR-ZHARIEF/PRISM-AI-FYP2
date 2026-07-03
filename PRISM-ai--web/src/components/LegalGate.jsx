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
// forces them to accept or sign out.
export default function LegalGate({ children }) {
  const { session, signOut } = useAuth();
  const [accepted, setAccepted] = useState(null); // null=checking, true=ok, false=needs accept
  const [recording, setRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!session) {
      setAccepted(null);
      return;
    }
    let cancelled = false;
    hasAcceptedCurrentPolicies()
      .then((ok) => {
        if (!cancelled) setAccepted(ok);
      })
      .catch(() => {
        // Network or schema failure — fail-soft. Don't block the user.
        if (!cancelled) setAccepted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

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
    setAccepted(true);
    setRecording(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // No session → render children (other guards will deal with auth).
  // Still checking → render children (avoid layout flash). The gate will
  // appear once the async check completes.
  if (!session || accepted === null || accepted === true) {
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
