import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Eye, EyeOff, CheckCircle, Shield, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { recordTermsAndPrivacyAcceptance } from '../lib/policyAcceptance';
import './Login.css';

const highlights = [
  { icon: CheckCircle, text: 'Real-time AI face recognition attendance' },
  { icon: Shield, text: 'Secure data with encrypted storage' },
  { icon: Zap, text: 'Instant parent notifications' },
];

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { session, profile, signIn } = useAuth();

  useEffect(() => {
    if (!session || !profile) return;
    const r = profile.role;
    if (r === 'parent') {
      navigate('/parent', { replace: true });
    } else if (r === 'admin' || r === 'teacher' || r === 'assistant') {
      navigate('/dashboard', { replace: true });
    } else {
      setErrorMessage('Your account is not assigned a role. Contact the school administrator.');
    }
  }, [session, profile, navigate]);

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

            {errorMessage && (
              <p className="login-error" role="alert">{errorMessage}</p>
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
        </section>
      </div>
    </div>
  );
}
