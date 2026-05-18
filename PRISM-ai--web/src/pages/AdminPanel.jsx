import { useState, useMemo } from 'react';
import { UserCog, Plus, X, Shield, Activity, Settings, Trash2, Edit3, RefreshCw, Download, Cpu, Wifi, Server, CheckCircle, Power, Users, ArrowUp, ArrowDown, Camera, UserCheck, UserX, ScanFace, Check, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { classes, classColors, aiModelHistory, years } from '../data/mockData';
import useProfiles from '../hooks/useProfiles';
import useAuditLogs from '../hooks/useAuditLogs';
import useAiModels from '../hooks/useAiModels';
import useStudents from '../hooks/useStudents';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
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

  // User Management filter
  const [roleFilter, setRoleFilter] = useState('all');

  // Face Registration state
  const [faceYearFilter, setFaceYearFilter] = useState('all');
  const [faceClassFilter, setFaceClassFilter] = useState('all');
  const [faceStatusFilter, setFaceStatusFilter] = useState('all');
  const [facePage, setFacePage] = useState(1);

  // --- Supabase-backed data ---
  const profilesArgs = roleFilter === 'all' ? {} : { role: roleFilter };
  const { profiles, loading: profilesLoading, error: profilesError } = useProfiles(profilesArgs);
  const { logs: auditLogsData, loading: logsLoading, error: logsError } = useAuditLogs({ limit: 100 });
  const { models: aiModels, loading: modelsLoading, error: modelsError } = useAiModels();
  const { students: studentList, loading: studentsLoading, error: studentsError } = useStudents();

  // face_registered is NOT yet on the students table — default everyone to false.
  const faceStatus = useMemo(() => {
    const map = {};
    studentList.forEach(s => { map[s.id] = false; });
    return map;
  }, [studentList]);

  // --- Audit log filtering (client-side on target_type) ---
  const filteredLogs = logFilter === 'all'
    ? auditLogsData
    : auditLogsData.filter(l => (l.target_type || '').toLowerCase() === logFilter);

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

  const sortedUsers = [...profiles].sort((a, b) => {
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

  const handleRoleFilter = (r) => {
    setRoleFilter(r);
    setUserPage(1);
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
    toast('Coming soon', 'info');
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
  const faceFilteredStudents = studentList.filter(s => {
    if (faceYearFilter !== 'all' && s.year_num !== Number(faceYearFilter)) return false;
    const className = s.class_section?.name;
    if (faceClassFilter !== 'all' && className !== faceClassFilter) return false;
    if (faceStatusFilter === 'registered' && !faceStatus[s.id]) return false;
    if (faceStatusFilter === 'not_registered' && faceStatus[s.id]) return false;
    return true;
  });

  const totalFaces = studentList.length;
  const registeredFaces = studentList.filter(s => faceStatus[s.id]).length;
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
        const classStudents = studentList.filter(s => s.year_num === y && s.class_section?.name === c);
        if (classStudents.length === 0) return;
        const reg = classStudents.filter(s => faceStatus[s.id]).length;
        groups.push({ year: y, class: c, registered: reg, total: classStudents.length, pct: Math.round((reg / classStudents.length) * 100) });
      });
    });
    return groups;
  };

  const handleRegisterFace = () => {
    toast('Coming soon', 'info');
  };

  const handleRemoveFace = () => {
    toast('Coming soon', 'info');
  };

  const classColorMap = { Bestari: 'b', Bijak: 'r', Cerdik: 'g', Cerdas: 'o', Pandai: 'y' };

  const overviewStats = [
    { label: 'Total Users', value: profiles.length, icon: Users, variant: 's-blue', tape: 'tl' },
    { label: 'Active Cameras', value: 2, icon: Wifi, variant: 's-green', tape: 'tr' },
    { label: 'System Uptime', value: '99.5%', icon: Server, variant: 's-yellow', tape: 'bl' },
    { label: 'AI Accuracy', value: '95.5%', icon: Cpu, variant: 's-orange', tape: 'br' },
  ];

  const roleBadge = { admin: 'badge-admin', teacher: 'badge-teacher', assistant: 'badge-assistant', parent: 'badge-teacher' };
  const avatarColors = ['r', 'y', 'g', 'o', 'k'];

  // --- formatters ---
  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getInitials = (name) => (name || '?').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

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
            <div className="admin-users-header-controls">
              <div className="face-filter-group">
                <Filter size={16} />
                <select value={roleFilter} onChange={e => handleRoleFilter(e.target.value)}>
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="assistant">Assistant</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <button className="btn btn-yellow" onClick={() => setShowModal(true)}><Plus size={16} /> Add User</button>
            </div>
          </div>
          {profilesLoading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : profilesError ? (
            <div className="empty-state admin-empty">Could not load users. Please try again.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('full_name')}>User <SortIcon col="full_name" /></th>
                  <th className="sortable" onClick={() => handleSort('role')}>Role <SortIcon col="role" /></th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">No results found.</td></tr>
                ) : (
                  paginatedUsers.map((u, i) => (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-user-cell">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} className={`avatar ${avatarColors[i % avatarColors.length]}`} />
                          ) : (
                            <div className={`avatar ${avatarColors[i % avatarColors.length]}`}>{getInitials(u.full_name)}</div>
                          )}
                          {u.full_name || '—'}
                        </div>
                      </td>
                      <td><span className={`badge ${roleBadge[u.role] || 'badge-teacher'}`}>{(u.role || '').charAt(0).toUpperCase() + (u.role || '').slice(1)}</span></td>
                      <td className="mono">{u.phone || '—'}</td>
                      <td className="mono admin-cell-email">—</td>
                      <td>
                        <div className="admin-action-btns">
                          <button className="btn btn-outline btn-icon" onClick={() => toast('Coming soon', 'info')}><Edit3 size={14} /></button>
                          <button className="btn btn-danger btn-icon" onClick={() => toast('Coming soon', 'info')}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {!profilesLoading && !profilesError && totalUserPages > 1 && (
            <Pagination currentPage={userPage} totalPages={totalUserPages} onPageChange={setUserPage} />
          )}
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
          {logsLoading ? (
            <div className="admin-loading-block">
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-30" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-40" />
            </div>
          ) : logsError ? (
            <div className="empty-state admin-empty">Could not load audit logs. Please try again.</div>
          ) : paginatedLogs.length === 0 ? (
            <div className="empty-state admin-empty">No results found.</div>
          ) : (
            <ul className="admin-timeline">
              {paginatedLogs.map((log, i) => {
                const actorName = log.actor?.full_name || 'System';
                const targetLabel = log.target_type
                  ? `${log.target_type}${log.target_id ? ` #${String(log.target_id).slice(0, 8)}` : ''}`
                  : '';
                const typeKey = (log.target_type || 'system').toLowerCase();
                return (
                  <li key={log.id} className={`admin-timeline-item type-${typeKey}`}>
                    <span className="timeline-dot" />
                    <div className="timeline-time mono">{formatTimestamp(log.created_at)}</div>
                    <div className="timeline-body">
                      <div className="timeline-head">
                        <div className="admin-user-cell">
                          <div className={`avatar ${avatarColors[i % avatarColors.length]}`}>{getInitials(actorName)}</div>
                          <strong>{actorName}</strong>
                        </div>
                        {log.target_type && (
                          <span className={`badge badge-log-${typeKey}`}>{log.target_type.charAt(0).toUpperCase() + log.target_type.slice(1)}</span>
                        )}
                      </div>
                      <p className="timeline-action">
                        {log.action}{targetLabel ? <span className="mono admin-log-target"> &bull; {targetLabel}</span> : null}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="admin-log-metadata mono">{JSON.stringify(log.metadata, null, 0)}</pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!logsLoading && !logsError && totalLogPages > 1 && (
            <Pagination currentPage={logPage} totalPages={totalLogPages} onPageChange={setLogPage} />
          )}
        </div>
      )}

      {/* AI TAB */}
      {tab === 'ai' && (
        <div>
          {modelsLoading ? (
            <div className="ai-status-grid">
              <div className="card admin-card"><div className="skeleton-line w-40" /><div className="skeleton-line w-60" /><div className="skeleton-line w-30" /></div>
              <div className="card admin-card"><div className="skeleton-line w-40" /><div className="skeleton-line w-60" /><div className="skeleton-line w-30" /></div>
              <div className="card admin-card"><div className="skeleton-line w-40" /><div className="skeleton-line w-60" /><div className="skeleton-line w-30" /></div>
            </div>
          ) : modelsError ? (
            <div className="card admin-card"><div className="empty-state admin-empty">Could not load AI models. Please try again.</div></div>
          ) : aiModels.length === 0 ? (
            <div className="card admin-card"><div className="empty-state admin-empty">No AI models found.</div></div>
          ) : (
            <div className="ai-status-grid">
              {aiModels.map((m, i) => {
                const tapes = ['tl', 'tr', 'br', 'bl'];
                const accuracyPct = m.accuracy != null ? Math.round(Number(m.accuracy) * 100) / 100 : null;
                const statusKey = (m.status || 'unknown').toLowerCase();
                return (
                  <div key={m.id} className="card admin-card ai-card-active">
                    <span className={`tape ${tapes[i % tapes.length]}`} />
                    <div className="ai-status-indicator" />
                    <h3>{m.name || 'Untitled Model'}</h3>
                    <p>Status: <strong className={`ai-status-${statusKey}`}>{(m.status || 'Unknown').charAt(0).toUpperCase() + (m.status || 'unknown').slice(1)}</strong></p>
                    <small className="mono">{m.version ? `${m.version} ` : ''}&bull; Deployed: {formatDate(m.deployed_at)}</small>
                    {accuracyPct != null && (
                      <div className="ai-metric admin-section-gap">
                        <span>Accuracy</span>
                        <div className="progress-bar"><div className="progress-fill fill-green" style={{ width: `${Math.min(100, accuracyPct)}%` }} /></div>
                        <strong className="mono">{accuracyPct}%</strong>
                      </div>
                    )}
                    <div className="ai-actions">
                      <button className="btn btn-outline" onClick={() => toast('Coming soon', 'info')}><Power size={14} /> Restart</button>
                      <button className="btn btn-yellow" onClick={() => toast('Coming soon', 'info')}><RefreshCw size={14} /> Retrain</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
          {studentsLoading ? (
            <div className="card admin-card">
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-30" />
              <div className="skeleton-line w-60" />
            </div>
          ) : studentsError ? (
            <div className="card admin-card"><div className="empty-state admin-empty">Could not load students. Please try again.</div></div>
          ) : (
            <>
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
                  {getProgressData().map((g) => (
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
                    {paginatedFaceStudents.map(s => {
                      const className = s.class_section?.name || '—';
                      return (
                        <div key={s.id} className={`face-student-card ${faceStatus[s.id] ? 'registered' : 'not-registered'}`}>
                          <div className="face-student-top">
                            <div className={`avatar ${classColorMap[className] || 'k'}`}>
                              {getInitials(s.full_name)}
                            </div>
                            <div className="face-student-info">
                              <strong>{s.full_name}</strong>
                              <span className="face-student-meta mono">Year {s.year_num} &bull; {className}</span>
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
                              <button className="btn btn-green btn-face-register" onClick={() => handleRegisterFace(s)} >
                                <Camera size={14} /> Register Face
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalFacePages > 1 && (
                  <Pagination currentPage={facePage} totalPages={totalFacePages} onPageChange={setFacePage} />
                )}
              </div>

            </>
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
