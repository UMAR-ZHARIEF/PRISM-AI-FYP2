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

const featureColor = ['r', 'b', 'g', 'y', 'o', 'p'];

const steps = [
  { num: '1', title: 'Camera Captures', desc: 'Live camera at entrance detects and captures student faces automatically as they arrive.' },
  { num: '2', title: 'AI Recognizes', desc: 'PyTorch-powered deep learning model identifies each student with 95%+ accuracy in milliseconds.' },
  { num: '3', title: 'Attendance Logged', desc: 'Check-in time and status are recorded instantly in the database with zero manual input.' },
  { num: '4', title: 'Parents Notified', desc: 'Automated push notification sent to parents confirming their child\'s safe arrival at school.' },
];

const stepColor = ['r', 'b', 'g', 'y'];

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
      <span className="tape page-tape-tl" />
      <span className="tape page-tape-tr" />

      {/* NAVBAR */}
      <nav className="landing-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <span className="nav-mark"><Camera size={22} /></span>
            <span className="nav-name">PRISM-AI</span>
          </Link>
          <div className={`nav-links ${mobileNav ? 'show' : ''}`}>
            <a href="#features" className="pencil-link">Features</a>
            <a href="#how-it-works" className="pencil-link">How It Works</a>
            <a href="#faq" className="pencil-link">FAQ</a>
            <Link to="/login" className="btn btn-primary">Get Started <ArrowRight size={16} /></Link>
          </div>
          <button className="nav-mobile-btn" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-text">
            <div className="hero-badge reveal reveal-1">
              <Zap size={14} /> AI-Powered Attendance System
            </div>
            <h1 className="hero-headline reveal reveal-2">
              <span className="word k">Smart</span> <span className="word y">Attendance</span><br/>
              <span className="word r">Tracking</span> <span className="word k">for</span><br/>
              <span className="word b">Primary</span> <span className="word g">Schools</span>
            </h1>
            <p className="hero-deck reveal reveal-3">
              AI-powered face recognition that automates attendance, keeps parents informed, and gives teachers a powerful real-time dashboard, all in one system.
            </p>
            <div className="hero-cta reveal reveal-4">
              <Link to="/login" className="btn btn-primary">Get Started Free <ArrowRight size={16} /></Link>
              <a href="#how-it-works" className="btn btn-outline">See How It Works</a>
            </div>
          </div>

          <aside className="hero-aside reveal reveal-5">
            <div className="ledger">
              <span className="tape tl" />
              <span className="tape tr" />
              <h4 className="ledger-title">PRISM-AI Dashboard</h4>
              <div className="ledger-row head">
                <span>No.</span><span>Pupil</span><span>In</span><span>Status</span>
              </div>
              <div className="ledger-row"><span className="mono">01</span><span>Ahmad Irfan</span><span className="mono">07:42</span><span className="badge badge-present">Present</span></div>
              <div className="ledger-row"><span className="mono">02</span><span>Nur Aisyah</span><span className="mono">07:48</span><span className="badge badge-present">Present</span></div>
              <div className="ledger-row"><span className="mono">03</span><span>Puteri Hana</span><span className="mono">07:51</span><span className="badge badge-present">Present</span></div>
            </div>

            <div className="hero-stat-trio">
              <div className="mini-stat s-green"><strong>10</strong><span>Present</span></div>
              <div className="mini-stat s-red"><strong>2</strong><span>Absent</span></div>
              <div className="mini-stat s-orange"><strong>3</strong><span>Late</span></div>
            </div>
          </aside>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section section-features">
        <div className="section-container">
          <header className="section-header">
            <h2>
              <span className="word k">Why</span> <span className="word b">Choose</span><br/>
              <span className="word y">PRISM-AI?</span>
            </h2>
            <p className="section-subtitle">Everything you need for modern primary school attendance management.</p>
          </header>

          <div className="features-list">
            {features.map((f, i) => (
              <article key={i} className={`feature-card paper-${featureColor[i]} reveal`} style={{ animationDelay: `${0.05 + i * 0.06}s` }}>
                <span className="tape tl" />
                <div className="feature-icon"><f.icon size={28} /></div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-body">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section section-method">
        <div className="section-container">
          <header className="section-header">
            <h2>
              <span className="word k">How</span> <span className="word b">It</span> <span className="word y">Works</span>
            </h2>
            <p className="section-subtitle">From camera to notification in seconds.</p>
          </header>

          <ol className="method-list">
            {steps.map((s, i) => (
              <li key={i} className={`method-item paper-${stepColor[i]}`}>
                <div className="method-num">{s.num}</div>
                <h3 className="method-title">{s.title}</h3>
                <p className="method-desc">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section section-faq">
        <div className="section-container">
          <header className="section-header">
            <h2>
              <span className="word k">Frequently</span> <span className="word b">Asked</span><br/>
              <span className="word y">Questions</span>
            </h2>
            <p className="section-subtitle">Everything you need to know about PRISM-AI.</p>
          </header>

          <div className="faq-list">
            {faqs.map((f, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="faq-q">{f.q}</span>
                  <span className="faq-toggle">{openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span>
                </button>
                {openFaq === i && (
                  <div className="faq-answer">
                    <p>{f.a}</p>
                  </div>
                )}
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
          <div className="footer-col">
            <h4>Quick Links</h4>
            <a href="#features" className="pencil-link">Features</a>
            <a href="#how-it-works" className="pencil-link">How It Works</a>
            <a href="#faq" className="pencil-link">FAQ</a>
          </div>
          <div className="footer-col">
            <h4>Access</h4>
            <Link to="/login" className="pencil-link">Teacher Login</Link>
            <Link to="/parent" className="pencil-link">Parent Portal</Link>
            <Link to="/login" className="pencil-link">Admin Login</Link>
          </div>
          <div className="footer-col">
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
