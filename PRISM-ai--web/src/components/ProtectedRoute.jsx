import './ProtectedRoute.css';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import LegalGate from './LegalGate';

// Brief pause before we yank the user to /login so the toast is actually
// readable. Two seconds matches the spec.
const EXPIRY_REDIRECT_DELAY_MS = 2000;

export default function ProtectedRoute({ children, requireRole }) {
  const {
    session,
    profile,
    loading,
    sessionExpired,
    sessionExpiringSoon,
    acknowledgeSessionExpired,
    acknowledgeSessionExpiringSoon,
  } = useAuth();
  const addToast = useToast();

  // Once we've decided to bounce the user out, flip this so the render
  // returns <Navigate />. We delay 2s after the toast appears.
  const [redirectAfterExpiry, setRedirectAfterExpiry] = useState(false);
  // Guard so we don't fire the same toast on every re-render while the flag
  // is still set in context.
  const expiredHandledRef = useRef(false);
  const expiringSoonHandledRef = useRef(false);

  // Reset the "already handled" guards if the user signs back in — otherwise
  // a future expiry in the same browser session would be silently swallowed.
  useEffect(() => {
    if (session) {
      expiredHandledRef.current = false;
      expiringSoonHandledRef.current = false;
      setRedirectAfterExpiry(false);
    }
  }, [session]);

  useEffect(() => {
    if (!sessionExpired || expiredHandledRef.current) return;
    expiredHandledRef.current = true;
    if (addToast) {
      addToast('Your session expired. Please sign in again.', 'warning', 4000);
    }
    const t = setTimeout(() => {
      setRedirectAfterExpiry(true);
      acknowledgeSessionExpired?.();
    }, EXPIRY_REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [sessionExpired, addToast, acknowledgeSessionExpired]);

  useEffect(() => {
    if (!sessionExpiringSoon || expiringSoonHandledRef.current) return;
    // Only show the heads-up if we still have a live session — if the token
    // has already lapsed the "expired" path will take over.
    if (!session) return;
    expiringSoonHandledRef.current = true;
    if (addToast) {
      addToast(
        'Your session will expire soon. Save your work.',
        'warning',
        5000,
      );
    }
    acknowledgeSessionExpiringSoon?.();
  }, [
    sessionExpiringSoon,
    session,
    addToast,
    acknowledgeSessionExpiringSoon,
  ]);

  if (loading) {
    return <div className="protected-route-loading">Loading…</div>;
  }

  // Session just expired — show a brief overlay before redirecting so the
  // user understands why they're being moved.
  if (!session && (sessionExpired || (expiredHandledRef.current && !redirectAfterExpiry))) {
    return (
      <div className="protected-route-loading" role="status" aria-live="polite">
        Your session expired. Redirecting to sign in…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!profile?.role || !allowed.includes(profile.role)) {
      return <Navigate to="/login" replace />;
    }
  }

  return <LegalGate>{children}</LegalGate>;
}
