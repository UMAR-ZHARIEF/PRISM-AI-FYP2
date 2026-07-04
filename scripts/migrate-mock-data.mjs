// =====================================================================
// PRISM-AI mock-data migration script
// ---------------------------------------------------------------------
// Seeds a Supabase project from PRISM-ai--web/src/data/mockData.js.
//
// Steps (FK-respecting):
//   A  staff auth.users + profile backfill (admin / teachers / assistant)
//   B  parent auth.users + profile backfill (derived from students[])
//   C  class_sections.homeroom_teacher_id wiring
//   D  subject_teachers (teacher x subject x year)
//   E  students
//   F  parent_students
//   G  attendance_records (history + today)
//   H  school_events
//   I  ai_models
//   J  notifications (Option B scope column)
//   K  audit_logs
//
// Idempotent: re-running the script is safe. auth.users creation falls
// back to listUsers() lookup on "already registered" errors; all other
// inserts use upsert on a natural key (or a title/action-matched
// delete-then-insert for tables without one).
//
// Date re-anchoring: the mock dataset is frozen around MOCK_TODAY
// (2026-05-11). On every run the script re-anchors all seeded dates to
// the run anchor — ANCHOR_DATE env if set, else the most recent weekday
// on-or-before today (local time). Attendance is remapped by school-day
// rank (weekday-only structure preserved, freshest rows on the anchor);
// school_events and audit_logs are shifted by the calendar-day delta;
// the ai_models deployed_at ladder ends at the anchor.
//
// Required env: SUPABASE_URL, SUPABASE_SECRET_KEY (falls back to
// SUPABASE_SERVICE_KEY for backward compat). Optional: STAFF_PASSWORD
// (default 'Welcome123!'), ANCHOR_DATE (YYYY-MM-DD, defaults to the
// most recent weekday).
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- env / setup ------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'Welcome123!';

if (!SUPABASE_URL) {
  console.error(
    'ERROR: SUPABASE_URL is not set. Export your Supabase project URL, e.g. "https://abc123.supabase.co".'
  );
  process.exit(1);
}
if (!SECRET_KEY) {
  console.error(
    'ERROR: Neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_KEY is set.\n' +
      '  Set the secret key (starts with "sb_secret_..." in the new dashboard,\n' +
      '  or the older "service_role" key marked "secret"). This script needs it\n' +
      '  to bypass RLS and create users via the admin API.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- mock data --------------------------------------------------

const mockPath = resolve(
  __dirname,
  '..',
  'PRISM-ai--web',
  'src',
  'data',
  'mockData.js'
);
const mock = await import(pathToFileURL(mockPath).href);

const {
  users: mockUsers,
  students: mockStudents,
  attendanceHistory,
  attendanceToday,
  schoolEvents,
  aiModelHistory,
  auditLogs,
  classColors,
} = mock;

// ---------- helpers ----------------------------------------------------

// The mock dataset is frozen around 2026-05-11 (see
// generateAttendanceHistory in mockData.js). Every date the script
// seeds is re-anchored from this to the run anchor computed below.
const MOCK_TODAY = '2026-05-11';

// ----- BEGIN RE-ANCHOR HELPERS (pure: no env/db/mock access) -----------
// The BEGIN/END markers let the scratch tests extract and import this
// block verbatim, so what is tested is exactly what ships.

// Format a Date as local YYYY-MM-DD. Never use toISOString() for
// date-only values: it converts to UTC first, which shifts the day for
// timezones east of Greenwich (e.g. Malaysia, UTC+8).
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 'YYYY-MM-DD' -> Date at local midnight. Throws on malformed input or
// impossible dates (e.g. 2026-02-31), which JS would silently roll over.
function parseLocalDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) throw new Error(`not a YYYY-MM-DD date: ${JSON.stringify(s)}`);
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (fmtDate(d) !== m[0]) throw new Error(`not a real calendar date: ${s}`);
  return d;
}

// Monday-Friday check (local weekday).
function isSchoolDay(d) {
  const dow = d.getDay();
  return dow >= 1 && dow <= 5;
}

