import { useState } from 'react';
import { Download, Calendar, TrendingUp, Users, UserX, Printer, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { weeklyAttendance, monthlyAttendance, attendanceToday, students, classAttendance, classes } from '../data/mockData';
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

  // Filter all data by selected year
  const yearAttendance = selectedYear
    ? attendanceToday.filter(a => a.year === selectedYear)
    : attendanceToday;

  const yearStudents = selectedYear
    ? students.filter(s => s.year === selectedYear)
    : students;

  const yearClassAttendance = selectedYear
    ? classAttendance.filter(c => c.year === selectedYear)
    : classAttendance;

  const present = yearAttendance.filter(a => a.status === 'present').length;
  const absent = yearAttendance.filter(a => a.status === 'absent').length;
  const late = yearAttendance.filter(a => a.status === 'late').length;
  const totalRate = yearAttendance.length > 0 ? Math.round((present / yearAttendance.length) * 100) : 0;

  const pieData = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent },
    { name: 'Late', value: late },
  ];

  const classCompareData = yearClassAttendance.map(c => ({
    name: c.class,
    rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
  }));

  const mostAbsent = yearStudents.filter(s => s.attendanceRate < 85).sort((a, b) => a.attendanceRate - b.attendanceRate).slice(0, 5);
  const perfectStudents = yearStudents.filter(s => s.attendanceRate >= 95).sort((a, b) => b.attendanceRate - a.attendanceRate);

  const filteredAttendance = yearAttendance.filter(a => filterClass === 'all' || a.class === filterClass).sort((a, b) => {
    if (!sortCol) return 0;
    let av, bv;
    if (sortCol === 'attendanceRate') {
      const sa = students.find(s => s.id === a.studentId);
      const sb = students.find(s => s.id === b.studentId);
      av = sa?.attendanceRate || 0;
      bv = sb?.attendanceRate || 0;
    } else {
      av = a[sortCol] || '';
      bv = b[sortCol] || '';
    }
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filteredAttendance.length / PER_PAGE);
  const paged = filteredAttendance.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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

      {/* STATS */}
      <div className="grid-4 report-mb-24">
        <div className="stat-card s-green tilt-l">
          <span className="tape tl" />
          <div className="icon-box"><TrendingUp size={22} /></div>
          <div className="stat-info"><h3>{totalRate}%</h3><p>Attendance Rate</p></div>
        </div>
        <div className="stat-card s-blue tilt-r">
          <div className="icon-box"><Users size={22} /></div>
          <div className="stat-info"><h3>{yearStudents.length}</h3><p>Total Students</p></div>
        </div>
        <div className="stat-card s-red tilt-l">
          <div className="icon-box"><UserX size={22} /></div>
          <div className="stat-info"><h3>{absent}</h3><p>Absent Today</p></div>
        </div>
        <div className="stat-card s-yellow tilt-r">
          <span className="tape tr" />
          <div className="icon-box"><Calendar size={22} /></div>
          <div className="stat-info"><h3>22</h3><p>School Days</p></div>
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
            <input type="date" className="search-input report-date-input" />
            <input type="date" className="search-input report-date-input" />
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
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyAttendance}>
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
        </div>
        <div className="card chart-card tilt-r">
          <span className="tape tr" />
          <div className="chart-head">
            <h2>Monthly Trend</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyAttendance}>
              <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
              <XAxis dataKey="week" fontSize={12} stroke="#1F1A12" />
              <YAxis fontSize={12} domain={[80, 100]} stroke="#1F1A12" />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#2F75C9" strokeWidth={3} dot={{ fill: '#F2C744', stroke: '#1F1A12', strokeWidth: 2, r: 6 }} activeDot={{ r: 8, fill: '#E04A3F', stroke: '#1F1A12', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PIE + CLASS COMPARISON */}
      <div className="grid-2 report-mb-24">
        <div className="card chart-card tilt-r">
          <span className="tape tl" />
          <div className="chart-head">
            <h2>Today's Distribution</h2>
          </div>
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
        </div>
        <div className="card chart-card tilt-l">
          <span className="tape tr" />
          <div className="chart-head">
            <h2>Class Comparison</h2>
          </div>
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
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
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
            {paged.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No records match your filter.</td></tr>
            ) : paged.map((a, i) => {
              const student = students.find(s => s.id === a.studentId);
              const rate = student?.attendanceRate || 0;
              const av = AVA_COLORS[i % AVA_COLORS.length];
              return (
                <tr key={a.studentId}>
                  <td>
                    <div className="report-cell-name">
                      <div className={`avatar ${av}`}>{a.name.split(' ').map(n => n[0]).join('')}</div>
                      {a.name}
                    </div>
                  </td>
                  <td>{a.class}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span></td>
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
              {mostAbsent.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="report-cell-name">
                      <div className={`avatar ${AVA_COLORS[i % AVA_COLORS.length]}`}>{s.name.split(' ').map(n => n[0]).join('')}</div>
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
              {perfectStudents.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="report-cell-name">
                      <div className={`avatar ${AVA_COLORS[i % AVA_COLORS.length]}`}>{s.name.split(' ').map(n => n[0]).join('')}</div>
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
