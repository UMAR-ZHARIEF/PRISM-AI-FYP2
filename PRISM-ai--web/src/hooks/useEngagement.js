import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Engagement summaries come from the Express bridge (backed by the
// engagement_summaries table the edge AI writes). GET /api/engagement/summary
// is staff-only, so every request carries the signed-in user's JWT.

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

// Normalize one API row into the single shape the UI renders. The bridge is
// being built in parallel, so keys are read permissively (snake/camel).
function normalizeSummary(row, index) {
  return {
    id: (row && (row.student_id ?? row.studentId ?? row.id)) ?? index,
    name: pickStr(row, ['full_name', 'name', 'student_name', 'studentName']) || 'Unknown student',
    className: pickStr(row, ['class', 'class_name', 'className', 'class_section']),
    attentivePct: pickNum(row, ['attentive_pct', 'attentivePercent', 'attentive_percent', 'percent_attentive']),
    disengagedPct: pickNum(row, ['disengaged_pct', 'disengagedPercent', 'disengaged_percent', 'percent_disengaged']),
    dominantEmotion: pickStr(row, ['dominant_emotion', 'dominantEmotion', 'emotion']),
    atRisk: Boolean(row && (row.at_risk ?? row.atRisk ?? row.is_at_risk)),
  };
}

// Aggregate over normalized rows: how many students reported, the class-wide
// attentive average (null when nothing reported) and the at-risk headcount.
function computeEngagementStats(summaries) {
  const rows = Array.isArray(summaries) ? summaries : [];
  const withData = rows.filter(function hasAttentive(s) { return typeof s.attentivePct === 'number'; });
  const attentiveAvg = withData.length
    ? Math.round(withData.reduce(function sum(acc, s) { return acc + s.attentivePct; }, 0) / withData.length)
    : null;
  return {
    studentCount: rows.length,
    attentiveAvg,
    atRiskCount: rows.filter(function isRisk(s) { return s.atRisk; }).length,
  };
}

// useEngagement(date) — per-student engagement summary for one date
// (YYYY-MM-DD). Returns { summaries, loading, error, refresh }; rows arrive
// pre-normalized (see normalizeSummary) so pages can render directly.
function useEngagement(date) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchEngagement() {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const queryDate = date ? String(date) : '';
        const res = await fetch(`/api/engagement/summary?date=${encodeURIComponent(queryDate)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`GET /api/engagement/summary responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        const list = Array.isArray(body)
          ? body
          : ((body && (body.summaries || body.data || body.rows)) || []);
        setSummaries(list.map(normalizeSummary));
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('useEngagement: /api/engagement/summary fetch failed', err);
        setError(err);
        setSummaries([]);
        setLoading(false);
      }
    }

    load();

    return function cleanup() {
      cancelled = true;
    };
  }, [date, token, refreshTick]);

  return { summaries, loading, error, refresh };
}

export { computeEngagementStats };
export default useEngagement;
