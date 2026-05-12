import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Eye, EyeOff, CheckCircle, Shield, Zap, ArrowLeft } from 'lucide-react';
import './Login.css';

const highlights = [
  { icon: CheckCircle, text: 'Real-time AI face recognition attendance' },
  { icon: Shield, text: 'Secure data with encrypted storage' },
  { icon: Zap, text: 'Instant parent notifications' },
];

const roleColor = { teacher: 'r', admin: 'b', parent: 'g' };

export default function Login() {
  const [role, setRole] = useState('teacher');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (role === 'parent') {
      navigate('/parent');
    } else {
      navigate('/dashboard');
    }
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

            <div className="role-tabs">
              {['teacher', 'admin', 'parent'].map(r => (
                <button
                  key={r}
                  type="button"
                  className={`role-tab paper-${roleColor[r]} ${role === r ? 'active' : ''}`}
                  onClick={() => setRole(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="Enter your email" autoComplete="username" />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-link pencil-link">Forgot password?</a>
            </div>

            <button type="submit" className="btn btn-primary login-btn">Sign In</button>

            <div className="demo-credentials">
              <h4>Demo Credentials</h4>
              <div className="demo-row">
                <span>Teacher:</span> <code>teacher@prismai.edu / password123</code>
              </div>
              <div className="demo-row">
                <span>Admin:</span> <code>admin@prismai.edu / password123</code>
              </div>
              <div className="demo-row">
                <span>Parent:</span> <code>razak@email.com / password123</code>
              </div>
            </div>

            <p className="login-footer-text">
              <Link to="/" className="pencil-link"><ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to Home</Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
