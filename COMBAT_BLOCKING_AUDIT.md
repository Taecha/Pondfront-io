# PondFront.io Combat Blocking Audit

## What Was Making Attacks Feel Blocked

- The old attack preview and server cost formula stacked too many defensive layers at once: terrain defense, stored defense energy, defender energy, Turtle multipliers, buildings, and special bonuses.
- `defenseEnergy` was too efficient and could climb high enough that low and medium attacks looked like they did nothing.
- Failed attacks ended as "Blocked" without preserving enough visible progress, so players could not tell whether a weak attack helped.
- Bot defense behavior was too reliable, especially on Easy/Normal, which made enemy borders feel permanently reinforced.
- The UI only exposed generic attack percentage buttons, so players did not understand the difference between a small pressure attack and a commitment attack.
- Current Push and border attack feedback used old wording that made non-captures feel like total failure.

## Biggest Fixes

- Added attack pressure on enemy owned tiles. Failed or near-miss attacks now weaken the border and reduce future capture cost for a short time.
- Softened the defense formula and capped effective defense energy so reinforced borders are strong but not impossible.
- Reduced Turtle/Shell Guard/Reed Guard stacking so Turtle remains defensive without becoming untouchable.
- Reduced bot defense frequency and added bot defense mistake chances by difficulty.
- Added clear Bite/Push/Wave/Max attack styles to make send-size decisions easier.
- Updated combat previews, info panel facts, help text, and VFX to show pressure progress and remaining break cost.

## Remaining Risk

- Combat has many layered bonuses from objectives, core defense, lake events, and buildings. The client preview is intentionally approximate, while the server remains authoritative.
- Continuous attack can still feel strong if a player is far ahead in income. This is partly intended, but late-game tuning may need another playtest pass.
