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
      label: map.label || map.id || "",
      defaultBots: Number(map.defaultBots || 0),
      theme: map.theme || "",
      blockedTypes: Array.isArray(map.blockedTypes) ? map.blockedTypes : [],
      objectiveTypes: Array.isArray(map.objectiveTypes) ? map.objectiveTypes : [],
      eventTypes: Array.isArray(map.eventTypes) ? map.eventTypes : [],
      regions: Array.isArray(map.regions) ? map.regions : null,
      spawnPoints: Array.isArray(map.spawnPoints) ? map.spawnPoints : null,
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
    if (this.map.theme) this.generateThemedBase(rand);
    else this.generateClassicBase(rand);

    this.paintStrategicRegions(rand);
    if (this.map.theme) {
      this.carveThemedChannels(rand);
      this.decorateThemedTerrain(rand);
      this.rebalanceThemedTerrain(rand);
    } else {
      this.carveWaterPaths();
    }
    this.rebalanceSpawnPoints();
    this.clearSpawnAreas();
    this.linkNeighbors();
    this.cachePlayableTiles();
    return this.tiles;
  }

  generateClassicBase(rand) {
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
  }

  generateThemedBase(rand) {
    const theme = this.map.theme;
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const edge = x < 2 || y < 2 || x > this.cols - 3 || y > this.rows - 3;
        const flow = this.noise(x, y);
        const band = this.noise(x * 0.47 + 31, y * 0.58 + 17);
        const roll = rand();
        let type = "water";

        if (theme === "amazon") {
          if (edge && roll < 0.48) type = "jungleIsland";
          else if (flow > 0.88 && roll < 0.26) type = "jungleIsland";
          else if (flow > 0.77 && roll < 0.08) type = "mud";
          else if (band > 0.82 && roll < 0.04) type = "reeds";
        } else if (theme === "mekong") {
          if (edge && roll < 0.56) type = "riceField";
          else if (flow > 0.86 && roll < 0.24) type = "riceField";
          else if (band > 0.86 && roll < 0.04) type = "village";
          else if (flow > 0.76 && roll < 0.07) type = "mud";
        } else if (theme === "nile") {
          const riverCenter = 0.5 + Math.sin(y * 0.075 + this.seed * 0.001) * 0.08;
          const horizontalDistance = Math.abs(x / Math.max(1, this.cols - 1) - riverCenter);
          if (edge && roll < 0.68) type = "desert";
          else if (horizontalDistance > 0.4 && roll < 0.7) type = "desert";
          else if (horizontalDistance > 0.34 && roll < 0.45) type = "desert";
          else if (flow > 0.9 && roll < 0.06) type = "rock";
        } else if (theme === "everglades") {
          if (edge && roll < 0.18) type = "grassIsland";
          else if (flow > 0.84 && roll < 0.28) type = "grassIsland";
          else if (flow > 0.68 && roll < 0.38) type = "reeds";
          else if (roll < 0.09) type = "lily";
          else if (roll < 0.19) type = "mud";
        }

        this.tiles.push(this.createTile(x, y, type));
      }
    }
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
    if (this.map.regions?.length) {
      return this.map.regions.map(([name, px, py, radius, type, tone]) => at(name, px, py, radius, type, tone));
    }
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
    const themed = Boolean(this.map.theme);
    this.regions.forEach((region) => {
      for (let y = Math.floor(region.y - region.radius); y <= region.y + region.radius; y += 1) {
        for (let x = Math.floor(region.x - region.radius); x <= region.x + region.radius; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const d = Math.hypot(x - region.x, y - region.y);
          if (d > region.radius) continue;
          const density = 1 - d / region.radius;
          const roll = rand();
          if (themed && region.type === "nest") {
            if (roll < 0.55 + density * 0.18) tile.type = "water";
            else if (roll < 0.82) tile.type = "lily";
            else tile.type = "mud";
            continue;
          }
          if (region.type === "rock") {
            if (density > 0.55 && roll < (themed ? 0.2 : 0.42)) tile.type = "rock";
            else if (roll < (themed ? 0.18 : 0.26)) tile.type = "mud";
          } else if (region.type === "water") {
            if (roll < 0.76 + density * 0.18) tile.type = "water";
            else if (roll < 0.86) tile.type = "lily";
          } else if (roll < (themed ? 0.18 + density * 0.26 : 0.38 + density * 0.38)) {
            tile.type = region.type;
          } else if ((region.type === "lily" || themed) && roll < 0.72) {
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

  carveThemedChannels(rand) {
    const theme = this.map.theme;
    const percentPath = (points) => points.map(([x, y]) => this.point(x, y));
    const carvePath = (points, radius, style = {}) => {
      const resolved = percentPath(points);
      for (let i = 1; i < resolved.length; i += 1) {
        this.carveThemedSegment(resolved[i - 1], resolved[i], radius, rand, style);
      }
    };

    if (theme === "amazon") {
      carvePath(
        [
          [0.02, 0.22],
          [0.18, 0.28],
          [0.34, 0.46],
          [0.54, 0.5],
          [0.72, 0.62],
          [0.98, 0.78],
        ],
        5,
        { bank: "mud", edge: "reeds", lilyChance: 0.035 },
      );
      [
        [[0.18, 0.28], [0.16, 0.52], [0.28, 0.75]],
        [[0.36, 0.46], [0.42, 0.2], [0.62, 0.12]],
        [[0.55, 0.5], [0.7, 0.36], [0.88, 0.28]],
        [[0.7, 0.62], [0.58, 0.78], [0.46, 0.9]],
      ].forEach((path) => carvePath(path, 3, { bank: "mud", edge: "reeds", lilyChance: 0.05 }));
      this.addPools(rand, [
        [0.48, 0.5, 7, "lily"],
        [0.78, 0.72, 6, "water"],
        [0.27, 0.68, 6, "mud"],
      ]);
    } else if (theme === "mekong") {
      carvePath(
        [
          [0.04, 0.5],
          [0.18, 0.42],
          [0.34, 0.55],
          [0.5, 0.46],
          [0.66, 0.58],
          [0.96, 0.48],
        ],
        3,
        { bank: "mud", edge: "reeds", lilyChance: 0.06 },
      );
      for (let i = 0; i < 9; i += 1) {
        const y = 0.16 + i * 0.085;
        carvePath(
          [
            [0.08, y],
            [0.28, y + (i % 2 ? 0.04 : -0.04)],
            [0.5, y],
            [0.72, y + (i % 2 ? -0.035 : 0.035)],
            [0.92, y],
          ],
          i % 3 === 0 ? 2 : 1,
          { bank: "mud", edge: "reeds", lilyChance: 0.055 },
        );
      }
      for (let i = 0; i < 7; i += 1) {
        const x = 0.16 + i * 0.115;
        carvePath(
          [
            [x, 0.08],
            [x + (i % 2 ? 0.035 : -0.035), 0.28],
            [x, 0.5],
            [x + (i % 2 ? -0.035 : 0.035), 0.72],
            [x, 0.92],
          ],
          1,
          { bank: "mud", edge: "reeds", lilyChance: 0.05 },
        );
      }
      this.addPools(rand, [
        [0.34, 0.28, 6, "lily"],
        [0.5, 0.5, 5, "water"],
        [0.68, 0.68, 6, "mud"],
        [0.74, 0.24, 5, "nest"],
      ]);
    } else if (theme === "everglades") {
      carvePath(
        [
          [0.08, 0.18],
          [0.24, 0.34],
          [0.5, 0.5],
          [0.76, 0.66],
          [0.92, 0.82],
        ],
        4,
        { bank: "reeds", edge: "mud", lilyChance: 0.08 },
      );
      carvePath(
        [
          [0.1, 0.82],
          [0.28, 0.62],
          [0.5, 0.5],
          [0.72, 0.38],
          [0.9, 0.18],
        ],
        4,
        { bank: "reeds", edge: "mud", lilyChance: 0.08 },
      );
      this.addPools(rand, [
        [0.5, 0.5, 9, "lily"],
        [0.3, 0.64, 7, "mud"],
        [0.7, 0.62, 7, "mud"],
        [0.5, 0.28, 8, "reeds"],
        [0.28, 0.28, 7, "water"],
        [0.72, 0.74, 7, "water"],
      ]);
    } else if (theme === "nile") {
      carvePath(
        [
          [0.5, 0.02],
          [0.44, 0.18],
          [0.56, 0.34],
          [0.46, 0.5],
          [0.58, 0.68],
          [0.5, 0.98],
        ],
        5,
        { bank: "mud", edge: "reeds", lilyChance: 0.018 },
      );
      [
        [[0.46, 0.2], [0.28, 0.24], [0.22, 0.33]],
        [[0.56, 0.36], [0.76, 0.42], [0.82, 0.5]],
        [[0.46, 0.58], [0.28, 0.62], [0.22, 0.72]],
        [[0.56, 0.74], [0.7, 0.8], [0.78, 0.88]],
      ].forEach((path) => carvePath(path, 3, { bank: "mud", edge: "reeds", lilyChance: 0.035 }));
      this.addPools(rand, [
        [0.32, 0.24, 6, "lily"],
        [0.44, 0.58, 6, "lily"],
        [0.52, 0.72, 5, "reeds"],
        [0.6, 0.42, 4, "rock"],
      ]);
    }
  }

  carveThemedSegment(from, to, radius, rand, style = {}) {
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
    for (let i = 0; i <= steps; i += 1) {
      const t = steps ? i / steps : 0;
      const wobble = Math.sin(t * Math.PI * 2 + this.seed * 0.01) * Math.min(2, radius * 0.35);
      const cx = Math.round(from[0] + (to[0] - from[0]) * t + wobble);
      const cy = Math.round(from[1] + (to[1] - from[1]) * t);
      for (let y = cy - radius - 1; y <= cy + radius + 1; y += 1) {
        for (let x = cx - radius - 1; x <= cx + radius + 1; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d > radius + 0.75) continue;
          const roll = rand();
          if (d <= Math.max(1, radius - 1)) {
            tile.type = roll < (style.lilyChance || 0) ? "lily" : "water";
          } else if (d <= radius) {
            tile.type = roll < 0.62 ? style.bank || "mud" : style.edge || "reeds";
          } else if (roll < 0.35) {
            tile.type = style.edge || "reeds";
          }
        }
      }
    }
  }

  addPools(rand, pools = []) {
    pools.forEach(([px, py, radius, preferred]) => {
      const [cx, cy] = this.point(px, py);
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d > radius) continue;
          const roll = rand();
          if (preferred === "rock") tile.type = d < radius * 0.45 ? "rock" : roll < 0.62 ? "water" : "mud";
          else if (preferred === "lily") tile.type = d < radius * 0.5 && roll < 0.72 ? "lily" : roll < 0.82 ? "water" : "reeds";
          else if (preferred === "mud") tile.type = d < radius * 0.62 && roll < 0.72 ? "mud" : roll < 0.86 ? "water" : "reeds";
          else if (preferred === "reeds") tile.type = d < radius * 0.62 && roll < 0.72 ? "reeds" : roll < 0.88 ? "water" : "lily";
          else if (preferred === "nest") tile.type = d < radius * 0.34 ? "nest" : roll < 0.8 ? "water" : "lily";
          else tile.type = roll < 0.88 ? "water" : "lily";
        }
      }
    });
  }

  decorateThemedTerrain(rand) {
    const theme = this.map.theme;
    this.tiles.forEach((tile) => {
      const type = config.TILE_TYPES[tile.type];
      const roll = rand();
      const flow = this.noise(tile.x, tile.y);
      if (type?.blocks) {
        if (theme === "amazon" && tile.type === "jungleIsland" && flow > 0.84 && roll < 0.08) tile.type = "log";
        if (theme === "mekong" && tile.type === "riceField" && roll < 0.012) tile.type = flow > 0.72 ? "village" : "bridge";
        if (theme === "nile" && tile.type === "desert" && flow > 0.86 && roll < 0.035) tile.type = "rock";
        return;
      }
      if (tile.type !== "water") return;
      if (theme === "amazon") {
        if (roll < 0.035) tile.type = "lily";
        else if (roll < 0.09) tile.type = "reeds";
        else if (roll < 0.17) tile.type = "mud";
        else if (roll > 0.996) tile.type = "log";
      } else if (theme === "mekong") {
        if (roll < 0.045) tile.type = "lily";
        else if (roll < 0.12) tile.type = "reeds";
        else if (roll < 0.22) tile.type = "mud";
        else if (roll > 0.997) tile.type = "bridge";
      } else if (theme === "everglades") {
        if (roll < 0.1) tile.type = "lily";
        else if (roll < 0.25) tile.type = "reeds";
        else if (roll < 0.37) tile.type = "mud";
        else if (roll > 0.996) tile.type = "log";
      } else if (theme === "nile") {
        if (roll < 0.022) tile.type = "lily";
        else if (roll < 0.052) tile.type = "reeds";
        else if (roll < 0.08) tile.type = "mud";
        else if (roll > 0.997) tile.type = "rock";
      }
    });
  }

  rebalanceThemedTerrain(rand) {
    const targets = this.themedTerrainTargets();
    if (!targets) return;

    const total = this.tiles.length;
    const maxCount = (share) => Math.floor(total * share);
    const minCount = (share) => Math.ceil(total * share);

    this.tiles.forEach((tile) => {
      if (tile.type === "nest") tile.type = this.weightedTerrain(rand, [["water", 0.72], ["lily", 0.18], ["mud", 0.1]]);
    });

    this.reduceTileSet((tile) => tile.type === "lily", maxCount(targets.lilyMax), rand, [["water", 0.75], ["mud", 0.15], ["reeds", 0.1]]);
    this.reduceTileSet((tile) => tile.type === "reeds", maxCount(targets.reedsMax), rand, [["water", 0.72], ["mud", 0.2], ["lily", 0.08]]);
    this.reduceTileSet((tile) => tile.type === "mud", maxCount(targets.mudMax), rand, [["water", 0.78], ["reeds", 0.12], ["lily", 0.1]]);
    this.reduceTileSet((tile) => config.TILE_TYPES[tile.type]?.blocks, maxCount(targets.blockedMax), rand, [["water", 0.7], ["mud", 0.18], ["reeds", 0.08], ["lily", 0.04]]);

    let waterCount = this.tiles.filter((tile) => tile.type === "water").length;
    const waterGoal = minCount(targets.waterMin);
    if (waterCount < waterGoal) {
      const candidates = this.shuffle(
        this.tiles.filter((tile) => tile.type !== "water" && tile.type !== "rock" && !tile.objectiveId),
        rand,
      );
      for (const tile of candidates) {
        if (waterCount >= waterGoal) break;
        tile.type = "water";
        waterCount += 1;
      }
    }

    if (targets.blockedMin) {
      let blockedCount = this.tiles.filter((tile) => config.TILE_TYPES[tile.type]?.blocks).length;
      const blockedGoal = minCount(targets.blockedMin);
      const blockedType = this.map.theme === "nile" ? "desert" : this.map.theme === "everglades" ? "grassIsland" : this.map.theme === "mekong" ? "riceField" : "jungleIsland";
      if (blockedCount < blockedGoal) {
        const accentCandidates = this.tiles.filter((tile) => tile.type !== "water" && !config.TILE_TYPES[tile.type]?.blocks && this.nearMapEdge(tile, 4));
        const waterCandidates = this.tiles.filter((tile) => tile.type === "water" && this.nearMapEdge(tile, 4));
        const candidates = this.shuffle([...accentCandidates, ...waterCandidates], rand);
        for (const tile of candidates) {
          if (blockedCount >= blockedGoal) break;
          tile.type = blockedType;
          blockedCount += 1;
        }
      }
    }

    this.raiseTerrainType("lily", minCount(targets.lilyMin || 0), minCount(targets.waterMin), rand);
    this.raiseTerrainType("reeds", minCount(targets.reedsMin || 0), minCount(targets.waterMin), rand);
    this.raiseTerrainType("mud", minCount(targets.mudMin || 0), minCount(targets.waterMin), rand);

    this.terrainStats = this.calculateTerrainStats();
    this.logThemedTerrainStats(this.terrainStats);
  }

  themedTerrainTargets() {
    return {
      amazon: { waterMin: 0.6, reedsMin: 0.08, reedsMax: 0.12, mudMin: 0.08, mudMax: 0.12, lilyMin: 0.055, lilyMax: 0.08, blockedMax: 0.18, blockedMin: 0.1 },
      mekong: { waterMin: 0.55, reedsMin: 0.08, reedsMax: 0.12, mudMin: 0.1, mudMax: 0.15, lilyMin: 0.05, lilyMax: 0.08, blockedMax: 0.2, blockedMin: 0.12 },
      everglades: { waterMin: 0.45, reedsMin: 0.15, reedsMax: 0.2, mudMin: 0.1, mudMax: 0.15, lilyMin: 0.08, lilyMax: 0.12, blockedMax: 0.15, blockedMin: 0.1 },
      nile: { waterMin: 0.65, reedsMin: 0.015, reedsMax: 0.07, mudMin: 0.015, mudMax: 0.05, lilyMin: 0.02, lilyMax: 0.07, blockedMax: 0.25, blockedMin: 0.15 },
    }[this.map.theme];
  }

  calculateTerrainStats() {
    const total = Math.max(1, this.tiles.length);
    const counts = { water: 0, reeds: 0, mud: 0, lily: 0, blocked: 0, nests: 0, objectives: 0, spawns: this.spawnPoints.length };
    this.tiles.forEach((tile) => {
      if (tile.type === "water") counts.water += 1;
      if (tile.type === "reeds") counts.reeds += 1;
      if (tile.type === "mud") counts.mud += 1;
      if (tile.type === "lily") counts.lily += 1;
      if (tile.type === "nest") counts.nests += 1;
      if (tile.objectiveId) counts.objectives += 1;
      if (config.TILE_TYPES[tile.type]?.blocks) counts.blocked += 1;
    });
    const pct = (value) => Number(((value / total) * 100).toFixed(1));
    return {
      counts,
      pct: {
        water: pct(counts.water),
        reeds: pct(counts.reeds),
        mud: pct(counts.mud),
        lily: pct(counts.lily),
        blocked: pct(counts.blocked),
        nests: pct(counts.nests),
      },
    };
  }

  logThemedTerrainStats(stats) {
    if (!this.map.theme || !stats || process.env.PONDFRONT_SILENT_MAP_LOGS === "1") return;
    const label = this.map.label || this.map.id || this.map.theme;
    console.log(
      `[MAP GEN] ${label} water=${stats.pct.water}% reeds=${stats.pct.reeds}% mud=${stats.pct.mud}% lily=${stats.pct.lily}% blocked=${stats.pct.blocked}% nests=${stats.pct.nests}% objectives=${this.map.objectiveCount} spawns=${stats.counts.spawns} defaultBots=${this.map.defaultBots || "custom"}`,
    );
  }

  reduceTileSet(predicate, max, rand, replacements) {
    const candidates = this.shuffle(this.tiles.filter(predicate), rand);
    const excess = Math.max(0, candidates.length - max);
    for (let i = 0; i < excess; i += 1) {
      candidates[i].type = this.weightedTerrain(rand, replacements);
    }
  }

  raiseTerrainType(type, min, waterFloor, rand) {
    if (!min) return;
    const current = this.tiles.filter((tile) => tile.type === type).length;
    if (current >= min) return;
    const waterCount = this.tiles.filter((tile) => tile.type === "water").length;
    const room = Math.max(0, waterCount - waterFloor);
    const needed = Math.min(min - current, room);
    if (needed <= 0) return;
    const candidates = this.shuffle(this.tiles.filter((tile) => tile.type === "water" && !this.nearMapEdge(tile, 1)), rand);
    for (let i = 0; i < needed && i < candidates.length; i += 1) {
      candidates[i].type = type;
    }
  }

  weightedTerrain(rand, entries) {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rand() * total;
    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return entries[0]?.[0] || "water";
  }

  shuffle(items, rand) {
    const next = items.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  nearMapEdge(tile, margin = 3) {
    return tile.x < margin || tile.y < margin || tile.x > this.cols - 1 - margin || tile.y > this.rows - 1 - margin;
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
      buildingCapturedAt: 0,
      buildingConversionUntil: 0,
      buildingPreviousOwner: null,
      buildingCaptureReason: null,
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
    if (this.map.spawnPoints?.length) return this.map.spawnPoints.map(([x, y]) => this.point(x, y));
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

  rebalanceSpawnPoints() {
    const used = [];
    const minDirections = this.map.theme === "nile" ? 2 : 3;
    this.spawnPoints = this.spawnPoints.map((point) => {
      const balanced = this.bestSpawnNear(point, used, minDirections);
      used.push(balanced);
      return balanced;
    });
  }

  bestSpawnNear([sx, sy], used = [], minDirections = 3) {
    let best = null;
    const maxRadius = Math.max(10, Math.round(Math.min(this.cols, this.rows) * 0.18));
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      for (let y = sy - radius; y <= sy + radius; y += 1) {
        for (let x = sx - radius; x <= sx + radius; x += 1) {
          if (Math.abs(x - sx) !== radius && Math.abs(y - sy) !== radius) continue;
          const tile = this.get(x, y);
          if (!tile || config.TILE_TYPES[tile.type]?.blocks) continue;
          const directions = this.openDirections(x, y);
          const nearby = this.nearbyPlayableCount(x, y, 3);
          if (directions < minDirections && nearby < 14) continue;
          const closePenalty = used.reduce((sum, [ux, uy]) => {
            const d = Math.hypot(x - ux, y - uy);
            return sum + (d < Math.min(this.cols, this.rows) * 0.09 ? 18 : 0);
          }, 0);
          const score = directions * 9 + nearby * 1.6 - Math.hypot(x - sx, y - sy) - closePenalty + (tile.type === "nest" ? 4 : tile.type === "water" ? 2 : 0);
          if (!best || score > best.score) best = { x, y, score };
        }
      }
      if (best && radius > 4) break;
    }
    return best ? [best.x, best.y] : [sx, sy];
  }

  openDirections(x, y) {
    return [
      this.get(x, y - 1),
      this.get(x + 1, y),
      this.get(x, y + 1),
      this.get(x - 1, y),
    ].filter((tile) => tile && !config.TILE_TYPES[tile.type]?.blocks).length;
  }

  nearbyPlayableCount(x, y, radius = 3) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy += 1) {
      for (let xx = x - radius; xx <= x + radius; xx += 1) {
        const tile = this.get(xx, yy);
        if (tile && !config.TILE_TYPES[tile.type]?.blocks) count += 1;
      }
    }
    return count;
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

  buildingConversionSeconds(tile) {
    const level = Math.max(1, Math.min(3, Number(tile?.buildingLevel) || 1));
    if (level >= 3) return 10;
    if (level === 2) return 8;
    return 5;
  }

  transferBuilding(tileId, newOwnerId, oldOwnerId = null, captureReason = "capture", now = Date.now() / 1000, pushEvent = null) {
    const tile = this.getById(tileId);
    if (!tile?.building || !newOwnerId || oldOwnerId === newOwnerId) return null;
    const buildingType = tile.building;
    const buildingLevel = Math.max(1, Number(tile.buildingLevel) || 1);
    const conversionTime = this.buildingConversionSeconds(tile);
    tile.buildingCapturedAt = now;
    tile.buildingConversionUntil = now + conversionTime;
    tile.buildingPreviousOwner = oldOwnerId || null;
    tile.buildingCaptureReason = captureReason;
    tile.lastChanged = now;
    const event = {
      kind: "buildingCaptured",
      tileId: tile.id,
      to: tile.id,
      buildingType,
      buildingLevel,
      oldOwnerId: oldOwnerId || null,
      newOwnerId,
      playerId: newOwnerId,
      targetOwner: oldOwnerId || null,
      conversionTime,
      conversionUntil: tile.buildingConversionUntil,
      captureReason,
      at: now,
      message: `${config.BUILDINGS[buildingType]?.label || "Building"} captured. Converting for ${conversionTime}s.`,
    };
    if (typeof pushEvent === "function") pushEvent(event);
    return event;
  }

  playable() {
    return this.playableTiles || this.tiles.filter((tile) => !config.TILE_TYPES[tile.type].blocks);
  }

  cachePlayableTiles() {
    this.playableTiles = this.tiles.filter((tile) => !config.TILE_TYPES[tile.type].blocks);
    this.playableCount = this.playableTiles.length;
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
