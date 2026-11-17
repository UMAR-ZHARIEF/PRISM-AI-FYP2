import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import './EnrollmentCamera.css';

// Frame space the server detects faces in: every frame is drawn onto a
// 640x480 canvas before upload, so bbox coordinates come back in this
// space and the overlay box scales from it to the displayed size.
const FRAME_W = 640;
const FRAME_H = 480;
const PREVIEW_INTERVAL_MS = 700;
const JPEG_QUALITY = 0.8;

// Guidance copy for each server verdict (short, friendly, no jargon).
const VERDICT_GUIDANCE = {
  no_face: { text: 'No face detected - move closer', tone: 'warn' },
  multiple: { text: 'Only one person in frame please', tone: 'warn' },
  low_confidence: { text: 'Hold still, lighting too low', tone: 'warn' },
  ok: { text: 'Ready - press Capture', tone: 'ok' },
};

/**
 * In-browser face enrollment camera (admin panel).
 *
 * Owns one enrollment session created by AdminPanel via
 * POST /api/ai/enroll/session. Runs a 700ms preview loop against
 * POST /api/ai/enroll/frame, advances captures on accepted
 * "capture" frames, then auto-completes via
 * POST /api/ai/enroll/complete and hands the server's message to
 * onSuccess. Cancel (or leaving the page) DELETEs the session.
 */
