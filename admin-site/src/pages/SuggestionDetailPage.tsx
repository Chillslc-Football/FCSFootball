import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoverageFields } from '../components/CoverageFields';
import { CreatorCardPreview } from '../components/CreatorCardPreview';
import { LinkRowsEditor } from '../components/LinkRowsEditor';
import {
  approveAndPublish,
  buildReplyMailto,
  findSourceMatches,
  getSourceDetail,
  getSuggestionDetail,
  mergeSuggestion,
  notifySuggestionOutcome,
  rejectSuggestion,
  saveSuggestionDraft,
  type SourceDetail,
  type SourceMatchCandidate,
  type SuggestionDetail,
} from '../lib/api';
import {
  CONFERENCE_OPTIONS,
  TEAM_OPTIONS,
  compactLinkRows,
  emptyLinkRow,
  parseLinkRows,
  type LinkRow,
} from '../lib/catalog';

type MergeSelection = {
  copyLinks: boolean;
  copyArtwork: boolean;
  copyDescription: boolean;
  copyTeams: boolean;
  copyConferences: boolean;
  copyNational: boolean;
};

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function normalizeUrlKey(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '');
}

function findDuplicateUrls(rows: LinkRow[]): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = normalizeUrlKey(row.url);
    if (!key) continue;
    if (seen.has(key)) return row.url.trim();
    seen.add(key);
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function statusBadgeClass(status: string): string {
  if (status === 'approved') return 'badge badge-ok';
  if (status === 'rejected') return 'badge badge-danger';
  return 'badge badge-pending';
}

function reasonLabel(reason: string): string {
  if (reason === 'exact_name') return 'Exact name';
  if (reason === 'similar_name') return 'Similar name';
  if (reason === 'url_overlap') return 'Shared URL';
  return reason;
}

function matchLabel(score: number): string {
  if (score >= 100) return 'Exact';
  if (score >= 70) return 'Strong';
  return 'Possible';
}

