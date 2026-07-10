# PondFront.io Lite Map Visual Upgrade Report

## Summary

This update adds a small amount of visual life back into the map while keeping the FPS-focused cleanup intact. The goal was to make water and blockers feel more themed without returning to clutter or heavy particle effects.

## Visual Changes

- Balanced, High, and Ultra presets now start in the normal map view instead of forced Strategic View.
- Simple preset still uses Strategic View with very low decoration.
- Large maps no longer force auto-low graphics immediately. Auto-low still activates after sustained low FPS.
- Added subtle water shimmer and soft wave/current marks.
- Added tiny deterministic water accents:
  - ripples
  - small bubbles
  - drifting leaf marks
- Added clustered terrain accents instead of random decoration spam.
- Added soft terrain edge lines where land/mud/reeds/lily touch open water.
- Added simple blocked-land details:
  - Amazon jungle/grass island texture
  - Mekong rice-field lines and bridge/log marks
  - Everglades grass/reed island hints
  - Nile desert sand lines

## Performance Rules Kept

- Decorations only draw for visible tiles.
- Decorations are capped per frame by preset and mobile/PC.
- Strategic View remains clean and hides most decoration.
- Simple mode keeps effects and map texture reduced.
- The new visuals are canvas strokes/shapes, not new gameplay objects or heavy particle systems.

## Verification

- `pnpm run check` passed.
- `scripts/qaPlaytest.js` passed.
- Terrain ratio checks still pass for Amazon, Mekong, Everglades, and Nile.
- No server crash in automated playtest.
