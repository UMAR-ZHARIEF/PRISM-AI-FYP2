import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useSchoolEvents({ fromDate, toDate } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Re-enter the loading state synchronously whenever the date range
  // changes, during render instead of inside the effect (per
  // react-hooks/set-state-in-effect), so the spinner-while-refetching
  // behaviour stays identical to the old effect-body reset.
  const [fetchKey, setFetchKey] = useState({ fromDate, toDate });
  if (fetchKey.fromDate !== fromDate || fetchKey.toDate !== toDate) {
    setFetchKey({ fromDate, toDate });
    setLoading(true);
    setError(null);
  }

  useEffect(function fetchSchoolEvents() {
    let cancelled = false;

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
