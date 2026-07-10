# PondFront.io Clean Map and UI Report

## Summary

This pass made the themed maps more readable and less cluttered. Real-world maps now start from open water first, then add controlled terrain clusters, followed by a terrain-ratio cleanup pass.

## Final Terrain Ratios From QA

| Map | Water | Reeds | Mud | Lily | Blocked | Random Nests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Amazon River | 62.1% | 11.4% | 11.1% | 5.2% | 10.0% | 0.2% |
| Mekong Delta | 58.1% | 11.1% | 13.4% | 5.3% | 12.0% | 0.2% |
| Everglades Swamp | 46.2% | 18.7% | 13.5% | 11.4% | 10.0% | 0.2% |
| Nile River | 66.0% | 6.6% | 4.3% | 2.5% | 20.4% | 0.2% |

## Map Readability Changes

- Amazon, Mekong, and Nile no longer start from mostly blocked terrain.
- Themed maps now use water-first generation with controlled blockers.
- Added terrain target floors/ceilings for water, reeds, mud, lily, and blockers.
- Random neutral nest clutter is removed during generation; spawn cores still use nest tiles.
- Region painting is softer on themed maps so special zones feel important instead of spammed everywhere.
- Reeds/mud/lily decoration probabilities were reduced.

## UI and Visual Clarity Changes

- Added `Visual preset` setting:
  - PC default: Balanced
  - Mobile default: Simple
  - Optional: High and Ultra
- Simple mode reduces decorations, particles, floating text, animal motion, and shake.
- Create Lobby now defaults to Medium Lake instead of Amazon River.
- Low-power renderer prioritizes borders, owner colors, selected targets, and attacks over decoration.

## Verification

- Added terrain-ratio checks to `scripts/qaPlaytest.js`.
- All map ratio checks passed.
- Full QA passed with no failed checks.
