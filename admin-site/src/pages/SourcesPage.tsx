import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSources, type SourceDetail } from '../lib/api';
import { CONFERENCE_OPTIONS } from '../lib/catalog';

export function SourcesPage() {
  const [search, setSearch] = useState('');
  const [national, setNational] = useState<'any' | 'yes' | 'no'>('any');
  const [active, setActive] = useState<'any' | 'yes' | 'no'>('any');
  const [conferenceId, setConferenceId] = useState('');
  const [rows, setRows] = useState<SourceDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listSources({
      search,
      national: national === 'any' ? null : national === 'yes',
      teamId: null,
      conferenceId: conferenceId || null,
      active: active === 'any' ? null : active === 'yes',
    })
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
  }, [search, national, active, conferenceId]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Directory</h1>
        <Link className="button btn-primary" to="/sources/new">
          Add New Creator
        </Link>
      </div>

      <div className="card row">
        <label style={{ flex: 1, minWidth: 200 }}>
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          National
          <select value={national} onChange={(e) => setNational(e.target.value as typeof national)}>
            <option value="any">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label>
          Active
          <select value={active} onChange={(e) => setActive(e.target.value as typeof active)}>
            <option value="any">Any</option>
            <option value="yes">Active</option>
            <option value="no">Hidden</option>
          </select>
        </label>
        <label>
          Conference
          <select value={conferenceId} onChange={(e) => setConferenceId(e.target.value)}>
            <option value="">Any</option>
            {CONFERENCE_OPTIONS.map((conference) => (
              <option key={conference.id} value={conference.id}>
                {conference.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        {loading ? <p className="muted">Loading creators…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && !error ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>National</th>
                <th>Active</th>
                <th>Teams</th>
                <th>Conferences</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/sources/${row.id}`}>{row.name}</Link>
                  </td>
                  <td>{row.isNational ? 'Yes' : 'No'}</td>
                  <td>{row.isActive ? 'Active' : 'Hidden'}</td>
                  <td>{(row.teamIds || []).join(', ') || '—'}</td>
                  <td>{(row.conferenceIds || []).join(', ') || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No creators match these filters.
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
