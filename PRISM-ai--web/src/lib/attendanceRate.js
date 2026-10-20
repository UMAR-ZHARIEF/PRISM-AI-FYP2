// Canonical attendance rate for a set of attendance_records rows.
// rate = (present + late) / total_records * 100, rounded to 1 decimal.
// rate is null when there are no records (total === 0).
export function attendanceRate(records) {
  const rows = Array.isArray(records) ? records : [];
  const total = rows.length;

  let present = 0;
  let absent = 0;
  let late = 0;
  for (const row of rows) {
    const status = String(row.status || '').toLowerCase();
    if (status === 'present') present += 1;
    else if (status === 'absent') absent += 1;
    else if (status === 'late') late += 1;
  }

  const rate = total === 0
    ? null
    : Math.round(((present + late) / total) * 1000) / 10;

  return { rate, present, absent, late, total };
}