// Most recent weekday at-or-before the given instant: Sat/Sun roll back
// to Friday. Returns a new Date at local midnight.
function mostRecentWeekday(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (!isSchoolDay(d)) d.setDate(d.getDate() - 1);
  return d;
}

// Resolve the run anchor: ANCHOR_DATE override if provided, else the
// most recent weekday on-or-before `now` in local time.
function resolveAnchor(envValue, now = new Date()) {
  if (envValue) return fmtDate(parseLocalDate(envValue));
  return fmtDate(mostRecentWeekday(now));
}

// Signed whole calendar days from one YYYY-MM-DD to another. Rounded so
// a DST hour in either direction cannot skew the result.
function daysBetween(fromStr, toStr) {
  const ms = parseLocalDate(toStr) - parseLocalDate(fromStr);
  return Math.round(ms / 86400000);
}

// Shift a YYYY-MM-DD by N calendar days using local Date math.
function shiftDateStr(dateStr, deltaDays) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return fmtDate(d);
}

// N consecutive school days (Mon-Fri) ascending, ENDING at the anchor.
// The anchor is always the last entry (the default anchor is always a
// weekday; an explicit weekend ANCHOR_DATE is honoured as given).
function buildSchoolDays(anchorStr, count) {
  const days = [];
  const d = parseLocalDate(anchorStr);
  days.push(fmtDate(d));
  while (days.length < count) {
    d.setDate(d.getDate() - 1);
    if (isSchoolDay(d)) days.unshift(fmtDate(d));
  }
  return days;
}

// Rank-remap a set of historical date strings onto consecutive school
// days ending at the anchor: oldest -> oldest, newest -> anchor. This
// preserves the weekday-only cadence and never produces weekend dates,
// regardless of what the source dates look like.
function buildDateRankMap(oldDates, anchorStr) {
  const sorted = [...new Set(oldDates)].sort();
  const newDays = buildSchoolDays(anchorStr, sorted.length);
  const map = new Map();
  for (let i = 0; i < sorted.length; i++) map.set(sorted[i], newDays[i]);
  return map;
}

// ----- END RE-ANCHOR HELPERS --------------------------------------------

// Anchor for THIS run. Everything date-shaped that the script seeds is
// expressed relative to this instead of the frozen MOCK_TODAY.
let ANCHOR;
try {
  ANCHOR = resolveAnchor(process.env.ANCHOR_DATE);
} catch (err) {
  console.error(`ERROR: invalid ANCHOR_DATE: ${err.message}`);
  process.exit(1);
}

// Flat calendar-day shift, applied to school_events and audit_logs.
const ANCHOR_DAY_DELTA = daysBetween(MOCK_TODAY, ANCHOR);

// Attendance instead uses school-day RANK remapping: collect every
// distinct date across all attendanceHistory arrays (plus MOCK_TODAY,
// where the attendanceToday rows live), and map them by rank onto
// consecutive Mon-Fri school days ending at the anchor. The freshest
// seeded data therefore always sits on the most recent school day.
const ATTENDANCE_DATE_MAP = buildDateRankMap(
  [
    MOCK_TODAY,
    ...Object.values(attendanceHistory).flatMap((recs) =>
      recs.map((r) => r.date)
    ),
  ],
  ANCHOR
);
const SCHOOL_DAY_COUNT = ATTENDANCE_DATE_MAP.size;

// Role remap: mock uses 'homeroom' and 'subject' which both collapse to
// the schema's 'teacher' enum value.
const ROLE_REMAP = {
  homeroom: 'teacher',
  subject: 'teacher',
  admin: 'admin',
  assistant: 'assistant',
  parent: 'parent',
};

// errors collected across the run so a single bad row doesn't abort
// the whole migration.
const errors = [];
function recordError(step, identifier, err) {
  const msg = err?.message ?? String(err);
  errors.push({ step, identifier, message: msg });
  console.error(`  ! [${step}] ${identifier}: ${msg}`);
}

