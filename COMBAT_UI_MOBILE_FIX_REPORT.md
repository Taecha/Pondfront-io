# PondFront.io Combat UI Mobile Fix Report

Date: 2026-07-03

## What Changed

- Added shared border status logic in `shared/borderStatus.js` for weak, strong, reinforced, allied, truce, defended, blocked, and under-attack borders.
- Improved combat messages so expansion, weak attacks, blocked waves, and defending explain what happened in player-friendly terms.
- Added attack preview details to the selected tile panel: send energy, first-tile cost, risk, reinforced bonus, and likely expansion result.
- Added a subtle canvas border status overlay that highlights important borders without adding icons to every tile.
- Added a compact UI scale setting and default compact desktop layout while preserving mobile tap target size.
- Added mobile building management: upgrade, defend, and remove buildings from the mobile build sheet.
- Added server-side bot border contact memory, reaction delay, minimum attack spend checks, and longer attack cooldown pacing.
- Added development-only bot combat decision logging for attack/expand/ability decisions.

## Gameplay Fixes

- Bots no longer instantly attack the moment a new border appears. They scout briefly, then attack only if energy, personality, difficulty, and target strength make sense.
- Defending now clearly says that the border was reinforced and how much stored defense energy it has.
- Expansion feedback now tells players whether the selected send amount will finish the capture or how much energy is still needed.
- Reinforced enemy borders are easier to identify in the info panel and on the map.
- Mobile players can now upgrade and defend buildings without needing desktop right-click controls.

## Verification

- Ran JavaScript syntax checks on server and client files.
- Ran `scripts/qaPlaytest.js`.
- QA passed expansion, combat, diplomacy, abilities, buildings, bot pacing, map sizes, and 10-minute bot simulation checks.

## Notes

- The map stays cleaner by default: border status is shown as subtle outlines and hover/selection labels instead of repeated tile icons.
- The new UI scale control can be changed in the in-game view settings.
