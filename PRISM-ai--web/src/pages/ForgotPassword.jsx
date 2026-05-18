import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setErrorMessage(error.message || 'Could not send reset email. Please try again.');
    } else {
      setSent(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="login-page forgot-page">
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

          {!sent ? (
            <form className="login-form forgot-form reveal reveal-3" onSubmit={handleSubmit}>
              <span className="tape tl" />
              <span className="tape tr" />

              <h2>
                <span className="word k">Forgot</span>{' '}
                <span className="word y">Password?</span>
              </h2>
              <p className="login-subtitle">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {errorMessage && (
                <p className="login-error forgot-error" role="alert">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary login-btn"
                disabled={submitting || !email}
              >
                <Mail size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="login-footer-text">
                <Link to="/login" className="pencil-link">
                  <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to login
                </Link>
              </p>
            </form>
          ) : (
            <div className="login-form forgot-success reveal reveal-3" role="status">
              <span className="tape tl" />
              <span className="tape tr" />

              <div className="forgot-success__icon">
                <CheckCircle size={48} />
              </div>
              <h2>
                <span className="word k">Check</span>{' '}
                <span className="word y">your email</span>
              </h2>
              <p className="login-subtitle">
                We sent a password reset link to <strong>{email}</strong>. Click it to
                pick a new password.
              </p>
              <p className="forgot-success__hint">
                Didn&apos;t get it? Check your spam folder, or try again in a minute.
              </p>

              <button
                type="button"
                className="btn btn-primary login-btn"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Back to login
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
