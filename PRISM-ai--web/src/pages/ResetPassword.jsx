import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CheckCircle, Camera, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext.jsx';
import './Login.css';
import './ForgotPassword.css';
import './ResetPassword.css';

export default function ResetPassword() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [done, setDone] = useState(false);
  // Give Supabase a moment to consume the URL hash & establish the session.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // detectSessionInUrl on the supabase client will populate the session
    // shortly after mount. Wait a tick before deciding the link is invalid.
    const t = setTimeout(() => setSessionChecked(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate('/login', { replace: true }), 2000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 8) {
      setErrorMessage('Please use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setErrorMessage(error.message || 'Could not update password. Please try again.');
    } else {
      setDone(true);
    }
    setSubmitting(false);
  };

  // No session AND we've given the client time to detect it — bad/expired link.
  const linkInvalid = sessionChecked && !session;

  return (
    <div className="login-page reset-page">
      <span className="tape page-tape-tl" />
      <span className="tape page-tape-tr" />

      <div className="forgot-wrap">
        <section className="forgot-card-col">
          <div className="forgot-brand reveal reveal-1">
            <Camera size={36} />
            <h1>
              <span className="word k">PRISM-AI</span>
            </h1>
          </div>

          {linkInvalid ? (
            <div className="login-form reset-invalid reveal reveal-3" role="alert">
              <span className="tape tl" />
              <span className="tape tr" />
              <div className="reset-invalid__icon">
                <AlertTriangle size={48} />
              </div>
              <h2>
                <span className="word k">Link</span>{' '}
                <span className="word r">expired</span>
              </h2>
              <p className="login-subtitle">
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Link to="/forgot-password" className="btn btn-primary login-btn">
                Request a new link
              </Link>
              <p className="login-footer-text">
                <Link to="/login" className="pencil-link">
                  <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to login
                </Link>
              </p>
            </div>
          ) : done ? (
            <div className="login-form reset-success reveal reveal-3" role="status">
              <span className="tape tl" />
              <span className="tape tr" />
              <div className="forgot-success__icon">
                <CheckCircle size={48} />
              </div>
              <h2>
                <span className="word k">Password</span>{' '}
                <span className="word y">updated</span>
              </h2>
              <p className="login-subtitle">
                You&apos;re all set. Redirecting you to login…
              </p>
              <Link to="/login" className="btn btn-primary login-btn">
                Continue to login
              </Link>
            </div>
          ) : (
            <form className="login-form reset-form reveal reveal-3" onSubmit={handleSubmit}>
              <span className="tape tl" />
              <span className="tape tr" />

              <h2>
                <span className="word k">Set a new</span>{' '}
                <span className="word y">password</span>
              </h2>
              <p className="login-subtitle">
                Choose something memorable but strong — at least 8 characters.
              </p>

              <div className="form-group">
                <label>New password</label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter a new password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm new password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter the new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {errorMessage && (
                <p className="login-error reset-error" role="alert">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary login-btn"
                disabled={submitting || !newPassword || !confirmPassword}
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>

              <p className="login-footer-text">
                <Link to="/login" className="pencil-link">
                  <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to login
                </Link>
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
