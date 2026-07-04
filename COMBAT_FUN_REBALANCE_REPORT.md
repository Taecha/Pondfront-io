# PondFront.io Combat Fun Rebalance Report

## Rebalance Summary

- Quick Bite: 25% attacks are now useful because they can weaken a border instead of simply failing.
- Strong Push: 50% is now the recommended default attack size for normal front-line fighting.
- Full Wave: 75%+ is clearer as the commitment option for rolling through softened or weak fronts.
- Defense still matters, but stored defense and Turtle bonuses were lowered so attacks resolve faster and feel fairer.
- Defend now has a cap, cooldown, decay, and pressure-clearing effect, which makes it strategic instead of permanent stacking.

## Server Changes

- `shared/combatConfig.js`: softer capture formula, lower attack cooldown, and new `pressure` plus `attackStyles` config.
- `shared/balanceConfig.js`: lowered defensive stacking, added defend caps/cooldown/decay, increased attack power, softened attack costs.
- `server/CombatManager.js`: attack pressure, border weakening, defense decay, capped effective defense, better wave resistance messages.
- `server/BotManager.js`: easier bots defend less perfectly and make more defense mistakes.

## Client Changes

- Desktop bottom bar now includes Bite 25%, Push 50%, Wave 75%, and Max 100%.
- Mobile selected-tile card now shows compact attack buttons only when an enemy border is selected.
- Attack preview now shows weakened progress, remaining break cost, recommended action, and why a border is difficult.
- VFX now shows "Border Weakened" pulses, floating pressure numbers, and more useful wave-end notices.
- Help and tooltip copy now explains that blocked hits can still build pressure.

## Test Notes

- Syntax checks passed for touched server, client, and shared JavaScript files.
- Manual/API combat checks should verify:
  - 25% attack weakens or captures an exposed enemy border.
  - 50% attack captures normal borders more reliably.
  - Reinforced/Turtle borders can resist but show pressure progress.
  - Follow-up attacks are easier after pressure is applied.
