import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useProfiles({ role } = {}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchProfiles() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (role != null) query = query.eq('role', role);

    query.then(function handleResult({ data, error: queryError }) {
      if (cancelled) return;
      if (queryError) {
        console.error('useProfiles: failed to load profiles', queryError);
        setError(queryError);
        setProfiles([]);
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [role, refreshTick]);

  return { profiles, loading, error, refresh };
}

export default useProfiles;
