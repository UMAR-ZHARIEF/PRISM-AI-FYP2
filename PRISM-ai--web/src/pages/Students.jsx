import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Upload, X, User, Grid3X3, List, CheckCircle, XCircle, Eye, Edit3, Trash2, FileUp, ArrowUp, ArrowDown } from 'lucide-react';
import { classes, classColors, years } from '../data/mockData';
import { useToast } from '../components/Toast';
import { useYear } from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext.jsx';
import Pagination from '../components/Pagination';
import useStudents from '../hooks/useStudents';
import useYears from '../hooks/useYears';
import useClassSections from '../hooks/useClassSections';
import useEnrolledFaces from '../hooks/useEnrolledFaces';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from '../components/Skeleton';
import './Students.css';

export default function Students() {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Year context (safe fallback if context not yet available)
  let yearCtx;
  try { yearCtx = useYear(); } catch { yearCtx = { selectedYear: null }; }
  const { selectedYear } = yearCtx;

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterFace, setFilterFace] = useState('all');
  const [filterYear, setFilterYear] = useState(selectedYear ? String(selectedYear) : 'all');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Table pagination
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

  // Sync filterYear when global selectedYear changes
  useEffect(() => {
    setFilterYear(selectedYear ? String(selectedYear) : 'all');
  }, [selectedYear]);

  // Load students from Supabase. When filterYear === 'all', pass undefined so the hook returns all years.
  const hookYear = filterYear === 'all' ? undefined : Number(filterYear);
  const { students: dbStudents, loading, error, refresh } = useStudents({ year: hookYear });

  // Lookups for the form (years to pick from, class sections filtered by year)
  const { years: yearOptions } = useYears();
  const formYearNumber = formYear === '' ? undefined : Number(formYear);
  const { classSections: formClassOptions } = useClassSections({ year: formYearNumber });

  // Real face-enrollment status from the AI bridge (shared hook, polls every 30s).
  const { enrolledNames } = useEnrolledFaces();

  // Normalize DB rows into the legacy UI shape so the rest of this page can render unchanged.
  // attendanceRate is intentionally null until per-student attendance queries are wired up.
  const students = useMemo(() => (dbStudents || []).map(row => ({
    id: row.id,
    studentNumber: row.student_number || '',
    name: row.full_name || '',
    year: row.year_num,
    class: row.class_section?.name || '',
    classId: row.class_section_id,
    classColor: row.class_section?.color || classColors[row.class_section?.name] || null,
    gender: (row.gender || '').toUpperCase().startsWith('F') ? 'F' : 'M',
    rawGender: row.gender || 'male',
    dob: row.dob || null,
    age: null,
    photoUrl: row.photo_url || null,
    attendanceRate: null,
    faceRegistered: enrolledNames.has((row.full_name || '').toLowerCase().trim()),
    parent: '',
    parentEmail: '',
    parentPhone: '',
  })), [dbStudents, enrolledNames]);

  const filtered = students.filter(s => {
    const matchYear = filterYear === 'all' || s.year === Number(filterYear);
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || s.class === filterClass;
    const matchFace = filterFace === 'all' || (filterFace === 'registered' ? s.faceRegistered : !s.faceRegistered);
    return matchYear && matchSearch && matchClass && matchFace;
  });

  // Reset page to 1 when search/filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterClass, filterFace, filterYear]);

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
          <button className="btn btn-outline" onClick={() => toast('CSV import started', 'info')}><FileUp size={16} /> Import CSV</button>
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
          <div className="stat-info"><h3>{classes.length}</h3><p>Classes</p></div>
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
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="search-input filter-face" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="all">All Years</option>
              {years.map(y => <option key={y} value={y}>Year {y}</option>)}
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
        /* GRID VIEW — paper polaroids */
        <div className="students-grid">
          {filtered.map((s, index) => {
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
                <p className="student-meta mono">Year {s.year} &middot; {s.class} &middot; Age {s.age ?? '—'} &middot; {s.gender === 'M' ? 'Male' : 'Female'}</p>
                <div className="student-pill-row">
                  {s.faceRegistered ? (
                    <span className="badge badge-info"><CheckCircle size={12} /> Face Registered</span>
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
      ) : (
        /* TABLE VIEW */
        <>
          <div className="card">
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
                  <th>Actions</th>
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
                    <td>{s.gender === 'M' ? 'Male' : 'Female'}</td>
                    <td>{s.parent || '—'}</td>
                    <td>{s.parentPhone || '—'}</td>
                    <td>{s.faceRegistered ? <CheckCircle size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}</td>
                    <td>
                      <div className="table-attendance">
                        <div className="mini-progress"><div className="mini-fill" style={{ width: hasRate ? `${s.attendanceRate}%` : '0%' }} /></div>
                        <span className="table-attendance-text">{hasRate ? `${s.attendanceRate}%` : '—'}</span>
                      </div>
                    </td>
                    <td>
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
          <Pagination currentPage={page} totalPages={Math.ceil(filtered.length / PER_PAGE)} onPageChange={setPage} />
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
                  Year {selectedStudent.year} &bull; {selectedStudent.class} &bull; Age {selectedStudent.age ?? '—'} &bull; {selectedStudent.gender === 'M' ? 'Male' : 'Female'}
                </p>
              </div>
            </div>
            <div className="detail-stats">
              <div className="detail-stat">
                <h4>{typeof selectedStudent.attendanceRate === 'number' ? `${selectedStudent.attendanceRate}%` : '—'}</h4>
                <p>Attendance Rate</p>
              </div>
              <div className="detail-stat">
                <h4>{typeof selectedStudent.attendanceRate === 'number' ? Math.round(selectedStudent.attendanceRate * 0.22) : '—'}</h4>
                <p>Days Present</p>
              </div>
              <div className="detail-stat">
                <h4>{typeof selectedStudent.attendanceRate === 'number' ? 22 - Math.round(selectedStudent.attendanceRate * 0.22) : '—'}</h4>
                <p>Days Absent</p>
              </div>
              <div className="detail-stat">
                <h4>{selectedStudent.faceRegistered ? 'Yes' : 'No'}</h4>
                <p>Face Registered</p>
              </div>
            </div>
            <div className="detail-section">
              <h3>Parent Information</h3>
              <div className="detail-info-grid">
                <div><label>Parent Name</label><p>{selectedStudent.parent || '—'}</p></div>
                <div><label>Email</label><p>{selectedStudent.parentEmail || '—'}</p></div>
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
