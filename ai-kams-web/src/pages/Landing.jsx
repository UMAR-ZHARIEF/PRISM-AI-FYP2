import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Shield, Bell, ScanFace, ClipboardCheck, BarChart3, Zap, ChevronDown, ChevronUp, Menu, X, CheckCircle, ArrowRight } from 'lucide-react';
import './Landing.css';

const features = [
  { icon: ScanFace, title: 'AI Face Recognition', desc: 'Automated attendance tracking using real-time face recognition technology. No manual roll calls needed.' },
  { icon: Bell, title: 'Instant Parent Alerts', desc: 'Parents receive real-time notifications when their child arrives, departs, or is marked absent.' },
  { icon: Shield, title: 'Safe & Secure', desc: 'Authorized pick-up verification and unrecognized face detection for maximum child safety.' },
  { icon: BarChart3, title: 'Real-Time Dashboard', desc: 'Live attendance overview with charts, class breakdowns, and activity timelines for teachers.' },
  { icon: ClipboardCheck, title: 'Automated Reports', desc: 'Generate weekly and monthly attendance reports with trends, export to PDF or CSV instantly.' },
  { icon: Zap, title: 'Easy Integration', desc: 'Simple setup with existing cameras. Works with any IP camera or webcam at your entrance.' },
];

const steps = [
  { num: '1', title: 'Camera Captures', desc: 'Live camera at entrance detects and captures student faces automatically as they arrive.' },
  { num: '2', title: 'AI Recognizes', desc: 'PyTorch-powered deep learning model identifies each student with 95%+ accuracy in milliseconds.' },
  { num: '3', title: 'Attendance Logged', desc: 'Check-in time and status are recorded instantly in the database with zero manual input.' },
  { num: '4', title: 'Parents Notified', desc: 'Automated push notification sent to parents confirming their child\'s safe arrival at school.' },
];

const faqs = [
  { q: 'How accurate is the face recognition?', a: 'Our AI model achieves over 95% accuracy and continuously improves as more data is collected. The model is optimized using PyTorch for fast inference.' },
  { q: 'What happens if a face is not recognized?', a: 'The system alerts the teacher immediately via the dashboard and logs the event. Manual check-in is always available as a backup option.' },
  { q: 'Can parents view attendance history?', a: 'Yes! Parents have a dedicated portal with a calendar view, attendance history, notifications, and direct contact with their child\'s teacher.' },
  { q: 'Is the system safe for children?', a: 'Absolutely. We use non-invasive cameras, and all facial data is encrypted and stored securely in Supabase with strict access controls.' },
  { q: 'What if the internet goes down?', a: 'The system has offline capability and will sync attendance data automatically once the connection is restored.' },
  { q: 'How many students can the system handle?', a: 'PRISM-AI is designed to handle hundreds of students across multiple classes. The face recognition runs efficiently on modern hardware.' },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="landing">
      {/* NAVBAR */}
      <nav className="landing-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <Camera size={28} />
            <span>PRISM-AI</span>
          </Link>
          <div className={`nav-links ${mobileNav ? 'show' : ''}`}>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#faq">FAQ</a>
            <Link to="/login" className="btn btn-primary">Get Started <ArrowRight size={16} /></Link>
          </div>
          <button className="nav-mobile-btn" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} /> AI-Powered Attendance System
          </div>
          <h1>Smart Attendance Tracking for Primary Schools</h1>
          <p>AI-powered face recognition that automates attendance, keeps parents informed, and gives teachers a powerful real-time dashboard , all in one system.</p>
          <div className="hero-buttons">
            <Link to="/login" className="btn btn-primary btn-lg">Get Started Free <ArrowRight size={18} /></Link>
            <a href="#how-it-works" className="btn btn-outline btn-lg">See How It Works</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-mockup">
            <div className="mockup-header">
              <div className="mockup-dots"><span /><span /><span /></div>
              <span>PRISM-AI Dashboard</span>
            </div>
            <div className="mockup-body">
              <div className="mockup-stats-row">
                <div className="mockup-stat green"><strong>10</strong><small>Present</small></div>
                <div className="mockup-stat red"><strong>2</strong><small>Absent</small></div>
                <div className="mockup-stat yellow"><strong>3</strong><small>Late</small></div>
              </div>
              <div className="mockup-chart">
                <div className="mockup-bar" style={{ height: '80%' }} />
                <div className="mockup-bar" style={{ height: '60%' }} />
                <div className="mockup-bar" style={{ height: '90%' }} />
                <div className="mockup-bar" style={{ height: '70%' }} />
                <div className="mockup-bar" style={{ height: '85%' }} />
              </div>
              <div className="mockup-list">
                {['Ahmad Irfan', 'Nur Aisyah', 'Puteri Hana'].map(name => (
                  <div key={name} className="mockup-row">
                    <div className="mockup-avatar" />
                    <span>{name}</span>
                    <span className="mockup-badge">Present</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hero-float float-1"><ScanFace size={20} /></div>
          <div className="hero-float float-2"><CheckCircle size={20} /></div>
          <div className="hero-float float-3"><Bell size={20} /></div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="section-container">
          <h2 className="section-title">Why Choose PRISM-AI?</h2>
          <p className="section-subtitle">Everything you need for modern primary school attendance management.</p>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon"><f.icon size={28} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section section-alt">
        <div className="section-container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">From camera to notification in seconds.</p>
          <div className="steps-grid">
            {steps.map((s, i) => (
              <div key={i} className="step-card">
                <div className="step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
            <div className="steps-line" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section section-alt">
        <div className="section-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about PRISM-AI.</p>
          <div className="faq-list">
            {faqs.map((f, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  {openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {openFaq === i && <div className="faq-answer"><p>{f.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="nav-logo"><Camera size={24} /><span>PRISM-AI</span></div>
            <p>Primary School Intelligent Student Management and Predictive Analytics Ecosystem.</p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="footer-links">
            <h4>Access</h4>
            <Link to="/login">Teacher Login</Link>
            <Link to="/parent">Parent Portal</Link>
            <Link to="/login">Admin Login</Link>
          </div>
          <div className="footer-links">
            <h4>Contact</h4>
            <p>Kuala Lumpur, Malaysia</p>
            <p>info@prismai.edu</p>
            <p>+60 12-345 6789</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 PRISM-AI. Final Year Project &mdash; UniKL.</p>
        </div>
      </footer>
    </div>
  );
}
