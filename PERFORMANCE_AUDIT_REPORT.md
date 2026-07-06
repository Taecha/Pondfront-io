# PondFront.io Performance Audit Report

Date: 2026-07-05

## Audit Method

- Ran server health check on `http://localhost:5173/health`.
- Ran local API benchmark against `/api/start`, `/api/state`, and `/api/action`.
- Ran the existing gameplay QA suite with bot simulation.
- Opened the game in the in-app browser, started Practice With Bots, enabled the debug stats panel, and read live frame stats.
- Checked browser error/warning logs.

## Measured Results

- Browser FPS, settings modal open: 25 FPS, 40.2 ms frame time.
- Browser FPS, normal gameplay: 28 FPS, 35.4 ms frame time.
- Lowest observed FPS during this check: 25 FPS.
- Visible tiles at initial zoom: 2160 tiles.
- Active particles during normal gameplay sample: 1 active particle out of 165 max.
- Active attacks during sample: 0.
- Active bots during sample: 4.
- Server ping from browser debug panel: 110 ms after settling.
- Local `/api/state` ping benchmark: 14 ms.
- Local expansion action benchmark: 8 expansions, average 20 ms, min 11 ms, max 31 ms.
- Server tick time during expansion benchmark: 2 ms.
- Bot think time during expansion benchmark: 0 ms on the sampled action tick.
- Bot simulation tick metric from QA: last server tick 4 ms, bot think 3 ms, 5 bot thinkers.
- Browser console errors/warnings: none observed.

## Biggest Lag Sources Found

- Minimap rendering was redrawing every tile every animation frame.
- Fully zoomed-out gameplay can draw more than 2000 visible tiles at once.
- Water background strokes were animated every frame at the same density even in lower-power conditions.
- Effects could still spawn ripples/text for off-screen or repeated actions.
- Bot thinking used per-bot timers, but bots could still align and think in clusters.
- Expansion feedback waited for server confirmation, which made fast local actions feel delayed even when the server responded quickly.

## What Was Fixed

- Added local-only pending action feedback for Expand, Attack, Defend, and Current Push.
- Added pending tile outline/pulse so expansion feels instant while waiting for server confirmation.
- Added same-tile/action pending lock to avoid double-click spam without freezing the whole UI.
- Added client-side action latency and expansion latency tracking.
- Added render-loop FPS/frame-time sampling.
- Added debug panel fields for FPS, frame time, ping, expansion latency, particles, attacks, bots, bot think time, messages/sec, visible tiles, and server tick.
- Throttled minimap redraws to roughly 4 FPS on PC and roughly 3 FPS on mobile.
- Reduced animated water stroke density in low-power/effect-low modes.
- Added auto-low-performance mode when FPS stays under 45 for several seconds.
- Capped floating text and skipped off-screen ripple/pulse/floating-text spawns.
- Staggered bot thinking with difficulty-based think intervals.
- Added server metrics for bot think time and number of bot thinkers per tick.

## Notes

- The in-app browser measured lower FPS than ideal at the fully zoomed-out start because all 2160 map tiles are visible. The new auto-low-performance mode correctly engaged.
- Server action latency was already good locally. The biggest perceived delay was visual: the player saw feedback only after server response. The pending feedback now fixes that feel without changing authority.
