import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useClassSections({ year } = {}) {
  const [classSections, setClassSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function fetchClassSections() {
    let cancelled = false;
    setLoading(true);
    setError(null);

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
