/**
 * PRISM-AI Backend API Server
 *
 * This Express.js server acts as the bridge between:
 *   - Python Edge AI (face_recognition.py) → sends POST with recognized students
 *   - React Dashboard (frontend) → fetches GET for live attendance data
 *
 * In addition to the in-memory live-feed used by the Dashboard, every fresh
 * detection is also persisted (fire-and-forget) to Supabase's
 * `attendance_records` table when SUPABASE_URL + SUPABASE_SECRET_KEY are set.
 *
 * Runs on: http://localhost:3001
 */

// Load .env if present (optional — env vars from the shell still work too)
try { require('dotenv').config(); } catch (_) { /* dotenv not installed — ignore */ }

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
// Browser-enrollment frames (Phase 1) arrive as base64 JPEG data URLs, which
// easily pass the default 100 KB JSON body cap, so this one route gets its
// own larger limit. It must be registered above the global parser: whichever
// parser consumes the stream first wins, and body-parser skips a request
// once the stream has been read.
app.use('/api/ai/enroll/frame', express.json({ limit: '10mb' }));
app.use(express.json());

// ── Supabase Client ──────────────────────────────────────────────────────────
// Optional. If env vars are missing, persistence is disabled but the in-memory
// dashboard polling still works as before.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  console.log('[Supabase] Persistence enabled.');
} else {
  console.warn('[Supabase] DISABLED — missing SUPABASE_URL or SUPABASE_SECRET_KEY env. Detections will be in-memory only.');
}

// ── App Settings (cached) ────────────────────────────────────────────────────
// Single editable row (id=1) managed by the Admin Panel (migration 0005). Read
// through the service-role client and cached for 60s so the per-detection
// late check and AI spawns don't hammer the DB. Any failure (Supabase off,
// table missing, row not seeded) fails safe to the defaults the migration
// seeds.
const SETTINGS_DEFAULTS = Object.freeze({
  school_name: 'PRISM-AI Primary School',
  late_cutoff: '08:00',
  det_size: 320,
  match_threshold: 0.40,
  // Classroom label the Python edge stamps on outgoing detections
  // (migration 0012). Default keeps the label the payload hardcoded
  // before it became configurable, so existing data stays continuous.
  classroom_label: 'CLASS_1A',
  // Crash auto-restart admin toggle (migration 0010). Default ON per user
  // decision 2026-10-21: a crashed recognizer respawns by itself unless an
  // admin turns it off here.
  autorestart_ai: true,
});
const SETTINGS_TTL_MS = 60 * 1000;
const settingsCache = { values: { ...SETTINGS_DEFAULTS }, fetchedAt: 0 };

async function getAppSettings() {
  if (!supabase || Date.now() - settingsCache.fetchedAt < SETTINGS_TTL_MS) {
    return settingsCache.values;
  }
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('school_name, late_cutoff, det_size, match_threshold, autorestart_ai, classroom_label')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      settingsCache.values = {
        school_name: data.school_name ?? SETTINGS_DEFAULTS.school_name,
        late_cutoff: data.late_cutoff ?? SETTINGS_DEFAULTS.late_cutoff,
        det_size: data.det_size ?? SETTINGS_DEFAULTS.det_size,
        match_threshold: data.match_threshold ?? SETTINGS_DEFAULTS.match_threshold,
        classroom_label: data.classroom_label ?? SETTINGS_DEFAULTS.classroom_label,
        autorestart_ai: data.autorestart_ai ?? SETTINGS_DEFAULTS.autorestart_ai,
      };
    }
  } catch (e) {
    console.warn('[settings] app_settings read failed — keeping defaults:', e.message);
  }
  // Bump the timestamp even on failure or a missing row: retry at most once
  // per TTL, not once per detection batch.
  settingsCache.fetchedAt = Date.now();
  return settingsCache.values;
}

// ── Date Helpers ─────────────────────────────────────────────────────────────

// YYYY-MM-DD in LOCAL time (toISOString would give the UTC date — wrong before 8 AM MYT)
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── In-Memory Data Store ─────────────────────────────────────────────────────
// This stores all live data from the AI. In production, use a database.

// attendanceToday is the only live list left: the Dashboard's panels are
// Supabase-backed and Camera.jsx reads just this one (P6 dead-data sweep).
let liveData = {
  attendanceToday: [],    // Today's attendance records
  lastUpdate: null,       // Timestamp of last AI update
  aiStatus: 'offline',    // 'online' or 'offline'
};

// Track which students have been marked present today (prevent duplicates)
const presentToday = new Set();

// The local calendar day the in-memory store currently reflects. Without a
// rollover, a server left running past midnight still has yesterday's names
// in presentToday, so every day-2 detection gets skipped as a "duplicate".
let currentDay = localDateStr(new Date());

// Request-driven daily reset — called from the AI POST handler and from
// /api/health (the dashboard polls health every 5s, so this fires within
// seconds of midnight even when the camera is off). Deliberately leaves
// aiStatus/lastUpdate untouched — they describe the AI link, not the day.
function resetIfNewDay() {
  const today = localDateStr(new Date());
  if (today === currentDay) return;
  presentToday.clear();
  liveData.attendanceToday = [];
  currentDay = today;
  console.log(`[RESET] New day ${today} — cleared in-memory attendance`);
}

// ── AI Child Process State ───────────────────────────────────────────────────
// Tracks the Python face_recognition.py subprocess that admins can spawn /
// kill via /api/ai/start and /api/ai/stop. Separate from `aiStatus` in
// liveData (which only reflects whether Python has POSTed recently).
let aiProcess = null;
let aiStartedAt = null;
let aiLastExitCode = null;
let aiLastExitAt = null;
let aiLastError = null;

// gpu_check.py refuses to run on machines without CUDA/DirectML: it prints a
// GPU_REQUIRED marker line to stderr and exits with code 3 — no CPU fallback.
// Map either signal to the user-facing message shown on the Camera page
// (must stay in sync with gpu_check.GPU_REQUIRED_MSG).
const AI_EXIT_GPU_REQUIRED = 3;
const GPU_REQUIRED_MSG = 'Incompatible hardware — GPU required';

// ── Crash Auto-Restart State ─────────────────────────────────────────────────
// When the Python child exits on its own (a crash), the server starts it
// again after a short delay. Four gates decide, all checked in
// scheduleCrashAutoRestart below: (i) the exit was not operator-driven
// (aiIntentionalStop is latched by the stop/restart/force-kill paths and
// consumed here), (ii) the exit code is not the GPU refusal (a respawn
// would refuse the same way), (iii) app_settings.autorestart_ai is true
// (default ON per user decision 2026-10-21), and (iv) the rolling-window
// circuit breaker has room: at most AI_AUTORESTART_MAX auto-restarts in
// any AI_AUTORESTART_WINDOW_MS.
let aiIntentionalStop = false;   // latched before an operator-driven kill, consumed by the exit handler
let aiRestartInProgress = false; // guards POST /api/ai/restart against concurrent restarts
const aiAutoRestartTimes = [];   // timestamps of recent auto-restart attempts (rolling breaker window)
const AI_AUTORESTART_DELAY_MS = 3 * 1000;
const AI_AUTORESTART_WINDOW_MS = 10 * 60 * 1000;
const AI_AUTORESTART_MAX = 5;

// Drop breaker timestamps older than the window, then return the count that
// still counts against the circuit breaker. GET /api/ai/process reports this
// as autorestarts_recent so the UI can show how close the breaker is.
function recentAutoRestartCount() {
  const cutoff = Date.now() - AI_AUTORESTART_WINDOW_MS;
  while (aiAutoRestartTimes.length > 0 && aiAutoRestartTimes[0] < cutoff) {
    aiAutoRestartTimes.shift();
  }
  return aiAutoRestartTimes.length;
}

// Crash auto-restart: called from the AI child's exit handler for EVERY
// exit; filters and schedules as described in the state block above. Never
// throws: the whole body is guarded, and spawn failures are logged and
// surfaced through aiLastError (which GET /api/ai/process reports).
async function scheduleCrashAutoRestart(exitCode) {
  try {
    if (aiIntentionalStop) {
      // Operator asked for this exit (stop/restart/force-kill): consume the
      // latch exactly once so a genuine crash afterwards can still restart.
      aiIntentionalStop = false;
      console.log('[AI] Auto-restart skipped: exit was an explicit stop or restart');
      return;
    }
    if (exitCode === AI_EXIT_GPU_REQUIRED) {
      // Hardware refusal: the respawn would refuse the same way, never loop.
      console.log('[AI] Auto-restart skipped: GPU-required exit (code 3), not retrying');
      return;
    }
    const settings = await getAppSettings();
    if (!settings.autorestart_ai) {
      console.log('[AI] Auto-restart skipped: disabled by settings (autorestart_ai = false)');
      return;
    }
    const recent = recentAutoRestartCount();
    if (recent >= AI_AUTORESTART_MAX) {
      aiLastError = `Auto-restart paused: circuit breaker tripped (${recent} auto-restarts in the last 10 minutes)`;
      console.warn(`[AI] Auto-restart skipped: ${aiLastError}`);
      return;
    }
    aiAutoRestartTimes.push(Date.now());
    console.log(`[AI] Crash detected (exit code ${exitCode ?? 'unknown'}): auto-restarting in ${AI_AUTORESTART_DELAY_MS / 1000}s (attempt ${aiAutoRestartTimes.length} of ${AI_AUTORESTART_MAX} per 10-minute window)`);
    setTimeout(() => {
      startAiProcess(null) // no req: there is no caller to audit
        .then(({ pid }) => {
          console.log(`[AI] Auto-restart succeeded: new AI child pid ${pid}`);
        })
        .catch((e) => {
          console.error('[AI] Auto-restart failed:', e.message);
          if (!aiLastError) aiLastError = `Auto-restart failed: ${e.message}`;
        });
    }, AI_AUTORESTART_DELAY_MS);
  } catch (e) {
    console.error('[AI] Auto-restart scheduling failed:', e);
  }
}

function aiPaths() {
  const aiDir = path.join(__dirname, '..', 'ai-service', 'edge');
  const pythonExe = os.platform() === 'win32'
    ? path.join(aiDir, 'venv', 'Scripts', 'python.exe')
    : path.join(aiDir, 'venv', 'bin', 'python');
  const script = path.join(aiDir, 'face_recognition.py');
  const pidPath = path.join(aiDir, 'ai.pid');
  return { aiDir, pythonExe, script, pidPath };
}

// Port the Python child's MJPEG live-stream server listens on (face_recognition.py
// --stream-port default). If something still holds this port after a server
// restart, an orphaned Python process survived its parent Express process.
const AI_PORT = 5174;

