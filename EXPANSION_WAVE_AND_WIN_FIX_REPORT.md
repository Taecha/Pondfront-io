# PondFront.io Expansion Wave And Win Fix Report

## Summary

This update fixes expansion, sudden-win, elimination, and territory-transfer issues by moving neutral expansion into a server-authoritative committed wave system.

## Expansion Wave Fix

- Neutral expansion no longer acts like a confusing instant one-tile action.
- Clicking a neutral border now spends Animal Energy once and creates an active expansion wave.
- The server advances expansion waves every 0.45 seconds.
- Expansion waves grow only from their own connected frontier.
- Expansion waves cannot pass through rocks, enemy territory, or ally territory.
- If a wave does not have enough energy to capture a tile, it stores partial capture progress on that tile.
- Sending energy to the same expansion front reinforces the existing wave.
- Each player can have up to 2 active expansion waves.

## Balance Changes

- Neutral expansion cost increased from `1.08x` to `1.30x`, which is about 20% harder than the previous prototype balance.
- Enemy capture cost increased from `1.02x` to `1.14x`, making attacks about 12% harder.
- Expansion waves capture at most 2 tiles per tick, making growth smoother and easier to read.

## Sudden Win Fix

- Normal matches no longer end when a player controls 70% of the pond.
- FFA matches end only when one active animal remains.
- Team matches end only when one active team remains.
- Sandbox Mode still respects its no-elimination rule.
- The help menu now explains that owning most of the lake gives an advantage but does not end the match by itself.

## Elimination Fix

- Players are considered alive if they are not eliminated and still own at least one tile or their Core Nest.
- No player is eliminated for low energy, low income, no target, no path, old territory threshold, or timer pressure.
- Elimination logs now print:
  - player
  - reason
  - owned tiles before elimination
  - core status
  - killer
  - territory transferred
  - match mode

## Territory Transfer Fix

- Surrendered or eliminated territory returns to neutral by default.
- Territory is not automatically absorbed by the attacker.
- Future absorb-style modes can still be added explicitly, but the default is safe neutral return.

## Visual/UI Feedback

- Added active expansion wave snapshots from server to client.
- Added clean expansion frontier glow and flow indicators.
- Added minimap expansion flow lines.
- Added VFX for expansion wave start, capture, and end.
- Updated the action label to `Expand Wave`.

## QA Results

Passed:

- Syntax check for server, shared, and client files.
- Existing gameplay QA suite.
- Partial expansion stores progress.
- High-energy expansion captures through the new wave system.
- 70% territory does not auto-end the match while another animal is alive.
- Surrender returns territory neutral by default.
- Bot simulation still runs for 10 minutes without sudden ending.
- Bots still expand, build, attack, use abilities, use specials, and diplomacy.

