import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, UserCheck, UserX, Clock, ClipboardCheck, Mail } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { students, classes, classColors, attendanceToday, classAttendance, weeklyAttendance, users, years } from '../data/mockData';
import { useToast } from '../components/Toast';
import './ClassDetail.css';

const WORD_COLOR_MAP = {
  Bestari: 'b',
  Bijak:   'r',
  Cerdik:  'g',
  Cerdas:  'o',
  Pandai:  'y',
};

const AVA_COLORS = ['r', 'y', 'b', 'g', 'o'];

export default function ClassDetail() {
  const { year, className } = useParams();
  const toast = useToast();
  const yearNum = Number(year);

  const isValidClass = classes.includes(className);
  const isValidYear = years.includes(yearNum);

  const teacher = useMemo(
    () => users.find(u => u.role === 'homeroom' && u.class === className && u.year === yearNum),
    [className, yearNum]
  );

  const classStudents = useMemo(
    () => students.filter(s => s.class === className && s.year === yearNum),
    [className, yearNum]
  );

  const todayRecords = useMemo(
    () => attendanceToday.filter(a => a.class === className && a.year === yearNum),
    [className, yearNum]
  );

  const classStats = useMemo(
    () => classAttendance.find(c => c.class === className && c.year === yearNum),
    [className, yearNum]
  );

  const presentCount = todayRecords.filter(a => a.status === 'present').length;
  const absentCount  = todayRecords.filter(a => a.status === 'absent').length;
  const lateCount    = todayRecords.filter(a => a.status === 'late').length;

  const wordColor = WORD_COLOR_MAP[className] || 'k';
  const classColor = classColors[className] || 'var(--ink)';

  // Not-found state
  if (!isValidClass || !isValidYear) {
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

  const statCards = [
    { label: 'Total Students', value: classStudents.length, tone: 's-blue',   icon: <Users size={20} /> },
    { label: 'Present Today',  value: presentCount,         tone: 's-green',  icon: <UserCheck size={20} /> },
    { label: 'Absent Today',   value: absentCount,          tone: 's-red',    icon: <UserX size={20} /> },
    { label: 'Late Today',     value: lateCount,            tone: 's-orange', icon: <Clock size={20} /> },
  ];

  const getStudentStatus = (studentId) => {
    const record = attendanceToday.find(a => a.studentId === studentId);
    return record ? record.status : 'absent';
  };

  return (
    <div className="classdetail-page">
      {/* BACK LINK */}
      <Link to="/dashboard" className="pencil-link classdetail-back">
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* PAGE HEADER */}
      <div className="page-header classdetail-header">
        <div className="classdetail-header-left">
          <h1><span className={`word ${wordColor}`}>{className}</span></h1>
          <p className="page-subtitle">Year {yearNum} &middot; {teacher?.name || 'No teacher assigned'}</p>
          {teacher && (
            <div className="classdetail-teacher-info">
              <p className="classdetail-teacher-email">
                <Mail size={14} /> {teacher.email}
              </p>
            </div>
          )}
        </div>
        <div className="page-header-actions">
          <Link to={`/dashboard/attendance/${yearNum}/${className}`} className="btn btn-green">
            <ClipboardCheck size={16} /> Take Attendance
          </Link>
        </div>
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
        {classStudents.length === 0 ? (
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

              return (
                <div key={s.id} className="card classdetail-student-card">
                  <span className={`tape ${tapeSpot}`} />
                  <div className="classdetail-student-top">
                    <div className={`avatar ${avatarColor} classdetail-avatar`}>{initials}</div>
                    <div className="classdetail-student-identity">
                      <h4 className="classdetail-student-name">{s.name}</h4>
                      <p className="classdetail-student-meta mono">
                        Age {s.age} &middot; {s.gender === 'M' ? 'Male' : 'Female'}
                      </p>
                    </div>
                    <span className={`badge badge-${status}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  <div className="classdetail-student-bottom">
                    <div className="classdetail-rate-block">
                      <span className="classdetail-rate-label accent">Attendance</span>
                      <div className="classdetail-rate-bar-row">
                        <div className="classdetail-rate-track">
                          <div
                            className="classdetail-rate-fill"
                            style={{
                              width: `${s.attendanceRate}%`,
                              background: s.attendanceRate >= 90 ? 'var(--green)' : s.attendanceRate >= 80 ? 'var(--yellow)' : 'var(--red)',
                            }}
                          />
                        </div>
                        <span className="classdetail-rate-value mono">{s.attendanceRate}%</span>
                      </div>
                    </div>
                    <p className="classdetail-parent-name">Parent: {s.parent}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WEEKLY ATTENDANCE CHART */}
      <div className="card classdetail-chart-card classdetail-section">
        <span className="tape tl" />
        <div className="chart-head">
          <h2>Weekly Attendance</h2>
          <span className="classdetail-chart-subtitle accent">School-wide Weekly Trend</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyAttendance}>
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
    </div>
  );
}
