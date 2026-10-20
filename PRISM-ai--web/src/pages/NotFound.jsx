import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div className="card tilt-l" style={{ maxWidth: 560, textAlign: 'center' }}>
        <span className="tape tl" aria-hidden="true" />
        <h1 style={{ margin: '0 0 16px', lineHeight: 1.2 }}>
          <span className="word k">Page</span> <span className="word r">not</span>{' '}
          <span className="word y">found</span>
        </h1>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 18,
            color: 'var(--ink-soft)',
            margin: '0 0 24px',
          }}
        >
          We looked everywhere, but this page seems to have gone missing. Head back to your dashboard and pick up where you left off.
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
