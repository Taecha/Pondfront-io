# PondFront.io Mobile Support Report

## Controls Added
- One-finger map pan, pinch zoom, double-tap quick action, long-press context menu, and two-finger tap cancel are supported by the client pointer flow.
- Mobile camera buttons now include zoom in, zoom out, center on player, reset zoom, strategic view, UI collapse, and leaderboard toggle.
- The minimap supports tap/drag camera movement and stays expanded briefly after touch use.
- Frog Big Leap now enters a mobile target mode: tap Ability, then tap a glowing neutral leap target.
- Mobile building flow can open a bottom sheet, choose a building, highlight valid owned tiles, and place on tap.

## UI Changes
- Added a mobile quick action card with tile title, owner, best action, cost/estimate text, main action, info, and cancel.
- Added bottom sheets for tile info and building selection.
- Added stacked mobile notifications that fade without covering the bottom command bar.
- Added Auto Strategic View and Auto Low Performance settings.
- Added Help menu tabs for Abilities, Objectives, and Mobile controls.
- Added phone landscape CSS so short screens keep the map readable.
- Added safe-area padding for mobile devices with notches/home indicators.

## Bugs Fixed / Improved
- Reset zoom and cancel buttons now send working camera commands.
- Mobile Build no longer fails silently when no tile is selected; it guides the player to valid tiles.
- Frog ability no longer feels unclear on mobile; valid leap targets glow before confirmation.
- Phone landscape map height improved from a cramped layout to a larger canvas-focused view.
- Context menus now have viewport-limited height and scroll when needed.

## Tested Screen Sizes
- 390 x 844 phone portrait: game starts, canvas visible, mobile controls visible, no horizontal scroll, no console errors.
- 844 x 390 phone landscape: game starts, larger canvas-focused layout active, no horizontal scroll, no console errors.
- 768 x 1024 tablet: game starts, canvas and controls visible, no horizontal scroll, no console errors.

## Verification
- `node --check` passed for `public/game.js`, `public/render.js`, `public/ui.js`, `public/helpMenu.js`, and `server/CombatManager.js`.
- `GET /health` returned OK.
- `POST /api/start` works for a small Frog practice match.
- Server snapshot now marks Frog ability as target-capable.

## Remaining Issues
- Physical-device pinch and long-press feel should still be checked on a real phone or Chrome DevTools touch emulation.
- A deeper automated mobile ability/build click flow timed out in the in-app browser automation layer, so that specific interaction still needs manual visual confirmation.
