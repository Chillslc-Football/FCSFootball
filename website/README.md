# FCS Pulse public website

Static site for public pages on `https://fcspulse.com`.

## Structure

```
website/
  index.html
  styles.css
  _redirects
  privacy/
    index.html
  delete-data/
    index.html
  README.md
```

Public URLs after deploy:

- `https://fcspulse.com/`
- `https://fcspulse.com/privacy`
- `https://fcspulse.com/delete-data`

## Cloudflare Pages settings

| Setting | Value |
|---|---|
| Root directory | `website` |
| Build command | *(none / leave empty)* |
| Build output directory | `/` or `.` (serve `website` as-is) |
| Framework preset | None |

Custom domain: `fcspulse.com`

`_redirects` maps `/privacy` and `/delete-data` to their `index.html` files so
direct open and refresh work without a 404.

## Local preview

```bash
npx --yes serve website -p 4173
```

Open:

- `http://localhost:4173/privacy`
- `http://localhost:4173/delete-data`

## Notes

- This replaces the deprecated apex content from `review-site/` when the
  Cloudflare Pages project root is pointed at `website`.
- `admin.fcspulse.com` remains a separate Pages project (`admin-site/`).
- Do not put service-role keys or secrets in this folder.