// Read/clear the ai.pid file written by /api/ai/start. Both swallow errors:
// a missing or unreadable pid file just means "no PID recorded".
function readAiPid() {
  try {
    const raw = fs.readFileSync(aiPaths().pidPath, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (_) {
    return null;
  }
}

function clearAiPid() {
  try {
    fs.unlinkSync(aiPaths().pidPath);
  } catch (_) { /* already gone — fine */ }
}

// Existence probe only: signal 0 is dropped, it never terminates the target.
// Throws ESRCH when the process is gone; EPERM means it exists but is owned
// by someone else — still "alive" for our purposes.
function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Find the PID of whatever process has a LOCAL TCP socket on `port` (i.e. is
// listening or connected on it). Windows: netstat -ano piped through findstr;
// non-Windows: lsof. Callback receives the numeric PID or null. Parse the
// LOCAL-address column so an ESTABLISHED row whose REMOTE port happens to be
// 5174 is not misread as "the port is taken".
function findPortPid(port, cb) {
  const cmd = os.platform() === 'win32'
    ? `netstat -ano -p tcp | findstr :${port}`
    : `lsof -ti tcp:${port} -sTCP:LISTEN`;
  exec(cmd, { windowsHide: true }, (err, stdout) => {
    if (err && !stdout) return cb(null); // findstr exits 1 on no match
    for (const line of String(stdout).split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 2) continue;
      const localAddr = cols[1] || '';
      if (!localAddr.endsWith(`:${port}`)) continue;
      const pid = parseInt(cols[cols.length - 1], 10);
      if (Number.isInteger(pid) && pid > 0) return cb(pid);
    }
    cb(null);
  });
}

// Startup reconciliation (#15 zombie cleanup): if this Express process dies
// while Python is running, ai.pid survives with a live PID and the orphaned
// Python keeps holding the camera + stream port. On boot: a stale PID (its
// process is gone) is just cleared; a PID that is alive AND the stream port
// is occupied is treated as our leftover and terminated, so a fresh
// /api/ai/start gets a clean camera. The old child cannot be re-adopted (we
// have no ChildProcess handle for it), so ai.pid is cleared either way — this
// server instance is not its supervisor.
function reconcileAiPid() {
  const pid = readAiPid();
  if (!pid) return; // normal case — nothing recorded

  if (!isPidAlive(pid)) {
    console.log(`[AI] Startup: ai.pid holds dead PID ${pid} — clearing stale file`);
    clearAiPid();
    return;
  }

  console.log(`[AI] Startup: ai.pid holds live PID ${pid} — checking port ${AI_PORT}...`);
  findPortPid(AI_PORT, (portPid) => {
    if (portPid) {
      console.log(`[AI] Startup: port ${AI_PORT} is occupied (PID ${portPid}) — PID ${pid} looks like an orphaned AI child; killing it`);
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`[AI] Startup: orphaned AI PID ${pid} terminated`);
      } catch (e) {
        console.warn(`[AI] Startup: could not kill orphaned PID ${pid}:`, e.message);
      }
    } else {
      console.log(`[AI] Startup: PID ${pid} is alive but port ${AI_PORT} is free — leaving it alone; clearing ai.pid`);
    }
    clearAiPid();
  });
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
// Verifies the caller's JWT (from `Authorization: Bearer <token>`), looks up
// their profile via the service-role client, and only continues if role==='admin'.
// Attaches { id, role } as req.actor for downstream handlers.
async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (pErr || !profile) return res.status(403).json({ error: 'No profile' });
    if (profile.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    req.actor = { id: profile.id, role: profile.role };
    next();
  } catch (e) {
    console.error('requireAdmin failed:', e);
    res.status(500).json({ error: 'Server error' });
  }
}

// Same as requireAdmin but allows role === 'admin' OR 'teacher'. Used for the
// AI start/stop endpoints — teachers are the staff physically in classrooms
// who actually need to turn the camera on/off. Parents stay blocked.
async function requireAdminOrTeacher(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (pErr || !profile) return res.status(403).json({ error: 'No profile' });
    if (profile.role !== 'admin' && profile.role !== 'teacher') {
      return res.status(403).json({ error: 'Admin or teacher only' });
    }

    req.actor = { id: profile.id, role: profile.role };
    next();
  } catch (e) {
    console.error('requireAdminOrTeacher failed:', e);
    res.status(500).json({ error: 'Server error' });
  }
}

// Same pattern but allows any staff role: 'admin' or 'teacher'.
// Used for the read-only live-feed endpoints (GET /api/attendance, GET
// /api/ai/process, GET /api/ai/enrolled) that every signed-in staff member
// needs on the Dashboard / Camera pages. Parents stay blocked.
async function requireStaff(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (pErr || !profile) return res.status(403).json({ error: 'No profile' });
    if (!['admin', 'teacher'].includes(profile.role)) {
      return res.status(403).json({ error: 'Staff only' });
    }

    req.actor = { id: profile.id, role: profile.role };
    next();
  } catch (e) {
    console.error('requireStaff failed:', e);
    res.status(500).json({ error: 'Server error' });
  }
}

// Machine-to-machine guard for POST /api/attendance (the AI bridge from
// face_recognition.py). That call carries no user JWT, so it is protected by
// a shared secret instead: set AI_BRIDGE_KEY in server/.env AND in the Python
// process's environment (same value — see server/.env.example), and the
// sender must pass it as the X-API-Key header. Requests without the header,
// with a wrong value, or while AI_BRIDGE_KEY is unset are rejected with 401.
function requireBridgeKey(req, res, next) {
  const expected = process.env.AI_BRIDGE_KEY || '';
  const provided = req.get('X-API-Key') || '';
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

// Fire-and-forget audit log writer. Never throws; logs failures only.
function logAudit(actorId, action, targetId, metadata) {
  if (!supabase) return;
  supabase
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      action,
      target_type: 'user',
      target_id: targetId,
      metadata: metadata || {},
    })
    .then(({ error }) => {
      if (error) console.error(`[audit] insert "${action}" failed:`, error.message);
    }, (err) => {
      console.error(`[audit] insert "${action}" rejected:`, err);
    });
}

// ── Engagement pipeline (fire-and-forget) ────────────────────────────────────
// The Edge AI payload can carry per-detection emotion data. Every tick that
// carries emotions is sampled into engagement_records. Unlike attendance,
// this is NOT deduplicated to the first sighting per day: session percentages
// ("disengaged in N% of today's session") need continuous samples. After
// each batch, aggregate_engagement rebuilds the student's
// engagement_summaries row for the date, and a homeroom-teacher notification
// fires the first time a student crosses the at-risk line for that date.

// Server-side half of the note-taking rule (the 60-second sustained no-face
// rule lives in the Python edge): when the class-average disengagement
// exceeds this threshold, the whole class is doing the same low-attention
// activity (e.g. writing notes), so individual at-risk flags are skipped.
const ENGAGEMENT_CLASS_GATE_PCT = 60;

// Detection -> student resolution cache for the engagement pass. The payload
// repeats every SEND_INTERVAL (10s), so caching the UUID/name lookup keeps
// the per-tick DB load flat. Bounded by the roster size.
const engagementStudentCache = new Map();

