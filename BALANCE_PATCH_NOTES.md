# PondFront.io Balance Patch Notes

## Buffs

- Turtle expansion penalty reduced from `1.12` to `1.08`.
- Turtle attack power raised from `0.94` to `0.97`.
- Turtle bot turn pace improved through config from old hard-coded `1.18` to `1.10`.

## Nerfs

- Frog lily income reduced from `0.14` to `0.11`.
- Frog Lily Farm bonus reduced from `0.18` to `0.14`.
- Frog Big Leap cluster size reduced from `5` to `4`.
- Frog level 3 Big Leap bonus reduced from `2` to `1`.
- Frog bot leap chance reduced.
- Frog bot lily/objective priority reduced.
- Carp lily income reduced from `0.12` to `0.105`.
- Carp Lily Farm discount reduced from `0.90` to `0.94`.
- Carp Golden Current income multiplier reduced from `0.30` to `0.24`.
- Lily Farm income reduced from `0.82` to `0.78`.
- Lily Farm cost growth increased from `0.35` to `0.42`.
- Lily Farm activation time increased from `10s` to `12s`.

## Fixes

- Bot animal turn pacing moved into `shared/balanceConfig.js` as `botAnimalTurnPace`.
- Bot Current Push chance increased slightly for Normal, Hard, and Chaos so the system appears in play without becoming spam.

## Bot Changes

- Easy Current Push remains very rare.
- Normal Current Push chance increased from `0.035` to `0.05`.
- Hard Current Push chance increased from `0.08` to `0.10`.
- Chaos Current Push chance increased from `0.14` to `0.16`.
- Current Push energy threshold reduced from `58%` to `52%` max energy for eligible bots.

## Mobile Changes

- No new mobile controls were added in this patch.
- Existing Bite/Push/Wave/Max mobile flow remains the intended combat path.

## Why

- Frog was the only clear animal outlier in baseline simulations.
- Turtle needed tempo, not more unkillable defense.
- Economy needed light anti-spam scaling, especially Lily Farm on bigger maps.
- Current Push needed visibility but not a big power buff.

