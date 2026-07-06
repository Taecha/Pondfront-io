# PondFront.io Surrender And Long Match Report

## Summary

This update makes surrender a match setting and defaults it to Off. Bots no longer surrender in normal matches by default. Weak animals now try to survive through defense, recovery, counter-pressure, and a once-per-match Last Stand.

## Surrender Setting

Added match setting:

- `off`
- `bots`
- `everyone`

Default:

- `off`

Server validation:

- If surrender is Off, bot surrender and player surrender are rejected.
- If surrender is Bots Only, only bots may surrender.
- If surrender is Everyone, players and bots may surrender.

UI:

- Main lobby: `Allow Surrender`
- Create lobby: `Allow Surrender`
- Waiting room host settings: `Surrender`
- Sandbox setup: `Surrender`
- In-game settings summary: `Surrender: Off/Bots Only/Everyone`

Sandbox:

- Sandbox setup can start with a surrender mode.
- Sandbox tools include `Toggle Surrender`.
- Sandbox command `/surrender off|bots|everyone` changes the setting during testing.

## Bot Behavior

Bots now check the surrender setting before any surrender logic.

When surrender is blocked, bots keep playing and can:

- reinforce core/front borders
- use defensive animal abilities
- use defensive specials
- build/upgrade defensive economy
- counter-attack weak nearby borders
- expand toward safer animal-favored terrain

Bot survival mode only activates after real pressure or lost ground, so bots do not turtle from the start of a match.

## Elimination Rules

With surrender Off, elimination happens through actual territory loss:

- FFA: an animal is out when it owns 0 playable territory tiles.
- Team mode: a team is out when all team members are eliminated.
- A bot with 1 tile is still alive.

Still not elimination reasons:

- low energy
- low income
- low territory percent
- no target
- being surrounded
- bot AI being stuck

## Last Stand

Added a once-per-match Last Stand system.

Triggers:

- core under attack
- owned tiles collapse below the danger threshold after previously holding more territory
- very low territory after losing ground

Effects:

- 20-30 seconds of core-area defense
- extra recovery income
- core defense energy boost
- visible event: `Last Stand: [name] is defending its final nest!`

## Comeback And Pacing

Added modest comeback support:

- weak animals get a small recovery income floor
- weak animals get a small core defense bonus
- weak animals get a small neutral expansion discount near their own territory/core
- objectives appear earlier
- medium/large/huge maps have more objective points
- core health, core defense energy, and core aura were slightly increased
- very large empires receive a mild defense efficiency penalty so borders are harder to hold everywhere

## QA Results

Passed:

- normal match default surrender is Off
- blocked surrender returns `Surrender is disabled in this match`
- bot with exactly 1 tile remains alive
- surrender in Bots Only mode works
- surrendered territory returns neutral by default
- Last Stand triggers after actual collapse
- 70% territory still does not auto-end match
- 10-minute bot simulation continues without early surrender ending
- bots continue attacking, building, using abilities, and using diplomacy
- syntax check passes for server/shared/client files