// Same resolution order as the attendance bridge: UUID first (exact even for
// namesakes), then case-insensitive name matching disambiguated by the
// payload's class name when several students share a name. Returns the
// students row (id, full_name, class_section_id) or null.
async function resolveEngagementStudent(det) {
  const bareName = (det.student_name || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  if (!bareName || bareName.toLowerCase() === 'unknown') return null;

  const detUuid = String(det.student_uuid || '').trim();
  const uuidKey = detUuid ? `uuid:${detUuid}` : null;
  const nameKey = `name:${bareName.toLowerCase()}`;

  if (uuidKey && engagementStudentCache.has(uuidKey)) {
    return engagementStudentCache.get(uuidKey);
  }
  if (!uuidKey && engagementStudentCache.has(nameKey)) {
    return engagementStudentCache.get(nameKey);
  }

  let student = null;

  if (detUuid) {
    const { data: byUuid, error: uuidErr } = await supabase
      .from('students')
      .select('id, full_name, class_section_id')
      .eq('id', detUuid)
      .maybeSingle();
    if (uuidErr) {
      console.warn(`[engagement] UUID lookup error for ${detUuid}:`, uuidErr.message);
    } else if (byUuid) {
      student = byUuid;
    }
  }

  if (!student) {
    const { data: matches, error: lookupErr } = await supabase
      .from('students')
      .select('id, full_name, class_section_id, class_section:class_sections(name)')
      .ilike('full_name', bareName);
    if (lookupErr) {
      console.warn(`[engagement] lookup error for "${bareName}":`, lookupErr.message);
    } else if (matches && matches.length === 1) {
      student = matches[0];
    } else if (matches && matches.length > 1) {
      // Namesake disambiguation via the payload's class name (same rule as
      // the attendance bridge): only pick when it uniquely resolves one
      // student, otherwise leave null (never guess).
      const detClass = (det.student_class || '').trim().toLowerCase();
      const byClass = detClass
        ? matches.filter((m) => (m.class_section?.name || '').trim().toLowerCase() === detClass)
        : [];
      if (byClass.length === 1) student = byClass[0];
    }
  }

  if (student) {
    if (uuidKey) engagementStudentCache.set(uuidKey, student);
    engagementStudentCache.set(nameKey, student);
  } else if (uuidKey) {
    // Negative cache: a dead UUID must not re-query on every 10s tick.
    engagementStudentCache.set(uuidKey, null);
  }
  return student;
}

// Aggregate one student's day summary, then apply the class gate and the
// at-risk alert. Runs inside the fire-and-forget chain only: every failure
// logs and never touches the attendance response.
async function aggregateEngagementForStudent(studentId, dateStr) {
  try {
    // 1) Pre-aggregation at_risk: the alert must fire only on a false ->
    //    true flip within the same date, never once per tick.
    const { data: prev } = await supabase
      .from('engagement_summaries')
      .select('at_risk')
      .eq('student_id', studentId)
      .eq('date', dateStr)
      .maybeSingle();

    // 2) Rebuild the day summary from engagement_records (DB-side RPC).
    const { error: rpcErr } = await supabase.rpc('aggregate_engagement', {
      p_student_id: studentId,
      p_date: dateStr,
    });
    if (rpcErr) {
      console.warn('[engagement] aggregate_engagement RPC failed:', rpcErr.message);
      return;
    }

    // 3) Fresh summary plus the student's class membership (for the gate
    //    and the homeroom-teacher lookup).
    const { data: summary, error: sumErr } = await supabase
      .from('engagement_summaries')
      .select('at_risk, disengaged_pct, student:students(full_name, class_section_id)')
      .eq('student_id', studentId)
      .eq('date', dateStr)
      .maybeSingle();
    if (sumErr) {
      console.warn('[engagement] summary read failed:', sumErr.message);
      return;
    }
    if (!summary || !summary.at_risk) return;

    // 4) Class-average gate: when most of the class is disengaged the
    //    reading is ambient (collective note-writing), not an individual
    //    problem. Un-flag the student so the summary endpoint stays
    //    consistent with the skip decision.
    const sectionId = summary.student?.class_section_id || null;
    if (sectionId) {
      const { data: classRows, error: clsErr } = await supabase
        .from('engagement_summaries')
        .select('disengaged_pct, students!inner(class_section_id)')
        .eq('date', dateStr)
        .eq('students.class_section_id', sectionId);
      if (clsErr) {
        console.warn('[engagement] class-average lookup failed:', clsErr.message);
      } else if (Array.isArray(classRows) && classRows.length > 0) {
        const classAvg = classRows.reduce(
          (sum, r) => sum + (Number(r.disengaged_pct) || 0),
          0
        ) / classRows.length;
        // engagement_summaries stores the *_pct columns as 0-1 fractions,
        // so compare in fraction space; the constant keeps its percent scale.
        if (classAvg > ENGAGEMENT_CLASS_GATE_PCT / 100) {
          const { error: unflagErr } = await supabase
            .from('engagement_summaries')
            .update({ at_risk: false })
            .eq('student_id', studentId)
            .eq('date', dateStr);
          if (unflagErr) {
            console.warn('[engagement] class-gate unflag failed:', unflagErr.message);
          }
          return;
        }
      }
    }

    // 5) Newly at-risk only: a pre-existing true flag means the alert for
    //    this date already went out (or the flag was up) — never re-alert.
    if (prev && prev.at_risk) return;

    let teacherId = null;
    if (sectionId) {
      const { data: section } = await supabase
        .from('class_sections')
        .select('homeroom_teacher_id')
        .eq('id', sectionId)
        .maybeSingle();
      teacherId = section?.homeroom_teacher_id || null;
    }
    if (!teacherId) return;

    const studentName = summary.student?.full_name || 'A student';
    // disengaged_pct is a 0-1 fraction in the DB; scale to percent for text.
    const pct = Math.round((Number(summary.disengaged_pct) || 0) * 100);
    const { error: nErr } = await supabase.from('notifications').insert({
      recipient_id: teacherId,
      scope: 'user',
      type: 'engagement',
      title: `${studentName} engagement concern`,
      body: `${studentName} has been disengaged in ${pct}% of today's session.`,
    });
    if (nErr) console.warn('[engagement] at-risk notification failed:', nErr.message);
  } catch (e) {
    console.error('[engagement] aggregation pipeline threw:', e);
  }
}

// ── Rolling risk scoring (fire-and-forget) ──────────────────────────────────
// Where the same-day summary answers "how did today go", the risk score
// answers "where is this student heading": a two-week rolling view over
// engagement_summaries, rebuilt on every tick right after the day
// summary, that teachers read on the dashboard risk panel
// (GET /api/engagement/risk, GET /api/engagement/trends).

// Lookback window: the target date + the 13 days before it. The fewer
// than 3 available days the data cannot support a trend, so the score
// stays null until then (low band, reason text says why).
const RISK_WINDOW_DAYS = 14;
const RISK_MIN_DAYS = 3;
// Band cutoffs. The 60 high cutoff is the same line the same-day
// summary uses (engagement_at_risk_threshold defaults to 0.60 in the
// 0008 migration), so "at risk today" and "high risk trend" mean the
// same intensity of disengagement.
const RISK_BAND_HIGH = 60;
const RISK_BAND_WATCH = 35;

// Pure math, no DB: build the risk columns from one student's ascending
// engagement_summaries rows inside the window (days WITH data only).
// Kept separate from the queries so the trends endpoint can reuse it
// for its compute-on-demand path. *_pct inputs are 0-1 fractions, the
// engagement_summaries storage scale.
function computeRiskStats(windowRows) {
  const n = windowRows.length;
  if (n < RISK_MIN_DAYS) {
    return {
      rolling: null,
      recent: null,
      slope: null,
      risk_score: null,
      risk_band: 'low',
      trigger_reason: `Not enough history yet (${n} day(s))`,
    };
  }

  const mean = (arr) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const rolling = mean(windowRows.map((r) => Number(r.disengaged_pct) || 0));
  const recent = mean(windowRows.slice(-3).map((r) => Number(r.disengaged_pct) || 0));

  // Ordinary least squares slope of disengaged_pct against the day
  // index (0, 1, 2, ...) over the available days: fraction per day.
  const yMean = rolling;
  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const y = Number(windowRows[i].disengaged_pct) || 0;
    num += (i - xMean) * (y - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den === 0 ? 0 : num / den;

  const level = 0.55 * rolling + 0.35 * recent;
  const trendFactor = Math.max(-1, Math.min(1, slope * 10));
  const riskScore = Math.round(Math.min(100, Math.max(0, level * 100 + 25 * trendFactor)));
  const riskBand = riskScore >= RISK_BAND_HIGH ? 'high' : riskScore >= RISK_BAND_WATCH ? 'watch' : 'low';

  const trendWord = slope > 0.005 ? 'worsening' : slope < -0.005 ? 'improving' : 'flat';
  // Fractions -> human text: whole-number percents, slope in
  // percentage points per day with 1 decimal.
  const slopeText = (Math.round(slope * 1000) / 10).toFixed(1);
  const triggerReason = `Two-week average ${Math.round(rolling * 100)}%, recent three days ${Math.round(recent * 100)}%, trend ${trendWord} (slope ${slopeText} points/day)`;

  return {
    rolling,
    recent,
    slope,
    risk_score: riskScore,
    risk_band: riskBand,
    trigger_reason: triggerReason,
  };
}

// Read one student's window, compute the stats and upsert today's row.
// Returns the stats; throws on DB failure so each caller decides how to
// degrade (the tick chain logs, the lazy loop skips, trends reports).
async function computeRiskForStudent(studentId, dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  start.setDate(start.getDate() - (RISK_WINDOW_DAYS - 1));

  const { data: windowRows, error } = await supabase
    .from('engagement_summaries')
    .select('date, disengaged_pct')
    .eq('student_id', studentId)
    .gte('date', localDateStr(start))
    .lte('date', dateStr)
    .order('date', { ascending: true });
  if (error) throw new Error(`risk window query failed: ${error.message}`);

  const stats = computeRiskStats(windowRows || []);

  const { error: upErr } = await supabase
    .from('engagement_risk_scores')
    .upsert({
      student_id: studentId,
      date: dateStr,
      window_days: RISK_WINDOW_DAYS,
      rolling_disengaged: stats.rolling,
      recent_disengaged: stats.recent,
      trend_slope: stats.slope,
      risk_score: stats.risk_score,
      risk_band: stats.risk_band,
      trigger_reason: stats.trigger_reason,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,date,window_days' });
  if (upErr) throw new Error(`risk upsert failed: ${upErr.message}`);

  return stats;
}

// Rolling risk score + the cross-day trend alert. Called from the bridge
// tick chain right after aggregateEngagementForStudent, so it inherits
// the same fire-and-forget discipline: it runs inside its own try/catch,
// every failure logs, and nothing it does can reach the attendance
// response.
async function updateRiskScore(studentId, dateStr) {
  try {
    if (!supabase) return;
    const stats = await computeRiskForStudent(studentId, dateStr);

    // The alert marks the DAY the trend first crosses the high line: a
    // watch -> high flip fires once, a high -> high day stays silent.
    if (stats.risk_band !== 'high') return;
    const { data: prior } = await supabase
      .from('engagement_risk_scores')
      .select('risk_band')
      .eq('student_id', studentId)
      .lt('date', dateStr)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior && prior.risk_band === 'high') return;

    // Recipient is the homeroom teacher ONLY, never an admin copy
    // (explicit user decision 2026-10-21).
    const { data: student } = await supabase
      .from('students')
      .select('full_name, class_section:class_sections(homeroom_teacher_id)')
      .eq('id', studentId)
      .maybeSingle();
    const teacherId = student?.class_section?.homeroom_teacher_id || null;
    if (!teacherId) return; // no homeroom teacher on the section: skip silently

    const name = student?.full_name || 'A student';
    const { error: nErr } = await supabase.from('notifications').insert({
      recipient_id: teacherId,
      scope: 'user',
      type: 'engagement',
      title: `${name} at-risk trend`,
      body: `${stats.trigger_reason}. Their two-week engagement trend has crossed the high-risk line.`,
    });
    if (nErr) console.warn('[risk] trend notification failed:', nErr.message);
  } catch (e) {
    console.error('[risk] updateRiskScore threw:', e);
  }
}

// Sample one payload's emotion-carrying detections into engagement_records,
// then aggregate every sampled student for the date. One record per student
// per tick (a duplicated face match in the same payload must not double-
// weight a sample). Fire-and-forget.
async function persistEngagementBatch(detections, classroomId, dateStr) {
  if (!supabase) return;
  const sampled = new Map(); // student_id -> resolved students row
  try {
    for (const det of detections) {
      if (!det || !det.emotion) continue;
      const student = await resolveEngagementStudent(det);
      if (!student || sampled.has(student.id)) continue;
      sampled.set(student.id, student);
      const { error: engErr } = await supabase
        .from('engagement_records')
        .insert({
          student_id: student.id,
          date: dateStr,
          emotion: det.emotion,
          engagement_state: det.engagement_state || 'attentive',
          confidence: det.emotion_confidence || null,
          classroom_id: classroomId || null,
        });
      if (engErr) {
        console.warn(`[engagement] record insert failed for ${student.full_name}:`, engErr.message);
      }
    }
    if (sampled.size === 0) return;
    console.log(`[engagement] sampled ${sampled.size} student(s) for ${dateStr}`);
    for (const sid of sampled.keys()) {
      await aggregateEngagementForStudent(sid, dateStr);
      // Rolling two-week risk + the cross-day trend alert, rebuilt on
      // the same data the summary just landed. Fire-and-forget like the
      // aggregation step: updateRiskScore catches everything itself.
      await updateRiskScore(sid, dateStr);
    }
  } catch (e) {
    console.error('[engagement] batch persistence threw:', e);
  }
}

const VALID_ROLES = ['admin', 'teacher', 'parent'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── API ROUTES ───────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  // Piggyback the midnight rollover on the dashboard's 5-second health poll
  // so the day resets promptly even when no detections are coming in.
  resetIfNewDay();
  res.json({
    status: 'ok',
    aiStatus: liveData.aiStatus,
    lastUpdate: liveData.lastUpdate,
    studentsTracked: liveData.attendanceToday.length,
    uptimeSeconds: Math.floor(process.uptime()),
    supabaseEnabled: Boolean(supabase),
  });
});

// GET: Fetch all live data (for React dashboard polling). Staff-only:
// parents must not see the school-wide live feed.
app.get('/api/attendance', requireStaff, (req, res) => {
  res.json(liveData);
});

// POST: Receive attendance data from Python AI — guarded by the shared
// AI_BRIDGE_KEY secret (X-API-Key header), not a user JWT.
app.post('/api/attendance', requireBridgeKey, async (req, res) => {
  // Roll the day over first — otherwise a detection just after midnight would
  // be dropped as a duplicate of yesterday's check-in.
  resetIfNewDay();

  const { timestamp, detections, classroom_id } = req.body;

  if (!detections || !Array.isArray(detections)) {
    return res.status(400).json({ error: 'Invalid payload. Expected "detections" array.' });
  }

  // Late cutoff from the Admin Panel's settings row (cached, fail-safe).
  const settings = await getAppSettings();
  const [cutH, cutM] = String(settings.late_cutoff || SETTINGS_DEFAULTS.late_cutoff)
    .split(':').map(Number);
  const lateHour = Number.isFinite(cutH) ? cutH : 8;
  const lateMinute = Number.isFinite(cutM) ? cutM : 0;

  liveData.aiStatus = 'online';
  liveData.lastUpdate = timestamp || new Date().toISOString();

  // Collect detections that are NEW this request (not already in presentToday).
  // We persist only these to Supabase to avoid hammering the DB with re-upserts
  // on the same student across the SEND_INTERVAL ticks from the Python loop.
  const freshDetections = [];

  for (const det of detections) {
    const studentKey = det.student_name;

    // Synthetic engagement-only rows (engagement_only: true, emitted by
    // the Python edge's 60-second absence rule) are NOT real camera
    // sightings: they must never mark attendance or push a live-feed
    // row. The engagement sampler below still reads them (their
    // engagement_state 'no_face' is a real sample), so the skip lives
    // ONLY in this attendance pass.
    if (det.engagement_only === true) continue;

    // Skip if already marked present today
    if (presentToday.has(studentKey)) continue;
    presentToday.add(studentKey);

    // Determine status based on time vs. the configured late cutoff. Strict
    // minute compare keeps the old hardcoded 08:00 rule's behaviour exactly.
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isLate = (hour > lateHour) || (hour === lateHour && minute > lateMinute);
    const status = isLate ? 'late' : 'present';

    const timeIn = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Year/class start null on purpose: the AI payload's student_year is
    // hardcoded to 1 Python-side, so it is never trusted. The async DB
    // resolution below patches the row with the real students.year_num +
    // class_sections.name as soon as it lands (Camera renders empty until
    // then, which is honest).
    liveData.attendanceToday.push({
      studentId: liveData.attendanceToday.length + 1,
      name: det.student_name,
      year: null,
      class: null,
      status: status,
      timeIn: timeIn,
      timeOut: '-',
      similarity: det.similarity_score,
      studentUuid: det.student_uuid || null, // set by UUID-based enrollments (#18)
    });

    console.log(`[✓] ${det.student_name} → ${status.toUpperCase()} at ${timeIn} (similarity: ${det.similarity_score})`);

    // Remember this fresh detection for the async DB write below
    freshDetections.push({ det, status, now });
  }

  // ── Respond to Python immediately ────────────────────────────────────────
  // Existing response shape preserved — Python logs `totalPresent` from this.
  res.json({
    success: true,
    message: `Processed ${detections.length} detection(s)`,
    totalPresent: presentToday.size,
  });

  // ── Persist to Supabase (fire-and-forget) ────────────────────────────────
  // Runs AFTER the response is sent so the Python POST returns fast. A failure
  // here only logs — it never crashes the response or the in-memory store.
  if (!supabase || freshDetections.length === 0) return;

  (async () => {
    for (const { det, status, now } of freshDetections) {
      try {
        // 1) Strip any trailing "(...)" suffix from the name. The Python script
        //    already splits it before sending, but we defensively strip here so
        //    the bridge is robust to either form.
        const bareName = (det.student_name || '')
          .replace(/\s*\([^)]*\)\s*$/, '')
          .trim();

        if (!bareName || bareName.toLowerCase() === 'unknown') {
          continue;
        }

        let student = null;

        // 2) UUID-first resolution (#18): new enrollments carry the students.id
        //    straight through the camera payload, which is exact even when
        //    several students share a name. Only fall back to name matching
        //    when the UUID is missing (old enrollments) or doesn't resolve.
        const detUuid = String(det.student_uuid || '').trim();
        if (detUuid) {
          const { data: byUuid, error: uuidErr } = await supabase
            .from('students')
            .select('id, year_num, class_section:class_sections(name, year_num)')
            .eq('id', detUuid)
            .maybeSingle();
          if (uuidErr) {
            console.warn(`[Supabase] UUID lookup error for ${detUuid}:`, uuidErr.message);
          } else if (byUuid) {
            student = byUuid;
            console.log(`[Supabase] "${bareName}" resolved by student_uuid → ${student.id}`);
          } else {
            console.warn(`[Supabase] student_uuid ${detUuid} not found — falling back to name lookup for "${bareName}"`);
          }
        }

        // 3) Name-based fallback: look up the student by full_name
        //    (case-insensitive), together with the REAL year + class section —
        //    the DB row is the source of truth for both (the AI payload
        //    hardcodes student_year to 1).
        if (!student) {
          const { data: matches, error: lookupErr } = await supabase
            .from('students')
            .select('id, year_num, class_section:class_sections(name, year_num)')
            .ilike('full_name', bareName);

          if (lookupErr) {
            console.warn(`[Supabase] Lookup error for "${bareName}":`, lookupErr.message);
            continue;
          }
          if (!matches || matches.length === 0) {
            console.warn(`[Supabase] No student match for "${bareName}" — skipping`);
            continue;
          }

          student = matches[0];
          if (matches.length > 1) {
            // 3a) Same-name disambiguation: the Python payload's student_class
            //     is the enrolled class name, so use it to pick among namesakes.
            //     Still ambiguous (same name AND same class, or no class info)
            //     → warn and skip: guessing would mark the wrong child present.
            const detClass = (det.student_class || '').trim().toLowerCase();
            const byClass = detClass
              ? matches.filter((m) => (m.class_section?.name || '').trim().toLowerCase() === detClass)
              : [];
            if (byClass.length === 1) {
              student = byClass[0];
              console.log(`[Supabase] "${bareName}" matched ${matches.length} students — resolved by class "${det.student_class}"`);
            } else {
              console.warn(
                `[Supabase] Ambiguous name "${bareName}": ${matches.length} students share it` +
                (detClass
                  ? ` and ${byClass.length} match class "${det.student_class}"`
                  : ' and the payload carries no class info') +
                ' — skipping detection'
              );
              continue;
            }
          }
        }

        // 4) Patch the in-memory row the Camera renders with the real
        //     year + class name (it was pushed with nulls above). Match on
        //     the raw detection name — that is what the row was created with.
        const memRow = liveData.attendanceToday.find((r) => r.name === det.student_name);
        if (memRow) {
          memRow.year = student.year_num ?? null;
          memRow.class = student.class_section?.name || null;
        }

        // 5) Honest notes label: 'Year N <ClassName>' from the resolved
        //     section, falling back to the POSTed classroom_id, then 'camera'
        //     (the old notes claimed the hardcoded CLASS_1A style id was the
        //     detection source even when it was not a real section).
        const realClassLabel = student.class_section?.name
          ? `Year ${student.class_section.year_num} ${student.class_section.name}`
          : (classroom_id || 'camera');

        // 6) Build date + arrival time — both in LOCAL time. toISOString()
        //    is UTC, which would file pre-8AM MYT detections under yesterday.
        const isoDate = localDateStr(now);                         // YYYY-MM-DD (local)
        const arrivalTime = now.toTimeString().slice(0, 8);        // HH:MM:SS

        // 7) Upsert into attendance_records (unique on student_id,date)
        const { error: upsertErr } = await supabase
          .from('attendance_records')
          .upsert({
            student_id: student.id,
            date: isoDate,
            status,
            arrival_time: arrivalTime,
            marked_by: null, // AI-driven, no human authenticator
            marked_at: now.toISOString(),
            notes: `AI detection from ${realClassLabel}`,
          }, { onConflict: 'student_id,date' });

        if (upsertErr) {
          console.error(`[Supabase] Upsert failed for ${bareName}:`, upsertErr.message);
          continue; // skip fanout if the underlying record didn't land
        }
        console.log(`[Supabase] ✓ ${bareName} marked ${status} at ${arrivalTime}`);

        // ── Notification fanout ──────────────────────────────────────────
        // Insert one notification row per recipient (homeroom teacher +
        // each linked parent). Fully isolated in its own try/catch so a
        // fanout failure never affects the attendance write or the loop.
        try {
          const { data: ctx, error: ctxErr } = await supabase
            .from('students')
            .select('full_name, class_section:class_sections(homeroom_teacher_id), parent_links:parent_students(parent_id)')
            .eq('id', student.id)
            .maybeSingle();

          if (ctxErr) {
            console.warn('[notification fanout] context lookup failed:', ctxErr.message);
          } else if (ctx) {
            const recipients = new Set();
            if (ctx.class_section?.homeroom_teacher_id) {
              recipients.add(ctx.class_section.homeroom_teacher_id);
            }
            (ctx.parent_links || []).forEach((link) => {
              if (link.parent_id) recipients.add(link.parent_id);
            });

            if (recipients.size > 0) {
              const title = `${ctx.full_name} marked ${status}`;
              const body = `AI face recognition detected ${ctx.full_name} at ${arrivalTime} on ${isoDate}.`;
              const rows = Array.from(recipients).map((rid) => ({
                recipient_id: rid,
                scope: 'user',
                type: 'attendance',
                title,
                body,
              }));

              const { error: nErr } = await supabase.from('notifications').insert(rows);
              if (nErr) {
                console.warn('[notification fanout] insert failed:', nErr.message);
              }
            }
          }
        } catch (e) {
          console.error('[notification fanout] threw:', e);
        }
      } catch (e) {
        console.error('[Supabase] Unexpected error while persisting detection:', e);
      }
    }
  })();

  // ── Engagement capture (fire-and-forget) ────────────────────────────
  // Runs on EVERY tick, not just first sightings: session percentages are
  // built from continuous emotion samples, so the attendance dedup
  // (presentToday) must not throttle this path. Skipped silently when the
  // payload carries no emotions (legacy Python) or Supabase is off.
  if (detections.some((d) => d && d.emotion)) {
    persistEngagementBatch(detections, classroom_id, localDateStr(new Date()))
      .catch((e) => console.error('[engagement] batch rejected:', e));
  }
});

// GET /api/engagement/summary?date=YYYY-MM-DD — day-level engagement
// summaries for the Dashboard. Staff-only. The server queries with the
// service key, so RLS cannot scope the rows: teachers are filtered by hand
// to the class sections they may touch (teacher_class_ids: homeroom UNION
// taught years, the same rule the database enforces on teacher clients).
// Admins get the whole school for the date.
app.get('/api/engagement/summary', requireStaff, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // ?date=YYYY-MM-DD (optional, defaults to today, LOCAL calendar day).
  // A malformed date is a client bug: reject it instead of silently
  // returning today's rows.
  const dateStr = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : null;
  if (req.query.date && !dateStr) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const day = dateStr || localDateStr(new Date());

  try {
    // class_section_id rides along in the join so teacher rows can be
    // filtered in JS (avoids PostgREST alias-vs-filter ambiguity).
    const { data, error } = await supabase
      .from('engagement_summaries')
      .select('student_id, attentive_pct, disengaged_pct, at_risk, dominant_emotion, student:students(full_name, class_section_id, class_section:class_sections(name))')
      .eq('date', day);
    if (error) {
      console.error('[engagement] summary query failed:', error.message);
      return res.status(500).json({ error: 'Failed to load engagement summaries' });
    }

    let rows = data || [];

    if (req.actor.role === 'teacher') {
      // Service-key query: resolve the sections this teacher may see, then
      // scope manually (RLS is bypassed by the service key).
      const { data: classIds, error: tcErr } = await supabase
        .rpc('teacher_class_ids', { uid: req.actor.id });
      if (tcErr) {
        console.error('[engagement] teacher_class_ids failed:', tcErr.message);
        return res.status(500).json({ error: 'Failed to resolve teacher classes' });
      }
      const ids = (Array.isArray(classIds) ? classIds : []).filter(Boolean);
      if (ids.length === 0) return res.json([]); // teacher with no sections
      rows = rows.filter((r) => ids.includes(r.student?.class_section_id));
    }

    const summaries = rows.map((row) => ({
      student_id: row.student_id,
      student_name: row.student?.full_name || null,
      class_name: row.student?.class_section?.name || null,
      // Response boundary only: DB stores the *_pct columns as 0-1
      // fractions, but the UI renders these keys as 0-100 percentages.
      attentive_pct: Math.round((Number(row.attentive_pct) || 0) * 100),
      disengaged_pct: Math.round((Number(row.disengaged_pct) || 0) * 100),
      at_risk: row.at_risk,
      dominant_emotion: row.dominant_emotion,
    }));
    return res.json(summaries);
  } catch (e) {
    console.error('[engagement] summary endpoint threw:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/engagement/risk?date=YYYY-MM-DD: one day's rolling two-week
// risk scores per student (computed by updateRiskScore in the tick
// chain). Staff-only. Same service-key + teacher_class_ids + JS filter
// scoping as /api/engagement/summary: the server queries with the
// service key, so RLS cannot scope the rows. If no risk rows exist for
// the date yet, they are built lazily for every student that has an
// engagement summary that day: sequential, one student at a time, each
// failure logged and skipped so one bad student cannot block a class.
app.get('/api/engagement/risk', requireStaff, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const dateStr = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : null;
  if (req.query.date && !dateStr) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const day = dateStr || localDateStr(new Date());

  try {
    const { data: existing, error: exErr } = await supabase
      .from('engagement_risk_scores')
      .select('id')
      .eq('date', day)
      .limit(1);
    if (exErr) {
      console.error('[risk] probe query failed:', exErr.message);
      return res.status(500).json({ error: 'Failed to load risk scores' });
    }

    if (!existing || existing.length === 0) {
      // First read of the day: score every student with an engagement
      // summary for the date. Bounded by that day's roster, sequential
      // by design (one query per student), failures skipped.
      const { data: summaries, error: sumErr } = await supabase
        .from('engagement_summaries')
        .select('student_id')
        .eq('date', day);
      if (sumErr) {
        console.error('[risk] summary lookup failed:', sumErr.message);
        return res.status(500).json({ error: 'Failed to load engagement summaries' });
      }
      const studentIds = [...new Set((summaries || []).map((s) => s.student_id))];
      for (const sid of studentIds) {
        try {
          await computeRiskForStudent(sid, day);
        } catch (e) {
          console.error(`[risk] lazy compute failed for ${sid}:`, e.message);
        }
      }
    }

    const { data: rows, error } = await supabase
      .from('engagement_risk_scores')
      .select('student_id, risk_score, risk_band, rolling_disengaged, recent_disengaged, trend_slope, student:students(full_name, class_section_id, class_section:class_sections(name))')
      .eq('date', day);
    if (error) {
      console.error('[risk] query failed:', error.message);
      return res.status(500).json({ error: 'Failed to load risk scores' });
    }

    let list = rows || [];

    if (req.actor.role === 'teacher') {
      // Service-key query: resolve the sections this teacher may see,
      // then scope manually (RLS is bypassed by the service key).
      const { data: classIds, error: tcErr } = await supabase
        .rpc('teacher_class_ids', { uid: req.actor.id });
      if (tcErr) {
        console.error('[risk] teacher_class_ids failed:', tcErr.message);
        return res.status(500).json({ error: 'Failed to resolve teacher classes' });
      }
      const ids = (Array.isArray(classIds) ? classIds : []).filter(Boolean);
      if (ids.length === 0) return res.json([]); // teacher with no sections
      list = list.filter((r) => ids.includes(r.student?.class_section_id));
    }

    // days_of_data is not a stored column: count the student's
    // engagement summaries inside the same 14-day window (one grouped
    // query for the whole response). A count failure only degrades this
    // one field, so it logs instead of failing the endpoint.
    const winStart = new Date(`${day}T00:00:00`);
    winStart.setDate(winStart.getDate() - (RISK_WINDOW_DAYS - 1));
    const { data: winRows, error: winErr } = await supabase
      .from('engagement_summaries')
      .select('student_id')
      .gte('date', localDateStr(winStart))
      .lte('date', day);
    const dayCounts = new Map();
    if (winErr) {
      console.error('[risk] window count failed:', winErr.message);
    } else {
      for (const r of winRows || []) {
        dayCounts.set(r.student_id, (dayCounts.get(r.student_id) || 0) + 1);
      }
    }

    const out = list.map((row) => ({
      student_id: row.student_id,
      student_name: row.student?.full_name || null,
      class_name: row.student?.class_section?.name || null,
      risk_score: row.risk_score, // null while history is under 3 days
      risk_band: row.risk_band,
      // Response boundary: the DB stores 0-1 fractions and a
      // fraction-per-day slope; the UI gets 0-100 integers and
      // percentage points per day (same conversion as the summary
      // endpoint, where a missing fraction reads as 0).
      rolling_disengaged: Math.round((Number(row.rolling_disengaged) || 0) * 100),
      recent_disengaged: Math.round((Number(row.recent_disengaged) || 0) * 100),
      trend_slope: Math.round((Number(row.trend_slope) || 0) * 1000) / 10,
      days_of_data: dayCounts.get(row.student_id) || 0,
    }));
    return res.json(out);
  } catch (e) {
    console.error('[risk] endpoint threw:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/engagement/trends?student_id=&days=30: one student's daily
// disengagement line plus their latest risk verdict. Staff-only;
// teachers only their own students (403 otherwise), admins unrestricted.
app.get('/api/engagement/trends', requireStaff, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const studentId = typeof req.query.student_id === 'string' ? req.query.student_id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) {
    return res.status(400).json({ error: 'student_id must be a UUID' });
  }

  // days is clamped into 1..90 so a bad client cannot pull an
  // unbounded history dump.
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));

  try {
    if (req.actor.role === 'teacher') {
      // Service key bypasses RLS, so the membership check the database
      // would enforce on a teacher client is done by hand here.
      const { data: classIds, error: tcErr } = await supabase
        .rpc('teacher_class_ids', { uid: req.actor.id });
      if (tcErr) {
        console.error('[trends] teacher_class_ids failed:', tcErr.message);
        return res.status(500).json({ error: 'Failed to resolve teacher classes' });
      }
      const ids = (Array.isArray(classIds) ? classIds : []).filter(Boolean);
      const { data: stu, error: sErr } = await supabase
        .from('students')
        .select('class_section_id')
        .eq('id', studentId)
        .maybeSingle();
      if (sErr) {
        console.error('[trends] student lookup failed:', sErr.message);
        return res.status(500).json({ error: 'Failed to load student' });
      }
      if (!stu || !ids.includes(stu.class_section_id)) {
        return res.status(403).json({ error: 'Student not in your classes' });
      }
    }

    const today = localDateStr(new Date());
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - (days - 1));

    const { data: rows, error } = await supabase
      .from('engagement_summaries')
      .select('date, disengaged_pct, at_risk')
      .eq('student_id', studentId)
      .gte('date', localDateStr(start))
      .lte('date', today)
      .order('date', { ascending: true });
    if (error) {
      console.error('[trends] summaries query failed:', error.message);
      return res.status(500).json({ error: 'Failed to load engagement summaries' });
    }

    // Latest verdict: the most recent stored risk row wins. A student
    // with no risk row at all (new to the pipeline) gets today's
    // computed on demand so the panel is never blank while they are
    // actively being sampled. No alert side effects here: the alert
    // belongs to the tick chain only.
    const { data: latestRow } = await supabase
      .from('engagement_risk_scores')
      .select('risk_score, risk_band, trigger_reason')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    let latest = latestRow || null;
    if (!latest) {
      try {
        latest = await computeRiskForStudent(studentId, today);
      } catch (e) {
        console.error('[trends] on-demand risk compute failed:', e.message);
      }
    }

    return res.json({
      days: (rows || []).map((r) => ({
        date: r.date,
        // 0-1 fraction in the DB, 0-100 integer on the wire (same
        // boundary conversion as the summary endpoint).
        disengaged_pct: Math.round((Number(r.disengaged_pct) || 0) * 100),
        at_risk: r.at_risk,
      })),
      latest: latest
        ? {
            risk_score: latest.risk_score,
            risk_band: latest.risk_band,
            trigger_reason: latest.trigger_reason,
          }
        : null,
    });
  } catch (e) {
    console.error('[trends] endpoint threw:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: User Management ───────────────────────────────────────────────────
// Backs the Admin Panel's Add / Edit / Delete user controls. All three require
// the caller to be authenticated AND hold role==='admin'. Every successful
// mutation appends an entry to audit_logs (fire-and-forget).

// POST /api/admin/users — create a new user directly (defect S1).
// Body: { email, full_name, role, phone?, password? }
// The old inviteUserByEmail flow failed for every address because no SMTP is
// configured on this project ('Email address ... is invalid'), so the user is
// created directly instead: email confirmed at creation, password set here.
// The password comes from the request body when supplied; otherwise a strong
// random one is generated and returned once (temporary_password) so the admin
// can hand it to the user.
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { email, full_name, role, phone, password } = req.body || {};

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return res.status(400).json({ error: 'full_name is required' });
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
  }
  if (phone != null && typeof phone !== 'string') {
    return res.status(400).json({ error: 'phone must be a string' });
  }
  // Optional explicit password (Supabase's default minimum is 6 characters);
  // validated here so a weak attempt fails fast with 400 instead of a
  // Supabase error surfacing as 500.
  if (password != null && (typeof password !== 'string' || password.length < 6)) {
    return res.status(400).json({ error: 'password must be a string of at least 6 characters' });
  }

  const cleanEmail = email.trim();
  const cleanName = full_name.trim();
  const initialPassword = password || crypto.randomBytes(18).toString('base64url');

  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: initialPassword,
      // Confirmed at creation: no invite email is ever sent (no SMTP on this
      // project), so the user can sign in with the handed-over password right
      // away.
      email_confirm: true,
      user_metadata: { full_name: cleanName, role },
    });

    if (createErr) {
      const msg = (createErr.message || '').toLowerCase();
      // Supabase surfaces duplicate-email cases via several phrasings — match liberally.
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        createErr.status === 422
      ) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      console.error('[admin/users] create failed:', createErr);
      return res.status(500).json({ error: createErr.message || 'Create user failed' });
    }

    const createdUser = created?.user;
    if (!createdUser?.id) {
      return res.status(500).json({ error: 'Create user returned no user' });
    }

    // The handle_new_user trigger has already inserted a profile row. If a phone
    // was supplied, patch it in. Non-fatal if this fails — the user still exists.
    if (phone && phone.trim()) {
      const { error: phoneErr } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', createdUser.id);
      if (phoneErr) {
        console.warn('[admin/users] phone update failed:', phoneErr.message);
      }
    }

    res.status(201).json({
      id: createdUser.id,
      email: createdUser.email || cleanEmail,
      full_name: cleanName,
      role,
      // Echo the generated password back once, only when the server chose it
      // (an admin-supplied password is already known to its owner).
      ...(password ? {} : { temporary_password: initialPassword }),
    });

    logAudit(req.actor.id, 'user.invite', createdUser.id, {
      email: cleanEmail,
      full_name: cleanName,
      role,
    });
  } catch (e) {
    console.error('[admin/users] unexpected error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/users/:id — update profile fields.
// Body may include any of: full_name, role, phone, avatar_url.
app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  const { full_name, role, phone, avatar_url, email } = req.body || {};

  const updates = {};
  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({ error: 'full_name must be a non-empty string' });
    }
    updates.full_name = full_name.trim();
  }
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
    }
    updates.role = role;
  }
  if (phone !== undefined) {
    if (phone !== null && typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone must be a string or null' });
    }
    updates.phone = phone === null ? null : phone.trim();
  }
  if (avatar_url !== undefined) {
    if (avatar_url !== null && typeof avatar_url !== 'string') {
      return res.status(400).json({ error: 'avatar_url must be a string or null' });
    }
    updates.avatar_url = avatar_url;
  }

  // Email change is handled separately — it lives on auth.users, not profiles.
  // We use the admin API with email_confirm:true so the change takes effect
  // immediately without making the user click a re-confirmation link.
  let newEmail = null;
  if (email !== undefined && email !== null && typeof email === 'string') {
    const trimmed = email.trim();
    if (trimmed && EMAIL_RE.test(trimmed)) {
      newEmail = trimmed;
    } else if (trimmed) {
      return res.status(400).json({ error: 'email is not a valid address' });
    }
  }

  if (Object.keys(updates).length === 0 && !newEmail) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  try {
    // First, update auth.users.email if the email changed.
    if (newEmail) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', targetId)
        .maybeSingle();
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }
      const { error: emailErr } = await supabase.auth.admin.updateUserById(
        targetId,
        { email: newEmail, email_confirm: true }
      );
      if (emailErr) {
        const msg = (emailErr.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('duplicate')) {
          return res.status(409).json({ error: 'Email already in use by another account' });
        }
        console.error('[admin/users PATCH email] failed:', emailErr);
        return res.status(500).json({ error: emailErr.message || 'Email update failed' });
      }
    }

    // Now patch profiles for the non-email fields.
    let updatedProfile = null;
    if (Object.keys(updates).length > 0) {
      const { data: updated, error: upErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', targetId)
        .select()
        .maybeSingle();
      if (upErr) {
        console.error('[admin/users PATCH] failed:', upErr);
        return res.status(500).json({ error: upErr.message || 'Update failed' });
      }
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      updatedProfile = updated;
    } else {
      // Email-only change — re-read the profile for the response payload.
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();
      updatedProfile = data;
    }

    res.json({ ...(updatedProfile || {}), email: newEmail || undefined });
    logAudit(req.actor.id, 'user.update', targetId, {
      changes: updates,
      email_changed: newEmail || undefined,
    });
  } catch (e) {
    console.error('[admin/users PATCH] unexpected error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id — remove an auth user (profile cascades).
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;

  if (targetId === req.actor.id) {
    return res.status(400).json({ error: "Can't delete your own account" });
  }

  try {
    const { error: delErr } = await supabase.auth.admin.deleteUser(targetId);
    if (delErr) {
      const msg = (delErr.message || '').toLowerCase();
      if (msg.includes('not found') || delErr.status === 404) {
        return res.status(404).json({ error: 'User not found' });
      }
      console.error('[admin/users DELETE] failed:', delErr);
      return res.status(500).json({ error: delErr.message || 'Delete failed' });
    }

    res.json({ success: true });
    logAudit(req.actor.id, 'user.delete', targetId, {});
  } catch (e) {
    console.error('[admin/users DELETE] unexpected error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users/list — returns profiles joined with auth emails.
// Admin only. Used by the Admin Panel's User Management table.
app.get('/api/admin/users/list', requireAdmin, async (req, res) => {
  try {
    // 1. Fetch all profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, avatar_url, created_at, updated_at');
    if (pErr) return res.status(500).json({ error: pErr.message });

    // 2. Page through auth.users via admin API to build an id→email map
    const emailById = new Map();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) return res.status(500).json({ error: error.message });
      for (const u of data.users) emailById.set(u.id, u.email);
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 50) break; // safety: 50,000 users max
    }

    // 3. Merge
    const merged = (profiles || []).map(p => ({
      ...p,
      email: emailById.get(p.id) || null,
    }));
    res.json(merged);
  } catch (e) {
    console.error('[admin/users/list] failed:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── AI Process Management ────────────────────────────────────────────────────
// Lets the Live Camera page start/stop the Python face-recognition service
// without dropping to a terminal. The state reported here is "is THIS Express
// process supervising a Python child?" — distinct from /api/health which only
// reports whether Python has POSTed detections recently.

// GET /api/ai/process — current process supervision state. Staff-only: the
// Camera page sends the signed-in user's JWT; the mutating endpoints below
// are gated more tightly still.
// If our own child is gone but port 5174 is still occupied, Python survived a
// server restart (orphan) — report running:true with an explanatory note so
// the UI can offer the force-kill endpoint instead of a dead "Start" button.
app.get('/api/ai/process', requireStaff, async (req, res) => {
  const running = !!(aiProcess && aiProcess.exitCode === null);
  const settings = await getAppSettings(); // cached, fail-safe defaults
  const baseState = {
    startedAt: aiStartedAt,
    lastExitCode: aiLastExitCode,
    lastExitAt: aiLastExitAt,
    lastError: aiLastError,
    // Crash auto-restart state: the admin toggle plus how many auto-restart
    // attempts still count against the circuit breaker's rolling window.
    autorestart_enabled: !!settings.autorestart_ai,
    autorestarts_recent: recentAutoRestartCount(),
  };
  if (running) {
    return res.json({ running, orphan: false, pid: aiProcess.pid, ...baseState });
  }
  // No supervised child — is an orphan holding the AI stream port?
  findPortPid(AI_PORT, (portPid) => {
    if (portPid) {
      return res.json({
        running: true,
        orphan: true,
        pid: portPid,
        ...baseState,
        note: `Port ${AI_PORT} is held by PID ${portPid} from a previous server run (orphaned AI process). Use DELETE /api/ai/process to kill it.`,
      });
    }
    return res.json({ running: false, orphan: false, pid: null, ...baseState });
  });
});

// GET /api/ai/enrolled — list face-enrollment status (read from enrolled_students.json)
// Returns: { enrolled: [{ name, class, enrolled_at }, ...] }
// Staff-only (admin/teacher): biometric enrollment status should
// not be world-readable now that the frontend hooks send the JWT anyway.
app.get('/api/ai/enrolled', requireStaff, (req, res) => {
  try {
    const { aiDir } = aiPaths();
    const dbPath = path.join(aiDir, 'enrolled_students.json');
    if (!fs.existsSync(dbPath)) {
      return res.json({ enrolled: [] });
    }
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const json = JSON.parse(raw);
    const enrolled = (json.students || []).map(s => ({
      name: s.name,
      class: s.class,
      enrolled_at: s.enrolled_at,
    }));
    res.json({ enrolled });
  } catch (e) {
    console.error('[ai/enrolled] failed:', e);
    res.status(500).json({ error: 'Failed to read enrolled_students.json' });
  }
});

// DELETE /api/ai/enrolled/:name — remove one student's face embedding.
// Admin-only: this deletes biometric data. enrolled_students.json is keyed
// by name until enrollment moves to student UUIDs, so the (URL-encoded)
// name is the identifier here. A running AI keeps its in-memory copy until
// the next start — the response says so and the UI relays it.
app.delete('/api/ai/enrolled/:name', requireAdmin, (req, res) => {
  try {
    const target = (req.params.name || '').trim().toLowerCase();
    if (!target) return res.status(400).json({ error: 'Student name required' });
    const { aiDir } = aiPaths();
    const dbPath = path.join(aiDir, 'enrolled_students.json');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'No faces enrolled yet' });
    }
    const json = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const students = Array.isArray(json.students) ? json.students : [];
    const idx = students.findIndex(st => (st.name || '').trim().toLowerCase() === target);
    if (idx === -1) {
      return res.status(404).json({ error: 'That student has no enrolled face' });
    }
    const [removed] = students.splice(idx, 1);
    json.students = students;
    fs.writeFileSync(dbPath, JSON.stringify(json, null, 2), 'utf-8');
    logAudit(req.actor.id, 'face.unenroll', null, { name: removed.name });
    const aiRunning = !!(aiProcess && aiProcess.exitCode === null);
    return res.json({ success: true, name: removed.name, aiRunning });
  } catch (e) {
    console.error('[ai/unenroll] failed:', e);
    return res.status(500).json({ error: 'Failed to update enrolled_students.json' });
  }
});

// Shared spawn path for the AI child: POST /api/ai/start, POST /api/ai/restart
// and the crash auto-restart all go through this one function, so there is a
// single source of truth for the settings read, the spawn args, the ai.pid
// write, the stdout/stderr GPU scan and the exit handler. `req` is optional:
// HTTP callers pass it (the audit log needs req.actor), the auto-restart
// passes null. Throws an Error tagged with .status (and .pid when already
// running) so HTTP callers can reply with exactly the response shapes
// /api/ai/start has always produced: 409 already running, 500 missing
// venv/script. Resolves { pid, startedAt } on success.
async function startAiProcess(req) {
  if (aiProcess && aiProcess.exitCode === null) {
    const err = new Error('AI service already running');
    err.status = 409;
    err.pid = aiProcess.pid;
    throw err;
  }
  const { aiDir, pythonExe, script } = aiPaths();
  if (!fs.existsSync(pythonExe)) {
    const err = new Error(`Python venv not found at ${pythonExe}. Run "python -m venv venv" + "pip install -r requirements.txt" inside ai-service/edge first.`);
    err.status = 500;
    throw err;
  }
  if (!fs.existsSync(script)) {
    const err = new Error(`Script not found at ${script}`);
    err.status = 500;
    throw err;
  }

  // Detection size + match threshold come from the Admin Panel's settings
  // row (cached, fail-safe defaults), so the admin tunes them without code.
  const settings = await getAppSettings();
  console.log(`[AI] start: det_size=${settings.det_size} threshold=${settings.match_threshold}`);

  const child = spawn(pythonExe, [
    '-u', script,
    '--camera', '0',
    '--det-size', String(settings.det_size),
    '--threshold', String(settings.match_threshold),
    '--classroom', String(settings.classroom_label),
  ], {
    cwd: aiDir,
    windowsHide: false, // let the OpenCV window be visible
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Force UTF-8 stdout so Python doesn't crash trying to print
      // unicode arrows / em-dashes on Windows' default cp1252 codepage.
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    },
  });

  aiProcess = child;
  aiStartedAt = new Date().toISOString();
  aiLastExitCode = null;
  aiLastExitAt = null;
  aiLastError = null;

  // Persist the child PID so the NEXT server run can recognize (and reap)
  // this Python process if this Express process dies first (#15 zombies).
  try {
    fs.writeFileSync(aiPaths().pidPath, String(child.pid), 'utf-8');
  } catch (e) {
    console.warn('[AI] Could not write ai.pid:', e.message);
  }

  child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((l) => {
      console.log(`[AI:stdout] ${l}`);
      if (l.includes('GPU_REQUIRED')) aiLastError = GPU_REQUIRED_MSG;
    });
  });
  child.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((l) => {
      console.warn(`[AI:stderr] ${l}`);
      if (l.includes('GPU_REQUIRED')) aiLastError = GPU_REQUIRED_MSG;
    });
  });
  child.on('exit', (code, signal) => {
    console.log(`[AI] Python child exited code=${code} signal=${signal}`);
    aiLastExitCode = code;
    aiLastExitAt = new Date().toISOString();
    if (code === AI_EXIT_GPU_REQUIRED && !aiLastError) aiLastError = GPU_REQUIRED_MSG;
    if (aiProcess === child) aiProcess = null;
    clearAiPid(); // child is gone — the recorded PID is stale now
    // Crash auto-restart evaluates every exit; operator-driven exits are
    // filtered out inside (see scheduleCrashAutoRestart).
    scheduleCrashAutoRestart(code);
  });
  child.on('error', (err) => {
    console.error('[AI] Spawn error:', err);
    if (aiProcess === child) aiProcess = null;
  });

  if (req) logAudit(req.actor.id, 'ai.start', null, { pid: child.pid });
  return { pid: child.pid, startedAt: aiStartedAt };
}

