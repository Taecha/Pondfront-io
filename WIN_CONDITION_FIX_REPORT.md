# Win Condition Fix Report

## Summary

PondFront.io now defaults to true elimination ending:

- FFA/Solo ends only when one active animal remains.
- Team modes end only when one active team remains.
- Sandbox does not auto-end by default.
- Timer is elapsed time only and does not force a timeout winner.
- 70% control is optional through `winCondition: "territoryControl"`.

## Core Code Changes

- `server.js`
  - Added `winCondition` to sanitized match settings.
  - Replaced old `checkWin()` with elimination/territory-control branching.
  - Added `isPlayerAlive`, `isTeamAlive`, `ownedTileCount`, and `hasOwnedCore`.
  - Added `winCheckState()` and `winDebug`.
  - Added `finalStatsSnapshot()` to match-ended event data.
  - Added centralized `eliminatePlayer()` cleanup.

- `server/EconomyManager.js`
  - Uses `game.eliminatePlayer()` when a player truly has no territory.

- `server/CombatManager.js`
  - Uses `game.eliminatePlayer()` after a defender loses all owned tiles.

- `server/CoreManager.js`
  - Uses `game.eliminatePlayer()` after Core Nest loss elimination.

- `shared/sandboxConfig.js`
  - Sandbox Elimination now defaults off.

- `public/index.html`, `public/helpMenu.js`, `public/infoPanel.js`, `public/ui.js`
  - Removed misleading default 70%/timer win text.
  - Added local win-check debug display.

## Test Results

Passed server-side simulations:

1. FFA with bots alive: match does not end.
2. Bot has only 1 tile left: bot is still alive.
3. Bot territory percent can be tiny/rounded to 0%: owned tile count still keeps bot alive.
4. Player controls 82% in elimination mode: match does not end while a bot has 1 tile.
5. Territory control optional mode: 70%+ can end only when `winCondition: "territoryControl"`.
6. All bots eliminated except player: match ends correctly.
7. Team mode with 2 teams alive: match does not end.
8. Team mode with 1 team alive: match ends correctly.
9. Sandbox mode with elimination off: match does not auto-end.

Also passed:

- `npm run check`
- No direct `defeated = true` assignments remain outside centralized elimination.
- No old `timeLeft() <= 0` or default 70% ending remains in elimination mode.
- Local server restarted on port `5173`.
- `/health` returned `200`.
- `/api/state` returned `ended=false`, `winMode=elimination`, and `More than one active animal remains`.
- Browser smoke opened a Solo Match; result screen stayed hidden while alive animals remained.

## Remaining Notes

The server remains authoritative. The browser only shows the result screen when the server snapshot has `ended: true` or when the server sends the confirmed `ended` event.
