# PondFront.io Ability Test Report

## Test Method

Tests were run against the server-authoritative game code using `PondFrontServerGame` directly. This avoids client-only effects and verifies the same code used by `/api/action`.

## Baseline Before Fixes

### Duck: Flock Rush

- Normal open-water expansion cost: `13`
- During Flock Rush: `10`
- Ratio: `0.769`
- Result: real effect existed, but it was weaker than the requested 35% reduction.
- Cooldown: `36s`, not requested `45s`.

### Snake: Ambush

- Normal test attack power: `54.28`
- Ambush test attack power: `84.13`
- Result: real attack-power effect existed.
- Problems: Ambush used `42s` cooldown and `12s` duration, and readiness could last past duration if unused.

### Frog: Big Leap

- Territory before: `13`
- Territory after: `18`
- Gained: `5`
- Result: real neutral capture effect existed.
- Problem: cooldown was `40s`, and result metadata did not include affected tiles.

### Bots

- Bot ability events observed in simulation: `19`
- By animal: Frog `9`, Duck `5`, Snake `5`
- Result: bots used abilities, but had no debug reason logs.

## After Fixes

### Duck: Flock Rush

- Normal open-water expansion cost: `13`
- During Flock Rush: `8`
- Expired cost after 10s: `13`
- Result: real effect confirmed. Cost rounds to a stronger visible drop on this tile, using configured `x0.65`.
- Cooldown blocks spam: second use returned `Ability cooling down for 35s`.

### Snake: Ambush

- Normal test attack power: `54.28`
- Ambush test attack power: `75.99`
- Result: `+40%` Ambush power confirmed after the normal reed/mud Snake bonus.
- Ambush consumed after attack: `ambushReady: false`.
- Expired unused Ambush after 16s: attack launched without Ambush gameplay changes.
- Border cost check:
  - Normal wave capture cost: `30.04`
  - Ambush wave capture cost: `24.03`
  - Ratio: `0.8`

### Frog: Big Leap

- Territory before: `13`
- Territory after: `16`
- Gained: `3` in targeted cluster test.
- Affected tiles returned: `[259, 342, 344]`
- Enemy captured: `false`
- Cooldown blocks spam: second use returned `Ability cooling down for 55s`.

### Bots

- Bot ability events observed in simulation: `20`
- By animal: Duck `8`, Frog `9`, Snake `3`
- Result: bots still use all three abilities after the changes.

## Bugs Fixed

- Duck Flock Rush now uses the requested 35% open-water expansion cost reduction.
- Ability cooldowns now match the requested values:
  - Duck: `45s`
  - Snake: `50s`
  - Frog: `55s`
- Snake Ambush now expires after `15s` if unused.
- Snake Ambush now clearly consumes after one valid reed/mud attack.
- Snake Ambush now applies both attack-power and defense-cost gameplay changes.
- Frog Big Leap now returns affected tile ids and never captures enemy tiles.
- Ability UI now shows real gameplay modifiers, active duration, and cooldown text.
- Development-only ability logs now include gameplay-change data.

## Remaining Notes

- Big Leap can capture fewer than 5 tiles when the selected or nearby valid neutral cluster is smaller. That is intentional and safer than forcing invalid captures.
- The browser automation surface timed out earlier in this thread, so these tests rely on authoritative server simulations and HTTP checks rather than screenshots.

