import { GRID_COLS, GRID_ROWS, TILE_TYPES } from "./config.js";

export class TileManager {
  constructor(cols = GRID_COLS, rows = GRID_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = [];
    this.spawnPoints = [
      [4, 4],
      [29, 19],
      [5, 19],
      [28, 4],
      [16, 4],
      [17, 19],
      [7, 11],
      [27, 12],
      [16, 12],
      [11, 6],
    ];
  }

  generate(seed = 42) {
    const rand = this.seeded(seed);
    this.tiles = [];

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const edge = x < 2 || y < 2 || x > this.cols - 3 || y > this.rows - 3;
        const wobble = this.wave(x, y, seed);
        const roll = rand();
        let type = "water";

        if (edge && roll < 0.18) type = "rock";
        else if (wobble > 0.8 && roll < 0.2) type = "rock";
        else if (wobble > 0.62 && roll < 0.36) type = "reeds";
        else if (roll < 0.06) type = "lily";
        else if (roll < 0.12) type = "reeds";
        else if (roll < 0.18) type = "mud";
        else if (roll < 0.24) type = "nest";

        this.tiles.push(this.makeTile(x, y, type));
      }
    }

    this.placeCritterPatches(rand);
    this.clearSpawnPoints();
    this.linkNeighbors();
    return this.tiles;
  }

  makeTile(x, y, type) {
    const cfg = TILE_TYPES[type];
    return {
      id: y * this.cols + x,
      x,
      y,
      type,
      owner: null,
      building: null,
      reinforcement: 0,
      captureFlash: 0,
      borderHiddenUntil: 0,
      defenseBonus: cfg.defenseBonus,
      incomeBonus: cfg.incomeBonus,
      neighbors: [],
    };
  }

  placeCritterPatches(rand) {
    const centers = [
      [Math.floor(this.cols * 0.48), Math.floor(this.rows * 0.5)],
      [Math.floor(this.cols * 0.25), Math.floor(this.rows * 0.68)],
      [Math.floor(this.cols * 0.72), Math.floor(this.rows * 0.28)],
    ];

    centers.forEach(([cx, cy]) => {
      this.tiles.forEach((tile) => {
        const distance = Math.abs(tile.x - cx) + Math.abs(tile.y - cy);
        if (distance <= 2 && rand() > 0.2 && tile.type !== "rock") {
          tile.type = "critter";
          tile.defenseBonus = TILE_TYPES.critter.defenseBonus;
          tile.incomeBonus = TILE_TYPES.critter.incomeBonus;
        }
      });
    });
  }

  clearSpawnPoints() {
    this.spawnPoints.forEach(([sx, sy], index) => {
      for (let y = sy - 2; y <= sy + 2; y += 1) {
        for (let x = sx - 2; x <= sx + 2; x += 1) {
          const tile = this.get(x, y);
          if (!tile) continue;
          const distance = Math.abs(x - sx) + Math.abs(y - sy);
          if (distance <= 2) {
            const type = distance === 0 ? "nest" : index % 3 === 0 ? "water" : "lily";
            this.setType(tile, type);
          }
        }
      }
    });
  }

  setType(tile, type) {
    tile.type = type;
    tile.defenseBonus = TILE_TYPES[type].defenseBonus;
    tile.incomeBonus = TILE_TYPES[type].incomeBonus;
  }

  linkNeighbors() {
    this.tiles.forEach((tile) => {
      const offsets = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];
      tile.neighbors = offsets
        .map(([dx, dy]) => this.get(tile.x + dx, tile.y + dy))
        .filter(Boolean);
    });
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.tiles[y * this.cols + x];
  }

  getById(id) {
    return this.tiles[id] ?? null;
  }

  forEach(callback) {
    this.tiles.forEach(callback);
  }

  claimStartingArea(player, spawnIndex) {
    const [sx, sy] = this.spawnPoints[spawnIndex % this.spawnPoints.length];
    const claimed = [];

    for (let y = sy - 2; y <= sy + 2; y += 1) {
      for (let x = sx - 2; x <= sx + 2; x += 1) {
        const tile = this.get(x, y);
        if (!tile || TILE_TYPES[tile.type].blocks) continue;
        const distance = Math.abs(x - sx) + Math.abs(y - sy);
        if (distance <= 2) {
          tile.owner = player.id;
          tile.captureFlash = 1;
          claimed.push(tile);
        }
      }
    }

    return claimed;
  }

  resetOwnership() {
    this.tiles.forEach((tile) => {
      tile.owner = null;
      tile.building = null;
      tile.reinforcement = 0;
      tile.captureFlash = 0;
      tile.borderHiddenUntil = 0;
    });
  }

  isBorderTile(tile, ownerId) {
    if (!tile || tile.owner !== ownerId) return false;
    return tile.neighbors.some((neighbor) => neighbor.owner !== ownerId && !TILE_TYPES[neighbor.type].blocks);
  }

  getBorderTiles(ownerId) {
    return this.tiles.filter((tile) => this.isBorderTile(tile, ownerId));
  }

  getOwnedTiles(ownerId) {
    return this.tiles.filter((tile) => tile.owner === ownerId);
  }

  getCapturableNeighbors(ownerId) {
    const seen = new Set();
    const options = [];
    this.getBorderTiles(ownerId).forEach((tile) => {
      tile.neighbors.forEach((neighbor) => {
        if (neighbor.owner === ownerId || TILE_TYPES[neighbor.type].blocks || seen.has(neighbor.id)) return;
        seen.add(neighbor.id);
        options.push(neighbor);
      });
    });
    return options;
  }

  getReachInfo(player, target, selectedTiles = []) {
    if (!target || TILE_TYPES[target.type].blocks || target.owner === player.id) {
      return { reachable: false, source: null, jumped: false };
    }

    const selected = selectedTiles
      .map((tile) => (typeof tile === "number" ? this.getById(tile) : tile))
      .filter((tile) => tile?.owner === player.id);
    const borderTiles = selected.length ? selected : this.getBorderTiles(player.id);

    for (const source of borderTiles) {
      if (source.neighbors.includes(target)) {
        return { reachable: true, source, jumped: false };
      }
    }

    if (player.animal === "frog") {
      const jumpRange = player.flags.jumpPad ? 3 : 2;
      for (const source of borderTiles) {
        const distance = Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
        if (distance <= jumpRange && distance > 1) {
          return { reachable: true, source, jumped: true };
        }
      }
    }

    return { reachable: false, source: null, jumped: false };
  }

  getTilesInRect(rect) {
    const minX = Math.min(rect.x1, rect.x2);
    const maxX = Math.max(rect.x1, rect.x2);
    const minY = Math.min(rect.y1, rect.y2);
    const maxY = Math.max(rect.y1, rect.y2);

    return this.tiles.filter((tile) => {
      const cx = tile.screenX + tile.size / 2;
      const cy = tile.screenY + tile.size / 2;
      return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
    });
  }

  countPlayableTiles() {
    return this.tiles.filter((tile) => !TILE_TYPES[tile.type].blocks).length;
  }

  seeded(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  wave(x, y, seed) {
    const a = Math.sin((x + seed * 0.07) * 0.72);
    const b = Math.cos((y - seed * 0.05) * 0.56);
    const c = Math.sin((x + y) * 0.26);
    return (a + b + c + 3) / 6;
  }
}
