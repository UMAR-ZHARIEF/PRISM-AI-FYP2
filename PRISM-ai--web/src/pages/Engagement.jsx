import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Activity } from 'lucide-react';
import useEngagement, { computeEngagementStats } from '../hooks/useEngagement';
import useEngagementRisk from '../hooks/useEngagementRisk';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import './Engagement.css';

// ISO date (YYYY-MM-DD) in local time — same helper as Dashboard.
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Tone thresholds shared with the Dashboard overview card: green when the
// class is mostly attentive, yellow in the middle band, red when low.
function toneForPct(pct) {
  if (pct == null) return '';
  if (pct > 70) return 'g';
  if (pct >= 40) return 'y';
  return 'r';
}

// Coarse colour for the dominant-emotion chip.
const EMOTION_TONES = {
  focused: 'g', attentive: 'g', calm: 'g', engaged: 'g', happy: 'g', joy: 'g',
  neutral: 'y', tired: 'y',
  sad: 'r', angry: 'r', disgust: 'r', fear: 'r', distracted: 'r', drowsy: 'r',
  anxious: 'r', confused: 'r',
};

const AVA_COLORS = ['r', 'y', 'g', 'o', 'k'];

// First two initials of a name, for avatar circles. Shared by the table and
// the risk heatmap so both spell the concept one way.
function initialsFor(name) {
  return String(name).split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// One heatmap group per class label, tiles inside sorted by risk score
// descending (students without a score sink to the end of their class).
function groupRiskByClass(rows) {
  const groups = new Map();
  rows.forEach(function place(r) {
    const label = r.className || 'No class';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(r);
  });
  return Array.from(groups.entries())
    .map(function toGroup(entry) {
      return {
        className: entry[0],
        students: [...entry[1]].sort(function byScoreDesc(a, b) {
          const sa = typeof a.score === 'number' ? a.score : -1;
          const sb = typeof b.score === 'number' ? b.score : -1;
          return sb - sa;
        }),
      };
    })
    .sort(function byClassLabel(a, b) {
      return a.className.localeCompare(b.className, undefined, { sensitivity: 'base' });
    });
}

export default function Engagement() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const today = useMemo(() => isoDate(new Date()), []);
  const { summaries, loading, error, refresh } = useEngagement(date);
  const { risks, loading: riskLoading, error: riskError, refresh: refreshRisk } = useEngagementRisk(date);

  const stats = computeEngagementStats(summaries);
  const tone = toneForPct(stats.attentiveAvg);
  // Chip counts over students who actually carry a numeric risk score.
  // Rows without a score (not enough history yet) are counted separately so
  // they are never folded into Low — having no data is not reassurance.
  const riskChipStats = useMemo(function countRiskChips() {
    const scored = risks.filter(function hasScore(r) { return typeof r.score === 'number'; });
    return {
      low: scored.filter(function isLow(r) { return r.band === 'low'; }).length,
      watch: scored.filter(function isWatch(r) { return r.band === 'watch'; }).length,
      high: scored.filter(function isHigh(r) { return r.band === 'high'; }).length,
      noScore: risks.length - scored.length,
    };
  }, [risks]);

  const riskGroups = useMemo(function buildRiskGroups() {
    return groupRiskByClass(risks);
  }, [risks]);

  // One handler refreshes both fetches; the date picker drives both because
  // they share the same date state.
  function refreshAll() {
    refresh();
    refreshRisk();
  }

  const sorted = useMemo(function sortByName() {
    return [...summaries].sort(function byName(a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [summaries]);

  return (
    <div className="engagement-page">
      <div className="page-header engagement-header">
        <div>
          <h1>
            <span className="word k">Class</span>{' '}
            <span className="word g">Engagement</span>
            <span className="year-badge mono">{date}</span>
          </h1>
          <p className="engagement-subtitle">
            Attention and emotion summary from the AI engine — one row per student with data.
          </p>
        </div>
        <div className="page-header-actions">
          <label className="engagement-date-field">
            <span>Date</span>
            <input
              type="date"
              className="search-input engagement-date-input"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value || today)}
            />
          </label>
          <button type="button" className="btn btn-outline" onClick={refreshAll} disabled={loading || riskLoading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="card section-gap engagement-error">
          <span className="tape tl" />
          <div className="empty-state">
            Couldn&apos;t load engagement data — is the AI bridge running?
            <div>
              <button type="button" className="btn btn-primary engagement-retry" onClick={refresh}>
                <Activity size={16} /> Try again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* GAUGE + SUMMARY STAT CARDS */}
          <div className="engagement-top section-gap">
            <div className="card tilt-l engagement-gauge-card">
              <span className="tape tr" />
              <div className="card-header">
                <h2>% of Class Attentive</h2>
                <span className="tag-mono">{date}</span>
              </div>
              {loading ? (
                <SkeletonCard />
              ) : stats.attentiveAvg == null ? (
                <div className="empty-state">No engagement data recorded for this date.</div>
              ) : (
                <>
                  <div className="eng-gauge">
                    <span className={`eng-gauge-number mono tone-${tone}`}>{stats.attentiveAvg}%</span>
                    <span className="eng-gauge-caption">{stats.studentCount} student{stats.studentCount !== 1 ? 's' : ''} with data</span>
                  </div>
                  <div className="eng-bar">
                    <div className={`eng-bar-fill tone-${tone}`} style={{ width: `${stats.attentiveAvg}%` }} />
                  </div>
                  <div className="eng-bar-scale mono">
                    <span>0%</span><span>40%</span><span>70%</span><span>100%</span>
                  </div>
                </>
              )}
            </div>

            <div className="engagement-stats">
              <div className="stat-card tilt-r">
                <span className="tape tr" />
                <div className="stat-info">
                  <h3 className="mono">{loading ? '—' : stats.studentCount}</h3>
                  <p>Total Students with Data</p>
                </div>
              </div>
              <div className={`stat-card ${tone === 'g' ? 's-green' : tone === 'y' ? 's-yellow' : 's-red'}`}>
                <span className="tape tl" />
                <div className="stat-info">
                  <h3 className="mono">{loading ? '—' : stats.attentiveAvg == null ? '—' : `${stats.attentiveAvg}%`}</h3>
                  <p>Attentive Average</p>
                </div>
              </div>
              <div className={`stat-card ${stats.atRiskCount > 0 ? 's-red' : ''}`}>
                <span className="tape br" />
                <div className="stat-info">
                  <h3 className="mono">{loading ? '—' : stats.atRiskCount}</h3>
                  <p>At-Risk Count</p>
                </div>
              </div>
            </div>
          </div>

          {/* RISK OVERVIEW: BAND CHIPS + CLASS HEATMAP */}
          {!riskError && (
            <div className="card section-gap risk-overview-card">
              <span className="tape bl" />
              <div className="card-header">
                <h2>Risk Overview</h2>
                <span className="tag-mono">{date}</span>
              </div>
              {riskLoading ? (
                <SkeletonCard />
              ) : (
                <>
                  <div className="risk-chips">
                    <span className="risk-chip band-low">
                      <span className="risk-chip-label">Low</span>
                      <span className="risk-chip-count mono">{riskChipStats.low}</span>
                    </span>
                    <span className="risk-chip band-watch">
                      <span className="risk-chip-label">Watch</span>
                      <span className="risk-chip-count mono">{riskChipStats.watch}</span>
                    </span>
                    <span className="risk-chip band-high">
                      <span className="risk-chip-label">High</span>
                      <span className="risk-chip-count mono">{riskChipStats.high}</span>
                    </span>
                    {riskChipStats.noScore > 0 && (
                      <span className="risk-chip band-none">
                        <span className="risk-chip-label">No score yet</span>
                        <span className="risk-chip-count mono">{riskChipStats.noScore}</span>
                      </span>
                    )}
                  </div>
                  {risks.length === 0 ? (
                    <div className="empty-state">Not enough engagement history yet.</div>
                  ) : (
                    <div className="risk-board">
                      {riskGroups.map(group => (
                        <div className="risk-class-group" key={group.className}>
                          <span className="eyebrow risk-class-label">{group.className}</span>
                          <div className="risk-tiles">
                            {group.students.map((r, i) => (
                              <Link
                                key={r.id}
                                to={`/dashboard/students/${r.id}`}
                                className={`risk-tile band-${r.band}`}
                              >
                                <span className={`avatar ${AVA_COLORS[i % AVA_COLORS.length]} risk-tile-avatar`}>
                                  {initialsFor(r.name)}
                                </span>
                                <span className="risk-tile-name">{r.name}</span>
                                <span className="risk-tile-score mono">
                                  {typeof r.score === 'number' ? r.score : 'n/a'}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PER-STUDENT TABLE */}
          <div className="card section-gap engagement-table-card">
            <span className="tape bl" />
            <div className="card-header">
              <h2>Student Engagement</h2>
            </div>
            {loading ? (
              <SkeletonTable rows={6} cols={6} />
            ) : sorted.length === 0 ? (
              <div className="empty-state">No engagement data recorded for {date}.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Attentive</th>
                    <th>Disengaged</th>
                    <th>Dominant Emotion</th>
                    <th>At Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const avatarColor = AVA_COLORS[i % AVA_COLORS.length];
                    const emotionKey = (s.dominantEmotion || '').toLowerCase();
                    const emotionTone = EMOTION_TONES[emotionKey] || 'k';
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="eng-student-cell">
                            <div className={`avatar ${avatarColor}`}>{initialsFor(s.name)}</div>
                            <span className="eng-student-name">{s.name}</span>
                          </div>
                        </td>
                        <td>{s.className || '—'}</td>
                        <td className="tnum">
                          {typeof s.attentivePct === 'number'
                            ? <span className="badge badge-present mono">{s.attentivePct}%</span>
                            : <span className="mono">—</span>}
                        </td>
                        <td className="tnum">
                          {typeof s.disengagedPct === 'number'
                            ? <span className="badge badge-absent mono">{s.disengagedPct}%</span>
                            : <span className="mono">—</span>}
                        </td>
                        <td>
                          {s.dominantEmotion
                            ? <span className={`eng-emotion tone-${emotionTone}`}>{s.dominantEmotion}</span>
                            : <span className="mono">—</span>}
                        </td>
                        <td>
                          {s.atRisk
                            ? <span className="badge badge-absent">At Risk</span>
                            : <span className="badge badge-present">OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
