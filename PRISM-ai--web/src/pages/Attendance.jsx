import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Clock, ClipboardCheck, Users, ChevronRight } from 'lucide-react';
import { students, classes, classColors, attendanceToday, users, years } from '../data/mockData';
import { useYear } from '../layouts/DashboardLayout';
import { useToast } from '../components/Toast';
import './Attendance.css';

const classWordColor = {
  Bestari: 'b',
  Bijak: 'r',
  Cerdik: 'g',
  Cerdas: 'o',
  Pandai: 'y',
};

const teacherMap = {};
users.filter(u => u.role === 'homeroom').forEach(u => {
  if (u.class && u.year) teacherMap[`${u.year}-${u.class}`] = u.name;
});

function generateMockTime() {
  const hour = 7 + Math.floor(Math.random() * 2);
  const min = Math.floor(Math.random() * 60);
  const ampm = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${String(displayHour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
}

export default function Attendance() {
  const { year, className } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Year context with fallback
  let yearCtx;
  try { yearCtx = useYear(); } catch { yearCtx = { selectedYear: null }; }
  const yearNum = year ? Number(year) : null;

  const today = new Date();
  const dateString = today.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Build the initial statuses from attendanceToday mock data
  const initialStatuses = useMemo(() => {
    const map = {};
    attendanceToday.forEach(a => {
      map[a.studentId] = a.status;
    });
    return map;
  }, []);

  // Build a time map from attendanceToday
  const timeMap = useMemo(() => {
    const map = {};
    attendanceToday.forEach(a => {
      if (a.timeIn && a.timeIn !== '-') {
        map[a.studentId] = a.timeIn;
      }
    });
    return map;
  }, []);

  const [statuses, setStatuses] = useState(initialStatuses);
  const [submittedClasses, setSubmittedClasses] = useState({});

  const setStudentStatus = (studentId, status) => {
    setStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const getTimeForStudent = (studentId, status) => {
    if (status === 'absent') return null;
    if (timeMap[studentId]) return timeMap[studentId];
    return generateMockTime();
  };

  // -- CLASS PICKER VIEW --
  if (!className) {
    const selectedYear = yearCtx.selectedYear || years[0];

    const classData = classes.map(cls => {
      const classStudents = students.filter(s => s.class === cls && s.year === selectedYear);
      const total = classStudents.length;
      const marked = classStudents.filter(s => statuses[s.id]).length;
      const allMarked = marked === total && total > 0;
      const teacher = users.find(u => u.role === 'homeroom' && u.class === cls && u.year === selectedYear);
      return {
        name: cls,
        studentCount: total,
        teacher: teacher?.name || teacherMap[`${selectedYear}-${cls}`] || 'Unknown',
        marked,
        total,
        allMarked,
        color: classColors[cls],
        wordColor: classWordColor[cls],
      };
    });

    return (
      <div className="attendance-page">
        <div className="page-header attendance-header">
          <div>
            <h1>
              <span className="word g">Take</span>{' '}
              <span className="word k">Attendance</span>
            </h1>
            <p className="page-subtitle">Year {selectedYear} &middot; {dateString}</p>
          </div>
          <div className="attendance-header-icon">
            <ClipboardCheck size={32} />
          </div>
        </div>

        <div className="class-picker-grid">
          {classData.map((cls, i) => (
            <Link
              key={cls.name}
              to={`/dashboard/attendance/${selectedYear}/${cls.name}`}
              className={`class-picker-card reveal reveal-${i + 1}`}
              style={{ '--cls-color': cls.color }}
            >
              <span className={`tape ${['tl', 'tr', 'bl', 'br', 'tl'][i]}`} />
              <div className="picker-card-accent" />
              <div className="picker-card-body">
                <h2 className="picker-class-name">
                  <span className={`word ${cls.wordColor}`}>{cls.name}</span>
                </h2>
                <p className="picker-teacher">{cls.teacher}</p>
                <div className="picker-stats-row">
                  <span className="picker-stat">
                    <Users size={15} />
                    {cls.studentCount} students
                  </span>
                </div>
                <div className={`picker-status ${cls.allMarked ? 'picker-status-done' : submittedClasses[cls.name] ? 'picker-status-done' : 'picker-status-pending'}`}>
                  {submittedClasses[cls.name]
                    ? `${cls.total}/${cls.total} marked`
                    : cls.allMarked
                      ? `${cls.marked}/${cls.total} marked`
                      : cls.marked > 0
                        ? `${cls.marked}/${cls.total} marked`
                        : 'Not marked'
                  }
                </div>
              </div>
              <div className="picker-card-arrow">
                <ChevronRight size={24} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // -- ATTENDANCE MARKING VIEW --
  const isValidClass = classes.includes(className);
  const isValidYear = yearNum != null && years.includes(yearNum);

  if (!isValidClass || !isValidYear) {
    return (
      <div className="attendance-page">
        <div className="page-header attendance-header">
          <div>
            <Link to="/dashboard/attendance" className="back-link">
              <ArrowLeft size={20} />
            </Link>
            <h1>
              <span className="word r">Class</span>{' '}
              <span className="word k">Not Found</span>
            </h1>
            <p className="page-subtitle">The class "{className}" (Year {year}) does not exist.</p>
          </div>
        </div>
        <div className="card not-found-card">
          <span className="tape tl" />
          <p className="not-found-message">
            Please go back and select a valid class from the list.
          </p>
          <Link to="/dashboard/attendance" className="btn btn-primary">
            <ArrowLeft size={16} /> Back to Classes
          </Link>
        </div>
      </div>
    );
  }

  const classStudents = students.filter(s => s.class === className && s.year === yearNum);
  const totalStudents = classStudents.length;
  const markedCount = classStudents.filter(s => statuses[s.id]).length;
  const allMarked = markedCount === totalStudents;
  const isSubmitted = submittedClasses[className] || false;

  const handleSubmit = () => {
    setSubmittedClasses(prev => ({ ...prev, [className]: true }));
    toast(
      `Attendance for ${className} saved — ${markedCount}/${totalStudents} marked`,
      'success'
    );
  };

  const wordColor = classWordColor[className] || 'k';
  const clsColor = classColors[className];

  return (
    <div className="attendance-page">
      <div className="page-header attendance-header marking-header">
        <div className="marking-header-left">
          <Link to="/dashboard/attendance" className="back-link">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1>
              <span className="word k">Attendance</span>{' '}
              <span className="dash-sep">&mdash;</span>{' '}
              <span className={`word ${wordColor}`}>{className}</span>
            </h1>
            <p className="page-subtitle">Year {yearNum} &middot; {dateString}</p>
          </div>
        </div>
        <div className="marking-header-right">
          <span className="marking-summary mono">
            {markedCount} of {totalStudents} marked
          </span>
          <button
            className={`btn ${isSubmitted ? 'btn-outline' : 'btn-green'} btn-submit`}
            disabled={!allMarked || isSubmitted}
            onClick={handleSubmit}
          >
            {isSubmitted ? (
              <><Check size={16} /> Submitted</>
            ) : (
              <><ClipboardCheck size={16} /> Submit</>
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="marking-progress-wrap">
        <div className="marking-progress-track">
          <div
            className="marking-progress-fill"
            style={{
              width: `${totalStudents > 0 ? (markedCount / totalStudents) * 100 : 0}%`,
              background: clsColor,
            }}
          />
        </div>
        <span className="marking-progress-label mono">
          {totalStudents > 0 ? Math.round((markedCount / totalStudents) * 100) : 0}%
        </span>
      </div>

      {/* Student list */}
      <div className="student-list">
        {classStudents.map((student, idx) => {
          const status = statuses[student.id] || null;
          const time = status ? getTimeForStudent(student.id, status) : null;
          const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2);
          const avatarColors = ['r', 'y', 'b', 'g', 'o'];
          const avatarColor = avatarColors[idx % avatarColors.length];
          const tapeSpots = ['tl', 'tr', 'br', 'bl'];

          return (
            <div
              key={student.id}
              className={`student-slip reveal reveal-${Math.min(idx + 1, 6)} ${status ? `slip-marked slip-${status}` : ''}`}
            >
              <span className={`tape ${tapeSpots[idx % tapeSpots.length]}`} />
              <div className="slip-left">
                <div className={`avatar ${avatarColor} slip-avatar`}>
                  {initials}
                </div>
                <div className="slip-info">
                  <h3 className="slip-name">{student.name}</h3>
                  <p className="slip-meta mono">
                    Age {student.age} &middot; {student.gender === 'M' ? 'Male' : 'Female'}
                  </p>
                  {time && (
                    <span className="slip-time mono">
                      <Clock size={12} /> {time}
                    </span>
                  )}
                </div>
              </div>
              <div className="slip-right">
                <div className="toggle-group">
                  <button
                    className={`toggle-btn toggle-present ${status === 'present' ? 'active' : ''}`}
                    onClick={() => !isSubmitted && setStudentStatus(student.id, 'present')}
                    disabled={isSubmitted}
                    aria-label="Mark present"
                  >
                    <Check size={16} />
                    <span>Present</span>
                  </button>
                  <button
                    className={`toggle-btn toggle-absent ${status === 'absent' ? 'active' : ''}`}
                    onClick={() => !isSubmitted && setStudentStatus(student.id, 'absent')}
                    disabled={isSubmitted}
                    aria-label="Mark absent"
                  >
                    <X size={16} />
                    <span>Absent</span>
                  </button>
                  <button
                    className={`toggle-btn toggle-late ${status === 'late' ? 'active' : ''}`}
                    onClick={() => !isSubmitted && setStudentStatus(student.id, 'late')}
                    disabled={isSubmitted}
                    aria-label="Mark late"
                  >
                    <Clock size={16} />
                    <span>Late</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
