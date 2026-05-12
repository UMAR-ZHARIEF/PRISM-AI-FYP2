import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { attendanceHistory } from '../data/mockData';
import './AttendanceCalendar.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function AttendanceCalendar({ studentId }) {
  const today = new Date(2026, 4, 11); // May 11, 2026 — app "today"
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [tooltip, setTooltip] = useState(null); // { date, status, timeIn, cellEl }

  const history = attendanceHistory[studentId] || [];

  // Index history by date string for fast lookup
  const historyMap = useMemo(() => {
    const map = {};
    history.forEach(r => { map[r.date] = r; });
    return map;
  }, [history]);

  // Build the weekday grid for the viewed month
  const weeks = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const rows = [];
    let currentWeek = [];

    // Pad the first week with empty cells for days before Mon
    // JS getDay(): 0=Sun..6=Sat.  We want Mon=0..Fri=4
    let startDow = firstDay.getDay(); // 0-6
    // Map to Mon-based: Mon=0, Tue=1, ... Fri=4, Sat=5, Sun=6
    const monBased = startDow === 0 ? 6 : startDow - 1;
    // Only pad weekdays (Mon-Fri = indices 0-4)
    const weekdayPad = Math.min(monBased, 5);
    for (let p = 0; p < weekdayPad; p++) {
      currentWeek.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dow = date.getDay(); // 0=Sun, 6=Sat
      if (dow === 0 || dow === 6) continue; // skip weekends

      const dateStr = date.toISOString().split('T')[0];
      const record = historyMap[dateStr] || null;
      const isFuture = date > today;
      const isToday = dateStr === today.toISOString().split('T')[0];

      currentWeek.push({ day: d, dateStr, record, isFuture, isToday });

      // Mon-Fri index in the current week
      const monIdx = dow === 0 ? 6 : dow - 1; // convert to Mon=0
      if (monIdx === 4) {
        // Friday — end of week row
        rows.push(currentWeek);
        currentWeek = [];
      }
    }
    // Push remaining partial week
    if (currentWeek.length > 0) {
      rows.push(currentWeek);
    }
    return rows;
  }, [viewYear, viewMonth, historyMap, today]);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
    setTooltip(null);
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
    setTooltip(null);
  };

  const handleCellClick = (cell, e) => {
    if (!cell) return;
    if (tooltip && tooltip.dateStr === cell.dateStr) {
      setTooltip(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      dateStr: cell.dateStr,
      day: cell.day,
      record: cell.record,
      isFuture: cell.isFuture,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleCellHover = (cell, e) => {
    if (!cell) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      dateStr: cell.dateStr,
      day: cell.day,
      record: cell.record,
      isFuture: cell.isFuture,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  const statusClass = (cell) => {
    if (!cell) return '';
    if (cell.isFuture) return 'cal-future';
    if (!cell.record) return 'cal-nodata';
    return `cal-${cell.record.status}`;
  };

  // Count stats for this month
  const monthStats = useMemo(() => {
    let present = 0, absent = 0, late = 0;
    weeks.forEach(week => {
      week.forEach(cell => {
        if (cell && cell.record) {
          if (cell.record.status === 'present') present++;
          else if (cell.record.status === 'absent') absent++;
          else if (cell.record.status === 'late') late++;
        }
      });
    });
    return { present, absent, late };
  }, [weeks]);

  return (
    <div className="att-calendar">
      <div className="att-cal-header">
        <button className="att-cal-nav" onClick={goPrev} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <h3 className="att-cal-title">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <button className="att-cal-nav" onClick={goNext} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Legend */}
      <div className="att-cal-legend">
        <span className="att-legend-item"><span className="att-legend-dot att-dot-present" /> Present</span>
        <span className="att-legend-item"><span className="att-legend-dot att-dot-absent" /> Absent</span>
        <span className="att-legend-item"><span className="att-legend-dot att-dot-late" /> Late</span>
        <span className="att-legend-item"><span className="att-legend-dot att-dot-nodata" /> No Data</span>
      </div>

      {/* Day-of-week headers */}
      <div className="att-cal-grid att-cal-dayheaders">
        {DAY_HEADERS.map(d => (
          <div key={d} className="att-cal-dayheader">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="att-cal-body">
        {weeks.map((week, wi) => (
          <div key={wi} className="att-cal-grid att-cal-week">
            {week.map((cell, ci) => (
              <div
                key={ci}
                className={`att-cal-cell ${cell ? statusClass(cell) : 'cal-empty'} ${cell && cell.isToday ? 'cal-today' : ''}`}
                onClick={(e) => handleCellClick(cell, e)}
                onMouseEnter={(e) => handleCellHover(cell, e)}
                onMouseLeave={handleCellLeave}
              >
                {cell && (
                  <>
                    <span className="att-cal-day">{cell.day}</span>
                    {!cell.isFuture && cell.record && (
                      <span className={`att-cal-dot att-dot-${cell.record.status}`} />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Month stats summary */}
      <div className="att-cal-stats">
        <span className="att-cal-stat">
          <span className="att-dot-present att-legend-dot" />
          <strong>{monthStats.present}</strong> present
        </span>
        <span className="att-cal-stat">
          <span className="att-dot-absent att-legend-dot" />
          <strong>{monthStats.absent}</strong> absent
        </span>
        <span className="att-cal-stat">
          <span className="att-dot-late att-legend-dot" />
          <strong>{monthStats.late}</strong> late
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="att-cal-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span className="att-tip-date">{tooltip.dateStr}</span>
          {tooltip.isFuture ? (
            <span className="att-tip-status">Future date</span>
          ) : tooltip.record ? (
            <>
              <span className={`att-tip-badge badge badge-${tooltip.record.status}`}>
                {tooltip.record.status.charAt(0).toUpperCase() + tooltip.record.status.slice(1)}
              </span>
              {tooltip.record.timeIn && tooltip.record.timeIn !== '-' && (
                <span className="att-tip-time">Time in: {tooltip.record.timeIn}</span>
              )}
            </>
          ) : (
            <span className="att-tip-status">No data</span>
          )}
        </div>
      )}
    </div>
  );
}
