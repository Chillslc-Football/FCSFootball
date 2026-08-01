import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CoverageFields } from '../components/CoverageFields';
import { LinkRowsEditor } from '../components/LinkRowsEditor';
import { getSourceDetail, upsertSource } from '../lib/api';
import { compactLinkRows, emptyLinkRow, parseLinkRows, type LinkRow } from '../lib/catalog';

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function SourceDetailPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [links, setLinks] = useState<LinkRow[]>([emptyLinkRow(0)]);
  const [isNational, setIsNational] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [conferenceIds, setConferenceIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [teamSearch, setTeamSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void getSourceDetail(id!)
      .then((data) => {
        setName(data.name || '');
        setDescription(data.description || '');
        setLogoUrl(data.logoUrl || '');
        const parsed = parseLinkRows(data.links, data.platformLinks);
        setLinks(parsed.length > 0 ? parsed : [emptyLinkRow(0)]);
        setIsNational(Boolean(data.isNational));
        setTeamIds(data.teamIds || []);
        setConferenceIds(data.conferenceIds || []);
        setIsActive(Boolean(data.isActive));
      })
      .catch((err: Error) => setError(err.message));
  }, [id, isNew]);

  async function onSave() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await upsertSource({
        id: isNew ? null : id,
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        links: compactLinkRows(links),
        isNational,
        teamIds,
        conferenceIds,
        isActive,
        isApproved: true,
      });
      setMessage('Saved.');
      if (isNew) navigate(`/sources/${saved.id}`, { replace: true });
      else {
        const parsed = parseLinkRows(saved.links, saved.platformLinks);
        setLinks(parsed.length > 0 ? parsed : [emptyLinkRow(0)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <Link to="/sources">← Back to directory</Link>
      <div className="card stack">
        <h1 style={{ margin: 0 }}>{isNew ? 'Add New Creator' : 'Edit Creator'}</h1>
        {error ? <div className="error">{error}</div> : null}
        {message ? <div style={{ color: 'var(--ok)' }}>{message}</div> : null}

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
          Active (uncheck to hide from the public directory)
        </label>

        <button type="button" className="btn-primary" disabled={busy} onClick={() => void onSave()}>
          Save changes
        </button>
      </div>
    </div>
  );
}
