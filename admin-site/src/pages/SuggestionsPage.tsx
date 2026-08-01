import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSuggestionQueue, type SuggestionQueueItem } from '../lib/api';

export function SuggestionsPage() {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SuggestionQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listSuggestionQueue({ status: status || null, search })
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
  }, [status, search]);

  return (
    <div className="stack">
      <div className="card row">
        <label style={{ minWidth: 160 }}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
        </label>
        <label style={{ flex: 1, minWidth: 220 }}>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Creator, submitter, notes…"
          />
        </label>
      </div>

      <div className="card">
        {loading ? <p className="muted">Loading suggestions…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && !error ? (
          <table className="table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Submitter</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Coverage</th>
                <th>Links</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/suggestions/${row.id}`}>{row.name}</Link>
                  </td>
                  <td>{row.submitterEmail || '—'}</td>
                  <td>{new Date(row.submittedAt).toLocaleString()}</td>
                  <td>{row.status}</td>
                  <td>
                    {row.isNational ? 'National' : ''}
                    {row.teams?.length ? ` · ${row.teams.join(', ')}` : ''}
                    {row.conferences?.length ? ` · ${row.conferences.join(', ')}` : ''}
                  </td>
                  <td>{row.platformCount}</td>
                  <td>{row.notesPreview || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No suggestions match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
