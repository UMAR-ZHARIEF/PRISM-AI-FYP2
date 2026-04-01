import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock, Camera, AlertTriangle, Search, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { attendanceToday, notifications, recentActivity, classAttendance, dailyArrivalTimes, weeklyAttendance, classColors } from '../data/mockData';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import { SkeletonCard, SkeletonTable, SkeletonChart } from '../components/Skeleton';
import './Dashboard.css';

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const PER_PAGE = 8;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const present = attendanceToday.filter(a => a.status === 'present').length;
  const absent = attendanceToday.filter(a => a.status === 'absent').length;
  const late = attendanceToday.filter(a => a.status === 'late').length;
  const total = attendanceToday.length;

  const filtered = attendanceToday.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || a.class === filterClass;
    return matchSearch && matchClass;
  }).sort((a, b) => {
    if (!sortCol) return 0;
    const av = a[sortCol] || '';
    const bv = b[sortCol] || '';
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const statCards = [
    { label: 'Total Students', value: total, icon: Users, color: 'var(--primary)', bg: '#DBEAFE', change: '+2 from yesterday' },
    { label: 'Present', value: present, icon: UserCheck, color: 'var(--success)', bg: '#DCFCE7', change: `${Math.round(present/total*100)}% attendance` },
    { label: 'Absent', value: absent, icon: UserX, color: 'var(--danger)', bg: '#FEE2E2', change: `${absent} students away` },
    { label: 'Late', value: late, icon: Clock, color: 'var(--warning)', bg: '#FEF3C7', change: `${late} arrived late` },
  ];

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h1>Dashboard</h1><p className="page-subtitle">Loading...</p></div></div>
        <div className="grid-4 section-gap">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
        <div className="dashboard-grid section-gap"><SkeletonChart /><SkeletonChart /></div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => toast('All students marked present', 'success')}><UserCheck size={16} /> Mark All Present</button>
          <button className="btn btn-primary" onClick={() => toast('Manual check-in mode activated', 'info')}><UserCheck size={16} /> Manual Check-In</button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid-4 section-gap">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="icon-box" style={{ background: s.bg }}>
              <s.icon size={22} color={s.color} />
            </div>
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
              <small className="stat-change">{s.change}</small>
            </div>
          </div>
        ))}
      </div>

      {/* CAMERA + CLASS BREAKDOWN */}
      <div className="dashboard-grid section-gap">
        <div className="card">
          <div className="card-header">
            <h2>Live Camera Feed</h2>
            <span className="live-badge"><span className="live-dot" /> Live</span>
          </div>
          <div className="camera-feed">
            <Camera size={48} />
            <p>Camera feed will be displayed here</p>
            <small>AI Face Recognition Active &mdash; 95.5% Accuracy</small>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Attendance by Class</h2>
          </div>
          <div className="class-breakdown">
            {classAttendance.map((c, i) => {
              const rate = Math.round((c.present / c.total) * 100);
              return (
                <div key={i} className="class-card" style={{ borderLeftColor: classColors[c.class] }}>
                  <div className="class-card-header">
                    <strong>{c.class}</strong>
                    <span className="class-rate">{rate}%</span>
                  </div>
                  <div className="class-counts">
                    <span className="cc-present">{c.present} present</span>
                    <span className="cc-absent">{c.absent} absent</span>
                    <span className="cc-late">{c.late} late</span>
                  </div>
                  <div className="class-progress">
                    <div className="class-progress-fill" style={{ width: `${rate}%`, background: classColors[c.class] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="dashboard-grid section-gap">
        <div className="card">
          <div className="card-header"><h2>Arrival Time Distribution</h2></div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyArrivalTimes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="time" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><h2>Weekly Trend</h2></div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E', r: 4 }} />
              <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} />
              <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ATTENDANCE TABLE */}
      <div className="card section-gap">
        <div className="card-header">
          <h2>Today's Attendance</h2>
          <div className="filter-row">
            <select
              className="search-input filter-select"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {['Cempaka', 'Melati', 'Dahlia', 'Kenanga'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                className="search-input search-input-with-icon"
                placeholder="Search student..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>Student <SortIcon col="name" /></th>
              <th className="sortable" onClick={() => handleSort('class')}>Class <SortIcon col="class" /></th>
              <th className="sortable" onClick={() => handleSort('status')}>Status <SortIcon col="status" /></th>
              <th className="sortable" onClick={() => handleSort('timeIn')}>Time In <SortIcon col="timeIn" /></th>
              <th>Time Out</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No students match your search or filter.</td></tr>
            ) : paged.map(a => (
              <tr key={a.studentId}>
                <td>
                  <div className="student-cell">
                    <div className="avatar">{a.name.split(' ').map(n => n[0]).join('')}</div>
                    {a.name}
                  </div>
                </td>
                <td><span className="class-chip" style={{ borderColor: classColors[a.class], color: classColors[a.class] }}>{a.class}</span></td>
                <td><span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span></td>
                <td>{a.timeIn}</td>
                <td>{a.timeOut}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => toast('Edit mode opened', 'info')}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} students</span>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* ACTIVITY + NOTIFICATIONS */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2><Activity size={18} /> Recent Activity</h2>
          </div>
          <div className="activity-timeline">
            {recentActivity.map(a => (
              <div key={a.id} className="timeline-item">
                <div className={`timeline-dot dot-${a.type}`} />
                <div className="timeline-content">
                  <p><strong>{a.user}</strong> &mdash; {a.action}</p>
                  <small>{a.timestamp}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Notifications</h2>
            <span className="badge badge-absent">{notifications.length}</span>
          </div>
          <div className="notif-list">
            {notifications.map(n => (
              <div key={n.id} className={`notif-item notif-${n.type}`}>
                <AlertTriangle size={16} />
                <div>
                  <p>{n.message}</p>
                  <small>{n.time}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
