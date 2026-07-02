# PondFront.io Balance Report

Date: 2026-07-02

## Summary

This pass tuned PondFront.io toward longer, more strategic matches. The main goal was to reduce fast farming/snowballing and make bots fight more like real opponents after the opening expansion phase.

## Major Changes

- Added `shared/balanceConfig.js` so pacing numbers are easy to tune.
- Increased neutral expansion cost with territory size, distance from core, enemy-border pressure, and strategic terrain.
- Slowed income and max-energy growth from territory.
- Added a recovery income bonus for small players.
- Added Lily Farm dynamic cost, territory-based farm limit, nearby lily/nest support requirement, and 20-second activation delay.
- Reduced Lily Farm income from the previous immediate large boost to a slower +1.0/s style economy upgrade.
- Added bot personalities: expander, aggressive, defensive, opportunist, and betrayer.
- Added bot phases: early, mid, late, and surge.
- Added leader pressure so bots value attacks against high-threat leaders.
- Added bot attack cooldowns and war exhaustion to reduce endless tiny attack spam.
- Made defending more meaningful by improving defense energy gained per spend.
- Exported the server game class and added `scripts/simulateBalance.js` for accelerated bot simulations.

## Simulation Results

Quick accelerated sample after tuning: 5 bot-only matches.

- Average match duration: `1200s`
- Average winner territory: `20.04%`
- Average attacks per match: `1148.6`
- Average wave captures per match: `888`
- Average builds per match: `200.4`
- Average Lily Farms alive at end: `8`
- Average active-player income: `11.01/s`

Interpretation:

- Matches now reliably last to the timer instead of ending from fast expansion.
- Bots attack much more than before and pressure borders throughout the match.
- Farming exists, but the delayed activation and farm cap stop it from becoming an immediate runaway.
- Current tuning may now lean slightly toward long stalemates, so future passes should add objective zones or late-game pressure to help convert conflict into wins.

## Files Changed

- `shared/balanceConfig.js`
- `shared/gameConfig.js`
- `server.js`
- `server/TileManager.js`
- `server/EconomyManager.js`
- `server/CombatManager.js`
- `server/BotManager.js`
- `public/index.html`
- `public/game.js`
- `public/infoPanel.js`
- `scripts/simulateBalance.js`

## Verification

- Browser reload succeeded with no console errors.
- Browser match start succeeded with map canvas and UI visible.
- Duck, Snake, and Frog server starts all initialized cleanly.
- Syntax checks passed for touched server, shared, public, and simulation files.
- `/api/state` responded successfully after restart.

## Next Balance Ideas

- Add objective zones that activate at 2, 4, 6, and 8 minutes.
- Increase late-game capture pressure if too many matches end by timer.
- Add visible contested-border warnings.
- Make alliances react more strongly to threat score.
- Add a detailed match telemetry screen for attack waves, captures, and economy timings.
