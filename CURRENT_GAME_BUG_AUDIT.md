# PondFront.io Current Game Bug Audit

Date: 2026-07-11

## Result

No Critical bugs remained after this pass. Six High bugs and two Medium consistency bugs were reproduced and fixed. Server rules remain authoritative for spawn placement, ownership, economy, combat, cooldowns, persistence, and match ending.

## Fixed Bugs

### PF-SPAWN-001 - Claimed spawn areas were unclear
- Severity: High
- System: Spawn selection / rendering
- Reproduction: Start Practice and view bot spawns at fit-map zoom.
- Expected: Full start radius, minimum-distance boundary, animal, owner, and status are readable.
- Actual: Only a tiny animal badge and one small ring appeared.
- Root cause: Spawn snapshots omitted presentation-safe owner/radius metadata and `drawSpawnSelection` only drew a badge.
- Files changed: `server/SpawnManager.js`, `public/render.js`, `public/index.html`, `public/style.css`, `public/ui.js`.
- Fix applied: Added inner claimed zones, dotted separation rings, relation colors, confirmed/reserved states, labels, status panel, and legend.
- Regression result: Passed visible, team-only, hidden, bot, Amazon 20-bot, desktop DOM, and mobile DOM tests.

### PF-SPAWN-002 - Rings drifted during pan and zoom
- Severity: High
- System: Canvas camera
- Reproduction: Pan or zoom while spawn badges are visible.
- Expected: Markers remain attached to their map tiles.
- Actual: The old renderer converted an already screen-space tile center through `worldToScreen` a second time.
- Root cause: Double camera transform in `drawSpawnSelection`.
- Files changed: `public/render.js`.
- Fix applied: Exact tile centers now use one camera transform; masked zones use one explicit world transform.
- Regression result: Code inspection, fit-map, phone viewport, zoom/pan controls passed with no console errors.

### PF-SPAWN-003 - Old reservations could return after a newer update
- Severity: High
- System: Network synchronization
- Reproduction: Change a spawn while polling and an action response overlap.
- Expected: Release and reserve updates apply once in version order.
- Actual: Spawn snapshots had no version and the client merged every response.
- Root cause: No monotonic spawn revision or stale-delta guard.
- Files changed: `server/SpawnManager.js`, `server.js`, `public/game.js`.
- Fix applied: Added versioned reserve/release/confirm/reject events and client rejection of older spawn snapshots.
- Regression result: Change produces one marker at the new tile and advances release/reserve versions; passed.

### PF-SPAWN-004 - Hidden spawns could not explain unavailable water safely
- Severity: High
- System: Lobby privacy / spawn validation
- Reproduction: Enable secret spawns and inspect a reserved enemy area.
- Expected: Area remains unavailable without leaking enemy identity or exact center.
- Actual: The previous boolean removed the reservation entirely from the client.
- Root cause: `secretSpawns` filtered records instead of returning privacy-safe exclusion data.
- Files changed: `shared/spawnConfig.js`, `server/SpawnManager.js`, `server.js`, `server/LobbyManager.js`, `public/index.html`, `public/ui.js`.
- Fix applied: Added Visible, Team Only, and Hidden Until Start. Hidden mode sends masked zones and authoritative unavailable candidate IDs; events are sanitized per viewer.
- Regression result: Hidden marker has no tile, player, or animal; conflict still rejects without owner leakage; passed.

### PF-MOBILE-001 - Tapping a claimed zone attempted a new reservation
- Severity: High
- System: Mobile spawn controls
- Reproduction: On a 390x844 viewport, tap a bot's claimed center.
- Expected: Show owner, animal, and status without changing the player's spawn.
- Actual: The old handler treated every canvas tap as a reservation attempt.
- Root cause: No claimed-zone hit test before `spawnReserve`.
- Files changed: `public/game.js`, `public/ui.js`, `public/style.css`.
- Fix applied: Added claimed-zone inspection before reservation, a compact detail line, and server-backed unavailable handling.
- Regression result: Live tap on Snake Channel showed `Snake Channel | Snake | Confirmed`; player remained Choosing; passed.

