import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useAuditLogs({ limit = 100, actorId } = {}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function fetchAuditLogs() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('audit_logs')
      .select('*, actor:profiles(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actorId != null) query = query.eq('actor_id', actorId);

    query.then(function handleResult({ data, error: queryError }) {
      if (cancelled) return;
      if (queryError) {
        console.error('useAuditLogs: failed to load audit logs', queryError);
        setError(queryError);
        setLogs([]);
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [limit, actorId]);

  return { logs, loading, error };
}

export default useAuditLogs;
