import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function useAiModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function fetchAiModels() {
    let cancelled = false;
    setLoading(true);
    setError(null);

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
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, []);

  return { models, loading, error };
}

export default useAiModels;
