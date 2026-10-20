import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, UserCheck, UserX, Clock, ClipboardCheck, Mail, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../lib/supabase';
import useClassSections from '../hooks/useClassSections';
import useStudents from '../hooks/useStudents';
import useAttendance from '../hooks/useAttendance';
import { attendanceRate } from '../lib/attendanceRate';
import { useAuth } from '../contexts/AuthContext';
import { SkeletonCard, SkeletonChart } from '../components/Skeleton';
import './ClassDetail.css';

const WORD_COLOR_MAP = {
  Bestari: 'b',
  Bijak:   'r',
  Cerdik:  'g',
  Cerdas:  'o',
  Pandai:  'y',
};

const AVA_COLORS = ['r', 'y', 'b', 'g', 'o'];

// Format a Date as 'YYYY-MM-DD' (local, no timezone shift)
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ClassDetail() {
  const { year, className } = useParams();
  const yearNum = Number(year);

  // URL gate: validated against the loaded sections, not static constants.
  // While sections load, the page renders its skeleton; after they load, a URL
  // matching a real section passes and a genuinely unknown one does not.
  const yearIsNumeric = Number.isFinite(yearNum);

  // Last 7 days window (inclusive of today)
  const { fromDate, toDate, todayISO, weekDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    const iso = (d) => toLocalISODate(d);
    return {
      fromDate: iso(days[0]),
      toDate: iso(days[days.length - 1]),
      todayISO: iso(today),
      weekDays: days,
    };
  }, []);

  // Resolve class section from URL params
  const { classSections, loading: sectionsLoading, error: sectionsError } =
    useClassSections({ year: yearIsNumeric ? yearNum : undefined });

  const section = useMemo(
    () => (classSections || []).find(cs => cs.name === className && cs.year_num === yearNum),
    [classSections, className, yearNum]
  );

  // Teacher scoping: if a teacher is viewing a class outside their homeroom(s),
  // surface a small informational note. Admins (and teachers viewing their own
  // homeroom) never see it.
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  // Distinguish "genuinely not found" from "not yours": when the loaded
  // sections miss the URL, re-check ALL class_sections with a separate query.
  // A class that exists but is not this teacher's renders read-only instead
  // of a false "Class Not Found".
  const sectionMissing = !sectionsLoading && !sectionsError && !section;
  const checkKey = sectionMissing && isTeacher && yearIsNumeric && className
    ? `${yearNum}/${className}`
    : null;
  const [unscoped, setUnscoped] = useState({ key: null, checking: false, section: null });
  useEffect(() => {
    if (checkKey == null) return undefined;
    let cancelled = false;
    supabase
      .from('class_sections')
      .select('*, homeroom_teacher:profiles(*)')
      .eq('year_num', yearNum)
      .eq('name', className)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setUnscoped({ key: checkKey, checking: false, section: data || null });
      });
    return () => { cancelled = true; };
  }, [checkKey, yearNum, className]);
  // Only the result for the URL currently being resolved counts; anything
  // else is a stale entry from a previous navigation.
  const unscopedActive = unscoped.key != null && unscoped.key === checkKey ? unscoped : null;
  const unscopedChecking = checkKey != null && (unscopedActive == null || unscopedActive.checking);

  // Fallback row from the unscoped re-check, used when the loaded sections
  // missed the URL but the class genuinely exists (it is just not ours).
  const notYoursSection = unscopedChecking ? null : unscopedActive?.section ?? null;
  const resolvedSection = section || notYoursSection;
  const classSectionId = resolvedSection?.id;
  const teacher = resolvedSection?.homeroom_teacher || null;

  // Outside the teacher's homeroom (any year): read-only view. Hides the
  // Take Attendance shortcut together with the scope note below.
  const isOutsideHomeroom = isTeacher && !!resolvedSection && resolvedSection.homeroom_teacher_id !== profile?.id;
  const showOutsideHomeroomNote = isOutsideHomeroom;

  const { students: dbStudents, loading: studentsLoading, error: studentsError } =
    useStudents({ classSectionId });

  const { records, loading: attLoading, error: attError } = useAttendance({
    classSectionId,
    fromDate,
    toDate,
  });

  const classStudents = useMemo(() => (dbStudents || []).map(row => {
    let age = null;
    if (row.dob) {
      const dob = new Date(row.dob);
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
    }
    const g = String(row.gender || '').toLowerCase();
    return {
      id: row.id,
      name: row.full_name || '',
      gender: g.startsWith('f') ? 'F' : 'M',
      age,
      parent: '',
    };
  }), [dbStudents]);

  // Group records by student to compute per-student last-7-days attendance rate.
  // Group records by date to build the weekly chart.
  const { todayByStudent, ratesByStudent, weekly } = useMemo(() => {
    const byStudent = new Map();
    const byDate = new Map();
    const today = new Map();
    for (const r of records || []) {
      const sid = r.student_id;
      const status = String(r.status || '').toLowerCase();
      const date = r.date;

      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid).push(r);

      if (!byDate.has(date)) byDate.set(date, { present: 0, absent: 0, late: 0 });
      const bucket = byDate.get(date);
      if (status === 'present') bucket.present += 1;
      else if (status === 'absent') bucket.absent += 1;
      else if (status === 'late') bucket.late += 1;

      if (date === todayISO) today.set(sid, status);
    }

    // Shared utility: rate = (present + late) / total. Null means the student
    // has no records; the card then renders '—' instead of a fake 0%.
    const rates = new Map();
    for (const [sid, recs] of byStudent.entries()) {
      const { rate } = attendanceRate(recs);
      rates.set(sid, rate != null ? Math.round(rate) : null);
    }

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = weekDays.map(d => {
      const key = toLocalISODate(d);
      const bucket = byDate.get(key) || { present: 0, absent: 0, late: 0 };
      return { day: DAY_LABELS[d.getDay()], ...bucket };
    });

    return { todayByStudent: today, ratesByStudent: rates, weekly: weeklyData };
  }, [records, todayISO, weekDays]);

  const todayRecords = useMemo(
    () => (records || []).filter(r => r.date === todayISO),
    [records, todayISO]
  );
  const presentCount = todayRecords.filter(r => String(r.status).toLowerCase() === 'present').length;
  const absentCount  = todayRecords.filter(r => String(r.status).toLowerCase() === 'absent').length;
  const lateCount    = todayRecords.filter(r => String(r.status).toLowerCase() === 'late').length;

  const wordColor = WORD_COLOR_MAP[className] || 'k';

  // Not-found state — only after sections have loaded and, for teachers, the
  // unscoped existence re-check has settled without a row either (a bad year
  // yields no match in either query, so it lands here too).
  if (sectionMissing && unscopedChecking) {
    return (
      <div className="classdetail-page">
        <div className="card classdetail-empty">
          <span className="tape tl" />
          <SkeletonCard />
        </div>
      </div>
    );
  }
  if (sectionMissing) {
    return (
      <div className="classdetail-page">
        <div className="page-header classdetail-header">
          <div>
            <h1><span className="word k">Class Not Found</span></h1>
            <p className="page-subtitle">The class "{className}" (Year {year}) does not exist.</p>
          </div>
        </div>
        <div className="card classdetail-empty">
          <span className="tape tl" />
          <UserX size={48} />
          <h3>Unknown Class</h3>
          <p>Please check the URL or go back to the dashboard.</p>
          <Link to="/dashboard" className="btn btn-primary">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Error state — show inline if any hook failed once it stopped loading.
  const anyError = sectionsError || studentsError || attError;
  if (anyError && !sectionsLoading && !studentsLoading && !attLoading) {
    return (
      <div className="classdetail-page">
        <Link to="/dashboard" className="pencil-link classdetail-back">
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
        <div className="card classdetail-empty">
          <span className="tape tl" />
          <UserX size={48} />
          <h3>Could not load class</h3>
          <p className="accent">Something went wrong while fetching this class. Try again later.</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Students', value: classStudents.length, tone: 's-blue',   icon: <Users size={20} /> },
    { label: 'Present Today',  value: presentCount,         tone: 's-green',  icon: <UserCheck size={20} /> },
    { label: 'Absent Today',   value: absentCount,          tone: 's-red',    icon: <UserX size={20} /> },
    { label: 'Late Today',     value: lateCount,            tone: 's-orange', icon: <Clock size={20} /> },
  ];

  const getStudentStatus = (studentId) => {
    // No record today = unmarked, not absent: return null so the badge
    // renders a neutral "Not marked" state instead of a red Absent badge
    // (stat cards count 0 absent for these students).
    return todayByStudent.get(studentId) ?? null;
  };

  // Initial loading skeleton — render while we resolve the section and
  // before any students/attendance data is available.
  const initialLoading = sectionsLoading || (!!classSectionId && (studentsLoading || attLoading) && classStudents.length === 0);

  return (
    <div className="classdetail-page">
      {/* BACK LINK */}
      <Link to="/dashboard" className="pencil-link classdetail-back">
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* TEACHER-SCOPE NOTE: viewing a class outside their homeroom */}
      {showOutsideHomeroomNote && (
        <div className="classdetail-scope-note" role="note">
          <span className="tape tl" />
          <Info size={18} />
          <p>
            {notYoursSection
              ? `You don't teach Year ${yearNum} ${className}. This class belongs to another teacher. Showing read-only stats.`
              : 'You are viewing a class outside your homeroom. Showing read-only stats.'}
          </p>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="page-header classdetail-header">
        <div className="classdetail-header-left">
          <h1><span className={`word ${wordColor}`}>{className}</span></h1>
          <p className="page-subtitle">Year {yearNum} &middot; {teacher?.full_name || 'No teacher assigned'}</p>
          {teacher && (
            <div className="classdetail-teacher-info">
              <p className="classdetail-teacher-email">
                <Mail size={14} /> {teacher.email || ''}
              </p>
            </div>
          )}
        </div>
        {/* Outside the teacher's homeroom this page is read-only: the full
            marking flow stays out of reach (attendance picker remains the
            deliberate all-classes entry point). */}
        {!isOutsideHomeroom && (
          <div className="page-header-actions">
            <Link to={`/dashboard/attendance/${yearNum}/${className}`} className="btn btn-green">
              <ClipboardCheck size={16} /> Take Attendance
            </Link>
          </div>
        )}
      </div>

      {/* STAT CARDS */}
      <div className="grid-4 classdetail-section">
        {statCards.map((s, i) => (
          <div key={i} className={`stat-card ${s.tone} reveal reveal-${i + 1}`}>
            <span className={`tape ${i % 2 === 0 ? 'tl' : 'tr'}`} />
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* STUDENT LIST */}
      <div className="classdetail-section">
        <div className="classdetail-section-title">
          <h2>Students in {className}</h2>
          <span className="classdetail-count mono">{classStudents.length} students</span>
        </div>
        {initialLoading ? (
          <div className="classdetail-student-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : classStudents.length === 0 ? (
          <div className="card classdetail-empty">
            <span className="tape tl" />
            <Users size={40} />
            <p>No students enrolled in this class yet.</p>
          </div>
        ) : (
          <div className="classdetail-student-grid">
            {classStudents.map((s, index) => {
              const status = getStudentStatus(s.id);
              const avatarColor = AVA_COLORS[index % AVA_COLORS.length];
              const tapeSpots = ['tl', 'tr', 'br', 'bl'];
              const tapeSpot = tapeSpots[index % tapeSpots.length];
              const initials = s.name.split(' ').map(n => n[0]).join('').slice(0, 2);
              const rate = ratesByStudent.get(s.id);
              const hasRate = rate != null;

              return (
                <Link
                  key={s.id}
                  to={`/dashboard/students/${s.id}`}
                  className="card classdetail-student-card"
                >
                  <span className={`tape ${tapeSpot}`} />
                  <div className="classdetail-student-top">
                    <div className={`avatar ${avatarColor} classdetail-avatar`}>{initials}</div>
                    <div className="classdetail-student-identity">
                      <h4 className="classdetail-student-name">{s.name}</h4>
                      <p className="classdetail-student-meta mono">
                        {s.age != null ? `Age ${s.age} · ` : ''}{s.gender === 'M' ? 'Male' : 'Female'}
                      </p>
                    </div>
                    {status ? (
                      <span className={`badge badge-${status}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    ) : (
                      <span className="badge badge-info">Not marked</span>
                    )}
                  </div>
                  <div className="classdetail-student-bottom">
                    <div className="classdetail-rate-block">
                      <span className="classdetail-rate-label accent">Attendance</span>
                      <div className="classdetail-rate-bar-row">
                        <div className="classdetail-rate-track">
                          <div
                            className="classdetail-rate-fill"
                            style={{
                              width: `${hasRate ? rate : 0}%`,
                              background: !hasRate ? 'transparent' : rate >= 90 ? 'var(--green)' : rate >= 80 ? 'var(--yellow)' : 'var(--red)',
                            }}
                          />
                        </div>
                        <span className="classdetail-rate-value mono">{hasRate ? `${rate}%` : '—'}</span>
                      </div>
                    </div>
                    {s.parent ? (
                      <p className="classdetail-parent-name">Parent: {s.parent}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* WEEKLY ATTENDANCE CHART */}
      {attLoading && !records?.length ? (
        <SkeletonChart />
      ) : (
        <div className="card classdetail-chart-card classdetail-section">
          <span className="tape tl" />
          <div className="chart-head">
            <h2>Weekly Attendance</h2>
            <span className="classdetail-chart-subtitle accent">Weekly Attendance Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
              <XAxis dataKey="day" fontSize={12} stroke="#1F1A12" />
              <YAxis fontSize={12} stroke="#1F1A12" />
              <Tooltip cursor={{ fill: 'rgba(31,26,18,0.06)' }} />
              <Legend />
              <Bar dataKey="present" fill="#4FA764" name="Present" radius={[2, 2, 0, 0]} />
              <Bar dataKey="absent"  fill="#E04A3F" name="Absent"  radius={[2, 2, 0, 0]} />
              <Bar dataKey="late"    fill="#EA8534" name="Late"    radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
