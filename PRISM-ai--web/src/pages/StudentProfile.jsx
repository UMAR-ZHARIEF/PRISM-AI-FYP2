import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, UserCheck, UserX, Clock, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { classColors } from '../data/mockData';
import useStudent from '../hooks/useStudent';
import useAttendance from '../hooks/useAttendance';
import useTeacherNotes from '../hooks/useTeacherNotes';
import useEnrolledFaces from '../hooks/useEnrolledFaces';
import AttendanceCalendar from '../components/AttendanceCalendar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
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
  const { records: attendanceRecords, loading: attendanceLoading, refresh: refreshAttendance } = useAttendance({ studentId });
  const { notes, addNote, loading: notesLoading } = useTeacherNotes(studentId);
  const { enrolledNames } = useEnrolledFaces();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === 'admin';

  // Note composer state
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Attendance edit modal state (admin only)
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('present');
  const [editArrival, setEditArrival] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [editError, setEditError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Today's date string (local time, not UTC) used to find today's attendance record.
  // If multiple rows exist for today (e.g. an old seeded morning row plus a fresh
  // AI-detection row), pick the one with the latest marked_at / created_at so the
  // panel reflects the freshest arrival_time written to the DB.
  const todayRecord = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return null;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${day}`;
    const todays = attendanceRecords.filter(r => r.date === today);
    if (todays.length === 0) return null;
    return todays.slice().sort((a, b) => {
      const aTime = a.marked_at || a.created_at || '';
      const bTime = b.marked_at || b.created_at || '';
      return bTime.localeCompare(aTime); // DESC — latest first
    })[0];
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
    const ref = new Date();
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

  // ---------- Admin attendance-edit handlers ----------
  // Normalize a DB arrival_time (could be 'HH:MM' or 'HH:MM:SS') into
  // 'HH:MM' suitable for a <input type="time">.
  function normalizeArrivalForInput(value) {
    if (!value || value === '-') return '';
    const trimmed = String(value).trim();
    const match = trimmed.match(/^(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '';
  }

  const openEditModal = () => {
    if (!todayRecord) return;
    setEditStatus(todayRecord.status || 'present');
    setEditArrival(normalizeArrivalForInput(todayRecord.arrival_time));
    setEditNotes(todayRecord.notes || '');
    setEditError(null);
    setConfirmDelete(false);
    setEditOpen(true);
  };

  const closeEditModal = () => {
    if (editSaving || editDeleting) return;
    setEditOpen(false);
    setConfirmDelete(false);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!todayRecord || editSaving || editDeleting) return;
    setEditSaving(true);
    setEditError(null);

    // Absent rows don't carry an arrival time.
    const arrivalForDb =
      editStatus === 'absent'
        ? null
        : editArrival
          ? `${editArrival}:00`
          : null;

    const trimmedNotes = editNotes.trim();
    const payload = {
      status: editStatus,
      arrival_time: arrivalForDb,
      notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    };

    const { error: updateErr } = await supabase
      .from('attendance_records')
      .update(payload)
      .eq('id', todayRecord.id);

    setEditSaving(false);

    if (updateErr) {
      setEditError(updateErr.message || 'Failed to update record.');
      if (toast) toast('Could not update attendance record.', 'error');
      return;
    }

    if (toast) toast('Attendance record updated.', 'success');
    setEditOpen(false);
    setConfirmDelete(false);
    if (refreshAttendance) refreshAttendance();
  };

  const handleDeleteRecord = async () => {
    if (!todayRecord || editSaving || editDeleting) return;
    // First click: ask for confirmation inline.
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setEditDeleting(true);
    setEditError(null);

    const { error: deleteErr } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', todayRecord.id);

    setEditDeleting(false);

    if (deleteErr) {
      setEditError(deleteErr.message || 'Failed to delete record.');
      if (toast) toast('Could not delete attendance record.', 'error');
      return;
    }

    if (toast) toast('Attendance record deleted.', 'success');
    setEditOpen(false);
    setConfirmDelete(false);
    if (refreshAttendance) refreshAttendance();
  };

  // Close modal on Escape
  useEffect(() => {
    if (!editOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeEditModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, editSaving, editDeleting]);

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

  // Real status from the AI service's enrolled-faces list (GET /api/ai/enrolled).
  const faceRegistered = enrolledNames.has(fullName.toLowerCase().trim());

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

        {/* Admin-only: edit today's attendance record */}
        {isAdmin && todayRecord && (
          <button
            type="button"
            className="sprofile-att-edit-btn"
            onClick={openEditModal}
            title="Correct today's attendance record"
          >
            <Edit2 size={14} />
            <span>Edit today's record</span>
          </button>
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

      {/* ADMIN-ONLY: EDIT ATTENDANCE MODAL */}
      {isAdmin && editOpen && todayRecord && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div
            className="modal sprofile-edit-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sprofile-edit-title"
          >
            <div className="sprofile-edit-header">
              <h2 id="sprofile-edit-title">Edit today's attendance</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeEditModal}
                disabled={editSaving || editDeleting}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <p className="sprofile-edit-sub">
              {fullName} <span className="sprofile-edit-date mono">{todayRecord.date}</span>
            </p>

            <div className="sprofile-edit-field">
              <label className="sprofile-edit-label" htmlFor="sprofile-edit-status">Status</label>
              <select
                id="sprofile-edit-status"
                className="sprofile-edit-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                disabled={editSaving || editDeleting}
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>

            {editStatus !== 'absent' && (
              <div className="sprofile-edit-field">
                <label className="sprofile-edit-label" htmlFor="sprofile-edit-arrival">
                  Arrival time <span className="sprofile-edit-optional">(optional)</span>
                </label>
                <input
                  id="sprofile-edit-arrival"
                  type="time"
                  className="sprofile-edit-input"
                  value={editArrival}
                  onChange={(e) => setEditArrival(e.target.value)}
                  disabled={editSaving || editDeleting}
                />
              </div>
            )}

            <div className="sprofile-edit-field">
              <label className="sprofile-edit-label" htmlFor="sprofile-edit-notes">
                Notes <span className="sprofile-edit-optional">(optional)</span>
              </label>
              <textarea
                id="sprofile-edit-notes"
                className="sprofile-edit-input sprofile-edit-textarea"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Why was this record corrected?"
                disabled={editSaving || editDeleting}
              />
            </div>

            {editError && (
              <p className="sprofile-edit-error" role="alert">
                <AlertTriangle size={14} /> {editError}
              </p>
            )}

            {confirmDelete && (
              <p className="sprofile-edit-confirm" role="alert">
                Delete this attendance record permanently? Click <strong>Delete</strong> again to confirm.
              </p>
            )}

            <div className="sprofile-edit-actions">
              <button
                type="button"
                className="btn btn-danger sprofile-edit-delete"
                onClick={handleDeleteRecord}
                disabled={editSaving || editDeleting}
              >
                <Trash2 size={14} />
                {editDeleting
                  ? 'Deleting…'
                  : confirmDelete
                    ? 'Confirm delete'
                    : 'Delete record'}
              </button>
              <div className="sprofile-edit-actions-right">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeEditModal}
                  disabled={editSaving || editDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-green"
                  onClick={handleSaveEdit}
                  disabled={editSaving || editDeleting}
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}