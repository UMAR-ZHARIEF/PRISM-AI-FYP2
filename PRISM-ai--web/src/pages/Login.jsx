import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Eye, EyeOff, CheckCircle, Shield, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { recordTermsAndPrivacyAcceptance } from '../lib/policyAcceptance';
import './Login.css';

const highlights = [
  { icon: CheckCircle, text: 'Real-time AI face recognition attendance' },
  { icon: Shield, text: 'Secure data with encrypted storage' },
  { icon: Zap, text: 'Instant parent notifications' },
];

// Where each role lands after signing in when there's no saved destination.
const ROLE_HOME = { parent: '/parent', admin: '/dashboard', teacher: '/dashboard' };

// Honour a saved destination (set by ProtectedRoute when a signed-in user
// was bounced off a route) only when the signed-in role is allowed to view
// it — otherwise fall back to the role home. Teachers share every /dashboard
// page except the admin panel.
function destinationForRole(pathname, role) {
  const home = ROLE_HOME[role];
  if (!pathname || !pathname.startsWith('/')) return home;
  if (role === 'parent' && (pathname === '/parent' || pathname.startsWith('/parent/'))) {
    return pathname;
  }
  if (role === 'admin' && pathname.startsWith('/dashboard')) return pathname;
  if (
    role === 'teacher' &&
    pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/dashboard/admin')
  ) {
    return pathname;
  }
  return home;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, signIn, signOut, loading } = useAuth();

  // Saved by ProtectedRoute when a signed-in user hit a route their role
  // can't view — lets us send them back there after a fresh sign-in.
  const fromPathname = location.state?.from?.pathname;

  // Signed in but the profile carries no role we can route to: there is no
  // safe home for them, so explain instead of redirecting.
  const unassignedRole = Boolean(session && profile && !ROLE_HOME[profile.role]);

  // Session restored but the profile never arrived once loading finished:
  // the account has no usable profile, so the login form would just sit
  // there doing nothing. Show the stranded-account card instead.
  const stranded = Boolean(session && !loading && !profile);

  useEffect(() => {
    if (!session || !profile) return;
    const home = ROLE_HOME[profile.role];
    if (!home) return;
    navigate(destinationForRole(fromPathname, profile.role), { replace: true });
  }, [session, profile, navigate, fromPathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!agreed) {
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      const friendly = /invalid login credentials/i.test(error.message)
        ? 'Invalid email or password'
        : error.message;
      setErrorMessage(friendly);
      setSubmitting(false);
      return;
    }
    // Sign-in succeeded; record acceptance of current Terms + Privacy.
    // Failures here are non-fatal — the LegalGate component will re-catch
    // unacceptable state on the next navigation.
    recordTermsAndPrivacyAcceptance().catch(() => {});
    setSubmitting(false);
  };

  return (
    <div className="login-page">
      <span className="tape page-tape-tl" />
      <span className="tape page-tape-tr" />

      <div className="login-grid">
        {/* LEFT — brand panel */}
        <aside className="login-aside">
          <div className="login-brand reveal reveal-1">
            <Camera size={40} />
            <h1>
              <span className="word k">PRISM-AI</span>
            </h1>
            <p>AI Primary School Attendance Management System</p>
          </div>

          <div className="login-highlights reveal reveal-2">
            {highlights.map((h, i) => (
              <div key={i} className="login-highlight">
                <h.icon size={20} />
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* RIGHT — form */}
        <section className="login-form-col">
          {stranded ? (
            <div className="login-form">
              <span className="tape tl" />
              <span className="tape tr" />

              <h2>
                <span className="word k">Account</span> <span className="word y">Pending</span>
              </h2>
              <p className="login-subtitle">Your account profile could not be loaded.</p>

              <p className="login-error" role="alert">
                Your account is not set up yet. Please contact your school administrator.
              </p>

              <button
                type="button"
                className="btn btn-primary login-btn"
                onClick={() => signOut?.()}
              >
                Sign Out
              </button>
            </div>
          ) : (
          <form className="login-form reveal reveal-3" onSubmit={handleSubmit}>
            <span className="tape tl" />
            <span className="tape tr" />

            <h2>
              <span className="word k">Welcome</span> <span className="word y">Back</span>
            </h2>
            <p className="login-subtitle">Sign in to your account to continue</p>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="checkbox-label legal-agree">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="pencil-link" target="_blank" rel="noopener noreferrer">Terms of Service</Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="pencil-link" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
                </span>
              </label>
            </div>

            {(errorMessage || unassignedRole) && (
              <p className="login-error" role="alert">
                {errorMessage || 'Your account is not assigned a role. Contact the school administrator.'}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="login-footer-text">
              <Link to="/" className="pencil-link"><ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to Home</Link>
            </p>

            <div className="login-legal-links">
              <Link to="/terms" className="pencil-link">Terms</Link>
              <span>•</span>
              <Link to="/privacy" className="pencil-link">Privacy</Link>
              <span>•</span>
              <Link to="/biometric-consent" className="pencil-link">Biometric Notice</Link>
            </div>
          </form>
          )}
        </section>
      </div>
    </div>
  );
}
