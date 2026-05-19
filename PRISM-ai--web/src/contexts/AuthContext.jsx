import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Fire the "expiring soon" warning this many ms before the token actually
// expires. 5 minutes gives users a reasonable window to save work.
const EXPIRY_WARNING_LEAD_MS = 5 * 60 * 1000;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    // Profile row may not exist yet for a freshly-created auth user; don't crash the app.
    return null;
  }
  return data;
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);

  // Tracks whether the most recent session-clear came from an explicit
  // signOut() call. If true, we DON'T treat it as expiry — the user meant
  // to leave. Reset back to false once we've consumed it.
  const userSignedOutRef = useRef(false);
  // Holds the latest session in a ref so the warning timer's closure can
  // read it without forcing a re-subscription each render.
  const sessionRef = useRef(null);
  // Timer handle for the "expiring soon" warning so we can clear it on
  // refresh / sign-out.
  const expiryTimerRef = useRef(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  // Re-arm the warning timer whenever the session (and therefore expires_at)
  // changes. Auto-refresh produces a fresh session, so the timer naturally
  // gets pushed out — we never have to detect "the SDK refreshed" explicitly.
  const armExpiryWarning = useCallback(
    (nextSession) => {
      clearExpiryTimer();
      setSessionExpiringSoon(false);

      const expiresAt = nextSession?.expires_at; // unix seconds
      if (!expiresAt) return;

      const msUntilWarning =
        expiresAt * 1000 - Date.now() - EXPIRY_WARNING_LEAD_MS;
      if (msUntilWarning <= 0) {
        // Already inside the warning window; surface immediately.
        setSessionExpiringSoon(true);
        return;
      }
      expiryTimerRef.current = setTimeout(() => {
        // Re-check against the latest session before firing — if a refresh
        // happened between scheduling and firing, the new session's timer
        // will have replaced this one, but belt-and-braces.
        const current = sessionRef.current;
        if (current && current.expires_at === expiresAt) {
          setSessionExpiringSoon(true);
        }
      }, msUntilWarning);
    },
    [clearExpiryTimer],
  );

  useEffect(() => {
    let cancelled = false;

    // 1. Read any cached session on mount.
    (async () => {
      const { data } = await supabase.auth.getSession();
      const initialSession = data?.session ?? null;
      if (cancelled) return;
      sessionRef.current = initialSession;
      setSession(initialSession);
      armExpiryWarning(initialSession);

      if (initialSession?.user?.id) {
        const p = await fetchProfile(initialSession.user.id);
        if (cancelled) return;
        setProfile(p);
      }

      if (cancelled) return;
      setLoading(false);
    })();

    // 2. Listen for subsequent auth changes (sign-in / sign-out / token refresh).
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;

      const previousSession = sessionRef.current;
      sessionRef.current = newSession ?? null;
      setSession(newSession ?? null);
      armExpiryWarning(newSession ?? null);

      if (newSession?.user?.id) {
        // A fresh sign-in (or the silent refresh case) means we're authenticated
        // again — clear any stale "expired" flag from a previous session.
        setSessionExpired(false);
        userSignedOutRef.current = false;
        fetchProfile(newSession.user.id).then((p) => {
          if (!cancelled) setProfile(p);
        });
      } else {
        setProfile(null);
        // Distinguish "user logged out on purpose" from "the SDK lost the
        // session" (expired refresh token, revoked server-side, etc.).
        const involuntary =
          previousSession !== null && userSignedOutRef.current === false;
        if (involuntary) {
          setSessionExpired(true);
        }
        // Consume the flag — next involuntary drop should be flagged again.
        userSignedOutRef.current = false;
      }

      // TOKEN_REFRESHED fires silently; we don't surface anything to the user
      // beyond re-arming the warning timer (already done above).
      if (event === 'TOKEN_REFRESHED') {
        setSessionExpired(false);
      }
    });

    return () => {
      cancelled = true;
      clearExpiryTimer();
      listener?.subscription?.unsubscribe?.();
    };
  }, [armExpiryWarning, clearExpiryTimer]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    // Mark the upcoming session-clear as user-initiated so the auth listener
    // doesn't flag it as an expiry event.
    userSignedOutRef.current = true;
    setSessionExpired(false);
    setSessionExpiringSoon(false);
    clearExpiryTimer();
    await supabase.auth.signOut();
  }, [clearExpiryTimer]);

  // Allow consumers (e.g. the toast/redirect in ProtectedRoute) to clear the
  // flag after they've handled it, so it doesn't fire again on the next render.
  const acknowledgeSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const acknowledgeSessionExpiringSoon = useCallback(() => {
    setSessionExpiringSoon(false);
  }, []);

  const user = session?.user ?? null;

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      sessionExpired,
      sessionExpiringSoon,
      signIn,
      signOut,
      acknowledgeSessionExpired,
      acknowledgeSessionExpiringSoon,
    }),
    [
      session,
      user,
      profile,
      loading,
      sessionExpired,
      sessionExpiringSoon,
      signIn,
      signOut,
      acknowledgeSessionExpired,
      acknowledgeSessionExpiringSoon,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
