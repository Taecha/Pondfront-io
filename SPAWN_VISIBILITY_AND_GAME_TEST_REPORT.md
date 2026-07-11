# PondFront.io Spawn Visibility and Game Test Report

Date: 2026-07-11

## Spawn Presentation

- Claimed inner territory radius: visible at every zoom.
- Minimum-distance boundary: dotted outer ring using server distance data.
- Reserved: pulsing/dashed ring and `RESERVED` label.
- Confirmed: solid ring, checkmark, and `CONFIRMED` label.
- Own, teammate, enemy, bot, and anonymous zones: distinct colors and metadata.
- Invalid preview: red fill, striped overlay, and `Too Close` or `Unavailable` label.
- Spawn Status replaces the gameplay leaderboard during selection.
- View My Spawn and Fit Map work on PC and mobile.
- Candidate markers are sampled at low zoom and claimed centers never also appear available.

## Strict Regression Results

| # | Test | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Two players choose nearby areas | Passed | Second reservation rejected: `Too close to Golden Beak`; unavailable candidate returned |
| 2 | Player changes spawn | Passed | Release plus reserve versions; exactly one marker at new tile |
| 3 | Bot confirms spawn | Passed | Bot marker includes animal, color, radius, and confirmed state |
| 4 | Hidden Until Start | Passed | Masked zone visible; no enemy tile ID, player ID, animal, or event leak |
| 5 | Reconnect | Passed | Same reservation restored; map retains one marker |
| 6 | Timer expires | Passed | All unconfirmed players receive valid confirmed fallbacks, then PLAYING |
| 7 | Amazon with 20 bots | Passed | 20 confirmed unique markers; no duplicate tile |
| 8 | Co-op Together | Passed | Three teammate spawns nearby and at least four tiles apart |
| 9 | Mobile tap claimed zone | Passed live | 390x844 tap showed Snake Channel, Snake, Confirmed; no own reservation changed |
| 10 | Match begins | Passed live | Overlay disappeared after countdown; server reported 12 owned tiles and one core |
| 11 | Full Classic win path | Passed | Last living animal `h1` won after authoritative elimination checks |
| 12 | Full Co-op win path | Passed | Match ended only after enemy team defeat; `team-blue` won |
| 13 | Console errors | Passed | In-app browser error log empty |
| 14 | Server crash | Passed | Health endpoint 200; test suites and live match remained running |
| 15 | Duplicate players/bots/cores/markers | Passed | Unique player IDs, bot tiles, cores, and one reservation per player |

## Mobile Bounds

Test viewport: 390x844.

- Canvas: 390x761 at y=83.
- Spawn Status: 196x216 at x=8, y=151.
- Random / Change / Confirm: 40px tall, inside bottom safe area.
- View My Spawn / Fit Map: separate 25px camera row above primary controls.
- Status panel, right map controls, and bottom controls did not overlap.

## Automated Suites

- Spawn/modes: 34/34 passed.
- Spawn visibility/end paths: 16/16 passed.
- Account persistence: 8/8 passed.
- Broad gameplay/map/balance QA: passed.
- Syntax checks: passed.

## Server Authority

The client sends only spawn intention and target tile. The server validates candidate quality, blocked terrain, objectives, connectivity, team style, minimum separation, confirmation locks, fallback placement, and phase. Spawn snapshots and events carry monotonic versions; stale client updates cannot restore older reservations.
