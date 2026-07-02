# PondFront.io Ability Audit

## Files Checked

- `shared/animals.js`: ability names, cooldowns, durations, player-facing perk text.
- `shared/gameConfig.js`: Duck open-water expansion cost modifier through `getNeutralTileExpansionCost`.
- `shared/balanceConfig.js`: shared ability multipliers and leap sizing.
- `server/CombatManager.js`: server-authoritative ability validation, effects, cooldowns, attack modifiers, Big Leap capture, debug logs.
- `server/BotManager.js`: bot ability decisions and development logs.
- `server/EconomyManager.js`: Duck temporary income while Flock Rush is active.
- `server/TileManager.js`: leap/border reach data used by abilities.
- `server.js`: action routing and snapshot ability status.
- `public/game.js`: client sends ability intent and optional selected tile target.
- `public/ui.js`: ability panel status, active duration, cooldown, tooltip text.
- `public/infoPanel.js`: ability explanations.
- `public/render.js` and `public/vfx.js`: ability activation and Ambush-used visuals.

## Current Ability Behavior

### Duck: Flock Rush

- Defined in `shared/animals.js`.
- Server stores active time in `player.abilityActiveUntil` and cooldown in `player.abilityReadyAt`.
- Real gameplay effect: for 10 seconds, Duck open-water neutral expansion cost uses `flockRushOpenWaterCostMultiplier` from `shared/balanceConfig.js`, currently `0.65`.
- Additional gameplay effect: `EconomyManager` gives Duck a small temporary income bonus while active.
- Visual effect: yellow/gold ability pulse through `public/vfx.js`.
- UI now shows the real modifier and active timer.

### Snake: Ambush

- Defined in `shared/animals.js`.
- Server sets `player.flags.ambushReady = true`, stores max duration in `abilityActiveUntil`, and cooldown in `abilityReadyAt`.
- Real gameplay effect: the next valid attack from a reed or mud source gets `x1.40` attack power.
- Real gameplay effect: that Ambush wave also reduces enemy border capture costs to `x0.80`.
- Ambush is consumed after one valid reed/mud attack and expires after 15 seconds if unused.
- Visual effect: green skill pulse on readiness and an `Ambush Used` attack arrow/pulse when consumed.

### Frog: Big Leap

- Defined in `shared/animals.js`.
- Server validates nearby neutral leap targets from Frog border tiles.
- Real gameplay effect: captures up to `frogBigLeapClusterSize` neutral tiles, currently `5`, within leap range.
- Frog can leap short gaps because reach does not require direct adjacency, but it never captures rock or enemy tiles.
- Optional selected target tile can bias the chosen cluster.
- Visual effect: frog/splash skill pulse and capture ripples.

## What Was Already Working

- All three abilities had server-side effects before this pass.
- Bots were already capable of using Duck, Snake, and Frog abilities.
- Cooldowns existed server-side.
- VFX existed for ability activation.

## What Was Fake Or Visual-Only

- None of the three abilities were purely visual.
- The unclear part was UI communication: it mostly showed cooldown numbers and vague perk text, not the actual gameplay modifier.

## What Was Broken Or Unclear

- Duck's Flock Rush only reduced water expansion by about 25%, not the requested 35%.
- Duck cooldown was 36s instead of the requested 45s.
- Snake Ambush cooldown/duration were 42s/12s instead of 50s/15s.
- Snake Ambush could stay ready past its intended duration because the attack modifier did not require `abilityActiveUntil`.
- Snake Ambush did not expose whether the wave got the bonus.
- Frog cooldown was 40s instead of 55s.
- Frog Big Leap returned only a count, not affected tile ids or clear gameplay metadata.
- Ability result objects did not include enough debug/status data.
- Bot ability decisions had no development-mode reason logs.

## Fixes Made

- Added shared balance constants for ability multipliers and Frog leap size/range.
- Updated cooldowns and perk text in `shared/animals.js`.
- Made Duck Flock Rush use `x0.65` open-water expansion cost.
- Made Snake Ambush expire after 15s, consume once, apply `x1.40` attack power, and apply `x0.80` enemy border capture cost.
- Made Frog Big Leap return affected tiles and optionally bias toward a selected target tile.
- Added server-side `abilityStatus` snapshots for UI.
- Added development-only `[ABILITY]` and `[bot-ability]` logs.
- Improved ability panel text, active state, cooldown state, and tooltip text.
- Added VFX for actual Ambush consumption, not only readiness.

