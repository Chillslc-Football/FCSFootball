export type MediaSuggestionOutcome = 'approved' | 'rejected';

export type MediaSuggestionOutcomeEmail = {
  subject: string;
  text: string;
  html: string;
  from: string;
};

export const MEDIA_SUGGESTION_OUTCOME_FROM = 'FCS Pulse <notifications@fcspulse.com>';

export function formatMediaSuggestionOutcomeEmail(input: {
  outcome: MediaSuggestionOutcome;
  creatorName: string;
}): MediaSuggestionOutcomeEmail {
  const creator = input.creatorName.trim() || 'your suggestion';

  if (input.outcome === 'approved') {
    const text = [
      'Thanks for helping improve FCS Pulse.',
      '',
      `Your suggestion for ${creator} has been accepted for inclusion. It may take a little time before it appears in the directory while the listing is reviewed and completed.`,
      '',
      'FCS Pulse',
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E8EEF7;">
  <div style="max-width:560px;margin:0 auto;background:#1A2230;border-radius:12px;padding:24px;border:1px solid #2A3545;">
    <div style="font-size:20px;font-weight:800;color:#C9A227;margin-bottom:12px;">FCS Pulse</div>
    <p style="font-size:16px;line-height:1.5;margin:0 0 12px 0;">Thanks for helping improve FCS Pulse.</p>
    <p style="font-size:16px;line-height:1.5;margin:0;">Your suggestion for <strong style="color:#FFFFFF;">${escapeHtml(creator)}</strong> has been accepted for inclusion. It may take a little time before it appears in the directory while the listing is reviewed and completed.</p>
  </div>
</body>
</html>`;

    return {
      subject: 'Your FCS Pulse media suggestion was accepted',
      text,
      html,
      from: MEDIA_SUGGESTION_OUTCOME_FROM,
    };
  }

  const text = [
    `Thanks for taking the time to submit ${creator}.`,
    '',
    'After reviewing it, we decided not to add it at this time.',
    '',
    'FCS Pulse',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#0F1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E8EEF7;">
  <div style="max-width:560px;margin:0 auto;background:#1A2230;border-radius:12px;padding:24px;border:1px solid #2A3545;">
    <div style="font-size:20px;font-weight:800;color:#C9A227;margin-bottom:12px;">FCS Pulse</div>
    <p style="font-size:16px;line-height:1.5;margin:0 0 12px 0;">Thanks for taking the time to submit <strong style="color:#FFFFFF;">${escapeHtml(creator)}</strong>.</p>
    <p style="font-size:16px;line-height:1.5;margin:0;">After reviewing it, we decided not to add it at this time.</p>
  </div>
</body>
</html>`;

  return {
    subject: 'Update on your FCS Pulse media suggestion',
    text,
    html,
    from: MEDIA_SUGGESTION_OUTCOME_FROM,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
