import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Globe, Check, X, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { POLICY_VERSIONS } from '../legal/version';
import useStudent from '../hooks/useStudent';
import biometricEn from '../legal/biometric.en.md?raw';
import biometricBm from '../legal/biometric.bm.md?raw';
import './ParentConsent.css';

export default function ParentConsent() {
  const { studentId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const lang = params.get('lang') === 'bm' ? 'bm' : 'en';
  const content = lang === 'bm' ? biometricBm : biometricEn;

  const { student, loading: studentLoading, error: studentError } = useStudent(studentId);

  const [currentConsent, setCurrentConsent] = useState(null);
  const [consentLoading, setConsentLoading] = useState(true);
  const [decision, setDecision] = useState(null); // 'yes' | 'no' | null
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    (async () => {
      setConsentLoading(true);
      const { data, error } = await supabase
        .from('biometric_consents')
        .select('*')
        .eq('student_id', studentId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('Failed to load biometric_consents:', error.message);
      } else if (data) {
        setCurrentConsent(data);
        setDecision(data.granted ? 'yes' : 'no');
      }
      setConsentLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const handleLangSwitch = () => {
    const next = new URLSearchParams(params);
    if (lang === 'en') next.set('lang', 'bm');
    else next.delete('lang');
    setParams(next, { replace: true });
  };

  const handleSubmit = async () => {
    if (!decision) {
      setErrorMessage(
        lang === 'bm'
          ? 'Sila pilih satu pilihan.'
          : 'Please choose one of the options.',
      );
      return;
    }
    if (!user?.id || !studentId) return;

    setSubmitting(true);
    setErrorMessage('');

    // Revoke any active rows before inserting a new decision so that the
    // "current" decision is unambiguous.
    await supabase
      .from('biometric_consents')
      .update({ revoked_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .is('revoked_at', null);

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    const { error } = await supabase.from('biometric_consents').insert({
      student_id: studentId,
      guardian_user_id: user.id,
      granted: decision === 'yes',
      method: 'in_app',
      policy_version: POLICY_VERSIONS.biometric,
      user_agent: userAgent,
    });

    if (error) {
      setErrorMessage(error.message || 'Could not record your decision. Please try again.');
      setSubmitting(false);
      return;
    }

    addToast(
      decision === 'yes'
        ? lang === 'bm'
          ? 'Persetujuan biometrik direkodkan. Terima kasih.'
          : 'Biometric consent recorded. Thank you.'
        : lang === 'bm'
          ? 'Pilihan anda direkodkan. Anak anda akan ditanda hadir secara manual.'
          : 'Your choice has been recorded. Your child will be marked present manually.',
      'success',
      4000,
    );
    setSubmitting(false);
    navigate('/parent');
  };

  if (studentLoading || consentLoading) {
    return (
      <div className="pc-page">
        <p className="pc-loading">Loading…</p>
      </div>
    );
  }

  if (studentError || !student) {
    return (
      <div className="pc-page">
        <div className="pc-error-card">
          <ShieldAlert size={32} />
          <h2>Student not found</h2>
          <p>You do not appear to be the listed guardian for this student, or the link is invalid.</p>
          <Link to="/parent" className="btn btn-outline">
            <ArrowLeft size={14} /> Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-page">
      <span className="tape page-tape-tl" />
      <span className="tape page-tape-tr" />

      <div className="pc-toolbar">
        <button
          type="button"
          className="pc-back"
          onClick={() => navigate('/parent')}
        >
          <ArrowLeft size={16} />
          {lang === 'en' ? 'Back to Portal' : 'Kembali ke Portal'}
        </button>
        <button
          type="button"
          className="pc-lang"
          onClick={handleLangSwitch}
        >
          <Globe size={16} />
          {lang === 'en' ? 'Bahasa Malaysia' : 'English'}
        </button>
      </div>

      <div className="pc-child-banner">
        <span className="eyebrow">
          {lang === 'en' ? 'Consent for' : 'Persetujuan untuk'}
        </span>
        <h1 className="pc-child-name">{student.full_name}</h1>
        <p className="pc-child-meta">
          {lang === 'en' ? 'Year' : 'Tahun'} {student.year_num}
        </p>
      </div>

      <article className="pc-notice-card">
        <ReactMarkdown
          components={{
            a: ({ href, children, ...props }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>

      <section className="pc-decision-card">
        <h2>
          {lang === 'en' ? 'Your decision' : 'Keputusan anda'}
        </h2>

        {currentConsent && (
          <p className="pc-current-note">
            {lang === 'en'
              ? `Your current decision: ${currentConsent.granted ? 'Yes, consented' : 'No, manual attendance'}. You can change it below.`
              : `Keputusan semasa anda: ${currentConsent.granted ? 'Ya, bersetuju' : 'Tidak, kehadiran manual'}. Anda boleh menukarnya di bawah.`}
          </p>
        )}

        <label className={`pc-choice ${decision === 'yes' ? 'pc-choice-selected' : ''}`}>
          <input
            type="radio"
            name="biometric-decision"
            value="yes"
            checked={decision === 'yes'}
            onChange={() => setDecision('yes')}
          />
          <span className="pc-choice-marker"><Check size={18} /></span>
          <span className="pc-choice-text">
            <strong>
              {lang === 'en' ? 'Yes, I consent.' : 'Ya, saya bersetuju.'}
            </strong>
            <small>
              {lang === 'en'
                ? "I have read the notice above. I give PRISM-AI explicit consent to capture, store, and use my child's face data for automated attendance."
                : 'Saya telah membaca notis di atas. Saya memberi PRISM-AI persetujuan nyata untuk menangkap, menyimpan, dan menggunakan data wajah anak saya untuk kehadiran automatik.'}
            </small>
          </span>
        </label>

        <label className={`pc-choice ${decision === 'no' ? 'pc-choice-selected' : ''}`}>
          <input
            type="radio"
            name="biometric-decision"
            value="no"
            checked={decision === 'no'}
            onChange={() => setDecision('no')}
          />
          <span className="pc-choice-marker pc-choice-marker-no"><X size={18} /></span>
          <span className="pc-choice-text">
            <strong>
              {lang === 'en' ? 'No, I do not consent.' : 'Tidak, saya tidak bersetuju.'}
            </strong>
            <small>
              {lang === 'en'
                ? "Please mark my child's attendance manually. My child's right to attend school is not affected."
                : 'Sila tanda kehadiran anak saya secara manual. Hak anak saya untuk bersekolah tidak terjejas.'}
            </small>
          </span>
        </label>

        {errorMessage && (
          <p className="pc-error" role="alert">{errorMessage}</p>
        )}

        <div className="pc-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !decision}
          >
            {submitting
              ? lang === 'bm' ? 'Menyimpan…' : 'Saving…'
              : lang === 'bm' ? 'Hantar keputusan saya' : 'Submit my decision'}
          </button>
        </div>

        <p className="pc-hint">
          {lang === 'en'
            ? 'You can change this decision at any time by returning to this page.'
            : 'Anda boleh menukar keputusan ini pada bila-bila masa dengan kembali ke halaman ini.'}
        </p>
      </section>
    </div>
  );
}
