# PondFront.io Enhancement Review

Date: 2026-07-05

## Review Scope

Reviewed the current PondFront.io prototype through code inspection, health check, syntax checks, and the server-side QA playtest suite. The pass covered lobby/start flow, animals, expansion, buildings, abilities, diplomacy, bot pacing, special actions, mobile-oriented UI hooks, profile persistence, and win-condition stability.

## What Feels Good

- The core identity is clear: pond animals, Animal Energy, territory borders, and lake terrain all fit together.
- Server-authoritative managers are well separated: combat, economy, bots, diplomacy, objectives, specials, sandbox, teams, profiles, and achievements.
- Normal attacks are understandable: Bite, Push, Wave, and Max spend energy immediately and continue as committed waves.
- Construction time is visible in the data model and building effects wait until construction completes.
- Five animals now have distinct strategic roles.
- The lobby, account/profile layer, sandbox tools, and mobile action cards give the prototype a much more complete shape than a simple demo.

## What Felt Bad Or Risky

- Bot matches could become too quiet because weak bots were allowed to surrender without recent pressure.
- Bot behavior was not visible enough to the player; a selected bot did not clearly explain difficulty, personality, or relative strength.
- The first-match tutorial was helpful but too short for the newer systems, especially objectives and specials.
- Debug/performance information existed only indirectly through code and logs.
- Some balance values favored snowball systems: Lily Farms, Carp economy, Snake Ambush, and Lily Barrage all needed a small trim.
- A combat feedback message said "stored defense" instead of the clearer "stored defense energy."

## Confusing Parts

- New players may not know when to Expand, Attack, Defend, Build, or use Specials.
- "Current Push" and normal committed waves are different pacing systems, so the UI needs continual reminders.
- Bot difficulty and bot personality were hidden enough that bots could feel random instead of intentionally different.
- Debug mode was available through URL/local storage, but not discoverable through settings.

## Ugly Or Cluttered Parts

- The game already has many systems, so every new visible UI element has to stay compact.
- Large side panels can still compete with the map on small screens, though current collapse/tabs help.
- Settings had many visual/audio controls but lacked a clear "debug stats" toggle.

## Too Strong

- Carp economy could snowball from water/lily income and Golden Current.
- Lily Farm income could stack too quickly when a player already had strong territory.
- Snake Ambush was slightly too bursty for a committed-wave combat system.
- Lily Barrage could capture too many weak tiles for one long-range strike.

## Too Weak

- Bot midgame attack consistency was too low after prior fairness nerfs.
- Dragonfly Guard was useful but slightly expensive compared with its defensive role.
- New-player guidance did not yet explain objectives and specials enough.

## Bugs Found

- QA initially failed one wording expectation: Defend feedback did not explicitly say "defense energy."
- Bot simulations could fail with zero or too few normal attacks due to quiet surrender/build-heavy behavior.
- README still said Node.js 18+, but the account persistence layer now requires Node.js 22+.

## Top 10 Priority Fixes Applied

1. Added selected bot difficulty/personality/strength information.
2. Added compact coach hints for first-match gameplay clarity.
3. Added settings toggles for coach hints and debug stats.
4. Added live debug stats for FPS estimate, particles, active attacks, bot count, visible tiles, and server tick time.
5. Added real server tick timing to match snapshots.
6. Clarified Defend feedback as "stored defense energy."
7. Tightened bot surrender so quiet matches do not end before real pressure happens.
8. Added midgame bot skirmish pressure so bots fight more consistently.
9. Nerfed several snowball/burst values.
10. Updated README to match the real current prototype.
