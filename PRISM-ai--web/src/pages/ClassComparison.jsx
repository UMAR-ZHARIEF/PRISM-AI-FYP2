import { useState, useMemo, useEffect } from 'react';
import { BarChart3, Users, Filter, Check, X, ArrowUp, ArrowDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { classColors, years } from '../data/mockData';
import { useYear } from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import useClassSections from '../hooks/useClassSections';
import useStudents from '../hooks/useStudents';
import useAttendance from '../hooks/useAttendance';
import { SkeletonChart, SkeletonTable } from '../components/Skeleton';
import './ClassComparison.css';

const PIE_COLORS_GENDER = ['#2F75C9', '#F49AB6'];

// Format a Date as 'YYYY-MM-DD' (local, no timezone shift)
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ClassComparison() {
  /* ── Global year context (safe fallback) ── */
  let yearCtx;
  try { yearCtx = useYear(); } catch { yearCtx = { selectedYear: null }; }
  const ctxYear = yearCtx.selectedYear;

  /* ── Local filter state ── */
  const [selectedYear, setSelectedYear] = useState(ctxYear ? String(ctxYear) : 'all');
  const [selectedClassIds, setSelectedClassIds] = useState(() => new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const yearNum = selectedYear === 'all' ? undefined : Number(selectedYear);

  /* ── Load class sections (drives the picker) ── */
  const { classSections, loading: sectionsLoading } = useClassSections({ year: yearNum });

  /* ── Load students in scope (one call; group client-side) ── */
  const { students: dbStudents, loading: studentsLoading } = useStudents({ year: yearNum });

  /* ── Teacher scoping: limit picker to homerooms by default ── */
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  const teacherHomeroomIds = useMemo(() => {
    if (!isTeacher || !profile?.id) return [];
    return (classSections || [])
      .filter(s => s.homeroom_teacher_id === profile.id)
      .map(s => s.id);
  }, [classSections, isTeacher, profile?.id]);
  const teacherHasHomeroom = teacherHomeroomIds.length > 0;

  // Default ON for teachers with a homeroom. Hidden for admins.
  const [myHomeroomsOnly, setMyHomeroomsOnly] = useState(() => isTeacher);

  // If we later discover the teacher has no homeroom, force the filter off
  // so the dropdowns are not empty.
  useEffect(() => {
    if (isTeacher && classSections && classSections.length > 0 && !teacherHasHomeroom) {
      setMyHomeroomsOnly(false);
    }
  }, [isTeacher, teacherHasHomeroom, classSections]);

  // The list of sections the picker offers.
  const filterToMine = isTeacher && myHomeroomsOnly && teacherHasHomeroom;
  const visibleClassSections = useMemo(() => {
    if (!filterToMine) return classSections;
    const allow = new Set(teacherHomeroomIds);
    return (classSections || []).filter(s => allow.has(s.id));
  }, [classSections, filterToMine, teacherHomeroomIds]);

  // Drop any picked classes that fall outside the visible set (e.g. teacher
  // toggles "My homerooms only" back on after picking a class that isn't theirs).
  useEffect(() => {
    if (!filterToMine) return;
    setSelectedClassIds(prev => {
      const allow = new Set(visibleClassSections.map(c => c.id));
      let changed = false;
      const next = new Set();
      prev.forEach(id => {
        if (allow.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [filterToMine, visibleClassSections]);

  /* ── Today's date (YYYY-MM-DD) for "today" counts ── */
  const todayIso = useMemo(() => toLocalISODate(new Date()), []);

  /* ── Last 30 days window for attendance rate ── */
  const { fromIso, toIso } = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return { fromIso: toLocalISODate(from), toIso: toLocalISODate(to) };
  }, []);

  const { records: attendanceRecords, loading: attendanceLoading } =
    useAttendance({ fromDate: fromIso, toDate: toIso });

  /* ── Class toggle helpers ── */
  const toggleClass = (id) => {
    setSelectedClassIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedClassIds(new Set(visibleClassSections.map(c => c.id)));
  const clearAll = () => setSelectedClassIds(new Set());

  /* ── Active sections (only those the user toggled on, in display order) ── */
  const activeClasses = useMemo(
    () => classSections.filter(c => selectedClassIds.has(c.id)),
    [classSections, selectedClassIds]
  );
  const needsMore = activeClasses.length < 2;

  /* ── Group students by class_section_id ── */
  const studentsBySection = useMemo(() => {
    const map = new Map();
    (dbStudents || []).forEach(s => {
      const key = s.class_section_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map;
  }, [dbStudents]);

  /* ── Group attendance records by student.class_section_id ── */
  const recordsBySection = useMemo(() => {
    const map = new Map();
    (attendanceRecords || []).forEach(r => {
      const sectionId = r.student?.class_section_id;
      if (!sectionId) return;
      if (!map.has(sectionId)) map.set(sectionId, []);
      map.get(sectionId).push(r);
    });
    return map;
  }, [attendanceRecords]);

  /* ── Age helper (year diff from dob) ── */
  const ageFromDob = (dob) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age;
  };

  /* ── Attendance rate bar data (last 30 days) ── */
  const attendanceRateData = useMemo(() => {
    return activeClasses.map(cls => {
      const recs = recordsBySection.get(cls.id) || [];
      const rate = recs.length > 0
        ? Math.round((recs.filter(r => r.status === 'present').length / recs.length) * 1000) / 10
        : 0;
      return { name: cls.name, rate };
    });
  }, [activeClasses, recordsBySection]);

  /* ── Today's attendance counts per class ── */
  const todayData = useMemo(() => {
    return activeClasses.map(cls => {
      const recs = (recordsBySection.get(cls.id) || []).filter(r => r.date === todayIso);
      return {
        name: cls.name,
        Present: recs.filter(r => r.status === 'present').length,
        Absent: recs.filter(r => r.status === 'absent').length,
        Late: recs.filter(r => r.status === 'late').length,
      };
    });
  }, [activeClasses, recordsBySection, todayIso]);

  /* ── Demographics per class ── */
  const demographics = useMemo(() => {
    return activeClasses.map(cls => {
      const classStudents = studentsBySection.get(cls.id) || [];
      const ages = classStudents.map(s => ageFromDob(s.dob)).filter(a => a != null);
      const avgAge = ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length * 10) / 10
        : 0;
      const minAge = ages.length > 0 ? Math.min(...ages) : 0;
      const maxAge = ages.length > 0 ? Math.max(...ages) : 0;
      const male = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('m')).length;
      const female = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('f')).length;
      return { name: cls.name, avgAge, minAge, maxAge, male, female, total: classStudents.length };
    });
  }, [activeClasses, studentsBySection]);

  /* ── Summary table data ── */
  const summaryData = useMemo(() => {
    return activeClasses.map(cls => {
      const classStudents = studentsBySection.get(cls.id) || [];
      const allRecs = recordsBySection.get(cls.id) || [];
      const todayRecs = allRecs.filter(r => r.date === todayIso);
      const present = todayRecs.filter(r => r.status === 'present').length;
      const absent = todayRecs.filter(r => r.status === 'absent').length;
      const late = todayRecs.filter(r => r.status === 'late').length;
      const avgRate = allRecs.length > 0
        ? Math.round((allRecs.filter(r => r.status === 'present').length / allRecs.length) * 1000) / 10
        : 0;
      const ages = classStudents.map(s => ageFromDob(s.dob)).filter(a => a != null);
      const avgAge = ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length * 10) / 10
        : 0;
      const male = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('m')).length;
      const female = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('f')).length;
      return {
        class: cls.name,
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
  }, [activeClasses, studentsBySection, recordsBySection, todayIso]);

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

  /* ── Loading + empty checks ── */
  const isLoading = sectionsLoading || studentsLoading || attendanceLoading;
  const noPick = selectedClassIds.size === 0;

  /* ── Section color helper (DB color first, then static fallback) ── */
  const colorFor = (sectionName) => classColors[sectionName] || '#1F1A12';

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
        {isTeacher && teacherHasHomeroom && (
          <div className="comparison-scope-row">
            <label className="comparison-scope-check">
              <input
                type="checkbox"
                checked={myHomeroomsOnly}
                onChange={e => {
                  setMyHomeroomsOnly(e.target.checked);
                  setSelectedClassIds(new Set());
                }}
              />
              <span>My homerooms only</span>
            </label>
          </div>
        )}
        {isTeacher && !teacherHasHomeroom && (
          <p className="comparison-scope-note">You are not assigned a homeroom — showing all classes</p>
        )}
        <div className="comparison-controls">
          {/* Year filter */}
          <div className="comparison-control-group">
            <label className="comparison-control-label">
              <Filter size={16} /> Year
            </label>
            <select
              className="search-input comparison-year-select"
              value={selectedYear}
              onChange={e => {
                setSelectedYear(e.target.value);
                setSelectedClassIds(new Set());
              }}
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
              {sectionsLoading && visibleClassSections.length === 0 ? (
                <span className="comparison-pick-hint">Loading classes...</span>
              ) : visibleClassSections.length === 0 ? (
                <span className="comparison-pick-hint">No classes available</span>
              ) : (
                visibleClassSections.map(cls => {
                  const checked = selectedClassIds.has(cls.id);
                  const cc = colorFor(cls.name);
                  return (
                    <button
                      key={cls.id}
                      className={`comparison-class-tag ${checked ? 'is-checked' : ''}`}
                      style={{
                        '--tag-color': cc,
                        '--tag-bg': checked ? cc : 'var(--paper-light)',
                        '--tag-text': checked ? '#FAF1DA' : cc,
                      }}
                      onClick={() => toggleClass(cls.id)}
                    >
                      {checked && <Check size={14} />}
                      {cls.name}{yearNum == null ? ` · Y${cls.year_num}` : ''}
                    </button>
                  );
                })
              )}
            </div>
            <div className="comparison-quick-btns">
              <button className="btn btn-outline btn-sm" onClick={selectAll}>Select All</button>
              <button className="btn btn-outline btn-sm" onClick={clearAll}><X size={14} /> Clear</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── NOT YET PICKED ── */}
      {noPick && (
        <div className="comparison-warning card">
          <span className="tape tr" />
          <BarChart3 size={32} />
          <div>
            <h3>Pick classes to compare</h3>
            <p>Choose two or more classes from the controls above to see the comparison charts and table.</p>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {!noPick && isLoading && (
        <>
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonTable rows={Math.max(activeClasses.length, 2)} cols={8} />
        </>
      )}

      {/* ── MINIMUM SELECTION WARNING (after data loaded, only 1 picked) ── */}
      {!noPick && !isLoading && needsMore && (
        <div className="comparison-warning card">
          <span className="tape tr" />
          <BarChart3 size={32} />
          <div>
            <h3>Select at least 2 classes</h3>
            <p>Choose two or more classes from the controls above to see the comparison charts and table.</p>
          </div>
        </div>
      )}

      {!noPick && !isLoading && !needsMore && (
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
                    <Cell key={entry.name} fill={colorFor(entry.name)} />
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
                {demographics.map((d) => (
                  <div
                    key={d.name}
                    className="comparison-age-card"
                    style={{ '--cc': colorFor(d.name) }}
                  >
                    <div className="comparison-age-header">
                      <span className="comparison-age-class" style={{ color: colorFor(d.name) }}>
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
                              background: colorFor(d.name),
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
                      <h4 style={{ color: colorFor(d.name) }}>{d.name}</h4>
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
                          <span className="comparison-table-class" style={{ borderColor: colorFor(row.class), color: colorFor(row.class) }}>
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
