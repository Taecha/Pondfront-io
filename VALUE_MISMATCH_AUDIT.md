# PondFront.io Value Mismatch Audit

## Summary
Primary mismatch found and fixed: building cost previews were stale on the client after costs scaled on the server.

## Fixed Mismatches
| Value | Old client value/source | Server value/source | Fixed source | Files changed |
| --- | --- | --- | --- | --- |
| Lily Farm build cost | Initial snapshot/base config could show `40` forever | `farmBaseCost` plus owned-count scaling, e.g. `40 -> 57` | `shared/buildingRules.js` | `shared/buildingRules.js`, `server/EconomyManager.js`, `server.js`, `public/game.js`, `public/ui.js` |
| Nest build cost | Initial snapshot could show `45` forever | `45` plus owned-count scaling, e.g. `45 -> 61` | `shared/buildingRules.js` | `shared/buildingRules.js`, `server/EconomyManager.js`, `server.js`, `public/game.js`, `public/ui.js` |
| Lily Farm base config | `shared/gameConfig.js` listed `42` | Real balance base was `40` | `shared/gameConfig.js` and `shared/balanceConfig.js` now agree | `shared/gameConfig.js` |
| Build rejection text | Generic/old cost text | Exact server reason | Server preview result | `server/EconomyManager.js`, `shared/buildingRules.js` |
| Upgrade cost preview | Client duplicated server-like formula | Shared formula | `shared/buildingRules.js` | `public/ui.js`, `server/EconomyManager.js` |

## Audited Values
- Building costs: fixed to shared/server preview.
- Upgrade costs: moved to shared building rules.
- Expansion costs: already use `shared/gameConfig.js` helper and server combat validation.
- Attack costs: preview is an estimate, server remains authoritative by `server/CombatManager.js`.
- Special costs: UI reads `specialStatus`/`shared/specialConfig.js`; no mismatch found.
- Ability cooldowns: UI reads server `abilityStatus`; no mismatch found.
- Current Push cost/cooldown: UI reads shared combat config plus server status; no mismatch found.
- Defend cost: UI computes selected energy percent and server validates; no stale fixed cost found.
- Bot difficulty values: UI/server read shared bot config; no mismatch found.
- Map bot count: server sanitizes map settings from shared map config; no mismatch found in QA.
- Objective bonuses: server applies shared objective config; UI displays definitions from state.

## Remaining Notes
Attack and combat tile costs are intentionally shown as estimates because active defense, pressure, waves, terrain, abilities, specials, and defender energy can change while the player is choosing. Server validation remains authoritative.

