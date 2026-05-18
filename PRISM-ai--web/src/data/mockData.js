/* ============================================================
   PRISM-AI  --  Live Data (Mock data removed)
   Ready for real AI face recognition data
   ============================================================ */

// ── Years ────────────────────────────────────────────────────
export const years = [1, 2, 3, 4, 5, 6];

// ── Classes & colours ────────────────────────────────────────
export const classes = ['Bestari', 'Bijak', 'Cerdik', 'Cerdas', 'Pandai'];

export const classColors = {
  Bestari: '#2F75C9',
  Bijak:   '#E04A3F',
  Cerdik:  '#4FA764',
  Cerdas:  '#EA8534',
  Pandai:  '#F2C744',
};

// ── Subjects (6 KSSR subjects) ───────────────────────────────
export const subjects = [
  { id: 'eng', name: 'English',          colour: '#2F75C9', hoursPerWeek: 5 },
  { id: 'bm',  name: 'Bahasa Melayu',    colour: '#4FA764', hoursPerWeek: 6 },
  { id: 'mat', name: 'Mathematics',      colour: '#E04A3F', hoursPerWeek: 5 },
  { id: 'sci', name: 'Science',          colour: '#EA8534', hoursPerWeek: 4 },
  { id: 'pi',  name: 'Pendidikan Islam', colour: '#F2C744', hoursPerWeek: 3 },
  { id: 'pm',  name: 'Pendidikan Moral', colour: '#1F1A12', hoursPerWeek: 3 },
];

// ── Students (empty — will be populated by AI or enrollment) ─
export const students = [];

// ── Users (only admin account remains) ───────────────────────
export const users = [
  { id: 1, name: 'Admin Hafiz', email: 'hafiz@prismai.edu', role: 'admin', year: null, class: null, subject: null, years: null, status: 'active' },
];

// ── Attendance Today (empty) ─────────────────────────────────
export const attendanceToday = [];

// ── Class Attendance (empty) ─────────────────────────────────
export const classAttendance = (() => {
  const result = [];
  for (const yr of years) {
    for (const cls of classes) {
      result.push({
        year: yr,
        class: cls,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
      });
    }
  }
  return result;
})();

// ── Weekly Attendance (empty) ────────────────────────────────
export const weeklyAttendance = [
  { day: 'Mon', present: 0, absent: 0, late: 0 },
  { day: 'Tue', present: 0, absent: 0, late: 0 },
  { day: 'Wed', present: 0, absent: 0, late: 0 },
  { day: 'Thu', present: 0, absent: 0, late: 0 },
  { day: 'Fri', present: 0, absent: 0, late: 0 },
];

// ── Monthly Attendance (empty) ───────────────────────────────
export const monthlyAttendance = [
  { month: 'Jan',  present: 0, absent: 0, late: 0 },
  { month: 'Feb',  present: 0, absent: 0, late: 0 },
  { month: 'Mar',  present: 0, absent: 0, late: 0 },
  { month: 'Apr',  present: 0, absent: 0, late: 0 },
  { month: 'May',  present: 0, absent: 0, late: 0 },
  { month: 'Jun',  present: 0, absent: 0, late: 0 },
  { month: 'Jul',  present: 0, absent: 0, late: 0 },
  { month: 'Aug',  present: 0, absent: 0, late: 0 },
  { month: 'Sep',  present: 0, absent: 0, late: 0 },
  { month: 'Oct',  present: 0, absent: 0, late: 0 },
  { month: 'Nov',  present: 0, absent: 0, late: 0 },
  { month: 'Dec',  present: 0, absent: 0, late: 0 },
];

// ── Daily Arrival Times (empty) ──────────────────────────────
export const dailyArrivalTimes = [
  { time: '07:00', count: 0 },
  { time: '07:10', count: 0 },
  { time: '07:15', count: 0 },
  { time: '07:20', count: 0 },
  { time: '07:25', count: 0 },
  { time: '07:30', count: 0 },
  { time: '07:35', count: 0 },
  { time: '07:40', count: 0 },
  { time: '07:45', count: 0 },
  { time: '07:50', count: 0 },
  { time: '07:55', count: 0 },
  { time: '08:00', count: 0 },
  { time: '08:05', count: 0 },
  { time: '08:10', count: 0 },
  { time: '08:15', count: 0 },
  { time: '08:20', count: 0 },
  { time: '08:25', count: 0 },
  { time: '08:30', count: 0 },
];

// ── Attendance History (empty) ───────────────────────────────
export const attendanceHistory = {};

// ── Notifications (empty) ────────────────────────────────────
export const notifications = [];

// ── Recent Activity (empty) ──────────────────────────────────
export const recentActivity = [];

// ── Audit Logs (empty) ───────────────────────────────────────
export const auditLogs = [];

// ── School Events ────────────────────────────────────────────
export const schoolEvents = [
  { id: 1, title: 'Parent-Teacher Meeting',     date: '2026-05-20', type: 'meeting' },
  { id: 2, title: 'Sports Day',                 date: '2026-06-05', type: 'event' },
  { id: 3, title: 'School Holiday - Hari Raya', date: '2026-06-15', type: 'holiday' },
  { id: 4, title: 'Annual Concert',             date: '2026-06-25', type: 'event' },
  { id: 5, title: 'Term 1 Report Card Day',     date: '2026-06-30', type: 'meeting' },
];

// ── AI Model History ─────────────────────────────────────────
export const aiModelHistory = [];

// ── Parent-Child Data (empty) ────────────────────────────────
export const parentChildData = {
  parent: { name: '', email: '', phone: '' },
  child:  { name: '', year: 0, class: '', age: 0, gender: '', attendanceRate: 0, faceRegistered: false },
  weeklyStats: { present: 0, absent: 0, late: 0, onTimeRate: 0 },
  attendanceHistory: [],
  notifications: [],
  announcements: [],
};
