# PondFront.io Map And Mobile Test Report

## Map Size Fixes

The lobby map size now changes the real server map config, not only the label.

| Size | Grid | Bot Range | Default Bots | Objectives | Critter Camps | Base Timer |
| --- | --- | --- | --- | --- | --- | --- |
| Small | 60 x 36 | 4-6 | 5 | 2 | 4 | 10 minutes |
| Medium | 90 x 54 | 8-10 | 9 | 4 | 8 | 14 minutes |
| Large | 130 x 78 | 12-16 | 14 | 6 | 14 | 18 minutes |
| Huge | 170 x 100 | 18-24 | 20 | 8 | 20 | 24 minutes |

The server now logs match starts with selected map size, grid, bot count, and spawn validity.

## Runtime Map Tests

Tested with the server game class after implementation:

| Size | Actual Grid | Actual Bots | Actual Objectives | Actual Camps | Spawn Valid |
| --- | --- | --- | --- | --- | --- |
| Small | 60 x 36 | 5 | 2 | 4 | Yes |
| Medium | 90 x 54 | 9 | 4 | 8 | Yes |
| Large | 130 x 78 | 14 | 6 | 14 | Yes |
| Huge | 170 x 100 | 20 | 8 | 20 | Yes |

## Mobile Controls Added

- One finger drag pans the camera.
- Touch pan has light inertia.
- Two finger pinch zooms around the finger midpoint.
- Tap selects a tile.
- Double tap performs the valid quick action: expand, attack, or defend.
- Long press opens the context menu.
- Two finger tap cancels selection and closes menus.
- Minimap tap / drag recenters the camera.
- Mobile buttons: zoom in, zoom out, center, collapse UI, leaderboard.
- Bottom controls use larger mobile touch targets.
- Panels can collapse so the canvas stays playable.

## Mobile Controls Tested

- Syntax checked all updated client files.
- Verified touch handlers are registered on the canvas.
- Verified minimap pointer handlers are registered.
- Verified camera methods exist for zoom, center, minimap recenter, and clamping.
- Verified mobile buttons are present in the HTML.

## Bugs Fixed

- Map size dropdown now affects grid width and height.
- Bot count is clamped per map size.
- Objectives and critter camps scale with map size.
- Spawn points are generated across the whole selected map.
- Practice mode now starts as a true small quick match.
- Camera clamping now respects the actual generated map bounds.
- Shared map settings are served to the browser for lobby behavior.

## Remaining Notes

- Browser pinch simulation is limited in some desktop devtools setups, so final feel should be checked on a real phone or tablet too.
- Huge maps send larger state snapshots because the current prototype remains fully server authoritative.
