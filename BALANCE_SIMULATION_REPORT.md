# PondFront.io Balance Simulation Report

## Method

Ran accelerated server-authoritative bot simulations using the real `PondFrontServerGame`, `BotManager`, `CombatManager`, `EconomyManager`, objectives, abilities, buildings, diplomacy, and committed wave combat.

The human slot was converted into an AI participant so simulations were bot-only. Matches were capped for development speed:

- Small: 10 baseline matches, 480s cap
- Medium: 10 baseline matches, 620s cap
- Large: 10 baseline matches, 760s cap

Post-patch sanity:

- Small: 5 matches
- Medium: 5 matches
- Large: 5 matches

Raw outputs:

- `balance-sim-results.json`
- `balance-postpatch-sim-results.json`

## Baseline Results

Total baseline matches: 30

Winner animals:

- Duck: 5
- Snake: 5
- Frog: 12
- Turtle: 2
- Carp: 6

Map averages:

- Small: 17 attacks, 50 buildings, 2.4 objectives, 0 Current Pushes, biggest wave 11
- Medium: 18.5 attacks, 125.4 buildings, 4.2 objectives, 0 Current Pushes, biggest wave 21
- Large: 19.4 attacks, 219.8 buildings, 9.7 objectives, 0 Current Pushes, biggest wave 42

## Baseline Findings

- Frog was too reliable across map sizes.
- Turtle was under target.
- Building count scaled very high on Medium/Large.
- Current Push was underused by bots.
- Matches often reached the simulation cap, meaning long games are stable but late-game decisive pressure could use future testing.

## Post-Patch Sanity Results

Total post-patch matches: 15

Winner animals:

- Duck: 3
- Snake: 2
- Frog: 2
- Turtle: 2
- Carp: 6

Map averages:

- Small: 18.4 attacks, 50.4 buildings, 2.2 objectives, 0.6 Current Pushes, biggest wave 12
- Medium: 20.2 attacks, 119.6 buildings, 5 objectives, 0 Current Pushes, biggest wave 17
- Large: 24.4 attacks, 201.8 buildings, 9.2 objectives, 0 Current Pushes, biggest wave 18

## Post-Patch Read

- Frog dominance was reduced in the sanity sample.
- Turtle recovered from near-nonviable to present but not dominant.
- Building totals dropped on Medium/Large.
- Largest wave size dropped from 42 to 18 in the sanity sample, reducing late-game blowouts.
- Carp won 6/15 in the smaller sanity sample. Because Carp was only 6/30 in baseline, this is a watch item rather than proof of a new meta.

