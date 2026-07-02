# PondFront.io New Animals Report

## Added Animals

### Turtle
- Role: defensive tank.
- Ability: Shell Guard.
- Core feel: slower early expansion, stronger borders, better defensive value from Reed Guards.
- Server rules added:
  - Turtle neutral expansion costs slightly more.
  - Turtle-owned border tiles cost more for enemies to capture.
  - Turtle gets extra defense value on mud tiles and tiles near rocks.
  - Turtle defend actions store more defense energy.
  - Shell Guard temporarily raises enemy capture cost against Turtle borders.
- Intended weakness:
  - Lower attack pressure and slower land grab than Duck, Frog, or Carp.

### Carp
- Role: economy scaler.
- Ability: Golden Current.
- Core feel: strong water/lily economy that becomes dangerous if not pressured.
- Server rules added:
  - Carp gains extra income from water.
  - Carp gains extra income from lily pads.
  - Carp gets a small bonus from connected water groups.
  - Lily Farms are cheaper for Carp.
  - Golden Current temporarily boosts income and lowers water/lily expansion cost.
- Intended weakness:
  - Slightly weaker defense and vulnerable if rushed before the economy grows.

## Files Updated

- `shared/animals.js`: added Turtle and Carp definitions.
- `shared/balanceConfig.js`: added Turtle and Carp balance constants.
- `shared/gameConfig.js`: added player colors, bot names, and animal-specific capture cost modifiers.
- `server.js`: validates selected animal and distributes bots across all five animals.
- `server/EconomyManager.js`: added Carp income and Turtle Reed Guard scaling.
- `server/CombatManager.js`: added Shell Guard, Golden Current, Turtle defense, Carp economy attack modifiers, and status data.
- `server/BotManager.js`: added Turtle and Carp AI expansion, building, attack, defense, and ability behavior.
- `server/EventManager.js`: added helpful event bias for Turtle and Carp.
- `server/ProgressionManager.js`: added level 5 titles.
- `public/index.html`: added Turtle and Carp to the lobby animal selector.
- `public/ui.js`: added lobby descriptions and UI metadata.
- `public/infoPanel.js`: added tooltips, ability tips, and Carp cost display support.
- `public/game.js`: added client-side previews for Golden Current and Carp building discounts.
- `public/helpMenu.js`: added Turtle and Carp help cards.
- `public/vfx.js`: added Shell Guard and Golden Current visual effects.
- `public/style.css`: added Turtle and Carp colors and lobby styling.
- `scripts/qaPlaytest.js`: added ability tests and bot species coverage checks.
- `scripts/simulateBalance.js`: now simulates all five animals.

## Test Results

Commands run with the bundled Node runtime:

```text
node --check on 22 project files
Result: passed
```

```text
node scripts/qaPlaytest.js
Result: passed
Checks: 27 passed, 0 failed
```

Important QA checks:
- Turtle Shell Guard increased enemy capture cost from 39 to 46.
- Carp Golden Current increased income from 2.9 to 3.7.
- Carp Golden Current reduced water/lily capture cost from 11 to 9.
- 10 minute smart-bot simulation launched 194 attacks, used 24 abilities, and built 106 buildings.
- Bot roster included Duck, Snake, Frog, Turtle, and Carp.

Balance simulation:

```text
node scripts/simulateBalance.js
Result: passed
Matches: 10
Average duration: 840s
Average attacks: 393.6
Average builds: 373.6
Average income: 21.23
```

The 10-match balance run produced winners from multiple animal families, including Turtle and Carp themed bots. That suggests the two new animals are playable without immediately dominating every match.

## Balance Notes

- Turtle should feel safest when holding borders, objectives, mud, and rock-adjacent fronts.
- Carp should feel best when expanding through water/lily clusters and building Lily Farms.
- Turtle is intentionally not the fastest attacker.
- Carp is intentionally not the best defender.
- If future playtests show Turtle matches are too slow, lower `turtleExpansionCostMultiplier`.
- If future playtests show Carp snowballs too hard, lower `carpWaterIncomeBonus`, `carpLilyBonus`, or `goldenCurrentIncomeMultiplier`.

