import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, UserCheck, UserX, Clock } from 'lucide-react';
import { classColors } from '../data/mockData';
import useStudent from '../hooks/useStudent';
import useAttendance from '../hooks/useAttendance';
import useTeacherNotes from '../hooks/useTeacherNotes';
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

  const { student, loading: studentLoading, error: studentError } = useStudent(studentId);
  const { records: attendanceRecords, loading: attendanceLoading } = useAttendance({ studentId });
  const { notes, addNote, loading: notesLoading } = useTeacherNotes(studentId);

  // Note composer state
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Today's date string used to find today's attendance record.
  // The calendar uses 2026-05-11 as the app's "today" — match that for consistency.
  const todayStr = '2026-05-11';
  const todayRecord = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return null;
    return attendanceRecords.find(r => r.date === todayStr) || null;
  }, [attendanceRecords]);

  // Compute attendance rate from records: present / total
  const attendanceRate = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return null;
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    return Math.round((present / attendanceRecords.length) * 100);
  }, [attendanceRecords]);

  // Derive age from dob if available
  const age = useMemo(() => {
    if (!student || !student.dob) return null;
    const dob = new Date(student.dob);
    if (Number.isNaN(dob.getTime())) return null;
    const ref = new Date(2026, 4, 11); // app "today"
    let years = ref.getFullYear() - dob.getFullYear();
    const m = ref.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) years--;
    return years;
  }, [student]);

  const handleAddNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error: addErr } = await addNote(trimmed);
    setSubmitting(false);
    if (addErr) {
      setSubmitError(addErr.message || 'Failed to save note. Please try again.');
      return;
    }
    setNoteText('');
  };

  const handleNoteKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAddNote();
    }
  };

  // Loading skeleton — show before student is known
  if (studentLoading) {
    return (
      <div className="sprofile-page">
        <Link to="/dashboard/students" className="pencil-link sprofile-back">
          <ArrowLeft size={18} /> Back to Students
        </Link>
        <div className="card sprofile-loading">
          <span className="tape tl" />
          <p>Loading student profile…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (studentError) {
    return (
      <div className="sprofile-page">
        <Link to="/dashboard/students" className="pencil-link sprofile-back">
          <ArrowLeft size={18} /> Back to Students
        </Link>
        <div className="card sprofile-error">
          <span className="tape tl" />
          <h3>Couldn't load student</h3>
          <p>{studentError.message || 'Something went wrong while loading this profile.'}</p>
        </div>
      </div>
    );
  }

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

  // Derived display fields from the DB row
  const fullName = student.full_name || '';
  const yearNum = student.year_num;
  const className = (student.class_section && student.class_section.name) || '';

  const wordColor = WORD_COLOR_MAP[className] || 'k';
  const classColor = classColors[className] || 'var(--ink)';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const rateColor = attendanceRate == null
    ? 'var(--ink)'
    : attendanceRate >= 90
      ? 'var(--green)'
      : attendanceRate >= 80
        ? 'var(--yellow)'
        : 'var(--red)';

  const todayStatus = todayRecord ? todayRecord.status : null;
  const todayTimeIn = todayRecord ? todayRecord.arrival_time : null;

  const faceRegistered = false; // not stored in DB yet — default to false per Wave 3 brief

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
              <span className={`word ${wordColor}`}>{fullName}</span>
            </h1>
            <p className="sprofile-subtitle">
              Year {yearNum} —{' '}
              <span className="sprofile-class-accent" style={{ color: classColor }}>
                {className}
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
              <span className="sprofile-info-value">{age != null ? age : '—'}</span>
            </div>
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Gender</span>
              <span className="sprofile-info-value">
                {student.gender === 'm' || student.gender === 'M'
                  ? 'Male'
                  : student.gender === 'f' || student.gender === 'F'
                    ? 'Female'
                    : '—'}
              </span>
            </div>
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Year</span>
              <span className="sprofile-info-value">{yearNum != null ? yearNum : '—'}</span>
            </div>
            <div className="sprofile-info-item">
              <span className="sprofile-info-label">Class</span>
              <span className="sprofile-info-value" style={{ color: classColor }}>{className || '—'}</span>
            </div>
          </div>
          <div className="sprofile-face-status">
            {faceRegistered ? (
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
          <p className="sprofile-parent-name">—</p>
          <div className="sprofile-contact-row">
            <Mail size={15} className="sprofile-contact-icon" />
            <span className="sprofile-contact-text">—</span>
          </div>
          <div className="sprofile-contact-row">
            <Phone size={15} className="sprofile-contact-icon" />
            <span className="sprofile-contact-text">—</span>
          </div>
        </div>

        {/* Homeroom Teacher */}
        <div className="card sprofile-info-card reveal reveal-3">
          <span className="tape tl" />
          <h4 className="sprofile-card-title">Homeroom Teacher</h4>
          <p className="sprofile-teacher-none">No homeroom teacher assigned</p>
        </div>
      </div>

      {/* ATTENDANCE STATS ROW */}
      <div className="sprofile-att-row reveal reveal-4">
        <div className="sprofile-att-rate" style={{ color: rateColor }}>
          <span className="sprofile-att-number">{attendanceRate != null ? attendanceRate : '—'}</span>
          <span className="sprofile-att-pct">%</span>
          <span className="sprofile-att-label">attendance</span>
        </div>

        <div className="sprofile-att-today">
          <span className="sprofile-att-today-label">Today</span>
          {attendanceLoading ? (
            <span className="sprofile-no-record">Loading…</span>
          ) : todayStatus ? (
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
              disabled={submitting}
            />
            <div className="sprofile-note-form-footer">
              <span className="sprofile-note-hint">Ctrl+Enter to save</span>
              <button
                className="btn btn-green sprofile-note-btn"
                onClick={handleAddNote}
                disabled={!noteText.trim() || submitting}
              >
                {submitting ? 'Saving…' : 'Save Note'}
              </button>
            </div>
            {submitError && (
              <p className="sprofile-note-error">{submitError}</p>
            )}
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div className="sprofile-notes-empty">
              <p>Loading notes…</p>
            </div>
          ) : notes.length > 0 ? (
            <div className="sprofile-notes-list">
              {notes.map((note) => {
                const ts = note.created_at ? Date.parse(note.created_at) : null;
                return (
                  <div key={note.id} className="sprofile-note-item">
                    <p className="sprofile-note-text">{note.body}</p>
                    <span className="sprofile-note-time">
                      {ts ? timeAgo(ts) : ''}
                    </span>
                  </div>
                );
              })}
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