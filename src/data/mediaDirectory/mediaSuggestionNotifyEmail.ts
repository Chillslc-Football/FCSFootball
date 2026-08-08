import {
  formatMediaLinkActionLabel,
  formatMediaLinkRowsForEmail,
  platformLinksToMediaLinkRows,
  type MediaLinkRow,
} from '@/data/mediaDirectory/mediaLinkRows';
import type { MediaPlatformLinks } from '@/data/mediaDirectory/mediaPlatformLinks';
import {
  resolveMediaSuggestionConferenceNames,
  resolveMediaSuggestionTeamNames,
  type MediaSuggestionCoverageLabels,
} from '@/data/mediaDirectory/mediaSuggestionCoverageLabels';

/** Payload for Edge Function notify-by-id path. */
export type MediaSuggestionNotifyPayload = {
  suggestion_id: string;
  /**
   * Display-name enrichment when the saved row has empty coverage_labels
   * (DB values still win when present).
   */
  coverage_labels?: MediaSuggestionCoverageLabels;
};

export function buildMediaSuggestionNotifyPayload(
  suggestionId: string,
  coverageLabels?: MediaSuggestionCoverageLabels | null,
): MediaSuggestionNotifyPayload {
  const payload: MediaSuggestionNotifyPayload = {
    suggestion_id: suggestionId.trim(),
  };
  if (coverageLabels && typeof coverageLabels === 'object') {
    payload.coverage_labels = coverageLabels;
  }
  return payload;
}

/**
 * Practical submitter-email check (not full RFC).
 * Trims whitespace first. Aligns with submit_media_creator_update SQL:
 *   ^[^@\s]+@[^@\s]+\.[^@\s]+$
 */
export function isValidSubmitterEmail(raw: string): boolean {
  const email = normalizeSubmitterEmail(raw);
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Trim leading/trailing whitespace and lowercase for storage/submit. */
export function normalizeSubmitterEmail(raw: string): string {
  return String(raw ?? '')
    .replace(/^\s+|\s+$/g, '')
    .toLowerCase();
}

export type MediaSuggestionEmailDetails = {
  id: string;
  name: string;
  /** Preferred repeatable links. */
  links?: MediaLinkRow[] | null;
  /** Legacy one-URL-per-platform map (used when links omitted). */
  platformLinks: MediaPlatformLinks;
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  coverageLabels?: MediaSuggestionCoverageLabels | null;
  notes: string | null;
  submitterEmail?: string | null;
  status: string;
  submittedAt: string;
  /**
   * Primary admin review link (https://admin.fcspulse.com/suggestions/{id}).
   * Legacy field name kept for callers; token review URLs must not be used.
   */
  reviewUrl?: string | null;
  /** @deprecated Token approve hints are no longer used. */
  approveUrl?: string | null;
  /** @deprecated Token reject hints are no longer used. */
  rejectUrl?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMediaSuggestionSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    date.toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }) + ' (UTC)'
  );
}

