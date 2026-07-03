# PondFront.io Economy, Mobile, Bots, And Theme Report

## Implemented

### Economy Rework

- Removed the hard Lily Farm limit.
- Removed the hidden Lily/Nest adjacency requirement for Lily Farms.
- Added server-authoritative construction time for buildings.
- Added scaling building costs for all building types.
- Lily Farm now starts at 40 Animal Energy and scales upward by owned count.
- Lily Farm income was reduced slightly and gets a soft efficiency penalty if farms outpace territory.
- Building tooltips and sheets now explain the simpler rule: costs rise when you build more of the same building.

### Building Construction Time

- Buildings now take time to finish instead of blocking all future builds.
- Base construction time is 10 seconds in `shared/balanceConfig.js`.
- Upgrades take 8 seconds.
- The server keeps the building inactive until `buildingActiveAt`.
- Players can start another building immediately if they have a valid tile and enough Animal Energy.
- PC and mobile UI show tile-specific `Under construction Xs` text.

### Upgrade Clarity

- Upgrades still support Level 1, Level 2, and Level 3.
- Upgrade cost now follows a clear server formula.
- Mobile build sheet shows upgrade cost, level, construction time, and why upgrade is unavailable.

### Match Ending Rework

- Removed timeout victory and 70% territory victory from `checkWin`.
- Solo/FFA now ends only when one active animal/player remains.
- Team modes end only when one active team remains.
- Top bar now shows elapsed time and animals/teams left.
- End screen now shows time survived and peak income.

### Elimination / Absorb

- No territory now triggers eliminated state and an elimination notification.
- Core Nest capture starts Last Stand pressure.
- If a player does not recover their Core Nest after the Last Stand window, they are surrendered/absorbed.
- Surrender and elimination events are shown in UI/VFX/audio.

### Bot Fighting

- Bot aggression now scales after 2 minutes, after 5 minutes, and when fewer animals remain.
- Bots value objectives more strongly.
- Bots attack leaders and weak/revenge targets more often.
- Bot attack cooldowns are shorter in mid/late game.
- Late-game weak bots surrender more reliably, helping elimination matches resolve.
- Development bot attack logs now include bot name, target name, reason, and sent energy.

### Mobile UI

- Mobile top bar is more compact.
- Left info panel is hidden on mobile by default; tile details remain available through the Info bottom sheet.
- Minimap is smaller by default.
- Mobile map controls and action card are smaller and closer to the bottom edge.
- Build sheet explains construction time, cost, terrain, animal locks, and energy needs.

### Pond / River Theme

- Added a stronger pond/river visual skin through CSS overrides:
  - darker river water gradients
  - subtle water-line texture
  - reed/lily-tinted panel accents
  - warmer gold/lily highlights
  - glass-water panels
- Lobby and in-game panels no longer read as plain flat blue.

## Server-Authoritative Rules

The server now controls:

- building construction timer
- scaling building costs
- build/upgrade validation
- income calculation
- elimination checks
- timeout removal
- bot aggression and surrender

The client only displays server state and sends build/upgrade/action requests.

## Verification

Syntax checks passed for:

- shared balance config
- server game
- economy manager
- bot manager
- core manager
- combat manager
- client game/UI/info/VFX/audio files
- QA and simulation scripts

`scripts/qaPlaytest.js` passed.

Important passing checks:

- building effect waits for construction
- can start another building while one constructs
- Lily Farm cost scales upward: 40 -> 54
- Lily Farm increases income: 3.6 -> 4.6
- bots launch attacks: 187 attacks in 10-minute QA sim
- bots use abilities
- bots build economy/defense
- diplomacy still blocks ally attacks

Focused smoke test passed:

- Lily Farm builds with no hard limit rule
- global build cooldown removed
- building effect waits until construction completes
- same building cost scales after build
- timeout does not end match
- single remaining player ends match

Bot-only simulation:

- 3 short medium-map simulations ran to 1200 seconds with heavy combat.
- 1 longer medium-map simulation ended by elimination at about 1346 seconds.

## Notes

- No artificial timeout winner remains.
- Match pace setting is still present in lobby as setup pacing, not a win timer.
- Full swipe gestures for mobile bottom sheets were not added in this pass.
- Objective minimap tap expansion was not rebuilt in this pass, but objective ownership and bot objective fighting were improved.
