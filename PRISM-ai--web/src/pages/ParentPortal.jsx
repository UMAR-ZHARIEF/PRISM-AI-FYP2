import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Calendar, Clock, CheckCircle, XCircle, AlertCircle, LogOut, Mail, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useStudent from '../hooks/useStudent';
import useAttendance from '../hooks/useAttendance';
import useNotifications from '../hooks/useNotifications';
import useSchoolEvents from '../hooks/useSchoolEvents';
import { supabase } from '../lib/supabase';
import './ParentPortal.css';

// App "today" anchor — matches the demo data anchor used elsewhere (e.g. AttendanceCalendar).
const APP_TODAY = new Date(2026, 4, 11); // May 11, 2026

// Format a Date as 'YYYY-MM-DD' (local, no timezone shift)
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Format a 'HH:MM:SS' or 'HH:MM' SQL time to '07:45 AM' style.
function formatTime(t) {
  if (!t) return '-';
  const parts = t.split(':');
  if (parts.length < 2) return '-';
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  if (Number.isNaN(h)) return '-';
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

// Age in whole years from an ISO dob string (YYYY-MM-DD). Returns null if unknown.
function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = APP_TODAY.getFullYear() - d.getFullYear();
  const m = APP_TODAY.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && APP_TODAY.getDate() < d.getDate())) age -= 1;
  return age;
}

const statusIcon = {
  present: <CheckCircle size={16} />,
  absent: <XCircle size={16} />,
  late: <AlertCircle size={16} />,
};

const statusWord = { present: 'Present', absent: 'Absent', late: 'Late' };
const statusDotColor = { present: 'var(--green)', absent: 'var(--red)', late: 'var(--orange)' };

// Notification type → coloured paper dot
const notifDotClass = (msg) => {
  if (msg.toLowerCase().includes('absent')) return 'pp-dot-red';
  if (msg.toLowerCase().includes('late'))   return 'pp-dot-orange';
  if (msg.toLowerCase().includes('checked in')) return 'pp-dot-green';
  return 'pp-dot-blue';
};

