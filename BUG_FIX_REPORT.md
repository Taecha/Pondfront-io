# PondFront.io Bug Fix Report

Date: 2026-07-02

## Fixed

- Bot personalities now use the intended readable set: Aggressive, Defensive, Expander, Objective Hunter, Leader Hunter, Betrayer, and Farmer.
- Bots now remember recent attackers through `lastAttackerId` and `underAttackUntil`, allowing retaliation behavior.
- Bot combat decisions now give Leader Hunters and Betrayers stronger reasons to attack high-threat targets.
- Farmers now attack less often, but still participate when needed.
- Objective Hunter and Frog bots now value expansion paths toward active objectives, not only objective tiles already touching their borders.
- Defense events now use the game clock when called from server or bot logic, improving simulation reliability.
- Mobile/client building validation now checks energy, Lily Farm support, and Lily Farm limit before showing valid build targets.
- Build sheet now explains unavailable reasons such as farm cap, occupied tile, wrong terrain, animal lock, and missing lily/nest support.
- QA harness now keeps simulated time aligned with objective spawn time.

## Verified Existing Mechanics

- Partial expansion stores progress.
- Enough energy captures neutral tiles.
- Attacking allies is blocked server-side.
- Wave attack spreads only through connected enemy territory.
- Nest increases max energy.
- Lily Farm increases income after activation.
- Reed Guard defense is applied through combat defense bonuses.
- Duck Flock Rush reduces open-water expansion cost.
- Snake Ambush prepares the next reed/mud attack.
- Frog Big Leap captures nearby neutral tiles.
- Map sizes correctly change grid, bot count, objectives, and camps.

## Not Fixed Yet

- Objectives need stronger player-facing pressure and better late-game importance.
- Physical-device mobile gestures still need real-phone validation.
- Attack visuals could better communicate exact captured tiles and resisted tiles.

## Files Changed

- `server.js`
- `server/BotManager.js`
- `server/CombatManager.js`
- `shared/balanceConfig.js`
- `public/game.js`
- `public/ui.js`
- `scripts/qaPlaytest.js`
