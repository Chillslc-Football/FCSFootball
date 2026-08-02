import { PLATFORM_LABELS, type LinkRow, type PlatformKey } from '../lib/catalog';

type Props = {
  name: string;
  description: string;
  logoUrl: string;
  isNational: boolean;
  teamLabels: string[];
  conferenceLabels: string[];
  links: LinkRow[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function actionLabel(row: LinkRow): string {
  const platform = PLATFORM_LABELS[row.platform as PlatformKey] ?? row.platform;
  const label = row.label.trim();
  return label ? `${platform} · ${label}` : platform;
}

export function CreatorCardPreview(props: Props) {
  const coverage = [
    props.isNational ? 'National' : null,
    ...props.teamLabels,
    ...props.conferenceLabels,
  ].filter(Boolean);
  const links = props.links.filter((row) => row.url.trim());

  return (
    <div className="preview-card">
      <div className="preview-header">
        {props.logoUrl.trim() ? (
          <img
            className="preview-art"
            src={props.logoUrl.trim()}
            alt=""
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = 'none';
              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="preview-art fallback"
          style={{ display: props.logoUrl.trim() ? 'none' : 'flex' }}
        >
          {initials(props.name || 'Creator')}
        </div>
        <div className="preview-text">
          <div className="preview-name">{props.name.trim() || 'Untitled creator'}</div>
          {coverage.length > 0 ? (
            <div className="preview-meta">{coverage.join(' · ')}</div>
          ) : null}
          {props.description.trim() ? (
            <div className="preview-desc">{props.description.trim()}</div>
          ) : null}
        </div>
      </div>
      {links.length > 0 ? (
        <div className="preview-links">
          {links.map((link, index) => (
            <span key={`${link.platform}-${link.url}-${index}`} className="preview-chip">
              {actionLabel(link)}
            </span>
          ))}
        </div>
      ) : (
        <div className="muted">Media links coming soon</div>
      )}
    </div>
  );
}
