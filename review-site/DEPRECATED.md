# DEPRECATED — token review site

This static token-based review UI (`/review?token=...`) is **not the active review system**.

Use the authenticated Media Admin app instead:

- Hostname: `https://admin.fcspulse.com`
- Suggestion detail: `https://admin.fcspulse.com/suggestions/{suggestionId}`

## Reusable pieces

Keep for reference / reuse in `admin-site/`:

| Piece | Reuse |
|---|---|
| `review/styles.css` navy/gold tokens | Visual identity for admin-site |
| Loading / error / result state patterns | UX copy patterns |
| Mailto reply helper idea | Reply to Submitter |
| `mediaSuggestionOutcomeEmail.ts` | Approval / rejection emails |
| `mediaSuggestionNotifyEmail.ts` | Owner notifications |
| Coverage label helpers | Team / conference display names |

## Do not deploy

Do not deploy `review-site/` to Cloudflare Pages alongside Media Admin.

The public Edge Function `review-media-suggestion` must not remain an active approve/reject path once Media Admin is live. Prefer disabling or removing it after admin cutover.

## Eventually removable

After Media Admin is validated in production:

- `review-site/` (entire folder)
- `supabase/functions/review-media-suggestion/`
- Token helpers only used by that function (`mediaSuggestionReviewToken.ts` HMAC review flow)
- Owner-email approve/reject token hint URL fields
