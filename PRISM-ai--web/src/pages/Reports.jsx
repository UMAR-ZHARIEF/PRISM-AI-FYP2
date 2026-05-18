import { useState, useMemo } from 'react';
import { Download, Calendar, TrendingUp, Users, UserX, Printer, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { classes } from '../data/mockData';
import useAttendance from '../hooks/useAttendance';
import useStudents from '../hooks/useStudents';
import useClassSections from '../hooks/useClassSections';
import { useToast } from '../components/Toast';
import { useYear } from '../layouts/DashboardLayout';
import Pagination from '../components/Pagination';
import './Reports.css';

// M palette: Present=green, Late=orange, Absent=red
const PIE_COLORS = ['#4FA764', '#E04A3F', '#EA8534'];
// Class comparison: rotate through M palette (5 classes: Bestari, Bijak, Cerdik, Cerdas, Pandai)
const CLASS_COLORS = ['#2F75C9', '#E04A3F', '#4FA764', '#EA8534', '#F2C744'];
// Avatar colour rotation for table rows
const AVA_COLORS = ['r', 'y', 'g', 'o', 'k'];

export default function Reports() {
  const [dateRange, setDateRange] = useState('week');
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

  // Derive date range bounds from the active tab. Format: YYYY-MM-DD.
  const { fromDate, toDate, todayStr } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t = today;
    const toIso = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    let from = new Date(t);
    if (dateRange === 'week') from.setDate(t.getDate() - 6);
    else if (dateRange === 'month') from.setDate(t.getDate() - 29);
    else from.setDate(t.getDate() - 89); // 'term' ~ last 90 days
    return { fromDate: toIso(from), toDate: toIso(t), todayStr: toIso(t) };
  }, [dateRange]);

  // Hooks: load real attendance, students, and class sections for the picked year.
  const { records, loading: attLoading, error: attError } = useAttendance({ fromDate, toDate });
  const { students: yearStudents, loading: stuLoading } = useStudents({ year: selectedYear });
  const { classSections } = useClassSections({ year: selectedYear });

  const loading = attLoading || stuLoading;

  // class_section_id -> name lookup (used to label records and filter dropdown).
  const classNameById = useMemo(() => {
    const m = {};
    (classSections || []).forEach(cs => { if (cs && cs.id) m[cs.id] = cs.name; });
    return m;
  }, [classSections]);

  // student_id -> student lookup (covers selected-year students only).
  const studentsById = useMemo(() => {
    const m = {};
    (yearStudents || []).forEach(s => { if (s && s.id) m[s.id] = s; });
    return m;
  }, [yearStudents]);

  // Year-filtered records: keep records whose student belongs to selected year.
  // When selectedYear is null, every record passes through.
  const yearRecords = useMemo(() => {
    if (!selectedYear) return records || [];
    return (records || []).filter(r => {
      const yn = r.student?.year_num;
      return yn === selectedYear;
    });
  }, [records, selectedYear]);

  // Per-student attendance rate over the loaded range.
  const ratesByStudent = useMemo(() => {
    const tally = {};
    yearRecords.forEach(r => {
      const sid = r.student_id;
      if (!sid) return;
      if (!tally[sid]) tally[sid] = { present: 0, total: 0 };
      tally[sid].total += 1;
      if (r.status === 'present' || r.status === 'late') tally[sid].present += 1;
    });
    const out = {};
    Object.keys(tally).forEach(sid => {
      const t = tally[sid];
      out[sid] = t.total > 0 ? Math.round((t.present / t.total) * 100) : 0;
    });
    return out;
  }, [yearRecords]);

  // Today's records: drives the stat cards + pie chart.
  const todayRecords = useMemo(() => {
    return yearRecords.filter(r => r.date === todayStr);
  }, [yearRecords, todayStr]);

  const present = todayRecords.filter(r => r.status === 'present').length;
  const absent = todayRecords.filter(r => r.status === 'absent').length;
  const late = todayRecords.filter(r => r.status === 'late').length;
  const totalRate = todayRecords.length > 0 ? Math.round((present / todayRecords.length) * 100) : 0;

  const pieData = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent },
    { name: 'Late', value: late },
  ];

  // Weekly chart: bucket records by day-of-week label for the last 7 days.
  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const bucket = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t);
      d.setDate(t.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      bucket.push({ iso, day: days[d.getDay()], present: 0, late: 0, absent: 0 });
    }
    const byIso = {};
    bucket.forEach(b => { byIso[b.iso] = b; });
    yearRecords.forEach(r => {
      const b = byIso[r.date];
      if (!b) return;
      if (r.status === 'present') b.present += 1;
      else if (r.status === 'late') b.late += 1;
      else if (r.status === 'absent') b.absent += 1;
    });
    return bucket;
  }, [yearRecords]);

  // Monthly trend: weekly buckets across the loaded range, showing rate %.
  const monthlyData = useMemo(() => {
    const groups = {};
    yearRecords.forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date + 'T00:00:00');
      // Week-of-month key (YYYY-MM-W).
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${Math.ceil(d.getDate() / 7)}`;
      if (!groups[key]) groups[key] = { present: 0, total: 0 };
      groups[key].total += 1;
      if (r.status === 'present' || r.status === 'late') groups[key].present += 1;
    });
    return Object.keys(groups).sort().map((k, i) => {
      const g = groups[k];
      return {
        week: `W${i + 1}`,
        rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
      };
    });
  }, [yearRecords]);

  // Class comparison: rate per class section for today's records.
  const classCompareData = useMemo(() => {
    const buckets = {};
    todayRecords.forEach(r => {
      const sid = r.student_id;
      const stu = studentsById[sid] || r.student;
      const csid = stu?.class_section_id;
      const cname = (stu?.class_section?.name) || classNameById[csid];
      if (!cname) return;
      if (!buckets[cname]) buckets[cname] = { present: 0, total: 0 };
      buckets[cname].total += 1;
      if (r.status === 'present') buckets[cname].present += 1;
    });
    return Object.keys(buckets).map(name => ({
      name,
      rate: buckets[name].total > 0 ? Math.round((buckets[name].present / buckets[name].total) * 100) : 0,
    }));
  }, [todayRecords, studentsById, classNameById]);

  // "Needs Attention" + "Perfect Attendance" — driven by per-student rates in range.
  const studentRows = useMemo(() => {
    return (yearStudents || []).map(s => ({
      id: s.id,
      name: s.full_name,
      class: s.class_section?.name || classNameById[s.class_section_id] || '',
      attendanceRate: ratesByStudent[s.id] != null ? ratesByStudent[s.id] : 0,
    }));
  }, [yearStudents, classNameById, ratesByStudent]);

  const mostAbsent = useMemo(
    () => studentRows.filter(s => s.attendanceRate > 0 && s.attendanceRate < 85).sort((a, b) => a.attendanceRate - b.attendanceRate).slice(0, 5),
    [studentRows]
  );
  const perfectStudents = useMemo(
    () => studentRows.filter(s => s.attendanceRate >= 95).sort((a, b) => b.attendanceRate - a.attendanceRate),
    [studentRows]
  );

  // Detailed table rows: today's records, sorted/filtered by class.
  const detailedRows = useMemo(() => {
    return todayRecords.map(r => {
      const stu = studentsById[r.student_id] || r.student || {};
      const cname = stu.class_section?.name || classNameById[stu.class_section_id] || '';
      return {
        studentId: r.student_id,
        name: stu.full_name || '—',
        class: cname,
        status: r.status,
        timeIn: r.arrival_time || '-',
        attendanceRate: ratesByStudent[r.student_id] != null ? ratesByStudent[r.student_id] : 0,
      };
    });
  }, [todayRecords, studentsById, classNameById, ratesByStudent]);

  const filteredAttendance = useMemo(() => {
    const base = detailedRows.filter(a => filterClass === 'all' || a.class === filterClass);
    if (!sortCol) return base;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortCol] != null ? a[sortCol] : '';
      const bv = b[sortCol] != null ? b[sortCol] : '';
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [detailedRows, filterClass, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredAttendance.length / PER_PAGE);
  const paged = filteredAttendance.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // School days in the loaded range: count of distinct dates present in records.
  const schoolDays = useMemo(() => {
    const set = new Set();
    yearRecords.forEach(r => { if (r.date) set.add(r.date); });
    return set.size;
  }, [yearRecords]);

  // Class list for the filter dropdown — prefer hook-loaded sections; fall back to static.
  const classList = useMemo(() => {
    const fromHook = (classSections || []).map(cs => cs.name).filter(Boolean);
    return fromHook.length > 0 ? Array.from(new Set(fromHook)) : classes;
  }, [classSections]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  // Mini progress bar fill colour by rate band
  const rateColor = (r) => r >= 95 ? 'var(--green)' : r >= 85 ? 'var(--blue)' : r >= 75 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div className="reports-page">
      <div className="page-header reports-header">
        <div>
          <h1>
            <span className="word k">Attendance</span>{' '}
            <span className="word b">Reports</span>
            {selectedYear ? <span className="year-badge">Year {selectedYear}</span> : <span className="year-badge year-badge-all">All Years</span>}
          </h1>
        </div>
        <div className="report-flex-gap-8">
          <button className="btn btn-yellow" onClick={() => toast('Printing report...', 'info')}><Printer size={16} /> Print</button>
          <button className="btn btn-outline" onClick={() => toast('CSV exported successfully', 'success')}><Download size={16} /> CSV</button>
          <button className="btn btn-primary" onClick={() => toast('PDF exported successfully', 'success')}><Download size={16} /> PDF</button>
        </div>
      </div>

      {attError ? (
        <div className="card report-mb-24 reports-error">
          <span className="tape tl" />
          <p className="reports-error-text">Couldn't load attendance — try again in a moment.</p>
        </div>
      ) : null}

      {/* STATS */}
      <div className="grid-4 report-mb-24">
        <div className="stat-card s-green tilt-l">
          <span className="tape tl" />
          <div className="icon-box"><TrendingUp size={22} /></div>
          <div className="stat-info"><h3>{loading ? '—' : `${totalRate}%`}</h3><p>Attendance Rate</p></div>
        </div>
        <div className="stat-card s-blue tilt-r">
          <div className="icon-box"><Users size={22} /></div>
          <div className="stat-info"><h3>{loading ? '—' : (yearStudents || []).length}</h3><p>Total Students</p></div>
        </div>
        <div className="stat-card s-red tilt-l">
          <div className="icon-box"><UserX size={22} /></div>
          <div className="stat-info"><h3>{loading ? '—' : absent}</h3><p>Absent Today</p></div>
        </div>
        <div className="stat-card s-yellow tilt-r">
          <span className="tape tr" />
          <div className="icon-box"><Calendar size={22} /></div>
          <div className="stat-info"><h3>{loading ? '—' : schoolDays}</h3><p>School Days</p></div>
        </div>
      </div>

      {/* DATE RANGE */}
      <div className="card report-mb-24 daterange-card">
        <span className="tape tl" />
        <div className="date-range-tabs">
          {['week', 'month', 'term'].map(r => (
            <button
              key={r}
              className={`paper-tab ${dateRange === r ? 'is-active' : ''}`}
              onClick={() => setDateRange(r)}
            >
              This {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
          <div className="report-flex-gap-8-ml-auto">
            <input type="date" className="search-input report-date-input" value={fromDate} readOnly />
            <input type="date" className="search-input report-date-input" value={toDate} readOnly />
          </div>
        </div>
      </div>

      {/* WEEKLY + MONTHLY CHARTS */}
      <div className="grid-2 report-mb-24">
        <div className="card chart-card tilt-l">
          <span className="tape tl" />
          <div className="chart-head">
            <h2>Weekly Attendance</h2>
          </div>
          {loading ? (
            <div className="reports-chart-skeleton" />
          ) : weeklyData.every(d => d.present + d.late + d.absent === 0) ? (
            <div className="reports-empty">No attendance recorded for this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis dataKey="day" fontSize={12} stroke="#1F1A12" />
                <YAxis fontSize={12} stroke="#1F1A12" />
                <Tooltip cursor={{ fill: 'rgba(31,26,18,0.06)' }} />
                <Legend />
                <Bar dataKey="present" fill="#4FA764" stackId="a" />
                <Bar dataKey="late"    fill="#EA8534" stackId="a" />
                <Bar dataKey="absent"  fill="#E04A3F" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card chart-card tilt-r">
          <span className="tape tr" />
          <div className="chart-head">
            <h2>Monthly Trend</h2>
          </div>
          {loading ? (
            <div className="reports-chart-skeleton" />
          ) : monthlyData.length === 0 ? (
            <div className="reports-empty">No attendance recorded for this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis dataKey="week" fontSize={12} stroke="#1F1A12" />
                <YAxis fontSize={12} domain={[80, 100]} stroke="#1F1A12" />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#2F75C9" strokeWidth={3} dot={{ fill: '#F2C744', stroke: '#1F1A12', strokeWidth: 2, r: 6 }} activeDot={{ r: 8, fill: '#E04A3F', stroke: '#1F1A12', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* PIE + CLASS COMPARISON */}
      <div className="grid-2 report-mb-24">
        <div className="card chart-card tilt-r">
          <span className="tape tl" />
          <div className="chart-head">
            <h2>Today's Distribution</h2>
          </div>
          {loading ? (
            <div className="reports-chart-skeleton" />
          ) : pieData.every(p => p.value === 0) ? (
            <div className="reports-empty">No attendance taken today.</div>
          ) : (
            <div className="pie-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={92} dataKey="value" stroke="#1F1A12" strokeWidth={2} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {pieData.map((p, i) => (
                  <div key={i} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: PIE_COLORS[i] }} />
                    <span>{p.name}: <strong className="mono">{p.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card chart-card tilt-l">
          <span className="tape tr" />
          <div className="chart-head">
            <h2>Class Comparison</h2>
          </div>
          {loading ? (
            <div className="reports-chart-skeleton" />
          ) : classCompareData.length === 0 ? (
            <div className="reports-empty">No attendance taken today.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={classCompareData} layout="vertical">
                <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis type="number" domain={[0, 100]} fontSize={12} stroke="#1F1A12" />
                <YAxis type="category" dataKey="name" fontSize={12} width={80} stroke="#1F1A12" />
                <Tooltip cursor={{ fill: 'rgba(31,26,18,0.06)' }} />
                <Bar dataKey="rate">
                  {classCompareData.map((entry, i) => <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* DETAILED TABLE */}
      <div className="card report-mb-24 table-card">
        <span className="tape tl" />
        <div className="card-header chart-head">
          <div>
            <h2>Detailed Records</h2>
          </div>
          <select className="search-input report-class-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="all">All Classes</option>
            {classList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>Student <SortIcon col="name" /></th>
              <th className="sortable" onClick={() => handleSort('class')}>Class <SortIcon col="class" /></th>
              <th className="sortable" onClick={() => handleSort('status')}>Status <SortIcon col="status" /></th>
              <th className="sortable" onClick={() => handleSort('attendanceRate')}>Attendance Rate <SortIcon col="attendanceRate" /></th>
              <th className="sortable" onClick={() => handleSort('timeIn')}>Time In <SortIcon col="timeIn" /></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="empty-state">Loading records…</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No records match your filter.</td></tr>
            ) : paged.map((a, i) => {
              const rate = a.attendanceRate || 0;
              const av = AVA_COLORS[i % AVA_COLORS.length];
              const initials = (a.name || '—').split(' ').map(n => n[0]).join('').slice(0, 2);
              return (
                <tr key={a.studentId || i}>
                  <td>
                    <div className="report-cell-name">
                      <div className={`avatar ${av}`}>{initials}</div>
                      {a.name}
                    </div>
                  </td>
                  <td>{a.class}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : '—'}</span></td>
                  <td>
                    <div className="report-cell-rate">
                      <div className="report-progress"><div className="report-progress-fill" style={{ width: `${rate}%`, background: rateColor(rate) }} /></div>
                      <span className="report-rate-value mono">{rate}%</span>
                    </div>
                  </td>
                  <td className="mono">{a.timeIn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* MOST ABSENT + PERFECT */}
      <div className="grid-2">
        <div className="card list-card list-attention tilt-l">
          <span className="tape tl" />
          <div className="chart-head">
            <h2>Needs Attention</h2>
          </div>
          <table>
            <thead><tr><th>Student</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="empty-state">Loading…</td></tr>
              ) : mostAbsent.length === 0 ? (
                <tr><td colSpan={3} className="empty-state">Nobody needs attention right now.</td></tr>
              ) : mostAbsent.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="report-cell-name">
                      <div className={`avatar ${AVA_COLORS[i % AVA_COLORS.length]}`}>{(s.name || '—').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                      {s.name}
                    </div>
                  </td>
                  <td><strong className="mono">{s.attendanceRate}%</strong></td>
                  <td><span className="badge badge-absent">Low</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card list-card list-perfect tilt-r">
          <span className="tape tr" />
          <div className="chart-head">
            <h2>Perfect Attendance</h2>
          </div>
          <table>
            <thead><tr><th>Student</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="empty-state">Loading…</td></tr>
              ) : perfectStudents.length === 0 ? (
                <tr><td colSpan={3} className="empty-state">No perfect attendance yet.</td></tr>
              ) : perfectStudents.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="report-cell-name">
                      <div className={`avatar ${AVA_COLORS[i % AVA_COLORS.length]}`}>{(s.name || '—').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                      {s.name}
                    </div>
                  </td>
                  <td><strong className="mono">{s.attendanceRate}%</strong></td>
                  <td><span className="badge badge-present">Excellent</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
