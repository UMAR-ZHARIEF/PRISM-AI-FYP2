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

  // Re-enter the loading state synchronously whenever the query inputs
  // change, during render instead of inside the effect (per
  // react-hooks/set-state-in-effect), so the spinner-while-refetching
  // behaviour stays identical to the old effect-body reset.
  const [fetchKey, setFetchKey] = useState({ year, classSectionId, refreshTick });
  if (
    fetchKey.year !== year ||
    fetchKey.classSectionId !== classSectionId ||
    fetchKey.refreshTick !== refreshTick
  ) {
    setFetchKey({ year, classSectionId, refreshTick });
    setLoading(true);
    setError(null);
  }

  useEffect(function fetchStudents() {
    let cancelled = false;

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
