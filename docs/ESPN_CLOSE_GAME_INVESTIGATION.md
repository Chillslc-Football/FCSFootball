# ESPN Close-Game Signal Investigation (Phase 1)

Investigation date: July 2026

## Summary

**No explicit ESPN close-game alert field was found** in the public endpoints inspected. Close-game push notifications are **deferred** in the initial implementation. The `close_game_enabled` preference is stored but the Edge Function does not emit close-game alerts until a verified ESPN signal is available.

## Endpoints inspected

| Endpoint | Result |
|----------|--------|
| `site.api.espn.com/.../scoreboard` | No `closeGame`, `isClose`, `competitive`, or `situation.close` fields on events or competitions |
| `site.api.espn.com/.../summary?event={id}` | No close-game boolean or enum; `situation` absent on completed games |
| `cdn.espn.com/core/college-football/game?xhr=1&gameId={id}` | No close-game field; only `analytics.omniture.gameState` (pre/in/post) |
| `sports.core.api.espn.com/.../plays` | Period markers only (`End Period`, `End of Half`, `End of Game`) |

Sample event IDs: `401673471`, `401628538`, `401635614` (FCS/FBS completed games, Nov 2024).

## Fields searched

`close`, `closeGame`, `competitive`, `clutch`, `gameState`, `situation`, `probability`, `excitement`, `leverage`, `featured`, `alert`

Matches for `alert` referred to **video alert deep links** (`links.mobile.alert`), not game competitiveness.

## Closest ESPN-provided metrics (not implemented as close-game)

### Win probability (`summary.winprobability[]`)

- Array of `{ homeWinPercentage, tiePercentage, playId }` entries tied to plays
- Could indicate a tight game when `homeWinPercentage` is near 0.5
- **Not** an official close-game flag; not used for notifications per project requirements

### Scoreboard status

- `status.period`, `status.displayClock`, `status.type.state`, `status.type.name`
- Useful for period milestones, not close-game designation

## FCS availability

Scoreboard and summary responses were verified for FCS games (`groups=81`). No close-game-specific field appeared for FCS or FBS samples.

## Live-game behavior

Could not verify live close-game toggling during investigation (off-season). No documentation found tying a public JSON field to ESPN app “close game” push alerts.

## Recommendation

1. **Defer** close-game notifications in `poll-espn-games` (log when preference enabled but signal unavailable).
2. Re-investigate during live season with in-progress scoreboard + CDN game package snapshots.
3. If ESPN adds or documents a field, wire `{eventId}:close-game` dedupe to that signal only.
4. Do **not** substitute score-margin heuristics without explicit approval.

## Implemented notification types

| Type | Status |
|------|--------|
| Game start | Implemented |
| Scoring plays | Implemented |
| End of Q1 | Implemented |
| Halftime | Implemented |
| End of Q3 | Implemented |
| Close game | **Deferred** |
| Final | Implemented |
