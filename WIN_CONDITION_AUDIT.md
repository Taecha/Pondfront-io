# Win Condition Audit

## Places That Can End A Match

- `server.js`
  - `checkWin()` is the server-authoritative match-ending gate.
  - `end()` sets `ended`, stores winner ids, and sends the `ended` / `matchEnded` event data.
  - `surrenderPlayer()` can remove a player from the match, then `checkWin()` decides if the match is over.

- `server/EconomyManager.js`
  - Detects players with `0` territory and now calls `game.eliminatePlayer(...)`.
  - Does not decide the match winner.

- `server/CombatManager.js`
  - Detects a defender with `0` owned tiles after capture and now calls `game.eliminatePlayer(...)`.
  - Does not decide the match winner.

- `server/CoreManager.js`
  - Handles Core Nest loss and Last Stand.
  - Can eliminate a player through `game.eliminatePlayer(...)`, but does not directly end the match.

- `server/LobbyManager.js`
  - Ticks lobby matches and marks lobby status `ended` only after the match is already ended.

- Client files (`public/game.js`, `public/ui.js`)
  - Only display the server-confirmed `state.ended` and `ended` event.
  - They do not decide the winner locally.

## False Ending Cause

The old `server.js checkWin()` ended matches when:

- a player or team reached `config.WIN_CONTROL` (`70%`), even in normal elimination mode.
- `timeLeft() <= 0`, so the match could end from old timeout logic.

That conflicted with the current intended default rule: normal matches should end only when one animal/player/bot remains, and team matches only when one team remains.

## Fix

- Added `matchSettings.winCondition`.
- Default normal mode is now `elimination`.
- Optional `territoryControl` still supports the 70% rule when explicitly selected by settings.
- Sandbox uses `sandbox` win mode and does not auto-end unless Sandbox Elimination is enabled.
- Removed timeout ending from normal elimination mode.
- Added `isPlayerAlive(player)`.
- Added `isTeamAlive(team)`.
- Alive checks use owned tile count and Core Nest ownership, not rounded territory percent.
- Added centralized `eliminatePlayer(...)` cleanup for defeated players.
- Added `winDebug` snapshot data for local development.

## Important Result

A bot with even `1` owned tile is alive, even if its displayed territory percent rounds to `0%`.
