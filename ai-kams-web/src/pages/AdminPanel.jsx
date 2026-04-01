import { useState } from 'react';
import { UserCog, Plus, X, Shield, Activity, Settings, Trash2, Edit3, RefreshCw, Download, Cpu, Wifi, Server, CheckCircle, Power, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { users, auditLogs, classes, aiModelHistory } from '../data/mockData';
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

  const overviewStats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'var(--primary)', bg: '#DBEAFE' },
    { label: 'Active Cameras', value: 2, icon: Wifi, color: 'var(--info)', bg: '#DBEAFE' },
    { label: 'System Uptime', value: '99.5%', icon: Server, color: 'var(--success)', bg: '#DCFCE7' },
    { label: 'AI Accuracy', value: '95.5%', icon: Cpu, color: 'var(--warning)', bg: '#FEF3C7' },
  ];

  const roleBadge = { admin: 'badge-admin', teacher: 'badge-teacher', assistant: 'badge-assistant' };

  return (
    <div>
      <div className="page-header"><h1>Admin Panel</h1></div>

      {/* OVERVIEW STATS */}
      <div className="grid-4 admin-section-gap">
        {overviewStats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="icon-box" style={{ background: s.bg }}><s.icon size={22} color={s.color} /></div>
            <div className="stat-info"><h3>{s.value}</h3><p>{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="admin-tabs">
        {[
          { key: 'users', label: 'User Management', icon: UserCog },
          { key: 'settings', label: 'System Settings', icon: Settings },
          { key: 'logs', label: 'Audit Logs', icon: Activity },
          { key: 'ai', label: 'AI Model Status', icon: Shield },
        ].map(t => (
          <button key={t.key} className={`admin-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h2>Users</h2>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add User</button>
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
                paginatedUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="avatar">{u.name.split(' ').map(n => n[0]).join('')}</div>
                        {u.name}
                      </div>
                    </td>
                    <td>{u.email}</td>
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
        <div className="card">
          <div className="card-header"><h2>System Settings</h2></div>
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
            <button className="btn btn-primary" onClick={() => toast('Settings saved successfully', 'success')}>Save Settings</button>
          </div>
        </div>
      )}

      {/* LOGS TAB */}
      {tab === 'logs' && (
        <div className="card">
          <div className="card-header">
            <h2>Audit Logs</h2>
            <div className="log-filters">
              {['all', 'system', 'user', 'attendance'].map(f => (
                <button key={f} className={`btn btn-sm ${logFilter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleLogFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <table>
            <thead><tr><th>User</th><th>Action</th><th>Type</th><th>Timestamp</th></tr></thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr><td colSpan={4} className="empty-state">No results found.</td></tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="avatar">{log.user.split(' ').map(n => n[0]).join('')}</div>
                        {log.user}
                      </div>
                    </td>
                    <td>{log.action}</td>
                    <td><span className={`badge badge-log-${log.type}`}>{log.type.charAt(0).toUpperCase() + log.type.slice(1)}</span></td>
                    <td className="admin-timestamp">{log.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination currentPage={logPage} totalPages={totalLogPages} onPageChange={setLogPage} />
        </div>
      )}

      {/* AI TAB */}
      {tab === 'ai' && (
        <div>
          <div className="ai-status-grid">
            <div className="card ai-card-active">
              <div className="ai-status-indicator" />
              <h3>Face Recognition Model</h3>
              <p>Status: <strong style={{ color: 'var(--success)' }}>Active</strong></p>
              <small>PyTorch v2.1 &bull; Last updated: 2026-03-25</small>
              <div className="ai-actions">
                <button className="btn btn-outline" onClick={() => toast('Model restarting...', 'info')}><Power size={14} /> Restart</button>
                <button className="btn btn-outline" onClick={() => toast('Retraining initiated', 'info')}><RefreshCw size={14} /> Retrain</button>
              </div>
            </div>

            <div className="card">
              <h3 className="ai-section-title">Performance Metrics</h3>
              <div className="ai-metric">
                <span>Accuracy</span>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '95.5%' }} /></div>
                <strong>95.5%</strong>
              </div>
              <div className="ai-metric">
                <span>Response Time</span>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '85%', background: 'var(--info)' }} /></div>
                <strong>120ms</strong>
              </div>
              <div className="ai-metric">
                <span>Faces Registered</span>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '80%', background: 'var(--warning)' }} /></div>
                <strong>12/15</strong>
              </div>
              <div className="ai-metric">
                <span>Daily Recognitions</span>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '90%', background: 'var(--primary)' }} /></div>
                <strong>48 today</strong>
              </div>
            </div>

            <div className="card">
              <h3 className="ai-section-title">Quick Actions</h3>
              <div className="ai-quick-actions">
                <button className="btn btn-outline" onClick={() => toast('Model exported', 'success')}><Download size={14} /> Export Model</button>
                <button className="btn btn-outline"><Activity size={14} /> View Logs</button>
                <button className="btn btn-outline"><Download size={14} /> Download Report</button>
                <button className="btn btn-danger" onClick={() => toast('Cache cleared', 'warning')}><Trash2 size={14} /> Clear Cache</button>
              </div>
            </div>
          </div>

          <div className="card admin-section-gap">
            <div className="card-header"><h2>Model Accuracy Over Time</h2></div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={aiModelHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} domain={[88, 98]} />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" stroke="#1E40AF" strokeWidth={2} dot={{ fill: '#1E40AF', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
