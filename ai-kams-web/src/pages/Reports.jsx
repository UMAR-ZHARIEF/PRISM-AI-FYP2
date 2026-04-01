import { useState } from 'react';
import { Download, Calendar, TrendingUp, Users, UserX, Printer, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { weeklyAttendance, monthlyAttendance, attendanceToday, students, classAttendance } from '../data/mockData';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import './Reports.css';

const PIE_COLORS = ['#22C55E', '#EF4444', '#F59E0B'];
const CLASS_COLORS = ['#1E40AF', '#3B82F6', '#22C55E', '#F59E0B'];

export default function Reports() {
  const [dateRange, setDateRange] = useState('week');
  const [filterClass, setFilterClass] = useState('all');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toast = useToast();
  const PER_PAGE = 8;

  const present = attendanceToday.filter(a => a.status === 'present').length;
  const absent = attendanceToday.filter(a => a.status === 'absent').length;
  const late = attendanceToday.filter(a => a.status === 'late').length;
  const totalRate = Math.round((present / attendanceToday.length) * 100);

  const pieData = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent },
    { name: 'Late', value: late },
  ];

  const classCompareData = classAttendance.map(c => ({
    name: c.class,
    rate: Math.round((c.present / c.total) * 100),
  }));

  const mostAbsent = students.filter(s => s.attendanceRate < 85).sort((a, b) => a.attendanceRate - b.attendanceRate).slice(0, 5);
  const perfectStudents = students.filter(s => s.attendanceRate >= 95).sort((a, b) => b.attendanceRate - a.attendanceRate);

  const filteredAttendance = attendanceToday.filter(a => filterClass === 'all' || a.class === filterClass).sort((a, b) => {
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

  return (
    <div>
      <div className="page-header">
        <h1>Attendance Reports</h1>
        <div className="report-flex-gap-8">
          <button className="btn btn-outline" onClick={() => toast('Printing report...', 'info')}><Printer size={16} /> Print</button>
          <button className="btn btn-outline" onClick={() => toast('CSV exported successfully', 'success')}><Download size={16} /> CSV</button>
          <button className="btn btn-primary" onClick={() => toast('PDF exported successfully', 'success')}><Download size={16} /> PDF</button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid-4 report-mb-24">
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DCFCE7' }}><TrendingUp size={22} style={{ color: 'var(--success)' }} /></div>
          <div className="stat-info"><h3>{totalRate}%</h3><p>Attendance Rate</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DBEAFE' }}><Users size={22} style={{ color: 'var(--primary)' }} /></div>
          <div className="stat-info"><h3>{students.length}</h3><p>Total Students</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#FEE2E2' }}><UserX size={22} style={{ color: 'var(--danger)' }} /></div>
          <div className="stat-info"><h3>{absent}</h3><p>Absent Today</p></div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: '#DBEAFE' }}><Calendar size={22} style={{ color: 'var(--info)' }} /></div>
          <div className="stat-info"><h3>22</h3><p>School Days</p></div>
        </div>
      </div>

      {/* DATE RANGE */}
      <div className="card report-mb-24">
        <div className="date-range-tabs">
          {['week', 'month', 'term'].map(r => (
            <button key={r} className={`btn ${dateRange === r ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDateRange(r)}>
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
        <div className="card">
          <div className="card-header"><h2>Weekly Attendance</h2></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill="#22C55E" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="late" fill="#F59E0B" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="absent" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-header"><h2>Monthly Trend</h2></div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis fontSize={12} domain={[80, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#1E40AF" strokeWidth={2} dot={{ fill: '#1E40AF', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PIE + CLASS COMPARISON */}
      <div className="grid-2 report-mb-24">
        <div className="card">
          <div className="card-header"><h2>Today's Distribution</h2></div>
          <div className="pie-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {pieData.map((p, i) => (
                <div key={i} className="pie-legend-item">
                  <span className="pie-dot" style={{ background: PIE_COLORS[i] }} />
                  <span>{p.name}: <strong>{p.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Class Comparison</h2></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={classCompareData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" domain={[0, 100]} fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={12} width={80} />
              <Tooltip />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {classCompareData.map((entry, i) => <Cell key={i} fill={CLASS_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DETAILED TABLE */}
      <div className="card report-mb-24">
        <div className="card-header">
          <h2>Detailed Records</h2>
          <select className="search-input report-class-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="all">All Classes</option>
            {['Cempaka', 'Melati', 'Dahlia', 'Kenanga'].map(c => <option key={c} value={c}>{c}</option>)}
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
            ) : paged.map(a => {
              const student = students.find(s => s.id === a.studentId);
              return (
                <tr key={a.studentId}>
                  <td>
                    <div className="report-cell-name">
                      <div className="avatar">{a.name.split(' ').map(n => n[0]).join('')}</div>
                      {a.name}
                    </div>
                  </td>
                  <td>{a.class}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span></td>
                  <td>
                    <div className="report-cell-rate">
                      <div className="report-progress"><div className="report-progress-fill" style={{ width: `${student?.attendanceRate || 0}%` }} /></div>
                      <span className="report-rate-value">{student?.attendanceRate || 0}%</span>
                    </div>
                  </td>
                  <td>{a.timeIn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* MOST ABSENT + PERFECT */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h2>Needs Attention</h2></div>
          <table>
            <thead><tr><th>Student</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>
              {mostAbsent.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="report-cell-name">
                      <div className="avatar">{s.name.split(' ').map(n => n[0]).join('')}</div>
                      {s.name}
                    </div>
                  </td>
                  <td><strong>{s.attendanceRate}%</strong></td>
                  <td><span className="badge badge-absent">Low</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-header"><h2>Perfect Attendance</h2></div>
          <table>
            <thead><tr><th>Student</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>
              {perfectStudents.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="report-cell-name">
                      <div className="avatar">{s.name.split(' ').map(n => n[0]).join('')}</div>
                      {s.name}
                    </div>
                  </td>
                  <td><strong>{s.attendanceRate}%</strong></td>
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
