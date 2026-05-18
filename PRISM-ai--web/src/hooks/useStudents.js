import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useStudents({ year, classSectionId } = {}) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchStudents() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('students')
      .select('*, class_section:class_sections(*)')
      .order('full_name', { ascending: true });

    if (year != null) query = query.eq('year_num', year);
    if (classSectionId != null) query = query.eq('class_section_id', classSectionId);

    query.then(function handleResult({ data, error: queryError }) {
      if (cancelled) return;
      if (queryError) {
        console.error('useStudents: failed to load students', queryError);
        setError(queryError);
        setStudents([]);
      } else {
        setStudents(data || []);
      }
      setLoading(false);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [year, classSectionId, refreshTick]);

  return { students, loading, error, refresh };
}

export default useStudents;
