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

        // 3) Build date + arrival time
        const isoDate = now.toISOString().slice(0, 10);            // YYYY-MM-DD
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
        } else {
          console.log(`[Supabase] ✓ ${bareName} marked ${status} at ${arrivalTime}`);
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
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Waiting for AI face recognition data...');
});
