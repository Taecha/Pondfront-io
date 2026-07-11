# PondFront.io Game Mode Implementation Audit

Date: 2026-07-11

## Original State

The game exposed nine rule modes, but only partial rule fragments existed in `server/GameModeManager.js`.

| Mode | Previous state | Main problem |
| --- | --- | --- |
| Classic Elimination | Mostly implemented | Winner logic was duplicated in `server.js`. |
| Golden Lily Control | Partial | Only one control objective was guaranteed; global last-animal logic could still end the match. |
| Flood Survival | Label/partial | A timer increased a tide counter; there were no wave phases, Sanctuary loss, co-op enemy side, or survival bot gating. |
| Last Nest | Partial | Core capture existed, but global zero-territory and last-animal checks could override the Nest rules. |
| River Domination | Prototype label | Reused generic score/elimination behavior. |
| Pond Rush | Prototype label | Reused global timer/elimination behavior. |
| Migration | Prototype label | Added terrain changes but retained Classic victory. |
| Animal King | Prototype label | Added a King flag but retained global fallback paths. |
| Peaceful Expansion | Prototype label | Only delayed combat; victory remained Classic. |

## Global Classic Fallbacks Found

- `server.js checkWin()` ran last-player and last-team elimination after every mode handler returned no winner.
- `server.js checkWin()` used territory as the generic timer winner for every mode.
- `server.js winCheckState()` described every match as last animal/team standing.
- `server.js end()` always announced the last animal/team standing.
- `server/CombatManager.js` eliminated any defender with zero territory without consulting the active mode.
- `server/CoreManager.js` used one global opening protection timer instead of per-Nest protection state.
- `server/BotManager.js` used the same FFA diplomacy and territory priorities for every mode.
- `public/ui.js` only mentioned the mode in a settings summary and always used last-standing result text.

## Authoritative Fix

Every match now owns exactly one validated `game.modeRules` object. It includes:

- mode identity, name, objective, and win-condition type
- elimination and respawn behavior
- Core, objective, scoring, event, overtime, bot, duration, and progression rules
- validated Golden Lily score target, Flood wave count, and Last Nest protection time

`GameModeManager.evaluateWin()` is now the only normal match winner dispatcher. It delegates to:

- `checkClassicEliminationWin()`
- `checkGoldenLilyControlWin()`
- `checkFloodSurvivalWin()`
- `checkLastNestWin()`

Invalid or unfinished mode IDs are rejected. They never silently become Classic.

## Implemented Modes

### Classic Elimination

- Solo and team last-standing victory.
- Standard territory, objectives, diplomacy, and combat.
- No Lily score, Flood wave, or Nest-only win path.

### Golden Lily Control

- Generates 3-7 Golden Lily zones from map size.
- Scores each held Lily every two seconds; the central Lily is worth two points.
- Supports 250, 500, and 750 point targets.
- Supports contested-control overtime and time-limit score resolution.
- Does not end because only one animal remains.

### Flood Survival

- Forces all humans onto one defender team and all bots onto one enemy wave team.
- Uses preparation, active wave, recovery, elite, and final-wave phases.
- Gates bot activity to the current wave and disables FFA bot diplomacy.
- Tracks enemies, countdown, Sanctuary health, recovery energy, and waves.
- Wins after all waves; loses on Sanctuary loss or all-defender elimination.
- Disables unrelated random lake events and Classic Final Tide logic.

### Last Nest

- Uses stronger Core Nests with configurable 60/75/90 second protection.
- Ends protection early when the protected owner attacks another Nest.
- Keeps an owner active while its Nest survives and provides small recovery near an isolated Nest.
- Wins only when one Core Nest owner/team remains.

## Unfinished Modes

River Domination, Pond Rush, Migration, Animal King, and Peaceful Expansion are disabled and labeled `Coming Soon` in all three rule selectors. Server validation rejects direct attempts to start them.

## Files Changed

- `shared/gameModeConfig.js`
- `server/GameModeManager.js`
- `server.js`
- `server/TeamManager.js`
- `server/BotManager.js`
- `server/CombatManager.js`
- `server/CoreManager.js`
- `server/LobbyManager.js`
- `server/SpawnManager.js`
- `public/index.html`
- `public/style.css`
- `public/game.js`
- `public/ui.js`
- `scripts/spawnModesTest.js`
- `scripts/realGameModesTest.js`
- `package.json`

