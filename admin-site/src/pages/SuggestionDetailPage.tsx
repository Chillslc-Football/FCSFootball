import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoverageFields } from '../components/CoverageFields';
import { LinkRowsEditor } from '../components/LinkRowsEditor';
import {
  approveAndPublish,
  buildReplyMailto,
  findSourceMatches,
  getSuggestionDetail,
  notifySuggestionOutcome,
  rejectSuggestion,
  saveSuggestionDraft,
  type SuggestionDetail,
} from '../lib/api';
import { compactLinkRows, emptyLinkRow, parseLinkRows, type LinkRow } from '../lib/catalog';

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function SuggestionDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<SuggestionDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [links, setLinks] = useState<LinkRow[]>([emptyLinkRow(0)]);
  const [isNational, setIsNational] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [conferenceIds, setConferenceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  const extraTeams = useMemo(() => {
    const labels = detail?.coverageLabels?.teams ?? {};
    return Object.entries(labels).map(([teamId, label]) => ({ id: teamId, label }));
  }, [detail]);

  useEffect(() => {
    void getSuggestionDetail(id)
      .then((data) => {
        setDetail(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setLogoUrl(data.logoUrl || '');
        const parsed = parseLinkRows(data.links, data.platformLinks);
        setLinks(parsed.length > 0 ? parsed : [emptyLinkRow(0)]);
        setIsNational(Boolean(data.isNational));
        setTeamIds(data.teamIds || []);
        setConferenceIds(data.conferenceIds || []);
        setNotes(data.notes || '');
        setAdminNotes(data.adminNotes || '');
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  async function onSaveDraft() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveSuggestionDraft({
        id,
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        links: compactLinkRows(links),
        isNational,
        teamIds,
        conferenceIds,
        notes: notes || null,
        coverageLabels: detail?.coverageLabels ?? null,
      });
      setDetail(saved);
      const parsed = parseLinkRows(saved.links, saved.platformLinks);
      setLinks(parsed.length > 0 ? parsed : [emptyLinkRow(0)]);
      setMessage('Draft changes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveSuggestionDraft({
        id,
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        links: compactLinkRows(links),
        isNational,
        teamIds,
        conferenceIds,
        notes: notes || null,
        coverageLabels: detail?.coverageLabels ?? null,
      });

      if (!forceCreate && !selectedMatchId) {
        const found = await findSourceMatches(name);
        const exact = found.filter(
          (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase(),
        );
        if (exact.length > 0) {
          setMatches(exact);
          setError('Matching creators found. Confirm overwrite or create a new creator.');
          setBusy(false);
          return;
        }
      }

      const result = await approveAndPublish({
        id,
        existingSourceId: selectedMatchId,
        confirmOverwrite: Boolean(selectedMatchId),
      });
      const notify = await notifySuggestionOutcome({
        suggestionId: id,
        outcome: 'approved',
      });
      setMessage(
        `Approved and published (${result.mode}). ${
          notify.submitterNotified ? 'Submitter notified.' : 'Submitter not notified.'
        }`,
      );
      const refreshed = await getSuggestionDetail(id);
      setDetail(refreshed);
      setMatches([]);
      setForceCreate(false);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Approve failed';
      if (text.includes('overwrite_confirmation_required')) {
        const found = await findSourceMatches(name);
        setMatches(found);
      }
      setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function onReject(notify: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await rejectSuggestion(id, adminNotes || null);
      if (notify) {
        const result = await notifySuggestionOutcome({
          suggestionId: id,
          outcome: 'rejected',
          notify: true,
        });
        setMessage(
          result.submitterNotified
            ? 'Suggestion rejected. Submitter notified.'
            : 'Suggestion rejected.',
        );
      } else {
        setMessage('Suggestion rejected without notifying the submitter.');
      }
      setDetail(await getSuggestionDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) {
    return <div className="card">Loading suggestion…</div>;
  }

  return (
    <div className="stack">
      <div className="row">
        <Link to="/suggestions">← Back to queue</Link>
      </div>

      <div className="card stack">
        <h1 style={{ margin: 0 }}>{detail?.name || 'Suggestion'}</h1>
        <div className="muted">
          Status: {detail?.status} · Submitted{' '}
          {detail ? new Date(detail.submittedAt).toLocaleString() : ''}
        </div>
        {detail?.publishedMediaSourceId ? (
          <div>
            Published source:{' '}
            <Link to={`/sources/${detail.publishedMediaSourceId}`}>
              {detail.publishedMediaSourceId}
            </Link>
          </div>
        ) : null}
        {error ? <div className="error">{error}</div> : null}
        {message ? <div style={{ color: 'var(--ok)' }}>{message}</div> : null}

        <label>
          Creator or podcast name
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

        <div>
          <div className="muted" style={{ marginBottom: 8 }}>
            Platform links
          </div>
          <LinkRowsEditor rows={links} onChange={setLinks} />
        </div>

        <CoverageFields
          isNational={isNational}
          teamIds={teamIds}
          conferenceIds={conferenceIds}
          teamSearch={teamSearch}
          extraTeams={extraTeams}
          onNationalChange={setIsNational}
          onTeamSearchChange={setTeamSearch}
          onToggleTeam={(teamId) => setTeamIds((current) => toggle(current, teamId))}
          onToggleConference={(conferenceId) =>
            setConferenceIds((current) => toggle(current, conferenceId))
          }
        />

        <label>
          Submitter email
          <input value={detail?.submitterEmail || ''} readOnly />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          Private admin reason (reject)
          <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </label>

        {matches.length > 0 ? (
          <div className="card stack">
            <strong>Possible existing creators</strong>
            <p className="muted">
              Confirm an overwrite, or continue without selecting to create a new creator after
              clearing the match requirement by choosing Create new below.
            </p>
            {matches.map((match) => (
              <label key={match.id} className="checkbox">
                <input
                  type="radio"
                  name="match"
                  checked={selectedMatchId === match.id}
                  onChange={() => setSelectedMatchId(match.id)}
                />
                Overwrite {match.name}
              </label>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelectedMatchId(null);
                setMatches([]);
                setForceCreate(true);
                setError(null);
              }}
            >
              Create new creator instead
            </button>
          </div>
        ) : null}

        <div className="row">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onSaveDraft()}>
            Save Draft Changes
          </button>
          {detail?.submitterEmail ? (
            <a
              className="button btn-secondary"
              href={buildReplyMailto(detail.submitterEmail, name || detail.name)}
            >
              Reply to Submitter
            </a>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            disabled={busy || detail?.status !== 'pending'}
            onClick={() => void onApprove()}
          >
            Approve and Publish
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy || detail?.status !== 'pending'}
            onClick={() => void onReject(true)}
          >
            Reject + Email
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy || detail?.status !== 'pending'}
            onClick={() => void onReject(false)}
          >
            Reject silently
          </button>
        </div>
      </div>
    </div>
  );
}
