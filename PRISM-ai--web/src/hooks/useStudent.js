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

  // Reset the fetch state synchronously whenever studentId or refreshTick
  // changes, during render instead of inside the effect (per
  // react-hooks/set-state-in-effect). The no-student branch reproduces the
  // old early-return resets; mount without a student is already covered by
  // the initial state (loading starts Boolean(studentId), student starts null).
  const [fetchKey, setFetchKey] = useState({ studentId, refreshTick });
  if (fetchKey.studentId !== studentId || fetchKey.refreshTick !== refreshTick) {
    setFetchKey({ studentId, refreshTick });
    if (!studentId) {
      setStudent(null);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
  }

  useEffect(function fetchStudent() {
    if (!studentId) return undefined;

    let cancelled = false;

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
