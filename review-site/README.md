# FCS Pulse media suggestion review site

Static review UI for Cloudflare Pages.

Owner emails link to:

`https://fcspulse.com/review?token=SIGNED_TOKEN`

The page loads suggestion details and confirms Approve/Reject through the
`review-media-suggestion` Supabase Edge Function (JSON API only).

## Structure

```
review-site/
  review/
    index.html
    review.js
    styles.css
    config.js
  _redirects
  README.md
```

## Cloudflare Pages settings

| Setting | Value |
|---|---|
| Root directory | `review-site` |
| Build command | *(none / leave empty)* |
| Build output directory | `/` or `.` (serve `review-site` as-is) |
| Framework preset | None |

Deploy this folder as a Pages project (or as part of the fcspulse.com Pages project).

## Custom domain

1. In Cloudflare Pages → Custom domains, attach `fcspulse.com` (or a subdomain).
2. Ensure `/review` resolves via `_redirects` to `review/index.html`.
3. Confirm the live URL works: `https://fcspulse.com/review`.

## Configure the public API URL

Edit `review/config.js` before or after deploy:

```js
window.FCS_PULSE_REVIEW = {
  apiBaseUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/review-media-suggestion',
};
```

This value is public (anon Edge Function URL). Do **not** put service-role keys
or Resend secrets in the static site.

## Related Supabase deploy

```bash
supabase.cmd secrets set MEDIA_SUGGESTION_REVIEW_SECRET=long-random-hmac-secret
supabase.cmd secrets set RESEND_API_KEY=...
supabase.cmd secrets set MEDIA_SUGGESTION_REVIEW_SITE_URL=https://fcspulse.com

supabase.cmd functions deploy review-media-suggestion --no-verify-jwt
supabase.cmd functions deploy submit-media-suggestion
```

Owner notification emails use `MEDIA_SUGGESTION_REVIEW_SITE_URL` (default
`https://fcspulse.com`) when building Review / Approve / Reject links.

## Local preview

Serve the folder with any static server, for example:

```bash
npx --yes serve review-site -p 4173
```

Open:

`http://localhost:4173/review?token=...`

The Edge Function CORS allow-list includes `http://localhost:4173` and
`http://localhost:5173` for local testing.
