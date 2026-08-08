import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCorrections, type CorrectionListItem } from '../lib/api';

export function ReportsPage() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<CorrectionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listCorrections(status || 'pending')
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0 }}>Reports</h1>
            <p className="muted" style={{ marginBottom: 0 }}>
              Community corrections for directory creators (wrong tag, broken link, artwork, and
              more).
            </p>
          </div>
          <label style={{ minWidth: 160 }}>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="applied">Applied</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">No reports for this status.</p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Issue type</th>
                <th>Submitter</th>
                <th>Date</th>
                <th>Status</th>
                <th>Proposed summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/reports/${row.id}`}>{row.creatorName || 'Unknown creator'}</Link>
                  </td>
                  <td>
                    {row.correctionType === 'creator_update'
                      ? 'Creator update'
                      : row.correctionType}
                  </td>
                  <td>{row.submitterEmail || '—'}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                  <td>{row.status}</td>
                  <td>{row.proposedSummary || row.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
