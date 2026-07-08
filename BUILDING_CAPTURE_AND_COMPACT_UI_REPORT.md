# Building Capture And Compact UI Report

## Summary

This update fixes building capture behavior and tightens the in-game UI so PondFront.io gives more space back to the map.

## Building Capture

- Captured tiles now keep their building instead of deleting it.
- Captured buildings transfer to the new tile owner through `TileManager.transferBuilding(...)`.
- Building type, level, construction timer, and upgrade/construction state are preserved.
- Captured buildings enter a conversion state:
  - Level 1: 5 seconds
  - Level 2: 8 seconds
  - Level 3: 10 seconds
- During conversion, building economy/defense effects are reduced to 50%.
- After conversion, the building gives full effect to the new owner.
- Server emits a `buildingCaptured` event with tile, building, old owner, new owner, reason, and conversion timing.
- Attack waves, Current Push, expansion wave ownership changes, and Lily Barrage special captures use the transfer rule.

## Core Nest

- Match settings now include `coreCaptureBehavior`.
- Default is `transfer`, matching the current Last Stand style flow.
- Supported values: `transfer`, `eliminate`, `neutralize`.
- Core capture now emits a clear `Core Nest captured!` event.

## Client Feedback

- Captured buildings show a conversion timer in the selected tile panel.
- Building icons show a conversion progress ring and seconds remaining.
- Captures trigger ripple/sparkle effects and floating text.
- Toasts show:
  - `You captured Lily Farm!`
  - `Your Reed Guard was captured!`

## Compact UI

- Compact UI remains the default.
- Added shared UI scale variables:
  - `--ui-scale`
  - `--panel-padding`
  - `--panel-gap`
  - `--font-size-small`
  - `--font-size-normal`
  - `--button-height`
  - `--panel-radius`
- UI scale options are Tiny, Compact, Normal, and Large.
- Top bar, bottom bar, side panels, settings panel, lists, minimap, and mobile sheets now respect the scale variables.
- Panels and buttons are smaller by default while keeping mobile tap targets usable.

## Tests

- `pnpm run check`: passed.
- `node scripts/qaPlaytest.js`: passed.
- Targeted Lily Farm capture test: passed.
  - Building transferred to capturer.
  - Level stayed at 2.
  - Conversion timer was 8 seconds.
  - Old owner lost income.
  - New owner gained reduced income during conversion and full income after conversion.
- Targeted Reed Guard capture test: passed.
  - Building transferred to capturer.
  - Level stayed at 3.
  - Defense bonus was reduced during conversion and doubled to full value after conversion.
