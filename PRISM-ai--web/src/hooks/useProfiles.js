import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext.jsx';

function useProfiles({ role } = {}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Admins get the joined list (profiles + auth.users.email) from the API;
  // everyone else falls back to a direct Supabase query (which RLS will
  // constrain), but those rows won't carry an email column.
  const { session, profile: meProfile } = useAuth();
  const adminToken = meProfile?.role === 'admin' ? session?.access_token : null;

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchProfiles() {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fallbackToDirectQuery() {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (role != null) query = query.eq('role', role);

      const { data, error: queryError } = await query;
      if (cancelled) return;
      if (queryError) {
        console.error('useProfiles: failed to load profiles', queryError);
        setError(queryError);
        setProfiles([]);
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    }

    async function run() {
      if (adminToken) {
        try {
          const res = await fetch('/api/admin/users/list', {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (!res.ok) {
            console.warn('useProfiles: /api/admin/users/list returned', res.status, '— falling back to direct query');
            await fallbackToDirectQuery();
            return;
          }
          const data = await res.json();
          if (cancelled) return;
          // Filter client-side by role + sort by full_name so the API stays
          // generic and the hook behaves like the old direct-query version.
          const filtered = role != null
            ? (data || []).filter(p => p.role === role)
            : (data || []);
          filtered.sort((a, b) => {
            const an = (a.full_name || '').toLowerCase();
            const bn = (b.full_name || '').toLowerCase();
            if (an < bn) return -1;
            if (an > bn) return 1;
            return 0;
          });
          setProfiles(filtered);
          setLoading(false);
        } catch (err) {
          console.warn('useProfiles: /api/admin/users/list failed, falling back', err);
          await fallbackToDirectQuery();
        }
      } else {
        await fallbackToDirectQuery();
      }
    }

    run();

    return function cleanup() {
      cancelled = true;
    };
  }, [role, refreshTick, adminToken]);

  return { profiles, loading, error, refresh };
}

export default useProfiles;
