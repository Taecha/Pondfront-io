# PondFront.io Balance Report

Date: 2026-07-02

## Current Read

PondFront.io is more playable than the earlier prototype. Expansion, economy, buildings, abilities, bots, map sizes, and win rules are functional. The biggest design issue is not broken mechanics; it is pacing pressure. The game can still reach timer endings without anyone controlling 70% of the pond, so future work should make objectives and late-game conflict more decisive.

## QA Simulation Result

`scripts/qaPlaytest.js` ran repeated 600 second all-bot matches on a small standard map after the bot update.

- Attacks: 204 to 253
- Wave captures: 30+
- Expansions: 850+
- Buildings: 55 in the full captured run
- Defenses: 600+
- Ability uses: 16 to 20
- Camps captured: 2 to 4
- Objectives captured: 1 to 2
- Active bot personalities: aggressive, defensive, expander, objectiveHunter, leaderHunter, betrayer, farmer

## Balance Findings

- Duck is still the easiest beginner animal because water expansion is efficient and Flock Rush is simple.
- Snake has a clear border identity after Ambush, but it depends on reed/mud positioning.
- Frog has the trickiest but most interesting mobility. Big Leap is useful and verified.
- Farming is useful without instantly taking over because Lily Farms require support, cost scaling, and activation time.
- Bots fight enough after this pass. 314 attacks in 600 simulated seconds is active, maybe even slightly noisy.
- Defending is common and useful, but the UI could better show when defense actually stopped an attack.

## Tuning Changes This Pass

- Reduced default bot attack energy threshold from 0.38 to 0.34.
- Added stronger Leader Hunter and Betrayer behavior.
- Added recent-attacker retaliation.
- Added active-objective pull scoring so bots expand toward objectives more reliably.
- Kept Farmer behavior less aggressive so bot personalities feel different.

## Next Balance Work

- Add stronger objective comeback and leader-pressure bonuses.
- Add late-game pond pressure after 70% is unlikely, such as shrinking safe water, objective surges, or higher attack power near the timer.
- Reduce defense spam if live play feels noisy.
- Add clearer player feedback for "this attack failed because defense was too high."
