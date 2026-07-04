# PondFront.io Committed Frontline Attack Report

## Goal

Rework combat so a player commits Animal Energy once, then a server-authoritative wave pushes through connected enemy borders over time until the wave budget is spent.

## Implemented

- Player attack buttons now send one committed `attack` action instead of starting or stopping a continuous drain order.
- Bite 25%, Push 50%, Wave 75%, and Max 100% all create one server-side wave object.
- The server removes sent energy immediately and converts it into a usable attack pool with efficiency loss.
- Active waves now expose `sentEnergy`, `attackBudget`, `remainingBudget`, `frontierTiles`, `capturedTiles`, `weakenedTiles`, and `status`.
- Wave tick pacing is slower and clearer: 0.4s ticks with up to 2 captures per tick.
- Waves stop automatically when out of power, out of connected targets, stalled, or past max duration.
- Failed captures add weaken pressure to the target tile instead of feeling like nothing happened.
- Defender reinforcement still increases capture cost and removes pressure.
- Opposing waves can become `contested`; stronger waves continue while weaker waves lose power or spend out.
- PC/mobile labels no longer show Start Attack or Stop Attack.
- Active wave rendering shows remaining power or status like Stalled/Contested.
- VFX/audio now include committed wave launch, pushing text, contested pulse, border weakened, and wave spent feedback.

## Balance Notes

- Attack efficiency is 86%, so sending 100% is powerful but leaves the attacker vulnerable and does not convert perfectly into capture power.
- Terrain, defense energy, Reed Guard, Shell Guard, core defense, objectives, and stored defender energy still matter.
- Small attacks are useful for pressure, but reinforced borders can still stall them.
- Bots already use the same committed one-shot attack path through `expandOrAttack`.

## Tests

- Passed: 25% weak border test. Quick Bite committed 25 energy and produced `borderWeakened`, `waveResist`, and `waveEnd`.
- Passed: 50% multi-tile committed wave test. Strong Push remained active between ticks, captured 4 connected tiles, then ended automatically.
- Passed: 75% reinforced border test. Full Wave captured fewer tiles against a reinforced Turtle border and ended automatically.
- Passed: 100% max wave test. Max Wave spent the player's energy down to 0 and captured territory, leaving the attacker vulnerable.
- Passed: counter-attack contested wave test. Opposing server waves emitted `waveContested`, reduced power, and the weaker pressure spent out.
- Passed: live HTTP/API attack smoke test. Public `type: "attack"` returned `Frontline wave committed ...` and emitted committed wave capture/end events.
- Passed: syntax checks for touched server, shared, and client JavaScript files.
