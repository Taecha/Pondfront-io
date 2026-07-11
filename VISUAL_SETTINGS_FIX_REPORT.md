# PondFront.io Visual Settings Fix Report

## Summary

This update separates player visual settings from temporary runtime performance reductions. Auto Performance Mode now lowers visuals in levels and restores them after stable FPS instead of making the game stay in a bad-looking mode.

## Changes

- Added runtime visual state tracking in `public/game.js`.
- Added automatic restore logic when FPS stays healthy.
- Added `Reset Visuals` and `Restore Balanced` buttons in Settings.
- Added renderer cache invalidation for visual changes.
- Changed low performance rendering so Level 1 mainly reduces effects and particles.
- Limited heavy map simplification to the strongest temporary performance reduction.
- Stopped low performance mode from directly forcing permanent Strategy View behavior.
- Added debug panel fields for:
  - current graphics state
  - visual preset
  - manual vs auto strategy view
  - selected visual quality
  - visual cache version
  - current FPS visual reason

## Player-Facing Result

- The map should not get permanently flat or empty after playing for a while.
- Balanced/High/Ultra visuals can be restored without reloading the page.
- Strategy View should be easier to understand and should not feel stuck.
- If the game lowers visuals for performance, it now says so and can restore later.

## Files Updated

- `public/game.js`
- `public/render.js`
- `public/ui.js`
- `public/index.html`
- `public/style.css`

## Verification

- `pnpm run check` passed.
- Local server responded at `http://localhost:5173/health`.
- The home page includes `resetVisualsButton` and `restoreBalancedButton`.
- Debug stats now show graphics level, preset, strategy mode, quality, and cache version.
- `scripts/qaPlaytest.js` ran, but one unrelated bot-balance assertion failed: the 10-minute bot simulation launched 3 attacks while the existing test expects at least 4. The visual settings files passed syntax checks and the server stayed healthy.
