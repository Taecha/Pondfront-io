# Cooldown State Audit

Date: 2026-07-12

| System | Authoritative representation | Client display | Result |
| --- | --- | --- | --- |
| Animal abilities | `abilityCooldownEndsAt` / `abilityReadyAt` absolute server seconds | Estimated server time, 250ms visual refresh | Fixed and PASS |
| Flock Rush active time | `abilityActiveUntil` | Absolute end timestamp | PASS |
| Ambush active window | `abilityActiveUntil` plus server flag | Absolute end timestamp | PASS |
| Big Leap | Cooldown starts only after a valid capture | Server result and fresh delta | PASS |
| Shell Guard | `abilityActiveUntil` | Absolute end timestamp | PASS |
| Golden Current | `abilityActiveUntil` | Absolute end timestamp | PASS |
| Current Push | `currentPushCooldownUntil` | Absolute end timestamp | PASS |
| Lily Barrage | `specialCooldowns.lilyBarrage` | `specialStatus.cooldownEndsAt` and remaining | Standardized |
| Dragonfly Guard | `specialCooldowns.dragonflyGuard` | `specialStatus.cooldownEndsAt` and remaining | Standardized |
| Reed Shield | `specialCooldowns.reedShield` | `specialStatus.cooldownEndsAt` and remaining | Standardized |
| Building construction | `tile.buildingActiveAt` | Remaining construction time | PASS |
| Building upgrade | `tile.buildingActiveAt` | Remaining construction time | PASS |
| Reinforce | `defendCooldownUntil` | Added to full snapshot and delta | Fixed |
| Support | `supportReadyAt` | Absolute end timestamp | PASS |
| Team revive | Pool/one-use rule plus 10s protection/attack lock | Not a reusable cooldown | Expected |
| Lake event effects | Server event `expiresAt`/active snapshot | Server remaining time | PASS |

## Contract

Successful ability responses now contain `actionId`, `success`, `abilityId`, `activatedAt`, `cooldownEndsAt`, `energyAfter`, and `failureReason`. The server also emits `abilityCooldownState`. Failed abilities retain the previous cooldown timestamp and never start a client-only cooldown.

## Drift prevention

The client stores the last server timestamp and its local receive time, then estimates current server time from elapsed monotonic browser time. This affects visuals only; server validation remains authoritative.
