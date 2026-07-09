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
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
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

let liveData = {
  students: [],           // Enrolled students from AI
  attendanceToday: [],    // Today's attendance records
  recentActivity: [],     // Recent check-in activity
  notifications: [],      // Alerts and notifications
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
// liveData.students (the enrolled list persists across days) and
// aiStatus/lastUpdate (they describe the AI link, not the day) untouched.
function resetIfNewDay() {
  const today = localDateStr(new Date());
  if (today === currentDay) return;
  presentToday.clear();
  liveData.attendanceToday = [];
  liveData.recentActivity = [];
  liveData.notifications = [];
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

function aiPaths() {
  const aiDir = path.join(__dirname, '..', 'ai-service', 'edge');
  const pythonExe = os.platform() === 'win32'
    ? path.join(aiDir, 'venv', 'Scripts', 'python.exe')
    : path.join(aiDir, 'venv', 'bin', 'python');
  const script = path.join(aiDir, 'face_recognition.py');
  return { aiDir, pythonExe, script };
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
// who actually need to turn the camera on/off. Parents and assistants stay
// blocked.
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

const VALID_ROLES = ['admin', 'teacher', 'parent', 'assistant'];
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
    supabaseEnabled: Boolean(supabase),
  });
});

// GET: Fetch all live data (for React dashboard polling)
app.get('/api/attendance', (req, res) => {
  res.json(liveData);
});

// GET: Fetch attendance summary counts
app.get('/api/attendance/summary', (req, res) => {
  const present = liveData.attendanceToday.filter(a => a.status === 'present').length;
  const late = liveData.attendanceToday.filter(a => a.status === 'late').length;
  const absent = liveData.attendanceToday.filter(a => a.status === 'absent').length;
  const total = liveData.students.length;

  res.json({ total, present, absent, late });
});

