import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function useAiModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  // ai_models is admin-only per RLS: a non-admin's plain select resolves to
  // [] with no error. Track the caller's role so that case can be surfaced
  // as `denied` instead of "no models exist".
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Reset the fetch state during render whenever isAdmin changes, instead of
  // inside the effect (per react-hooks/set-state-in-effect). Mount is already
  // covered by the initial state (loading starts true, error/denied start
  // falsy), matching the old effect-start resets.
  const [fetchKey, setFetchKey] = useState({ isAdmin });
  if (fetchKey.isAdmin !== isAdmin) {
    setFetchKey({ isAdmin });
    setLoading(true);
    setError(null);
    setDenied(false);
  }

  useEffect(function fetchAiModels() {
    let cancelled = false;

    supabase
      .from('ai_models')
      .select('*')
      .order('deployed_at', { ascending: false })
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('useAiModels: failed to load AI models', queryError);
          setError(queryError);
          setModels([]);
        } else {
          setModels(data || []);
          // Not admin + empty result + no error => the rows were filtered out
          // by RLS, not "there are no models".
          setDenied(!isAdmin && (data || []).length === 0);
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [isAdmin]);

  return { models, loading, error, denied };
}

export default useAiModels;
