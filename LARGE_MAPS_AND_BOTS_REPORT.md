# PondFront.io Large Maps and Bots Report

## What changed

Added four large themed maps inspired by real river and swamp environments while keeping the original PondFront.io animal strategy theme:

- Amazon River: 150x90, recommended 20 bots, wide jungle river lanes with island blockers.
- Mekong Delta: 170x100, recommended 22 bots, huge canal maze with rice field blockers and chokepoints.
- Everglades Swamp: 140x84, recommended 18 bots, open marsh map with reeds, mud, lily pools, and grass islands.
- Nile River: 92x142, recommended 16 bots, long river map with desert banks, oasis branches, rocks, and chokepoints.

Classic Large and Huge maps now also support bigger matches:

- Large Lake: 18 default bots, 16-22 range.
- Huge Lake: 22 default bots, 20-26 range.

## Map selector and bots

The lobby map selector now includes:

- Amazon River
- Mekong Delta
- Everglades Swamp
- Nile River
- Random Themed Map
- Small Pond
- Medium Lake
- Large Lake
- Huge Lake

The main lobby now shows a compact map info card with size, bot recommendation, terrain description, and best animals. Bot count options now scale as Low, Normal, High, and Max based on the selected map.

Sandbox Mode also supports the new large maps and larger bot counts up to 26.

## Blocked land rules

The new land terrain types are blocked map terrain:

- Jungle Island
- Rice Field
- Grass Island
- Desert Bank
- Fallen Log
- Village
- Bridge

These tiles cannot be captured, attacked, built on, or used as Current Push routes. They are rendered as map terrain instead of generic gray blocks so the large maps read more like river strategy maps.

## Themed objectives and events

Each themed map uses map-specific objective pools:

- Amazon: Golden Lily Basin, Ancient Reed Wall, Mud Spring, Clear Water Shrine, Deep Current.
- Mekong: Canal Gate, Lotus Field, Mud Market, River Shrine, Deep Current.
- Everglades: Misty Reed, Turtle Camp, Mud Spring, Dragonfly Swarm, Golden Lily.
- Nile: Oasis Shrine, Crocodile Rock, Golden Lotus, River Gate, Clear Water Shrine.

Each themed map also uses a matching event pool such as jungle rain, canal surge, sand wind, flood pulse, oasis bloom, foggy marsh, reed surge, mudslide, and current shifts.

## Visual readability

The canvas renderer now gives the new blockers their own art language:

- Jungle and grass islands use organic green island shapes.
- Rice fields use striped field marks.
- Desert uses sandy banks.
- Logs and bridges read as linear blockers.
- Villages use small roof shapes.
- Minimap uses themed terrain colors instead of one generic blocker color.

Tile info panels now explain when a tile is blocked land and why the player must route around it.

## QA results

Passed:

- `pnpm run check`
- `node scripts/qaPlaytest.js`

Automated map checks passed for:

- All map dimensions.
- Default bot counts.
- Objective counts.
- Themed blocker generation.
- Blocked land rejecting capture.
- Spawn areas staying open.
- Map objectives using the correct themed objective pools.

The QA playtest also passed expansion, buildings, animal abilities, diplomacy, combat, bot attack pacing, elimination rules, and a 10-minute bot simulation.
