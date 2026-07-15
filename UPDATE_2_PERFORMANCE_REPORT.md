# Update 2 Performance Report

## Long-Match Measurement

Scenario: Amazon River, 20 bots, 1,200 simulated seconds, 4,800 server ticks.

| Metric | Result |
| --- | ---: |
| Average tick | 4.522 ms |
| p95 tick | 7.319 ms |
| p99 tick | 9.064 ms |
| Maximum tick | 24.889 ms |
| Heap growth | 17.5 MB |
| Retained events | 180 / 180 cap |

The match completed without a server crash, false ending, unbounded event growth, or negative-energy failure.

## Existing Performance Controls Verified

- Action responses use delta synchronization and changed-tile patches.
- Client action IDs prevent duplicate spending and repeated requests to the same pending target are suppressed.
- Canvas work uses viewport culling, cached layers, capped VFX, and quality profiles.
- Bot thinking is batched; the measured final bot-think slice was 4 ms for three thinkers.
- Living-world entities, particles, fog, wildlife, and weather scale by effective quality.
- Low profile measured 34 particle capacity versus 380 on Ultra.
- Battery Saver applies an effective 30 FPS cap without changing server tick rate.
- FPS options 30/45/60/90/120/Unlimited and opt-in Adaptive Quality remain functional.

## Responsive Browser QA

- Desktop 1440x900: no horizontal overflow or clipped visible buttons.
- Tablet 768x1024: no horizontal overflow or clipped visible buttons.
- Portrait mobile 390x844: Settings occupies the viewport correctly; footer and Apply/Cancel remain visible.
- Compact landscape 568x320 and wide landscape 844x390: no horizontal page overflow; contextual dock remains reachable.
- Live Canvas was nonblank at every tested viewport.
- Browser console error count: 0.

## Networking

The client displays immediate pending expansion/attack/defense feedback, then reconciles the authoritative action delta. Performance-limited rendering does not slow the server simulation.

