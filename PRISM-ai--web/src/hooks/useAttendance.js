import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useAttendance({ studentId, date, fromDate, toDate, classSectionId } = {}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchAttendance() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function run() {
      try {
        // If filtering by class section, first resolve the student IDs in that section.
        let sectionStudentIds = null;
        if (classSectionId != null) {
          const { data: sectionStudents, error: sectionError } = await supabase
            .from('students')
            .select('id')
            .eq('class_section_id', classSectionId);

          if (sectionError) throw sectionError;
          if (cancelled) return;
          sectionStudentIds = (sectionStudents || []).map(function pickId(s) { return s.id; });

          // No students in that section -> nothing to fetch.
          if (sectionStudentIds.length === 0) {
            setRecords([]);
            setLoading(false);
            return;
          }
        }

        let query = supabase
          .from('attendance_records')
          .select('*, student:students(*)')
          .order('date', { ascending: false });

        if (studentId != null) query = query.eq('student_id', studentId);
        if (date != null) query = query.eq('date', date);
        if (fromDate != null) query = query.gte('date', fromDate);
        if (toDate != null) query = query.lte('date', toDate);
        if (sectionStudentIds != null) query = query.in('student_id', sectionStudentIds);

        const { data, error: queryError } = await query;
        if (cancelled) return;
        if (queryError) throw queryError;

        setRecords(data || []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('useAttendance: failed to load attendance', err);
        setError(err);
        setRecords([]);
        setLoading(false);
      }
    }

    run();

    return function cleanup() {
      cancelled = true;
    };
  }, [studentId, date, fromDate, toDate, classSectionId, refreshTick]);

  return { records, loading, error, refresh };
}

export default useAttendance;
