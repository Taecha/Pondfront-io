# Pointer And Spawn Fix Report

## Automated Pointer Tests

Command: `npm run test:pointer-spawn`

- PASS: Exact world-to-screen-to-world round trip at minimum, normal, and maximum zoom.
- PASS: Desktop, offset Canvas, mobile portrait, DPR 1, DPR 1.25, and DPR 2 cases.
- PASS: A point just inside a tile's top edge remains in that tile.
- PASS: A point just inside the bottom edge remains in that tile.
- PASS: A point just across the boundary selects the neighboring tile.
- PASS: Camera pan and zoom are included once in canonical conversion.
- PASS: Nearby invalid spawn snaps only within the configured three-tile radius.

## Spawn Load Tests

- PASS: Amazon River with 20 bots leaves more than 5,000 server-valid human tiles in the sampled run.
- PASS: Mekong Delta with 22 bots leaves more than 7,000 server-valid human tiles.
- PASS: Everglades with 20 bots leaves more than 5,000 server-valid human tiles.
- PASS: Nile with 20 bots leaves more than 4,000 server-valid human tiles.
- PASS: Every bot has one unique valid reservation.
- PASS: Valid water outside sampled recommendation markers is accepted.
- PASS: Find Available Spawn reserves a valid unclaimed location.
- PASS: Co-op Together leaves a nearby non-overlapping human location.

## Existing Spawn Regressions

Commands: `npm run test:spawn` and `npm run test:spawn-visibility`

- PASS: Blocked terrain remains rejectable when local snap is explicitly disabled.
- PASS: First reservation wins overlap conflicts.
- PASS: Changing a spawn releases the old reservation.
- PASS: Timer fallback enters countdown and then playing.
- PASS: Team spawn styles, reconnects, visibility masking, no duplicate IDs, and win paths remain valid.

## Manual Browser Checklist

- PASS: Desktop direct map selection reaches the visible tile and normal tile panel.
- PASS: Fit Map, View My Spawn, and camera-preserving resize paths remain available.
- PASS: Find Available reserves immediately and Random Spawn remains visible.
- PASS: Confirm changes the player from Reserved to Confirmed and starts the five-second countdown.
- PASS: Invalid clicks use the server's exact reason; adjusted clicks expose the local-snap message.
- PASS: Mobile portrait uses two-column actions with a full-width Confirm button.
- PASS: Mobile landscape direct coordinate tap reserves a spawn without offset.
- PASS: Pointer movement thresholds keep drag/pinch paths separate from tap confirmation.
- PASS: Browser console has no warning/error and the server remains healthy.
