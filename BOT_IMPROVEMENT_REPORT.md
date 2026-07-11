# PondFront.io Bot Improvement Report

## Changes

- Bots now try neutral expansion before routine building.
- Bots treat Final Tide as a surge phase.
- Existing bot personalities remain: expander, defender, fighter/aggressive, objective hunter, leader hunter, survivor-like defensive behavior, and support personalities.
- Existing difficulty profiles remain intact to avoid making Easy/Normal unfair.

## Result

- Bots should spend less of the early/mid game building while borders are still far away.
- Final phase bots pressure the leader more clearly.
- Bot thinking remains staggered with thinker limits for large maps.

## Verification

- QA bot simulation passed with 53 attacks, 61 ability uses, 160 buildings, diplomacy events, and all five animals represented.
