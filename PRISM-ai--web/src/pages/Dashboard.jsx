import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Camera, AlertTriangle, Search, Activity, ArrowUp, ArrowDown, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { notifications, recentActivity, classColors, classes } from '../data/mockData';
import { useToast } from '../components/Toast';
import { useYear } from '../layouts/DashboardLayout';
import Pagination from '../components/Pagination';
import { SkeletonCard, SkeletonTable, SkeletonChart } from '../components/Skeleton';
import useStudents from '../hooks/useStudents';
import useClassSections from '../hooks/useClassSections';
import useAttendance from '../hooks/useAttendance';
import './Dashboard.css';

// ISO date helper (YYYY-MM-DD) in local time.
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Bucket an arrival time string (HH:MM[:SS]) into a coarse half-hour label.
function bucketArrival(t) {
  if (!t || typeof t !== 'string') return null;
  const parts = t.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (Number.isNaN(h)) return null;
  const half = m >= 30 ? 30 : 0;
  return `${String(h).padStart(2, '0')}:${String(half).padStart(2, '0')}`;
}

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toast = useToast();
  const PER_PAGE = 8;

  // Year context (safe fallback if context not yet available)
  let yearCtx;
  try { yearCtx = useYear(); } catch { yearCtx = { selectedYear: null }; }
  const { selectedYear } = yearCtx;

  // Today and the 7-day window ending today (anchored to local-time date math).
  const today = useMemo(() => isoDate(new Date()), []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // 7-day window inclusive of today
    return isoDate(d);
  }, []);

  // AI status polling — Hazwan's Express bridge tells us if the
  // face_recognition.py edge service is online and pushing detections.
  // This is independent of the Supabase data layer below; it only powers
  // the "AI Online / AI Offline" badge on the Live Camera Feed card.
  const [aiStatus, setAiStatus] = useState('offline');
  const [liveAiCount, setLiveAiCount] = useState(0);
  const fetchAiStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data.aiStatus || 'offline');
        setLiveAiCount(data.studentsTracked || 0);
      } else {
        setAiStatus('offline');
      }
    } catch {
      // Express bridge not running — AI is offline as far as the UI is concerned.
      setAiStatus('offline');
    }
  }, []);
  useEffect(() => {
    fetchAiStatus();
    const interval = setInterval(fetchAiStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchAiStatus]);

  // Data hooks. Year filter only matters for student/section enumeration;
  // attendance is filtered to year client-side via student.year_num.
  const hookYear = selectedYear || undefined;
  const { students: dbStudents, loading: studentsLoading } = useStudents({ year: hookYear });
  const { classSections, loading: sectionsLoading } = useClassSections({ year: hookYear });
  const { records: weekRecords, loading: attendanceLoading } = useAttendance({ fromDate: weekAgo, toDate: today });

  const loading = studentsLoading || sectionsLoading || attendanceLoading;

  // Year-scoped attendance: when a year is selected, drop records whose
  // joined student is in a different year.
  const yearRecords = useMemo(() => {
    if (!selectedYear) return weekRecords;
    return weekRecords.filter(r => r.student?.year_num === selectedYear);
  }, [weekRecords, selectedYear]);

  // Today's records only.
  const todayRecords = useMemo(
    () => yearRecords.filter(r => r.date === today),
    [yearRecords, today]
  );

  // Today's counts straight off the records.
  const present = useMemo(() => todayRecords.filter(r => r.status === 'present').length, [todayRecords]);
  const absent = useMemo(() => todayRecords.filter(r => r.status === 'absent').length, [todayRecords]);
  const late = useMemo(() => todayRecords.filter(r => r.status === 'late').length, [todayRecords]);

  // Total students for the selected year (or all years).
  const totalStudents = dbStudents.length;
  const attendanceRate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

  // Class-by-class stats — single attendance pass, grouped client-side by class_section_id.
  const filteredClassAttendance = useMemo(() => {
    const byClass = new Map();
    for (const r of todayRecords) {
      const id = r.student?.class_section_id;
      if (!id) continue;
      if (!byClass.has(id)) byClass.set(id, { present: 0, absent: 0, late: 0 });
      const bucket = byClass.get(id);
      if (r.status === 'present') bucket.present += 1;
      else if (r.status === 'absent') bucket.absent += 1;
      else if (r.status === 'late') bucket.late += 1;
    }
    // Total students per section, scoped to current year filter.
    const totalsBySection = new Map();
    for (const s of dbStudents) {
      const id = s.class_section_id;
      if (!id) continue;
      totalsBySection.set(id, (totalsBySection.get(id) || 0) + 1);
    }
    return classSections.map(section => {
      const counts = byClass.get(section.id) || { present: 0, absent: 0, late: 0 };
      const totalForSection = totalsBySection.get(section.id) || (counts.present + counts.absent + counts.late);
      return {
        id: section.id,
        class: section.name,
        year: section.year_num,
        present: counts.present,
        absent: counts.absent,
        late: counts.late,
        total: totalForSection,
      };
    });
  }, [todayRecords, dbStudents, classSections]);

  // Weekly chart data: last 7 days, present/absent/late counts per day.
  const weeklyAttendance = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
      days.push({ iso, day: label, present: 0, absent: 0, late: 0 });
    }
    const byIso = new Map(days.map(d => [d.iso, d]));
    for (const r of yearRecords) {
      const bucket = byIso.get(r.date);
      if (!bucket) continue;
      if (r.status === 'present') bucket.present += 1;
      else if (r.status === 'absent') bucket.absent += 1;
      else if (r.status === 'late') bucket.late += 1;
    }
    return days;
  }, [yearRecords]);

  // Arrival time distribution for today (half-hour buckets, sorted by time).
  const dailyArrivalTimes = useMemo(() => {
    const buckets = new Map();
    for (const r of todayRecords) {
      const key = bucketArrival(r.arrival_time);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({ time, count }));
  }, [todayRecords]);

  // Flatten today's records into the legacy row shape so the table renders unchanged.
  const todayRows = useMemo(() => todayRecords.map(r => ({
    studentId: r.student_id,
    name: r.student?.full_name || '',
    class: r.student?.class_section?.name || '',
    year: r.student?.year_num,
    status: r.status,
    timeIn: r.arrival_time || '',
    timeOut: r.departure_time || '',
  })), [todayRecords]);

  const filtered = todayRows.filter(a => {
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

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, filterClass]);

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
    { label: 'Total Students', value: totalStudents, tone: 's-blue',   change: `${totalStudents} enrolled` },
    { label: 'Present',        value: present,       tone: 's-green',  change: `${attendanceRate}% attendance` },
    { label: 'Absent',         value: absent,        tone: 's-red',    change: `${absent} students away` },
    { label: 'Late',           value: late,          tone: 's-orange', change: `${late} arrived late` },
  ];

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <div>
            <h1><span className="word k">Dashboard</span></h1>
            <p className="page-subtitle">Loading...</p>
          </div>
        </div>
        <div className="grid-4 section-gap">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
        <div className="dashboard-grid section-gap"><SkeletonChart /><SkeletonChart /></div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  const noAttendanceToday = todayRecords.length === 0;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1><span className="word k">Dashboard</span>{selectedYear ? <span className="year-badge">Year {selectedYear}</span> : <span className="year-badge year-badge-all">All Years</span>}</h1>
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
          <div key={i} className={`stat-card ${s.tone} reveal reveal-${i + 1}`}>
            <span className={`tape ${i % 2 === 0 ? 'tl' : 'tr'}`} />
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
              <small className="stat-change">{s.change}</small>
            </div>
          </div>
        ))}
      </div>

      {noAttendanceToday && (
        <div className="card section-gap dashboard-empty-today">
          <span className="tape tl" />
          <p>No attendance recorded yet today</p>
        </div>
      )}

      {/* CAMERA + CLASS BREAKDOWN */}
      <div className="dashboard-grid section-gap">
        <div className="card tilt-l">
          <span className="tape tr" />
          <div className="card-header">
            <h2>Live Camera Feed</h2>
            <span className={`live-badge ${aiStatus === 'online' ? '' : 'live-badge-off'}`}><span className="live-dot" /> {aiStatus === 'online' ? 'AI Online' : 'AI Offline'}</span>
          </div>
          <div className="camera-feed">
            <Camera size={56} />
            <p>{aiStatus === 'online' ? 'AI Face Recognition is actively detecting students' : 'Start face_recognition.py to begin detection'}</p>
            <small>{aiStatus === 'online' ? `Sending data every 10 seconds — ${liveAiCount} student(s) detected` : 'Waiting for AI connection...'}</small>
          </div>
        </div>

        <div className="card tilt-r">
          <span className="tape tl" />
          <div className="card-header">
            <h2>Attendance by Class</h2>
          </div>
          <div className="class-breakdown">
            {filteredClassAttendance.length === 0 ? (
              <div className="empty-state">No classes to display.</div>
            ) : filteredClassAttendance.map((c, i) => {
              const rate = c.total > 0 ? Math.round((c.present / c.total) * 100) : 0;
              const linkYear = selectedYear || c.year || 1;
              return (
                <div key={c.id || i} className={`class-card class-card-${i % 4}`} style={{ '--cc': classColors[c.class] }}>
                  <div className="class-card-header">
                    <Link to={`/dashboard/class/${linkYear}/${c.class}`} className="class-link" style={{ color: classColors[c.class] }}>
                      <strong>{!selectedYear && c.year ? `Y${c.year} ` : ''}{c.class}</strong>
                    </Link>
                    <span className="class-rate mono">{rate}%</span>
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
        <div className="card tilt-r">
          <span className="tape bl" />
          <div className="card-header"><h2>Arrival Time Distribution</h2></div>
          {dailyArrivalTimes.length === 0 ? (
            <div className="empty-state">No arrival data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyArrivalTimes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis dataKey="time" fontSize={11} stroke="#1F1A12" />
                <YAxis fontSize={11} stroke="#1F1A12" />
                <Tooltip />
                <Bar dataKey="count" fill="#EA8534" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card tilt-l">
          <span className="tape br" />
          <div className="card-header"><h2>Weekly Trend</h2></div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1A12" strokeOpacity={0.18} />
              <XAxis dataKey="day" fontSize={11} stroke="#1F1A12" />
              <YAxis fontSize={11} stroke="#1F1A12" />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#4FA764" strokeWidth={3} dot={{ fill: '#4FA764', r: 5 }} />
              <Line type="monotone" dataKey="absent"  stroke="#E04A3F" strokeWidth={3} dot={{ fill: '#E04A3F', r: 5 }} />
              <Line type="monotone" dataKey="late"    stroke="#EA8534" strokeWidth={3} dot={{ fill: '#EA8534', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ATTENDANCE TABLE */}
      <div className="card section-gap dashboard-table-card">
        <span className="tape tl" />
        <div className="card-header">
          <h2>Today's Attendance</h2>
          <div className="filter-row">
            <select
              className="search-input filter-select"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
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
            ) : paged.map((a, idx) => {
              const colors = ['r', 'y', 'g', 'o', 'k'];
              const c = colors[idx % colors.length];
              return (
                <tr key={a.studentId}>
                  <td>
                    <div className="student-cell">
                      <div className={`avatar ${c}`}>{a.name.split(' ').map(n => n[0]).join('')}</div>
                      {a.name}
                    </div>
                  </td>
                  <td><Link to={`/dashboard/class/${selectedYear || a.year || 1}/${a.class}`} className="class-link"><span className="class-chip mono" style={{ borderColor: classColors[a.class], color: classColors[a.class] }}>{a.class}</span></Link></td>
                  <td><span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span></td>
                  <td className="mono">{a.timeIn}</td>
                  <td className="mono">{a.timeOut || '—'}</td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => toast('Edit mode opened', 'info')}>Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-footer mono">
          <span>Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} students</span>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* ACTIVITY + NOTIFICATIONS */}
      <div className="dashboard-grid">
        <div className="card tilt-l">
          <span className="tape tr" />
          <div className="card-header">
            <h2><Activity size={20} /> Recent Activity</h2>
          </div>
          <div className="activity-timeline">
            {recentActivity.map(a => (
              <div key={a.id} className="timeline-item">
                <div className={`timeline-dot dot-${a.type}`} />
                <div className="timeline-content">
                  <p><strong>{a.user}</strong> &mdash; {a.action}</p>
                  <small className="mono">{a.timestamp}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tilt-r">
          <span className="tape bl" />
          <div className="card-header">
            <h2>Notifications</h2>
            <span className="badge badge-absent">{notifications.length}</span>
          </div>
          <div className="notif-list">
            {notifications.map(n => (
              <div key={n.id} className={`notif-item notif-${n.type}`}>
                <AlertTriangle size={18} />
                <div>
                  <p>{n.message}</p>
                  <small className="mono">{n.time}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