// summary counters
const summary = {
  staffCreated: 0,
  staffExisting: 0,
  parentsCreated: 0,
  parentsExisting: 0,
  homeroomWired: 0,
  subjectTeachers: 0,
  students: 0,
  parentLinks: 0,
  attendance: 0,
  events: 0,
  aiModels: 0,
  notifications: 0,
  auditLogs: 0,
};

function randomPassword(len = 24) {
  // base64url of len bytes, then trimmed to the requested length.
  return randomBytes(len).toString('base64url').slice(0, len);
}

// "07:45 AM" -> "07:45:00", "-" -> null
function parseClockTime(s) {
  if (!s || s === '-') return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(s.trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

// "2026-05-11 08:30 AM" -> ISO timestamp (assume UTC for simplicity)
function parseAuditTimestamp(s) {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
    s.trim()
  );
  if (!m) return null;
  let hour = parseInt(m[2], 10);
  const minute = parseInt(m[3], 10);
  const ampm = m[4].toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${m[1]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
}

function dobFromAge(age) {
  // Anchor on the run anchor so ages stay truthful as time passes.
  // dob may change across re-runs when the anchor year moves on; that
  // is fine because students upsert on student_number.
  const year = parseLocalDate(ANCHOR).getFullYear() - age;
  return `${year}-01-01`;
}

// Walk auth.users with pagination until we find a user by email. Returns
// the user object or null.
async function findAuthUserByEmail(email) {
  const lowered = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || '').toLowerCase() === lowered);
    if (hit) return hit;
    if (users.length < perPage) return null;
  }
  return null;
}

// Create an auth.users row, falling back to lookup on "already
// registered" errors so the script is idempotent.
async function createOrFetchUser({ email, password, full_name, role, phone }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  let user;
  let existed = false;
  if (error) {
    const msg = (error.message || '').toLowerCase();
    const alreadyExists =
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      error.status === 422;
    if (!alreadyExists) throw error;
    existed = true;
    user = await findAuthUserByEmail(email);
    if (!user)
      throw new Error(
        `createUser reported "already registered" but listUsers could not find ${email}`
      );
  } else {
    user = data.user;
  }

  // Backfill profile fields the trigger could not know about.
  const update = {
    full_name,
    role,
  };
  if (phone) update.phone = phone;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);
  if (updateErr) throw updateErr;

  return { user, existed };
}

// ---------- step A: staff users ---------------------------------------

async function stepA_staffUsers() {
  const staff = mockUsers.filter((u) => u.role !== 'parent');
  console.log(`\n[Step A] Creating/syncing ${staff.length} staff users…`);
  const map = new Map(); // mockId -> { authId, role, fullName }

  for (const u of staff) {
    const targetRole = ROLE_REMAP[u.role] || 'assistant';
    try {
      const { user, existed } = await createOrFetchUser({
        email: u.email,
        password: STAFF_PASSWORD,
        full_name: u.name,
        role: targetRole,
      });
      map.set(u.id, {
        authId: user.id,
        role: targetRole,
        fullName: u.name,
        mockRole: u.role,
        year: u.year,
        class: u.class,
        subject: u.subject,
        years: u.years,
      });
      if (existed) summary.staffExisting++;
      else summary.staffCreated++;
    } catch (err) {
      recordError('A', `${u.email} (${u.name})`, err);
    }
  }
  console.log(
    `  ok: ${summary.staffCreated} created, ${summary.staffExisting} already existed`
  );
  return map;
}

// ---------- step B: parent users --------------------------------------

async function stepB_parentUsers() {
  // Parents are embedded in students, not in mockUsers. Dedupe by email.
  const seen = new Map(); // email -> { name, phone, mockStudentIds: [] }
  for (const s of mockStudents) {
    const email = (s.parentEmail || '').toLowerCase();
    if (!email) continue;
    if (!seen.has(email)) {
      seen.set(email, {
        name: s.parent,
        phone: s.parentPhone,
        studentIds: [s.id],
      });
    } else {
      seen.get(email).studentIds.push(s.id);
    }
  }

  console.log(
    `\n[Step B] Creating/syncing ${seen.size} parent users (derived from students)…`
  );
  const map = new Map(); // email -> authId

  for (const [email, info] of seen) {
    try {
      const { user, existed } = await createOrFetchUser({
        email,
        password: randomPassword(24),
        full_name: info.name,
        role: 'parent',
        phone: info.phone,
      });
      map.set(email, user.id);
      if (existed) summary.parentsExisting++;
      else summary.parentsCreated++;
    } catch (err) {
      recordError('B', `${email} (${info.name})`, err);
    }
  }
  console.log(
    `  ok: ${summary.parentsCreated} created, ${summary.parentsExisting} already existed`
  );
  return map;
}

