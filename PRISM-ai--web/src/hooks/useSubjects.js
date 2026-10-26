import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // loading starts true and this effect runs once ([] deps), so the old
  // synchronous setLoading(true)/setError(null) reset was a no-op and is
  // omitted to satisfy react-hooks/set-state-in-effect.
  useEffect(function fetchSubjects() {
    let cancelled = false;

    supabase
      .from('subjects')
      .select('*')
      .order('name')
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('useSubjects: failed to load subjects', queryError);
          setError(queryError);
          setSubjects([]);
        } else {
          setSubjects(data || []);
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, []);

  return { subjects, loading, error };
}

export default useSubjects;
