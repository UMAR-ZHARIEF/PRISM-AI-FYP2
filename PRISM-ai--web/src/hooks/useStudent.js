import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useStudent(studentId) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchStudent() {
    if (!studentId) {
      setStudent(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('students')
      .select('*, class_section:class_sections(*)')
      .eq('id', studentId)
      .single()
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('useStudent: failed to load student', queryError);
          setError(queryError);
          setStudent(null);
        } else {
          setStudent(data || null);
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [studentId, refreshTick]);

  return { student, loading, error, refresh };
}

export default useStudent;