// ---------- step C: class_sections.homeroom_teacher_id ----------------

async function loadClassSections() {
  const { data, error } = await supabase
    .from('class_sections')
    .select('id, year_num, name');
  if (error) throw error;
  const map = new Map(); // `${year}|${name}` -> sectionId
  for (const row of data) map.set(`${row.year_num}|${row.name}`, row.id);
  return map;
}

async function stepC_homeroomTeachers(staffMap, classSectionMap) {
  console.log('\n[Step C] Wiring homeroom_teacher_id on class_sections…');
  const homerooms = mockUsers.filter((u) => u.role === 'homeroom');
  for (const u of homerooms) {
    const staff = staffMap.get(u.id);
    if (!staff) continue;
    const sectionId = classSectionMap.get(`${u.year}|${u.class}`);
    if (!sectionId) {
      recordError(
        'C',
        `Year ${u.year} ${u.class}`,
        new Error('no class_section row to wire')
      );
      continue;
    }
    const { error } = await supabase
      .from('class_sections')
      .update({ homeroom_teacher_id: staff.authId })
      .eq('id', sectionId);
    if (error) {
      recordError('C', `Year ${u.year} ${u.class}`, error);
      continue;
    }
    summary.homeroomWired++;
  }
  console.log(`  ok: ${summary.homeroomWired} class sections wired`);
}

// ---------- step D: subject_teachers ----------------------------------

async function loadSubjects() {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) throw error;
  // Map mock subject codes ('eng', 'bm', ...) to subjects.id.
  const codeToName = {
    eng: 'English',
    bm: 'Bahasa Melayu',
    mat: 'Mathematics',
    sci: 'Science',
    pi: 'Pendidikan Islam',
    pm: 'Pendidikan Moral',
  };
  const nameToId = new Map(data.map((r) => [r.name, r.id]));
  const codeToId = new Map();
  for (const [code, name] of Object.entries(codeToName)) {
    if (nameToId.has(name)) codeToId.set(code, nameToId.get(name));
  }
  return codeToId;
}

async function stepD_subjectTeachers(staffMap, subjectCodeToId) {
  console.log('\n[Step D] Inserting subject_teachers rows…');
  const rows = [];
  for (const u of mockUsers) {
    if (u.role !== 'subject') continue;
    const staff = staffMap.get(u.id);
    if (!staff) continue;
    const subjectId = subjectCodeToId.get(u.subject);
    if (!subjectId) {
      recordError(
        'D',
        `${u.name} subject=${u.subject}`,
        new Error('unknown subject code')
      );
      continue;
    }
    for (const yearNum of u.years || []) {
      rows.push({
        subject_id: subjectId,
        teacher_id: staff.authId,
        year_num: yearNum,
      });
    }
  }
  if (rows.length === 0) {
    console.log('  ok: 0 rows');
    return;
  }
  const { error } = await supabase
    .from('subject_teachers')
    .upsert(rows, { onConflict: 'subject_id,teacher_id,year_num' });
  if (error) {
    recordError('D', `bulk upsert (${rows.length} rows)`, error);
    return;
  }
  summary.subjectTeachers = rows.length;
  console.log(`  ok: ${rows.length} rows upserted`);
}

// ---------- step E: students ------------------------------------------

function genStudentNumber(mockId) {
  return `PRISM-${String(mockId).padStart(4, '0')}`;
}

