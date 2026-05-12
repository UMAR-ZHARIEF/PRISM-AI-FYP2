import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, UserCheck, UserX, Clock, BookOpen } from 'lucide-react';
import { students, users, attendanceToday, classColors } from '../data/mockData';
import AttendanceCalendar from '../components/AttendanceCalendar';
import './StudentProfile.css';

const WORD_COLOR_MAP = {
  Bestari: 'b',
  Bijak:   'r',
  Cerdik:  'g',
  Cerdas:  'o',
  Pandai:  'y',
};

function timeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StudentProfile() {
  const { studentId } = useParams();
  const id = Number(studentId);

  const student = useMemo(() => students.find(s => s.id === id), [id]);

  const homeroomTeacher = useMemo(() => {
    if (!student) return null;
    return users.find(
      u => u.role === 'homeroom' && u.year === student.year && u.class === student.class
    ) || null;
  }, [student]);

  const todayRecord = useMemo(() => {
    if (!student) return null;
    return attendanceToday.find(a => a.studentId === student.id) || null;
  }, [student]);

  // Teacher notes — session state
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');

  const handleAddNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setNotes(prev => [{ text: trimmed, timestamp: Date.now() }, ...prev]);
    setNoteText('');
  };

  const handleNoteKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAddNote();
    }
  };

  // Not found
  if (!student) {
    return (
      <div className="sprofile-page">
        <Link to="/dashboard/students" className="pencil-link sprofile-back">
          <ArrowLeft size={18} /> Back to Students
        </Link>
        <div className="card sprofile-notfound">
          <span className="tape tl" />
          <UserX size={48} />
          <h3>Student Not Found</h3>
          <p>No student with ID "{studentId}" exists in the system.</p>
          <Link to="/dashboard/students" className="btn btn-primary">
            <ArrowLeft size={16} /> Back to Students
          </Link>
        </div>
      </div>
    );
  }

  const wordColor = WORD_COLOR_MAP[student.class] || 'k';
  const classColor = classColors[student.class] || 'var(--ink)';
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const rateColor = student.attendanceRate >= 90
    ? 'var(--green)'
    : student.attendanceRate >= 80
      ? 'var(--yellow)'
      : 'var(--red)';

  const todayStatus = todayRecord ? todayRecord.status : null;
  const todayTimeIn = todayRecord ? todayRecord.timeIn : null;

  return (
    <div className="sprofile-page">
      {/* BACK LINK */}
      <Link to="/dashboard/students" className="pencil-link sprofile-back">
        <ArrowLeft size={18} /> Back to Students
      </Link>

      {/* PAGE HEADER */}
      <div className="page-header sprofile-header">
        <div className="sprofile-header-left">
          <div className={`sprofile-avatar avatar ${wordColor}`}>{initials}</div>
          <div className="sprofile-header-text">
            <h1>
              <span className={`word ${wordColor}`}>{student.name}</span>
            </h1>
            <p className="sprofile-subtitle">
              Year {student.year} —{' '}
              <span className="sprofile-class-accent" style={{ color: classColor }}>
                {student.class}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* INFO CARDS ROW */}
      <div className="sprofile-info-row">
        {/* Personal Info */}
        <div className="card sprofile-info-card reveal reveal-1">
          <span className="tape tl" />
          <h4 className="sprofile-card-title">Personal Info</h4>
          <div className="sprofile-info-grid">
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Age</span>
              <span className="sprofile-info-value">{student.age}</span>
            </div>
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Gender</span>
              <span className="sprofile-info-value">{student.gender === 'M' ? 'Male' : 'Female'}</span>
            </div>
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Year</span>
              <span className="sprofile-info-value">{student.year}</span>
            </div>
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Class</span>
              <span className="sprofile-info-value" style={{ color: classColor }}>{student.class}</span>
            </div>
          </div>
          <div className="sprofile-face-status">
            {student.faceRegistered ? (
              <span className="badge badge-present sprofile-face-badge">
                <UserCheck size={13} /> Registered
              </span>
            ) : (
              <span className="badge badge-absent sprofile-face-badge">
                <UserX size={13} /> Not Registered
              </span>
            )}
          </div>
        </div>

        {/* Parent Contact */}
        <div className="card sprofile-info-card reveal reveal-2">
          <span className="tape tr" />
          <h4 className="sprofile-card-title">Parent Contact</h4>
          <p className="sprofile-parent-name">{student.parent}</p>
          <div className="sprofile-contact-row">
            <Mail size={15} className="sprofile-contact-icon" />
            <span className="sprofile-contact-text">{student.parentEmail}</span>
          </div>
          <div className="sprofile-contact-row">
            <Phone size={15} className="sprofile-contact-icon" />
            <span className="sprofile-contact-text">{student.parentPhone}</span>
          </div>
        </div>

        {/* Homeroom Teacher */}
        <div className="card sprofile-info-card reveal reveal-3">
          <span className="tape tl" />
          <h4 className="sprofile-card-title">Homeroom Teacher</h4>
          {homeroomTeacher ? (
            <>
              <p className="sprofile-teacher-name">
                <BookOpen size={15} className="sprofile-contact-icon" />
                {homeroomTeacher.name}
              </p>
              <div className="sprofile-contact-row">
                <Mail size={15} className="sprofile-contact-icon" />
                <span className="sprofile-contact-text">{homeroomTeacher.email}</span>
              </div>
            </>
          ) : (
            <p className="sprofile-teacher-none">No homeroom teacher assigned</p>
          )}
        </div>
      </div>

      {/* ATTENDANCE STATS ROW */}
      <div className="sprofile-att-row reveal reveal-4">
        <div className="sprofile-att-rate" style={{ color: rateColor }}>
          <span className="sprofile-att-number">{student.attendanceRate}</span>
          <span className="sprofile-att-pct">%</span>
          <span className="sprofile-att-label">attendance</span>
        </div>

        <div className="sprofile-att-today">
          <span className="sprofile-att-today-label">Today</span>
          {todayStatus ? (
            <span className={`badge badge-${todayStatus} sprofile-today-badge`}>
              {todayStatus.charAt(0).toUpperCase() + todayStatus.slice(1)}
            </span>
          ) : (
            <span className="sprofile-no-record">No record</span>
          )}
        </div>

        {todayTimeIn && todayTimeIn !== '-' && (
          <div className="sprofile-att-timein">
            <Clock size={16} className="sprofile-timein-icon" />
            <span className="sprofile-timein-label">Time In</span>
            <span className="sprofile-timein-value">{todayTimeIn}</span>
          </div>
        )}
      </div>

      {/* ATTENDANCE CALENDAR */}
      <div className="sprofile-section reveal reveal-5">
        <div className="sprofile-section-title">
          <h2>Attendance History</h2>
        </div>
        <AttendanceCalendar studentId={student.id} />
      </div>

      {/* TEACHER NOTES */}
      <div className="sprofile-section sprofile-notes-section reveal reveal-6">
        <div className="sprofile-section-title">
          <h2>Teacher Notes</h2>
          <span className="sprofile-notes-count mono">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="sprofile-notes-card">
          <span className="tape tr" />
          {/* Add note form */}
          <div className="sprofile-note-form">
            <textarea
              className="sprofile-note-textarea"
              placeholder="Write a note about this student..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={handleNoteKeyDown}
              rows={3}
            />
            <div className="sprofile-note-form-footer">
              <span className="sprofile-note-hint">Ctrl+Enter to save</span>
              <button
                className="btn btn-green sprofile-note-btn"
                onClick={handleAddNote}
                disabled={!noteText.trim()}
              >
                Save Note
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length > 0 ? (
            <div className="sprofile-notes-list">
              {notes.map((note, i) => (
                <div key={i} className="sprofile-note-item">
                  <p className="sprofile-note-text">{note.text}</p>
                  <span className="sprofile-note-time">{timeAgo(note.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="sprofile-notes-empty">
              <p>No notes yet. Add your first note above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
