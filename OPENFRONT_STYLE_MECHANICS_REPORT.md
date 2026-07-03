# PondFront.io OpenFront-Style Mechanics Report

## Goal

Upgrade PondFront.io toward a deeper real-time territory strategy feel without copying OpenFront.io assets, code, UI, branding, names, or exact implementation. The update keeps PondFront.io original with animal factions, pond terrain, Core Nests, lake objectives, and pond-themed attack/support language.

## Implemented In This Pass

### Smaller, Clearer Strategy Controls

- Bottom Attack now works like an ongoing frontline order: Start Attack begins a continuous border push, and Stop Attack cancels the current continuous order.
- Mobile action cards now say Start Attack or Stop Attack instead of implying attacks are only one-shot clicks.
- Right-click enemy menus now offer Start Attack percentage options and a pond-themed Current Push route attack.
- Right-click ally menus now offer Send Support 25%, 50%, and 75%.

### Continuous Frontline Attacks

- Added server-authoritative continuous attack orders in `server/CombatManager.js`.
- Continuous attacks tick over time, spend small amounts of Animal Energy, and keep pushing the nearest connected enemy border.
- The server stops continuous attacks when energy is too low, diplomacy blocks combat, the defender is defeated, or the front is no longer connected.
- Active continuous orders appear in the attack snapshot and render as labeled flow arrows.

### Ally Support / Energy Donation

- Added `server/SupportManager.js`.
- Players can send Animal Energy only to allies or teammates.
- Support has cooldown, minimum send amount, server validation, and 75% transfer efficiency.
- Support stats are tracked with `supportSent` and `supportReceived`.
- UI and VFX now show support feedback.

### Core Nest / Capital Pressure

- Added `server/CoreManager.js`.
- Each player starts with a Core Nest tile.
- Core Nests add max energy, income, and a small defense aura while owned.
- A Core Nest absorbs damage before it can be captured.
- Losing a Core Nest applies economy/max-energy penalties and can eliminate very small non-team players.
- Core status is included in snapshots and shown in tile/player panels.

### Deep Current Objective And Water Route Attack

- Added a Deep Current objective bonus that improves route attack power.
- Added Current Push, a slower water/lily route attack that lets players pressure coastal enemy tiles through open pond routes.
- Rendering and VFX show Current Push with ripple and flow-arrow feedback.

### Smarter Bots

- Bots can now:
  - Support allies or teammates under pressure.
  - Try Current Push route attacks in mid/late game.
  - Surrender when hopeless after enough match time.
  - React to Core Nest pressure and low-energy situations.
- Added a supporter-style bot personality path without replacing existing bot behavior.

### Feedback And Polish

- Added toasts and VFX for support, continuous attack start/stop, Current Push, Core Nest hits, Core Nest capture, and surrender.
- Attack flow labels now distinguish continuous drain and Current Push routes.
- Core Nest markers are shown as rare strategic markers instead of repeated tile icons.

## Server-Authoritative Safety

The client only sends intentions:

- `startContinuousAttack`
- `stopContinuousAttack`
- `support`
- `waterRoute`

The server validates:

- Attack diplomacy and alliance blocks.
- Connected frontline reach.
- Continuous attack energy requirements.
- Support target relationship, cooldown, and energy.
- Current Push water/lily route validity.
- Core Nest damage, capture, penalties, and defeat logic.

## Deferred On Purpose

These were not fully implemented in this pass to avoid making the prototype unstable:

- Full treaty market or multi-step diplomacy negotiation.
- Large-scale army path visualization across the whole route.
- Human-triggered surrender button.
- Full endgame absorption UI.
- Major redesign of every panel and CSS layout.
- True multiplayer socket rooms beyond the existing server/lobby structure.

## Verification

Passed syntax checks for updated shared, server, and public JavaScript files.

Passed existing QA playtest:

- Map size checks.
- Expansion and capture progress.
- Buildings and upgrades.
- All animal abilities.
- Diplomacy and truce/war blocking.
- Frontline combat.
- Bot expansion, attacks, buildings, abilities, and diplomacy.

Passed focused smoke tests:

- Ally support transfers energy with cooldown.
- Continuous attack starts, ticks, spends energy, and stops.
- Current Push validates a water route.
- Core Nest absorbs attack damage before capture.
- Surrender defeats a bot and records territory absorption.

Balance simulation:

- 5 simulated smart-bot matches completed.
- Average match duration: 840 seconds.
- Average attacks: 77.4.
- Average wave captures: 118.2.
- Average builds: 700.4.
- Average income: 27.4/s.

## Next Best Upgrades

- Add a clear human Surrender / Absorb prompt for late-game defeated players.
- Add a compact Core Nest warning strip near the top bar.
- Tune build spam down in long bot simulations.
- Add route preview before launching Current Push.
- Add a small tutorial step explaining continuous attacks and Core Nests.
