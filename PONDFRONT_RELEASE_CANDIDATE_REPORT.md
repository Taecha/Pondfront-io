# PondFront.io Release Candidate Report

Date: 2026-07-12

## 1. Executive Summary

The local PondFront.io candidate is substantially more stable and passes the completed gameplay, account, lobby, mode, map, mobile, security, and accelerated stability suites. The overall release recommendation is **Not ready** for a public deployed account release because the current Render service is stale and its free-plan filesystem does not provide durable SQLite persistence.

No new gameplay feature was introduced during this pass. Work was limited to root-cause reliability, security, networking, reconnect, logging, validation, tests, and release evidence.

## 2. Critical Bugs Fixed

- A disconnected player with valid territory/Core could be treated as dead and trigger an early ending. Alive state now depends on authoritative game state, with reconnect handled separately.
- Replayed client actions could spend energy or start cooldowns twice. The server now returns a bounded cached receipt for duplicate `clientActionId` values.
- Rejoining an authenticated lobby could create a duplicate member. The existing member/session is now restored.
- Refreshing the waiting room lost the local lobby UI. The client now restores only after server validation.
- Production could start with an unsafe default session secret. It now fails with a clear configuration error.

## 3. High-Priority Fixes

- Mutating APIs now enforce same-origin requests and auth endpoints are rate limited.
- HTTP, tick, bot/timer, rejection, and fatal-process boundaries now log controlled diagnostics.
- Production log spam is gated behind development flags.
- Large JSON state responses negotiate gzip; minor updates retain the existing delta path.
- Active map/mode configuration is validated at startup.
- Security headers and hardened production cookie behavior are integration tested.

## 4. Medium/Low Fixes

- Match-end and elimination development logs now include mode/reason/state without production noise.
- Test coverage now includes lobby authorization/reconnect, startup configuration, release rules, HTTP security, map connectivity, and accelerated long-run stability.
- Release documentation distinguishes implemented modes from Coming Soon entries and local behavior from the deployed build.

## 5. Performance

| Measurement | Result |
| --- | --- |
| Local full-state JSON | 2,335,677 bytes uncompressed |
| Local full-state gzip | about 63,711 bytes, about 97.3% smaller |
| Immediate delta | 5,900 bytes, about 2.82 ms local request |
| Accelerated stability | 4,800 ticks representing 20 game minutes |
| Server tick | 10.181 ms average, 13.455 ms p95, 14.907 ms p99, 30.75 ms max |
| Heap growth | 11.08 MB during accelerated run |
| Retained events | 180, exactly at configured cap |

The stability run included 20 bots, 2,137 expansions, 273 attacks, 774 builds, 1,875 defenses, 558 specials, and 619 captures. These are server measurements, not browser FPS measurements. A physical-device 20-minute FPS/1%-low capture was not available.

## 6. Security Changes

Production secret validation, hardened cookies, hashed session storage, same-origin mutation checks, auth throttling, baseline headers, server-derived actor identity, replay idempotency, prepared statements, OAuth state/PKCE, reward eligibility validation, and safe error boundaries are verified. See `SECURITY_FINAL_REPORT.md`.

## 7. Authentication Status

Username/password, sessions, profile reload, achievements, badges, selected cosmetics, statistics, and history pass isolated local persistence tests. Google/Discord code passes configuration/security tests but cannot complete live provider callbacks until credentials are supplied.

## 8. Database/Persistence Status

Local SQLite reopen/restart tests pass and no saved records or migrations were deleted. Render is configured on the free plan with no persistent disk, which means deployed account data is not durable enough for release.

## 9. Game Mode Status

Classic Elimination, Golden Lily Control, Flood Survival, and Last Nest each pass distinct authoritative initialization, HUD-state, and win/loss tests. Five unfinished modes are visibly Coming Soon and server-blocked.

## 10. Desktop and Mobile Status

Local desktop passed at 1440x900. Local responsive checks passed at 360x640, 390x844, 412x915, 640x360, 844x390, 768x1024, and 1024x768 with no page overflow or dock clipping. Desktop context actions stayed within the viewport. The Render homepage fits mobile, but its current assets do not match the release candidate and the current mobile touch bundle/dock is missing there.

## 11. Known Limitations

- Render is serving stale `index.html`, `game.js`, `ui.js`, and `style.css`; `mobileControls.js` is missing/404 in the observed deployment.
- Render SQLite persistence is ephemeral on the current plan.
- Live Google and Discord callbacks are externally blocked.
- Transport is HTTP polling/full-state plus deltas, not Socket.IO; documentation records the actual architecture.
- No strict CSP is enabled yet because dynamic inline styling requires a deliberate nonce/hash migration.
- No destructive security testing was performed against production.
- Full mode paths and the 20-minute stability scenario were deterministic accelerated simulations, not four public wall-clock matches.

## 12. External Setup Required

1. Deploy this exact release-candidate source to Render.
2. Add a persistent Render disk or migrate SQLite data to a managed durable database.
3. Set `SESSION_SECRET` and verify HTTPS/proxy environment.
4. Configure Google/Discord credentials and exact callback URLs if those login buttons will be enabled.
5. Re-run the Render regression subset and one real mobile/desktop multiplayer match after deployment.

## 13. Files Changed in This Pass

- `server.js`
- `server/LobbyManager.js`
- `server/TileManager.js`
- `public/game.js`
- `package.json`
- New scripts under `scripts/` for lobby, startup/security, release rules, HTTP security, map metrics, and stability.
- Release checkpoint, metric JSON, and final audit Markdown reports.

## 14. Tests Run

- Syntax checks over server/shared/public/test JavaScript.
- Existing mobile, critical-system, spawn, pointer, real-mode, account, OAuth, QA playtest, and balance suites.
- New lobby integration: 15 checks.
- New HTTP production-security integration: 6 checks.
- New game-mode suite: 31 checks.
- New release rules: 21 checks.
- Map connectivity/spawn metrics across Amazon, Mekong, Everglades, and Nile.
- 600-second QA simulation and accelerated 20-minute/20-bot stability simulation.
- Live local browser checks across desktop, phone, landscape, and tablet viewports.
- Non-destructive Render health, asset, provider-status, and responsive-home checks.

## 15. Release Recommendation

**Not ready** for public deployment today.

The code in the local release candidate is ready for a controlled staging deployment, but durable account storage and deployment parity are release blockers. After those are corrected, the Render regression subset must pass before changing the recommendation to Ready with known limitations.
