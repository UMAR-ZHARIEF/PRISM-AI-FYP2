import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import Pagination from '../components/Pagination';
import { classColors } from '../data/mockData';

// Shared by both role layouts, so sorting/filtering behave identically wherever
// the attendance panel is placed in the page.
export default function DashboardAttendance({
  rows, total, page, totalPages, pageSize, onPageChange, search, onSearchChange,
  filterClass, onClassChange, classes, selectedYear, sortCol, sortDir, onSort, onEdit,
}) {
  const sortIcon = (column) => sortCol === column
    ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
    : null;

  return (
    <section className="card section-gap dashboard-table-card" aria-label="Today's attendance">
      <div className="card-header">
        <h2>Today's Attendance</h2>
        <div className="filter-row">
          <select className="search-input filter-select" aria-label="Filter attendance by class" value={filterClass} onChange={event => onClassChange(event.target.value)}>
            <option value="all">All Classes</option>
            {classes.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <div className="search-wrapper">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input className="search-input search-input-with-icon" aria-label="Search attendance" placeholder="Search student…" value={search} onChange={event => onSearchChange(event.target.value)} />
          </div>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[['name', 'Student'], ['class', 'Class'], ['status', 'Status'], ['timeIn', 'Time In']].map(([column, label]) => (
                <th key={column} aria-sort={sortCol === column ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="table-sort-button" onClick={() => onSort(column)}>{label} {sortIcon(column)}</button>
                </th>
              ))}
              <th>Time Out</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">{search || filterClass !== 'all' ? 'No students match your filters.' : 'No attendance recorded yet. Use Take Attendance or Manual Attendance to begin.'}</td></tr>
            ) : rows.map((row, index) => (
              <tr key={row.studentId}>
                <td><div className="student-cell"><div className={`avatar ${['r', 'y', 'g', 'o', 'k'][index % 5]}`}>{row.name.split(' ').map(name => name[0]).join('').slice(0, 2)}</div>{row.name}</div></td>
                <td>{row.class ? (
                  <Link to={`/dashboard/class/${selectedYear || row.year || 1}/${encodeURIComponent(row.class)}`} className="class-link">
                    <span className="class-chip mono" style={{ borderColor: classColors[row.class], color: classColors[row.class] }}>{row.class}</span>
                  </Link>
                ) : <span className="class-chip mono">Unassigned</span>}</td>
                <td><span className={`badge badge-${row.status}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span></td>
                <td className="mono">{row.timeIn || '—'}</td><td className="mono">{row.timeOut || '—'}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => onEdit(row.record)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer mono"><span>Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} students</span></div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
    </section>
  );
}
