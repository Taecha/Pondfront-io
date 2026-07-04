# PondFront.io Sandbox Mode Report

## Summary

Added Sandbox Mode for testing animals, bots, economy, buildings, abilities, objectives, Current Push, and combat without affecting account progress.

Sandbox is server-authoritative. The client sends only sandbox intentions, and the server validates the current match, player, selected tile, target bot/player, action name, rules, cooldowns, map state, and ownership.

## Main Features Added

- Lobby `Sandbox Mode` button and setup screen.
- Sandbox setup options for map size, animal, bot count, bot difficulty, rules, and presets.
- In-game Sandbox badge showing stats are disabled.
- In-game Sandbox control panel for PC and mobile.
- Player tools: add/fill energy, set max energy, change animal, use/reset ability, toggle infinite energy and no cooldowns.
- Building tools: instant build, place buildings, upgrade selected building, remove selected building.
- Bot tools: spawn/remove bots, set behavior, pause/resume bots, passive/aggressive modes, force bot war.
- Combat tools: test border attacks, test Current Push, clear attacks, reinforce/clear border defense, combat/economy/ability debug toggles.
- Map tools: reveal/hide map, spawn/remove objectives, clear pings, reset map, pause/resume simulation, game speed.
- Sandbox cheat commands including `/energy`, `/fillenergy`, `/animal`, `/spawnbot`, `/clearbots`, `/objective`, `/nocooldowns`, `/instantbuild`, `/speed`, `/reveal`, and `/reset`.

## Safety / Progress Rules

- Sandbox matches are marked `statsDisabled`.
- Account wins/losses, XP, coins, achievements, and ranked progress are skipped.
- In-match progression XP and mission rewards are disabled in Sandbox Mode.
- Sandbox actions do not work in normal matches.
- Bot spawning now only claims neutral playable tiles, so spawning a test bot cannot overwrite existing player territory.

## Important Fixes

- Match starting no longer waits for browser audio unlock, so Sandbox/Solo start is not blocked by audio state.
- The game screen now switches before first state render, so hidden lobby/setup panels cannot trap a started match.
- Sandbox bot spawn was hardened to avoid overwriting owned tiles.

## Tests Run

- Syntax checks passed for:
  - `shared/sandboxConfig.js`
  - `server/SandboxManager.js`
  - `server/ProgressionManager.js`
  - `server/MissionManager.js`
  - `server/StatsManager.js`
  - `server.js`
  - `public/game.js`
  - `public/sandboxPanel.js`

- API test sweep passed:
  - Sandbox start
  - Add energy
  - Set max energy
  - Instant place Nest
  - Upgrade selected building
  - Spawn bot
  - Set bot difficulty/personality
  - Pause/resume bots
  - Set game speed
  - Pause/resume simulation
  - Spawn objective
  - Reset ability cooldown
  - Toggle combat debug
  - Test border attack

## Final API Verification

- Sandbox enabled: yes
- Stats disabled: yes
- Bot count setting can be `0`: yes
- Spawned bot count after tool test: `1`
- Built tile owner remained player-owned after bot spawn: yes
- Built tile: `nest`, level `2`
- XP after sandbox test actions: `0`
- Mission completions after sandbox test actions: `0`
- Active attack after combat test: `1`

