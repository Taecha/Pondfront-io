# Final Value Consistency Report

Date: 2026-07-12

## Result

**Pass for tested local release-candidate paths.** Displayed actions are resolved from shared rules/server state, while the server recalculates and validates every submitted action.

## Canonical Sources

| Value | Canonical source | Verification |
| --- | --- | --- |
| Building cost and scaling | `shared/buildingRules.js`, shared balance/building config | Base, count scaling, Carp modifier, preview, deduction, and transfer tests |
| Building upgrade cost | shared building rules/config | Level 1 and Level 2 growth tests |
| Expansion cost | shared expansion/action rules | Terrain and blocked-tile tests |
| Attack send amount | selected percentage plus server combat validation | Combat/playtest suites |
| Defend/revive | shared action resolver and server preview | Context/action and QA suites |
| Ability cost/cooldown | shared animal config; server timestamps | All five ability tests and reconnect snapshot tests |
| Current Push | shared combat config | Combat balance and QA suites |
| Lily Barrage | `shared/specialConfig.js` | 120 energy, 60-second cooldown tests |
| Dragonfly Guard | `shared/specialConfig.js` | 85 energy, 50-second cooldown tests |
| Reed Shield | `shared/specialConfig.js` | 70 energy, 35-second cooldown tests |
| Income/objectives | server economy and mode state | Economy, objective, and mode suites |

## Building Findings

- No public UI file retains the obsolete hardcoded Lily Farm/Nest menu values.
- Desktop context menu, selected-tile panel, bottom dock, and mobile long-press/build sheet use the shared action resolver.
- The resolver exposes current cost, affordability, cooldown, and invalid-target reason.
- The server validates the current cost again before deduction, preventing stale previews from authorizing a build.
- Scaled cost refresh was verified after builds and ownership transfer.
- Level and type remain attached to a captured building; the old owner's count decreases and the new owner's count increases.
- A sampled Lily Farm scaled from 40 to 90 at building count three; Carp's tested first-farm modifier produced 38. These are state-dependent examples, not UI constants.

## Regression Coverage

- Building/upgrade/expansion calculation tests passed.
- Ability and special costs/cooldowns passed.
- Ownership and building transfer passed.
- Full QA playtest found no `NaN`, undefined cost, negative unintended energy, or duplicate deduction.
- Replayed `clientActionId` returns the cached authoritative receipt and does not spend energy or start a cooldown twice.

## Remaining Limitation

The deployed Render assets do not match this local candidate, so value consistency on the currently deployed UI is not certified until the release candidate is redeployed.
