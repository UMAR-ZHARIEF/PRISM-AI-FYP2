import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Calendar, Clock, CheckCircle, XCircle, AlertCircle, LogOut, Mail, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { parentChildData } from '../data/mockData';
import './ParentPortal.css';

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
  const { parent, child, attendanceHistory, notifications, weeklyStats, announcements } = parentChildData;
  const todayRecord = attendanceHistory[0];
  const [calMonth, setCalMonth] = useState(2); // March = 2 (0-indexed)
  const calYear = 2026;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build calendar
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const attendanceMap = {};
  attendanceHistory.forEach(r => {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    attendanceMap[key] = r.status;
  });

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const childInitials = child.name.split(' ').map(n => n[0]).join('').slice(0,2);
  const parentInitials = parent.name.split(' ').map(n => n[0]).join('').slice(0,2);
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
              <h1 className="pp-child-name">{child.name}</h1>
              <p className="pp-child-meta">
                <span>Class {child.class}</span>
                <span className="pp-dot-sep">&bull;</span>
                <span>Age {child.age}</span>
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

            <ol className="pp-history-list">
              {attendanceHistory.map((record, i) => (
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
          </div>
        </section>

        {/* === NOTIFICATIONS + CONTACT + ANNOUNCEMENTS === */}
        <section className="pp-grid reveal reveal-5">
          <div className="card pp-notif-card tilt-l">
            <span className="tape tl" />
            <header className="pp-card-head">
              <h2><Bell size={18} /> Notifications</h2>
            </header>

            <ul className="pp-notif-list">
              {notifications.map(n => (
                <li key={n.id} className="pp-notif-item">
                  <span className={`pp-notif-strip ${notifDotClass(n.message)}`} />
                  <div className="pp-notif-body">
                    <p>{n.message}</p>
                    <small>{n.date} at {n.time}</small>
                  </div>
                </li>
              ))}
            </ul>
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

              <ul className="pp-announce-list">
                {announcements.map(a => (
                  <li key={a.id} className="pp-announce-item">
                    <span className="pp-announce-date">
                      {new Date(a.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                    </span>
                    <div className="pp-announce-body">
                      <strong>{a.title}</strong>
                      <p>{a.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
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
