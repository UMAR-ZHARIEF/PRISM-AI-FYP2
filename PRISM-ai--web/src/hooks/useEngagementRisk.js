import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Disengagement risk rows come from the Express bridge (same backend as the
// engagement summaries; see useEngagement.js). GET /api/engagement/risk is
// staff-only, so every request carries the signed-in user's JWT.

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

// The three bands the bridge reports. Anything else (missing or unknown
// string) falls back to 'low' so every student still lands in exactly one
// band chip on the page.
const RISK_BANDS = ['low', 'watch', 'high'];

// Normalize one API row into the single shape the UI renders. The bridge is
// being built in parallel, so keys are read permissively (snake/camel).
function normalizeRisk(row, index) {
  const days = pickNum(row, ['days_of_data', 'daysOfData']);
  const rawBand = pickStr(row, ['risk_band', 'riskBand', 'band']);
  return {
    id: (row && (row.student_id ?? row.studentId ?? row.id)) ?? index,
    name: pickStr(row, ['student_name', 'studentName', 'full_name', 'name']) || 'Unknown student',
    className: pickStr(row, ['class_name', 'className', 'class', 'class_section']),
    score: pickNum(row, ['risk_score', 'riskScore', 'score']),
    band: RISK_BANDS.indexOf(rawBand) === -1 ? 'low' : rawBand,
    rollingPct: pickNum(row, ['rolling_disengaged', 'rollingDisengaged']),
    recentPct: pickNum(row, ['recent_disengaged', 'recentDisengaged']),
    slopePct: pickNum(row, ['trend_slope', 'trendSlope', 'slope']),
    daysOfData: days == null ? null : Math.round(days),
  };
}

// Aggregate over normalized rows: one headcount per band chip, plus how many
// students actually carry a numeric risk score.
function computeRiskStats(rows) {
  const safe = Array.isArray(rows) ? rows : [];
  return {
    lowCount: safe.filter(function isLow(r) { return r.band === 'low'; }).length,
    watchCount: safe.filter(function isWatch(r) { return r.band === 'watch'; }).length,
    highCount: safe.filter(function isHigh(r) { return r.band === 'high'; }).length,
    scored: safe.filter(function hasScore(r) { return typeof r.score === 'number'; }).length,
  };
}

// useEngagementRisk(date): per-student disengagement risk for one date
// (YYYY-MM-DD). Returns { risks, loading, error, empty, refresh }; rows
// arrive pre-normalized (see normalizeRisk) so pages can render directly.
// `empty` is true only when the API answered OK with no rows for the date,
// a graceful "not enough history" state that stays distinct from `error`
// (request failed).
function useEngagementRisk(date) {
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchRisk() {
    // The endpoint is staff-only (requireStaff). The auth session is restored
    // asynchronously on mount: fetching before it lands sends an auth-less
    // request, gets 401, and the page would show a false "couldn't load".
    // Hold the loading state until the session is known.
    if (authLoading) return undefined;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const queryDate = date ? String(date) : '';
        const res = await fetch(`/api/engagement/risk?date=${encodeURIComponent(queryDate)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`GET /api/engagement/risk responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        const list = Array.isArray(body)
          ? body
          : ((body && (body.summaries || body.data || body.rows)) || []);
        setRisks(list.map(normalizeRisk));
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('useEngagementRisk: /api/engagement/risk fetch failed', err);
        setError(err);
        setRisks([]);
        setLoading(false);
      }
    }

    load();

    return function cleanup() {
      cancelled = true;
    };
  }, [authLoading, date, token, refreshTick]);

  const empty = !loading && !error && risks.length === 0;

  return { risks, loading, error, empty, refresh };
}

export { computeRiskStats };
export default useEngagementRisk;
