# PondFront.io Expansion And Combat Fix Report

## Current State

- Expansion uses committed waves with stored progress.
- Frontline attacks use committed energy waves.
- Normal border attacks do not rely on a normal attack cooldown.
- Defended borders cost more but do not block attacks forever.
- Current Push remains a route-based special attack.

## Changes In This Pass

- Action deltas now support combat, build, diplomacy, ability, and special commands more broadly.
- Timer-end victory was added without restoring the old sudden 70% territory win.
- Alive logic remains: a player is alive if they own at least one tile or their Core Nest.

## Verification

- Partial expansion stores progress.
- Enough expansion captures tiles.
- Frontline attack starts war.
- Defended border costs more.
- 70% territory does not auto-end while another animal owns land.
- QA playtest passed.