async function stepE_students(classSectionMap) {
  console.log(`\n[Step E] Inserting ${mockStudents.length} students…`);
  const studentMap = new Map(); // mockId -> studentUuid

  // Fetch any existing student rows so we can preserve UUIDs on re-run.
  const { data: existing, error: fetchErr } = await supabase
    .from('students')
    .select('id, student_number');
  if (fetchErr) throw fetchErr;
  const existingByNumber = new Map(
    (existing || []).map((r) => [r.student_number, r.id])
  );

  const rows = mockStudents.map((s) => {
    const sectionId = classSectionMap.get(`${s.year}|${s.class}`);
    return {
      student_number: genStudentNumber(s.id),
      full_name: s.name,
      dob: dobFromAge(s.age),
      gender: s.gender === 'M' ? 'male' : 'female',
      year_num: s.year,
      class_section_id: sectionId,
      photo_url: s.photoUrl || null,
      _mockId: s.id, // local-only, stripped before upsert
    };
  });

  // Validate class section resolution.
  const bad = rows.filter((r) => !r.class_section_id);
  for (const r of bad) {
    recordError(
      'E',
      r.student_number,
      new Error(`no class_section for year+class lookup`)
    );
  }

  const insertRows = rows
    .filter((r) => r.class_section_id)
    .map(({ _mockId, ...rest }) => rest);

  const { data, error } = await supabase
    .from('students')
    .upsert(insertRows, { onConflict: 'student_number' })
    .select('id, student_number');
  if (error) {
    recordError('E', `bulk upsert (${insertRows.length} rows)`, error);
    return studentMap;
  }

  const byNumber = new Map((data || []).map((r) => [r.student_number, r.id]));
  for (const r of rows) {
    if (!r.class_section_id) continue;
    const uuid =
      byNumber.get(r.student_number) || existingByNumber.get(r.student_number);
    if (uuid) studentMap.set(r._mockId, uuid);
  }
  summary.students = studentMap.size;
  console.log(`  ok: ${studentMap.size} students mapped`);
  return studentMap;
}

// ---------- step F: parent_students -----------------------------------

async function stepF_parentStudents(parentMap, studentMap) {
  console.log('\n[Step F] Linking parents to students…');
  // Track which parent already got an is_primary=true link so each parent
  // has exactly one primary even if they have multiple kids.
  const seenPrimary = new Set();
  const rows = [];
  for (const s of mockStudents) {
    const studentUuid = studentMap.get(s.id);
    const parentUuid = parentMap.get((s.parentEmail || '').toLowerCase());
    if (!studentUuid || !parentUuid) continue;
    const isPrimary = !seenPrimary.has(parentUuid);
    if (isPrimary) seenPrimary.add(parentUuid);
    rows.push({
      parent_id: parentUuid,
      student_id: studentUuid,
      relationship: 'guardian',
      is_primary: isPrimary,
    });
  }
  if (rows.length === 0) {
    console.log('  ok: 0 rows');
    return;
  }
  const { error } = await supabase
    .from('parent_students')
    .upsert(rows, { onConflict: 'parent_id,student_id' });
  if (error) {
    recordError('F', `bulk upsert (${rows.length} rows)`, error);
    return;
  }
  summary.parentLinks = rows.length;
  console.log(`  ok: ${rows.length} links upserted`);
}

// ---------- step G: attendance_records --------------------------------

