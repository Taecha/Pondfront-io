# Pointer And Spawn Audit

## Pointer Coordinate Findings

- All map actions already passed browser `clientX/clientY` into the renderer, but the renderer assumed the canvas CSS size and drawing-buffer logical size always matched.
- The canvas was resized only on `window.resize`. Grid changes, side-panel layout changes, mobile rotation, visual viewport changes, and CSS resizing could temporarily stretch the old drawing buffer.
- The camera transform was not applied twice. Device pixel ratio was applied to the Canvas context once, but pointer conversion did not explicitly invert drawing-buffer-to-CSS scaling.
- Long press captured the tile and coordinates from pointer down instead of using the finger's final stable position.
- Square tiles were selected with row/column flooring, without an explicit containment check or hover-edge hysteresis.

## Pointer Fix

- Added `shared/pointerMath.js` as the canonical conversion for browser point, Canvas point, world point, and square-tile containment.
- Canvas drawing-buffer size, CSS size, DPR, camera center, and camera zoom are now inverted exactly once.
- Added `ResizeObserver`, visual viewport resize, orientation change, and debounced resize handling while preserving camera position.
- Click, hover, right-click, touch tap, long press, wheel zoom, build, attack, special, objective, and spawn targeting all use `renderer.screenToTile()`.
- Clicks use exact containment. Hover alone uses a 1.1-pixel boundary hysteresis to prevent flicker without changing click targets.
- Long press now resolves the final captured pointer position and pointer capture is released on up/cancel.
- Developer mode (`?debug=1`) exposes **Show Tile Hitboxes**, including screen/Canvas/world coordinates, camera, DPR, candidate tiles, hover, and selection.

## Spawn Rejection Findings

- The server could inspect any playable tile, but the client refused to send a reservation unless the exact tile ID appeared in a sparse sampled candidate list. Large maps sampled every 3–4 tiles, making visually good water appear invalid.
- Bot reservations were finalized before the human selected, with separation reaching 15 tiles on large maps. Twenty circular exclusions could make the map look almost completely unavailable.
- Candidate generation and client messages emphasized sampled markers rather than practical nearby water.

## Spawn Fix

- Any clicked tile now reaches server-authoritative validation.
- Invalid clicks can snap only within three tiles to the closest valid water and clearly report the adjustment.
- Sample spacing is denser, candidate capacity is higher, and markers are labeled Good Spawn, Wide Water, or Defendable.
- Minimum separation now scales with playable area and player count, remains at least four tiles, and relaxes slightly for 20+ players.
- Together/Nearby teammate distances remain non-overlapping but no longer consume excessive map area.
- Standard objective clearance is three tiles; objective-control modes use five.
- Candidate requirements allow shoreline starts with two useful expansion routes and at least 13 nearby playable tiles.
- Bots avoid several distributed human-priority candidate zones unless they are allied teammates.
- Added Find Available Spawn, Random Spawn, View My Spawn, Fit Map, exact invalid reasons, and a compact mobile action layout.

## Files Changed

- `shared/pointerMath.js`
- `shared/spawnConfig.js`
- `public/index.html`
- `public/game.js`
- `public/render.js`
- `public/ui.js`
- `public/style.css`
- `server/SpawnManager.js`
- `server.js`
- `scripts/pointerSpawnTest.js`
- `scripts/spawnModesTest.js`