// POST: Receive attendance data from Python AI
app.post('/api/attendance', (req, res) => {
  // Roll the day over first — otherwise a detection just after midnight would
  // be dropped as a duplicate of yesterday's check-in.
  resetIfNewDay();

  const { timestamp, detections, classroom_id } = req.body;

  if (!detections || !Array.isArray(detections)) {
    return res.status(400).json({ error: 'Invalid payload. Expected "detections" array.' });
  }

  liveData.aiStatus = 'online';
  liveData.lastUpdate = timestamp || new Date().toISOString();

  // Collect detections that are NEW this request (not already in presentToday).
  // We persist only these to Supabase to avoid hammering the DB with re-upserts
  // on the same student across the SEND_INTERVAL ticks from the Python loop.
  const freshDetections = [];

  for (const det of detections) {
    const studentKey = det.student_name;

    // Skip if already marked present today
    if (presentToday.has(studentKey)) continue;
    presentToday.add(studentKey);

    // Determine status based on time
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isLate = (hour > 8) || (hour === 8 && minute > 0);
    const status = isLate ? 'late' : 'present';

    const timeIn = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Add to attendance
    liveData.attendanceToday.push({
      studentId: liveData.attendanceToday.length + 1,
      name: det.student_name,
      year: det.student_year || 1,
      class: det.student_class || 'Bestari',
      status: status,
      timeIn: timeIn,
      timeOut: '-',
      similarity: det.similarity_score,
    });

    // Add to recent activity
    liveData.recentActivity.unshift({
      id: liveData.recentActivity.length + 1,
      user: 'System',
      action: `${det.student_name} checked in via face recognition (${(det.similarity_score * 100).toFixed(1)}% match)`,
      timestamp: timeIn,
      type: 'success',
    });

    // Add notification
    liveData.notifications.unshift({
      id: liveData.notifications.length + 1,
      type: status === 'late' ? 'warning' : 'success',
      message: status === 'late'
        ? `${det.student_name} arrived late at ${timeIn}`
        : `${det.student_name} checked in at ${timeIn}`,
      time: timeIn,
      read: false,
    });

    // Add to students list if not already there
    const exists = liveData.students.find(s => s.name === det.student_name);
    if (!exists) {
      liveData.students.push({
        id: liveData.students.length + 1,
        name: det.student_name,
        year: det.student_year || 1,
        class: det.student_class || 'Bestari',
        age: 7,
        gender: 'M',
        parent: '',
        parentEmail: '',
        parentPhone: '',
        faceRegistered: true,
        attendanceRate: 100,
      });
    }

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

        // 2) Look up the student by full_name (case-insensitive)
        const { data: student, error: lookupErr } = await supabase
          .from('students')
          .select('id')
          .ilike('full_name', bareName)
          .maybeSingle();

        if (lookupErr) {
          console.warn(`[Supabase] Lookup error for "${bareName}":`, lookupErr.message);
          continue;
        }
        if (!student) {
          console.warn(`[Supabase] No student match for "${bareName}" — skipping`);
          continue;
        }

        // 3) Build date + arrival time — both in LOCAL time. toISOString()
        //    is UTC, which would file pre-8AM MYT detections under yesterday.
        const isoDate = localDateStr(now);                         // YYYY-MM-DD (local)
        const arrivalTime = now.toTimeString().slice(0, 8);        // HH:MM:SS

        // 4) Upsert into attendance_records (unique on student_id,date)
        const { error: upsertErr } = await supabase
          .from('attendance_records')
          .upsert({
            student_id: student.id,
            date: isoDate,
            status,
            arrival_time: arrivalTime,
            marked_by: null, // AI-driven, no human authenticator
            marked_at: now.toISOString(),
            notes: `AI detection from ${classroom_id || 'camera'}`,
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
});

// POST: Register/enroll a new student (from enrollment script)
app.post('/api/students', (req, res) => {
  const { name, year, className, parent, parentEmail, parentPhone } = req.body;

  liveData.students.push({
    id: liveData.students.length + 1,
    name: name,
    year: year || 1,
    class: className || 'Bestari',
    age: 7,
    gender: 'M',
    parent: parent || '',
    parentEmail: parentEmail || '',
    parentPhone: parentPhone || '',
    faceRegistered: true,
    attendanceRate: 0,
  });

  res.json({ success: true, message: `Student ${name} enrolled successfully` });
});

// POST: Reset today's attendance (for new day)
app.post('/api/attendance/reset', (req, res) => {
  liveData.attendanceToday = [];
  liveData.recentActivity = [];
  liveData.notifications = [];
  presentToday.clear();
  // Sync the rollover marker so resetIfNewDay() doesn't clear a second time
  // on the next health poll after a manual reset.
  currentDay = localDateStr(new Date());
  console.log('[RESET] Attendance cleared for new day');
  res.json({ success: true, message: 'Attendance reset for new day' });
});

// ── Admin: User Management ───────────────────────────────────────────────────
// Backs the Admin Panel's Add / Edit / Delete user controls. All three require
// the caller to be authenticated AND hold role==='admin'. Every successful
// mutation appends an entry to audit_logs (fire-and-forget).

// POST /api/admin/users — invite a new user by email.
// Body: { email, full_name, role, phone? }
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { email, full_name, role, phone } = req.body || {};

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

  const cleanEmail = email.trim();
  const cleanName = full_name.trim();

  try {
    const { data: invited, error: inviteErr } =
      await supabase.auth.admin.inviteUserByEmail(cleanEmail, {
        data: { full_name: cleanName, role },
      });

    if (inviteErr) {
      const msg = (inviteErr.message || '').toLowerCase();
      // Supabase surfaces duplicate-email cases via several phrasings — match liberally.
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        inviteErr.status === 422
      ) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      console.error('[admin/users] invite failed:', inviteErr);
      return res.status(500).json({ error: inviteErr.message || 'Invite failed' });
    }

    const invitedUser = invited?.user;
    if (!invitedUser?.id) {
      return res.status(500).json({ error: 'Invite returned no user' });
    }

    // The handle_new_user trigger has already inserted a profile row. If a phone
    // was supplied, patch it in. Non-fatal if this fails — the user still exists.
    if (phone && phone.trim()) {
      const { error: phoneErr } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', invitedUser.id);
      if (phoneErr) {
        console.warn('[admin/users] phone update failed:', phoneErr.message);
      }
    }

    res.status(201).json({
      id: invitedUser.id,
      email: invitedUser.email || cleanEmail,
      full_name: cleanName,
      role,
    });

    logAudit(req.actor.id, 'user.invite', invitedUser.id, {
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

// GET /api/ai/process — current process supervision state. Public so the
// page can render Start/Stop button state without an admin login round-trip;
// the mutating endpoints below are gated.
app.get('/api/ai/process', (req, res) => {
  const running = !!(aiProcess && aiProcess.exitCode === null);
  res.json({
    running,
    pid: running ? aiProcess.pid : null,
    startedAt: aiStartedAt,
    lastExitCode: aiLastExitCode,
    lastExitAt: aiLastExitAt,
    lastError: aiLastError,
  });
});

// GET /api/ai/enrolled — list face-enrollment status (read from enrolled_students.json)
// Returns: { enrolled: [{ name, class, enrolled_at }, ...] }
// No auth required — the names are already visible elsewhere in the app.
app.get('/api/ai/enrolled', (req, res) => {
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

// POST /api/ai/start — spawn the Python face-recognition service.
app.post('/api/ai/start', requireAdminOrTeacher, (req, res) => {
  if (aiProcess && aiProcess.exitCode === null) {
    return res.status(409).json({
      error: 'AI service already running',
      pid: aiProcess.pid,
    });
  }
  try {
    const { aiDir, pythonExe, script } = aiPaths();
    if (!fs.existsSync(pythonExe)) {
      return res.status(500).json({
        error: `Python venv not found at ${pythonExe}. Run "python -m venv venv" + "pip install -r requirements.txt" inside ai-service/edge first.`,
      });
    }
    if (!fs.existsSync(script)) {
      return res.status(500).json({
        error: `Script not found at ${script}`,
      });
    }

    const child = spawn(pythonExe, ['-u', script, '--camera', '0'], {
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
    });
    child.on('error', (err) => {
      console.error('[AI] Spawn error:', err);
      if (aiProcess === child) aiProcess = null;
    });

    logAudit(req.actor.id, 'ai.start', null, { pid: child.pid });
    return res.json({ success: true, pid: child.pid, startedAt: aiStartedAt });
  } catch (e) {
    console.error('[AI start] failed:', e);
    return res.status(500).json({ error: e.message || 'Failed to start AI service' });
  }
});

// POST /api/ai/stop — terminate the running Python child.
app.post('/api/ai/stop', requireAdminOrTeacher, (req, res) => {
  if (!aiProcess || aiProcess.exitCode !== null) {
    return res.status(404).json({ error: 'AI service is not running' });
  }
  const pid = aiProcess.pid;
  try {
    // On Windows, SIGTERM is mapped to a terminate; this typically works.
    // For really stuck cases the admin can fall back to killing manually.
    aiProcess.kill();
    logAudit(req.actor.id, 'ai.stop', null, { pid });
    return res.json({ success: true, pid });
  } catch (e) {
    console.error('[AI stop] failed:', e);
    return res.status(500).json({ error: e.message || 'Failed to stop AI service' });
  }
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
    '--camera', '0',
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

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  PRISM-AI Backend API Server');
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /api/health            → Server status');
  console.log('    GET  /api/attendance         → All live data');
  console.log('    GET  /api/attendance/summary → Counts only');
  console.log('    POST /api/attendance         → AI sends data');
  console.log('    POST /api/attendance/reset   → Clear for new day');
  console.log('    POST   /api/admin/users      → Invite user  (admin)');
  console.log('    PATCH  /api/admin/users/:id  → Update user  (admin)');
  console.log('    DELETE /api/admin/users/:id  → Delete user  (admin)');
  console.log('    GET    /api/admin/users/list → List users + emails (admin)');
  console.log('    GET    /api/ai/process       → AI child process state');
  console.log('    GET    /api/ai/enrolled      → Face-enrollment list (public)');
  console.log('    POST   /api/ai/start         → Start Python AI (admin)');
  console.log('    POST   /api/ai/stop          → Stop Python AI  (admin)');
  console.log('    POST   /api/ai/enroll        → Enroll a face   (admin)');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Waiting for AI face recognition data...');
});