async function stepG_attendance(studentMap, staffMap, classSectionMap) {
  console.log('\n[Step G] Inserting attendance records…');
  // For marked_by, prefer the homeroom teacher of the student's class.
  // Build (year, class) -> teacherAuthId map.
  const homeroomByClass = new Map();
  for (const u of mockUsers) {
    if (u.role !== 'homeroom') continue;
    const staff = staffMap.get(u.id);
    if (staff) homeroomByClass.set(`${u.year}|${u.class}`, staff.authId);
  }

  const rows = [];

  // History rows
  for (const s of mockStudents) {
    const studentUuid = studentMap.get(s.id);
    if (!studentUuid) continue;
    const markedBy = homeroomByClass.get(`${s.year}|${s.class}`) ?? null;
    const records = attendanceHistory[s.id] || [];
    for (const r of records) {
      rows.push({
        student_id: studentUuid,
        // Re-anchored by school-day rank (see ATTENDANCE_DATE_MAP).
        date: ATTENDANCE_DATE_MAP.get(r.date) ?? r.date,
        status: r.status,
        arrival_time: parseClockTime(r.timeIn),
        marked_by: markedBy,
      });
    }
  }

  // Today's rows (attendanceToday) — written at the run anchor, the
  // most recent school day.
  for (const t of attendanceToday) {
    const studentUuid = studentMap.get(t.studentId);
    if (!studentUuid) continue;
    const markedBy = homeroomByClass.get(`${t.year}|${t.class}`) ?? null;
    rows.push({
      student_id: studentUuid,
      date: ANCHOR,
      status: t.status,
      arrival_time: parseClockTime(t.timeIn),
      marked_by: markedBy,
    });
  }

  // Bulk upsert in chunks so Supabase doesn't choke on multi-MB payloads.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('attendance_records')
      .upsert(chunk, { onConflict: 'student_id,date' });
    if (error) {
      recordError('G', `chunk @${i}`, error);
      continue;
    }
    inserted += chunk.length;
  }
  summary.attendance = inserted;
  console.log(`  ok: ${inserted} / ${rows.length} attendance rows upserted`);
}

// ---------- step H: school_events -------------------------------------

async function stepH_schoolEvents(staffMap) {
  console.log(`\n[Step H] Inserting ${schoolEvents.length} school events…`);
  // Find admin profile for created_by.
  const adminEntry = Array.from(staffMap.values()).find(
    (v) => v.role === 'admin'
  );
  const createdBy = adminEntry?.authId ?? null;

  const rows = schoolEvents.map((e) => ({
    title: e.title,
    description: null,
    // Events are future announcements: a flat calendar-day shift keeps
    // them the same distance ahead of the anchor as they were ahead of
    // MOCK_TODAY (exact weekday does not matter here).
    event_date: shiftDateStr(e.date, ANCHOR_DAY_DELTA),
    event_type: e.type,
    created_by: createdBy,
  }));

  // school_events has no natural unique key, so guard against duplicates
  // by deleting matching titles before insert. Matching on title ONLY
  // (not event_date) means a re-run with a new anchor replaces the
  // old-dated copy instead of stranding it. The five seeded titles are
  // distinctive, so this will not touch operator-created events.
  for (const r of rows) {
    const { error: delErr } = await supabase
      .from('school_events')
      .delete()
      .eq('title', r.title);
    if (delErr) {
      recordError('H', `${r.title}`, delErr);
      continue;
    }
    const { error } = await supabase.from('school_events').insert(r);
    if (error) {
      recordError('H', `${r.title}`, error);
      continue;
    }
    summary.events++;
  }
  console.log(`  ok: ${summary.events} events inserted`);
}

// ---------- step I: ai_models -----------------------------------------

async function stepI_aiModels() {
  console.log(`\n[Step I] Inserting ${aiModelHistory.length} ai_models rows…`);
  // Derive name + version + deployed_at; last entry is 'active'. The
  // weekly deployment ladder ends at the run anchor, so the active
  // model always looks freshly deployed.
  const anchor = new Date(`${ANCHOR}T00:00:00Z`);
  const rows = aiModelHistory.map((row, i) => {
    const weeksAgo = aiModelHistory.length - 1 - i;
    const deployed = new Date(anchor);
    deployed.setUTCDate(deployed.getUTCDate() - weeksAgo * 7);
    return {
      name: 'face-recognition-v1',
      version: row.date.toLowerCase().replace(/\s+/g, '-'), // 'week-1'
      accuracy: row.accuracy,
      status: i === aiModelHistory.length - 1 ? 'active' : 'archived',
      deployed_at: deployed.toISOString(),
    };
  });

  for (const r of rows) {
    // Idempotency: delete any prior row with the same (name, version).
    const { error: delErr } = await supabase
      .from('ai_models')
      .delete()
      .eq('name', r.name)
      .eq('version', r.version);
    if (delErr) {
      recordError('I', `${r.name}@${r.version}`, delErr);
      continue;
    }
    const { error } = await supabase.from('ai_models').insert(r);
    if (error) {
      recordError('I', `${r.name}@${r.version}`, error);
      continue;
    }
    summary.aiModels++;
  }
  console.log(`  ok: ${summary.aiModels} models inserted`);
}

