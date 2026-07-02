const config = require("../shared/gameConfig");

class TileManager {
  constructor(seed = Date.now(), map = {}) {
    this.map = {
      id: map.id || "medium",
      cols: Number(map.cols || config.GRID_COLS),
      rows: Number(map.rows || config.GRID_ROWS),
      terrainScale: Number(map.terrainScale || 1),
      objectiveCount: Number(map.objectiveCount || 4),
      campCount: Number(map.campCount || 8),
    };
    this.cols = this.map.cols;
    this.rows = this.map.rows;
    this.seed = seed;
    this.tiles = [];
    this.spawnPoints = this.createSpawnPoints();
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
    const min = Math.min(this.cols, this.rows);
    const r = (ratio) => Math.max(4, Math.round(min * ratio * this.map.terrainScale));
    const at = (name, px, py, radius, type, tone) => ({
      name,
      x: this.clamp(Math.round(this.cols * px), 4, this.cols - 5),
      y: this.clamp(Math.round(this.rows * py), 4, this.rows - 5),
      radius: r(radius),
      type,
      tone,
    });
    const regions = [
      at("Golden Lily Basin", 0.5, 0.5, 0.14, "lily", "#d8ad48"),
      at("North Reed Marsh", 0.23, 0.22, 0.13, "reeds", "#9bb66d"),
      at("Mudfall Delta", 0.76, 0.73, 0.13, "mud", "#a88255"),
      at("North Rock Shoals", 0.76, 0.2, 0.1, "rock", "#a6b2ba"),
      at("Duck Bay", 0.18, 0.78, 0.1, "nest", "#d4aa62"),
      at("Frog Hollow", 0.5, 0.82, 0.12, "lily", "#73b982"),
      at("Willow Reed Gate", 0.5, 0.24, 0.1, "reeds", "#86b66f"),
      at("Quiet Water", 0.34, 0.54, 0.1, "water", "#7ed6df"),
      at("Pebble Crown", 0.13, 0.49, 0.08, "rock", "#b2bec6"),
      at("Snake Channel", 0.86, 0.51, 0.08, "mud", "#b28b5d"),
    ];
    if (this.cols >= 100) {
      regions.push(
        at("Silver Reed Reach", 0.13, 0.16, 0.085, "reeds", "#8fbf78"),
        at("Lotus Crossing", 0.66, 0.56, 0.095, "lily", "#78c48b"),
        at("Cattail Narrows", 0.37, 0.74, 0.085, "reeds", "#9bb66d"),
        at("Deep Center Lake", 0.5, 0.38, 0.095, "water", "#7ed6df"),
      );
    }
    if (this.cols >= 150) {
      regions.push(
        at("West Mud Flats", 0.22, 0.55, 0.09, "mud", "#b28b5d"),
        at("Eastern Lily Shelf", 0.82, 0.28, 0.09, "lily", "#73b982"),
        at("Broken Stone Run", 0.62, 0.18, 0.075, "rock", "#a6b2ba"),
        at("South Reed Pocket", 0.71, 0.86, 0.085, "reeds", "#86b66f"),
      );
    }
    return regions;
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
        this.point(0.08, 0.12),
        this.point(0.28, 0.28),
        this.point(0.5, 0.5),
        this.point(0.72, 0.72),
        this.point(0.92, 0.88),
      ],
      [
        this.point(0.92, 0.12),
        this.point(0.74, 0.28),
        this.point(0.5, 0.5),
        this.point(0.26, 0.72),
        this.point(0.08, 0.88),
      ],
      [
        this.point(0.5, 0.1),
        this.point(0.52, 0.33),
        this.point(0.5, 0.5),
        this.point(0.48, 0.78),
        this.point(0.5, 0.9),
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
      objectiveId: null,
      objectiveType: null,
      campId: null,
      campType: null,
      specialActive: false,
      lastChanged: 0,
      neighbors: [],
    };
  }

  createSpawnPoints() {
    const rings = [
      [0.08, 0.12],
      [0.92, 0.88],
      [0.08, 0.88],
      [0.92, 0.12],
      [0.5, 0.1],
      [0.5, 0.9],
      [0.15, 0.5],
      [0.85, 0.5],
      [0.28, 0.2],
      [0.72, 0.8],
      [0.28, 0.8],
      [0.72, 0.2],
      [0.4, 0.35],
      [0.6, 0.65],
      [0.18, 0.28],
      [0.82, 0.72],
      [0.36, 0.12],
      [0.64, 0.88],
      [0.36, 0.88],
      [0.64, 0.12],
      [0.36, 0.5],
      [0.64, 0.5],
      [0.22, 0.66],
      [0.78, 0.34],
      [0.5, 0.28],
      [0.5, 0.72],
    ];
    return rings.map(([x, y]) => this.point(x, y));
  }

  point(px, py) {
    return [
      this.clamp(Math.round(this.cols * px), 4, this.cols - 5),
      this.clamp(Math.round(this.rows * py), 4, this.rows - 5),
    ];
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
