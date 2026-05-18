import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, RefreshCw, Video, VideoOff, AlertTriangle, ChevronDown, Play, Square, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Camera.css';

// Live Camera page — Hazwan's Express bridge (port 4000) tells us if the
// edge face_recognition.py service is online. The webcam <video> is purely a
// preview of what the operator sees; the actual detection happens inside the
// Python window. Both processes can usually share the camera on Windows
// (MediaFoundation lets multiple readers attach), but if one of them grabs
// it exclusively the other will surface a "device in use" error — see the
// permission-denied branch below.
export default function Camera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Camera state: idle | requesting | live | denied | error
  const [camState, setCamState] = useState('idle');
  const [camError, setCamError] = useState('');

  // AI bridge state — mirrors Dashboard.jsx's /api/health poller.
  const [ai, setAi] = useState({ status: 'offline', tracked: 0, lastUpdate: null });
  // Detected students pushed by the Python AI to /api/attendance.
  const [detections, setDetections] = useState([]);

  // Process-management state for the Python child that Express supervises.
  // `running` = Express has a live child PID; distinct from `ai.status`
  // which only flips to 'online' once Python actually POSTs detections.
  const [proc, setProc] = useState({ running: false, pid: null, startedAt: null });
  const [procBusy, setProcBusy] = useState(false); // true during start/stop in-flight
  const [procError, setProcError] = useState('');

  const { session } = useAuth();

  // --- Webcam plumbing -----------------------------------------------------
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(async () => {
    setCamError('');
    setCamState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCamState('live');
    } catch (err) {
      // NotAllowedError → user denied or browser blocked.
      // NotFoundError   → no camera attached.
      // NotReadableError → device in use (likely Python has exclusive grab).
      const name = err?.name || 'Error';
      setCamState(name === 'NotAllowedError' ? 'denied' : 'error');
      if (name === 'NotAllowedError') setCamError('Camera permission was blocked. Allow camera access in your browser settings and try again.');
      else if (name === 'NotFoundError') setCamError('No camera was found on this device.');
      else if (name === 'NotReadableError') setCamError('Camera is in use by another application (perhaps face_recognition.py). Close it and retry, or rely on the AI panel below.');
      else setCamError(err?.message || 'Could not access the camera.');
    }
  }, []);

  // Boot the stream on mount and tear it down on unmount so the camera
  // indicator light turns off cleanly when navigating away.
  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  // --- AI status + detections polling --------------------------------------
  const fetchAi = useCallback(async () => {
    try {
      const r = await fetch('/api/health');
      const d = r.ok ? await r.json() : null;
      setAi({ status: d?.aiStatus || 'offline', tracked: d?.studentsTracked || 0, lastUpdate: d?.lastUpdate || null });
    } catch {
      setAi({ status: 'offline', tracked: 0, lastUpdate: null });
    }
  }, []);

  const fetchDetections = useCallback(async () => {
    try {
      const r = await fetch('/api/attendance');
      if (!r.ok) return;
      const d = await r.json();
      const list = Array.isArray(d?.attendanceToday) ? d.attendanceToday : [];
      setDetections(list);
    } catch {
      // Express bridge offline — keep prior list, just don't update.
    }
  }, []);

  // Poll the supervised child process status alongside health/detections.
  const fetchProc = useCallback(async () => {
    try {
      const r = await fetch('/api/ai/process');
      if (!r.ok) return;
      const d = await r.json();
      setProc({ running: !!d.running, pid: d.pid ?? null, startedAt: d.startedAt ?? null });
    } catch {
      // Express down — leave state as-is.
    }
  }, []);

  useEffect(() => {
    fetchAi();
    fetchDetections();
    fetchProc();
    const a = setInterval(fetchAi, 5000);
    const b = setInterval(fetchDetections, 5000);
    const c = setInterval(fetchProc, 5000);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, [fetchAi, fetchDetections, fetchProc]);

  // --- Start / Stop AI handlers --------------------------------------------
  const callAiAction = useCallback(async (action) => {
    setProcError('');
    const token = session?.access_token;
    if (!token) {
      setProcError('You must be signed in as an admin to control the AI service.');
      return;
    }
    setProcBusy(true);
    try {
      const r = await fetch(`/api/ai/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!r.ok) {
        let msg = `Request failed (${r.status})`;
        try { const body = await r.json(); msg = body?.error || msg; } catch { /* non-JSON */ }
        setProcError(msg);
      }
      // Refresh both health + process state immediately — don't wait 5s.
      await Promise.allSettled([fetchProc(), fetchAi()]);
    } catch (e) {
      setProcError(e?.message || `Failed to ${action} AI service.`);
    } finally {
      setProcBusy(false);
    }
  }, [session, fetchProc, fetchAi]);

  const startAi = useCallback(() => callAiAction('start'), [callAiAction]);
  const stopAi  = useCallback(() => callAiAction('stop'),  [callAiAction]);

  // --- Helpers -------------------------------------------------------------
  const aiOnline = ai.status === 'online';
  const lastUpdateLabel = ai.lastUpdate
    ? new Date(ai.lastUpdate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  // Avatar palette mirrors the rest of the app — cycle by name hash.
  const avatarPalette = ['r', 'y', 'g', 'o', 'k', ''];
  const avatarTone = (name) => {
    if (!name) return '';
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return avatarPalette[Math.abs(h) % avatarPalette.length];
  };
  const initials = (name) => (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || '?';

  return (
    <div className="live-cam-page">
      <div className="page-header">
        <div>
          <h1>
            <span className="word k">Live</span>{' '}
            <span className="word r">Camera</span>
          </h1>
          <p className="page-subtitle">Webcam preview, AI detection status, and a live list of students spotted by the face-recognition service.</p>
        </div>
        <div className="page-header-actions">
          <span className={`live-cam-ai-pill ${aiOnline ? 'is-on' : 'is-off'}`}>
            <span className="live-cam-ai-dot" />
            {aiOnline ? 'AI Online' : 'AI Offline'}
          </span>
        </div>
      </div>

      <div className="live-cam-grid">
        {/* === Video preview =============================================== */}
        <div className="card live-cam-video-card reveal reveal-1">
          <span className="tape tl" />
          <span className="tape tr" />
          <div className="card-header">
            <h2>Webcam Preview</h2>
            {camState === 'live' && (
              <span className="live-cam-rec">
                <span className="live-cam-rec-dot" /> recording
              </span>
            )}
          </div>

          <div className={`live-cam-video-frame is-${camState}`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="live-cam-video"
            />

            {camState === 'requesting' && (
              <div className="live-cam-overlay">
                <CameraIcon size={48} />
                <p>Asking your browser for camera permission…</p>
              </div>
            )}

            {camState === 'denied' && (
              <div className="live-cam-overlay live-cam-overlay-warn">
                <VideoOff size={56} />
                <p>Camera blocked</p>
                <small>{camError}</small>
                <button className="btn btn-outline live-cam-retry" onClick={startStream}>
                  <RefreshCw size={16} /> Try again
                </button>
              </div>
            )}

            {camState === 'error' && (
              <div className="live-cam-overlay live-cam-overlay-warn">
                <AlertTriangle size={56} />
                <p>Could not start the camera</p>
                <small>{camError}</small>
                <button className="btn btn-outline live-cam-retry" onClick={startStream}>
                  <RefreshCw size={16} /> Try again
                </button>
              </div>
            )}
          </div>

          <p className="live-cam-caption">
            This is your browser's webcam preview. The AI runs in a separate
            Python window — both can usually share the camera at the same time.
          </p>
        </div>

        {/* === AI status side panel ======================================= */}
        <div className="card live-cam-status reveal reveal-2">
          <span className="tape bl" />
          <div className="card-header">
            <h2>AI Status</h2>
          </div>

          <div className="live-cam-status-row">
            <span className="live-cam-status-key">Service</span>
            {(() => {
              // Tri-state: process not running → Offline. Process running but
              // no detections yet → Starting. Both true → Online.
              if (aiOnline) {
                return <span className="badge badge-present">AI Online</span>;
              }
              if (proc.running) {
                return <span className="badge badge-late">Starting up…</span>;
              }
              return <span className="badge badge-absent">AI Offline</span>;
            })()}
          </div>

          <div className="live-cam-status-row">
            <span className="live-cam-status-key">Students tracked</span>
            <span className="live-cam-status-val">{ai.tracked}</span>
          </div>

          <div className="live-cam-status-row">
            <span className="live-cam-status-key">Last detection</span>
            <span className="live-cam-status-val mono">{lastUpdateLabel}</span>
          </div>

          <div className="live-cam-ai-controls">
            {proc.running ? (
              <button
                type="button"
                className="btn btn-danger live-cam-ai-btn"
                onClick={stopAi}
                disabled={procBusy}
              >
                {procBusy ? <Loader2 size={16} className="live-cam-spin" /> : <Square size={16} />}
                {procBusy ? 'Stopping…' : 'Stop AI'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary live-cam-ai-btn"
                onClick={startAi}
                disabled={procBusy}
              >
                {procBusy ? <Loader2 size={16} className="live-cam-spin" /> : <Play size={16} />}
                {procBusy ? 'Starting…' : 'Start AI'}
              </button>
            )}
            {proc.pid && (
              <span className="live-cam-ai-pid mono">PID {proc.pid}</span>
            )}
          </div>

          {procError && (
            <div className="live-cam-ai-error" role="alert">
              <AlertTriangle size={16} />
              <span>{procError}</span>
            </div>
          )}

          {!proc.running && !aiOnline && (
            <details className="live-cam-hint">
              <summary>
                <ChevronDown size={16} />
                Manual start (if the button doesn't work)
              </summary>
              <ol>
                <li>Open a terminal in the project root.</li>
                <li><code>cd ai-service/edge</code></li>
                <li><code>./venv/Scripts/python.exe -u face_recognition.py --camera 0</code></li>
                <li>The Python window will show your webcam with face boxes.</li>
                <li>This page will update once Python starts sending detections.</li>
              </ol>
            </details>
          )}
        </div>
      </div>

      {/* === Detections list ============================================== */}
      <div className="card live-cam-detections reveal reveal-3">
        <span className="tape tr" />
        <div className="card-header">
          <h2>Detected Students</h2>
          <span className="live-cam-detections-count">
            {detections.length} {detections.length === 1 ? 'detection' : 'detections'} today
          </span>
        </div>

        {detections.length === 0 ? (
          <div className="live-cam-empty">
            <Video size={42} />
            <p>No detections yet.</p>
            <small>The AI service will populate this list as students appear in front of the camera.</small>
          </div>
        ) : (
          <div className="live-cam-detection-list">
            {detections.map((det, i) => {
              const status = (det.status || 'present').toLowerCase();
              const sim = typeof det.similarity === 'number' ? Math.round(det.similarity * 100) : null;
              return (
                <div className={`live-cam-detection-row live-cam-detection-${i % 4}`} key={`${det.studentId ?? i}-${det.name ?? ''}-${det.timeIn ?? ''}`}>
                  <div className={`avatar ${avatarTone(det.name)}`}>{initials(det.name)}</div>
                  <div className="live-cam-detection-meta">
                    <strong>{det.name || 'Unknown student'}</strong>
                    <span className="live-cam-detection-class">
                      {det.year ? `Year ${det.year} ` : ''}{det.class || ''}
                    </span>
                  </div>
                  <span className={`badge badge-${status === 'late' ? 'late' : status === 'absent' ? 'absent' : 'present'}`}>
                    {status}
                  </span>
                  <span className="live-cam-detection-time mono">{det.timeIn || '—'}</span>
                  {sim !== null && (
                    <span className="live-cam-detection-sim" title="Face match confidence">
                      {sim}% match
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
