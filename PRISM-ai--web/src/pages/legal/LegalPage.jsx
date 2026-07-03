import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Globe } from 'lucide-react';
import termsEn from '../../legal/terms.en.md?raw';
import termsBm from '../../legal/terms.bm.md?raw';
import privacyEn from '../../legal/privacy.en.md?raw';
import privacyBm from '../../legal/privacy.bm.md?raw';
import biometricEn from '../../legal/biometric.en.md?raw';
import biometricBm from '../../legal/biometric.bm.md?raw';
import './LegalPage.css';

const DOCS = {
  terms:     { en: termsEn,     bm: termsBm,     titleEn: 'Terms of Service',          titleBm: 'Terma Perkhidmatan' },
  privacy:   { en: privacyEn,   bm: privacyBm,   titleEn: 'Privacy Policy',            titleBm: 'Dasar Privasi' },
  biometric: { en: biometricEn, bm: biometricBm, titleEn: 'Biometric Consent Notice', titleBm: 'Notis Persetujuan Biometrik' },
};

export default function LegalPage({ kind }) {
  const doc = DOCS[kind];
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const lang = params.get('lang') === 'bm' ? 'bm' : 'en';
  const content = doc[lang];
  const otherLang = lang === 'en' ? 'bm' : 'en';
  const otherLabel = lang === 'en' ? 'Bahasa Malaysia' : 'English';

  const handleLangSwitch = () => {
    const next = new URLSearchParams(params);
    if (otherLang === 'en') next.delete('lang');
    else next.set('lang', otherLang);
    setParams(next, { replace: true });
  };

  return (
    <div className="legal-page">
      <span className="tape page-tape-tl" />
      <span className="tape page-tape-tr" />

      <div className="legal-toolbar">
        <button
          type="button"
          className="legal-back"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        >
          <ArrowLeft size={16} />
          {lang === 'en' ? 'Back' : 'Kembali'}
        </button>

        <button
          type="button"
          className="legal-lang"
          onClick={handleLangSwitch}
          aria-label={`Switch to ${otherLabel}`}
        >
          <Globe size={16} />
          {otherLabel}
        </button>
      </div>

      <article className="legal-card">
        <ReactMarkdown
          components={{
            a: ({ href, children, ...props }) => {
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                );
              }
              return (
                <Link to={href || '#'} {...props}>
                  {children}
                </Link>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>

      <div className="legal-footer">
        <Link to="/terms" className="pencil-link">Terms</Link>
        <span className="legal-sep">•</span>
        <Link to="/privacy" className="pencil-link">Privacy</Link>
        <span className="legal-sep">•</span>
        <Link to="/biometric-consent" className="pencil-link">Biometric Notice</Link>
      </div>
    </div>
  );
}
