import './ProtectedRoute.css';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  // Once we've decided to bounce the user out, flip this so the render
  // returns <Navigate />. We delay 2s after the toast appears.
  const [redirectAfterExpiry, setRedirectAfterExpiry] = useState(false);
  // Guard so we don't fire the same toast on every re-render while the flag
  // is still set in context.
  const expiredHandledRef = useRef(false);
  const expiringSoonHandledRef = useRef(false);
  // Guard so the wrong-role toast fires once per denial instead of on every
  // re-render of the denied route.
  const roleDeniedRef = useRef(false);

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

  // Signed in but the route needs a different role: warn before the bounce
  // so the redirect to /login isn't silent.
  useEffect(() => {
    if (loading || !session || !requireRole) return;
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    const denied = !profile?.role || !allowed.includes(profile.role);
    if (!denied) {
      roleDeniedRef.current = false;
      return;
    }
    if (roleDeniedRef.current) return;
    roleDeniedRef.current = true;
    if (addToast) {
      addToast("You don't have access to that page.", 'error', 4000);
    }
  }, [session, profile, loading, requireRole, addToast]);

  if (loading) {
    return <div className="protected-route-loading">Loading…</div>;
  }

  // Session just expired — show a brief overlay before redirecting so the
  // user understands why they're being moved. The ref mirrors a decision
  // made in the expiry effect; reading it here avoids an extra state flip
  // (and re-render) during the short overlay window.
  // eslint-disable-next-line react-hooks/refs -- pre-existing overlay check
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
      // Hand Login the attempted location so a role that is allowed there
      // can be sent straight back after signing in.
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
  }

  return <LegalGate>{children}</LegalGate>;
}
