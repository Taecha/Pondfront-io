const fs = require("fs");
const path = require("path");
const TileManager = require("../server/TileManager");
const config = require("../shared/gameConfig");

function metricsFor(id, map, seed) {
  const manager = new TileManager(seed, { id, ...map });
  manager.generate();
  const counts = {};
  manager.tiles.forEach((tile) => { counts[tile.type] = (counts[tile.type] || 0) + 1; });
  const playable = manager.playable();
  const playableIds = new Set(playable.map((tile) => tile.id));
  const visited = new Set();
  const components = [];
  const componentByTile = new Map();
  for (const start of playable) {
    if (visited.has(start.id)) continue;
    let size = 0;
    const componentIndex = components.length;
    const queue = [start];
    visited.add(start.id);
    while (queue.length) {
      const tile = queue.pop();
      size += 1;
      componentByTile.set(tile.id, componentIndex);
      tile.neighbors.forEach((neighbor) => {
        if (playableIds.has(neighbor.id) && !visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor);
        }
      });
    }
    components.push(size);
  }
  components.sort((a, b) => b - a);
  const largestComponentSize = components[0] || 0;
  const largestComponentIndex = [...new Set(componentByTile.values())].find((index) => {
    let size = 0;
    componentByTile.forEach((component) => { if (component === index) size += 1; });
    return size === largestComponentSize;
  });
  const validSpawns = manager.spawnPoints.filter(([x, y]) => {
    const tile = manager.get(x, y);
    return tile && !config.TILE_TYPES[tile.type]?.blocks && manager.nearbyPlayableCount(x, y, 3) >= 14;
  }).length;
  const spawnsInLargestComponent = manager.spawnPoints.filter(([x, y]) => componentByTile.get(manager.get(x, y)?.id) === largestComponentIndex).length;
  const total = manager.tiles.length || 1;
  const blocked = manager.tiles.filter((tile) => config.TILE_TYPES[tile.type]?.blocks).length;
  const averagePlayableNeighbors = playable.reduce((sum, tile) => sum + tile.neighbors.filter((neighbor) => playableIds.has(neighbor.id)).length, 0) / Math.max(1, playable.length);
  return {
    id,
    label: map.label,
    grid: `${manager.cols}x${manager.rows}`,
    terrainPct: {
      water: Number((((counts.water || 0) / total) * 100).toFixed(1)),
      reeds: Number((((counts.reeds || 0) / total) * 100).toFixed(1)),
      mud: Number((((counts.mud || 0) / total) * 100).toFixed(1)),
      lily: Number((((counts.lily || 0) / total) * 100).toFixed(1)),
      blocked: Number(((blocked / total) * 100).toFixed(1)),
    },
    playableTiles: playable.length,
    connectedComponents: components.length,
    largestComponentPct: Number((((components[0] || 0) / Math.max(1, playable.length)) * 100).toFixed(2)),
    averagePlayableNeighbors: Number(averagePlayableNeighbors.toFixed(2)),
    spawnCandidates: manager.spawnPoints.length,
    validSpawnCandidates: validSpawns,
    spawnsInLargestComponent,
    configuredObjectives: map.objectiveCount,
    pass:
      largestComponentSize / Math.max(1, playable.length) >= 0.9 &&
      spawnsInLargestComponent === manager.spawnPoints.length &&
      validSpawns >= Math.min(8, map.defaultBots + 1) &&
      averagePlayableNeighbors >= 2.2,
  };
}

const ids = ["amazon", "mekong", "everglades", "nile"];
const maps = ids.map((id, index) => metricsFor(id, config.MAP_SIZES[id], 91001 + index * 97));
const result = { ok: maps.every((map) => map.pass), maps };
fs.writeFileSync(path.join(__dirname, "..", "map-release-metrics.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
