/**
 * PRISM-AI Backend API Server
 * 
 * This Express.js server acts as the bridge between:
 *   - Python Edge AI (face_recognition.py) → sends POST with recognized students
 *   - React Dashboard (frontend) → fetches GET for live attendance data
 * 
 * Runs on: http://localhost:3001
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// ── API ROUTES ───────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    aiStatus: liveData.aiStatus,
    lastUpdate: liveData.lastUpdate,
    studentsTracked: liveData.attendanceToday.length,
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
  }

  res.json({ 
    success: true, 
    message: `Processed ${detections.length} detection(s)`,
    totalPresent: presentToday.size,
  });
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
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Waiting for AI face recognition data...');
});
