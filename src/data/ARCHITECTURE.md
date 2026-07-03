# FCS Football — Data Architecture

## Source of truth by domain

| Domain | Provider | Source | Notes |
|--------|----------|--------|-------|
| **Top 25 / Rankings** | `ncaaRankingsProvider` | [NCAA Stats Perform FCS Top 25](https://www.ncaa.com/rankings/football/fcs/stats-perform-fcs-top-25) | Authoritative FCS poll. **Do not use ESPN for rankings.** |
| **Scores** | `espnScoresProvider` | ESPN college football scoreboard (FCS group) | Live/final scores, quarter/clock |
| **Schedule** | `espnScoresProvider` | ESPN scoreboard / events | Kickoff times, matchups |
| **Game status** | `espnScoresProvider` | ESPN | pre / in / post |
| **Broadcast / TV** | `espnScoresProvider` | ESPN | Network, streaming placeholders |
| **Game IDs & links** | `espnScoresProvider` | ESPN | ESPN event ID, watch/box score links |

## Why ESPN is not used for rankings

ESPN's general college football rankings and poll data are **not reliable** for the official FCS Top 25. Production Top 25 and Rankings screens must use NCAA Stats Perform data once connected.

## Future merge step

When both providers are live, ranked badges on scores/schedule/today screens will use **ranking merge logic** (`mergeRankingsOntoGames`):

1. Fetch Top 25 from `ncaaRankingsProvider`
2. Fetch games from `espnScoresProvider`
3. Match NCAA-ranked teams onto ESPN games by normalized school name (and aliases)
4. Attach `rank` to ESPN game team objects for display only — rankings data still originates from NCAA

## Current status (development)

- Production Top 25 / Rankings use **static JSON** in `src/data/static/fcsTop25.json` (manual weekly updates)
- `espnScoresProvider` — live on Today, Schedule; dev test on Developer → ESPN Data Test
- `ncaaRankingsProvider` — reads bundled static JSON (`fcsTop25.json`); not live NCAA fetch

### NCAA rankings (Phase 10)

Investigation confirmed NCAA.com serves Stats Perform FCS Top 25 as **server-rendered HTML** only. No reliable public JSON endpoint exists for the mobile app to consume directly.

**Next step:** Deploy a server-side rankings cache that parses NCAA HTML and exposes JSON. Wire `ncaaRankingsProvider` to that proxy URL. See `src/data/providers/NCAA_RANKINGS_INVESTIGATION.md`.