export function buildMediaSuggestionReplyMailto(input: {
  submitterEmail: string;
  creatorName: string;
}): string {
  const subject = 'Question about your FCS Pulse media suggestion';
  const body = [
    'Hi,',
    '',
    `Thanks for suggesting ${input.creatorName} for FCS Pulse.`,
    '',
    'I have a quick question:',
    '',
  ].join('\n');
  return `mailto:${encodeURIComponent(input.submitterEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type MediaSuggestionOwnerEmailContent = {
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
};

/** Owner notification: HTML + plain-text fallback. */
export function formatMediaSuggestionOwnerEmail(
  details: MediaSuggestionEmailDetails,
): MediaSuggestionOwnerEmailContent {
  const name = details.name.trim() || 'Untitled';
  const teamNames = resolveMediaSuggestionTeamNames(
    details.teamIds,
    details.coverageLabels,
  );
  const conferenceNames = resolveMediaSuggestionConferenceNames(
    details.conferenceIds,
    details.coverageLabels,
  );
  const submitter = details.submitterEmail?.trim().toLowerCase() || null;
  const submittedAt = formatMediaSuggestionSubmittedAt(details.submittedAt);
  const notes = details.notes?.trim() || 'None';

  const linkRows =
    details.links && details.links.length > 0
      ? details.links
      : platformLinksToMediaLinkRows(details.platformLinks);

  const textLinkBlock =
    linkRows.length > 0 ? formatMediaLinkRowsForEmail(linkRows) : 'Platform Links\nNone';

  const text = [
    'A new FCS Media suggestion was saved and needs review.',
    '',
    `Creator or Podcast Name: ${name}`,
    '',
    textLinkBlock,
    '',
    `National: ${details.isNational ? 'Yes' : 'No'}`,
    `Teams: ${teamNames.length > 0 ? teamNames.join(', ') : 'None'}`,
    `Conferences: ${conferenceNames.length > 0 ? conferenceNames.join(', ') : 'None'}`,
    `Notes: ${notes}`,
    `Submitter Email: ${submitter ?? 'None'}`,
    '',
    `Suggestion ID: ${details.id}`,
    `Status: ${details.status}`,
    `Submitted Timestamp: ${submittedAt}`,
    '',
    details.reviewUrl ? `Review: ${details.reviewUrl}` : null,
    details.approveUrl ? `Approve: ${details.approveUrl}` : null,
    details.rejectUrl ? `Reject: ${details.rejectUrl}` : null,
    submitter
      ? `Reply: ${buildMediaSuggestionReplyMailto({ submitterEmail: submitter, creatorName: name })}`
      : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const linkHtml =
    linkRows.length > 0
      ? linkRows
          .map((link) => {
            const heading = formatMediaLinkActionLabel(link);
            return `<div style="margin:0 0 12px 0;font-size:15px;line-height:1.4;">
                <div style="font-weight:700;color:#E8EEF7;margin-bottom:2px;">${escapeHtml(heading)}</div>
                <a href="${escapeHtml(link.url)}" style="color:#C9A227;word-break:break-all;">${escapeHtml(link.url)}</a>
              </div>`;
          })
          .join('')
      : `<div style="color:#9AA6B2;font-size:15px;">None</div>`;

  const teamHtml =
    teamNames.length > 0
      ? escapeHtml(teamNames.join(', '))
      : 'None';
  const conferenceHtml =
    conferenceNames.length > 0
      ? escapeHtml(conferenceNames.join(', '))
      : 'None';

  const replyMailto = submitter
    ? buildMediaSuggestionReplyMailto({ submitterEmail: submitter, creatorName: name })
    : null;

  const buttonRow = [
    details.reviewUrl
      ? `<a href="${escapeHtml(details.reviewUrl)}" style="display:inline-block;background:#C9A227;color:#0F1419;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;margin:0 8px 8px 0;">Open in Media Admin</a>`
      : '',
    replyMailto
      ? `<a href="${escapeHtml(replyMailto)}" style="display:inline-block;background:transparent;color:#C9A227;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;border:1px solid #C9A227;margin:0 8px 8px 0;">Reply</a>`
      : '',
  ].join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FCS Pulse media suggestion</title>
</head>
<body style="margin:0;padding:0;background:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E8EEF7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#1A2230;border-radius:12px;overflow:hidden;border:1px solid #2A3545;">
          <tr>
            <td style="padding:24px 24px 12px 24px;background:#121820;">
              <div style="font-size:22px;font-weight:800;letter-spacing:0.02em;color:#C9A227;">FCS Pulse</div>
              <div style="margin-top:6px;font-size:16px;color:#E8EEF7;">New media suggestion ready for review</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;">
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Creator or Podcast Name</div>
              <div style="font-size:20px;font-weight:700;color:#FFFFFF;margin-bottom:18px;">${escapeHtml(name)}</div>

              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:8px;">Platform Links</div>
              <div style="margin-bottom:18px;">${linkHtml}</div>

              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Coverage</div>
              <div style="font-size:15px;margin-bottom:6px;"><strong>National:</strong> ${details.isNational ? 'Yes' : 'No'}</div>
              <div style="font-size:15px;margin-bottom:6px;"><strong>Teams:</strong> ${teamHtml}</div>
              <div style="font-size:15px;margin-bottom:18px;"><strong>Conferences:</strong> ${conferenceHtml}</div>

              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Notes</div>
              <div style="font-size:15px;margin-bottom:18px;white-space:pre-wrap;">${escapeHtml(notes)}</div>

              <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#9AA6B2;margin-bottom:6px;">Submitter Email</div>
              <div style="font-size:15px;margin-bottom:18px;">${submitter ? escapeHtml(submitter) : 'None'}</div>

              <div style="font-size:14px;color:#9AA6B2;line-height:1.6;margin-bottom:22px;">
                <div><strong style="color:#E8EEF7;">Suggestion ID:</strong> ${escapeHtml(details.id)}</div>
                <div><strong style="color:#E8EEF7;">Status:</strong> ${escapeHtml(details.status)}</div>
                <div><strong style="color:#E8EEF7;">Submitted Timestamp:</strong> ${escapeHtml(submittedAt)}</div>
              </div>

              <div>${buttonRow}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px 24px;color:#6F7B88;font-size:12px;line-height:1.5;">
              Open Media Admin to review, edit, approve and publish, or reject this suggestion. Sign-in is required.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `New FCS Pulse media suggestion: ${name}`,
    text,
    html,
    replyTo: submitter,
  };
}