// ---------- step J: notifications (Option B scope) --------------------

async function stepJ_notifications(staffMap) {
  console.log('\n[Step J] Seeding representative notifications…');
  const adminEntry = Array.from(staffMap.values()).find(
    (v) => v.role === 'admin'
  );

  const broadcasts = [
    {
      scope: 'global',
      recipient_id: null,
      type: 'announcement',
      title: 'Term 2 begins Monday',
      body: 'Welcome back. Term 2 starts on Monday — please review the updated calendar in the events tab.',
    },
    {
      scope: 'role:teacher',
      recipient_id: null,
      type: 'policy',
      title: 'New attendance policy',
      body: 'Effective immediately, students arriving after 08:00 are marked late. Please brief your homeroom class.',
    },
    {
      scope: 'role:parent',
      recipient_id: null,
      type: 'event',
      title: 'PTA meeting next Friday',
      body: 'The Parent-Teacher Association meets at 10:00 in the school hall. Refreshments will be served.',
    },
  ];

  const directs = adminEntry
    ? [
        {
          scope: 'user',
          recipient_id: adminEntry.authId,
          type: 'info',
          title: 'Weekly attendance summary ready',
          body: 'This week\'s attendance report has been generated and is ready for review on the dashboard.',
        },
        {
          scope: 'user',
          recipient_id: adminEntry.authId,
          type: 'warning',
          title: 'AI model accuracy drift',
          body: 'Face recognition accuracy dropped 0.4% in the last 24 hours. Consider scheduling a retrain.',
        },
        {
          scope: 'user',
          recipient_id: adminEntry.authId,
          type: 'success',
          title: 'Backup completed',
          body: 'The nightly database backup completed successfully at 23:00.',
        },
      ]
    : [];

  // notifications has no natural unique key. Make the script idempotent
  // by clearing seed rows on each run that match (scope, title).
  const rows = [...broadcasts, ...directs];
  for (const r of rows) {
    const { error: delErr } = await supabase
      .from('notifications')
      .delete()
      .eq('scope', r.scope)
      .eq('title', r.title);
    if (delErr) {
      recordError('J', r.title, delErr);
      continue;
    }
    const { error } = await supabase.from('notifications').insert(r);
    if (error) {
      recordError('J', r.title, error);
      continue;
    }
    summary.notifications++;
  }
  console.log(`  ok: ${summary.notifications} notifications inserted`);
}

// ---------- step K: audit_logs ----------------------------------------

async function stepK_auditLogs(staffMap) {
  console.log(`\n[Step K] Inserting ${auditLogs.length} audit_logs rows…`);
  // Map mock display name -> staff authId (System -> null).
  const nameToAuthId = new Map();
  for (const [, s] of staffMap)
    nameToAuthId.set(s.fullName.toLowerCase(), s.authId);

  for (const log of auditLogs) {
    const actorId =
      log.user === 'System'
        ? null
        : (nameToAuthId.get(log.user.toLowerCase()) ?? null);
    // Re-anchor: shift the mock timestamp by the run's calendar-day
    // delta, preserving the original time-of-day.
    let createdAt = parseAuditTimestamp(log.timestamp);
    if (createdAt) {
      const [datePart, timePart] = createdAt.split('T');
      createdAt = `${shiftDateStr(datePart, ANCHOR_DAY_DELTA)}T${timePart}`;
    }

    // Idempotency: match on (actor_id, action) — created_at is
    // deliberately NOT matched, so seed rows written under a previous
    // anchor are replaced on re-run instead of piling up. The seeded
    // action strings are distinctive full sentences, so real
    // user-generated audit rows are not at risk.
    let q = supabase
      .from('audit_logs')
      .delete()
      .eq('action', log.action);
    if (actorId === null) q = q.is('actor_id', null);
    else q = q.eq('actor_id', actorId);
    const { error: delErr } = await q;
    if (delErr) {
      recordError('K', `${log.id} ${log.action.slice(0, 60)}`, delErr);
      continue;
    }

    const row = {
      actor_id: actorId,
      action: log.action,
      target_type: log.type,
      target_id: null,
      metadata: { mock_id: log.id, mock_user: log.user, ui_type: log.type },
      created_at: createdAt || undefined,
    };
    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) {
      recordError('K', `${log.id} ${log.action.slice(0, 60)}`, error);
      continue;
    }
    summary.auditLogs++;
  }
  console.log(`  ok: ${summary.auditLogs} audit logs inserted`);
}

