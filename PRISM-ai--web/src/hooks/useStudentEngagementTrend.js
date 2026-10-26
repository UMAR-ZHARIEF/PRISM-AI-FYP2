import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// 30-day engagement trend for ONE student, from the Express bridge:
// GET /api/engagement/trends?student_id=<uuid>&days=30 (staff-only endpoint).
// Every request carries the signed-in user's JWT, same convention as
// useEngagement.js. The bridge is being built in parallel, so the response is
// unwrapped tolerantly (snake/camel aliases) instead of trusted blindly.

// First numeric-ish value among the alias keys. Tolerates strings like "78%".
function pickNum(row, keys) {
  for (const key of keys) {
    const raw = row ? row[key] : undefined;
    if (raw == null) continue;
    const n = Number(String(raw).replace('%', '').trim());
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

// First non-empty string among the alias keys.
function pickStr(row, keys) {
  for (const key of keys) {
    const raw = row ? row[key] : undefined;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

// One API day row -> { date, pct, atRisk }. pct is the disengaged share
// (0-100); null when the bridge sent no usable number for that day.
function normalizeTrendDay(row, index) {
  const date = String((row && (row.date ?? row.summary_date ?? row.day)) || '').slice(0, 10);
  return {
    date: date || `day-${index}`,
    pct: pickNum(row, ['disengaged_pct', 'disengagedPercent', 'percent_disengaged', 'disengaged']),
    atRisk: Boolean(row && (row.at_risk ?? row.atRisk ?? row.is_at_risk)),
  };
}

// The latest snapshot -> { score, band, reason } or null when absent.
function normalizeLatest(row) {
  if (!row || typeof row !== 'object') return null;
  const band = pickStr(row, ['risk_band', 'riskBand', 'band']);
  return {
    score: pickNum(row, ['risk_score', 'riskScore', 'score']),
    band: band ? band.toLowerCase() : null,
    reason: pickStr(row, ['trigger_reason', 'triggerReason', 'reason']),
  };
}

// useStudentEngagementTrend(studentId, days = 30): per-day engagement trend
// for one student. Returns { days, latest, loading, error, refresh } where
// days is normalized [{ date, pct, atRisk }] ascending by date and latest is
// { score, band, reason } (or null). `error` is set only when the request
// itself failed; callers are expected to degrade quietly (no chip, no chart).
function useStudentEngagementTrend(studentId, days = 30) {
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;
  const [trendDays, setTrendDays] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchTrend() {
    // The endpoint is staff-only (requireStaff). The auth session is restored
    // asynchronously on mount: fetching before it lands sends an auth-less
    // request, gets 401, and the page shows a false failure. Hold loading
    // until the session is known (same rule as useEngagement).
    if (authLoading) return undefined;

    if (!studentId) {
      setTrendDays([]);
      setLatest(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          student_id: String(studentId),
          days: String(days),
        });
        const res = await fetch(`/api/engagement/trends?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`GET /api/engagement/trends responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        const list = Array.isArray(body)
          ? body
          : ((body && (body.days || body.data || body.rows)) || []);
        const latestRow = body && !Array.isArray(body)
          ? (body.latest ?? body.current ?? body.risk)
          : null;
        // Ascending by date no matter what order the bridge sent.
        const sorted = list
          .map(normalizeTrendDay)
          .sort(function byDate(a, b) { return a.date.localeCompare(b.date); });
        setTrendDays(sorted);
        setLatest(normalizeLatest(latestRow));
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('useStudentEngagementTrend: /api/engagement/trends fetch failed', err);
        setError(err);
        setTrendDays([]);
        setLatest(null);
        setLoading(false);
      }
    }

    load();

    return function cleanup() {
      cancelled = true;
    };
  }, [authLoading, studentId, days, token, refreshTick]);

  return { days: trendDays, latest, loading, error, refresh };
}

export default useStudentEngagementTrend;
