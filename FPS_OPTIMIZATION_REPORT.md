# PondFront.io FPS Optimization Report

## Summary

This pass focused on making PondFront.io smoother without removing core gameplay. The biggest fixes were reducing visual effect budgets, making low-power/strategic rendering flatter, throttling expensive UI panels, and staggering bot thinking on large maps.

## FPS Notes

- Before: no reliable same-machine browser FPS capture was available in automation, but the game was reported as laggy on real-world maps with many bots and dense terrain.
- After: automated QA completed successfully, server bot simulation reported `lastTickMs: 1`, `lastBotThinkMs: 1`, and `lastBotThinkers: 4`.
- The browser now defaults to `Balanced` visual preset on PC and `Simple` on mobile.

## Biggest Lag Sources

- Dense themed maps with too much blocked land, reeds, mud, lily, and terrain decoration.
- High default VFX particle/effect caps.
- Animated terrain washes and map decoration drawing during strategic zoom.
- Leaderboard/debug UI rebuilding too frequently.
- Many bots becoming ready to think on the same tick.

## Changes Made

- Reduced VFX quality budgets:
  - Low: 48 effects / 42 particles
  - Medium: 92 effects / 92 particles
  - High: 160 effects / 210 particles
  - Ultra: 250 effects / 380 particles
- Added hard VFX caps:
  - PC: 260 effects / 520 particles
  - Mobile: 82 effects / 120 particles
- Skips off-screen particle spawning.
- Auto low-performance mode now forces a cleaner strategic view, disables decoration drawing, and hides icons at low zoom.
- Strategic/low-power rendering uses lighter shadows and skips region glow/name decoration.
- Reduced map decoration draw limits.
- Throttled leaderboard rendering to about 1-2 updates per second.
- Throttled debug stats rendering to about 3 updates per second.
- Staggered bot thinking and capped simultaneous bot thinkers on large maps.

## Verification

- `pnpm run check` passed with bundled Node on PATH.
- `scripts/qaPlaytest.js` passed.
- No server crash during automated playtest.
