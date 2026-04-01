import './Skeleton.css';

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-circle" />
      <div className="skeleton-lines">
        <div className="skeleton-line w-40" />
        <div className="skeleton-line w-60" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="card">
      <div className="skeleton-header">
        <div className="skeleton-line w-30" />
        <div className="skeleton-line w-20" />
      </div>
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="skeleton-line w-60" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci}><div className="skeleton-line" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card">
      <div className="skeleton-header">
        <div className="skeleton-line w-30" />
      </div>
      <div className="skeleton-chart" />
    </div>
  );
}
