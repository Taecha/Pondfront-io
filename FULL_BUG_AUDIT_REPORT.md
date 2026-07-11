# PondFront.io Full Bug Audit Report

## Scope
Focus was bug fixing and consistency first. No new gameplay systems were added.

## Bugs Audited
| Area | Result | Root Cause / Finding | Fix Applied | Test Result |
| --- | --- | --- | --- | --- |
| Building cost mismatch | Fixed | Client cached initial `buildingCosts` and duplicated formulas | Shared building rules plus refreshed delta costs | Passed targeted tests |
| Building placement | Passed | Server validates owner, terrain, animal lock, occupancy, energy | Reused shared preview in server validation | QA passed |
| Building upgrade | Fixed consistency | UI formula duplicated server formula | Shared upgrade cost preview | QA passed |
| Building capture/transfer | No new bug found | Existing transfer/conversion system remains active | No change needed | QA passed |
| Expansion wave | No new bug found | Server-authoritative wave progress works | No change needed | QA passed |
| Attack wave | No new bug found | Server-authoritative committed waves work | No change needed | QA passed |
| Current Push | No new bug found | Cooldown/range/route validation active | No change needed | QA passed |
| Specials | No new bug found | Costs/cooldowns read from shared config/status | No change needed | QA passed |
| Animal abilities | No new bug found | Ability status comes from server | No change needed | QA passed |
| Bot behavior | No crash found | Existing pacing still variable by sim seed | No change needed this pass | QA passed |
| Win condition | No early 70% bug found | Existing elimination/timer fixes intact | No change needed | QA passed |
| Elimination | No new bug found | Core/territory checks intact | No change needed | QA passed |
| Surrender off setting | No new bug found | Defaults off and blocks surrender | No change needed | QA passed |
| Last Stand | No new bug found | Triggers after collapse | No change needed | QA passed |
| Objectives | No new bug found | Objective scaling and theme checks pass | No change needed | QA passed |
| Map events | No crash found | Event snapshots and UI banners intact | No change needed | QA passed |
| Visual settings | No new bug found by scripts | Settings load and syntax pass | No change needed | Syntax pass |
| Strategy View | No new bug found by scripts | Renderer syntax pass | No change needed | Syntax pass |
| UI scale | No new bug found by scripts | UI syntax pass | No change needed | Syntax pass |
| Mobile controls | Build sheet fixed | Mobile costs shared same preview as PC | Shared preview in `public/ui.js` | Static + targeted tests passed |
| Login/signup/profile saving | No new bug found by syntax | Account modules compile | No change needed | Syntax pass |
| Achievements/badges saving | No new bug found by syntax | Achievement modules compile | No change needed | Syntax pass |
| Match history | No new bug found by syntax | Match history module compiles | No change needed | Syntax pass |
| Large maps | No new bug found | Themed terrain and bot counts pass | No change needed | QA passed |
| FPS/performance | No new bug found by scripts | No performance-heavy changes added | No change needed | QA passed |
| Render latency | No new bug found by scripts | Delta path still active | Added building cost to lightweight deltas | Syntax + QA passed |

## Reproduction For Fixed Bug
1. Start a match.
2. Build one Lily Farm or Nest.
3. Open PC right-click build menu or mobile build sheet again.
4. Before fix: UI could still show old base cost.
5. After fix: UI shows scaled cost, e.g. Lily Farm `57`, Nest `61`.

## Verification
- `pnpm check`: passed.
- Targeted build cost test: passed.
- `scripts/qaPlaytest.js`: passed.

## Residual Risk
Combat previews are estimates by design. Fast-changing enemy defense, active waves, and specials can alter server results between hover/preview and click, but the server remains authoritative and now returns clearer reasons for building rejections.