// POST /api/ai/start — spawn the Python face-recognition service.
// The spawn itself lives in the shared startAiProcess() above, which the
// restart endpoint and the crash auto-restart reuse.
app.post('/api/ai/start', requireAdminOrTeacher, async (req, res) => {
  try {
    const { pid, startedAt } = await startAiProcess(req);
    return res.json({ success: true, pid, startedAt });
  } catch (e) {
    // Deliberate failures carry .status: reply with the same shapes as before
    // the shared-function refactor (409 already running, 500 missing files).
    if (e.status) return res.status(e.status).json(e.pid ? { error: e.message, pid: e.pid } : { error: e.message });
    console.error('[AI start] failed:', e);
    return res.status(500).json({ error: e.message || 'Failed to start AI service' });
  }
});

// Stop the supervised child and resolve once its exit handler has actually
// run. /api/ai/stop is fire-and-forget, but the restart flow must not spawn
// the replacement while the old child still holds the webcam and the stream
// port, so this waits for the real exit. Latches aiIntentionalStop first so
// the exit is never mistaken for a crash. Resolves false when nothing is
// running or the child ignored the kill for AI_STOP_GRACE_MS.
const AI_STOP_GRACE_MS = 10 * 1000;
function stopAiProcessAndWait() {
  return new Promise((resolve) => {
    if (!aiProcess || aiProcess.exitCode !== null) return resolve(false);
    const child = aiProcess;
    aiIntentionalStop = true; // consumed by the exit handler
    let settled = false;
    const finish = (stopped) => {
      if (settled) return;
      settled = true;
      clearTimeout(grace);
      resolve(stopped);
    };
    const grace = setTimeout(() => finish(false), AI_STOP_GRACE_MS);
    // The shared spawn registered its own exit handler first, so by the time
    // this fires, aiProcess is already cleared and the pid file removed.
    child.once('exit', () => finish(true));
    try {
      child.kill();
    } catch (e) {
      // The kill never landed: release the latch so a later crash can still
      // auto-restart, and report failure.
      aiIntentionalStop = false;
      console.error('[AI] restart: stop failed:', e.message);
      finish(false);
    }
  });
}

