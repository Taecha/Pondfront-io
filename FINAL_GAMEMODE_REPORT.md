# Final Game Mode Report

Date: 2026-07-12

## Implemented Modes

| Mode | Authoritative objective | Result |
| --- | --- | --- |
| Classic Elimination | Last valid animal/team alive | Pass |
| Golden Lily Control | Hold control zones and reach the score target | Pass |
| Flood Survival | Cooperative defenders survive configured waves and protect the Sanctuary | Pass |
| Last Nest | Final valid Core Nest determines the winner | Pass |

## Mode Isolation Tests

- Classic does not expose score/wave state and does not use the old 70% victory shortcut.
- Golden Lily creates 3-7 control zones, scores ownership, can end with rivals alive, and ignores Classic's last-animal ending.
- Flood forces cooperative teams, prevents enemy bots from acting during preparation, advances wave HUD state, loses on Sanctuary capture, and wins after all waves.
- Last Nest preserves a player while its valid Core Nest survives, exposes Nest health/protection, and ends on the final enemy Nest.
- Switching modes clears incompatible Classic, score, wave, and Nest state.
- Every active mode has distinct objective and end text.

## Unfinished Modes

`riverDomination`, `pondRush`, `migration`, `animalKing`, and `peacefulExpansion` are explicitly marked **Coming Soon** and are rejected by server-side lobby validation. They cannot silently fall back to Classic.

## Co-op and Progression

- Team alive/shared victory rules passed authoritative tests.
- Friendly-fire restrictions and server-owned team assignment are covered by co-op action tests.
- Modified/custom matches are blocked from progression rewards.

## Evidence

- `scripts/realGameModesTest.js`: 31/31 checks passed.
- `scripts/spawnModesTest.js`: 34/34 checks passed.
- `scripts/releaseRulesTest.js`: active/unfinished mode, alive-state, team-state, and progression checks passed.
- Full paths were exercised through deterministic authoritative simulations. They were not four separate wall-clock manual matches on the deployed Render build.
