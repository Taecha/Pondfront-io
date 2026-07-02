# PondFront.io Game Review Report

Date: 2026-07-02

## Test Coverage

- Ran server health and API checks.
- Ran `scripts/qaPlaytest.js`, including all map sizes, expansion, buildings, abilities, and a 600 second all-bot simulation.
- Reviewed lobby, animal selection, map readability, info panels, minimap, leaderboard, right-click menu, mobile CSS, and server-authoritative combat code.

## Bugs Found

- P1: Bot personalities did not match the promised set. The game still used `opportunist` and `peacefulFarmer`, which made reports and bot behavior harder to understand.
- P1: Bots did not explicitly remember who attacked them, so retaliation behavior was weaker than expected.
- P1: Client build highlighting could show invalid Lily Farm targets because it did not mirror the server's farm support and farm limit rules.
- P2: Defense events used wall-clock time in some server paths, which made simulation/debug timing inconsistent.
- P2: The first QA simulation incorrectly reset simulated time after objectives were scheduled; fixed in the test harness.

## Balance Problems

- Early game is readable and functional, but the player can still spend a lot of time expanding without immediate decisions.
- Mid game is much better after the bot update because bots now attack, defend, build, and use abilities more often.
- Late game can still end by timer with no 70% winner, especially on larger maps, so stronger late objectives or collapse pressure would help.
- Objectives are valuable, but players need clearer visual/notification pressure to care about them.

## Visual Problems

- Map readability is now mostly clean, but attack/frontline feedback can still be stronger.
- Building icons stay compact, which helps readability, but selected building effects could be more obvious.
- The lobby is polished enough; next visual gains should go into battle feedback, objective callouts, and winner/end-screen drama.

## Mobile Problems

- Previous mobile pass added pan, pinch, long press, double tap, minimap drag, quick action card, bottom sheets, and safe-area support.
- Remaining risk: physical-device pinch/long-press feel still needs real phone testing.
- The mobile build flow now better matches server validity rules.

## Bot Problems

- Fixed stale bot personality labels.
- Fixed weak retaliation by recording last attacker and attack pressure.
- Improved leader hunting and betrayal behavior.
- Added objective pull scoring so Objective Hunter and Frog bots expand toward active lake objectives.
- Bots now launch many attacks and use abilities in the 600 second simulation.

## Confusing UI

- Building rules were the most confusing: Lily Farm needs lily/nest support and a farm cap. The build sheet now explains these better.
- Ability UI is much clearer after the mobile target mode, but Frog Big Leap should eventually show a stronger map-wide preview.
- Objectives should get a clearer "why this matters" callout during the match.

## Fun Factor Notes

- Early game: satisfying but slightly routine after the first few expansions.
- Mid game: now active because bots attack and defend more.
- Late game: strategic but can become stalemate-heavy.
- Attacks: wave attacks work and are readable, but need punchier sound/visual feedback later.
- Abilities: useful and verified. Duck reduces water cost, Snake prepares Ambush, Frog captures leap clusters.
- Replay reason: animal differences, bot personalities, map sizes, and objectives.

## Priority Fix List

- P0: None found in this pass.
- P1: Bot personality mismatch, bot retaliation, client build validation.
- P2: Objective pressure, late-game stalemate reduction, better attack satisfaction.
- P3: Stronger attack/ability visuals and objective callouts.
- P4: More post-match stats, events, and animal mastery goals.
