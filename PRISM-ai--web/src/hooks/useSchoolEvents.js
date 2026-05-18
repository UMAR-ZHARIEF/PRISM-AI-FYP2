import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useSchoolEvents({ fromDate, toDate } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function fetchSchoolEvents() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('school_events')
      .select('*')
      .order('event_date');

    if (fromDate != null) query = query.gte('event_date', fromDate);
    if (toDate != null) query = query.lte('event_date', toDate);

    query.then(function handleResult({ data, error: queryError }) {
      if (cancelled) return;
      if (queryError) {
        console.error('useSchoolEvents: failed to load events', queryError);
        setError(queryError);
        setEvents([]);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [fromDate, toDate]);

  return { events, loading, error };
}

export default useSchoolEvents;
