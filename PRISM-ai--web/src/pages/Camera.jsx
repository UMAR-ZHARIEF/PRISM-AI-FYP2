import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Video, VideoOff, AlertTriangle, ChevronDown, Play, Square, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Camera.css';

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
  const [proc, setProc] = useState({ running: false, pid: null, startedAt: null });
  const [procBusy, setProcBusy] = useState(false); // true during start/stop in-flight
  const [procError, setProcError] = useState('');

  // MJPEG stream readiness — flipped true on the first <img onLoad>, reset
  // to 'error' if the connection drops. Used to swap the "Connecting…" overlay
  // for the live feed once Python actually starts pushing frames.
  // 'idle' | 'connecting' | 'live' | 'error'
  const [streamState, setStreamState] = useState('idle');

  // Auto-retry state. The MJPEG stream can fail on the first attempt because
  // Python takes ~10s to load InsightFace models before the HTTP server starts
  // accepting connections. We exponentially back off + remount the <img> until
  // either it connects or we give up.
  const MAX_RETRIES = 15; // ~30 seconds of total reconnection window
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimerRef = useRef(null);
  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const { session } = useAuth();

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

  // Reset the stream state every time the Python process transitions between
  // running and stopped — this is what triggers a fresh <img> mount via the
  // key prop below, so the browser re-opens the MJPEG connection cleanly.
  useEffect(() => {
    clearRetryTimer();
    setRetryAttempt(0);
    setStreamState(proc.running ? 'connecting' : 'idle');
    return clearRetryTimer; // cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.running, proc.startedAt]);

  // <img> error → schedule an auto-retry instead of giving up. Python's MJPEG
  // server isn't reachable for the first ~10 seconds while InsightFace models
  // load; we silently retry until it comes up or we run out of attempts.
  const handleStreamError = useCallback(() => {
    if (!proc.running) {
      setStreamState('idle');
      return;
    }
    setRetryAttempt((prev) => {
      if (prev >= MAX_RETRIES) {
        setStreamState('error');
        return prev;
      }
      // Backoff: 1s, 1.5s, 2s, 2.5s, then cap at 3s
      const delay = Math.min(1000 + prev * 500, 3000);
      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        setRetryAttempt((n) => n + 1);
        setStreamState('connecting');
      }, delay);
      return prev;
    });
  }, [proc.running]);

  const handleStreamLoad = useCallback(() => {
    clearRetryTimer();
    setRetryAttempt(0);
    setStreamState('live');
  }, []);

  const handleManualRetry = useCallback(() => {
    clearRetryTimer();
    setRetryAttempt(0);
    setStreamState('connecting');
  }, []);

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

  // Used to force-remount the <img> on each AI start/stop cycle so the MJPEG
  // connection is freshly negotiated (otherwise a stale cached response can
  // linger after Python restarts). retryAttempt is mixed in so each retry
  // also remounts.
  const streamKey = `${proc.startedAt || (proc.running ? 'running' : 'idle')}-r${retryAttempt}`;

  return (
    <div className="live-cam-page">
      <div className="page-header">
        <div>
          <h1>
            <span className="word k">Live</span>{' '}
            <span className="word r">Camera</span>
          </h1>
          <p className="page-subtitle">Annotated face-recognition feed from PRISM-AI, plus live detection status and the list of students spotted so far.</p>
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
            {/* Only render the <img> when Python is actually running —
                otherwise the browser shows the broken-image icon. */}
            {proc.running && streamState !== 'error' && (
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
                <p>AI service is not running</p>
                <small>Click <strong>Start AI</strong> on the right to launch the Python face-recognition service. The annotated feed will appear here once it's live.</small>
              </div>
            )}

            {proc.running && streamState === 'connecting' && (
              <div className="live-cam-overlay">
                <Loader2 size={48} className="live-cam-spin" />
                <p>Starting AI camera…</p>
                <small>Python is loading the InsightFace models — this usually takes 5–10 seconds on first start.</small>
              </div>
            )}

            {proc.running && streamState === 'error' && (
              <div className="live-cam-overlay live-cam-overlay-warn">
                <AlertTriangle size={56} />
                <p>Live feed unavailable</p>
                <small>The AI process is running but the MJPEG stream on port 5174 isn't reachable yet. It usually recovers on its own — if not, restart the AI service.</small>
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
