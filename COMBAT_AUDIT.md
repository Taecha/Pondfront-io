# PondFront.io Combat Audit

## What Worked Before

- Frontline wave attacks already existed.
- Attacks spent Animal Energy and created active attack waves.
- Waves captured multiple connected enemy tiles over time.
- Terrain, defense energy, buildings, animal bonuses, and abilities affected capture cost.
- Bots attacked, defended, built, and used animal abilities.
- The client showed attack arrows, wave capture feedback, blocked feedback, and attack previews.
- Mobile double tap could quick attack a valid enemy border.

## What Was Broken Or Risky

- Combat only checked simple alliance status; it did not know about truce or betrayal cooldown.
- An attack wave could theoretically keep moving if diplomacy changed after the wave started.
- Attack preview did not explain truce or betrayal blocking.
- The combat formula existed in code but was not clearly shared for client/server readability.
- War memory existed separately from diplomacy, so player info could feel incomplete.

## What Felt Confusing

- "Cannot attack ally" was clear, but "cannot attack because truce/cooldown" did not exist.
- War status was visible only through older `wars` data, not through a full relationship state.
- Attack preview could say a tile was invalid without explaining the diplomacy reason.
- Bot combat did not understand temporary peace states.

## Upgrades Added

- Added `shared/combatConfig.js` for readable attack formula constants.
- Server combat now checks `game.diplomacy.canAttack(...)` before starting a wave.
- Active waves stop if alliance/truce/betrayal rules start blocking combat mid-wave.
- Server rejects:
  - attacking allies
  - attacking during truce
  - betrayal cooldown attacks by the betrayer
  - too-far enemy tiles
  - attacks with too little Animal Energy
- Client previews now read relationship state and show specific blocked reasons.
- Right-click and long-press menus disable invalid attack actions when diplomacy blocks combat.
- War records now feed diplomacy relationship state and selected-player info.
- Attack formula constants are shared with the client preview path.
- Ping animations now last longer and appear on the minimap.

## Balance Notes

- Duck still pressures open water well.
- Snake still has the strongest reed/mud surprise attacks.
- Frog remains tactical and objective-focused.
- Turtle remains the strongest defensive animal.
- Carp remains economy-oriented and can fuel larger attacks later.
- Truce and alliance behavior lowered bot attack volume in some simulations, but attacks still occur and QA confirms bots keep fighting.

