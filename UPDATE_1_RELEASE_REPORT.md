# PondFront.io Update 1 Release Report

Release date: 2026-07-14  
Public name: PondFront.io — Update 1  
Version: 1.0.0

## Systems Added

- Shared `releaseConfig` with current version, changelog categories, known issues, credits, rotating tips, viewed-state key, history list, and future labels such as Update 1.01.
- Launch presentation with Update 1 badge, logo mark, current map, current mode, version, server status, loading progress, and non-repeating session tips.
- Permanent Updates and Credits dialog in the lobby.
- Local unread/update-viewed state and New badge.
- Lobby utility navigation for Animals, Co-op, Achievements, Settings, Updates, Credits, and tutorial replay.
- Audio settings for Buildings, background audio, reduced sound mode, and quality.
- Randomized ambient ecosystem scheduler with time/weather-aware choices.
- Audio voice limiter with quality-aware caps and repeat cooldowns.
- Update 1 release regression test.

## Systems Improved

- Lobby background now includes lightweight leaves, fish shadows, bubbles, and a dragonfly alongside existing water motion.
- Animal comparison now exposes active ability cooldown, passive, terrain, weakness, role, difficulty, and playstyle.
- Animal selection triggers a short faction-specific sound.
- Expansion audio now separates small ripples from larger water-flow sends.
- Failed attacks use a retreating-water response instead of the same blocked sound.
- Buildings route through their own mixer category.
- Existing adaptive music retains lobby, early, mid, battle, final, victory, and defeat moods with smooth gain transitions.
- The first-match introduction now presents ten short steps and hands off to reactive coach hints.
- Tutorial completion can be reset from Settings or replayed from the lobby.
- README now documents the public game, real commands, architecture, modes, controls, deployment, testing, updates, bug reports, credits, and license state.

## Bugs Fixed

### Stale Public Version

- Problem: package metadata and public wording still identified the game as version 0.1.0 and a prototype.
- Cause: release identity was duplicated in static metadata and had never been promoted.
- Fix: added one shared release source, moved the package to 1.0.0, updated public wording, and exposed the same values through `/health`.
- Files: `package.json`, `shared/releaseConfig.js`, `server.js`, `public/index.html`, `README.md`.
- Test: Update 1 regression asserts package/config equality; browser verified Update 1 / v1.0.0 from live health.

### Lobby Settings Was Unreachable

- Problem: Settings existed only under the hidden game screen, so the lobby could not open it.
- Cause: the fixed dialog was nested inside a parent hidden during lobby state.
- Fix: promote the dialog to `document.body` and add a lobby Settings command.
- Files: `public/releaseUI.js`, `public/index.html`, `public/style.css`.
- Test: browser opened Settings from the lobby and found all visual, mobile, and audio controls.

### Tutorial Could Not Be Replayed Normally

- Problem: completion was saved, but players had no visible reset path.
- Cause: only the one-time close handler wrote tutorial state.
- Fix: added Replay Tutorial in the lobby and Reset Tutorial in Settings, restoring coach hints for the next match.
- Files: `public/index.html`, `public/ui.js`, `public/releaseUI.js`.
- Test: Update 1 regression checks both controls; browser verified the lobby route.

### Building Volume Did Not Match Playback

- Problem: the requested Buildings mixer did not exist and construction sounds followed Environment volume.
- Cause: build names were grouped with environmental sounds.
- Fix: added `buildingVolume`, routed build/upgrade/capture sounds to `building`, and connected the control to persisted settings.
- Files: `public/audioManager.js`, `public/ui.js`, `public/index.html`.
- Test: living-world and Update 1 tests assert the new channel and routing symbols.

### Effects Could Stack Too Loudly

- Problem: dense fights could schedule many overlapping logical sound events.
- Cause: per-name cooldowns existed, but there was no global voice ceiling.
- Fix: added active voice accounting and low/standard/high caps, lowered ambient frequency in reduced mode, and increased hover cooldown.
- Files: `public/audioManager.js`, `public/ui.js`.
- Test: static release regression verifies the voice limiter and settings; browser console remained clean through lobby and live match audio unlock.

### Health Response Lacked Release Identity

- Problem: the lobby could only infer that the server responded, not which release it served.
- Cause: `/health` returned only name and uptime.
- Fix: return version, update label, and release title from shared configuration.
- Files: `server.js`, `shared/releaseConfig.js`.
- Test: live response returned `1.0.0`, `Update 1`, and `Full Public Release`; HTTP security tests still passed.

## Balance Changes

No animal, economy, building, combat, special, bot, or mode balance constants changed in this release pass. Existing shared and server-authoritative values were preserved. The full gameplay QA simulation confirms all five abilities, building scaling, defense, diplomacy, attacks, surrender defaults, bot activity, and mode ending behavior.

## Sound Changes

### Environment

- Gentle water, reeds, birds, frogs, insects, crickets, bubbles, distant splashes, rain, and thunder moments.
- Randomized selection, pan, timing, volume variation, time-of-day choice, and weather choice.
- Lower ambient density in reduced mode and when audio quality is Low.

### Animals And Abilities

- Duck quack/flock-like chirps with splash texture.
- Snake hiss/reed texture and directional strike sweep.
- Frog croak/jump/landing character.
- Turtle low shell closure and protective pulse character.
- Carp bubbles/current/shimmer character.
- Distinct selection cues and existing ability event cues for all five factions.

