# PondFront.io Building Improvement Report

## Current State

- Nest, Lily Farm, Reed Guard, Mud Tunnel, and Jump Pad exist.
- Buildings take construction time.
- Buildings transfer on capture and use conversion timing/effect reduction.
- Income, defense, mobility, upgrade, and removal paths are implemented.

## Changes In This Pass

- Bot priority changed so expansion happens before routine building.
- This should reduce early building spam while keeping buildings meaningful.

## Verification

- Building effect waits for construction.
- Another building can start while one constructs.
- Building upgrade reaches level 2.
- Lily Farm cost scales upward.
- Lily Farm increases income.
- QA playtest passed.
