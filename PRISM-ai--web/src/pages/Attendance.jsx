import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Clock, ClipboardCheck, Users, ChevronRight } from 'lucide-react';
import { classes, classColors, years } from '../data/mockData';
import { useYear } from '../layouts/DashboardLayout';
import { useToast } from '../components/Toast';
import { SkeletonCard } from '../components/Skeleton';
import useClassSections from '../hooks/useClassSections';
import useStudents from '../hooks/useStudents';
import useAttendance from '../hooks/useAttendance';
import useMarkAttendance from '../hooks/useMarkAttendance';
import './Attendance.css';

const classWordColor = {
  Bestari: 'b',
  Bijak: 'r',
  Cerdik: 'g',
  Cerdas: 'o',
  Pandai: 'y',
};

function formatArrivalTime(isoOrTimeString) {
  if (!isoOrTimeString) return null;
  // arrival_time stored as 'HH:MM:SS' or 'HH:MM' — render as 'HH:MM AM/PM'.
  const parts = String(isoOrTimeString).split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const ampm = h < 12 ? 'AM' : 'PM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function nowAsHHMMSS() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function todayISODate() {
  // YYYY-MM-DD in local timezone.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Attendance() {
  const { year, className } = useParams();
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
  // Stable YYYY-MM-DD for the hooks (today changes only when the component
  // re-mounts, which is fine for a take-attendance page).
  const dateISO = useMemo(() => todayISODate(), []);

  // Picker mode renders one branch; marking mode renders another. Render both
  // branches from this single component so all hook calls stay top-level.
  if (!className) {
    return (
      <PickerView
        selectedYear={yearCtx.selectedYear || years[0]}
        dateString={dateString}
        dateISO={dateISO}
      />
    );
  }

  return (
    <MarkingView
      year={year}
      yearNum={yearNum}
      className={className}
      dateString={dateString}
      dateISO={dateISO}
      toast={toast}
    />
  );
}


/* ============================================================
   PICKER VIEW — list all class sections for the current year
   ============================================================ */