// POST /api/ai/restart — stop the running child (waiting for a real exit),
// then start a fresh one through the shared spawn path. With no child
// running it simply starts one: restart is an idempotent convenience.
// Admin/teacher, like start/stop.
app.post('/api/ai/restart', requireAdminOrTeacher, async (req, res) => {
  if (aiRestartInProgress) {
    return res.status(409).json({ error: 'A restart is already in progress' });
  }
  aiRestartInProgress = true;
  try {
    if (aiProcess && aiProcess.exitCode === null) {
      const stopped = await stopAiProcessAndWait();
      if (!stopped) {
        return res.status(500).json({ error: 'Existing AI process did not exit; try POST /api/ai/stop or DELETE /api/ai/process' });
      }
    }
    const { pid } = await startAiProcess(req);
    logAudit(req.actor.id, 'ai.restart', null, { pid });
    return res.json({ restarted: true, pid });
  } catch (e) {
    // startAiProcess tags its deliberate failures (.status), so restart
    // answers with the same shapes start would (409 running, 500 venv).
    if (e.status) return res.status(e.status).json(e.pid ? { error: e.message, pid: e.pid } : { error: e.message });
    console.error('[AI restart] failed:', e);
    return res.status(500).json({ error: e.message || 'Failed to restart AI service' });
  } finally {
    aiRestartInProgress = false;
  }
});

