# PondFront.io Visual Settings Bug Audit

## Problem

After playing for a while, the game could start looking flat, empty, or permanently low quality even after the player expected visuals to return. This mostly happened after sustained low FPS or after switching between Strategic View, visual presets, and auto performance settings.

## Root Cause

- Auto Performance Mode used a sticky `performanceAutoLow` state. Once the game entered low performance rendering, it did not have a strong restore path.
- The renderer treated low performance too aggressively by forcing strategy-style rendering and hiding map decoration together.
- Runtime visual reductions and user settings were mixed together in the final render options, making it hard to tell whether a bad-looking map came from user choice or temporary auto performance.
- Visual caches and minimap state were not explicitly invalidated when runtime visual quality changed.
- The debug panel only showed `auto low` or `normal`, which was not enough to diagnose the stuck state.

## Expected Behavior

- User visual settings remain stable.
- Auto Performance Mode can temporarily reduce effects when FPS is low.
- Visuals restore automatically after FPS becomes stable again.
- Strategy View can be manual or automatic, but it should not appear stuck after changing presets or resetting visuals.
- The player has clear buttons to reset visuals or restore the Balanced preset.

## Risk Areas Checked

- Manual Strategy View checkbox.
- Auto Strategic View at low zoom.
- Auto Performance Mode after sustained low FPS.
- Visual preset changes.
- Mobile/simple preset behavior.
- Renderer cache invalidation after visual changes.
- Debug panel visibility for visual runtime state.