function PickerView({ selectedYear, dateString, dateISO }) {
  const { classSections, loading: sectionsLoading, error: sectionsError } = useClassSections({ year: selectedYear });
  const { students: yearStudents, loading: studentsLoading } = useStudents({ year: selectedYear });
  const { records: todayRecords, loading: attendanceLoading } = useAttendance({ fromDate: dateISO, toDate: dateISO });

  const loading = sectionsLoading || studentsLoading || attendanceLoading;

  // Group students and today's marks by class_section_id so each card can show
  // its student count and how many have been marked.
  const sectionStats = useMemo(() => {
    const studentsBySection = new Map();
    (yearStudents || []).forEach(s => {
      const sid = s.class_section_id;
      if (!sid) return;
      const list = studentsBySection.get(sid) || [];
      list.push(s);
      studentsBySection.set(sid, list);
    });

    const markedStudentIds = new Set();
    (todayRecords || []).forEach(r => {
      if (r.student_id) markedStudentIds.add(r.student_id);
    });

    return (classSections || []).map(sec => {
      const sectionStudents = studentsBySection.get(sec.id) || [];
      const total = sectionStudents.length;
      const marked = sectionStudents.filter(s => markedStudentIds.has(s.id)).length;
      return {
        id: sec.id,
        name: sec.name,
        teacher: sec.homeroom_teacher?.full_name || 'Unknown',
        color: sec.color || classColors[sec.name],
        wordColor: classWordColor[sec.name] || 'k',
        total,
        marked,
        allMarked: total > 0 && marked === total,
      };
    });
  }, [classSections, yearStudents, todayRecords]);

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

      {sectionsError && (
        <div className="card not-found-card">
          <span className="tape tl" />
          <p className="not-found-message">Could not load classes. Please try again.</p>
        </div>
      )}

      {loading && !sectionsError && (
        <div className="class-picker-grid">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`class-picker-card reveal reveal-${i + 1}`}>
              <SkeletonCard />
            </div>
          ))}
        </div>
      )}

      {!loading && !sectionsError && sectionStats.length === 0 && (
        <div className="card not-found-card">
          <span className="tape tl" />
          <p className="not-found-message">No classes found for Year {selectedYear}.</p>
        </div>
      )}

      {!loading && !sectionsError && sectionStats.length > 0 && (
        <div className="class-picker-grid">
          {sectionStats.map((cls, i) => (
            <Link
              key={cls.id}
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
                    {cls.total} students
                  </span>
                </div>
                <div className={`picker-status ${cls.allMarked ? 'picker-status-done' : 'picker-status-pending'}`}>
                  {cls.marked > 0
                    ? `${cls.marked}/${cls.total} marked`
                    : 'Not marked'}
                </div>
              </div>
              <div className="picker-card-arrow">
                <ChevronRight size={24} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MARKING VIEW — mark attendance for one class section
   ============================================================ */
function MarkingView({ year, yearNum, className, dateString, dateISO, toast }) {
  // Resolve :year + :className -> class section row (we need its id).
  const isValidYear = yearNum != null && years.includes(yearNum);
  const isValidClass = classes.includes(className);

  const { classSections, loading: sectionsLoading } = useClassSections({ year: isValidYear ? yearNum : undefined });
  const section = useMemo(() => {
    if (!isValidYear || !isValidClass) return null;
    return (classSections || []).find(s => s.name === className) || null;
  }, [classSections, className, isValidYear, isValidClass]);
  const classSectionId = section?.id;

  const { students, loading: studentsLoading } = useStudents({ classSectionId });
  const { records: existingRecords, loading: attendanceLoading, refresh: refreshAttendance } = useAttendance({
    date: dateISO,
    classSectionId,
  });
  const { markAttendance, loading: saving } = useMarkAttendance();

  // Derive maps from DB so we don't have to seed via setState in an effect.
  const dbStatuses = useMemo(() => {
    const map = {};
    (existingRecords || []).forEach(r => {
      if (r.student_id) map[r.student_id] = r.status;
    });
    return map;
  }, [existingRecords]);
  const dbArrivalTimes = useMemo(() => {
    const map = {};
    (existingRecords || []).forEach(r => {
      if (r.student_id && r.arrival_time) map[r.student_id] = r.arrival_time;
    });
    return map;
  }, [existingRecords]);

  // Local user overrides layered on top of the DB maps.
  const [statusOverrides, setStatusOverrides] = useState({});
  const [arrivalOverrides, setArrivalOverrides] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });

  const statuses = useMemo(
    function mergeStatuses() { return { ...dbStatuses, ...statusOverrides }; },
    [dbStatuses, statusOverrides]
  );
  const arrivalTimes = useMemo(
    function mergeArrivalTimes() { return { ...dbArrivalTimes, ...arrivalOverrides }; },
    [dbArrivalTimes, arrivalOverrides]
  );

  const setStudentStatus = (studentId, status) => {
    setStatusOverrides(prev => ({ ...prev, [studentId]: status }));
    setArrivalOverrides(prev => {
      if (status === 'absent') {
        return { ...prev, [studentId]: null };
      }
      if (arrivalTimes[studentId]) return prev;
      return { ...prev, [studentId]: nowAsHHMMSS() };
    });
    if (submitted) setSubmitted(false);
  };

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

  if (!sectionsLoading && !section) {
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

  const totalStudents = students.length;
  const markedCount = students.filter(s => statuses[s.id]).length;
  const allMarked = totalStudents > 0 && markedCount === totalStudents;

  const wordColor = classWordColor[className] || 'k';
  const clsColor = section?.color || classColors[className];

  const handleSubmit = async () => {
    if (saving) return;

    const toSave = students.filter(s => statuses[s.id]);
    if (toSave.length === 0) return;

    setSaveProgress({ done: 0, total: toSave.length });

    let failed = 0;
    for (let i = 0; i < toSave.length; i += 1) {
      const s = toSave[i];
      const status = statuses[s.id];
      const payload = {
        studentId: s.id,
        date: dateISO,
        status,
        arrivalTime: status === 'absent' ? null : (arrivalTimes[s.id] || null),
      };
      const { error: saveError } = await markAttendance(payload);
      if (saveError) failed += 1;
      setSaveProgress({ done: i + 1, total: toSave.length });
    }

    if (failed > 0) {
      toast(
        `Saved ${toSave.length - failed} of ${toSave.length} — ${failed} failed. Please retry.`,
        'error'
      );
    } else {
      setSubmitted(true);
      toast(
        `Attendance for ${className} saved — ${markedCount}/${totalStudents} marked`,
        'success'
      );
      setStatusOverrides({});
      setArrivalOverrides({});
      refreshAttendance();
    }
  };

  const initialLoading = sectionsLoading || studentsLoading || attendanceLoading;

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
            {saving
              ? `Saving ${saveProgress.done}/${saveProgress.total}`
              : `${markedCount} of ${totalStudents} marked`}
          </span>
          <button
            className={`btn ${submitted ? 'btn-outline' : 'btn-green'} btn-submit`}
            disabled={!allMarked || submitted || saving}
            onClick={handleSubmit}
          >
            {submitted ? (
              <><Check size={16} /> Submitted</>
            ) : saving ? (
              <><Clock size={16} /> Saving&hellip;</>
            ) : (
              <><ClipboardCheck size={16} /> Submit</>
            )}
          </button>
        </div>
      </div>

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

      {initialLoading && (
        <div className="student-list">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`student-slip reveal reveal-${i + 1}`}>
              <SkeletonCard />
            </div>
          ))}
        </div>
      )}

      {!initialLoading && totalStudents === 0 && (
        <div className="card not-found-card">
          <span className="tape tl" />
          <p className="not-found-message">No students are enrolled in this class yet.</p>
        </div>
      )}

      {!initialLoading && totalStudents > 0 && (
        <div className="student-list">
          {students.map((student, idx) => {
            const status = statuses[student.id] || null;
            const fullName = student.full_name || '';
            const initials = fullName.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
            const genderLabel = (student.gender || '').toLowerCase().startsWith('f') ? 'Female' : 'Male';
            const time = status && status !== 'absent' ? formatArrivalTime(arrivalTimes[student.id]) : null;
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
                    {initials || '?'}
                  </div>
                  <div className="slip-info">
                    <h3 className="slip-name">{fullName}</h3>
                    <p className="slip-meta mono">
                      {genderLabel}
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
                      onClick={() => !submitted && !saving && setStudentStatus(student.id, 'present')}
                      disabled={submitted || saving}
                      aria-label="Mark present"
                    >
                      <Check size={16} />
                      <span>Present</span>
                    </button>
                    <button
                      className={`toggle-btn toggle-absent ${status === 'absent' ? 'active' : ''}`}
                      onClick={() => !submitted && !saving && setStudentStatus(student.id, 'absent')}
                      disabled={submitted || saving}
                      aria-label="Mark absent"
                    >
                      <X size={16} />
                      <span>Absent</span>
                    </button>
                    <button
                      className={`toggle-btn toggle-late ${status === 'late' ? 'active' : ''}`}
                      onClick={() => !submitted && !saving && setStudentStatus(student.id, 'late')}
                      disabled={submitted || saving}
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
      )}
    </div>
  );
}