// POST /api/ai/stop — terminate the running Python child.
app.post('/api/ai/stop', requireAdminOrTeacher, (req, res) => {
  if (!aiProcess || aiProcess.exitCode !== null) {
    return res.status(404).json({ error: 'AI service is not running' });
  }
  const pid = aiProcess.pid;
  aiIntentionalStop = true; // the exit handler consumes this: an explicit stop never auto-restarts
  try {
    // On Windows, SIGTERM is mapped to a terminate; this typically works.
    // For really stuck cases the admin can fall back to the force-kill below.
    aiProcess.kill();
    clearAiPid(); // the exit handler removes it too — belt and braces
    logAudit(req.actor.id, 'ai.stop', null, { pid });
    return res.json({ success: true, pid });
  } catch (e) {
    aiIntentionalStop = false; // kill never landed: a later crash may still auto-restart
    console.error('[AI stop] failed:', e);
    return res.status(500).json({ error: e.message || 'Failed to stop AI service' });
  }
});

// DELETE /api/ai/process — force-kill whatever holds the AI stream port (#15).
// Admin-only. This is the zombie sweeper: after a server restart the orphaned
// Python child (from the dead server run) is not our aiProcess anymore, so
// /api/ai/stop can't reach it. We find its PID via netstat on the stream port
// and SIGTERM it directly. Our own child's exit handler cleans up its state
// when it is the one being killed.
app.delete('/api/ai/process', requireAdmin, (req, res) => {
  findPortPid(AI_PORT, (portPid) => {
    if (!portPid) {
      return res.status(404).json({ error: `No process found listening on port ${AI_PORT}` });
    }
    try {
      // When the target is our own supervised child, latch the intentional
      // stop first so its exit handler does not mistake this operator-driven
      // kill for a crash and respawn the process the admin just killed.
      // Orphans keep the flag untouched (no exit handler will fire for them).
      if (aiProcess && aiProcess.exitCode === null && aiProcess.pid === portPid) {
        aiIntentionalStop = true;
      }
      process.kill(portPid, 'SIGTERM');
      console.log(`[AI] Force-killed PID ${portPid} holding port ${AI_PORT} (by admin ${req.actor.id})`);
      logAudit(req.actor.id, 'ai.force_kill', null, { pid: portPid, port: AI_PORT });
      return res.json({ success: true, killed: portPid });
    } catch (e) {
      console.error(`[AI force-kill] failed for PID ${portPid}:`, e);
      return res.status(500).json({ error: e.message || `Failed to kill PID ${portPid}` });
    }
  });
});

