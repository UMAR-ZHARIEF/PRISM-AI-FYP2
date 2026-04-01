import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Upload, X, User, Grid3X3, List, CheckCircle, XCircle, Eye, Edit3, FileUp, ArrowUp, ArrowDown } from 'lucide-react';
import { students, classes, classColors } from '../data/mockData';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import './Students.css';

export default function Students() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterFace, setFilterFace] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Table pagination
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  // Table sorting
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Add Student form fields
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formGender, setFormGender] = useState('M');
  const [formParentName, setFormParentName] = useState('');
  const [formParentEmail, setFormParentEmail] = useState('');
  const [formParentPhone, setFormParentPhone] = useState('');
  const [errors, setErrors] = useState({});

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || s.class === filterClass;
    const matchFace = filterFace === 'all' || (filterFace === 'registered' ? s.faceRegistered : !s.faceRegistered);
    return matchSearch && matchClass && matchFace;
  });

  // Reset page to 1 when search/filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterClass, filterFace]);

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

  const faceRegistered = students.filter(s => s.faceRegistered).length;
  const avgRate = Math.round(students.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length);

  const resetForm = () => {
    setFormName('');
    setFormClass('');
    setFormAge('');
    setFormGender('M');
    setFormParentName('');
    setFormParentEmail('');
    setFormParentPhone('');
    setErrors({});
  };

  const handleAddStudent = () => {
    const newErrors = {};
    if (!formName.trim()) newErrors.name = 'Name is required';
    if (!formClass) newErrors.class = 'Class is required';
    if (!formParentName.trim()) newErrors.parentName = 'Parent name is required';
    if (!formParentEmail.trim()) newErrors.parentEmail = 'Parent email is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setShowModal(false);
    resetForm();
    toast('Student added successfully', 'success');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Student Management</h1>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => toast('CSV import started', 'info')}><FileUp size={16} /> Import CSV</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid-4 mb-24">
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DBEAFE' }}><User size={22} color="var(--primary)" /></div>
          <div className="stat-info"><h3>{students.length}</h3><p>Total Students</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DCFCE7' }}><CheckCircle size={22} color="var(--success)" /></div>
          <div className="stat-info"><h3>{faceRegistered}</h3><p>Face Registered</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DBEAFE' }}><Eye size={22} color="var(--info)" /></div>
          <div className="stat-info"><h3>{avgRate}%</h3><p>Avg Attendance</p></div>
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

      {/* EMPTY STATE */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <p>No students match your search or filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="students-grid">
          {filtered.map(s => (
            <div key={s.id} className="student-card card">
              <div className="student-avatar-lg"><User size={32} /></div>
              <h3>{s.name}</h3>
              <span className="class-badge" style={{ borderColor: classColors[s.class], color: classColors[s.class] }}>{s.class}</span>
              <p className="student-details">Age {s.age} &bull; {s.gender === 'M' ? 'Male' : 'Female'}</p>
              <div className="student-attendance-bar">
                <div className="attendance-label">
                  <span>Attendance</span>
                  <strong>{s.attendanceRate}%</strong>
                </div>
                <div className="attendance-track">
                  <div className="attendance-fill" style={{ width: `${s.attendanceRate}%`, background: s.attendanceRate >= 90 ? 'var(--success)' : s.attendanceRate >= 80 ? 'var(--warning)' : 'var(--danger)' }} />
                </div>
              </div>
              <div className="student-face-status">
                {s.faceRegistered ? (
                  <><CheckCircle size={14} color="var(--success)" /> <span className="face-ok">Face Registered</span></>
                ) : (
                  <><XCircle size={14} color="var(--danger)" /> <span className="face-no">Not Registered</span></>
                )}
              </div>
              <p className="student-parent">Parent: {s.parent}</p>
              <div className="student-actions">
                <button className="btn btn-secondary btn-sm-grid" onClick={() => setSelectedStudent(s)}><Eye size={14} /> View</button>
                <button className="btn btn-outline btn-sm-grid" onClick={() => toast('Edit mode opened', 'info')}><Edit3 size={14} /> Edit</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('name')}>Student {renderSortIcon('name')}</th>
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
                {paged.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="table-student-name">
                        <div className="avatar">{s.name.split(' ').map(n => n[0]).join('')}</div>
                        {s.name}
                      </div>
                    </td>
                    <td><span className="class-badge" style={{ borderColor: classColors[s.class], color: classColors[s.class] }}>{s.class}</span></td>
                    <td>{s.age}</td>
                    <td>{s.gender === 'M' ? 'Male' : 'Female'}</td>
                    <td>{s.parent}</td>
                    <td>{s.parentPhone}</td>
                    <td>{s.faceRegistered ? <CheckCircle size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}</td>
                    <td>
                      <div className="table-attendance">
                        <div className="mini-progress"><div className="mini-fill" style={{ width: `${s.attendanceRate}%` }} /></div>
                        <span className="table-attendance-text">{s.attendanceRate}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-secondary btn-sm-table" onClick={() => setSelectedStudent(s)}>View</button>
                        <button className="btn btn-outline btn-sm-table" onClick={() => toast('Edit mode opened', 'info')}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              <div className="detail-avatar"><User size={40} /></div>
              <div>
                <h2 className="detail-name">{selectedStudent.name}</h2>
                <p className="detail-subtitle">
                  {selectedStudent.class} &bull; Age {selectedStudent.age} &bull; {selectedStudent.gender === 'M' ? 'Male' : 'Female'}
                </p>
              </div>
            </div>
            <div className="detail-stats">
              <div className="detail-stat">
                <h4>{selectedStudent.attendanceRate}%</h4>
                <p>Attendance Rate</p>
              </div>
              <div className="detail-stat">
                <h4>{Math.round(selectedStudent.attendanceRate * 0.22)}</h4>
                <p>Days Present</p>
              </div>
              <div className="detail-stat">
                <h4>{22 - Math.round(selectedStudent.attendanceRate * 0.22)}</h4>
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
                <div><label>Parent Name</label><p>{selectedStudent.parent}</p></div>
                <div><label>Email</label><p>{selectedStudent.parentEmail}</p></div>
                <div><label>Phone</label><p>{selectedStudent.parentPhone}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Student</h2>
              <button className="modal-close-btn" onClick={handleCloseModal}><X size={20} /></button>
            </div>
            <div className="face-upload">
              <Upload size={32} />
              <p>Upload or capture face photo</p>
              <small>For AI face recognition</small>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" placeholder="Enter student name" className={errors.name ? 'input-error' : ''} value={formName} onChange={e => { setFormName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Class</label>
                <select className={errors.class ? 'input-error' : ''} value={formClass} onChange={e => { setFormClass(e.target.value); setErrors(prev => ({ ...prev, class: '' })); }}>
                  <option value="">Select</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.class && <span className="field-error">{errors.class}</span>}
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" placeholder="Age" value={formAge} onChange={e => setFormAge(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={formGender} onChange={e => setFormGender(e.target.value)}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Parent Name</label>
              <input type="text" placeholder="Enter parent name" className={errors.parentName ? 'input-error' : ''} value={formParentName} onChange={e => { setFormParentName(e.target.value); setErrors(prev => ({ ...prev, parentName: '' })); }} />
              {errors.parentName && <span className="field-error">{errors.parentName}</span>}
            </div>
            <div className="form-group">
              <label>Parent Email</label>
              <input type="email" placeholder="Enter parent email" className={errors.parentEmail ? 'input-error' : ''} value={formParentEmail} onChange={e => { setFormParentEmail(e.target.value); setErrors(prev => ({ ...prev, parentEmail: '' })); }} />
              {errors.parentEmail && <span className="field-error">{errors.parentEmail}</span>}
            </div>
            <div className="form-group"><label>Parent Phone</label><input type="tel" placeholder="Enter phone number" value={formParentPhone} onChange={e => setFormParentPhone(e.target.value)} /></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddStudent}>Add Student</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
