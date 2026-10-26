import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useClassSections({ year } = {}) {
  const [classSections, setClassSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reset the fetch state during render whenever year changes, instead of
  // inside the effect (per react-hooks/set-state-in-effect). Mount is already
  // covered by the initial state (loading starts true, error starts null),
  // matching the old effect-start resets. classSections is deliberately left
  // stale until the new query resolves, exactly as before.
  const [fetchKey, setFetchKey] = useState({ year });
  if (fetchKey.year !== year) {
    setFetchKey({ year });
    setLoading(true);
    setError(null);
  }

  useEffect(function fetchClassSections() {
    let cancelled = false;

    let query = supabase
      .from('class_sections')
      .select('*, homeroom_teacher:profiles(*)')
      .order('year_num')
      .order('name');

    if (year != null) query = query.eq('year_num', year);

    query.then(function handleResult({ data, error: queryError }) {
      if (cancelled) return;
      if (queryError) {
        console.error('useClassSections: failed to load class sections', queryError);
        setError(queryError);
        setClassSections([]);
      } else {
        setClassSections(data || []);
      }
      setLoading(false);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [year]);

  return { classSections, loading, error };
}

export default useClassSections;
