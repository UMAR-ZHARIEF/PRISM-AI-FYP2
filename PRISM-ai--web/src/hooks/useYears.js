import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useYears() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function fetchYears() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('years')
      .select('*')
      .order('year_num')
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('useYears: failed to load years', queryError);
          setError(queryError);
          setYears([]);
        } else {
          setYears(data || []);
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, []);

  return { years, loading, error };
}

export default useYears;
