# PondFront.io Spawn, Co-op, and Modes Test Report

Date: 2026-07-11

## Automated Result

Command: `npm run test:spawn`

Result: PASS - 34/34 checks.

The existing full gameplay QA suite also passes after the phase refactor.

## Required Cases

| # | Test | Result |
|---|---|---|
| 1 | Solo player reserves and starts at a valid chosen tile | PASS |
| 2 | Blocked terrain is rejected with a clear reason | PASS |
| 3 | Two players request one location; only the first succeeds | PASS |
| 4 | Changing location replaces the old reservation | PASS |
| 5 | Timer fallback assigns and confirms a fair start | PASS |
| 6 | Easy/Normal bot starts are valid, unique, and connected | PASS |
| 7 | Amazon River supports 20 confirmed bot starts | PASS |
| 8 | Co-op Together keeps teammates close without overlap | PASS |
| 9 | Co-op Spread Out provides separate expansion room | PASS |
| 10 | A 60-second host timer is stored and synchronized | PASS |
| 11 | All humans ready starts the five-second countdown | PASS |
| 12 | Shared Team Energy is private/custom only | PASS |
| 13 | Unlimited Energy is Sandbox-only and disables progression | PASS |
| 14 | Classic ends for the last living animal/team | PASS |
| 15 | Golden Lily points end the correct mode | PASS |
| 16 | Flood Survival ends after the target tide | PASS |
| 17 | Last Nest uses surviving Core Nests | PASS |
| 18 | Spawn reconnect restores the reservation | PASS |
| 19 | Match reconnect creates no duplicate player/core | PASS |
| 20 | Mobile tap controls, pan/zoom layout, and buttons fit | PASS |
| 21 | Modified matches report progression disabled | PASS |
| 22 | Browser console has no warnings/errors | PASS |
| 23 | Health endpoint remains 200; no server crash | PASS |
| 24 | Match cannot end during spawn selection | PASS |
| 25 | Player IDs and active Core Nest IDs are unique | PASS |

## Additional Mode Checks

- River Domination guarantees a compatible scoring objective and reaches its point win.
- Pond Rush reaches its explicit territory target and uses faster economy/building pace.
- Peaceful Expansion blocks direct combat for 90 seconds, then unlocks it.
- Migration temporarily changes sampled neutral water outside the safe region to mud.
- Animal King creates one empowered King and allied challengers.
- Co-op revive spends server-validated energy, restores a small territory, and grants 10 seconds of attack-locked protection.
- Last Nest Core protection blocks immediate rush damage.

## Browser Measurements

- Viewport: 390x844.
- Spawn header: compact, 83px measured height.
- Map canvas reaches viewport bottom: 844px.
- Spawn sheet respects safe area: bottom at 836px.
- Horizontal overflow: none.
- Leaderboard, side panels, tutorial, normal actions, and event banner are hidden during selection.
- Pan, pinch zoom, zoom buttons, Random, Change, and Confirm remain available.

## Authenticated Lobby API Check

- Co-op lobby accepted a 60-second selection timer.
- Golden Lily rules loaded on the match state.
- Shared Team Energy marked the match modified and progression-disabled.
- A second player attempting the host's reserved tile received HTTP 400 with: `That area was just claimed. Choose another location.`
