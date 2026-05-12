import { useState, useMemo } from 'react';
import { BarChart3, Users, Filter, Check, X, ArrowUp, ArrowDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  students, classes, classColors, classAttendance,
  attendanceToday, weeklyAttendance, years
} from '../data/mockData';
import './ClassComparison.css';

const PIE_COLORS_GENDER = ['#2F75C9', '#F49AB6'];

export default function ClassComparison() {
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedClasses, setSelectedClasses] = useState(() => new Set(classes));
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  /* ── Class toggle helpers ── */
  const toggleClass = (cls) => {
    setSelectedClasses(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const selectAll = () => setSelectedClasses(new Set(classes));
  const clearAll = () => setSelectedClasses(new Set());

  const activeClasses = classes.filter(c => selectedClasses.has(c));
  const needsMore = activeClasses.length < 2;

  /* ── Year filter helper ── */
  const yearNum = selectedYear === 'all' ? null : Number(selectedYear);

  /* ── Filtered student pool ── */
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (yearNum && s.year !== yearNum) return false;
      return selectedClasses.has(s.class);
    });
  }, [yearNum, selectedClasses]);

  /* ── Filtered today records ── */
  const filteredToday = useMemo(() => {
    return attendanceToday.filter(a => {
      if (yearNum && a.year !== yearNum) return false;
      return selectedClasses.has(a.class);
    });
  }, [yearNum, selectedClasses]);

  /* ── Attendance rate bar data ── */
  const attendanceRateData = useMemo(() => {
    return activeClasses.map(cls => {
      const classStudents = students.filter(s =>
        s.class === cls && (!yearNum || s.year === yearNum)
      );
      const avg = classStudents.length > 0
        ? Math.round(classStudents.reduce((sum, s) => sum + s.attendanceRate, 0) / classStudents.length * 10) / 10
        : 0;
      return { name: cls, rate: avg };
    });
  }, [activeClasses, yearNum]);

  /* ── Today's attendance counts per class ── */
  const todayData = useMemo(() => {
    return activeClasses.map(cls => {
      const records = attendanceToday.filter(a =>
        a.class === cls && (!yearNum || a.year === yearNum)
      );
      return {
        name: cls,
        Present: records.filter(a => a.status === 'present').length,
        Absent: records.filter(a => a.status === 'absent').length,
        Late: records.filter(a => a.status === 'late').length,
      };
    });
  }, [activeClasses, yearNum]);

  /* ── Demographics per class ── */
  const demographics = useMemo(() => {
    return activeClasses.map(cls => {
      const classStudents = students.filter(s =>
        s.class === cls && (!yearNum || s.year === yearNum)
      );
      const ages = classStudents.map(s => s.age);
      const avgAge = ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length * 10) / 10
        : 0;
      const minAge = ages.length > 0 ? Math.min(...ages) : 0;
      const maxAge = ages.length > 0 ? Math.max(...ages) : 0;
      const male = classStudents.filter(s => s.gender === 'M').length;
      const female = classStudents.filter(s => s.gender === 'F').length;
      return { name: cls, avgAge, minAge, maxAge, male, female, total: classStudents.length };
    });
  }, [activeClasses, yearNum]);

  /* ── Summary table data ── */
  const summaryData = useMemo(() => {
    return activeClasses.map(cls => {
      const classStudents = students.filter(s =>
        s.class === cls && (!yearNum || s.year === yearNum)
      );
      const todayRecords = attendanceToday.filter(a =>
        a.class === cls && (!yearNum || a.year === yearNum)
      );
      const present = todayRecords.filter(a => a.status === 'present').length;
      const absent = todayRecords.filter(a => a.status === 'absent').length;
      const late = todayRecords.filter(a => a.status === 'late').length;
      const avgRate = classStudents.length > 0
        ? Math.round(classStudents.reduce((sum, s) => sum + s.attendanceRate, 0) / classStudents.length * 10) / 10
        : 0;
      const ages = classStudents.map(s => s.age);
      const avgAge = ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length * 10) / 10
        : 0;
      const male = classStudents.filter(s => s.gender === 'M').length;
      const female = classStudents.filter(s => s.gender === 'F').length;
      return {
        class: cls,
        total: classStudents.length,
        present,
        absent,
        late,
        rate: avgRate,
        avgAge,
        mfRatio: `${male}/${female}`,
        male,
        female,
      };
    });
  }, [activeClasses, yearNum]);

  /* ── Sort logic for summary table ── */
  const sortedSummary = useMemo(() => {
    if (!sortCol) return summaryData;
    return [...summaryData].sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];
      if (sortCol === 'mfRatio') {
        av = a.male / (a.female || 1);
        bv = b.male / (b.female || 1);
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [summaryData, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  /* ── Custom tooltip ── */
  const ClassTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="comparison-tooltip">
        <p className="comparison-tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="comparison-tooltip-value" style={{ color: p.color || p.fill }}>
            {p.name}: <strong className="mono">{p.value}{p.dataKey === 'rate' ? '%' : ''}</strong>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="comparison-page">
      {/* ── HEADER ── */}
      <div className="page-header comparison-header">
        <div>
          <h1>
            <span className="word b">Compare</span>{' '}
            <span className="word k">Classes</span>
          </h1>
          <p className="comparison-subtitle">
            Side-by-side attendance, demographics and performance across classes
          </p>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="card comparison-controls-card">
        <span className="tape tl" />
        <div className="comparison-controls">
          {/* Year filter */}
          <div className="comparison-control-group">
            <label className="comparison-control-label">
              <Filter size={16} /> Year
            </label>
            <select
              className="search-input comparison-year-select"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              <option value="all">All Years</option>
              {years.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>

          {/* Class selection */}
          <div className="comparison-control-group comparison-class-group">
            <label className="comparison-control-label">
              <Users size={16} /> Classes
            </label>
            <div className="comparison-class-toggles">
              {classes.map(cls => (
                <button
                  key={cls}
                  className={`comparison-class-tag ${selectedClasses.has(cls) ? 'is-checked' : ''}`}
                  style={{
                    '--tag-color': classColors[cls],
                    '--tag-bg': selectedClasses.has(cls) ? classColors[cls] : 'var(--paper-light)',
                    '--tag-text': selectedClasses.has(cls) ? '#FAF1DA' : classColors[cls],
                  }}
                  onClick={() => toggleClass(cls)}
                >
                  {selectedClasses.has(cls) && <Check size={14} />}
                  {cls}
                </button>
              ))}
            </div>
            <div className="comparison-quick-btns">
              <button className="btn btn-outline btn-sm" onClick={selectAll}>Select All</button>
              <button className="btn btn-outline btn-sm" onClick={clearAll}><X size={14} /> Clear</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MINIMUM SELECTION WARNING ── */}
      {needsMore && (
        <div className="comparison-warning card">
          <span className="tape tr" />
          <BarChart3 size={32} />
          <div>
            <h3>Select at least 2 classes</h3>
            <p>Choose two or more classes from the controls above to see the comparison charts and table.</p>
          </div>
        </div>
      )}

      {!needsMore && (
        <>
          {/* ── ATTENDANCE RATE BAR CHART ── */}
          <div className="card chart-card comparison-chart-card tilt-l">
            <span className="tape tl" />
            <div className="chart-head">
              <h2><BarChart3 size={22} /> Attendance Rate Comparison</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceRateData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis dataKey="name" fontSize={13} stroke="#1F1A12" />
                <YAxis domain={[0, 100]} fontSize={12} stroke="#1F1A12" tickFormatter={v => `${v}%`} />
                <Tooltip content={<ClassTooltip />} />
                <Bar dataKey="rate" name="Attendance Rate" radius={[3, 3, 0, 0]}>
                  {attendanceRateData.map((entry) => (
                    <Cell key={entry.name} fill={classColors[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── TODAY'S ATTENDANCE STACKED BAR ── */}
          <div className="card chart-card comparison-chart-card tilt-r">
            <span className="tape tr" />
            <div className="chart-head">
              <h2>Today's Attendance Breakdown</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={todayData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="4 4" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis dataKey="name" fontSize={13} stroke="#1F1A12" />
                <YAxis fontSize={12} stroke="#1F1A12" />
                <Tooltip content={<ClassTooltip />} />
                <Legend />
                <Bar dataKey="Present" stackId="a" fill="#4FA764" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Late" stackId="a" fill="#EA8534" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Absent" stackId="a" fill="#E04A3F" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── DEMOGRAPHICS ── */}
          <div className="comparison-demographics-section">
            <h2 className="comparison-section-title">
              <span className="word g">Demographics</span>
            </h2>

            {/* Age distribution */}
            <div className="card chart-card comparison-chart-card tilt-l">
              <span className="tape bl" />
              <div className="chart-head">
                <h2>Age Distribution</h2>
              </div>
              <div className="comparison-age-grid">
                {demographics.map((d, i) => (
                  <div
                    key={d.name}
                    className="comparison-age-card"
                    style={{ '--cc': classColors[d.name] }}
                  >
                    <div className="comparison-age-header">
                      <span className="comparison-age-class" style={{ color: classColors[d.name] }}>
                        {d.name}
                      </span>
                      <span className="comparison-age-count mono">{d.total} students</span>
                    </div>
                    <div className="comparison-age-stats">
                      <div className="comparison-age-avg">
                        <span className="comparison-age-big mono">{d.avgAge}</span>
                        <span className="comparison-age-label">avg age</span>
                      </div>
                      <div className="comparison-age-range">
                        <div className="comparison-age-bar-track">
                          <div
                            className="comparison-age-bar-fill"
                            style={{
                              left: `${((d.minAge - 6) / 7) * 100}%`,
                              width: `${((d.maxAge - d.minAge + 1) / 7) * 100}%`,
                              background: classColors[d.name],
                            }}
                          />
                        </div>
                        <span className="comparison-age-range-text mono">
                          {d.minAge} - {d.maxAge} yrs
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gender distribution */}
            <div className="card chart-card comparison-chart-card tilt-r">
              <span className="tape br" />
              <div className="chart-head">
                <h2>Gender Distribution</h2>
              </div>
              <div className="comparison-gender-grid">
                {demographics.map((d) => {
                  const genderData = [
                    { name: 'Male', value: d.male },
                    { name: 'Female', value: d.female },
                  ];
                  return (
                    <div key={d.name} className="comparison-gender-card">
                      <h4 style={{ color: classColors[d.name] }}>{d.name}</h4>
                      <div className="comparison-gender-chart-wrap">
                        <ResponsiveContainer width="100%" height={120}>
                          <PieChart>
                            <Pie
                              data={genderData}
                              cx="50%"
                              cy="50%"
                              innerRadius={28}
                              outerRadius={48}
                              dataKey="value"
                              stroke="#1F1A12"
                              strokeWidth={2}
                            >
                              {genderData.map((entry, i) => (
                                <Cell key={i} fill={PIE_COLORS_GENDER[i]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="comparison-gender-legend">
                          <span className="comparison-gender-m">
                            <span className="comparison-gender-dot" style={{ background: PIE_COLORS_GENDER[0] }} />
                            M: <strong className="mono">{d.male}</strong>
                          </span>
                          <span className="comparison-gender-f">
                            <span className="comparison-gender-dot" style={{ background: PIE_COLORS_GENDER[1] }} />
                            F: <strong className="mono">{d.female}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── SUMMARY TABLE ── */}
          <div className="card comparison-table-card">
            <span className="tape tl" />
            <div className="card-header chart-head">
              <h2>Summary Table</h2>
              <span className="comparison-table-count mono">
                {activeClasses.length} classes{yearNum ? ` / Year ${yearNum}` : ' / All Years'}
              </span>
            </div>
            <div className="comparison-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('class')}>Class <SortIcon col="class" /></th>
                    <th className="sortable" onClick={() => handleSort('total')}>Total Students <SortIcon col="total" /></th>
                    <th className="sortable" onClick={() => handleSort('present')}>Present Today <SortIcon col="present" /></th>
                    <th className="sortable" onClick={() => handleSort('absent')}>Absent Today <SortIcon col="absent" /></th>
                    <th className="sortable" onClick={() => handleSort('late')}>Late Today <SortIcon col="late" /></th>
                    <th className="sortable" onClick={() => handleSort('rate')}>Attendance Rate <SortIcon col="rate" /></th>
                    <th className="sortable" onClick={() => handleSort('avgAge')}>Avg Age <SortIcon col="avgAge" /></th>
                    <th className="sortable" onClick={() => handleSort('mfRatio')}>M/F Ratio <SortIcon col="mfRatio" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummary.map((row) => {
                    const rateColor = row.rate >= 95 ? 'var(--green)'
                      : row.rate >= 85 ? 'var(--blue)'
                      : row.rate >= 75 ? 'var(--yellow)'
                      : 'var(--red)';
                    return (
                      <tr key={row.class}>
                        <td>
                          <span className="comparison-table-class" style={{ borderColor: classColors[row.class], color: classColors[row.class] }}>
                            {row.class}
                          </span>
                        </td>
                        <td className="mono">{row.total}</td>
                        <td>
                          <span className="badge badge-present">{row.present}</span>
                        </td>
                        <td>
                          <span className="badge badge-absent">{row.absent}</span>
                        </td>
                        <td>
                          <span className="badge badge-late">{row.late}</span>
                        </td>
                        <td>
                          <div className="comparison-table-rate">
                            <div className="comparison-table-progress">
                              <div
                                className="comparison-table-progress-fill"
                                style={{ width: `${row.rate}%`, background: rateColor }}
                              />
                            </div>
                            <span className="mono">{row.rate}%</span>
                          </div>
                        </td>
                        <td className="mono">{row.avgAge}</td>
                        <td className="mono">{row.mfRatio}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