// POST /api/ai/enroll — spawn the Python enrollment script for a specific student.
// Blocks for ~5–10s until the Python child exits; the response carries the result.
// Admin-only — we do NOT allow teachers here because enrollment writes face
// embeddings to enrolled_students.json, which is a sensitive operation.
app.post('/api/ai/enroll', requireAdmin, async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // Look up the student's name + class section name from Supabase
  const { data: student, error } = await supabase
    .from('students')
    .select('full_name, class_section:class_sections(name)')
    .eq('id', student_id)
    .maybeSingle();
  if (error || !student) return res.status(404).json({ error: 'Student not found' });

  // Server-side PDPA consent gate (defect L2: this legacy endpoint used to
  // trust the client for this). Mirrors /api/ai/enroll/session exactly: the
  // LATEST non-revoked biometric_consents row decides; a missing row counts
  // as pending and is refused too.
  const { data: consentRows, error: consentErr } = await supabase
    .from('biometric_consents')
    .select('granted')
    .eq('student_id', student_id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (consentErr) {
    console.error('[ai/enroll] consent lookup failed:', consentErr.message);
    return res.status(500).json({ error: 'Failed to check biometric consent' });
  }
  const consented = Array.isArray(consentRows) && consentRows.length > 0 && consentRows[0].granted === true;
  if (!consented) {
    return res.status(403).json({ error: 'Parent biometric consent not granted' });
  }

  // Don't allow concurrent enrollments alongside the recognition script.
  // Both grab the same webcam (/dev/video0) and would deadlock.
  if (aiProcess && aiProcess.exitCode === null) {
    return res.status(409).json({ error: 'Stop the AI service first before enrolling' });
  }

  const { aiDir, pythonExe } = aiPaths();
  const script = path.join(aiDir, 'enroll_student.py');
  if (!fs.existsSync(script)) return res.status(500).json({ error: 'Enrollment script missing' });

  const child = spawn(pythonExe, [
    '-u', script,
    '--name', student.full_name,
    '--class', student.class_section?.name || 'Unknown',
    // UUID bridge (#18): enroll_student.py stores this as student_uuid next to
    // the embedding, so detections can resolve students by id — unambiguous
    // even for namesakes — instead of falling back to name matching.
    '--student-id', String(student.id),
    '--camera', '0',
    // The admin picked this student deliberately, so a re-enrollment replaces
    // the stored embedding in place instead of tripping the duplicate guard
    // (the old interactive prompt crashed under stdio:'ignore' — EOFError).
    '--overwrite',
  ], {
    cwd: aiDir,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    const s = d.toString();
    stdout += s;
    s.split(/\r?\n/).filter(Boolean).forEach(l => console.log(`[AI:enroll:stdout] ${l}`));
  });
  child.stderr.on('data', (d) => {
    const s = d.toString();
    stderr += s;
    s.split(/\r?\n/).filter(Boolean).forEach(l => console.warn(`[AI:enroll:stderr] ${l}`));
  });

  child.on('exit', (code) => {
    if (code === 0) {
      logAudit(req.actor.id, 'face.enroll', student_id, { name: student.full_name });
      res.json({ success: true, message: `Enrolled ${student.full_name}` });
    } else {
      // Surface the GPU gate's refusal verbatim — "Enrollment failed" would
      // hide the real (hardware) reason from the admin.
      const gpuBlocked = code === AI_EXIT_GPU_REQUIRED || stderr.includes('GPU_REQUIRED');
      res.status(500).json({
        error: gpuBlocked ? GPU_REQUIRED_MSG : 'Enrollment failed',
        code,
        stderr: stderr.slice(-500),
      });
    }
  });
  child.on('error', (e) => res.status(500).json({ error: e.message }));
});

// ── Browser enrollment sessions (Phase 1) ────────────────────────────────
// In-browser enrollment: the admin's webcam (in the React page) captures the
// frames, this server relays them to a local headless Python helper
// (enroll_server.py) that holds InsightFace, and on completion this server
// writes enrolled_students.json itself. The classroom webcam (held by the
// face_recognition.py child) is NOT involved, so a session is deliberately
// ALLOWED while the recognition AI is running. The CLI fallback (POST
// /api/ai/enroll above) stays untouched for machines without the helper.

// Module-level single-session state: only one browser enrollment at a time.
let enrollSession = null; // { id, studentId, studentName, studentClass, child, port, startedAt }

// Matches enroll_student.py's default --captures (5). The helper announces
// the authoritative per-frame count; this is only what /api/ai/enroll/session
// returns so the UI can show a target before the first frame arrives.
const ENROLL_REQUIRED_CAPTURES = 5;

// enroll_server.py prints "ENROLL_READY port=<P>" on stdout once its HTTP
// server is listening, and refuses without CUDA/DirectML by printing
// GPU_REQUIRED and exiting with code 3 (same contract as the other AI
// children, mapped to the same user-facing message below).
const ENROLL_HELPER_START_TIMEOUT_MS = 45 * 1000;

// Serialize writes to enrolled_students.json through a promise chain. The CLI
// fallback (POST /api/ai/enroll) is the only other writer, and it can never
// overlap a browser session: it is refused while the recognition AI runs
// (409 rule), and this chain additionally orders concurrent completions.
let enrollJsonWriteChain = Promise.resolve();
function withEnrollJsonLock(fn) {
  const run = enrollJsonWriteChain.then(fn, fn);
  enrollJsonWriteChain = run.then(() => {}, () => {});
  return run;
}

// time.strftime("%Y-%m-%dT%H:%M:%S") equivalent in LOCAL time, the exact
// enrolled_at format enroll_student.py writes (toISOString would be UTC).
function localEnrollTimestamp(d) {
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return `${localDateStr(d)}T${t}`;
}

// If Express exits while a helper is up, take the helper down with it so no
// headless Python process outlives the server (the helper also idle-exits
// after 10 minutes on its own).
process.on('exit', () => {
  if (enrollSession && enrollSession.child.exitCode === null) {
    try { enrollSession.child.kill(); } catch (_) { /* best effort */ }
  }
});