// ---------- driver -----------------------------------------------------

async function main() {
  console.log('PRISM-AI mock-data migration starting');
  console.log(`  url:            ${SUPABASE_URL}`);
  console.log(`  staff password: ${STAFF_PASSWORD}`);
  console.log(`  mock anchor:    ${MOCK_TODAY}`);
  console.log(`  anchor date:    ${ANCHOR}`);
  console.log(
    `  day offset:     ${ANCHOR_DAY_DELTA >= 0 ? '+' : ''}${ANCHOR_DAY_DELTA} calendar day(s) from mock anchor`
  );
  console.log(
    `  school days:    ${SCHOOL_DAY_COUNT} attendance dates remapped`
  );

  // Sanity ping: try to list one row from years (set up by seed.sql).
  const { error: pingErr } = await supabase
    .from('years')
    .select('year_num')
    .limit(1);
  if (pingErr) {
    console.error(
      `\nERROR: cannot read public.years — is the schema migrated and seed.sql applied?\n  ${pingErr.message}`
    );
    process.exit(1);
  }

  const staffMap = await stepA_staffUsers();
  const parentMap = await stepB_parentUsers();

  const classSectionMap = await loadClassSections();
  if (classSectionMap.size === 0) {
    console.error(
      '\nERROR: no rows in class_sections. Apply supabase/seed.sql before running this script.'
    );
    process.exit(1);
  }

  await stepC_homeroomTeachers(staffMap, classSectionMap);

  const subjectCodeToId = await loadSubjects();
  await stepD_subjectTeachers(staffMap, subjectCodeToId);

  const studentMap = await stepE_students(classSectionMap);
  await stepF_parentStudents(parentMap, studentMap);
  await stepG_attendance(studentMap, staffMap, classSectionMap);
  await stepH_schoolEvents(staffMap);
  await stepI_aiModels();
  await stepJ_notifications(staffMap);
  await stepK_auditLogs(staffMap);

  // ---------- final summary -------------------------------------------
  console.log('\n=====================================================');
  console.log(' Migration summary');
  console.log('=====================================================');
  const rows = [
    ['Staff users created', summary.staffCreated],
    ['Staff users already existed', summary.staffExisting],
    ['Parent users created', summary.parentsCreated],
    ['Parent users already existed', summary.parentsExisting],
    ['Homerooms wired', summary.homeroomWired],
    ['Subject_teacher rows', summary.subjectTeachers],
    ['Students upserted', summary.students],
    ['Parent-student links', summary.parentLinks],
    ['Attendance rows', summary.attendance],
    ['School events', summary.events],
    ['AI models', summary.aiModels],
    ['Notifications', summary.notifications],
    ['Audit logs', summary.auditLogs],
  ];
  const labelWidth = Math.max(...rows.map((r) => r[0].length));
  for (const [k, v] of rows) {
    console.log(`  ${k.padEnd(labelWidth)}  ${v}`);
  }

  if (errors.length > 0) {
    console.log(`\nCompleted with ${errors.length} error(s):`);
    for (const e of errors) {
      console.log(`  [${e.step}] ${e.identifier}: ${e.message}`);
    }
    process.exit(2);
  } else {
    console.log('\nAll steps completed without errors.');
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
