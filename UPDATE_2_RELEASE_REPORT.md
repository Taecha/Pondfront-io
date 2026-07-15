# PondFront.io Update 2 Release Report

Release: PondFront.io 2.0.0  
Title: The Great Lake Update  
Status: Ready for local play and deployment configuration

## Changelog

### New

- Shared five-step energy commands: 10%, 25%, 50%, 75%, and 100%.
- Probe 10% for low-risk frontline pressure.
- Exact shared defense previews with cost, stored defense, cooldown, and blocked reason.
- Update 2 release history, metadata, health response, and release reports.

### Improved

- Expand, attack, reinforce, support, Current Push, build, and special context actions now refresh from live state.
- Desktop HUD, right-click menu, mobile attack selector, and long-press sheet expose matching commands.
- Action hints show committed energy and estimated resistance without revealing hidden information or promising uncertain captures.
- Double-click performs Expand, Reinforce, or Attack when the selected tile has a valid action.
- Mobile Settings, portrait/landscape HUD, touch dock, safe areas, and responsive sheets were browser-verified.

### Fixed

- Missing 75% contextual send.
- 75% client defense preview versus 78% server defense spend.
- Fractional server deductions versus integer UI labels.
- Support minimum 8 in UI versus 6 on server.
- Expansion/attack preflight minimum drift.
- Arbitrary modified-client percentages.
- Missing Probe button on desktop/mobile selectors.
- Stale 84x54 lobby statistic.
- Stale living-world regression assertion.

## Changed Files

- Shared rules: `shared/combatConfig.js`, `shared/actionConfig.js`, `shared/releaseConfig.js`
- Server authority: `server.js`, `server/CombatManager.js`, `server/SupportManager.js`
- Client: `public/index.html`, `public/style.css`, `public/game.js`, `public/ui.js`, `public/mobileControls.js`
- Tests: `scripts/updateTwoGreatLakeTest.js`, critical/mobile/settings/living-world/release regressions
- Release metadata/docs: `package.json`, `README.md`, and the five Update 2 reports

## Test Summary

- Package syntax check: passed.
- Update 2 contract: 22 checks passed.
- Full QA playtest: passed after seeding legal front lines to remove random spawn-distance flakiness; the 600-second run produced 96 attacks with no failed checks.
- Critical systems: 10 checks passed.
- Mobile-first: 22 checks passed across seven pointer sizes.
- Full gameplay/map/balance playtest: passed.
- Spawn/modes: 34 checks passed.
- Spawn visibility: 16 checks passed.
- Pointer/spawn maps: 45 checks passed.
- Active game modes: 31 checks passed.
- Lobby integration: 15 checks passed.
- Release rules: 21 checks passed.
- Account persistence: 10 checks passed.
- OAuth security: passed all provider, PKCE, replay, linking, and storage checks.
- Startup security: 5 checks passed.
- HTTP security: 6 checks passed with clean stderr.
- Map connectivity metrics: Amazon, Mekong, Everglades, and Nile passed.
- Settings/graphics: Low 34 particles versus Ultra 380; live settings wiring passed.
- Stability: 1,200 seconds and 20 Amazon bots passed at 4.522 ms average tick.
- Browser QA: desktop, tablet, portrait, and landscape passed; console errors: 0.
- Live desktop double-click expansion changed energy from 137/137 to 105/139 and started authoritative growth.

## Known Remaining Issues

- Coming Soon modes remain disabled until they have distinct complete server handlers.
- OAuth is unavailable until deployment credentials are configured.
- Free Render wake-up delay can affect the first request after inactivity.
- Durable deployed profiles require persistent database storage.
- The generated Web Audio soundscape uses synthesized sounds rather than licensed recordings.

## Deployment Notes

1. Use Node.js 22 or newer.
2. Set `SESSION_SECRET` in production.
3. Run `node server.js`; Render should use `npm start`.
4. Mount persistent storage for the SQLite database or configure durable external storage.
5. Verify `/health` returns version `2.0.0`, update `Update 2`, and release `The Great Lake Update`.

Local release URL: `http://localhost:5173/`