export default function ParentPortal() {
  const { user, profile } = useAuth();
  const parentId = user ? user.id : null;

  // ── Resolve the child from parent_students (inline — only used here) ──
  // For families with multiple linked students, we take the primary
  // (is_primary=true) link first; otherwise we fall back to the first row.
  const [childId, setChildId] = useState(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const [linkError, setLinkError] = useState(null);
  const [hasNoChildren, setHasNoChildren] = useState(false);

  useEffect(() => {
    if (!parentId) {
      setLinkLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLinkLoading(true);
    setLinkError(null);
    setHasNoChildren(false);

    supabase
      .from('parent_students')
      .select('student_id, is_primary')
      .eq('parent_id', parentId)
      .order('is_primary', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('ParentPortal: failed to load parent_students link', error);
          setLinkError(error);
          setChildId(null);
        } else if (!data || data.length === 0) {
          setHasNoChildren(true);
          setChildId(null);
        } else {
          setChildId(data[0].student_id);
        }
        setLinkLoading(false);
      });

    return () => { cancelled = true; };
  }, [parentId]);

  // ── Hooks fed by the resolved child ──
  const { student, loading: studentLoading, error: studentError } = useStudent(childId);
  const { records: attendanceRecords, loading: attendanceLoading } = useAttendance({ studentId: childId });
  const { notifications, loading: notifLoading } = useNotifications();

  // Upcoming school events: next 30 days from "today"
  const eventFromDate = useMemo(() => toISODate(APP_TODAY), []);
  const eventToDate = useMemo(() => {
    const end = new Date(APP_TODAY);
    end.setDate(end.getDate() + 30);
    return toISODate(end);
  }, []);
  const { events, loading: eventsLoading } = useSchoolEvents({ fromDate: eventFromDate, toDate: eventToDate });

  // ── Calendar state (preserved from original) ──
  const [calMonth, setCalMonth] = useState(APP_TODAY.getMonth());
  const calYear = APP_TODAY.getFullYear();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build a UI-shaped attendance history from DB records.
  // DB: { date, status: 'present'|'absent'|'late', arrival_time: 'HH:MM:SS' }
  // UI: { date, status, timeIn, timeOut }
  const attendanceHistory = useMemo(() => {
    return (attendanceRecords || []).map((r) => ({
      date: r.date,
      status: r.status,
      timeIn: r.status === 'absent' ? '-' : formatTime(r.arrival_time),
      timeOut: '-', // not stored in DB; preserve UI slot
    }));
  }, [attendanceRecords]);

  // Weekly stats — last 7 calendar days (relative to APP_TODAY) using DB records.
  const weeklyStats = useMemo(() => {
    const weekAgo = new Date(APP_TODAY);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = toISODate(weekAgo);
    const todayStr = toISODate(APP_TODAY);
    let present = 0, absent = 0, late = 0;
    (attendanceRecords || []).forEach((r) => {
      if (r.date >= weekAgoStr && r.date <= todayStr) {
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'late') late++;
      }
    });
    const total = present + late + absent;
    const onTimeRate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, onTimeRate };
  }, [attendanceRecords]);

  // Calendar grid
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const attendanceMap = useMemo(() => {
    const map = {};
    attendanceHistory.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = r.status;
    });
    return map;
  }, [attendanceHistory]);

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // ── Loading state (still resolving link or child profile) ──
  const isInitialLoading = !parentId || linkLoading || (childId && studentLoading);
  if (isInitialLoading) {
    return (
      <div className="parent-portal">
        <span className="tape page-tape-tl" />
        <span className="tape page-tape-tr" />
        <div className="pp-content">
          <div className="pp-state pp-state-loading">
            <p>Loading your child&apos;s information&hellip;</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state: no parent_students link ──
  if (hasNoChildren || (!childId && !linkError)) {
    return (
      <div className="parent-portal">
        <span className="tape page-tape-tl" />
        <span className="tape page-tape-tr" />
        <nav className="pp-nav">
          <div className="pp-nav-container">
            <Link to="/" className="pp-nav-logo">
              <span className="pp-nav-mark">P/A</span>
              <span className="pp-nav-name">PRISM-AI</span>
            </Link>
            <div className="pp-nav-right">
              <Link to="/login" className="pp-logout" aria-label="sign out">
                <LogOut size={18} />
              </Link>
            </div>
          </div>
        </nav>
        <div className="pp-content">
          <div className="pp-state pp-state-empty">
            <h2>No children linked to this account.</h2>
            <p>Contact the school administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (linkError || studentError) {
    return (
      <div className="parent-portal">
        <span className="tape page-tape-tl" />
        <span className="tape page-tape-tr" />
        <div className="pp-content">
          <div className="pp-state pp-state-error">
            <p>We couldn&apos;t load your dashboard. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived display values ──
  const childName = (student && student.full_name) || '';
  const childClassName = (student && student.class_section && student.class_section.name) || '';
  const childAge = student ? ageFromDob(student.dob) : null;
  const parentName = (profile && profile.full_name) || '';

  const childInitials = childName
    ? childName.split(' ').map((n) => n[0]).join('').slice(0, 2)
    : '??';
  const parentInitials = parentName
    ? parentName.split(' ').map((n) => n[0]).join('').slice(0, 2)
    : '';

  // Today's record drives the banner. If there's no record for today yet, fall back
  // to a synthetic 'present' record so the banner doesn't crash; the badge still
  // updates as soon as today's row appears.
  const todayStr = toISODate(APP_TODAY);
  const todayRecord =
    attendanceHistory.find((r) => r.date === todayStr) ||
    attendanceHistory[0] ||
    { status: 'present', timeIn: '-', timeOut: '-' };

  const isPresent = todayRecord.status === 'present';
  const isAbsent  = todayRecord.status === 'absent';

  return (
    <div className="parent-portal">
      <span className="tape page-tape-tl" />
      <span className="tape page-tape-tr" />

      {/* === NAV === */}
      <nav className="pp-nav">
        <div className="pp-nav-container">
          <Link to="/" className="pp-nav-logo">
            <span className="pp-nav-mark">P/A</span>
            <span className="pp-nav-name">PRISM-AI</span>
          </Link>

          <div className="pp-nav-right">
            <button className="pp-bell" aria-label="notifications">
              <Bell size={20} />
              <span className="pp-bell-count">{notifications.length}</span>
            </button>
            <div className="avatar k pp-nav-avatar">{parentInitials}</div>
            <Link to="/login" className="pp-logout" aria-label="sign out">
              <LogOut size={18} />
            </Link>
          </div>
        </div>
      </nav>

      <div className="pp-content">
        {/* === STATUS BANNER (cut paper, green if present, red if absent, orange if late) === */}
        <section className={`pp-banner ${isPresent ? 'pp-banner-present' : isAbsent ? 'pp-banner-absent' : 'pp-banner-late'} reveal reveal-2`}>
          <span className="tape tl" />
          <span className="tape br" />

          <div className="pp-banner-left">
            <div className={`avatar ${isPresent ? 'g' : isAbsent ? 'r' : 'o'} pp-child-avatar`}>{childInitials}</div>
            <div className="pp-banner-text">
              <h1 className="pp-child-name">{childName}</h1>
              <p className="pp-child-meta">
                <span>Class {childClassName}</span>
                {childAge != null && (
                  <>
                    <span className="pp-dot-sep">&bull;</span>
                    <span>Age {childAge}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="pp-banner-right">
            <span className={`badge badge-${todayRecord.status} pp-banner-badge`}>
              {statusIcon[todayRecord.status]} {statusWord[todayRecord.status]} Today
            </span>
            {todayRecord.timeIn !== '-' && (
              <div className="pp-banner-time">
                <small>Arrived at {todayRecord.timeIn}</small>
              </div>
            )}
          </div>
        </section>

        {/* === STATS === */}
        <section className="pp-stats grid-4 reveal reveal-3">
          <div className="stat-card s-green pp-stat pp-stat-1">
            <div className="stat-info">
              <h3>{weeklyStats.present}</h3>
              <p>Days Present</p>
            </div>
          </div>
          <div className="stat-card s-red pp-stat pp-stat-2">
            <div className="stat-info">
              <h3>{weeklyStats.absent}</h3>
              <p>Days Absent</p>
            </div>
          </div>
          <div className="stat-card s-orange pp-stat pp-stat-3">
            <div className="stat-info">
              <h3>{weeklyStats.late}</h3>
              <p>Days Late</p>
            </div>
          </div>
          <div className="stat-card s-blue pp-stat pp-stat-4">
            <div className="stat-info">
              <h3>{weeklyStats.onTimeRate}<span className="pp-pct">%</span></h3>
              <p>On-Time Rate</p>
            </div>
          </div>
        </section>

        {/* === CALENDAR + HISTORY === */}
        <section className="pp-grid reveal reveal-4">
          <div className="card pp-cal-card tilt-l">
            <span className="tape tl" />
            <span className="tape tr" />
            <header className="pp-card-head">
              <h2><Calendar size={18} /> Attendance Calendar</h2>
            </header>

            <div className="pp-cal-nav">
              <button className="pp-cal-arrow" onClick={() => setCalMonth(m => Math.max(0, m - 1))} aria-label="previous month">
                <ChevronLeft size={18} />
              </button>
              <strong className="pp-cal-month">{monthNames[calMonth]} {calYear}</strong>
              <button className="pp-cal-arrow" onClick={() => setCalMonth(m => Math.min(11, m + 1))} aria-label="next month">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="pp-cal-grid">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="pp-cal-head">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`e${i}`} className="pp-cal-cell pp-cal-empty" />;
                const key = `${calYear}-${calMonth}-${day}`;
                const status = attendanceMap[key];
                const dow = new Date(calYear, calMonth, day).getDay();
                const isWeekend = dow === 0 || dow === 6;
                const cls = status ? `pp-cal-${status}` : (isWeekend ? 'pp-cal-weekend' : 'pp-cal-day');
                return (
                  <div key={i} className={`pp-cal-cell ${cls}`}>
                    <span className="pp-cal-num">{day}</span>
                  </div>
                );
              })}
            </div>

            <div className="pp-cal-legend">
              <span><span className="pp-legend-chip pp-legend-green" /> Present</span>
              <span><span className="pp-legend-chip pp-legend-red" /> Absent</span>
              <span><span className="pp-legend-chip pp-legend-orange" /> Late</span>
              <span><span className="pp-legend-chip pp-legend-paper" /> Weekend</span>
            </div>
          </div>

          <div className="card pp-history-card tilt-r">
            <span className="tape tl" />
            <header className="pp-card-head">
              <h2><Clock size={18} /> Attendance History</h2>
            </header>

            {attendanceLoading && attendanceHistory.length === 0 ? (
              <p className="pp-empty-hint">Loading attendance&hellip;</p>
            ) : attendanceHistory.length === 0 ? (
              <p className="pp-empty-hint">No attendance records yet.</p>
            ) : (
              <ol className="pp-history-list">
                {attendanceHistory.slice(0, 14).map((record, i) => (
                  <li key={i} className={`pp-history-item pp-history-${record.status}`}>
                    <div className="pp-history-date">
                      <strong>{new Date(record.date).toLocaleDateString('en-MY', { weekday: 'short' })}</strong>
                      <span>{new Date(record.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="pp-history-mid">
                      <span className={`badge badge-${record.status}`}>
                        {statusWord[record.status]}
                      </span>
                    </div>
                    <div className="pp-history-time">
                      {record.timeIn !== '-' ? (
                        <><Clock size={14} /> {record.timeIn} &mdash; {record.timeOut}</>
                      ) : (
                        <span className="pp-history-empty">&mdash;</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* === NOTIFICATIONS + CONTACT + ANNOUNCEMENTS === */}
        <section className="pp-grid reveal reveal-5">
          <div className="card pp-notif-card tilt-l">
            <span className="tape tl" />
            <header className="pp-card-head">
              <h2><Bell size={18} /> Notifications</h2>
            </header>

            {notifLoading && notifications.length === 0 ? (
              <p className="pp-empty-hint">Loading notifications&hellip;</p>
            ) : notifications.length === 0 ? (
              <p className="pp-empty-hint">No notifications yet.</p>
            ) : (
              <ul className="pp-notif-list">
                {notifications.map(n => {
                  const body = n.body || n.message || '';
                  const created = n.created_at ? new Date(n.created_at) : null;
                  const dateStr = created
                    ? created.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                  const timeStr = created
                    ? created.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <li key={n.id} className="pp-notif-item">
                      <span className={`pp-notif-strip ${notifDotClass(body)}`} />
                      <div className="pp-notif-body">
                        <p>{body}</p>
                        <small>{dateStr}{timeStr ? ` at ${timeStr}` : ''}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="pp-side-col">
            <div className="card pp-contact-card">
              <span className="tape tr" />
              <header className="pp-card-head">
                <h2><Mail size={18} /> Contact Teacher</h2>
              </header>

              <div className="pp-teacher">
                <div className="avatar y pp-teacher-avatar">CF</div>
                <div className="pp-teacher-info">
                  <strong>Cikgu Fatimah</strong>
                  <small>Class Bestari Teacher</small>
                </div>
              </div>

              <button className="btn btn-primary pp-contact-btn">
                <Mail size={16} /> Send Message
              </button>
            </div>

            <div className="card pp-announce-card">
              <span className="tape tl" />
              <header className="pp-card-head">
                <h2><Megaphone size={18} /> Announcements</h2>
              </header>

              {eventsLoading && events.length === 0 ? (
                <p className="pp-empty-hint">Loading announcements&hellip;</p>
              ) : events.length === 0 ? (
                <p className="pp-empty-hint">No upcoming announcements.</p>
              ) : (
                <ul className="pp-announce-list">
                  {events.map(a => (
                    <li key={a.id} className="pp-announce-item">
                      <span className="pp-announce-date">
                        {new Date(a.event_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                      </span>
                      <div className="pp-announce-body">
                        <strong>{a.title}</strong>
                        {a.description && <p>{a.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="pp-footer">
        <p>PRISM-AI &copy; 2026 &mdash; Final Year Project, UniKL</p>
      </footer>
    </div>
  );
}
