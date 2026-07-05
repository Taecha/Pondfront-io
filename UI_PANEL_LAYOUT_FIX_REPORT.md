# PondFront.io UI Panel Layout Fix Report

## Summary

This pass reduces in-game UI clutter so the map is easier to read during real play.

## Changes Made

- Moved the old floating visual/audio controls into a real Settings modal opened from the top bar.
- Rebuilt the right side into a cleaner stack:
  - Minimap is always visible.
  - Leaderboard is the default tab.
  - Objectives and Missions are tabbed instead of always visible.
  - Leaderboard defaults to top 5 with a More/Compact toggle.
- Hid the localhost win-check debug banner during normal play.
  - It can still be enabled with `?debug=1` or `localStorage.setItem("pondfront:debug", "1")`.
- Made the bottom action bar context-aware:
  - Neutral tile: Expand and relevant shared actions.
  - Enemy tile: Bite/Push/Wave/Max, Attack, Current Push.
  - Own tile: Defend, Build/Upgrade, shared actions.
  - No tile: only shared actions remain.
- Added a top-bar Panels button for quickly collapsing the side panels.
- Tightened the left info panel and moved longer tile/player breakdowns into More Details.
- Added mobile-safe settings drawer behavior and mobile right-panel behavior.

## Test Checklist

- Settings button opens the Settings modal.
- Old floating settings strip is no longer visible on the map.
- Minimap remains visible on the right side.
- Leaderboard is visible by default and compact.
- Objectives and Missions are accessible through tabs.
- Win-check debug banner is hidden during normal play.
- Bottom bar changes when selecting neutral, enemy, own, or no tile.
- Mobile keeps Settings accessible and avoids always showing large side content.
- `pnpm run check` passes with the bundled Node runtime.

## Verification

- JavaScript syntax check: passed.
- Local server check: `http://localhost:5173/` returned 200.
- Health check: `http://localhost:5173/health` returned 200.
