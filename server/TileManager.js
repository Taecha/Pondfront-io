const config = require("../shared/gameConfig");

class TileManager {
  constructor(seed = Date.now()) {
    this.cols = config.GRID_COLS;
    this.rows = config.GRID_ROWS;
    this.seed = seed;
    this.tiles = [];
    this.spawnPoints = [
      [7, 7],
      [76, 46],
      [7, 46],
      [76, 7],
      [42, 7],
      [42, 46],
      [13, 27],
      [70, 27],
      [24, 13],
      [59, 40],
      [24, 40],
      [59, 13],
      [35, 20],
      [49, 34],
      [15, 16],
      [68, 38],
      [30, 7],
      [54, 46],
      [30, 47],
      [54, 7],
      [30, 27],
      [54, 27],
    ];
    this.regions = this.createRegions();
  }

  generate() {
    const rand = this.random(this.seed);
    this.tiles = [];
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const edge = x < 2 || y < 2 || x > this.cols - 3 || y > this.rows - 3;
        const flow = this.noise(x, y);
        const roll = rand();
        let type = "water";

        if (edge && roll < 0.14) type = "rock";
        else if (flow > 0.83 && roll < 0.16) type = "rock";
        else if (flow > 0.65 && roll < 0.28) type = "reeds";
        else if (roll < 0.03) type = "lily";
        else if (roll < 0.07) type = "reeds";
        else if (roll < 0.105) type = "mud";
        else if (roll < 0.128) type = "nest";

        this.tiles.push(this.createTile(x, y, type));
      }
    }
    this.paintStrategicRegions(rand);
    this.carveWaterPaths();
    this.clearSpawnAreas();
    this.linkNeighbors();
    return this.tiles;
  }

  createRegions() {
    return [
      { name: "Golden Lily Reach", x: 42, y: 27, radius: 9, type: "lily", tone: "#d8ad48" },
      { name: "Ancient Reed Marsh", x: 19, y: 13, radius: 8, type: "reeds", tone: "#9bb66d" },
      { name: "Misty Mud Basin", x: 65, y: 39, radius: 8, type: "mud", tone: "#a88255" },
      { name: "North Rock Shoals", x: 65, y: 12, radius: 6, type: "rock", tone: "#a6b2ba" },
      { name: "Stillwater Nests", x: 16, y: 42, radius: 6, type: "nest", tone: "#d4aa62" },
      { name: "Delta Bloom", x: 42, y: 44, radius: 7, type: "lily", tone: "#73b982" },
      { name: "Willow Reed Gate", x: 42, y: 14, radius: 6, type: "reeds", tone: "#86b66f" },
      { name: "Bluewater Crossing", x: 28, y: 29, radius: 6, type: "water", tone: "#7ed6df" },
      { name: "Pebble Crown", x: 11, y: 26, radius: 5, type: "rock", tone: "#b2bec6" },
      { name: "Moonlit Mud Flats", x: 72, y: 27, radius: 5, type: "mud", tone: "#b28b5d" },
    ];
  }

  paintStrategicRegions(rand) {
    this.regions.forEach((region) => {
      for (let y = Math.floor(region.y - region.radius); y <= region.y + region.radius; y += 1) {
        for (let x = Math.floor(region.x - region.radius); x <= region.x + region.radius; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const d = Math.hypot(x - region.x, y - region.y);
          if (d > region.radius) continue;
          const density = 1 - d / region.radius;
          const roll = rand();
          if (region.type === "rock") {
            if (density > 0.55 && roll < 0.42) tile.type = "rock";
            else if (roll < 0.26) tile.type = "mud";
          } else if (region.type === "water") {
            if (roll < 0.76 + density * 0.18) tile.type = "water";
            else if (roll < 0.86) tile.type = "lily";
          } else if (roll < 0.38 + density * 0.38) {
            tile.type = region.type;
          } else if (region.type === "lily" && roll < 0.72) {
            tile.type = "water";
          }
        }
      }
    });
  }

  carveWaterPaths() {
    const paths = [
      [
        [7, 7],
        [23, 15],
        [42, 27],
        [61, 38],
        [76, 46],
      ],
      [
        [76, 7],
        [63, 14],
        [42, 27],
        [22, 39],
        [7, 46],
      ],
      [
        [42, 7],
        [43, 18],
        [42, 27],
        [42, 44],
        [42, 46],
      ],
    ];

    paths.forEach((points) => {
      for (let i = 1; i < points.length; i += 1) {
        this.carveSegment(points[i - 1], points[i], 2);
      }
    });
  }

  carveSegment(from, to, radius) {
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
    for (let i = 0; i <= steps; i += 1) {
      const t = steps ? i / steps : 0;
      const cx = Math.round(from[0] + (to[0] - from[0]) * t);
      const cy = Math.round(from[1] + (to[1] - from[1]) * t);
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const d = Math.abs(x - cx) + Math.abs(y - cy);
          if (d <= radius && tile.type === "rock") tile.type = "water";
          else if (d <= 1 && tile.type !== "nest") tile.type = "water";
        }
      }
    }
  }

  createTile(x, y, type) {
    return {
      id: y * this.cols + x,
      x,
      y,
      type,
      owner: null,
      building: null,
      buildingLevel: 0,
      buildingActiveAt: 0,
      captureProgress: {},
      defenseEnergy: 0,
      lastChanged: 0,
      neighbors: [],
    };
  }

  clearSpawnAreas() {
    this.spawnPoints.forEach(([sx, sy]) => {
      for (let y = sy - 3; y <= sy + 3; y += 1) {
        for (let x = sx - 3; x <= sx + 3; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const d = Math.abs(x - sx) + Math.abs(y - sy);
          if (d <= 3) tile.type = d === 0 ? "nest" : "water";
        }
      }
    });
  }

  linkNeighbors() {
    this.tiles.forEach((tile) => {
      tile.neighbors = [
        this.get(tile.x, tile.y - 1),
        this.get(tile.x + 1, tile.y),
        this.get(tile.x, tile.y + 1),
        this.get(tile.x - 1, tile.y),
      ].filter(Boolean);
    });
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.tiles[y * this.cols + x];
  }

  getById(id) {
    return this.tiles[id] || null;
  }

  owned(playerId) {
    return this.tiles.filter((tile) => tile.owner === playerId);
  }

  playable() {
    return this.tiles.filter((tile) => !config.TILE_TYPES[tile.type].blocks);
  }

  isBorder(tile, playerId) {
    return Boolean(
      tile &&
        tile.owner === playerId &&
        tile.neighbors.some((neighbor) => neighbor.owner !== playerId && !config.TILE_TYPES[neighbor.type].blocks),
    );
  }

  borders(playerId) {
    return this.tiles.filter((tile) => this.isBorder(tile, playerId));
  }

  capturable(playerId) {
    const seen = new Set();
    const options = [];
    this.borders(playerId).forEach((tile) => {
      tile.neighbors.forEach((neighbor) => {
        if (seen.has(neighbor.id) || neighbor.owner === playerId || config.TILE_TYPES[neighbor.type].blocks) return;
        seen.add(neighbor.id);
        options.push(neighbor);
      });
    });
    return options;
  }

  claimStart(player, spawnIndex, now) {
    const [sx, sy] = this.spawnPoints[spawnIndex % this.spawnPoints.length];
    const core = this.get(sx, sy);
    if (core) player.coreTileId = core.id;
    for (let y = sy - 2; y <= sy + 2; y += 1) {
      for (let x = sx - 2; x <= sx + 2; x += 1) {
        const tile = this.get(x, y);
        if (!tile || config.TILE_TYPES[tile.type].blocks) continue;
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d <= 2) {
          tile.owner = player.id;
          tile.captureProgress = {};
          tile.lastChanged = now;
          tile.defenseEnergy = d === 0 ? 8 : 2;
        }
      }
    }
  }

  borderReachInfo(player, target, sourceIds = []) {
    if (!target || config.TILE_TYPES[target.type].blocks || target.owner === player.id) {
      return { reachable: false, source: null, jumped: false };
    }

    const selectedSources = sourceIds
      .map((id) => this.getById(id))
      .filter((tile) => tile && this.isBorder(tile, player.id));
    const sources = selectedSources.length ? selectedSources : this.borders(player.id);

    for (const source of sources) {
      if (source.neighbors.includes(target)) return { reachable: true, source, jumped: false };
    }

    return { reachable: false, source: null, jumped: false };
  }

  reachInfo(player, target, sourceIds = []) {
    const borderReach = this.borderReachInfo(player, target, sourceIds);
    if (borderReach.reachable || !target || config.TILE_TYPES[target.type].blocks || target.owner === player.id) {
      return borderReach;
    }

    const selectedSources = sourceIds
      .map((id) => this.getById(id))
      .filter((tile) => tile && this.isBorder(tile, player.id));
    const sources = selectedSources.length ? selectedSources : this.borders(player.id);

    if (player.animal === "frog") {
      const range = player.flags.jumpPad ? 3 : 2;
      for (const source of sources) {
        const d = Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
        if (d > 1 && d <= range) return { reachable: true, source, jumped: true };
      }
    }

    return { reachable: false, source: null, jumped: false };
  }

  random(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  noise(x, y) {
    return (Math.sin((x + this.seed * 0.01) * 0.4) + Math.cos((y - this.seed * 0.02) * 0.52) + Math.sin((x + y) * 0.2) + 3) / 6;
  }
}

module.exports = TileManager;
