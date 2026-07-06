# PondFront.io Performance Optimization Report

Date: 2026-07-05

## Implemented Optimizations

### Instant-feeling actions

- Expand, Attack, Defend, and Current Push now create a local pending visual immediately.
- Pending visuals are only cosmetic; the server still controls ownership, energy, progress, attacks, and failure reasons.
- If the server rejects an action, the pending highlight clears and a rejected/blocked effect appears.
- Duplicate clicks on the same tile/action are blocked while that command is pending.

### Rendering

- Minimap redraw is throttled instead of looping over every tile every frame.
- Renderer tracks `lastVisibleTileCount` for the debug panel without forcing extra tile scans.
- Low-power rendering draws fewer animated water strokes.
- Auto-low-performance mode lowers effect quality when FPS stays below 45 for 3 seconds.

### Effects

- Off-screen ripple, pulse, and floating text effects are skipped.
- Floating text is capped: lower on mobile/low quality, higher on normal desktop.
- Pending action effects use lightweight ripple/pulse feedback instead of heavy particles.

### Bots/server

- Bots now use `aiNextThinkAt` with difficulty-based intervals:
  - Easy: 1.5-2.5s
  - Normal: 1.0-1.8s
  - Hard: 0.6-1.2s
  - Chaos: 0.4-0.8s
- Bot decisions are staggered, reducing same-frame CPU spikes.
- Server snapshots now expose bot think time and bot thinker count.

### Debug panel

- Debug stats now show real render-loop FPS/frame time instead of UI-update timing.
- Added ping, expansion latency, message rate, bot think time, and graphics mode.

## Test Results

1. Expand border:
   - API benchmark: average 20 ms, min 11 ms, max 31 ms.
   - Client now shows pending ripple/outline instantly before server confirmation.

2. Rapid expansion:
   - Same tile/action is locked while pending.
   - Other UI remains usable.

3. Attack wave:
   - QA passed frontline attack and war checks.
   - Pending attack trail appears immediately.

4. Big map / many visible tiles:
   - Initial small-map view showed 2160 visible tiles.
   - Minimap redraw no longer repeats full tile drawing every frame.

5. Many bots:
   - QA 10-minute simulation passed.
   - Final QA sample: 8 attacks, 33 wave captures, 279 expansions, 151 builds, 48 abilities.
   - Server metric: last bot think 3 ms with 5 bot thinkers.

6. Effects high:
   - VFX caps and off-screen skipping added.
   - Debug panel showed 1-8 active particles during measured samples.

7. Mobile mode:
   - Existing mobile defaults stay medium/lower.
   - Auto-low-performance and minimap throttling apply more aggressively on mobile.

8. Console errors:
   - Browser logs reported no errors/warnings.

9. Server crash:
   - Server health passed after restart.
   - `pnpm run check` passed.
   - `node scripts/qaPlaytest.js` passed.

## Final Result

PondFront.io should now feel more responsive because the player receives instant visual feedback on border expansion and attacks. Rendering is lighter because the minimap and effects no longer do as much work every frame, and bot CPU work is staggered instead of clustering.
