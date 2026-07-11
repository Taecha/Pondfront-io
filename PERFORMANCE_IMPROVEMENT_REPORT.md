# PondFront.io Performance Improvement Report

## Changes

- Expanded action delta responses beyond only expand/attack/defend/current push.
- Added full supporting metadata to action deltas: objectives, camps, missions, relationships, team state, win state, Final Tide, and metrics.
- Throttled objective, mission, and event panel rendering unless the panel is open, Final Tide is active, the match ended, or enough time has passed.
- Kept existing pending action visuals for instant expand/attack/defend feedback.

## Result

- More clicks avoid full-map state payloads.
- UI HTML rebuild work is lighter during normal polling.
- Gameplay feedback remains instant while the server stays authoritative.

## Verification

- Focused `node --check` passed.
- `scripts/qaPlaytest.js` passed.
