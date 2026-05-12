import { useState } from 'react';
import { UserCog, Plus, X, Shield, Activity, Settings, Trash2, Edit3, RefreshCw, Download, Cpu, Wifi, Server, CheckCircle, Power, Users, ArrowUp, ArrowDown, Camera, UserCheck, UserX, ScanFace, Check, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { users, auditLogs, classes, classColors, aiModelHistory, students, years } from '../data/mockData';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import './AdminPanel.css';

const PER_PAGE = 8;

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const [showModal, setShowModal] = useState(false);
  const [logFilter, setLogFilter] = useState('all');

  // Toast
  const toast = useToast();

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  // Sorting
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Form validation state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('teacher');
  const [formClass, setFormClass] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Face Registration state
  const [faceStatus, setFaceStatus] = useState(() => {
    const init = {};
    students.forEach(s => { init[s.id] = s.faceRegistered; });
    return init;
  });
  const [faceYearFilter, setFaceYearFilter] = useState('all');
  const [faceClassFilter, setFaceClassFilter] = useState('all');
  const [faceStatusFilter, setFaceStatusFilter] = useState('all');
  const [capturingStudent, setCapturingStudent] = useState(null);
  const [capturePhase, setCapturePhase] = useState(null); // 'capturing' | 'processing' | 'done'
  const [facePage, setFacePage] = useState(1);

  const filteredLogs = logFilter === 'all' ? auditLogs : auditLogs.filter(l => l.type === logFilter);

  // Sort users
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setUserPage(1);
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortCol) return 0;
    const aVal = (a[sortCol] || '').toString().toLowerCase();
    const bVal = (b[sortCol] || '').toString().toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate users
  const totalUserPages = Math.ceil(sortedUsers.length / PER_PAGE);
  const paginatedUsers = sortedUsers.slice((userPage - 1) * PER_PAGE, userPage * PER_PAGE);

  // Paginate logs
  const totalLogPages = Math.ceil(filteredLogs.length / PER_PAGE);
  const paginatedLogs = filteredLogs.slice((logPage - 1) * PER_PAGE, logPage * PER_PAGE);

  // Reset log page when filter changes
  const handleLogFilter = (f) => {
    setLogFilter(f);
    setLogPage(1);
  };

  // Sort indicator
  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    if (!formName.trim()) errors.name = 'Name is required';
    if (!formEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!formEmail.includes('@')) {
      errors.email = 'Email must contain @';
    }
    return errors;
  };

  const handleAddUser = () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setShowModal(false);
    setFormName('');
    setFormEmail('');
    setFormRole('teacher');
    setFormClass('');
    setFormErrors({});
    toast('User added successfully', 'success');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormName('');
    setFormEmail('');
    setFormRole('teacher');
    setFormClass('');
    setFormErrors({});
  };

  // Face Registration helpers
  const faceFilteredStudents = students.filter(s => {
    if (faceYearFilter !== 'all' && s.year !== Number(faceYearFilter)) return false;
    if (faceClassFilter !== 'all' && s.class !== faceClassFilter) return false;
    if (faceStatusFilter === 'registered' && !faceStatus[s.id]) return false;
    if (faceStatusFilter === 'not_registered' && faceStatus[s.id]) return false;
    return true;
  });

  const totalFaces = students.length;
  const registeredFaces = students.filter(s => faceStatus[s.id]).length;
  const notRegisteredFaces = totalFaces - registeredFaces;
  const registrationRate = totalFaces > 0 ? Math.round((registeredFaces / totalFaces) * 100) : 0;

  const FACE_PER_PAGE = 12;
  const totalFacePages = Math.ceil(faceFilteredStudents.length / FACE_PER_PAGE);
  const paginatedFaceStudents = faceFilteredStudents.slice((facePage - 1) * FACE_PER_PAGE, facePage * FACE_PER_PAGE);

  // Build progress data grouped by year and class
  const getProgressData = () => {
    const filteredYears = faceYearFilter === 'all' ? years : [Number(faceYearFilter)];
    const filteredClasses = faceClassFilter === 'all' ? classes : [faceClassFilter];
    const groups = [];
    filteredYears.forEach(y => {
      filteredClasses.forEach(c => {
        const classStudents = students.filter(s => s.year === y && s.class === c);
        if (classStudents.length === 0) return;
        const reg = classStudents.filter(s => faceStatus[s.id]).length;
        groups.push({ year: y, class: c, registered: reg, total: classStudents.length, pct: Math.round((reg / classStudents.length) * 100) });
      });
    });
    return groups;
  };

  const handleRegisterFace = (student) => {
    setCapturingStudent(student);
    setCapturePhase('capturing');
    setTimeout(() => setCapturePhase('processing'), 2000);
    setTimeout(() => {
      setCapturePhase('done');
      setFaceStatus(prev => ({ ...prev, [student.id]: true }));
      setTimeout(() => {
        setCapturingStudent(null);
        setCapturePhase(null);
        toast(`Face registered for ${student.name}`, 'success');
      }, 800);
    }, 3000);
  };

  const handleRemoveFace = (student) => {
    setFaceStatus(prev => ({ ...prev, [student.id]: false }));
    toast(`Face registration removed for ${student.name}`, 'warning');
  };

  const classColorMap = { Bestari: 'b', Bijak: 'r', Cerdik: 'g', Cerdas: 'o', Pandai: 'y' };

  const overviewStats = [
    { label: 'Total Users', value: users.length, icon: Users, variant: 's-blue', tape: 'tl' },
    { label: 'Active Cameras', value: 2, icon: Wifi, variant: 's-green', tape: 'tr' },
    { label: 'System Uptime', value: '99.5%', icon: Server, variant: 's-yellow', tape: 'bl' },
    { label: 'AI Accuracy', value: '95.5%', icon: Cpu, variant: 's-orange', tape: 'br' },
  ];

  const roleBadge = { admin: 'badge-admin', teacher: 'badge-teacher', assistant: 'badge-assistant' };
  const avatarColors = ['r', 'y', 'g', 'o', 'k'];

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>
          <span className="word k">Admin</span> <span className="word r">Panel</span>
        </h1>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid-4 admin-section-gap">
        {overviewStats.map((s, i) => (
          <div key={i} className={`stat-card ${s.variant} reveal reveal-${(i % 5) + 1}`}>
            <span className={`tape ${s.tape}`} />
            <div className="icon-box"><s.icon size={22} /></div>
            <div className="stat-info"><h3>{s.value}</h3><p>{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="admin-tabs">
        {[
          { key: 'users', label: 'User Management', icon: UserCog, color: 'r' },
          { key: 'settings', label: 'System Settings', icon: Settings, color: 'b' },
          { key: 'logs', label: 'Audit Logs', icon: Activity, color: 'g' },
          { key: 'ai', label: 'AI Model Status', icon: Shield, color: 'o' },
          { key: 'faces', label: 'Face Registration', icon: ScanFace, color: 'k' },
        ].map(t => (
          <button
            key={t.key}
            className={`admin-tab tab-${t.color} ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="card admin-card admin-users-card">
          <span className="tape tl" />
          <div className="card-header">
            <div>
              <h2>Users</h2>
            </div>
            <button className="btn btn-yellow" onClick={() => setShowModal(true)}><Plus size={16} /> Add User</button>
          </div>
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('name')}>User <SortIcon col="name" /></th>
                <th className="sortable" onClick={() => handleSort('email')}>Email <SortIcon col="email" /></th>
                <th className="sortable" onClick={() => handleSort('role')}>Role <SortIcon col="role" /></th>
                <th>Class</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No results found.</td></tr>
              ) : (
                paginatedUsers.map((u, i) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className={`avatar ${avatarColors[i % avatarColors.length]}`}>{u.name.split(' ').map(n => n[0]).join('')}</div>
                        {u.name}
                      </div>
                    </td>
                    <td className="mono admin-cell-email">{u.email}</td>
                    <td><span className={`badge ${roleBadge[u.role] || 'badge-teacher'}`}>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
                    <td>{u.class || '—'}</td>
                    <td><span className={`status-indicator ${u.status}`}><span className="status-dot" /> {u.status.charAt(0).toUpperCase() + u.status.slice(1)}</span></td>
                    <td>
                      <div className="admin-action-btns">
                        <button className="btn btn-outline btn-icon" onClick={() => toast('Edit mode opened', 'info')}><Edit3 size={14} /></button>
                        <button className="btn btn-danger btn-icon" onClick={() => toast('User deleted', 'error')}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination currentPage={userPage} totalPages={totalUserPages} onPageChange={setUserPage} />
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div className="card admin-card admin-settings-card">
          <span className="tape tr" />
          <div className="card-header">
            <div>
              <h2>System Settings</h2>
            </div>
          </div>
          <div className="settings-grid">
            <div className="settings-section">
              <h3>School Information</h3>
              <div className="form-group"><label>School Name</label><input type="text" defaultValue="SK Ceria PRISM-AI" /></div>
              <div className="form-group"><label>Address</label><input type="text" defaultValue="Kuala Lumpur, Malaysia" /></div>
              <div className="form-group">
                <label>School Hours</label>
                <div className="admin-time-row">
                  <input type="time" defaultValue="07:30" />
                  <input type="time" defaultValue="12:00" />
                </div>
              </div>
              <div className="form-group"><label>Late Threshold</label><input type="time" defaultValue="08:00" /></div>
            </div>

            <div className="settings-section">
              <h3>Notification Settings</h3>
              <div className="toggle-row"><span>Arrival notifications to parents</span><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
              <div className="toggle-row"><span>Absence alerts to parents</span><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
              <div className="toggle-row"><span>Late arrival alerts</span><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
              <div className="toggle-row"><span>Unrecognized face alerts</span><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
              <div className="toggle-row"><span>Weekly report to admin</span><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
            </div>

            <div className="settings-section">
              <h3>Camera Settings</h3>
              <div className="form-group"><label>Camera IP Address</label><input type="text" defaultValue="192.168.1.100" /></div>
              <div className="form-group">
                <label>Resolution</label>
                <select><option>1080p (Full HD)</option><option>720p (HD)</option><option>480p (SD)</option></select>
              </div>
              <div className="form-group">
                <label>Recognition Threshold</label>
                <input type="range" min="50" max="99" defaultValue="85" className="admin-range" />
                <div className="admin-range-labels">
                  <span>50%</span><span>85% (current)</span><span>99%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="admin-settings-footer">
            <button className="btn btn-outline" onClick={() => toast('Settings reset to defaults', 'info')}>Reset Defaults</button>
            <button className="btn btn-green" onClick={() => toast('Settings saved successfully', 'success')}>Save Settings</button>
          </div>
        </div>
      )}

      {/* LOGS TAB */}
      {tab === 'logs' && (
        <div className="card admin-card admin-logs-card">
          <span className="tape bl" />
          <div className="card-header">
            <div>
              <h2>Audit Logs</h2>
            </div>
            <div className="log-filters">
              {['all', 'system', 'user', 'attendance'].map(f => (
                <button key={f} className={`btn btn-sm ${logFilter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleLogFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {paginatedLogs.length === 0 ? (
            <div className="empty-state admin-empty">No results found.</div>
          ) : (
            <ul className="admin-timeline">
              {paginatedLogs.map((log, i) => (
                <li key={log.id} className={`admin-timeline-item type-${log.type}`}>
                  <span className="timeline-dot" />
                  <div className="timeline-time mono">{log.timestamp}</div>
                  <div className="timeline-body">
                    <div className="timeline-head">
                      <div className="admin-user-cell">
                        <div className={`avatar ${avatarColors[i % avatarColors.length]}`}>{log.user.split(' ').map(n => n[0]).join('')}</div>
                        <strong>{log.user}</strong>
                      </div>
                      <span className={`badge badge-log-${log.type}`}>{log.type.charAt(0).toUpperCase() + log.type.slice(1)}</span>
                    </div>
                    <p className="timeline-action">{log.action}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination currentPage={logPage} totalPages={totalLogPages} onPageChange={setLogPage} />
        </div>
      )}

      {/* AI TAB */}
      {tab === 'ai' && (
        <div>
          <div className="ai-status-grid">
            <div className="card admin-card ai-card-active">
              <span className="tape tl" />
              <div className="ai-status-indicator" />
              <h3>Face Recognition Model</h3>
              <p>Status: <strong className="ai-status-active">Active</strong></p>
              <small className="mono">PyTorch v2.1 &bull; Last updated: 2026-03-25</small>
              <div className="ai-actions">
                <button className="btn btn-outline" onClick={() => toast('Model restarting...', 'info')}><Power size={14} /> Restart</button>
                <button className="btn btn-yellow" onClick={() => toast('Retraining initiated', 'info')}><RefreshCw size={14} /> Retrain</button>
              </div>
            </div>

            <div className="card admin-card ai-metrics-card">
              <span className="tape tr" />
              <h3 className="ai-section-title">Performance Metrics</h3>
              <div className="ai-metric">
                <span>Accuracy</span>
                <div className="progress-bar"><div className="progress-fill fill-green" style={{ width: '95.5%' }} /></div>
                <strong className="mono">95.5%</strong>
              </div>
              <div className="ai-metric">
                <span>Response Time</span>
                <div className="progress-bar"><div className="progress-fill fill-blue" style={{ width: '85%' }} /></div>
                <strong className="mono">120ms</strong>
              </div>
              <div className="ai-metric">
                <span>Faces Registered</span>
                <div className="progress-bar"><div className="progress-fill fill-yellow" style={{ width: '80%' }} /></div>
                <strong className="mono">12/15</strong>
              </div>
              <div className="ai-metric">
                <span>Daily Recognitions</span>
                <div className="progress-bar"><div className="progress-fill fill-orange" style={{ width: '90%' }} /></div>
                <strong className="mono">48 today</strong>
              </div>
            </div>

            <div className="card admin-card ai-actions-card">
              <span className="tape br" />
              <h3 className="ai-section-title">Quick Actions</h3>
              <div className="ai-quick-actions">
                <button className="btn btn-outline" onClick={() => toast('Model exported', 'success')}><Download size={14} /> Export Model</button>
                <button className="btn btn-outline"><Activity size={14} /> View Logs</button>
                <button className="btn btn-outline"><Download size={14} /> Download Report</button>
                <button className="btn btn-danger" onClick={() => toast('Cache cleared', 'warning')}><Trash2 size={14} /> Clear Cache</button>
              </div>
            </div>
          </div>

          <div className="card admin-card admin-chart-card admin-section-gap">
            <span className="tape tl" />
            <span className="tape tr" />
            <div className="card-header">
              <div>
                <h2>Model Accuracy Over Time</h2>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={aiModelHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,26,18,0.18)" />
                <XAxis dataKey="date" fontSize={12} stroke="#1F1A12" />
                <YAxis fontSize={12} domain={[88, 98]} stroke="#1F1A12" />
                <Tooltip contentStyle={{ background: '#FAF1DA', border: '2px solid #1F1A12', fontFamily: 'Patrick Hand' }} />
                <Line type="monotone" dataKey="accuracy" stroke="#E04A3F" strokeWidth={3} dot={{ fill: '#E04A3F', r: 5, stroke: '#1F1A12', strokeWidth: 1 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* FACE REGISTRATION TAB */}
      {tab === 'faces' && (
        <div className="face-reg-section">
          {/* Stats */}
          <div className="grid-4 face-stats-row">
            <div className="stat-card s-blue reveal reveal-1">
              <span className="tape tl" />
              <div className="icon-box"><Users size={22} /></div>
              <div className="stat-info"><h3>{totalFaces}</h3><p>Total Students</p></div>
            </div>
            <div className="stat-card s-green reveal reveal-2">
              <span className="tape tr" />
              <div className="icon-box"><UserCheck size={22} /></div>
              <div className="stat-info"><h3>{registeredFaces}</h3><p>Faces Registered</p></div>
            </div>
            <div className="stat-card s-red reveal reveal-3">
              <span className="tape bl" />
              <div className="icon-box"><UserX size={22} /></div>
              <div className="stat-info"><h3>{notRegisteredFaces}</h3><p>Not Registered</p></div>
            </div>
            <div className="stat-card s-yellow reveal reveal-4">
              <span className="tape br" />
              <div className="icon-box"><ScanFace size={22} /></div>
              <div className="stat-info"><h3>{registrationRate}%</h3><p>Registration Rate</p></div>
            </div>
          </div>

          {/* Filters */}
          <div className="card admin-card face-filters-card">
            <span className="tape tl" />
            <div className="face-filters">
              <div className="face-filter-group">
                <Filter size={16} />
                <select value={faceYearFilter} onChange={e => { setFaceYearFilter(e.target.value); setFacePage(1); }}>
                  <option value="all">All Years</option>
                  {years.map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div className="face-filter-group">
                <select value={faceClassFilter} onChange={e => { setFaceClassFilter(e.target.value); setFacePage(1); }}>
                  <option value="all">All Classes</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="face-filter-group">
                <select value={faceStatusFilter} onChange={e => { setFaceStatusFilter(e.target.value); setFacePage(1); }}>
                  <option value="all">All Status</option>
                  <option value="registered">Registered</option>
                  <option value="not_registered">Not Registered</option>
                </select>
              </div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="card admin-card face-progress-card">
            <span className="tape tr" />
            <div className="card-header">
              <div><h2>Registration Progress</h2></div>
            </div>
            <div className="face-progress-list">
              {getProgressData().map((g, i) => (
                <div key={`${g.year}-${g.class}`} className="face-progress-row">
                  <div className="face-progress-label">
                    <span className="face-progress-year mono">Y{g.year}</span>
                    <span className="face-progress-class" style={{ color: classColors[g.class] }}>{g.class}</span>
                  </div>
                  <div className="face-progress-bar-wrap">
                    <div className="progress-bar face-progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${g.pct}%`, background: classColors[g.class] }}
                      />
                    </div>
                  </div>
                  <div className="face-progress-fraction mono">
                    {g.registered}/{g.total}
                  </div>
                  <div className={`face-progress-pct mono ${g.pct === 100 ? 'pct-full' : ''}`}>
                    {g.pct}%
                  </div>
                </div>
              ))}
              {getProgressData().length === 0 && (
                <div className="empty-state admin-empty">No classes match the selected filters.</div>
              )}
            </div>
          </div>

          {/* Student Cards */}
          <div className="card admin-card face-students-card">
            <span className="tape bl" />
            <div className="card-header">
              <div><h2>Students</h2></div>
              <span className="face-count-label mono">{faceFilteredStudents.length} student{faceFilteredStudents.length !== 1 ? 's' : ''}</span>
            </div>
            {paginatedFaceStudents.length === 0 ? (
              <div className="empty-state admin-empty">No students match the selected filters.</div>
            ) : (
              <div className="face-student-grid">
                {paginatedFaceStudents.map(s => (
                  <div key={s.id} className={`face-student-card ${faceStatus[s.id] ? 'registered' : 'not-registered'}`}>
                    <div className="face-student-top">
                      <div className={`avatar ${classColorMap[s.class] || 'k'}`}>
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="face-student-info">
                        <strong>{s.name}</strong>
                        <span className="face-student-meta mono">Year {s.year} &bull; {s.class}</span>
                      </div>
                    </div>
                    <div className="face-student-bottom">
                      <span className={`badge ${faceStatus[s.id] ? 'badge-face-reg' : 'badge-face-unreg'}`}>
                        {faceStatus[s.id] ? <><Check size={12} /> Registered</> : <><X size={12} /> Not Registered</>}
                      </span>
                      {faceStatus[s.id] ? (
                        <button className="btn btn-outline btn-face-remove" onClick={() => handleRemoveFace(s)}>
                          <UserX size={14} /> Remove
                        </button>
                      ) : (
                        <button className="btn btn-green btn-face-register" onClick={() => handleRegisterFace(s)} disabled={capturingStudent !== null}>
                          <Camera size={14} /> Register Face
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination currentPage={facePage} totalPages={totalFacePages} onPageChange={setFacePage} />
          </div>

          {/* Camera Capture Modal */}
          {capturingStudent && (
            <div className="modal-overlay" onClick={() => {}}>
              <div className="modal face-capture-modal" onClick={e => e.stopPropagation()}>
                <div className="face-capture-viewport">
                  <div className={`face-capture-frame phase-${capturePhase}`}>
                    <Camera size={64} strokeWidth={1.5} />
                    <div className="face-capture-scanline" />
                  </div>
                </div>
                <div className="face-capture-info">
                  <h3>{capturingStudent.name}</h3>
                  <p className="face-capture-instruction">
                    {capturePhase === 'capturing' && 'Align face in frame'}
                    {capturePhase === 'processing' && 'Processing facial data...'}
                    {capturePhase === 'done' && 'Registration complete'}
                  </p>
                  <div className={`face-capture-status phase-${capturePhase}`}>
                    {capturePhase === 'capturing' && <><span className="face-capture-dot capturing" /> Capturing...</>}
                    {capturePhase === 'processing' && <><span className="face-capture-dot processing" /> Processing...</>}
                    {capturePhase === 'done' && <><Check size={18} /> Done</>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD USER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add New User</h2>
              <button className="modal-close-btn" onClick={handleCloseModal}><X size={20} /></button>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" placeholder="Enter full name" className={formErrors.name ? 'input-error' : ''} value={formName} onChange={e => setFormName(e.target.value)} />
              {formErrors.name && <span className="field-error">{formErrors.name}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="Enter email" className={formErrors.email ? 'input-error' : ''} value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              {formErrors.email && <span className="field-error">{formErrors.email}</span>}
            </div>
            <div className="admin-form-row-2">
              <div className="form-group">
                <label>Role</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)}><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="assistant">Assistant</option></select>
              </div>
              <div className="form-group">
                <label>Assign Class</label>
                <select value={formClass} onChange={e => setFormClass(e.target.value)}><option value="">None</option>{classes.map(c => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddUser}>Add User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
