# Critical Systems Bug Audit

Date: 2026-07-12

## Scope and priority

Audited context actions, ability cooldown synchronization, password authentication, OAuth, cookies, session persistence, browser console, HTTP responses, server logs, and SQLite persistence. PondFront uses HTTP action deltas and polling rather than Socket.IO, so the equivalent action/event payload path was inspected.

## High: Context actions disagreed or disappeared

- Reproduction: right-click or hold the map, compare the menu with the mobile quick action and bottom bar.
- Expected: every surface uses the same ownership, terrain, diplomacy, targeting, cost, and cooldown rules.
- Actual: `public/game.js`, `public/ui.js`, and the mobile card independently decided which actions existed. Spawn right-click was explicitly blocked. Build choices were a flat duplicated list.
- Root cause: no shared action resolver; three client rule branches drifted apart.
- Files: `shared/actionConfig.js`, `public/contextMenu.js`, `public/game.js`, `public/ui.js`, `public/index.html`, `public/style.css`.
- Fix: added `PondActions.getAvailableTileActions()`, made desktop, mobile card, and bottom visibility consume it, enabled spawn actions, nested live build previews, kept disabled reasons visible, added touch bottom-sheet and swipe-down close.
- Result: PASS in resolver tests and live PC/mobile browser checks.

## High: Ability remained Ready after successful use

- Reproduction: use Flock Rush, Ambush, Big Leap, Shell Guard, or Golden Current after receiving a delta update.
- Expected: successful response immediately changes all ability UI to Active/Cooldown.
- Actual: a full snapshot had `abilityStatus`, but `playerDelta()` only sent `abilityReadyAt`. The client merged the timestamp into a player object that retained stale `abilityStatus.cooldownLeft = 0`; nullish fallback therefore kept Ready.
- Root cause: mixed relative and absolute cooldown fields in partial state.
- Files: `server.js`, `server/CombatManager.js`, `public/game.js`, `public/ui.js`, `shared/actionConfig.js`.
- Fix: action result and delta now include authoritative `cooldownEndsAt`, `abilityCooldownEndsAt`, and fresh `abilityStatus`; an `abilityCooldownState` event is emitted. The UI derives remaining time from the absolute timestamp and estimated server clock every 250ms.
- Result: PASS. Live Flock Rush changed to disabled `Cooldown: 29s` immediately; direct reconnect snapshot retained the same end timestamp. Rejected reuse did not restart cooldown.

## Critical audit: Authentication availability

- Reproduction: signup/login, refresh session, restart the database, run Google/Discord callbacks, and inspect missing-provider state.
- Expected: persistent account ID and profile, HttpOnly session, secure provider state, useful errors.
- Actual: core password and OAuth flows passed isolated tests. The remaining deployment/UI risks were `credentials: "same-origin"`, no Render environment declarations, permissive production fallback secret, and generic submit state/errors.
- Root cause: deployment configuration and browser wiring were weaker than the already-correct database/OAuth implementation.
- Files: `public/auth.js`, `server/AuthManager.js`, `server/OAuthManager.js`, `server.js`, `render.yaml`, `.env.example`.
- Fix: `credentials: "include"`, client validation/loading state, database/session error handling, safe diagnostics, production secret enforcement, trusted forwarded-origin handling, generated Render session secret, and explicit OAuth environment inputs. Existing scrypt hashes and all profile tables were preserved.
- Result: PASS locally: signup, invalid login, logout, session restore, database restart, profile/stats/badges/history persistence, OAuth state/PKCE, repeat-provider login, and same-profile provider linking.

## Deployment persistence limitation

The current Render service remains on the free plan. Render documents that free web-service files, including SQLite databases, are ephemeral and are lost on spin-down/redeploy. The app now documents `PONDFRONT_DB=/var/data/pondfront.db` for a paid service with a persistent disk. No paid plan was enabled automatically. Deployed persistence and real provider callbacks require configuring the exact public HTTPS URL and provider secrets, then testing that deployment.

## Residual result

The broad QA simulation passed all five animal ability checks and most gameplay checks, but one random ten-minute simulation produced no bot attacks. That pre-existing balance assertion is unrelated to these three fixes and is recorded rather than hidden.
