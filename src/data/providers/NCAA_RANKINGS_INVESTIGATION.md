# NCAA Stats Perform FCS Top 25 — Investigation Report (Phase 10)

**Official page:** https://www.ncaa.com/rankings/football/fcs/stats-perform-fcs-top-25  
**Drupal node:** `2917492`  
**Investigation date:** July 2026

---

## Executive summary

**No reliable public JSON API exists** for the Stats Perform FCS Top 25 on NCAA.com. Rankings are **server-rendered HTML** in a Drupal CMS table. The mobile app **must not scrape** this page directly.

**Recommendation:** Add a **server-side rankings cache** (Worker, Lambda, or small API) that fetches/parses NCAA HTML on a schedule and exposes a stable JSON contract to the app. Production screens remain on mock data until that service exists.

---

## Investigation questions

### 1. Is there an underlying JSON endpoint?

**No** — for this poll specifically.

Probed URLs (all failed or returned HTML):

| URL | Result |
|-----|--------|
| `https://www.ncaa.com/json/rankings/football/fcs/stats-perform-fcs-top-25` | Connection closed |
| `https://www.ncaa.com/api/rankings/football/fcs/stats-perform-fcs-top-25` | Connection closed |
| `https://www.ncaa.com/node/2917492?_format=json` | **403 Forbidden** |
| `https://data.ncaa.com/casablanca/rankings/football/fcs/stats-perform-fcs-top-25` | **404** |
| `https://data.ncaa.com/casablanca/rankings/.../ranking.json` (several variants) | **404** |

Note: `data.ncaa.com/casablanca/scoreboard/.../scoreboard.json` **does work** for FCS scoreboards, but **not** for this rankings poll.

### 2. Does the page call an API?

**No** — for rankings data.

`casablanca_rankings/js/dist/rankings.min.js` only:

- Sticky table headers
- Client-side table sort
- Poll selector redirect (`window.location.href`)

No `fetch`, XHR, or rankings API calls in page JavaScript.

### 3. Is rankings data embedded in the HTML?

**Yes** — primary source.

The poll is a **static HTML table** in the page body:

```html
<table class="sticky">
  <thead><tr><th>RANK</th><th>SCHOOL</th><th>RECORD</th><th>POINTS</th><th>PREVIOUS</th></tr></thead>
  <tbody>...</tbody>
</table>
```

Metadata in page head:

- `turner_metadata.node_id`: `2917492`
- `article_modified_time`: poll update timestamp
- `<figure class="rankings-last-updated">`: e.g. "Through Games JAN. 5, 2026"

Schema.org JSON-LD describes the **page**, not structured team rows.

### 4. Is there another NCAA endpoint exposing the rankings?

**Not found** for Stats Perform FCS Top 25.

- Drupal JSON API blocked (403)
- Casablanca rankings paths return 404
- No embedded rankings array in `drupal-settings-json`

Third-party proxies (e.g. community `ncaa-api` projects) **scrape the same HTML** server-side and return JSON — they are **not official NCAA endpoints** and are unsuitable as a production dependency for a mobile app.

### 5. Can rankings be obtained reliably without HTML scraping?

**Not from the mobile client.**

| Approach | Reliable for production? |
|----------|------------------------|
| Direct HTML scrape in React Native | **No** — fragile, ToS risk, large payloads, no stable schema |
| Official NCAA JSON | **Not available** for this poll |
| `data.ncaa.com` Casablanca JSON | **Not available** for rankings |
| Server-side scrape + cache | **Yes** — recommended |
| Stats Perform commercial API | **Yes** — if licensed |

---

## Recommended retrieval method

```
┌─────────────┐     periodic fetch      ┌──────────────────┐
│  NCAA.com   │ ───────────────────────▶│ Rankings cache   │
│  (HTML)     │     server-side parse   │ (Worker / API)   │
└─────────────┘                         └────────┬─────────┘
                                                 │ JSON
                                                 ▼
                                        ┌──────────────────┐
                                        │ FCSFootball app  │
                                        │ ncaaRankings     │
                                        │ Provider         │
                                        └──────────────────┘
```

1. **Server** fetches `NCAA_FCS_TOP_25_URL` with a normal browser User-Agent
2. **Parse** the `.rankings-content table.sticky tbody tr` rows (or use a maintained scraper library server-side)
3. **Normalize** to `RankedTeam[]` + poll metadata
4. **Cache** response (CDN / KV) with TTL
5. **Mobile app** calls only your JSON endpoint — never NCAA HTML

Example proxy JSON shape (compatible with `mapNcaaRankingsProxyResponse` in `ncaaRankingsParser.ts`):

```json
{
  "pollName": "Stats Perform FCS Top 25",
  "updatedLabel": "Through Games JAN. 5, 2026",
  "seasonYear": 2025,
  "data": [
    { "RANK": "1", "SCHOOL": "Montana State (56)", "RECORD": "14-2", "POINTS": "1400", "PREVIOUS": "2" }
  ]
}
```

---

## Refresh strategy

| Period | Suggested TTL | Notes |
|--------|---------------|-------|
| In-season (Sep–Nov) | 30–60 minutes | Poll typically updates weekly |
| Post-championship / Jan | 24 hours | Final poll; rare changes |
| Offseason | 24 hours or manual | Last poll stands until next season |

**Trigger:** Refresh on Sunday evenings ET after FCS games complete; optional webhook/cron Monday morning.

---

## Poll publication schedule

- **Publisher:** Stats Perform (official FCS media poll on NCAA.com)
- **Frequency:** Weekly during the FCS regular season and playoffs
- **Typical release:** Sunday, after weekend games (similar to other NCAA polls)
- **Final poll:** After FCS championship (observed: updated through games Jan. 5, 2026)
- **Offseason:** Page shows last published poll until next season

---

## Risks if HTML scraping is required

| Risk | Impact |
|------|--------|
| Drupal markup changes | Parser breaks; empty or wrong ranks |
| Bot blocking / rate limits | 403, CAPTCHA, IP blocks on mobile clients |
| Large HTML (~190 KB) | Slow on cellular; wasteful for 25 rows |
| Terms of service | Scraping from app may violate NCAA.com policies |
| No team IDs | Name matching required to merge with ESPN games |
| Tie ranks (`T4`) | Parser must handle non-numeric rank labels |
| First-place votes in parens | `Montana State (56)` needs name normalization |

---

## Mobile app status (Phase 10)

- `ncaaRankingsProvider` remains a **stub** — throws `NcaaRankingsNotConnectedError`
- **Top 25** and **Rankings** production screens stay on **mock data**
- Developer screen shows this report + optional reachability probe (HTTP status only, no scrape)

---

## Long-term architecture

| Layer | Responsibility |
|-------|----------------|
| **NCAA.com** | Authoritative poll HTML (human-readable) |
| **Rankings cache service** | Fetch, parse, cache, expose JSON |
| **`ncaaRankingsProvider`** | Fetch cached JSON → `RankedTeam[]` |
| **`espnScoresProvider`** | Scores, schedule, TV, game IDs (unchanged) |
| **`mergeRankingsOntoGames`** | Attach NCAA ranks to ESPN games by normalized school name |

ESPN never supplies official FCS Top 25 rankings.
