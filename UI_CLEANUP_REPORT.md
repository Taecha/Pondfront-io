# PondFront.io UI Cleanup Report

## Changes

- Top bar timer now shows time left instead of only elapsed time.
- Existing gear/settings panel remains behind the Settings button.
- Right-side leaderboard/objective/mission tabs remain compact and are now cheaper to update.
- Final Tide uses the existing lake-event banner instead of adding another always-visible panel.

## Current UI State

- PC defaults to Compact UI scale.
- Right side keeps minimap and compact leaderboard visible.
- Objectives and missions stay in tabs.
- Bottom actions are already context-aware through `updateActionVisibility`.

## Verification

- No syntax errors in `public/ui.js` or `public/index.html`.
- QA playtest passed after the UI changes.
