import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoverageFields } from '../components/CoverageFields';
import { LinkRowsEditor } from '../components/LinkRowsEditor';
import {
  applyCorrection,
  buildCorrectionReplyMailto,
  getCorrectionDetail,
  rejectCorrection,
  type CorrectionDetail,
} from '../lib/api';
import {
  CONFERENCE_OPTIONS,
  TEAM_OPTIONS,
  compactLinkRows,
  emptyLinkRow,
  parseLinkRows,
  type LinkRow,
} from '../lib/catalog';

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function formatLabel(id: string, kind: 'team' | 'conference'): string {
  if (kind === 'team') {
    return TEAM_OPTIONS.find((item) => item.id === id)?.label || id;
  }
  return CONFERENCE_OPTIONS.find((item) => item.id === id)?.label || id;
}

export function ReportDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<CorrectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [links, setLinks] = useState<LinkRow[]>([emptyLinkRow(0)]);
  const [isNational, setIsNational] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [conferenceIds, setConferenceIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [teamSearch, setTeamSearch] = useState('');

  const proposed = detail?.proposedChanges ?? {};
  const proposedLinks = useMemo(
    () =>
      parseLinkRows(
        proposed.links,
        proposed.platformLinks as Record<string, string> | undefined,
      ),
    [detail?.proposedChanges],
  );
  const proposedTeamIds = asStringArray(proposed.teamIds);
  const proposedConferenceIds = asStringArray(proposed.conferenceIds);
  const sourceLinks = useMemo(
    () =>
      detail?.source
        ? parseLinkRows(detail.source.links, detail.source.platformLinks)
        : [],
    [detail?.source],
  );

  useEffect(() => {
    void getCorrectionDetail(id)
      .then((data) => {
        setDetail(data);
        setAdminNotes(data.adminNotes || '');
        const source = data.source;
        const changes = data.proposedChanges ?? {};
        setName(
          (typeof changes.name === 'string' ? changes.name : source?.name) || '',
        );
        setDescription(
          (typeof changes.description === 'string'
            ? changes.description
            : source?.description) || '',
        );
        setLogoUrl(
          (typeof changes.logoUrl === 'string' ? changes.logoUrl : source?.logoUrl) ||
            '',
        );
        const fromProposed = parseLinkRows(
          changes.links,
          changes.platformLinks as Record<string, string> | undefined,
        );
        const fromSource = source
          ? parseLinkRows(source.links, source.platformLinks)
          : [];
        const nextLinks = fromProposed.length > 0 ? fromProposed : fromSource;
        setLinks(nextLinks.length > 0 ? nextLinks : [emptyLinkRow(0)]);
        setIsNational(
          typeof changes.isNational === 'boolean'
            ? changes.isNational
            : Boolean(source?.isNational),
        );
        const nextTeams = asStringArray(changes.teamIds);
        const nextConferences = asStringArray(changes.conferenceIds);
        setTeamIds(nextTeams.length > 0 ? nextTeams : source?.teamIds || []);
        setConferenceIds(
          nextConferences.length > 0 ? nextConferences : source?.conferenceIds || [],
        );
        setIsActive(
          typeof changes.isActive === 'boolean'
            ? changes.isActive
            : source?.isActive !== false,
        );
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  async function onApply(useEdits: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await applyCorrection(
        useEdits
          ? {
              id,
              links: compactLinkRows(links),
              isNational,
              teamIds,
              conferenceIds,
              name: name || null,
              description: description || null,
              logoUrl: logoUrl || null,
              isActive,
              adminNotes: adminNotes || null,
            }
          : {
              id,
              adminNotes: adminNotes || null,
            },
      );
      setMessage(`Correction applied (${result.linkCount} links).`);
      setDetail(await getCorrectionDetail(id));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await rejectCorrection(id, adminNotes || null);
      setMessage('Correction rejected.');
      setDetail(await getCorrectionDetail(id));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) {
    return <div className="card">Loading report…</div>;
  }

  const source = detail?.source;
  const creatorName = source?.name || String(proposed.name ?? 'this creator');
  const pending = detail?.status === 'pending';

  return (
    <div className="stack">
      <Link to="/reports">← Back to reports</Link>

      <div className="card stack">
        <h1 style={{ margin: 0 }}>Correction report</h1>
        <div className="muted">
          Status: {detail?.status} · {detail?.correctionType} · Submitted{' '}
          {detail?.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}
        </div>
        {error ? <div className="error">{error}</div> : null}
        {message ? <div style={{ color: 'var(--ok)' }}>{message}</div> : null}

        <section className="stack">
          <h2 style={{ margin: 0, fontSize: 18 }}>Current creator</h2>
          {source ? (
            <>
              <div>
                <Link to={`/sources/${source.id}`}>{source.name}</Link>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {source.description || 'No description'}
              </p>
              <div className="muted">
                Coverage:{' '}
                {source.isNational
                  ? 'National'
                  : [
                      ...source.teamIds.map((teamId) => formatLabel(teamId, 'team')),
                      ...source.conferenceIds.map((conferenceId) =>
                        formatLabel(conferenceId, 'conference'),
                      ),
                    ].join(', ') || 'None'}
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>
                  Links
                </div>
                {sourceLinks.length === 0 ? (
                  <p className="muted">No links on file.</p>
                ) : (
                  <ul className="link-list">
                    {sourceLinks.map((row) => (
                      <li key={`${row.platform}-${row.url}`}>
                        <strong>{row.platform}</strong>
                        {row.label ? ` · ${row.label}` : ''}:{' '}
                        <a href={row.url} target="_blank" rel="noreferrer">
                          {row.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="muted">No linked creator on this report.</p>
          )}
        </section>

        <section className="stack">
          <h2 style={{ margin: 0, fontSize: 18 }}>Proposed changes</h2>
          {detail?.details ? (
            <p style={{ margin: 0 }}>
              <strong>Notes:</strong> {detail.details}
            </p>
          ) : null}
          {typeof proposed.name === 'string' && proposed.name ? (
            <div>
              <strong>Name:</strong> {proposed.name}
            </div>
          ) : null}
          {typeof proposed.description === 'string' ? (
            <div>
              <strong>Description:</strong> {proposed.description || '(clear)'}
            </div>
          ) : null}
          {typeof proposed.logoUrl === 'string' ? (
            <div>
              <strong>Artwork:</strong> {proposed.logoUrl || '(clear)'}
            </div>
          ) : null}
          {typeof proposed.isActive === 'boolean' ? (
            <div>
              <strong>Active:</strong> {proposed.isActive ? 'Yes' : 'No'}
            </div>
          ) : null}
          {typeof proposed.isNational === 'boolean' ||
          proposedTeamIds.length > 0 ||
          proposedConferenceIds.length > 0 ? (
            <div>
              <strong>Coverage:</strong>{' '}
              {typeof proposed.isNational === 'boolean' && proposed.isNational
                ? 'National'
                : [
                    ...proposedTeamIds.map((teamId) => formatLabel(teamId, 'team')),
                    ...proposedConferenceIds.map((conferenceId) =>
                      formatLabel(conferenceId, 'conference'),
                    ),
                  ].join(', ') || 'Unchanged'}
            </div>
          ) : null}
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Suggested links
            </div>
            {proposedLinks.length === 0 ? (
              <p className="muted">No link changes proposed (apply keeps current links).</p>
            ) : (
              <ul className="link-list">
                {proposedLinks.map((row) => (
                  <li key={`${row.platform}-${row.url}`}>
                    <strong>{row.platform}</strong>
                    {row.label ? ` · ${row.label}` : ''}:{' '}
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <pre className="code-block">{JSON.stringify(proposed, null, 2)}</pre>
        </section>

        {editing ? (
          <section className="stack">
            <h2 style={{ margin: 0, fontSize: 18 }}>Edit before applying</h2>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label>
              Artwork URL
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </label>
            <LinkRowsEditor rows={links} onChange={setLinks} />
            <CoverageFields
              isNational={isNational}
              teamIds={teamIds}
              conferenceIds={conferenceIds}
              teamSearch={teamSearch}
              onNationalChange={setIsNational}
              onTeamSearchChange={setTeamSearch}
              onToggleTeam={(teamId) => setTeamIds((current) => toggle(current, teamId))}
              onToggleConference={(conferenceId) =>
                setConferenceIds((current) => toggle(current, conferenceId))
              }
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active in directory
            </label>
          </section>
        ) : null}

        <label>
          Submitter email
          <input value={detail?.submitterEmail || ''} readOnly />
        </label>
        <label>
          Admin notes
          <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </label>

        <div className="row">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !pending}
            onClick={() => void onApply(editing)}
          >
            {editing ? 'Apply Edited Correction' : 'Apply Correction'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !pending}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? 'Cancel Edit' : 'Edit Before Applying'}
          </button>
          {detail?.submitterEmail ? (
            <a
              className="button btn-secondary"
              href={buildCorrectionReplyMailto(detail.submitterEmail, creatorName)}
            >
              Reply to Submitter
            </a>
          ) : null}
          <button
            type="button"
            className="btn-danger"
            disabled={busy || !pending}
            onClick={() => void onReject()}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
