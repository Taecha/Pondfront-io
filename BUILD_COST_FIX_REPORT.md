# PondFront.io Build Cost Fix Report

## Bug Fixed
The PC right-click menu and mobile build sheet could show stale building costs after the player built one or more structures. The server scaled the real cost by owned building count, but the client preferred the first `state.config.buildingCosts` snapshot and kept showing old values.

## Root Cause
- Server cost source: `server/EconomyManager.js`.
- Old client display paths: `public/game.js` and `public/ui.js`.
- The client cached `state.config.buildingCosts` from the initial snapshot and did not receive refreshed costs in state/action deltas.
- Some UI fallback code still duplicated older cost formulas.

## Fix Applied
- Added shared rules in `shared/buildingRules.js`.
- Server build validation now calls the shared preview/cost functions.
- PC right-click build menu now uses `buildPreview(...)`.
- Mobile build sheet now uses `buildPreview(...)`.
- Bottom Build button and build dropdown update live with current costs.
- Server state/action deltas now include refreshed `buildingCosts`.
- Lily Farm base display config was aligned from `42` to `40`, matching the real balance base.
- Server rejection messages now return exact reasons such as `Need 3 more Animal Energy (57 total).`

## Test Cases
1. PC valid tile preview: passed by shared preview/server snapshot cost match.
2. Mobile build sheet parity: passed by using the same shared preview helper as PC.
3. Build Lily Farm: passed, preview `40`, server `spentEnergy` `40`.
4. Build Nest: passed, preview `45`, server `spentEnergy` `45`.
5. Multiple buildings scale: passed, Lily Farm `40 -> 57`, Nest `45 -> 61`.
6. Not enough energy: passed, button preview/reject reason says exact missing energy.
7. Cooldown/construction active: preview returns construction wait reason for occupied constructing tiles.
8. Server rejection: passed, rejection reason equals preview reason.
9. Capture enemy building: covered by existing QA building transfer/construction checks.
10. No console/server syntax errors: `pnpm check` passed.
11. No server crash: `scripts/qaPlaytest.js` passed.

## Verified Output
Targeted test:

```json
[
  {"buildingType":"lilyFarm","firstCost":40,"secondCost":57,"reject":"Need 3 more Animal Energy (57 total)."},
  {"buildingType":"nest","firstCost":45,"secondCost":61,"reject":"Need 3 more Animal Energy (61 total)."}
]
```

