import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Bell, Calendar, Clock, CheckCircle, XCircle, AlertCircle, LogOut, User, Mail, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { parentChildData } from '../data/mockData';
import './ParentPortal.css';

const statusIcon = {
  present: <CheckCircle size={16} color="var(--success)" />,
  absent: <XCircle size={16} color="var(--danger)" />,
  late: <AlertCircle size={16} color="var(--warning)" />,
};

const statusColor = { present: 'var(--success)', absent: 'var(--danger)', late: 'var(--warning)' };

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

  return (
    <div className="parent-portal">
      {/* NAV */}
      <nav className="parent-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo"><Camera size={24} /><span>PRISM-AI</span></Link>
          <div className="parent-nav-right">
            <div className="parent-notif-btn">
              <Bell size={20} />
              <span className="parent-notif-count">{notifications.length}</span>
            </div>
            <div className="avatar">{parent.name.split(' ').map(n => n[0]).join('')}</div>
            <Link to="/login"><LogOut size={18} color="var(--text-light)" /></Link>
          </div>
        </div>
      </nav>

      <div className="parent-content">
        {/* HERO */}
        <div className="parent-hero">
          <div className="parent-child-info">
            <div className="child-avatar-lg"><User size={40} /></div>
            <div>
              <h1>{child.name}</h1>
              <p>Class {child.class} &bull; Age {child.age}</p>
            </div>
          </div>
          <div className={`today-status status-${todayRecord.status}`}>
            {statusIcon[todayRecord.status]}
            <span>{todayRecord.status.charAt(0).toUpperCase() + todayRecord.status.slice(1)} Today</span>
            {todayRecord.timeIn !== '-' && <small>Arrived at {todayRecord.timeIn}</small>}
          </div>
        </div>

        {/* WEEKLY STATS */}
        <div className="quick-stats">
          <div className="quick-stat-card">
            <h3>{weeklyStats.present}</h3>
            <p>Days Present</p>
          </div>
          <div className="quick-stat-card">
            <h3>{weeklyStats.absent}</h3>
            <p>Days Absent</p>
          </div>
          <div className="quick-stat-card">
            <h3>{weeklyStats.late}</h3>
            <p>Days Late</p>
          </div>
          <div className="quick-stat-card">
            <h3>{weeklyStats.onTimeRate}%</h3>
            <p>On-Time Rate</p>
          </div>
        </div>

        {/* CALENDAR + HISTORY */}
        <div className="parent-grid">
          <div className="card">
            <div className="card-header">
              <h2><Calendar size={18} /> Attendance Calendar</h2>
            </div>
            <div className="calendar-nav">
              <button onClick={() => setCalMonth(m => Math.max(0, m - 1))}><ChevronLeft size={18} /></button>
              <strong>{monthNames[calMonth]} {calYear}</strong>
              <button onClick={() => setCalMonth(m => Math.min(11, m + 1))}><ChevronRight size={18} /></button>
            </div>
            <div className="calendar-grid">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="cal-header">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`e${i}`} className="cal-day empty" />;
                const key = `${calYear}-${calMonth}-${day}`;
                const status = attendanceMap[key];
                const isWeekend = new Date(calYear, calMonth, day).getDay() === 0 || new Date(calYear, calMonth, day).getDay() === 6;
                return (
                  <div key={i} className={`cal-day ${isWeekend ? 'weekend' : ''}`}>
                    <span className="cal-num">{day}</span>
                    {status && <span className="cal-dot" style={{ background: statusColor[status] }} />}
                  </div>
                );
              })}
            </div>
            <div className="cal-legend">
              <span><span className="cal-dot-sm" style={{ background: 'var(--success)' }} /> Present</span>
              <span><span className="cal-dot-sm" style={{ background: 'var(--danger)' }} /> Absent</span>
              <span><span className="cal-dot-sm" style={{ background: 'var(--warning)' }} /> Late</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2><Clock size={18} /> Attendance History</h2></div>
            <div className="history-list">
              {attendanceHistory.map((record, i) => (
                <div key={i} className="history-item">
                  <div className="history-date">
                    <strong>{new Date(record.date).toLocaleDateString('en-MY', { weekday: 'short' })}</strong>
                    <span>{new Date(record.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="history-status">
                    {statusIcon[record.status]}
                    <span className={`badge badge-${record.status}`}>{record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span>
                  </div>
                  <div className="history-time">
                    {record.timeIn !== '-' ? (
                      <><Clock size={14} /> {record.timeIn} &mdash; {record.timeOut}</>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>&mdash;</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS + CONTACT + ANNOUNCEMENTS */}
        <div className="parent-grid parent-grid-mt">
          <div className="card">
            <div className="card-header"><h2><Bell size={18} /> Notifications</h2></div>
            <div className="parent-notif-list">
              {notifications.map(n => (
                <div key={n.id} className="parent-notif-item">
                  <div className="parent-notif-dot-item" />
                  <div>
                    <p>{n.message}</p>
                    <small>{n.date} at {n.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card parent-card-mb">
              <div className="card-header"><h2><Mail size={18} /> Contact Teacher</h2></div>
              <div className="contact-teacher">
                <div className="teacher-info">
                  <div className="avatar">CF</div>
                  <div>
                    <strong>Cikgu Fatimah</strong>
                    <small>Class Cempaka Teacher</small>
                  </div>
                </div>
                <button className="btn btn-primary contact-btn">
                  <Mail size={16} /> Send Message
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2><Megaphone size={18} /> Announcements</h2></div>
              <div className="announcements-list">
                {announcements.map(a => (
                  <div key={a.id} className="announcement-item">
                    <div className="announcement-date">{new Date(a.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</div>
                    <div>
                      <strong>{a.title}</strong>
                      <p>{a.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="parent-footer">
        <p>PRISM-AI &copy; 2026 &mdash; Final Year Project, UniKL</p>
      </footer>
    </div>
  );
}
