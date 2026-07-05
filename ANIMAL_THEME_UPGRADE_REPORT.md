# Animal Theme Upgrade Report

## Goal

Make PondFront.io visibly feel like an animal pond strategy game everywhere, not just in text labels, while keeping gameplay server-authoritative and readable on PC and mobile.

## Shared Animal Visual System

- Added `shared/animalVisuals.js` with visual metadata for Duck, Snake, Frog, Turtle, and Carp.
- Each animal now has a badge color, accent color, role, best terrain, weakness, ability tooltip, attack motif, defense motif, map pose, and victory title.
- Added shared visual metadata for buildings, objectives, critter camps, and team command themes.
- Loaded the new shared visual config in `public/index.html`.

## Lobby And UI

- Lobby animal cards now use the shared visual colors and shaped animal badges instead of plain letters.
- Selected animal card now shows role, terrain, weakness, counterplay, and animal visual identity.
- Lobby player rows now show animal badges and animal roles.
- Top bar animal stat now shows an animal badge beside the animal level.
- Ability panel and Ability button now show animal-themed ability icons.
- Selected player panel now shows animal badge, role, best terrain, and counterplay.
- Leaderboard rows now show animal badges and role text.
- Team member rows now show animal badges.
- Team names were updated from generic colors to pond-themed names while keeping internal IDs stable.
- Team command buttons now use themed icons for splash attack, shell defense, lily help/objective, and current retreat.

## Map And Minimap

- Added Canvas-drawn animal badges and simple animal sprites near each player core/base.
- Strategic View keeps readability by showing badges instead of full sprites.
- Mobile and low-power views reduce animal animation/detail.
- Map nameplates now show animal badge, player name, animal level, and team stripe.
- Minimap now shows animal-colored core markers.
- Core markers on the main map now use the owning animal badge.
- Objective and camp markers now use pond-themed Canvas glyphs instead of only text labels.

## Combat, Defense, Buildings, Objectives

- Attack wave fronts now use animal colors and animal-specific motifs:
  - Duck: feather streaks
  - Snake: fang current
  - Frog: leap splash
  - Turtle: shell wave
  - Carp: scale/current marks
- Reinforced borders now use animal-themed defensive motifs.
- Building markers now draw lightweight pond structure glyphs instead of letters.
- Build sheet now shows building icons, role, and best-animal synergy.
- Objective list now shows themed objective icons and which animals benefit most.
- VFX now uses animal visual colors for player attack and ability feedback.

## Settings And Mobile

- Added settings:
  - Show Animal Icons
  - Show Animal Sprites
  - Show Animal Animations
- PC defaults to animal icons, sprites, and animations on.
- Mobile defaults to icons on with reduced animation.
- Strategic View and low-performance mode reduce animal visual detail automatically.

## Profile And End Screen

- Profile Animals tab now uses the same animal badge system and shows role/terrain.
- Result screen now shows animal badges and animal victory titles:
  - Duck: Pond Rusher
  - Snake: Reed Ambusher
  - Frog: Lily Leaper
  - Turtle: Shell Defender
  - Carp: Golden Current

## Bot Identity

- Added animal-specific bot name pools.
- Bot spawn now chooses names based on the bot animal, such as `Golden Current`, `Frog Hollow`, `Moss Stripe`, and `Stillwater Beak`.

## Validation

- `pnpm run check` passed.
- `/health` returned `200`.
- API start test succeeded with Frog as the human animal.
- API start test confirmed animal-aware bot names and the existing special status data still load correctly.
- Local server is running at `http://localhost:5173/`.

## Remaining QA

- Do a full browser visual pass on several screen sizes after the next UI polish pass.
- Watch map readability on huge maps with many players; lower sprite limits if needed.
- Real-device mobile testing should confirm the new badges remain readable under touch controls.