// POST /api/ai/enroll/session - start a browser-enrollment session for one
// student. Admin-only, same reasoning as POST /api/ai/enroll: this path ends
// in face embeddings being written, which is a sensitive operation.
app.post('/api/ai/enroll/session', requireAdmin, async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // Look up the student's id, name + class section name from Supabase.
  const { data: student, error } = await supabase
    .from('students')
    .select('id, full_name, class_section:class_sections(name)')
    .eq('id', student_id)
    .maybeSingle();
  if (error || !student) return res.status(404).json({ error: 'Student not found' });

  // Server-side PDPA consent gate (the legacy CLI endpoint /api/ai/enroll
  // now enforces this identical gate). Mirrors the client rule in AdminPanel.jsx
  // (consentStatusFor(studentId) === 'granted'): the LATEST non-revoked
  // biometric_consents row decides; a missing row counts as pending and is
  // refused too.
  const { data: consentRows, error: consentErr } = await supabase
    .from('biometric_consents')
    .select('granted')
    .eq('student_id', student_id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (consentErr) {
    console.error('[ai/enroll-session] consent lookup failed:', consentErr.message);
    return res.status(500).json({ error: 'Failed to check biometric consent' });
  }
  const consented = Array.isArray(consentRows) && consentRows.length > 0 && consentRows[0].granted === true;
  if (!consented) {
    return res.status(403).json({ error: 'Parent biometric consent not granted' });
  }

  // One helper at a time. A session whose helper already died does not block
  // a new one; the frame endpoint clears the stale state on its next call.
  if (enrollSession && enrollSession.child.exitCode === null) {
    return res.status(409).json({ error: 'An enrollment session is already active' });
  }

  // Not blocked while the recognition AI runs: enrollment uses the admin's
  // browser camera, not the classroom webcam the AI child holds.

  const settings = await getAppSettings(); // det_size from Admin settings (cached, fail-safe default 320)
  const { aiDir, pythonExe } = aiPaths();
  const script = path.join(aiDir, 'enroll_server.py');
  if (!fs.existsSync(pythonExe)) {
    return res.status(500).json({
      error: `Python venv not found at ${pythonExe}. Run "python -m venv venv" + "pip install -r requirements.txt" inside ai-service/edge first.`,
    });
  }
  if (!fs.existsSync(script)) {
    return res.status(500).json({ error: 'Enrollment helper missing (ai-service/edge/enroll_server.py)' });
  }

  const child = spawn(pythonExe, [
    '-u', script,
    // Port 0 = the helper picks a free ephemeral port and announces it on
    // stdout, so there is no fixed port to collide with.
    '--port', '0',
    '--det-size', String(settings.det_size),
  ], {
    cwd: aiDir,
    windowsHide: true, // headless helper, nothing to show on screen
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });

  // Log everything the helper says for its whole lifetime, watch for the
  // ready line and the GPU refusal, and keep a stderr tail for the
  // startup-failure response below.
  let readyPort = null;
  let gpuSignalled = false;
  let stderrTail = '';
  child.stdout.on('data', (d) => {
    const s = d.toString();
    s.split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[AI:enroll-server:stdout] ${l}`));
    const m = s.match(/ENROLL_READY\s+port=(\d+)/);
    if (m) readyPort = parseInt(m[1], 10);
    if (s.includes('GPU_REQUIRED')) gpuSignalled = true;
  });
  child.stderr.on('data', (d) => {
    const s = d.toString();
    stderrTail = (stderrTail + s).slice(-2000);
    s.split(/\r?\n/).filter(Boolean).forEach((l) => console.warn(`[AI:enroll-server:stderr] ${l}`));
    if (s.includes('GPU_REQUIRED')) gpuSignalled = true;
  });
  child.on('exit', (code, signal) => {
    // Session state is intentionally left in place so the frame endpoint can
    // return its dedicated "helper stopped" answer; this is just the log line.
    console.log(`[AI:enroll-server] helper exited code=${code} signal=${signal}`);
  });

  // Wait for ENROLL_READY, a GPU refusal (exit 3 / GPU_REQUIRED marker), a
  // spawn error, or the startup deadline, whichever comes first.
  const outcome = await new Promise((resolve) => {
    let settled = false;
    let spawnErr = null;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), ENROLL_HELPER_START_TIMEOUT_MS);
    child.on('error', (e) => { spawnErr = e; });
    const poll = setInterval(() => {
      if (spawnErr) finish({ ok: false, reason: 'error', message: spawnErr.message });
      else if (readyPort !== null) finish({ ok: true, port: readyPort });
      else if (child.exitCode !== null) finish({
        ok: false,
        reason: 'exit',
        code: child.exitCode,
        gpu: gpuSignalled || child.exitCode === AI_EXIT_GPU_REQUIRED,
      });
    }, 100);
  });

  if (!outcome.ok) {
    try { child.kill(); } catch (_) { /* already gone */ }
    if (outcome.reason === 'exit' && outcome.gpu) {
      // Same hardware refusal as the CLI path: surface the real reason
      // instead of a generic "failed to start".
      return res.status(503).json({ error: GPU_REQUIRED_MSG });
    }
    return res.status(500).json({
      error: 'Enrollment helper failed to start',
      stderr: outcome.reason === 'error' ? String(outcome.message || '') : stderrTail.slice(-500),
    });
  }

  enrollSession = {
    id: `es_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    studentId: student.id,
    studentName: student.full_name,
    studentClass: student.class_section?.name || 'Unknown',
    child,
    port: outcome.port,
    startedAt: new Date().toISOString(),
  };

  return res.json({
    session_id: enrollSession.id,
    student_name: student.full_name,
    required_captures: ENROLL_REQUIRED_CAPTURES,
  });
});

// POST /api/ai/enroll/frame - relay one browser-camera frame to the helper.
// Body: { session_id, image, mode? } where image is a data URL or a raw
// base64 JPEG and mode is 'preview' (default) or 'capture'. The helper's
// verdict JSON is relayed to the client unchanged, status code included.
app.post('/api/ai/enroll/frame', requireAdmin, async (req, res) => {
  const { session_id, image, mode } = req.body || {};
  if (!session_id || !image) return res.status(400).json({ error: 'session_id and image required' });
  if (!enrollSession || enrollSession.id !== session_id) {
    return res.status(404).json({ error: 'No active enrollment session' });
  }
  if (enrollSession.child.exitCode !== null) {
    enrollSession = null; // dead helper: drop the stale session
    return res.status(410).json({ error: 'Enrollment helper stopped; start again' });
  }
  // Accept both data URLs ("data:image/jpeg;base64,...") and raw base64.
  const dm = /^data:image\/[a-z0-9.+-]+;base64,/i.exec(image);
  const image_b64 = dm ? image.slice(dm[0].length) : image;
  try {
    const r = await fetch(`http://127.0.0.1:${enrollSession.port}/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_b64, mode: mode === 'capture' ? 'capture' : 'preview' }),
    });
    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  } catch (_) {
    // The helper died between the liveness check above and this call.
    enrollSession = null;
    return res.status(410).json({ error: 'Enrollment helper stopped; start again' });
  }
});

// POST /api/ai/enroll/complete - ask the helper to finalize the captures
// into one 512-float embedding, then write enrolled_students.json with EXACTLY
// the semantics of enroll_student.py (add_student / --overwrite): an entry
// with the same name (case-insensitive) keeps its id and gets the embedding,
// class, timestamp and UUID refreshed; otherwise it is appended with
// max(existing ids)+1. Admin-only.
app.post('/api/ai/enroll/complete', requireAdmin, async (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  if (!enrollSession || enrollSession.id !== session_id) {
    return res.status(404).json({ error: 'No active enrollment session' });
  }
  if (enrollSession.child.exitCode !== null) {
    enrollSession = null;
    return res.status(410).json({ error: 'Enrollment helper stopped; start again' });
  }
  const session = enrollSession;

  let finalizeRes;
  try {
    finalizeRes = await fetch(`http://127.0.0.1:${session.port}/finalize`, { method: 'POST' });
  } catch (_) {
    // Helper died before finalize could run.
    enrollSession = null;
    return res.status(410).json({ error: 'Enrollment helper stopped; start again' });
  }
  const finalizeData = await finalizeRes.json().catch(() => ({}));
  if (!finalizeRes.ok) {
    // 409 = not enough captures yet: relay the helper's error + counts.
    return res.status(finalizeRes.status).json(finalizeData);
  }

  // Contract: 200 { embedding: [512 floats], captures }.
  const embedding = Array.isArray(finalizeData.embedding) ? finalizeData.embedding : null;
  if (!embedding || embedding.length !== 512 || embedding.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    return res.status(500).json({ error: 'Enrollment helper returned an invalid embedding' });
  }
  if (enrollSession !== session) {
    // The session was cancelled while finalize was in flight; discard the
    // embedding instead of writing it for a cancelled enrollment.
    try { fetch(`http://127.0.0.1:${session.port}/shutdown`, { method: 'POST' }).catch(() => {}); } catch (_) { /* already gone */ }
    return res.status(404).json({ error: 'No active enrollment session' });
  }

  let writeResult;
  try {
    writeResult = await withEnrollJsonLock(async () => {
      const dbPath = path.join(aiPaths().aiDir, 'enrolled_students.json');
      // Same load rule as enroll_student.load_database: a missing file is an
      // empty database, and students must be a list.
      let db = { students: [] };
      if (fs.existsSync(dbPath)) {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        if (!Array.isArray(db.students)) db.students = [];
      }
      const students = db.students;
      const target = session.studentName.trim().toLowerCase();
      const idx = students.findIndex((st) => (st.name || '').trim().toLowerCase() === target);
      const enrolledAt = localEnrollTimestamp(new Date());
      let result;
      if (idx !== -1) {
        // enroll_student.py --overwrite branch: keep the id, replace the
        // embedding, refresh class + enrolled_at, and (re)link the Supabase
        // UUID (we always have one, so the link can never be erased here).
        const existing = students[idx];
        existing.embedding = embedding;
        existing.class = session.studentClass;
        existing.enrolled_at = enrolledAt;
        existing.student_uuid = session.studentId;
        result = { replaced: true, id: existing.id };
      } else {
        // add_student branch: max(id)+1, not count+1, so ids of removed
        // entries are never reissued.
        const newId = Math.max(...students.map((s) => Number(s.id) || 0), 0) + 1;
        students.push({
          id: newId,
          name: session.studentName,
          class: session.studentClass,
          student_uuid: session.studentId,
          embedding,
          enrolled_at: enrolledAt,
        });
        result = { replaced: false, id: newId };
      }
      // Same save rule as enroll_student.save_database: indent 2, raw UTF-8
      // (JSON.stringify leaves non-ASCII unescaped, matching
      // ensure_ascii=False). Written inside the lock so the whole
      // read-modify-write cycle is atomic.
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
      return result;
    });
  } catch (e) {
    console.error('[ai/enroll-complete] failed:', e);
    return res.status(500).json({ error: 'Failed to update enrolled_students.json' });
  }

  // Tell the helper to exit (best effort: it also exits by itself after
  // answering shutdown, and idles out after 10 minutes regardless), then
  // drop the session state.
  try { await fetch(`http://127.0.0.1:${session.port}/shutdown`, { method: 'POST' }); } catch (_) { /* already gone */ }
  enrollSession = null;
  logAudit(req.actor.id, 'face.enroll', session.studentId, { name: session.studentName });
  return res.json({
    success: true,
    replaced: writeResult.replaced,
    message: `Enrolled ${session.studentName}`,
  });
});

// DELETE /api/ai/enroll/session - cancel the active browser-enrollment
// session: tell the helper to shut down (best effort, it also idle-exits on
// its own) and drop the session state. Admin-only like the other routes.
app.delete('/api/ai/enroll/session', requireAdmin, async (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  if (!enrollSession || enrollSession.id !== session_id) {
    return res.status(404).json({ error: 'No active enrollment session' });
  }
  const session = enrollSession;
  enrollSession = null;
  try {
    await fetch(`http://127.0.0.1:${session.port}/shutdown`, { method: 'POST' });
  } catch (_) {
    // Helper already gone or unreachable: kill the child as a fallback.
    try { session.child.kill(); } catch (_) { /* nothing left to do */ }
  }
  return res.json({ cancelled: true });
});

// ── Start Server ─────────────────────────────────────────────────────────────
reconcileAiPid(); // reclaim any AI child orphaned by a previous server run (#15)
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  PRISM-AI Backend API Server');
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /api/health            → Server status');
  console.log('    GET  /api/attendance         → All live data');
  console.log('    POST /api/attendance         → AI sends data');
  console.log('    GET  /api/engagement/summary → Day engagement summaries (staff)');
  console.log('    GET  /api/engagement/risk    → Rolling risk scores (staff)');
  console.log('    GET  /api/engagement/trends  → Student risk trends (staff)');
  console.log('    POST   /api/admin/users      → Create user  (admin)');
  console.log('    PATCH  /api/admin/users/:id  → Update user  (admin)');
  console.log('    DELETE /api/admin/users/:id  → Delete user  (admin)');
  console.log('    GET    /api/admin/users/list → List users + emails (admin)');
  console.log('    GET    /api/ai/process       → AI child process state');
  console.log('    DELETE /api/ai/process       → Force-kill orphan AI (admin)');
  console.log('    GET    /api/ai/enrolled      → Face-enrollment list (staff)');
  console.log('    POST   /api/ai/start         → Start Python AI (admin/teacher)');
  console.log('    POST   /api/ai/stop          → Stop Python AI  (admin/teacher)');
  console.log('    POST   /api/ai/restart       → Restart Python AI (admin/teacher)');
  console.log('    POST   /api/ai/enroll        → Enroll a face   (admin)');
  console.log('    POST   /api/ai/enroll/session → Start browser enroll (admin)');
  console.log('    POST   /api/ai/enroll/frame   → Browser enroll frame (admin)');
  console.log('    POST   /api/ai/enroll/complete → Finish browser enroll (admin)');
  console.log('    DELETE /api/ai/enroll/session → Cancel browser enroll (admin)');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Waiting for AI face recognition data...');
});
