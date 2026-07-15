# PondFront.io Update 2 Audit

Release: 2.0.0 - The Great Lake Update  
Date: 2026-07-15

## Outcome

No open critical or high-severity defect was found after the fixes and regression pass. Ownership, economy, combat, diplomacy, bots, cooldowns, construction, objectives, and victory remain server-authoritative.

## Fixed Findings

| Severity | Finding and reproduction | Root cause | Fix | Verification |
| --- | --- | --- | --- | --- |
| High | Right-click and long-press offered 10/25/50/100 while the HUD offered 10/25/50/75/100. | `actionConfig` maintained a separate four-item table. | Added one shared five-profile table in `combatConfig`; all contextual actions derive from it. | Update 2, critical systems, mobile, and browser context-menu tests pass. |
| High | Defend could display 75% efficiency while the server deducted 78%. | Three client views duplicated an obsolete `0.75` multiplier. | Added shared `defendPreview`; HUD, coach, build sheet, context menu, and server use it. | A 25% action at 100 energy previews and authoritatively records 20 energy. |
| High | UI showed integer sends while combat and support could spend fractions. | Server percent calculations retained floating-point energy while UI rounded. | Added shared rounded `energyForPercent`; combat, expansion, defense, and support use it. | Update 2 authoritative energy accounting test passes. |
| High | A modified client could submit arbitrary percentages such as 33%. | Server clamped the value but did not restrict the public action contract. | Server now accepts only 10/25/50/75/100 for player intents. Bot internals remain independently paced. | Unsupported 33% is rejected without spending energy. |
| High | Client preflight used expansion/attack minimums of 4/4 while server used 1/5. | Old literals remained in `game.js`. | Client reads `minimumExpansionEnergy`, `minimumAttackEnergy`, and Current Push minimum from shared combat state. | Syntax, Update 2, and full gameplay tests pass. |
| High | Ally support menu required 8 energy while the server required 6. | Client-only literal drifted from balance config. | Menu now reads support minimum and efficiency from the server snapshot. | Critical systems and shared action tests pass. |
| Medium | The lobby advertised an obsolete 84x54 map while Medium is 90x54. | Static launch statistic was not tied to map selection. | Replaced the stale dimension with the stable `Server authority` capability. | Desktop and mobile lobby snapshots show no conflicting size. |
| Medium | Mobile and desktop attack style selectors omitted Probe in one surface. | Separate static four-column selectors. | Added Probe 10% to both and changed stable grids to five columns. | Update 2 test sees five desktop and five mobile selectors. |
| Low | The living-world test expected the pre-1.01 Battery Saver expression. | Test asserted old source text after the effective-settings manager replaced it. | Updated the assertion to verify `getEffective()` and the central living-world preference. | Living-world test passes. |

## Systems Audited

- Startup, spawn visibility, reservation, fallback, team spacing, and reconnect
- Neutral expansion, committed border waves, Current Push, pressure, reinforcement, and action idempotency
- Shared building preview, construction, simultaneous builds, upgrades, capture transfer, and income
- Duck, Snake, Frog, Turtle, and Carp passives and active abilities
- Lily Barrage, Dragonfly Guard, Reed Shield, cooldowns, warning, and targeting
- Alliances, truces, betrayal delay, ally attack blocking, support, team revive, and lobby authority
- Passive, Easy, Normal, Hard, and Chaos configuration plus bot simulation behavior
- Classic, Golden Lily Control, Flood Survival, Last Nest, Co-op, private, and Sandbox handlers
- False-win prevention, one-tile survival, surrender rules, team survival, and last stand
- Settings draft/apply/cancel, Low through Ultra, Adaptive Quality, Battery Saver, audio, and accessibility
- Accounts, password login, OAuth linking, sessions, achievements, badges, profile, history, and restart persistence
- Canvas pointer math, desktop double-click, mobile tap/hold controls, responsive layouts, and browser console
- Delta actions, action receipts, performance caps, long matches, map connectivity, and HTTP security

## Remaining Non-Blockers

- River Domination, Pond Rush, Migration, Animal King, and Peaceful Expansion remain clearly marked Coming Soon and are rejected server-side. They do not silently fall back to Classic.
- Google and Discord sign-in require deployment credentials and callback URLs.
- Free Render instances may sleep while idle. This is hosting behavior, not simulation delay.
- SQLite requires a persistent disk or external database on hosts with ephemeral filesystems.
- Node may print its standard built-in SQLite experimental warning.