### PF-UI-001 - Ready totals disagreed
- Severity: High
- System: Spawn HUD
- Reproduction: Start Practice with one player and four confirmed bots.
- Expected: Every spawn surface says 4/5 ready.
- Actual: Spawn Status said 4/5 while the compact top timer said 0/1.
- Root cause: The top timer still used legacy human-only counters.
- Files changed: `public/ui.js`.
- Fix applied: Every spawn surface now uses `readyCount / totalPlayers`.
- Regression result: Live desktop and mobile DOM both showed 4/5, then 5/5 after confirmation; passed.

### PF-API-001 - Practice spawn timer setting was discarded
- Severity: Medium
- System: Start API
- Reproduction: Start Practice with a requested 45-second spawn phase.
- Expected: Server starts at 45 seconds.
- Actual: `/api/start` omitted `spawnSelectionSeconds`, so the server used 20 seconds.
- Root cause: Missing request-field passthrough.
- Files changed: `public/ui.js`, `public/game.js`, `server.js`.
- Fix applied: Practice now requests 45 seconds and the API passes it into authoritative match settings.
- Regression result: Live mobile top timer and spawn banner both started at 45s; passed.

### PF-RENDER-001 - Own reserved center also looked available
- Severity: Medium
- System: Spawn map clarity
- Reproduction: Reserve a spawn and inspect its center.
- Expected: One yellow/player-colored claimed state.
- Actual: The generic teal candidate dot could remain under the own reservation.
- Root cause: Available-marker drawing excluded enemy unavailable IDs but not reservation centers.
- Files changed: `public/render.js`.
- Fix applied: Claimed centers are excluded from availability markers and low-zoom candidates are sampled for performance.
- Regression result: Static renderer audit and spawn tests passed.

## System Audit

| Area | Result | Verification |
| --- | --- | --- |
| Lobby create/join/ready/settings | Passed | Lobby sanitization and browser controls audited; visibility selector synchronized |
| Spawn selection | Passed | 50 total spawn/mode/visibility checks plus live PC/mobile tests |
| Amazon, Mekong, Everglades, Nile | Passed | Grid, blocker, terrain ratio, objective theme, and open-spawn checks |
| Expansion and attack waves | Passed | Partial progress, capture, frontline range, defense, alliance and truce QA |
| Bite/Push/Wave/Max and Current Push | Passed | Shared combat config and server validation QA |
| Specials and animal abilities | Passed | Server cost/cooldown/target rules and all five animal ability checks |
| Buildings and upgrades | Passed | Shared preview parity, construction time, scaling, upgrade, capture rules |
| Bots | Passed | 600-second simulation: 33 attacks, 59 abilities, 167 buildings; no crash |
| Objectives, events, Last Stand | Passed | Objective themes/scaling, event snapshots, collapse protection QA |
| Match ending | Passed | Classic animal winner and Co-op team winner; no 70% sudden win |
| UI and mobile | Passed | 1280x720 DOM and 390x844 bounds/interaction tests; no overlap found |
| Accounts and saving | Passed | Temporary SQLite restart test for signup, login, session, badge, achievements, stats, history |
| Performance and latency | Passed with residual risk | QA server tick 2ms and bot think 1ms; large-map canvas remains device-dependent |

## Commands

- `pnpm check`
- `node scripts/qaPlaytest.js`
- `node scripts/spawnModesTest.js`
- `node scripts/spawnVisibilityTest.js`
- `node scripts/accountPersistenceTest.js`

All completed without a failed assertion. Browser console errors: 0. Server crashes: 0.

## Residual Risk

The automated match-ending tests exercise complete authoritative start-to-win paths rather than waiting through two full real-time match timers. Canvas FPS still varies by device and map size; low-quality fallback remains active for slower mobile hardware.