function coverageText(input: {
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  labels?: { teams?: Record<string, string>; conferences?: Record<string, string> };
}): string {
  const teams = input.teamIds.map(
    (id) =>
      input.labels?.teams?.[id] ||
      TEAM_OPTIONS.find((team) => team.id === id)?.label ||
      id,
  );
  const conferences = input.conferenceIds.map(
    (id) =>
      input.labels?.conferences?.[id] ||
      CONFERENCE_OPTIONS.find((item) => item.id === id)?.label ||
      id,
  );
  const parts = [
    input.isNational ? 'National' : null,
    teams.length ? teams.join(', ') : null,
    conferences.length ? conferences.join(', ') : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No coverage set';
}

function summarizeMerge(input: {
  selection: MergeSelection;
  existing: SourceDetail;
  suggestion: {
    description: string;
    logoUrl: string;
    isNational: boolean;
    teamIds: string[];
    conferenceIds: string[];
    urls: string[];
  };
}): string[] {
  const existingUrls = new Set(
    parseLinkRows(input.existing.links, input.existing.platformLinks).map((row) =>
      normalizeUrlKey(row.url),
    ),
  );
  const newLinkCount = input.suggestion.urls.filter(
    (url) => !existingUrls.has(normalizeUrlKey(url)),
  ).length;
  const lines: string[] = [];
  if (input.selection.copyLinks) {
    lines.push(
      newLinkCount > 0
        ? `Add ${newLinkCount} new link${newLinkCount === 1 ? '' : 's'} (duplicate URLs skipped)`
        : 'No new links to add (all URLs already exist)',
    );
  }
  if (input.selection.copyArtwork && input.suggestion.logoUrl.trim()) {
    lines.push(
      input.existing.logoUrl?.trim()
        ? 'Replace existing artwork'
        : 'Set artwork from suggestion',
    );
  }
  if (input.selection.copyDescription && input.suggestion.description.trim()) {
    lines.push(
      input.existing.description?.trim()
        ? 'Replace existing description'
        : 'Set description from suggestion',
    );
  }
  if (input.selection.copyTeams) lines.push('Merge team coverage');
  if (input.selection.copyConferences) lines.push('Merge conference coverage');
  if (input.selection.copyNational && input.suggestion.isNational) {
    lines.push('Enable National coverage');
  }
  if (lines.length === 0) lines.push('No fields selected to copy');
  return lines;
}

const DEFAULT_MERGE: MergeSelection = {
  copyLinks: true,
  copyArtwork: false,
  copyDescription: false,
  copyTeams: false,
  copyConferences: false,
  copyNational: false,
};

export function SuggestionDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<SuggestionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [artBroken, setArtBroken] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([emptyLinkRow(0)]);
  const [isNational, setIsNational] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [conferenceIds, setConferenceIds] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<SourceMatchCandidate[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<SourceDetail | null>(null);
  const [mergeSelection, setMergeSelection] = useState<MergeSelection>(DEFAULT_MERGE);
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [createAnyway, setCreateAnyway] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectAdminReason, setRejectAdminReason] = useState('');
  const [rejectSubmitterReason, setRejectSubmitterReason] = useState('');
  const [notifyOnReject, setNotifyOnReject] = useState(true);
  const [publishedSourceId, setPublishedSourceId] = useState<string | null>(null);

  const extraTeams = useMemo(() => {
    const labels = detail?.coverageLabels?.teams ?? {};
    return Object.entries(labels).map(([teamId, label]) => ({ id: teamId, label }));
  }, [detail]);

  const teamLabels = useMemo(
    () =>
      teamIds.map(
        (teamId) =>
          detail?.coverageLabels?.teams?.[teamId] ||
          TEAM_OPTIONS.find((team) => team.id === teamId)?.label ||
          teamId,
      ),
    [teamIds, detail],
  );

  const conferenceLabels = useMemo(
    () =>
      conferenceIds.map(
        (conferenceId) =>
          detail?.coverageLabels?.conferences?.[conferenceId] ||
          CONFERENCE_OPTIONS.find((item) => item.id === conferenceId)?.label ||
          conferenceId,
      ),
    [conferenceIds, detail],
  );

  const populatedUrls = useMemo(
    () => links.map((row) => row.url.trim()).filter(Boolean),
    [links],
  );
  const urlsKey = populatedUrls.join('\n');

  const pending = detail?.status === 'pending';
  const unauthorized = Boolean(loadError && /not_authorized|not authorized|JWT/i.test(loadError));
  const notFound = Boolean(loadError && /not_found|not found/i.test(loadError));

  function applyDetail(data: SuggestionDetail) {
    setDetail(data);
    setName(data.name || '');
    setDescription(data.description || '');
    setLogoUrl(data.logoUrl || '');
    setArtBroken(false);
    const parsed = parseLinkRows(data.links, data.platformLinks);
    setLinks(parsed.length > 0 ? parsed : [emptyLinkRow(0)]);
    setIsNational(Boolean(data.isNational));
    setTeamIds(data.teamIds || []);
    setConferenceIds(data.conferenceIds || []);
    setAdminNotes(data.adminNotes || '');
    setPublishedSourceId(data.publishedMediaSourceId);
  }

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setDetail(null);
    void getSuggestionDetail(id)
      .then((data) => {
        if (!cancelled) applyDetail(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message || 'Failed to load suggestion');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!detail || detail.status !== 'pending') return;
    let cancelled = false;
    setMatchesLoading(true);
    void findSourceMatches({ name, urls: populatedUrls })
      .then((found) => {
        if (!cancelled) setMatches(found);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // urlsKey tracks populated URL edits without depending on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.status, name, urlsKey]);

  async function persistDraft(): Promise<SuggestionDetail> {
    const dup = findDuplicateUrls(links);
    if (dup) throw new Error(`Duplicate URL: ${dup}`);
    for (const row of links) {
      const url = row.url.trim();
      if (url && !isHttpUrl(url)) throw new Error(`Invalid URL: ${url}`);
    }
    if (logoUrl.trim() && !isHttpUrl(logoUrl.trim())) {
      throw new Error('Artwork URL must start with http:// or https://');
    }
    const saved = await saveSuggestionDraft({
      id,
      name,
      description: description || null,
      logoUrl: logoUrl || null,
      links: compactLinkRows(links),
      isNational,
      teamIds,
      conferenceIds,
      notes: null,
      adminNotes: adminNotes || null,
      coverageLabels: detail?.coverageLabels ?? null,
    });
    applyDetail(saved);
    return saved;
  }

  async function onSaveDraft() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await persistDraft();
      setMessage('Draft changes saved. Original submitter notes were preserved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!name.trim()) throw new Error('Creator or podcast name is required.');
      const compact = compactLinkRows(links);
      if (compact.length === 0) throw new Error('At least one valid platform link is required.');
      const dup = findDuplicateUrls(links);
      if (dup) throw new Error(`Duplicate URL: ${dup}`);
      for (const row of compact) {
        if (!isHttpUrl(row.url)) throw new Error(`Invalid URL: ${row.url}`);
      }

      await persistDraft();

      if (!createAnyway && !selectedMatchId && matches.some((item) => item.score >= 100)) {
        setError(
          'Exact matches found. Choose Merge Into Existing, Create New Anyway, or confirm overwrite.',
        );
        setBusy(false);
        return;
      }

      const result = await approveAndPublish({
        id,
        existingSourceId: selectedMatchId && !createAnyway ? selectedMatchId : null,
        confirmOverwrite: Boolean(selectedMatchId && !createAnyway),
      });
      const notify = await notifySuggestionOutcome({
        suggestionId: id,
        outcome: 'approved',
      });
      setPublishedSourceId(result.mediaSourceId);
      setMessage(
        `Approved and published (${result.mode}). ${
          notify.submitterNotified ? 'Submitter notified.' : 'Submitter not notified.'
        }`,
      );
      applyDetail(await getSuggestionDetail(id));
      setShowMergePanel(false);
      setSelectedMatchId(null);
      setCreateAnyway(false);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Approve failed';
      if (text.includes('overwrite_confirmation_required')) {
        try {
          setMatches(await findSourceMatches({ name, urls: populatedUrls }));
        } catch {
          /* keep existing matches */
        }
      }
      setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function openMerge(sourceId: string) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const source = await getSourceDetail(sourceId);
      setMergeTarget(source);
      setSelectedMatchId(sourceId);
      setMergeSelection(DEFAULT_MERGE);
      setShowMergePanel(true);
      setCreateAnyway(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load existing creator');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmMerge() {
    if (busy || !selectedMatchId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await persistDraft();
      const result = await mergeSuggestion({
        id,
        existingSourceId: selectedMatchId,
        ...mergeSelection,
      });
      const notify = await notifySuggestionOutcome({
        suggestionId: id,
        outcome: 'approved',
      });
      setPublishedSourceId(result.mediaSourceId);
      setMessage(
        `Merged into existing creator (+${result.addedLinks} links). ${
          notify.submitterNotified ? 'Submitter notified.' : 'Submitter not notified.'
        }`,
      );
      applyDetail(await getSuggestionDetail(id));
      setShowMergePanel(false);
      setMergeTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmReject() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const privateNotes = [rejectAdminReason.trim(), adminNotes.trim()]
        .filter(Boolean)
        .join('\n\n');
      await rejectSuggestion(id, privateNotes || null);
      if (notifyOnReject) {
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
      applyDetail(await getSuggestionDetail(id));
      setRejectOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !loadError) {
    return <div className="card">Loading suggestion…</div>;
  }

  if (unauthorized) {
    return (
      <div className="stack">
        <Link to="/suggestions">← Back to Pending</Link>
        <div className="card error">
          Unauthorized. This account is not allowed to review media suggestions.
        </div>
      </div>
    );
  }

  if (notFound || (!detail && loadError)) {
    return (
      <div className="stack">
        <Link to="/suggestions">← Back to Pending</Link>
        <div className="card error">
          {notFound ? 'Suggestion not found.' : loadError || 'Unable to load suggestion.'}
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const mergeLines =
    mergeTarget && showMergePanel
      ? summarizeMerge({
          selection: mergeSelection,
          existing: mergeTarget,
          suggestion: {
            description,
            logoUrl,
            isNational,
            teamIds,
            conferenceIds,
            urls: populatedUrls,
          },
        })
      : [];

  return (
    <div className="stack detail-page">
      <section className="card stack detail-header">
        <div className="row detail-header-top">
          <Link to="/suggestions">← Back to Pending</Link>
          <span className={statusBadgeClass(detail.status)}>{detail.status}</span>
        </div>
        <h1 className="detail-title">{name.trim() || detail.name || 'Suggestion'}</h1>
        <div className="muted">
          Submitted {new Date(detail.submittedAt).toLocaleString()}
          {detail.submitterEmail ? ` · ${detail.submitterEmail}` : ''}
        </div>
        {publishedSourceId || detail.publishedMediaSourceId ? (
          <div>
            Published in Directory:{' '}
            <Link to={`/sources/${publishedSourceId || detail.publishedMediaSourceId}`}>
              Open creator record
            </Link>
          </div>
        ) : null}
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}
      </section>

      <div className="detail-layout">
        <div className="stack detail-main">
          <section className="card stack">
            <h2>Artwork</h2>
            <div className="artwork-row">
              {logoUrl.trim() && !artBroken ? (
                <img
                  className="artwork-preview"
                  src={logoUrl.trim()}
                  alt=""
                  onError={() => setArtBroken(true)}
                />
              ) : (
                <div className="artwork-preview fallback">{initials(name || detail.name)}</div>
              )}
              <label style={{ flex: 1 }}>
                Artwork URL
                <input
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value);
                    setArtBroken(false);
                  }}
                  placeholder="https://…"
                  disabled={!pending || busy}
                />
              </label>
            </div>
          </section>

          <section className="card stack">
            <h2>Creator Details</h2>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!pending || busy}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!pending || busy}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isNational}
                onChange={(e) => setIsNational(e.target.checked)}
                disabled={!pending || busy}
              />
              National
            </label>
            {!pending ? (
              <p className="muted">
                Active status is managed on the published Directory record after approval.
              </p>
            ) : null}
          </section>

          <section className="card stack">
            <h2>Platform Links</h2>
            <LinkRowsEditor
              rows={links}
              disabled={!pending || busy}
              onChange={setLinks}
            />
          </section>

          <section className="card stack">
            <h2>Coverage</h2>
            <CoverageFields
              isNational={isNational}
              teamIds={teamIds}
              conferenceIds={conferenceIds}
              teamSearch={teamSearch}
              extraTeams={extraTeams}
              onNationalChange={(value) => {
                if (!pending || busy) return;
                setIsNational(value);
              }}
              onTeamSearchChange={setTeamSearch}
              onToggleTeam={(teamId) => {
                if (!pending || busy) return;
                setTeamIds((current) => toggle(current, teamId));
              }}
              onToggleConference={(conferenceId) => {
                if (!pending || busy) return;
                setConferenceIds((current) => toggle(current, conferenceId));
              }}
            />
          </section>

          <section className="card stack">
            <h2>Submission Notes</h2>
            <div className="notes-box">
              {detail.notes?.trim() ? detail.notes : 'No notes from submitter.'}
            </div>
            <p className="muted">
              Original submitter notes are read-only and are not overwritten when you save draft
              changes.
            </p>
            <label>
              Private Admin Notes
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                disabled={!pending || busy}
                placeholder="Internal notes (not shown to submitter)"
              />
            </label>
          </section>

          <section className="card stack">
            <h2>Submitter</h2>
            <div>{detail.submitterEmail || 'No email provided'}</div>
            {detail.submitterEmail ? (
              <a
                className="button btn-secondary"
                href={buildReplyMailto(detail.submitterEmail, name || detail.name)}
              >
                Reply
              </a>
            ) : null}
          </section>
        </div>

        <div className="stack detail-aside">
          <section className="card stack">
            <h2>Public Preview</h2>
            <CreatorCardPreview
              name={name}
              description={description}
              logoUrl={logoUrl}
              isNational={isNational}
              teamLabels={teamLabels}
              conferenceLabels={conferenceLabels}
              links={links}
            />
          </section>

          <section className="card stack">
            <h2>Possible Duplicates</h2>
            {matchesLoading ? <p className="muted">Searching directory…</p> : null}
            {!matchesLoading && matches.length === 0 ? (
              <p className="muted">No likely matches found.</p>
            ) : null}
            {matches.map((match) => (
              <div key={match.id} className="duplicate-card">
                <div className="artwork-row">
                  {match.logoUrl ? (
                    <img className="artwork-preview sm" src={match.logoUrl} alt="" />
                  ) : (
                    <div className="artwork-preview sm fallback">{initials(match.name)}</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div className="row">
                      <strong>{match.name}</strong>
                      <span className="badge">{matchLabel(match.score)}</span>
                    </div>
                    <div className="muted">
                      {coverageText({
                        isNational: match.isNational,
                        teamIds: match.teamIds,
                        conferenceIds: match.conferenceIds,
                      })}
                    </div>
                    <div className="muted">
                      {match.reasons.map(reasonLabel).join(' · ') || 'Name similarity'}
                    </div>
                  </div>
                </div>
                <div className="row">
                  <Link className="button btn-secondary" to={`/sources/${match.id}`}>
                    Open Existing
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!pending || busy}
                    onClick={() => void openMerge(match.id)}
                  >
                    Merge Into Existing
                  </button>
                </div>
              </div>
            ))}
            {matches.length > 0 && pending ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setCreateAnyway(true);
                  setSelectedMatchId(null);
                  setShowMergePanel(false);
                  setError(null);
                  setMessage('Create New Anyway selected. Approve will publish a new creator.');
                }}
              >
                Create New Anyway
              </button>
            ) : null}
          </section>

          {showMergePanel && mergeTarget ? (
            <section className="card stack">
              <h2>Merge Into Existing</h2>
              <p>
                Target: <strong>{mergeTarget.name}</strong>
              </p>
              <p className="muted">Choose which fields to copy. Existing values are never changed unless selected.</p>
              {(
                [
                  ['copyLinks', 'Links (append non-duplicate URLs)'],
                  ['copyArtwork', 'Artwork'],
                  ['copyDescription', 'Description'],
                  ['copyTeams', 'Teams'],
                  ['copyConferences', 'Conferences'],
                  ['copyNational', 'National'],
                ] as Array<[keyof MergeSelection, string]>
              ).map(([key, label]) => (
                <label key={key} className="checkbox">
                  <input
                    type="checkbox"
                    checked={mergeSelection[key]}
                    onChange={(e) =>
                      setMergeSelection((current) => ({
                        ...current,
                        [key]: e.target.checked,
                      }))
                    }
                    disabled={busy}
                  />
                  {label}
                </label>
              ))}
              <div className="notes-box">
                <strong>Summary</strong>
                <ul className="link-list">
                  {mergeLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !pending}
                  onClick={() => void onConfirmMerge()}
                >
                  Confirm Merge
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setShowMergePanel(false);
                    setMergeTarget(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <section className="card stack actions-bar">
        <h2>Actions</h2>
        <div className="row actions-row">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !pending}
            onClick={() => void onSaveDraft()}
          >
            Save Draft Changes
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !pending}
            onClick={() => void onApprove()}
          >
            Approve and Publish
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy || !pending}
            onClick={() => {
              setRejectAdminReason(adminNotes);
              setRejectSubmitterReason('');
              setNotifyOnReject(true);
              setRejectOpen(true);
            }}
          >
            Reject
          </button>
          {detail.submitterEmail ? (
            <a
              className="button btn-secondary"
              href={buildReplyMailto(detail.submitterEmail, name || detail.name)}
            >
              Reply
            </a>
          ) : null}
          {selectedMatchId || matches[0] ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !pending}
              onClick={() => void openMerge(selectedMatchId || matches[0]!.id)}
            >
              Merge Into Existing
            </button>
          ) : null}
        </div>
      </section>

      {rejectOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="card stack modal" role="dialog" aria-modal="true">
            <h2>Reject suggestion</h2>
            <p className="muted">
              Original submission data is kept. Confirm to mark this suggestion rejected.
            </p>
            <label>
              Private admin reason (optional)
              <textarea
                value={rejectAdminReason}
                onChange={(e) => setRejectAdminReason(e.target.value)}
              />
            </label>
            <label>
              Submitter-facing reason (optional, for your reply draft)
              <textarea
                value={rejectSubmitterReason}
                onChange={(e) => setRejectSubmitterReason(e.target.value)}
                placeholder="Not stored on the suggestion unless you also email them separately"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={notifyOnReject}
                onChange={(e) => setNotifyOnReject(e.target.checked)}
              />
              Email submitter rejection notice
            </label>
            {rejectSubmitterReason.trim() && detail.submitterEmail ? (
              <a
                className="button btn-secondary"
                href={`mailto:${encodeURIComponent(detail.submitterEmail)}?subject=${encodeURIComponent('Update on your FCS Pulse media suggestion')}&body=${encodeURIComponent(rejectSubmitterReason.trim())}`}
              >
                Open custom rejection email
              </a>
            ) : null}
            <div className="row">
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={() => void onConfirmReject()}
              >
                Confirm Reject
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setRejectOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