### Expansion And Combat

- Small ripple/capture layer for normal expansion.
- Deeper water-flow layer for large committed expansion.
- Water crash, mud/noise texture, defense resistance, capture confirmation, and retreating-water failure cues.
- Existing spatial attenuation follows camera position and zoom for tile events.

### Buildings And UI

- Construction, completion, upgrade, conversion/capture, confirm, error, notification, ready, countdown, victory, and defeat identities.
- UI hover rate reduced to avoid rapid repetition.
- Mixer channels: Master, SFX, Music, Environment, Combat, Animals, Buildings, and UI.
- Mute, background audio, reduced sound, quality, pooling-style voice reuse limits, cooldowns, randomized variation, and smooth gain changes.

All bundled release sounds are generated by Web Audio and require no unlicensed audio assets.

## Lobby Changes

- Update 1 and live version/status presentation.
- Clear public release identity and lightweight living-pond background motion.
- Existing Solo, Create, Join, Practice, Sandbox, and How to Play actions retained.
- New compact navigation to Co-op setup, Animals, Achievements, Settings, Updates, Credits, and tutorial replay.
- Richer selected-animal comparison without adding long card copy.
- Mobile release dialog and utility buttons sized for touch.
- Unfinished game modes remain visibly Coming Soon and server-blocked.

## README Changes

The README was rewritten around verified behavior. It now covers the core loop, all five factions, buildings, combat and specials, active modes, desktop/mobile controls, server authority, persistence, local startup, environment variables, production hosting, tests, structure, update history, realistic roadmap, contribution guidance, bug reports, credits, and the current `UNLICENSED` status.

## Update 1 Notes

### New

- Full public release presentation and Update 1 identity
- Permanent in-game update notes and viewed-state badge
- Layered pond ambience with time, weather, and map-aware variation
- Distinct animal selection and ability sound identities
- Replayable first-match introduction and guided coach hints
- Release loading screen with server status and rotating tips

### Improved

- Lobby navigation, animal comparison, and connection feedback
- Territory expansion, combat, building, and result audio feedback
- Separate audio controls for environment, animals, combat, buildings, and UI
- Mobile settings, update notes, tutorial access, and responsive layout
- Large-map rendering, bot scheduling, and world-effect performance
- README, local setup guidance, architecture notes, and bug-report instructions

### Balance

- No gameplay balance values were changed for Update 1; verified rules remain shared and server-authoritative.

### Fixed

- Corrected stale package and interface version metadata that still identified the game as 0.1.0.
- Made the Settings dialog available from the lobby as well as during matches.
- Added a visible tutorial replay/reset path instead of requiring storage to be cleared.
- Separated building audio from environment volume so the mixer label matches actual playback.
- Limited simultaneous and rapidly repeated sounds to prevent loud effect stacking.
- Exposed release version and update identity through the server health response.

### Known Issues

- Google and Discord sign-in stay disabled until their server credentials and callback URLs are configured.
- The bundled audio is generated with Web Audio; projects wanting recorded wildlife samples must supply licensed assets.
- Local SQLite data persists on disk, but hosts with an ephemeral filesystem require a persistent disk or external database.
- Node.js 22 currently prints its standard ExperimentalWarning for the built-in SQLite API; persistence tests still pass.

## Files Changed

- Added: `shared/releaseConfig.js`
- Added: `public/releaseUI.js`
- Added: `scripts/updateOneReleaseTest.js`
- Added: `UPDATE_1_AUDIT.md`
- Added: `UPDATE_1_RELEASE_REPORT.md`
- Modified: `package.json`
- Modified: `server.js`
- Modified: `public/index.html`
- Modified: `public/style.css`
- Modified: `public/ui.js`
- Modified: `public/audioManager.js`
- Modified: `scripts/livingWorldTest.js`
- Rewritten: `README.md`
- Updated by stress test: `performance-release-results.json`

No gameplay manager or balance configuration was removed or rewritten.

## Testing Completed

- 86 JavaScript files passed syntax validation.
- Update 1, critical systems, mobile, release rules, lobby, account, startup security, spawn, spawn visibility, pointer, mode, OAuth, HTTP security, map, living-world, QA, and performance scripts passed.
- Browser tested the launch screen, live health/version, update viewed state, changelog, lobby Settings, animal selection, practice start, spawn reservation, spawn confirmation, countdown, live mobile HUD, and desktop responsive layout.
- Browser logs contained no errors or warnings.
- Mobile viewport had no horizontal overflow and its action dock remained inside all edges.
- Desktop columns did not overlap at 1440 x 900.

## Performance Results

Current 20-minute Amazon / 20-bot simulation:

- Average: 6.206 ms per tick
- p95: 10.204 ms
- p99: 12.201 ms
- Maximum: 19.705 ms
- Heap growth: 38.71 MB
- Retained events: 180 at the configured 180 cap

Compared with the immediately previous release checkpoint from the same stress test (8.21 ms average and 20.39 ms p99), the current run was faster in average and tail tick time. Heap readings vary between runs but remain well below the 96 MB release threshold.

## Release Decision

Update 1 passes the automated and interactive release gates used by this project. The local server is running at `http://localhost:5173/` with health metadata reporting Update 1 / 1.0.0.
