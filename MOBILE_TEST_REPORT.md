# PondFront.io Mobile Test Report

Date: 2026-07-02

## Current Mobile Support

- One-finger pan is implemented with inertia.
- Pinch zoom is implemented and centered between fingers.
- Double tap quick action is implemented for expand, attack, and defend.
- Long press opens the context menu.
- Two-finger tap cancels selection.
- Minimap supports tap and drag camera movement.
- Mobile quick action card shows best action and info.
- Bottom sheets support tile info and building selection.
- Safe-area spacing is in CSS for phone notches/home indicators.

## Fixes From This Pass

- Build target highlighting now mirrors more server rules.
- Lily Farm unavailable reasons are clearer on mobile.
- Bot and server timing fixes also improve mobile state consistency because the client reads server snapshots.

## Tested

- Fresh in-app browser responsive smoke tests passed at:
  - 390 x 844 phone portrait
  - 844 x 390 phone landscape
  - 768 x 1024 tablet
- Each smoke check verified visible game layout, visible canvas, visible mobile controls, no horizontal scroll, and no console errors.
- Server/API match start was separately verified after restarting the patched server.
- This pass rechecked syntax and server/API behavior after code changes.

## Remaining Mobile Risks

- Real phone pinch and long-press feel still need physical-device testing.
- Bottom sheets may need more ergonomic polish on very small landscape screens.
- Frog Big Leap preview works, but should eventually show a more dramatic cluster preview.
