import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Eye, EyeOff, CheckCircle, Shield, Zap } from 'lucide-react';
import './Login.css';

const highlights = [
  { icon: CheckCircle, text: 'Real-time AI face recognition attendance' },
  { icon: Shield, text: 'Secure data with encrypted storage' },
  { icon: Zap, text: 'Instant parent notifications' },
];

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
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-brand">
            <Camera size={40} />
            <h1>PRISM-AI</h1>
            <p>AI Primary School Attendance Management System</p>
          </div>
          <div className="login-highlights">
            {highlights.map((h, i) => (
              <div key={i} className="login-highlight">
                <h.icon size={20} />
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-circle circle-1" />
        <div className="login-circle circle-2" />
        <div className="login-circle circle-3" />
      </div>

      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Welcome Back</h2>
          <p className="login-subtitle">Sign in to your account to continue</p>

          <div className="role-tabs">
            {['teacher', 'admin', 'parent'].map(r => (
              <button
                key={r}
                type="button"
                className={`role-tab ${role === r ? 'active' : ''}`}
                onClick={() => setRole(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="Enter your email" />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input">
              <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked />
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-link">Forgot password?</a>
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
            <Link to="/">&larr; Back to Home</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
