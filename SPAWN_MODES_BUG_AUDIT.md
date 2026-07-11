# PondFront.io Spawn and Modes Bug Audit

Date: 2026-07-11

## 1. Territory existed before players chose a spawn

- Reproduction: Start any match and inspect ownership immediately.
- Root cause: `PondFrontServerGame.reset()` called `claimStart()` for every player.
- Files affected: `server.js`, `server/TileManager.js`.
- Fix: Map preparation now enters `SPAWN_SELECTION`; territory is created only by `SpawnManager.activateMatch()` after the final countdown.
- Regression test: `no economy before PLAYING`, `fallback match enters PLAYING`.

## 2. Gameplay systems ran before the match started

- Reproduction: Wait on the old loading/start transition and watch energy, objectives, bots, or events advance.
- Root cause: The main tick had no match-phase gate.
- Files affected: `server.js`, `server/EconomyManager.js`.
- Fix: Combat, economy, bots, objectives, events, missions, elimination, and win checks run only in `PLAYING`.
- Regression test: `normal actions blocked before PLAYING`, `spawn selection cannot end match`.

## 3. Two players could inherit conflicting automatic spawn indices

- Reproduction: Use several humans and bots on maps whose generated spawn list changes.
- Root cause: Team and player setup stored numeric spawn indexes without a live reservation check.
- Files affected: `server/SpawnManager.js`, `server/TeamManager.js`.
- Fix: Server reservations validate exact tile distance; the first reservation wins and the second receives an exact conflict reason.
- Regression test: `first overlapping reservation wins`, authenticated lobby API conflict test returned HTTP 400.

## 4. Blocked or trapped spawn locations were not authoritatively rejected

- Reproduction: Attempt to start on rock/land or in a disconnected canal.
- Root cause: Old starts trusted generated spawn points and had no per-request validation.
- Files affected: `server/SpawnManager.js`.
- Fix: Cached candidates require playable terrain, the largest connected water network, local expansion room, multiple directions, and objective clearance.
- Regression test: `blocked terrain rejected`, `normal bots receive separated valid spawns`.

## 5. Bot selection could become expensive on large maps

- Reproduction: Start Amazon/Mekong with 20 or more bots.
- Root cause: A naive implementation would rescan or pathfind the whole map for every bot.
- Files affected: `server/SpawnManager.js`.
- Fix: Main-water connectivity and candidate scores are generated once; bots select from sampled, cached candidates with controlled difficulty randomness.
- Regression test: `Amazon supports 20 bot spawns`; the full 34-check suite completes in under one second locally.

## 6. Co-op team spawn styles did not enforce their promise

- Reproduction: Pick Together and choose a location far from teammates, or let two starts overlap.
- Root cause: Team setup only assigned preferred indexes.
- Files affected: `server/SpawnManager.js`, `server/TeamManager.js`.
- Fix: Together/Nearby enforce a maximum teammate distance plus a non-overlap minimum; Spread Out increases minimum distance.
- Regression test: `Co-op Together spawns do not overlap`, `Co-op Spread Out enforces room`.

## 7. Match timer and events included spawn-selection time

- Reproduction: Spend 30-60 seconds choosing a start and inspect elapsed match time.
- Root cause: `startedAt` was set during reset.
- Files affected: `server.js`, `server/ObjectiveManager.js`, `server/EventManager.js`.
- Fix: `startedAt` is assigned only when PLAYING begins; objective and event schedules are reset at that moment.
- Regression test: `no economy before PLAYING`, `60 second timer is server synchronized`.

## 8. Modified private games could award normal progression

- Reproduction: Enable a private modifier, finish the match, and inspect XP/history.
- Root cause: Reward guards only recognized Sandbox Mode.
- Files affected: `server/ModifierManager.js`, `server/StatsManager.js`, `server/ProgressionManager.js`, `server.js`.
- Fix: Any accepted modifier marks the match modified and disables XP, achievements, badges, wins/losses, and standard match history. Public/ranked settings discard modifiers.
- Regression test: `shared energy blocked in public match`, `modified match disables progression`, authenticated API state confirmed progression disabled.

## 9. Rule modes could collide with the Classic win check

- Reproduction: Reach a mode score/territory target while several enemies remain.
- Root cause: Win logic only knew timer and elimination.
- Files affected: `server/GameModeManager.js`, `server.js`.
- Fix: Mode evaluation runs first and returns one authoritative reason; Classic continues to use elimination only.
- Regression test: Classic, Golden Lily, River Domination, Flood Survival, Pond Rush, and Last Nest win checks all pass.

## 10. River Domination could have no scoring objective on small maps

- Reproduction: Start River Domination on Small Pond.
- Root cause: The map's first objective set contained no River Gate/Current objective.
- Files affected: `server/GameModeManager.js`.
- Fix: Control modes guarantee at least one compatible objective before spawn candidates are generated.
- Regression test: `River Domination score win works`.

## 11. Mobile spawn UI reserved hidden action-bar space

- Reproduction: Open spawn selection at 390x844.
- Root cause: The game grid kept a 156px bottom row even while the action bar was hidden.
- Files affected: `public/style.css`, `public/index.html`, `public/ui.js`.
- Fix: Spawn phases use a zero-height action row, compact header, full-height map, safe-area bottom sheet, and separated zoom controls.
- Regression test: 390x844 browser check: map bottom 844px, sheet bottom 836px, no horizontal overflow.

## 12. Reconnect state could diverge between lobby and match players

- Reproduction: Disconnect/reconnect during spawn selection or gameplay.
- Root cause: Lobby connection flags were not mirrored to the match player.
- Files affected: `server/LobbyManager.js`.
- Fix: Valid sessions restore the existing match player and reservation; disconnect state is synchronized without creating a new player/core.
- Regression test: `spawn reconnect preserves reservation`, `match reconnect creates no duplicate`.
