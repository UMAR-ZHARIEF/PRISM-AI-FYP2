import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Upload, X, User, Grid3X3, List, CheckCircle, XCircle, Eye, Edit3, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { classColors } from '../data/mockData';
import { useToast } from '../components/Toast';
import { useYear } from '../layouts/dashboardContexts';
import { useAuth } from '../contexts/AuthContext.jsx';
import Pagination from '../components/Pagination';
import useStudents from '../hooks/useStudents';
import useYears from '../hooks/useYears';
import useClassSections from '../hooks/useClassSections';
import useEnrolledFaces from '../hooks/useEnrolledFaces';
import { supabase } from '../lib/supabase';
import { attendanceRate } from '../lib/attendanceRate';
import { SkeletonCard } from '../components/Skeleton';
import './Students.css';

// students.gender is nullable (migration 0001, no NOT NULL): only real M/F
// values get a label; null/anything else renders as '—' (same contract as
// StudentProfile's gender card).
function genderLabel(genderInitial) {
  if (genderInitial === 'M') return 'Male';
  if (genderInitial === 'F') return 'Female';
  return '—';
}

export default function Students() {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Year context (safe fallback if context not yet available). The hook call
  // is unconditional: outside the layout provider useYear() returns undefined
  // (createContext default), never throws, so the fallback is a value check.
  const { selectedYear } = useYear() || { selectedYear: null };

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterFace, setFilterFace] = useState('all');
  const [filterYear, setFilterYear] = useState(selectedYear ? String(selectedYear) : 'all');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Pagination (D5: grid and table views share one page index and size)
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  // Table sorting
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Add/Edit modal form fields (Supabase-shape now, not mock-shape)
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formStudentNumber, setFormStudentNumber] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formClassSectionId, setFormClassSectionId] = useState('');
  const [formGender, setFormGender] = useState('male');
  const [formDob, setFormDob] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Sync filterYear when global selectedYear changes, during render via the
  // guarded state-mirror pattern instead of an effect (per
  // react-hooks/set-state-in-effect). Initial state already matches the
  // selectedYear mapping, so the old mount-run reset was a no-op.
  const [prevSelectedYear, setPrevSelectedYear] = useState(selectedYear);
  if (prevSelectedYear !== selectedYear) {
    setPrevSelectedYear(selectedYear);
    setFilterYear(selectedYear ? String(selectedYear) : 'all');
  }

  // Load students from Supabase. When filterYear === 'all', pass undefined so the hook returns all years.
  const hookYear = filterYear === 'all' ? undefined : Number(filterYear);
  const { students: dbStudents, loading, error, refresh } = useStudents({ year: hookYear });

  // Parent contacts for the currently scoped students, keyed by student_id.
  // Single batched query (same join StudentProfile uses); primary parent wins.
  const [parentsByStudent, setParentsByStudent] = useState(new Map());

  // Attendance rate per student over all recorded attendance, keyed by
  // student_id. No date floor: a rolling window (e.g. last 30 days) reads as
  // '—' whenever the school's records sit older than the window, which is
  // exactly the demo/term-break case.
  const [ratesByStudent, setRatesByStudent] = useState(new Map());

  useEffect(function fetchParents() {
    const ids = (dbStudents || []).map(row => row.id);
    if (ids.length === 0) {
      // No-op reset deletion (per react-hooks/set-state-in-effect): with no
      // students scoped, nothing renders rows to look up, so the map is never
      // read here; the next successful fetch replaces it wholesale anyway.
      return undefined;
    }

    let cancelled = false;
    supabase
      .from('parent_students')
      .select('student_id, parent:profiles(full_name, phone)')
      .in('student_id', ids)
      .order('is_primary', { ascending: false })
      .order('parent_id')
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('Students: failed to load parent contacts', queryError);
          setParentsByStudent(new Map());
          return;
        }
        const map = new Map();
        for (const link of data || []) {
          if (!map.has(link.student_id)) map.set(link.student_id, link.parent || null);
        }
        setParentsByStudent(map);
      });

    return function cleanup() { cancelled = true; };
  }, [dbStudents]);

  useEffect(function fetchAttendanceRates() {
    const ids = (dbStudents || []).map(row => row.id);
    if (ids.length === 0) {
      // No-op reset deletion (per react-hooks/set-state-in-effect): with no
      // students scoped, nothing renders rows to look up, so the map is never
      // read here; the next successful fetch replaces it wholesale anyway.
      return undefined;
    }

    let cancelled = false;

    supabase
      .from('attendance_records')
      .select('student_id, status')
      .in('student_id', ids)
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('Students: failed to load attendance rates', queryError);
          setRatesByStudent(new Map());
          return;
        }
        const rowsByStudent = new Map();
        for (const record of data || []) {
          const list = rowsByStudent.get(record.student_id) || [];
          list.push(record);
          rowsByStudent.set(record.student_id, list);
        }
        const map = new Map();
        for (const [studentId, rows] of rowsByStudent) {
          map.set(studentId, attendanceRate(rows));
        }
        setRatesByStudent(map);
      });

    return function cleanup() { cancelled = true; };
  }, [dbStudents]);

  // Lookups for the form (years to pick from, class sections filtered by year)
  const { years: yearOptions } = useYears();
  const formYearNumber = formYear === '' ? undefined : Number(formYear);
  const { classSections: formClassOptions } = useClassSections({ year: formYearNumber });

  // Real class sections scoped to the active year filter: drives the Classes stat and the class filter.
  const filterYearNumber = filterYear === 'all' ? undefined : Number(filterYear);
  const { classSections: filterClassSections } = useClassSections({ year: filterYearNumber });

  // Real face-enrollment status from the AI bridge (shared hook, polls every 30s).
  // loading/error tell us whether the set is authoritative: while the Express
  // bridge is down (error) or the first fetch is still in flight (loading), a
  // missing name does NOT mean "not registered", so badges show an unknown
  // state instead of a false negative.
  const { enrolledNames, loading: facesLoading, error: facesError } = useEnrolledFaces();
  const facesKnown = !facesLoading && !facesError;

  // Normalize DB rows into the legacy UI shape so the rest of this page can render unchanged.
  // Parent contacts and attendance rates come from the batched lookups above; profiles has no
  // email column, so no parentEmail is surfaced.
  const students = useMemo(() => (dbStudents || []).map(row => {
    // Derive age from dob (same pattern as StudentProfile).
    let age = null;
    if (row.dob) {
      const dob = new Date(row.dob);
      if (!Number.isNaN(dob.getTime())) {
        const ref = new Date();
        age = ref.getFullYear() - dob.getFullYear();
        const m = ref.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
      }
    }
    const parent = parentsByStudent.get(row.id) || null;
    const rateStats = ratesByStudent.get(row.id) || null;
    // gender is nullable in students (migration 0001) — pass the DB value
    // through instead of guessing: only M* → 'M', F* → 'F', null stays null
    // and renders as '—' via genderLabel.
    const genderInitial = (row.gender || '').trim().toUpperCase();
    return {
      id: row.id,
      studentNumber: row.student_number || '',
      name: row.full_name || '',
      year: row.year_num,
      class: row.class_section?.name || '',
      classId: row.class_section_id,
      classColor: row.class_section?.color || classColors[row.class_section?.name] || null,
      gender: genderInitial.startsWith('M') ? 'M' : genderInitial.startsWith('F') ? 'F' : null,
      rawGender: row.gender || null,
      dob: row.dob || null,
      age,
      photoUrl: row.photo_url || null,
      attendanceRate: rateStats ? rateStats.rate : null,
      attendanceStats: rateStats,
      faceRegistered: enrolledNames.has((row.full_name || '').toLowerCase().trim()),
      parent: parent?.full_name || '',
      parentPhone: parent?.phone || '',
    };
  }), [dbStudents, enrolledNames, parentsByStudent, ratesByStudent]);

  const filtered = students.filter(s => {
    const matchYear = filterYear === 'all' || s.year === Number(filterYear);
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || s.class === filterClass;
    const matchFace = filterFace === 'all' || (filterFace === 'registered' ? s.faceRegistered : !s.faceRegistered);
    return matchYear && matchSearch && matchClass && matchFace;
  });

  // Reset page to 1 when search/filters change, during render via the
  // guarded state-mirror pattern instead of an effect (per
  // react-hooks/set-state-in-effect). On mount page is already 1, matching
  // the old effect's no-op first run.
  // Reset page to 1 when search/filters/view mode change, during render via
  // the guarded state-mirror pattern instead of an effect (per
  // react-hooks/set-state-in-effect). On mount page is already 1, matching
  // the old effect's no-op first run. viewMode is included so each view
  // starts from page 1 (D5) instead of inheriting the other view's page.
  const [pageKey, setPageKey] = useState({ search, filterClass, filterFace, filterYear, viewMode });
  if (
    pageKey.search !== search ||
    pageKey.filterClass !== filterClass ||
    pageKey.filterFace !== filterFace ||
    pageKey.filterYear !== filterYear ||
    pageKey.viewMode !== viewMode
  ) {
    setPageKey({ search, filterClass, filterFace, filterYear, viewMode });
    setPage(1);
  }

  // Sort filtered data for table view
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  // Paginate sorted data for table view
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Grid view pagination (D5): same page size, shared page index. gridPage is
  // clamped so a stale index (data shrank after a delete) can never slice an
  // empty page out of the middle of the grid.
  const gridTotalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const gridPage = Math.min(page, gridTotalPages);
  const gridPaged = filtered.slice((gridPage - 1) * PER_PAGE, gridPage * PER_PAGE);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (col) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  // Stats based on year-filtered students
  const yearStudents = filterYear === 'all' ? students : students.filter(s => s.year === Number(filterYear));
  const faceRegistered = yearStudents.filter(s => s.faceRegistered).length;
  const ratedStudents = yearStudents.filter(s => typeof s.attendanceRate === 'number');
  const avgRate = ratedStudents.length > 0 ? Math.round(ratedStudents.reduce((sum, s) => sum + s.attendanceRate, 0) / ratedStudents.length) : null;

  const resetForm = () => {
    setFormName('');
    setFormStudentNumber('');
    setFormYear('');
    setFormClassSectionId('');
    setFormGender('male');
    setFormDob('');
    setFormPhotoUrl('');
    setErrors({});
    setSubmitting(false);
    setEditingStudentId(null);
  };

  const handleOpenAdd = () => {
    if (!isAdmin) return;
    resetForm();
    setModalMode('add');
    // Sensible suggested student number; admin can override.
    setFormStudentNumber('PRISM-' + Date.now().toString(36).toUpperCase());
    setShowModal(true);
  };

  const handleOpenEdit = (s) => {
    if (!isAdmin) return;
    resetForm();
    setModalMode('edit');
    setEditingStudentId(s.id);
    setFormName(s.name || '');
    setFormStudentNumber(s.studentNumber || '');
    setFormYear(s.year ? String(s.year) : '');
    setFormClassSectionId(s.classId || '');
    setFormGender((s.rawGender || 'male').toLowerCase().startsWith('f') ? 'female' : 'male');
    setFormDob(s.dob || '');
    setFormPhotoUrl(s.photoUrl || '');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setShowModal(false);
    resetForm();
  };

  const validate = () => {
    const next = {};
    if (!formName.trim()) next.name = 'Name is required';
    if (modalMode === 'add' && !formStudentNumber.trim()) next.studentNumber = 'Student number is required';
    if (!formYear) next.year = 'Year is required';
    if (!formClassSectionId) next.classSectionId = 'Class is required';
    return next;
  };

  const handleSubmitStudent = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (modalMode === 'add') {
        const payload = {
          student_number: formStudentNumber.trim(),
          full_name: formName.trim(),
          year_num: Number(formYear),
          class_section_id: formClassSectionId,
          gender: formGender,
          dob: formDob || null,
          photo_url: formPhotoUrl.trim() || null,
        };
        const { error: insertError } = await supabase.from('students').insert(payload);
        if (insertError) {
          console.error('Students: insert failed', insertError);
          toast(insertError.message || 'Could not add student', 'error');
          setSubmitting(false);
          return;
        }
        toast(`Added ${payload.full_name}`, 'success');
      } else {
        const payload = {
          full_name: formName.trim(),
          year_num: Number(formYear),
          class_section_id: formClassSectionId,
          gender: formGender,
          dob: formDob || null,
          photo_url: formPhotoUrl.trim() || null,
        };
        const { error: updateError } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudentId);
        if (updateError) {
          console.error('Students: update failed', updateError);
          toast(updateError.message || 'Could not save changes', 'error');
          setSubmitting(false);
          return;
        }
        toast('Student updated', 'success');
      }

      setShowModal(false);
      resetForm();
      refresh();
    } catch (err) {
      console.error('Students: submit failed', err);
      toast('Something went wrong. Please try again.', 'error');
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (s) => {
    if (!isAdmin) return;
    setStudentToDelete(s);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setStudentToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToDelete.id);
      if (deleteError) {
        console.error('Students: delete failed', deleteError);
        toast(deleteError.message || 'Could not delete student', 'error');
        setDeleting(false);
        return;
      }
      toast(`Deleted ${studentToDelete.name}`, 'success');
      setStudentToDelete(null);
      setDeleting(false);
      refresh();
    } catch (err) {
      console.error('Students: delete failed', err);
      toast('Something went wrong. Please try again.', 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div className="students-header-text">
          <h1>
            <span className="word k">Student</span>{' '}
            <span className="word y">Management</span>
            {selectedYear ? <span className="year-badge">Year {selectedYear}</span> : <span className="year-badge year-badge-all">All Years</span>}
          </h1>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* STATS */}
      <div className="grid-4 mb-24">
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DBEAFE' }}><User size={22} color="var(--primary)" /></div>
          <div className="stat-info"><h3>{yearStudents.length}</h3><p>Total Students</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DCFCE7' }}><CheckCircle size={22} color="var(--success)" /></div>
          <div className="stat-info"><h3>{faceRegistered}</h3><p>Face Registered</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DBEAFE' }}><Eye size={22} color="var(--info)" /></div>
          <div className="stat-info"><h3>{avgRate == null ? '—' : `${avgRate}%`}</h3><p>Avg Attendance</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#FEF3C7' }}><Grid3X3 size={22} color="var(--warning)" /></div>
          <div className="stat-info"><h3>{filterClassSections.length}</h3><p>Classes</p></div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="card mb-24">
        <div className="students-toolbar">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input className="search-input search-input-padded" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="toolbar-filters">
            <select className="search-input filter-class" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
              <option value="all">All Classes</option>
              {/* Class names repeat across years in class_sections — offer each once. */}
              {[...new Set(filterClassSections.map(c => c.name))].map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <select className="search-input filter-face" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="all">All Years</option>
              {yearOptions.map(y => <option key={y.year_num} value={y.year_num}>Year {y.year_num}</option>)}
            </select>
            <select className="search-input filter-face" value={filterFace} onChange={e => setFilterFace(e.target.value)}>
              <option value="all">All Face Status</option>
              <option value="registered">Registered</option>
              <option value="not">Not Registered</option>
            </select>
            <button className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('grid')}><Grid3X3 size={16} /></button>
            <button className={`btn btn-icon ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('table')}><List size={16} /></button>
          </div>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="students-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="student-card students-skeleton-card">
              <SkeletonCard />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card students-error-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p className="students-error-headline">Could not load students.</p>
          <p className="students-error-hint">{error.message || 'Try refreshing the page.'}</p>
        </div>
      ) : filtered.length === 0 ? (
        /* EMPTY STATE */
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <p>No students match your search or filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW — paper polaroids (D5: paginated like the table view) */
        <>
        <div className="students-grid">
          {gridPaged.map((s, index) => {
            const colors = ['r', 'y', 'b', 'g', 'o'];
            const tapeSpots = ['tl', 'tr', 'br', 'bl'];
            const avatarColor = colors[index % colors.length];
            const tapeSpot = tapeSpots[index % tapeSpots.length];
            const initials = (s.name || '').split(' ').map(n => n[0]).join('').slice(0, 2);
            const hasRate = typeof s.attendanceRate === 'number';
            return (
              <div key={s.id} className="student-card">
                <span className={`tape ${tapeSpot}`} />
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt={s.name} className={`student-avatar-lg avatar ${avatarColor}`} />
                ) : (
                  <div className={`student-avatar-lg avatar ${avatarColor}`}>{initials}</div>
                )}
                <h3 className="student-name"><Link to={`/dashboard/students/${s.id}`} className="pencil-link">{s.name}</Link></h3>
                <p className="student-meta mono">Year {s.year} &middot; {s.class} &middot; Age {s.age ?? '—'} &middot; {genderLabel(s.gender)}</p>
                <div className="student-pill-row">
                  {s.faceRegistered ? (
                    <span className="badge badge-info"><CheckCircle size={12} /> Face Registered</span>
                  ) : !facesKnown ? (
                    // Bridge unreachable or first fetch in flight — "not in the
                    // set" is not evidence of "not registered".
                    <span className="badge badge-yellow">Face Unknown</span>
                  ) : (
                    <span className="badge badge-absent"><XCircle size={12} /> Not Registered</span>
                  )}
                </div>
                <div className="student-attendance-block">
                  <span className="accent attendance-kicker">Attendance</span>
                  <strong className="attendance-num">{hasRate ? s.attendanceRate : '—'}{hasRate && <span className="attendance-pct">%</span>}</strong>
                  <div className="attendance-track">
                    <div className="attendance-fill" style={{ width: hasRate ? `${s.attendanceRate}%` : '0%', background: hasRate ? (s.attendanceRate >= 90 ? 'var(--green)' : s.attendanceRate >= 80 ? 'var(--yellow)' : 'var(--red)') : 'var(--text-light)' }} />
                  </div>
                </div>
                <p className="student-parent">Parent: {s.parent || '—'}</p>
                <div className="student-actions">
                  <button className="btn btn-outline btn-sm-grid" onClick={() => setSelectedStudent(s)}><Eye size={14} /> View</button>
                  {isAdmin && (
                    <>
                      <button className="btn btn-warm btn-sm-grid" onClick={() => handleOpenEdit(s)}><Edit3 size={14} /> Edit</button>
                      <button className="btn btn-danger btn-sm-grid" onClick={() => handleOpenDelete(s)}><Trash2 size={14} /> Delete</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Pagination currentPage={gridPage} totalPages={gridTotalPages} onPageChange={setPage} />
        </>
      ) : (
        /* TABLE VIEW (D13: scroll wrapper keeps every column reachable) */
        <>
          <div className="card">
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('name')}>Student {renderSortIcon('name')}</th>
                  <th className="sortable" onClick={() => handleSort('year')}>Year {renderSortIcon('year')}</th>
                  <th className="sortable" onClick={() => handleSort('class')}>Class {renderSortIcon('class')}</th>
                  <th className="sortable" onClick={() => handleSort('age')}>Age {renderSortIcon('age')}</th>
                  <th>Gender</th>
                  <th>Parent</th>
                  <th>Phone</th>
                  <th>Face</th>
                  <th className="sortable" onClick={() => handleSort('attendanceRate')}>Attendance {renderSortIcon('attendanceRate')}</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(s => {
                  const hasRate = typeof s.attendanceRate === 'number';
                  return (
                  <tr key={s.id}>
                    <td>
                      <div className="table-student-name">
                        <div className="avatar">{(s.name || '').split(' ').map(n => n[0]).join('')}</div>
                        <Link to={`/dashboard/students/${s.id}`} className="pencil-link">{s.name}</Link>
                      </div>
                    </td>
                    <td><span className="badge badge-info" style={{ fontSize: '0.75rem' }}>Year {s.year}</span></td>
                    <td><span className="class-badge" style={{ borderColor: classColors[s.class], color: classColors[s.class] }}>{s.class}</span></td>
                    <td>{s.age ?? '—'}</td>
                    <td>{genderLabel(s.gender)}</td>
                    <td>{s.parent || '—'}</td>
                    <td>{s.parentPhone || '—'}</td>
                    <td>{s.faceRegistered ? <CheckCircle size={16} color="var(--success)" /> : facesKnown ? <XCircle size={16} color="var(--danger)" /> : '—'}</td>
                    <td>
                      <div className="table-attendance">
                        <div className="mini-progress"><div className="mini-fill" style={{ width: hasRate ? `${s.attendanceRate}%` : '0%' }} /></div>
                        <span className="table-attendance-text">{hasRate ? `${s.attendanceRate}%` : '—'}</span>
                      </div>
                    </td>
                    <td className="col-actions">
                      <div className="table-actions">
                        <button className="btn btn-secondary btn-sm-table" onClick={() => setSelectedStudent(s)}>View</button>
                        {isAdmin && (
                          <>
                            <button className="btn btn-outline btn-sm-table" onClick={() => handleOpenEdit(s)}>Edit</button>
                            <button className="btn btn-danger btn-sm-table" onClick={() => handleOpenDelete(s)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          <Pagination currentPage={page} totalPages={Math.ceil(sorted.length / PER_PAGE)} onPageChange={setPage} />
        </>
      )}

      {/* STUDENT DETAIL MODAL */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal student-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-close">
              <button className="modal-close-btn" onClick={() => setSelectedStudent(null)}><X size={20} /></button>
            </div>
            <div className="detail-top">
              {selectedStudent.photoUrl ? (
                <img src={selectedStudent.photoUrl} alt={selectedStudent.name} className="detail-avatar" />
              ) : (
                <div className="detail-avatar"><User size={40} /></div>
              )}
              <div>
                <h2 className="detail-name">{selectedStudent.name}</h2>
                <p className="detail-subtitle">
                  Year {selectedStudent.year} &bull; {selectedStudent.class} &bull; Age {selectedStudent.age ?? '—'} &bull; {genderLabel(selectedStudent.gender)}
                </p>
              </div>
            </div>
            <div className="detail-stats">
              <div className="detail-stat">
                <h4>{typeof selectedStudent.attendanceRate === 'number' ? `${selectedStudent.attendanceRate}%` : '—'}</h4>
                <p>Attendance Rate</p>
              </div>
              <div className="detail-stat">
                <h4>{selectedStudent.attendanceStats ? selectedStudent.attendanceStats.present : '—'}</h4>
                <p>Days Present</p>
              </div>
              <div className="detail-stat">
                <h4>{selectedStudent.attendanceStats ? selectedStudent.attendanceStats.absent : '—'}</h4>
                <p>Days Absent</p>
              </div>
              <div className="detail-stat">
                <h4>{selectedStudent.faceRegistered ? 'Yes' : facesKnown ? 'No' : '—'}</h4>
                <p>Face Registered</p>
              </div>
            </div>
            <div className="detail-section">
              <h3>Parent Information</h3>
              <div className="detail-info-grid">
                <div><label>Parent Name</label><p>{selectedStudent.parent || '—'}</p></div>
                <div><label>Phone</label><p>{selectedStudent.parentPhone || '—'}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT STUDENT MODAL — admin only */}
      {showModal && isAdmin && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'edit' ? 'Edit Student' : 'Add New Student'}</h2>
              <button className="modal-close-btn" onClick={handleCloseModal} disabled={submitting}><X size={20} /></button>
            </div>

            {modalMode === 'add' && (
              <div className="face-upload">
                <Upload size={32} />
                <p>Upload or capture face photo</p>
                <small>Enroll faces via Admin Panel → Face Registration</small>
              </div>
            )}

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter student name"
                className={errors.name ? 'input-error' : ''}
                value={formName}
                onChange={e => { setFormName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
                disabled={submitting}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Student Number {modalMode === 'edit' && <span className="user-form-hint">(read-only)</span>}</label>
              <input
                type="text"
                placeholder="e.g. PRISM-AB12CD"
                className={errors.studentNumber ? 'input-error' : ''}
                value={formStudentNumber}
                onChange={e => { setFormStudentNumber(e.target.value); setErrors(prev => ({ ...prev, studentNumber: '' })); }}
                disabled={modalMode === 'edit' || submitting}
              />
              {errors.studentNumber && <span className="field-error">{errors.studentNumber}</span>}
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label>Year</label>
                <select
                  className={errors.year ? 'input-error' : ''}
                  value={formYear}
                  onChange={e => {
                    setFormYear(e.target.value);
                    // Year changed -> reset class so old class isn't out of range
                    setFormClassSectionId('');
                    setErrors(prev => ({ ...prev, year: '', classSectionId: '' }));
                  }}
                  disabled={submitting}
                >
                  <option value="">Select</option>
                  {(yearOptions || []).map(y => (
                    <option key={y.year_num} value={y.year_num}>Year {y.year_num}</option>
                  ))}
                </select>
                {errors.year && <span className="field-error">{errors.year}</span>}
              </div>
              <div className="form-group">
                <label>Class</label>
                <select
                  className={errors.classSectionId ? 'input-error' : ''}
                  value={formClassSectionId}
                  onChange={e => { setFormClassSectionId(e.target.value); setErrors(prev => ({ ...prev, classSectionId: '' })); }}
                  disabled={!formYear || submitting}
                >
                  <option value="">{formYear ? 'Select' : 'Pick a year first'}</option>
                  {(formClassOptions || []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.classSectionId && <span className="field-error">{errors.classSectionId}</span>}
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={formGender} onChange={e => setFormGender(e.target.value)} disabled={submitting}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Date of Birth <span className="user-form-hint">(optional)</span></label>
              <input
                type="date"
                value={formDob}
                onChange={e => setFormDob(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label>Photo URL <span className="user-form-hint">(optional)</span></label>
              <input
                type="text"
                placeholder="https://..."
                value={formPhotoUrl}
                onChange={e => setFormPhotoUrl(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCloseModal} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitStudent} disabled={submitting}>
                {submitting
                  ? (modalMode === 'edit' ? 'Saving...' : 'Adding...')
                  : (modalMode === 'edit' ? 'Save Changes' : 'Add Student')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRMATION — admin only */}
      {studentToDelete && isAdmin && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal student-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Student?</h2>
              <button className="modal-close-btn" onClick={handleCancelDelete} disabled={deleting}><X size={20} /></button>
            </div>
            <p className="student-delete-message">
              Delete <strong>{studentToDelete.name}</strong>? This also removes
              all their attendance records, parent links, and teacher notes.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCancelDelete} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
