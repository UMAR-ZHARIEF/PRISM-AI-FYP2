import { useCallback, useEffect, useRef, useState } from 'react';

// Real face-enrollment status from the Express bridge:
// GET /api/ai/enrolled → { enrolled: [{ name, class, enrolled_at }] }.
// Names are lowercased + trimmed into a Set for O(1) lookups against
// students.full_name. Polls every 30s so freshly enrolled students appear
// without a manual reload; call refresh() to refetch immediately (e.g. right
// after a successful enrollment).
function useEnrolledFaces() {
  const [enrolledNames, setEnrolledNames] = useState(() => new Set());
  const [enrolled, setEnrolled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Warn once per outage instead of on every 30s poll while the server is down.
  const warnedRef = useRef(false);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchEnrolledFaces() {
    let cancelled = false;

    function load() {
      fetch('/api/ai/enrolled')
        .then(function parseResponse(res) {
          if (!res.ok) throw new Error(`GET /api/ai/enrolled responded ${res.status}`);
          return res.json();
        })
        .then(function handleBody(body) {
          if (cancelled) return;
          const list = (body && body.enrolled) || [];
          const names = list
            .map(function toKey(e) { return ((e && e.name) || '').toLowerCase().trim(); })
            .filter(Boolean);
          setEnrolled(list);
          setEnrolledNames(new Set(names));
          setError(null);
          setLoading(false);
          warnedRef.current = false;
        })
        .catch(function handleError(err) {
          if (cancelled) return;
          // Server may be down — keep the previous snapshot in place.
          if (!warnedRef.current) {
            console.warn('useEnrolledFaces: /api/ai/enrolled fetch failed', err);
            warnedRef.current = true;
          }
          setError(err);
          setLoading(false);
        });
    }

    load();
    const id = setInterval(load, 30000);

    return function cleanup() {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshTick]);

  return { enrolledNames, enrolled, loading, error, refresh };
}

export default useEnrolledFaces;