export default function EnrollmentCamera({
  sessionId,
  studentName,
  requiredCaptures,
  onSuccess,
  onCancel,
}) {
  const { session } = useAuth();

  // starting -> live -> completing -> (unmount on success)
  // Any step can fall into 'camera-error' (no camera) or 'ended'
  // (server session gone / complete failed); both show a message
  // and a Close button that hands control back to AdminPanel.
  const [phase, setPhase] = useState('starting');
  const [guidance, setGuidance] = useState({ text: 'Looking for a face...', tone: 'warn' });
  const [verdict, setVerdict] = useState(null);
  const [bbox, setBbox] = useState(null); // {left,top,width,height} in % of the stage
  const [captures, setCaptures] = useState(0);
  const [required, setRequired] = useState(requiredCaptures || 5);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [endMessage, setEndMessage] = useState({
    title: 'Session ended - start again.',
    body: 'Click Close, then press Start Enrollment to try again.',
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const inFlightRef = useRef(false);
  // true once the session is consumed (completed or cancelled) so the
  // unmount cleanup knows not to send a DELETE for it.
  const finishedRef = useRef(false);
  const flashTimerRef = useRef(null);
  // The preview interval and the unmount cleanup run outside the render
  // loop, so they reach the latest values through this ref.
  const latestRef = useRef({});
  // True while the component is mounted; lets the deferred unmount
  // DELETE tell a real unmount apart from StrictMode's dev remount.
  const mountedRef = useRef(false);

  const authHeaders = () => {
    const token = session?.access_token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const parseErrorMessage = async (res) => {
    try {
      const body = await res.json();
      return body?.message || body?.error || `Request failed (${res.status}).`;
    } catch {
      return `Request failed (${res.status}).`;
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finishEnrollment = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true; // session is being consumed; skip the unmount DELETE
    setPhase('completing');
    setGuidance({ text: 'All captures done - saving...', tone: 'ok' });
    stopCamera();
    try {
      const res = await fetch('/api/ai/enroll/complete', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        // e.g. 409 not enough captures: the session may still exist
        // server-side, so let the unmount cleanup DELETE it.
        finishedRef.current = false;
        setEndMessage({
          title: await parseErrorMessage(res),
          body: 'Click Close, then start enrollment again.',
        });
        setPhase('ended');
        return;
      }
      const body = await res.json().catch(() => ({}));
      onSuccess?.(body.message || `Enrolled ${studentName}.`);
    } catch (err) {
      console.warn('EnrollmentCamera: complete failed', err);
      finishedRef.current = false;
      setEndMessage({
        title: 'Could not reach the server. Is the API running?',
        body: 'Click Close, then start enrollment again.',
      });
      setPhase('ended');
    }
  };

  const applyFrameResult = (body, mode) => {
    const v = body.verdict || 'no_face';
    setVerdict(v);
    const g = VERDICT_GUIDANCE[v];
    if (g) setGuidance(g);
    if (Array.isArray(body.bbox) && body.bbox.length === 4) {
      const [x, y, w, h] = body.bbox;
      setBbox({
        left: `${(x / FRAME_W) * 100}%`,
        top: `${(y / FRAME_H) * 100}%`,
        width: `${(w / FRAME_W) * 100}%`,
        height: `${(h / FRAME_H) * 100}%`,
      });
    } else {
      setBbox(null);
    }
    if (typeof body.captures === 'number') setCaptures(body.captures);
    if (typeof body.required === 'number' && body.required > 0) setRequired(body.required);

    if (mode === 'capture' && v === 'ok') {
      // Brief green flash on the box: this capture was accepted.
      setFlash(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlash(false), 450);
    }

    const cap = typeof body.captures === 'number' ? body.captures : captures;
    const req = typeof body.required === 'number' && body.required > 0 ? body.required : required;
    if (body.done || cap >= req) finishEnrollment();
  };

  // One shared request path for preview ticks and capture clicks.
  const sendFrame = async (mode) => {
    if (inFlightRef.current || finishedRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      if (!canvasRef.current) {
        const c = document.createElement('canvas');
        c.width = FRAME_W;
        c.height = FRAME_H;
        canvasRef.current = c;
      }
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H);
      const image = canvasRef.current.toDataURL('image/jpeg', JPEG_QUALITY);
      const res = await fetch('/api/ai/enroll/frame', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ session_id: sessionId, image, mode }),
      });
      if (res.status === 404 || res.status === 410) {
        // Session expired or the helper stopped: stop everything and
        // send the operator back to the Start button.
        finishedRef.current = true;
        stopCamera();
        setEndMessage({
          title: 'Session ended - start again.',
          body: 'Click Close, then press Start Enrollment to try again.',
        });
        setPhase('ended');
        return;
      }
      if (!res.ok) {
        setGuidance({ text: await parseErrorMessage(res), tone: 'error' });
        return;
      }
      const body = await res.json().catch(() => ({}));
      applyFrameResult(body, mode);
    } catch (err) {
      console.warn('EnrollmentCamera: frame post failed', err);
      setGuidance({ text: 'Could not reach the server. Is the API running?', tone: 'error' });
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // Keep the always-on listeners supplied with fresh values without
  // re-running their effects.
  useEffect(() => {
    latestRef.current = { sessionId, token: session?.access_token, sendFrame };
    mountedRef.current = true;
  });

  // Open the camera once on mount; stop its tracks when we go away.
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: FRAME_W, height: FRAME_H },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        setPhase('live');
      } catch (err) {
        console.warn('EnrollmentCamera: camera unavailable', err);
        if (!cancelled) setPhase('camera-error');
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Preview loop: only while live.
  useEffect(() => {
    if (phase !== 'live') return undefined;
    const id = setInterval(() => {
      latestRef.current.sendFrame?.('preview');
    }, PREVIEW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  // Unmount cleanup: stop the camera and, if the session was never
  // completed or cancelled, fire-and-forget a DELETE so the server
  // does not keep a half-finished enrollment alive. StrictMode's dev
  // double-mount runs this cleanup once and remounts, so the DELETE
  // is deferred one tick and skipped when we come back.
  useEffect(() => () => {
    mountedRef.current = false;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setTimeout(() => {
      if (mountedRef.current) return; // remounted (StrictMode dev): session stays live
      const { sessionId: id, token } = latestRef.current;
      if (!finishedRef.current && id) {
        fetch('/api/ai/enroll/session', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ session_id: id }),
          keepalive: true,
        }).catch(() => {});
      }
    }, 0);
  }, []);

  const handleCapture = () => {
    if (phase !== 'live') return;
    sendFrame('capture');
  };

  const handleCancel = () => {
    finishedRef.current = true; // cancelled here, so no DELETE on unmount
    stopCamera();
    fetch('/api/ai/enroll/session', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
    onCancel?.();
  };

  const showStage = phase === 'starting' || phase === 'live' || phase === 'completing';

  return (
    <div className="enrollcam">
      <div className="enrollcam-head">
        <div>
          <span className="eyebrow">Enrolling</span>
          <h3 className="enrollcam-name">{studentName}</h3>
        </div>
        <span
          className="enrollcam-count mono tnum"
          aria-label={`${captures} of ${required} captures`}
        >
          <strong>{captures}</strong> / {required}
        </span>
      </div>

      {showStage && (
        <div className="enrollcam-stage">
          <video ref={videoRef} className="enrollcam-video" autoPlay playsInline muted />
          {bbox && (
            <div
              className={`enrollcam-box${verdict === 'ok' ? ' is-ok' : ''}${flash ? ' is-flash' : ''}`}
              style={bbox}
            />
          )}
          {phase === 'starting' && <div className="enrollcam-veil">Starting the camera...</div>}
        </div>
      )}

      {(phase === 'live' || phase === 'completing') && (
        <p className={`enrollcam-guidance tone-${guidance.tone}`}>{guidance.text}</p>
      )}

      {phase === 'live' && (
        <div className="enrollcam-actions">
          <button className="btn btn-primary" onClick={handleCapture} disabled={busy}>
            <Camera size={16} /> Capture
          </button>
          <button className="btn btn-outline" onClick={handleCancel}>
            <X size={16} /> Cancel
          </button>
        </div>
      )}

      {phase === 'camera-error' && (
        <div className="enrollcam-ended">
          <p className="enrollcam-ended-title">Camera access was blocked.</p>
          <p className="enrollcam-ended-body">
            Allow camera access for this page, click Close, then start enrollment again.
            The command-line enrollment on the server still works if the browser camera
            is not an option.
          </p>
          <button className="btn btn-outline" onClick={onCancel}>
            <X size={16} /> Close
          </button>
        </div>
      )}

      {phase === 'ended' && (
        <div className="enrollcam-ended">
          <p className="enrollcam-ended-title">{endMessage.title}</p>
          <p className="enrollcam-ended-body">{endMessage.body}</p>
          <button className="btn btn-outline" onClick={onCancel}>
            <X size={16} /> Close
          </button>
        </div>
      )}
    </div>
  );
}
