# PondFront.io Objective And Event Report

## Current State

- Objectives and critter camps exist and appear on the map/minimap.
- Lake events exist with warnings and visual effects.
- Objective types include income, defense, cooldown/current, anti-special, and route-control themes.

## Changes

- Added Final Tide objective multiplier.
- Final Tide state is sent to the client and displayed through the existing event banner.
- Action deltas now include objective, camp, lake-event, and mission snapshots.

## Balance

- Objective bonus during Final Tide is modest: 1.28x income value, with smaller max-energy/defense scaling.
- This creates late-game reasons to fight without making objectives instantly decide the match.

## Verification

- Objective appearance/capture checks passed in QA.
- Events and objectives stayed server-authoritative.
