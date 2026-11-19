import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { RefreshCw, Video, VideoOff, AlertTriangle, Play, Square, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Camera.css';
import { cameraStreamReducer, initialStreamState, STREAM_STARTUP_TIMEOUT_MS, STREAM_RETRY_DELAY_MS } from './cameraStreamState';

// Live Camera page — Express (port 3001) supervises the Python face-recognition
// process. Python owns the webcam exclusively and serves an MJPEG stream on
// port 5174; Vite proxies /stream → :5174 so the <img> below renders the
// annotated feed straight from Python. No browser-side getUserMedia.
export default function Camera() {
  // AI bridge state — mirrors Dashboard.jsx's /api/health poller.
  const [ai, setAi] = useState({ status: 'offline', tracked: 0, lastUpdate: null });
  // Detected students pushed by the Python AI to /api/attendance.
  const [detections, setDetections] = useState([]);

  // Process-management state for the Python child that Express supervises.
  // `running` = Express has a live child PID; distinct from `ai.status`
  // which only flips to 'online' once Python actually POSTs detections.
  const [proc, setProc] = useState({ available: null, running: false, streamReady: false, pid: null, startedAt: null, lastError: null });
  const [procBusy, setProcBusy] = useState(false); // true during start/stop in-flight
  const [procError, setProcError] = useState('');

  const [stream, dispatchStream] = useReducer(cameraStreamReducer, initialStreamState);
  const procRequestRef = useRef(0);
  const processKey = proc.running ? `${proc.pid}:${proc.startedAt || 'running'}` : null;
  const currentStream = stream.sessionKey === processKey ? stream : { ...initialStreamState, sessionKey: processKey };
  const streamState = !proc.running ? 'idle' : currentStream.phase;

  const { session } = useAuth();

  // --- AI status + detections polling --------------------------------------
  // GET /api/health stays public, but /api/attendance and /api/ai/process are
  // staff-only now, so every poll carries the signed-in user's JWT.
  const authHeaders = useCallback(() => (
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  ), [session]);
  const invalidateProcRequest = useCallback(() => { ++procRequestRef.current; }, []);

  const fetchAi = useCallback(async () => {
    try {
      const r = await fetch('/api/health', { headers: authHeaders() });
      const d = r.ok ? await r.json() : null;
      setAi({ status: d?.aiStatus || 'offline', tracked: d?.studentsTracked || 0, lastUpdate: d?.lastUpdate || null });
    } catch {
      setAi({ status: 'offline', tracked: 0, lastUpdate: null });
    }
  }, [authHeaders]);

  const fetchDetections = useCallback(async () => {
    try {
      const r = await fetch('/api/attendance', { headers: authHeaders() });
      if (!r.ok) return;
      const d = await r.json();
      const list = Array.isArray(d?.attendanceToday) ? d.attendanceToday : [];
      setDetections(list);
    } catch {
      // Express bridge offline — keep prior list, just don't update.
    }
  }, [authHeaders]);

  // Poll the supervised child process status alongside health/detections.
  const fetchProc = useCallback(async () => {
    const requestId = ++procRequestRef.current;
    try {
      const r = await fetch('/api/ai/process', { headers: authHeaders(), signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`AI status unavailable (${r.status})`);
      const d = await r.json();
      if (requestId !== procRequestRef.current) return;
      setProc({ available: true, running: !!d.running, streamReady: d.running === true && d.streamReady === true, pid: d.pid ?? null, startedAt: d.startedAt ?? null, lastError: d.lastError ?? null });
    } catch {
      if (requestId !== procRequestRef.current) return;
      // Fail closed: never retain a stale running/ready snapshot after a
      // backend outage or auth failure, which would keep requesting /stream.
      setProc({ available: false, running: false, streamReady: false, pid: null, startedAt: null, lastError: 'Cannot check the AI service. Check the backend connection and your sign-in session, then retry.' });
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchAi();
    fetchDetections();
    fetchProc();
    const a = setInterval(fetchAi, 5000);
    const b = setInterval(fetchDetections, 5000);
    const c = setInterval(fetchProc, 5000);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); invalidateProcRequest(); };
  }, [fetchAi, fetchDetections, fetchProc, invalidateProcRequest]);

  useEffect(() => {
    dispatchStream({ type: 'reset', sessionKey: processKey });
  }, [processKey]);

  const waitingForStream = proc.running && streamState !== 'live' && streamState !== 'error';
  useEffect(() => {
    if (!waitingForStream) return undefined;
    const timer = setTimeout(() => dispatchStream({ type: 'timeout', sessionKey: processKey }), STREAM_STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [processKey, waitingForStream, currentStream.retryEpoch]);

  useEffect(() => {
    if (!proc.streamReady) dispatchStream({ type: 'disconnected', sessionKey: processKey });
  }, [processKey, proc.streamReady]);

  useEffect(() => {
    if (!proc.running || streamState !== 'retry') return undefined;
    const timer = setTimeout(async () => {
      await fetchProc();
      dispatchStream({ type: 'retry', sessionKey: processKey });
    }, STREAM_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [proc.running, processKey, streamState, fetchProc]);

  const handleStreamError = () => {
    dispatchStream({ type: 'failed', sessionKey: processKey });
    fetchProc();
  };
  const handleStreamLoad = () => dispatchStream({ type: 'loaded', sessionKey: processKey });
  const handleManualRetry = () => {
    dispatchStream({ type: 'manual', sessionKey: processKey });
    fetchProc();
  };

  // --- Start / Stop AI handlers --------------------------------------------
  const callAiAction = useCallback(async (action) => {
    setProcError('');
    const token = session?.access_token;
    if (!token) {
      setProcError('You must be signed in as an admin or teacher to control the AI service.');
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
  const aiOnline = proc.available === true && proc.running && ai.status === 'online';
  // What to show in the error box: an immediate start/stop failure wins;
  // otherwise the server-side reason the last AI run died (e.g. the GPU
  // gate's "Incompatible hardware — GPU required"). Only shown while the
  // process is down — a fresh start clears it on the server.
  const serviceError = procError || (!proc.running && proc.lastError) || '';
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

  // Used to force-remount the <img> on each AI start/stop cycle so the MJPEG
  // connection is freshly negotiated (otherwise a stale cached response can
  // linger after Python restarts). retryAttempt is mixed in so each retry
  // also remounts.
  const streamKey = `${processKey}-r${currentStream.attempt}-${currentStream.retryEpoch}`;

  return (
    <div className="live-cam-page">
      <div className="page-header">
        <div>
          <h1>
            <span className="word g">Take</span>{' '}
            <span className="word k">Attendance</span>
          </h1>
          <p className="page-subtitle">Live AI face-recognition camera feed, real-time arrival detection, and automated attendance logging.</p>
        </div>
        <div className="page-header-actions">
          <span className={`live-cam-ai-pill ${aiOnline ? 'is-on' : 'is-off'}`}>
            <span className="live-cam-ai-dot" />
            {aiOnline ? 'AI Online' : 'AI Offline'}
          </span>
        </div>
      </div>

      <div className="live-cam-grid">
        {/* === Annotated AI preview ======================================== */}
        <div className="card live-cam-video-card reveal reveal-1">
          <span className="tape tl" />
          <span className="tape tr" />
          <div className="card-header">
            <h2>Webcam Preview</h2>
            {proc.running && streamState === 'live' && (
              <span className="live-cam-rec">
                <span className="live-cam-rec-dot" /> live AI
              </span>
            )}
          </div>

          <div className={`live-cam-video-frame is-${proc.running ? streamState : 'idle'}`}>
            {/* PID alone is insufficient: the backend must first confirm the
                MJPEG server is producing bytes. Never probe via a broken img. */}
            {proc.running && proc.streamReady && stream.sessionKey === processKey && (streamState === 'connecting' || streamState === 'live') && (
              <img
                key={streamKey}
                src="/stream"
                alt="Live PRISM-AI annotated face-recognition feed"
                className="live-cam-video"
                onLoad={handleStreamLoad}
                onError={handleStreamError}
              />
            )}

            {!proc.running && (
              <div className="live-cam-overlay">
                <VideoOff size={56} />
                <p>{proc.available === false ? 'AI status unavailable' : proc.available === null ? 'Checking AI service…' : 'AI service is not running'}</p>
                <small>{proc.available === false ? 'Check that the backend is running and you are signed in. No camera connection will be attempted.' : proc.available === null ? 'Waiting for the backend status check.' : <>Click <strong>Start AI</strong> when you are ready to use recognition. Manual attendance works without it.</>}</small>
                {proc.available === false && <button className="btn btn-outline" onClick={fetchProc}>Retry status check</button>}
              </div>
            )}

            {proc.running && (streamState === 'connecting' || streamState === 'retry') && (
              <div className="live-cam-overlay">
                <Loader2 size={48} className="live-cam-spin" />
                <p>{streamState === 'retry' ? 'Reconnecting to the camera…' : 'Waiting for the camera stream…'}</p>
                <small>The first start may take 60–90 seconds while models load. We wait up to two minutes for a ready stream before asking you to retry.</small>
              </div>
            )}

            {proc.running && streamState === 'error' && (
              <div className="live-cam-overlay live-cam-overlay-warn">
                <AlertTriangle size={56} />
                <p>Live feed unavailable</p>
                <small>The stream did not become ready in time, or repeated connections failed. Automatic preview retries have stopped. Check the backend's AI startup messages, then retry.</small>
                <button
                  className="btn btn-outline live-cam-retry"
                  type="button"
                  onClick={handleManualRetry}
                >
                  <RefreshCw size={16} /> Retry
                </button>
              </div>
            )}
          </div>

          <p className="live-cam-caption">
            Live feed from PRISM-AI face recognition · annotated with detected students.
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
              if (proc.available === false) return <span className="badge badge-absent">Status unavailable</span>;
              if (proc.available === null) return <span className="badge badge-late">Checking…</span>;
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
                disabled={procBusy || proc.available !== true}
              >
                {procBusy ? <Loader2 size={16} className="live-cam-spin" /> : <Play size={16} />}
                {procBusy ? 'Starting…' : 'Start AI'}
              </button>
            )}
            {proc.pid && (
              <span className="live-cam-ai-pid mono">PID {proc.pid}</span>
            )}
          </div>

          {serviceError && (
            <div className="live-cam-ai-error" role="alert">
              <AlertTriangle size={16} />
              <span>{serviceError}</span>
            </div>
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
