# Update 2 Balance Report

## Design Result

Update 2 improves clarity and consistency without adding hidden attack power. Expansion, combat, defense, buildings, abilities, specials, and support still compete for the same Animal Energy.

## Shared Send Profiles

| Command | Energy | Intended use |
| --- | ---: | --- |
| Probe / Scout / Light Reinforce | 10% | Scout, soften, or make a small defensive correction. |
| Quick Bite / Small Expand / Standard Reinforce | 25% | Low-risk default action. |
| Strong Push / Medium Expand / Strong Reinforce | 50% | Reliable commitment against exposed fronts. |
| Full Wave / Large Expand / Heavy Reinforce | 75% | Break a prepared front at meaningful economic risk. |
| Max Wave / Max Expand / Max Reinforce | 100% | All-in commitment with no reserve left. |

The server rounds committed Animal Energy to a visible integer. Defense spends 78% of the selected send, then converts the spend to stored defense using the shared defense multiplier and animal modifiers.

## Bot Difficulty

| Difficulty | Expansion pace | Reaction | Mistakes | Combat character |
| --- | ---: | --- | ---: | --- |
| Passive | 0% | Disabled | 100% | Does not expand or attack. |
| Easy | 45% | 8-12s | 45% | Rare attacks, slow builds, no early specials. |
| Normal | 70% | 5-8s | 25% | Fair pressure and rare mid-game specials. |
| Hard | 90% | 3-5s | 10% | Stronger decisions without extra resources. |
| Chaos | 110% | 1-3s | 5% | Advanced high-pressure preset. |

Bots continue to use authoritative costs, routes, cooldowns, construction, and energy. Development logs include bot, difficulty, energy, target, decision reason, mistake state, and cooldown.

## Simulation Results

- Reproducible front-line gameplay simulation: 600 seconds, seven active factions, 96 attacks, 484 expansions, 141 builds, 252 defenses, 46 specials, and all five animal factions represented. The QA fixture seeds legal enemy borders so combat coverage does not depend on random spawn distance.
- Three 600-second medium-map samples: average 156.33 builds, 43.33 Lily Farms, and 10.05 average income. Low-density contact was limited during the economy opening.
- Two 1,200-second medium-map samples: average 6.5 attacks, 6 wave captures, 288.5 builds, 98 farms, and 18.48 average income.
- A separate 20-bot Amazon stability run produced 323 attacks, 781 wave captures, 2,413 expansions, 570 builds, 1,873 defenses, and 485 specials over 1,200 seconds.

The samples show a deliberate economy-led opening and a more contested large-map mid-game. Medium maps with low bot density can still have a quiet first ten minutes; this is a pacing preference to monitor rather than a correctness failure.

## Animal Verification

- Duck Flock Rush reduced open-water expansion cost.
- Snake Ambush prepared the next reed/mud frontline attack.
- Frog Big Leap captured a nearby neutral cluster.
- Turtle Shell Guard increased enemy capture cost and defense efficiency.
- Carp Golden Current increased income and reduced water/lily growth cost.

No faction received a universal Update 2 stat increase.
