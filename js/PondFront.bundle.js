// Generated from the PondFront manager modules so index.html also works from file://.
(() => {
'use strict';

// config.js
const GRID_COLS = 34;
const GRID_ROWS = 24;
const WIN_CONTROL = 0.7;
const MATCH_SECONDS = 720;

const TILE_TYPES = {
  water: {
    label: "Open Water",
    color: "#74d7e6",
    defenseBonus: 0,
    incomeBonus: 0,
    captureCost: 13,
    blocks: false,
  },
  lily: {
    label: "Lily Pad",
    color: "#8ed16b",
    defenseBonus: 1,
    incomeBonus: 0.26,
    captureCost: 15,
    blocks: false,
  },
  reeds: {
    label: "Reeds",
    color: "#77a85d",
    defenseBonus: 4,
    incomeBonus: 0.06,
    captureCost: 17,
    blocks: false,
  },
  mud: {
    label: "Mud Island",
    color: "#b98f59",
    defenseBonus: 2,
    incomeBonus: 0.18,
    captureCost: 22,
    blocks: false,
  },
  rock: {
    label: "Rock",
    color: "#8f9aa3",
    defenseBonus: 999,
    incomeBonus: 0,
    captureCost: 999,
    blocks: true,
  },
  nest: {
    label: "Nest Zone",
    color: "#eabf83",
    defenseBonus: 1,
    incomeBonus: 0.1,
    captureCost: 16,
    blocks: false,
  },
  critter: {
    label: "Neutral Critter",
    color: "#d9c56a",
    defenseBonus: 3,
    incomeBonus: 0.2,
    captureCost: 26,
    blocks: false,
  },
};

const ANIMALS = {
  duck: {
    label: "Duck",
    color: "#f0b63f",
    dark: "#c5792c",
    ability: "Flock Rush",
    abilityCooldown: 34,
    abilityDuration: 8,
    description: "Fast on open water and can build nests.",
  },
  snake: {
    label: "Snake",
    color: "#38a86f",
    dark: "#206d52",
    ability: "Camouflage",
    abilityCooldown: 40,
    abilityDuration: 9,
    description: "Strong around reeds and mud with hidden borders.",
  },
  frog: {
    label: "Frog",
    color: "#cc5f9b",
    dark: "#7c3d77",
    ability: "Big Leap",
    abilityCooldown: 38,
    abilityDuration: 0,
    description: "Jumps gaps and earns more from lily pads.",
  },
};

const BUILDINGS = {
  duckNest: {
    label: "Duck Nest",
    cost: 48,
    animal: "duck",
    validTiles: ["nest", "water", "lily"],
    color: "#f0b63f",
  },
  reedGuard: {
    label: "Reed Guard",
    cost: 38,
    animal: null,
    validTiles: ["reeds", "mud", "nest"],
    color: "#4b8756",
  },
  lilyFarm: {
    label: "Lily Farm",
    cost: 42,
    animal: null,
    validTiles: ["lily", "water"],
    color: "#6abf69",
  },
  mudTunnel: {
    label: "Mud Tunnel",
    cost: 44,
    animal: "snake",
    validTiles: ["mud", "reeds"],
    color: "#7d5a3b",
  },
  jumpPad: {
    label: "Jump Pad",
    cost: 44,
    animal: "frog",
    validTiles: ["lily", "nest", "water"],
    color: "#cc5f9b",
  },
};

const PLAYER_COLORS = [
  "#f0b63f",
  "#38a86f",
  "#cc5f9b",
  "#5378e8",
  "#e15c55",
  "#7d61d8",
  "#2ba8a0",
  "#d66f38",
  "#5b9e46",
  "#be4b7c",
];

const BOT_NAMES = [
  "Bay Beak",
  "Reed Coil",
  "Lily Jumper",
  "North Nest",
  "Moss Stripe",
  "Pebble Snap",
  "Cattail Crew",
  "Ripple Band",
  "Mud Skipper",
];

// TileManager.js
class TileManager {
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

// AnimalManager.js
class AnimalManager {
  get(animal) {
    return ANIMALS[animal];
  }

  getExpansionMultiplier(player, targetTile, sourceTile, reachInfo) {
    let multiplier = 1;

    if (player.animal === "duck") {
      if (targetTile.type === "water") multiplier *= 0.68;
      if (targetTile.type === "reeds") multiplier *= 1.28;
      if (player.activeAbility === "flockRush") multiplier *= 0.62;
    }

    if (player.animal === "snake") {
      if (targetTile.type === "water") multiplier *= 1.28;
      if (targetTile.type === "reeds" || targetTile.type === "mud") multiplier *= 0.78;
      if (player.flags.mudTunnel && (targetTile.type === "reeds" || targetTile.type === "mud")) {
        multiplier *= 0.72;
      }
    }

    if (player.animal === "frog") {
      if (targetTile.type === "lily") multiplier *= 0.8;
      if (reachInfo?.jumped) multiplier *= 1.08;
      if (player.activeAbility === "bigLeap") multiplier *= 0.55;
    }

    if (sourceTile?.type === "reeds" && player.animal === "snake" && player.activeAbility === "ambush") {
      multiplier *= 0.72;
    }

    return multiplier;
  }

  getAttackMultiplier(player, targetTile, sourceTile) {
    let multiplier = 1;

    if (player.animal === "snake" && sourceTile?.type === "reeds") {
      multiplier *= 1.2;
      if (player.activeAbility === "ambush") multiplier *= 1.35;
    }

    if (player.animal === "duck" && targetTile.type === "water" && player.activeAbility === "flockRush") {
      multiplier *= 1.12;
    }

    if (player.animal === "frog" && targetTile.type === "lily") {
      multiplier *= 1.1;
    }

    return multiplier;
  }

  getDefenseMultiplier(player, tile) {
    let multiplier = 1;

    if (player.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) {
      multiplier *= 1.2;
    }

    if (player.animal === "duck" && tile.type === "reeds") {
      multiplier *= 0.88;
    }

    if (player.animal === "frog" && tile.type === "water") {
      multiplier *= 0.88;
    }

    return multiplier;
  }

  getIncomeBonus(player, tile) {
    if (player.animal === "frog" && tile.type === "lily") return 0.22;
    return 0;
  }

  canUseBuilding(player, building) {
    return !building.animal || building.animal === player.animal;
  }

  abilityReady(player, now) {
    return now >= player.abilityReadyAt && !player.defeated;
  }
}

// EconomyManager.js
class EconomyManager {
  constructor(tileManager, animalManager) {
    this.tileManager = tileManager;
    this.animalManager = animalManager;
  }

  update(players, dt) {
    this.recalculate(players);

    players.forEach((player) => {
      if (player.defeated) return;
      player.energy = Math.min(player.maxEnergy, player.energy + player.income * dt);
    });
  }

  recalculate(players) {
    players.forEach((player) => {
      player.territory = 0;
      player.income = 1.2;
      player.maxEnergy = 78;
      player.buildings = {
        duckNest: 0,
        reedGuard: 0,
        lilyFarm: 0,
        mudTunnel: 0,
        jumpPad: 0,
      };
      player.flags.mudTunnel = false;
      player.flags.jumpPad = false;
    });

    this.tileManager.forEach((tile) => {
      if (!tile.owner || TILE_TYPES[tile.type].blocks) return;
      const player = players.find((candidate) => candidate.id === tile.owner);
      if (!player || player.defeated) return;

      player.territory += 1;
      player.maxEnergy += 2.6;
      player.income += 0.075 + tile.incomeBonus + this.animalManager.getIncomeBonus(player, tile);

      if (tile.building) {
        player.buildings[tile.building] += 1;
        this.applyBuilding(player, tile);
      }
    });

    players.forEach((player) => {
      player.maxEnergy += player.territory * 0.12;
      player.energy = Math.min(player.energy, player.maxEnergy);
      if (player.territory <= 0 && !player.defeated) {
        player.defeated = true;
        player.energy = 0;
      }
    });
  }

  applyBuilding(player, tile) {
    if (tile.building === "duckNest") {
      player.maxEnergy += 34;
      player.income += 0.16;
    }

    if (tile.building === "lilyFarm") {
      player.income += tile.type === "lily" ? 0.72 : 0.46;
    }

    if (tile.building === "reedGuard") {
      player.income += 0.06;
    }

    if (tile.building === "mudTunnel") {
      player.flags.mudTunnel = true;
      player.income += 0.12;
    }

    if (tile.building === "jumpPad") {
      player.flags.jumpPad = true;
      player.maxEnergy += 8;
    }
  }

  canBuild(player, tile, buildingType) {
    const building = BUILDINGS[buildingType];
    if (!building || !tile || tile.owner !== player.id || tile.building) return false;
    if (!this.animalManager.canUseBuilding(player, building)) return false;
    if (!building.validTiles.includes(tile.type)) return false;
    return player.energy >= building.cost;
  }

  build(player, tile, buildingType) {
    if (!this.canBuild(player, tile, buildingType)) return false;
    const building = BUILDINGS[buildingType];
    player.energy -= building.cost;
    tile.building = buildingType;
    tile.captureFlash = 1;
    return true;
  }
}

// CombatManager.js
class CombatManager {
  constructor(tileManager, animalManager) {
    this.tileManager = tileManager;
    this.animalManager = animalManager;
  }

  expandOrAttack(game, player, targetTile, sendPercent, selectedTiles = []) {
    if (!targetTile || player.defeated) return { ok: false, reason: "No target" };
    if (TILE_TYPES[targetTile.type].blocks) return { ok: false, reason: "Rocks block movement" };
    if (targetTile.owner === player.id) return this.reinforce(player, targetTile, sendPercent);

    const targetOwner = game.getPlayer(targetTile.owner);
    if (targetOwner && game.areAllied(player.id, targetOwner.id)) {
      return { ok: false, reason: "Alliance border" };
    }

    const reachInfo = this.tileManager.getReachInfo(player, targetTile, selectedTiles);
    if (!reachInfo.reachable) return { ok: false, reason: "Out of border range" };

    const spend = Math.max(4, player.energy * sendPercent);
    if (player.energy < spend) return { ok: false, reason: "Low energy" };

    const captureCost = this.getCaptureCost(game, player, targetTile, reachInfo, selectedTiles);
    const attackPower =
      spend *
      this.animalManager.getAttackMultiplier(player, targetTile, reachInfo.source) *
      this.selectionPressure(selectedTiles);

    player.energy -= spend;

    if (attackPower >= captureCost) {
      if (targetOwner) {
        targetOwner.energy = Math.max(0, targetOwner.energy - spend * 0.28);
      }
      targetTile.owner = player.id;
      targetTile.building = null;
      targetTile.reinforcement = Math.max(0, attackPower - captureCost) * 0.12;
      targetTile.captureFlash = 1;
      targetTile.borderHiddenUntil = 0;
      return {
        ok: true,
        captured: true,
        jumped: reachInfo.jumped,
        reason: targetOwner ? "Captured enemy border" : "Captured neutral tile",
      };
    }

    targetTile.reinforcement = Math.max(0, targetTile.reinforcement - attackPower * 0.08);
    if (targetOwner) targetOwner.energy = Math.max(0, targetOwner.energy - spend * 0.12);

    return {
      ok: true,
      captured: false,
      reason: "Attack softened the border",
    };
  }

  reinforce(player, tile, sendPercent) {
    const spend = Math.max(3, player.energy * sendPercent * 0.6);
    if (player.energy < spend) return { ok: false, reason: "Low energy" };
    player.energy -= spend;
    tile.reinforcement = Math.min(36, tile.reinforcement + spend * 0.42);
    tile.captureFlash = 1;
    return { ok: true, captured: false, reason: "Border reinforced" };
  }

  getCaptureCost(game, player, targetTile, reachInfo, selectedTiles) {
    const targetOwner = game.getPlayer(targetTile.owner);
    const base = TILE_TYPES[targetTile.type].captureCost;
    let cost = base + targetTile.defenseBonus * 3.2 + targetTile.reinforcement;

    if (targetOwner) {
      const reserve = Math.min(targetOwner.energy * 0.12, 32);
      cost += 14 + reserve;
      cost *= this.animalManager.getDefenseMultiplier(targetOwner, targetTile);
    }

    cost += this.reedGuardBonus(targetTile, targetOwner?.id);
    cost *= this.animalManager.getExpansionMultiplier(player, targetTile, reachInfo.source, reachInfo);

    if (selectedTiles.length > 2) {
      cost *= Math.max(0.76, 1 - Math.min(selectedTiles.length, 8) * 0.025);
    }

    return Math.max(6, cost);
  }

  reedGuardBonus(tile, ownerId) {
    if (!ownerId) return 0;
    let bonus = 0;
    const nearby = [tile, ...tile.neighbors];
    nearby.forEach((neighbor) => {
      if (neighbor.owner === ownerId && neighbor.building === "reedGuard") bonus += 8;
    });
    return Math.min(24, bonus);
  }

  selectionPressure(selectedTiles) {
    if (!selectedTiles?.length) return 1;
    return 1 + Math.min(selectedTiles.length, 10) * 0.045;
  }

  activateAbility(game, player) {
    const now = game.time;
    const animal = this.animalManager.get(player.animal);
    if (!this.animalManager.abilityReady(player, now)) {
      return { ok: false, reason: "Ability cooling down" };
    }

    if (player.animal === "duck") {
      player.activeAbility = "flockRush";
      player.activeAbilityUntil = now + animal.abilityDuration;
      player.abilityReadyAt = now + animal.abilityCooldown;
      return { ok: true, reason: "Flock Rush" };
    }

    if (player.animal === "snake") {
      player.activeAbility = "ambush";
      player.activeAbilityUntil = now + animal.abilityDuration;
      player.abilityReadyAt = now + animal.abilityCooldown;
      this.tileManager.getBorderTiles(player.id).forEach((tile) => {
        tile.borderHiddenUntil = now + animal.abilityDuration;
      });
      return { ok: true, reason: "Camouflage" };
    }

    if (player.animal === "frog") {
      player.abilityReadyAt = now + animal.abilityCooldown;
      return this.bigLeap(game, player);
    }

    return { ok: false, reason: "No ability" };
  }

  bigLeap(game, player) {
    const border = this.tileManager.getBorderTiles(player.id);
    const options = [];
    border.forEach((source) => {
      for (let y = source.y - 3; y <= source.y + 3; y += 1) {
        for (let x = source.x - 3; x <= source.x + 3; x += 1) {
          const tile = this.tileManager.get(x, y);
          if (!tile || tile.owner === player.id || TILE_TYPES[tile.type].blocks) continue;
          const distance = Math.abs(source.x - x) + Math.abs(source.y - y);
          if (distance >= 2 && distance <= (player.flags.jumpPad ? 3 : 2)) options.push(tile);
        }
      }
    });

    const unique = [...new Map(options.map((tile) => [tile.id, tile])).values()];
    unique
      .sort((a, b) => this.tileScore(b) - this.tileScore(a))
      .slice(0, 4)
      .forEach((tile) => {
        const targetOwner = game.getPlayer(tile.owner);
        if (targetOwner && game.areAllied(player.id, targetOwner.id)) return;
        tile.owner = player.id;
        tile.building = null;
        tile.reinforcement = 2;
        tile.captureFlash = 1;
      });

    if (!unique.length) return { ok: false, reason: "No leap target" };
    player.activeAbility = "bigLeap";
    player.activeAbilityUntil = game.time + 0.8;
    return { ok: true, reason: "Big Leap captured a pocket" };
  }

  tileScore(tile) {
    let score = 1 + tile.incomeBonus * 12 + tile.defenseBonus;
    if (tile.type === "lily") score += 4;
    if (tile.type === "critter") score += 5;
    if (tile.building && BUILDINGS[tile.building]) score += 8;
    return score;
  }
}

// BotManager.js
class BotManager {
  constructor(game) {
    this.game = game;
    this.timers = new Map();
  }

  reset() {
    this.timers.clear();
  }

  update(dt) {
    this.game.players.forEach((player) => {
      if (!player.isBot || player.defeated) return;
      const elapsed = (this.timers.get(player.id) ?? 0) + dt;
      const interval = this.getInterval(player);
      if (elapsed < interval) {
        this.timers.set(player.id, elapsed);
        return;
      }
      this.timers.set(player.id, 0);
      this.takeTurn(player);
    });
  }

  getInterval(player) {
    if (player.difficulty === "easy") return 1.65;
    if (player.difficulty === "smart") return 0.78;
    return 1.08;
  }

  takeTurn(player) {
    if (player.energy < 9) return;

    if (this.shouldUseAbility(player)) {
      this.game.combatManager.activateAbility(this.game, player);
    }

    if (this.shouldBuild(player)) {
      const built = this.tryBuild(player);
      if (built && player.difficulty !== "smart") return;
    }

    const target = this.pickTarget(player);
    if (!target) return;

    const send = player.difficulty === "easy" ? 0.25 : player.difficulty === "smart" ? 0.38 : 0.32;
    const selected = this.game.tileManager
      .getBorderTiles(player.id)
      .filter((tile) => tile.neighbors.includes(target))
      .map((tile) => tile.id);

    this.game.combatManager.expandOrAttack(this.game, player, target, send, selected);
  }

  shouldUseAbility(player) {
    if (this.game.time < player.abilityReadyAt) return false;
    if (player.energy < player.maxEnergy * 0.32) return false;
    return Math.random() < (player.difficulty === "smart" ? 0.38 : 0.18);
  }

  shouldBuild(player) {
    const ratio = player.energy / Math.max(1, player.maxEnergy);
    if (ratio < 0.42) return false;
    if (player.difficulty === "easy") return Math.random() < 0.18;
    if (player.difficulty === "smart") return Math.random() < 0.46;
    return Math.random() < 0.28;
  }

  tryBuild(player) {
    const owned = this.game.tileManager.getOwnedTiles(player.id).filter((tile) => !tile.building);
    const order = this.getBuildOrder(player);

    for (const buildingType of order) {
      const cfg = BUILDINGS[buildingType];
      const candidates = owned
        .filter((tile) => cfg.validTiles.includes(tile.type))
        .sort((a, b) => this.tileBuildScore(player, buildingType, b) - this.tileBuildScore(player, buildingType, a));
      const tile = candidates[0];
      if (tile && this.game.economyManager.build(player, tile, buildingType)) return true;
    }

    return false;
  }

  getBuildOrder(player) {
    const common = ["lilyFarm", "reedGuard"];
    if (player.animal === "duck") return ["duckNest", ...common];
    if (player.animal === "snake") return ["mudTunnel", ...common];
    if (player.animal === "frog") return ["jumpPad", ...common];
    return common;
  }

  tileBuildScore(player, buildingType, tile) {
    let score = tile.incomeBonus * 10 + tile.defenseBonus;
    if (buildingType === "reedGuard" && this.game.tileManager.isBorderTile(tile, player.id)) score += 12;
    if (buildingType === "lilyFarm" && tile.type === "lily") score += 12;
    if (buildingType === "duckNest" && tile.type === "nest") score += 10;
    if (buildingType === "mudTunnel" && tile.type === "mud") score += 8;
    if (buildingType === "jumpPad" && tile.type === "lily") score += 8;
    return score;
  }

  pickTarget(player) {
    const options = this.game.tileManager.getCapturableNeighbors(player.id);
    if (!options.length) return null;

    if (player.difficulty === "easy") {
      return options[Math.floor(Math.random() * options.length)];
    }

    const scored = options
      .filter((tile) => {
        const targetOwner = this.game.getPlayer(tile.owner);
        return !targetOwner || !this.game.areAllied(player.id, targetOwner.id);
      })
      .map((tile) => ({ tile, score: this.scoreTarget(player, tile) }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.tile ?? null;
  }

  scoreTarget(player, tile) {
    let score = 4 + tile.incomeBonus * 20 - TILE_TYPES[tile.type].captureCost * 0.12;
    if (tile.type === "water" && player.animal === "duck") score += 5;
    if ((tile.type === "reeds" || tile.type === "mud") && player.animal === "snake") score += 5;
    if (tile.type === "lily" && player.animal === "frog") score += 6;
    if (tile.type === "critter") score += 7;
    if (tile.owner && tile.owner !== player.id) {
      const targetOwner = this.game.getPlayer(tile.owner);
      if (targetOwner && targetOwner.energy < player.energy * 0.8) score += 10;
      if (this.game.areAllied(player.id, tile.owner)) score -= 999;
      score += player.difficulty === "smart" ? 4 : 1;
    }
    return score + Math.random() * 3;
  }
}

// UIManager.js
class UIManager {
  constructor(game) {
    this.game = game;
    this.selectedAnimal = "duck";
    this.longPressTimer = null;
    this.pointer = {
      down: false,
      dragging: false,
      longPressed: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      pointerId: null,
    };

    this.nodes = {
      startScreen: document.querySelector("#startScreen"),
      gameScreen: document.querySelector("#gameScreen"),
      startGame: document.querySelector("#startGame"),
      restartGame: document.querySelector("#restartGame"),
      animalCards: [...document.querySelectorAll(".animal-card")],
      difficulty: document.querySelector("#difficulty"),
      practiceMode: document.querySelector("#practiceMode"),
      canvas: document.querySelector("#gameCanvas"),
      miniMap: document.querySelector("#miniMap"),
      energyStat: document.querySelector("#energyStat"),
      territoryStat: document.querySelector("#territoryStat"),
      controlFill: document.querySelector("#controlFill"),
      incomeStat: document.querySelector("#incomeStat"),
      animalStat: document.querySelector("#animalStat"),
      abilityName: document.querySelector("#abilityName"),
      cooldownFill: document.querySelector("#cooldownFill"),
      cooldownText: document.querySelector("#cooldownText"),
      tilePanel: document.querySelector(".tile-panel"),
      tileTypeInfo: document.querySelector("#tileTypeInfo"),
      tileOwnerInfo: document.querySelector("#tileOwnerInfo"),
      tileIncomeInfo: document.querySelector("#tileIncomeInfo"),
      tileDefenseInfo: document.querySelector("#tileDefenseInfo"),
      selectedCount: document.querySelector("#selectedCount"),
      sendButtons: [...document.querySelectorAll("[data-send]")],
      defendButton: document.querySelector("#defendButton"),
      buildButton: document.querySelector("#buildButton"),
      abilityButton: document.querySelector("#abilityButton"),
      buildPanel: document.querySelector("#buildPanel"),
      buildButtons: [...document.querySelectorAll("[data-building]")],
      leaderboard: document.querySelector("#leaderboard"),
      toast: document.querySelector("#toast"),
      radialMenu: document.querySelector("#radialMenu"),
      result: document.querySelector("#matchResult"),
      resultTitle: document.querySelector("#resultTitle"),
      resultText: document.querySelector("#resultText"),
    };
  }

  bind() {
    this.nodes.animalCards.forEach((card) => {
      card.addEventListener("click", () => this.chooseAnimal(card.dataset.animal));
    });

    this.nodes.startGame.addEventListener("click", () => {
      this.nodes.startScreen.classList.add("hidden");
      this.nodes.gameScreen.classList.remove("hidden");
      this.game.start({
        animal: this.selectedAnimal,
        difficulty: this.nodes.difficulty.value,
        practice: this.nodes.practiceMode.checked,
      });
    });

    this.nodes.restartGame.addEventListener("click", () => {
      this.nodes.result.classList.add("hidden");
      this.nodes.startScreen.classList.remove("hidden");
      this.nodes.gameScreen.classList.add("hidden");
      this.game.stop();
    });

    this.nodes.sendButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.nodes.sendButtons.forEach((candidate) => candidate.classList.remove("active"));
        button.classList.add("active");
        this.game.sendPercent = Number(button.dataset.send);
      });
    });

    this.nodes.defendButton.addEventListener("click", () => {
      this.game.toggleDefendMode();
      this.syncModeButtons();
    });

    this.nodes.buildButton.addEventListener("click", () => {
      this.game.toggleBuildMode();
      this.syncModeButtons();
    });

    this.nodes.abilityButton.addEventListener("click", () => {
      const result = this.game.useAbility();
      this.toast(result.reason);
    });

    this.nodes.buildButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.game.selectedBuilding = button.dataset.building;
        this.nodes.buildButtons.forEach((candidate) => candidate.classList.remove("active"));
        button.classList.add("active");
      });
    });

    this.nodes.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.nodes.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.nodes.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.nodes.canvas.addEventListener("pointercancel", () => this.cancelPointer());
    this.nodes.canvas.addEventListener("pointerleave", () => {
      this.game.hoverTile = null;
      this.nodes.canvas.style.cursor = "default";
    });
    this.nodes.canvas.addEventListener("contextmenu", (event) => this.onContextMenu(event));
    window.addEventListener("click", (event) => {
      if (!this.nodes.radialMenu.contains(event.target)) this.closeRadialMenu();
    });

    this.nodes.radialMenu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      this.game.handleDiplomacy(button.dataset.action);
      this.closeRadialMenu();
    });

    window.addEventListener("resize", () => this.game.resize());
  }

  chooseAnimal(animal) {
    this.selectedAnimal = animal;
    this.nodes.animalCards.forEach((card) => {
      card.classList.toggle("selected", card.dataset.animal === animal);
    });
  }

  onPointerDown(event) {
    if (event.button === 2) return;
    const pos = this.getCanvasPoint(event);
    this.game.hoverTile = this.game.tileFromCanvas(pos.x, pos.y);
    this.pointer = {
      down: true,
      dragging: false,
      longPressed: false,
      startX: pos.x,
      startY: pos.y,
      x: pos.x,
      y: pos.y,
      pointerId: event.pointerId,
    };
    this.nodes.canvas.setPointerCapture(event.pointerId);
    this.closeRadialMenu();

    clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      if (!this.pointer.down || this.pointer.dragging) return;
      const tile = this.game.tileFromCanvas(pos.x, pos.y);
      if (tile?.owner && tile.owner !== this.game.humanId) {
        this.pointer.longPressed = true;
        this.openRadialMenu(pos.x, pos.y, tile);
      }
    }, 560);
  }

  onPointerMove(event) {
    const pos = this.getCanvasPoint(event);
    this.game.hoverTile = this.game.tileFromCanvas(pos.x, pos.y);
    this.syncCanvasCursor(this.game.hoverTile);
    if (!this.pointer.down) return;
    this.pointer.x = pos.x;
    this.pointer.y = pos.y;

    const dx = Math.abs(pos.x - this.pointer.startX);
    const dy = Math.abs(pos.y - this.pointer.startY);
    if (dx + dy > 12) {
      this.pointer.dragging = true;
      clearTimeout(this.longPressTimer);
      this.game.dragRect = {
        x1: this.pointer.startX,
        y1: this.pointer.startY,
        x2: pos.x,
        y2: pos.y,
      };
      this.game.selectBordersInRect(this.game.dragRect);
    }
  }

  onPointerUp(event) {
    clearTimeout(this.longPressTimer);
    if (!this.pointer.down) return;
    const pos = this.getCanvasPoint(event);
    const wasDragging = this.pointer.dragging;
    const wasLongPressed = this.pointer.longPressed;
    this.cancelPointer();

    if (wasDragging || wasLongPressed) {
      this.game.dragRect = null;
      return;
    }

    const tile = this.game.tileFromCanvas(pos.x, pos.y);
    if (!tile) return;
    const result = this.game.handleTileClick(tile);
    if (result?.reason) this.toast(result.reason);
  }

  cancelPointer() {
    clearTimeout(this.longPressTimer);
    this.pointer.down = false;
    this.pointer.dragging = false;
    this.pointer.longPressed = false;
    this.game.dragRect = null;
  }

  onContextMenu(event) {
    event.preventDefault();
    const pos = this.getCanvasPoint(event);
    const tile = this.game.tileFromCanvas(pos.x, pos.y);
    if (tile?.owner && tile.owner !== this.game.humanId) {
      this.openRadialMenu(pos.x, pos.y, tile);
    }
  }

  openRadialMenu(x, y, tile) {
    this.game.diplomacyTarget = tile.owner;
    const menu = this.nodes.radialMenu;
    menu.style.left = `${Math.max(6, Math.min(x, this.nodes.canvas.clientWidth - 190))}px`;
    menu.style.top = `${Math.max(6, Math.min(y, this.nodes.canvas.clientHeight - 110))}px`;
    menu.classList.remove("hidden");
  }

  closeRadialMenu() {
    this.nodes.radialMenu.classList.add("hidden");
  }

  getCanvasPoint(event) {
    const rect = this.nodes.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  update() {
    const player = this.game.getHuman();
    if (!player) return;

    this.nodes.energyStat.textContent = `${Math.floor(player.energy)} / ${Math.floor(player.maxEnergy)}`;
    const territoryPercent = this.game.getTerritoryPercent(player);
    this.nodes.territoryStat.textContent = `${Math.round(territoryPercent * 100)}%`;
    this.nodes.controlFill.style.transform = `scaleX(${Math.max(0, Math.min(1, territoryPercent / 0.7))})`;
    this.nodes.incomeStat.textContent = `+${player.income.toFixed(1)}/s`;
    this.nodes.animalStat.textContent = ANIMALS[player.animal].label;
    this.nodes.abilityName.textContent = ANIMALS[player.animal].ability;
    this.nodes.selectedCount.textContent = String(this.game.selectedTiles.length);

    const cooldownLeft = Math.max(0, player.abilityReadyAt - this.game.time);
    const cooldownTotal = ANIMALS[player.animal].abilityCooldown;
    const readyRatio = cooldownLeft <= 0 ? 1 : 1 - cooldownLeft / cooldownTotal;
    this.nodes.cooldownFill.style.transform = `scaleX(${Math.max(0, Math.min(1, readyRatio))})`;
    this.nodes.cooldownText.textContent =
      cooldownLeft <= 0 ? "Ready" : `${Math.ceil(cooldownLeft)}s`;
    this.nodes.abilityButton.disabled = cooldownLeft > 0;

    this.syncBuildButtons(player);
    this.syncModeButtons();
    this.updateTilePanel(player);
    this.updateLeaderboard();
  }

  syncModeButtons() {
    this.nodes.defendButton.classList.toggle("active", this.game.mode === "defend");
    this.nodes.buildButton.classList.toggle("active", this.game.mode === "build");
    this.nodes.buildPanel.classList.toggle("hidden", this.game.mode !== "build");
  }

  syncBuildButtons(player) {
    this.nodes.buildButtons.forEach((button) => {
      const building = BUILDINGS[button.dataset.building];
      const animalAllowed = !building.animal || building.animal === player.animal;
      const affordable = player.energy >= building.cost;
      button.disabled = !animalAllowed || !affordable;
      button.textContent = `${building.label} ${building.cost}`;
    });
  }

  updateLeaderboard() {
    const leaders = this.game.players
      .filter((player) => !player.defeated)
      .slice()
      .sort((a, b) => b.territory - a.territory)
      .slice(0, 6);
    this.nodes.leaderboard.innerHTML = leaders
      .map((player) => {
        const pct = Math.round(this.game.getTerritoryPercent(player) * 100);
        const name = player.id === this.game.humanId ? "You" : player.name;
        return `<li><span style="color:${player.color}">${name}</span> ${pct}%</li>`;
      })
      .join("");
  }

  updateTilePanel(player) {
    const tile = this.game.hoverTile ?? this.game.lastActionTile ?? this.game.tileManager.getOwnedTiles(player.id)[0];
    if (!tile) return;

    const type = TILE_TYPES[tile.type];
    const owner = this.game.getPlayer(tile.owner);
    const actionKind = this.game.getTileActionKind(tile, player);
    const ownerText = owner
      ? owner.id === this.game.humanId
        ? "Your pond"
        : this.game.areAllied(player.id, owner.id)
          ? `${owner.name} ally`
          : `${owner.name} front`
      : type.blocks
        ? "Blocked"
        : "Neutral pond";

    this.nodes.tileTypeInfo.textContent = type.label;
    this.nodes.tileOwnerInfo.textContent = ownerText;
    this.nodes.tileIncomeInfo.textContent = `Inc +${(type.incomeBonus + this.game.animalManager.getIncomeBonus(player, tile)).toFixed(1)}`;
    this.nodes.tileDefenseInfo.textContent = `Def ${type.defenseBonus >= 900 ? "Block" : `+${type.defenseBonus}`}`;
    this.nodes.tilePanel.dataset.action = actionKind;
  }

  syncCanvasCursor(tile) {
    const kind = this.game.getTileActionKind(tile);
    this.nodes.canvas.style.cursor = ["expand", "attack", "build", "defend"].includes(kind)
      ? "pointer"
      : "default";
  }

  showResult(winner, timedOut = false) {
    const humanWon = winner?.id === this.game.humanId;
    this.nodes.resultTitle.textContent = humanWon ? "Pond Secured" : "Pond Claimed";
    const label = winner ? `${winner.name} the ${ANIMALS[winner.animal].label}` : "No one";
    this.nodes.resultText.textContent = timedOut
      ? `${label} held the largest territory when the reeds settled.`
      : `${label} controls 70% of the lake.`;
    this.nodes.result.classList.remove("hidden");
  }

  toast(message) {
    if (!message) return;
    clearTimeout(this.toastTimer);
    this.nodes.toast.textContent = message;
    this.nodes.toast.classList.remove("hidden");
    this.toastTimer = setTimeout(() => this.nodes.toast.classList.add("hidden"), 1700);
  }
}

// Game.js
class PondFrontGame {
  constructor() {
    this.canvas = document.querySelector("#gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.miniMap = document.querySelector("#miniMap");
    this.miniCtx = this.miniMap.getContext("2d");
    this.tileManager = new TileManager(GRID_COLS, GRID_ROWS);
    this.animalManager = new AnimalManager();
    this.economyManager = new EconomyManager(this.tileManager, this.animalManager);
    this.combatManager = new CombatManager(this.tileManager, this.animalManager);
    this.botManager = new BotManager(this);
    this.ui = new UIManager(this);

    this.players = [];
    this.humanId = "p0";
    this.sendPercent = 0.25;
    this.mode = "expand";
    this.selectedBuilding = "lilyFarm";
    this.selectedTiles = [];
    this.diplomacyTarget = null;
    this.dragRect = null;
    this.hoverTile = null;
    this.lastActionTile = null;
    this.running = false;
    this.frame = 0;
    this.time = 0;
    this.lastTime = 0;
    this.lastUiUpdate = 0;
    this.lastWinCheck = 0;
    this.layout = {
      width: 0,
      height: 0,
      tileSize: 20,
      offsetX: 0,
      offsetY: 0,
      dpr: 1,
    };

    this.ui.bind();
  }

  start(options) {
    this.stop();
    this.time = 0;
    this.mode = "expand";
    this.selectedTiles = [];
    this.diplomacyTarget = null;
    this.dragRect = null;
    this.hoverTile = null;
    this.lastActionTile = null;
    this.selectedBuilding = options.animal === "duck" ? "duckNest" : options.animal === "snake" ? "mudTunnel" : "jumpPad";
    this.tileManager.generate((Date.now() % 10000) + Math.floor(Math.random() * 500));
    this.botManager.reset();
    this.createPlayers(options);
    this.economyManager.recalculate(this.players);
    this.resize();
    this.running = true;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame((now) => this.loop(now));
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.running = false;
    this.frame = 0;
  }

  createPlayers(options) {
    this.players = [];
    const human = this.makePlayer({
      id: this.humanId,
      name: "You",
      animal: options.animal,
      color: ANIMALS[options.animal].color,
      isBot: false,
      difficulty: "human",
    });
    this.players.push(human);

    const botCount = options.practice ? 9 : 12;
    const animals = ["duck", "snake", "frog"];

    for (let index = 0; index < botCount; index += 1) {
      const animal = animals[(index + (options.animal === "duck" ? 1 : 0)) % animals.length];
      const botDifficulty = this.getBotDifficulty(options.difficulty, index);
      const color = PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length];
      this.players.push(
        this.makePlayer({
          id: `b${index}`,
          name: BOT_NAMES[index % BOT_NAMES.length],
          animal,
          color,
          isBot: true,
          difficulty: botDifficulty,
        }),
      );
    }

    this.tileManager.resetOwnership();
    this.players.forEach((player, index) => {
      this.tileManager.claimStartingArea(player, index);
      player.energy = player.isBot ? 48 : 62;
    });
  }

  makePlayer({ id, name, animal, color, isBot, difficulty }) {
    return {
      id,
      name,
      animal,
      color,
      isBot,
      difficulty,
      energy: 55,
      maxEnergy: 78,
      income: 1,
      territory: 0,
      defeated: false,
      alliances: new Set(),
      abilityReadyAt: 0,
      activeAbility: null,
      activeAbilityUntil: 0,
      buildings: {},
      flags: {},
    };
  }

  getBotDifficulty(selected, index) {
    if (selected === "easy" || selected === "smart") return selected;
    if (index % 5 === 0) return "smart";
    if (index % 4 === 0) return "easy";
    return "normal";
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    this.frame = requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.time += dt;

    this.players.forEach((player) => {
      if (player.activeAbility && this.time >= player.activeAbilityUntil) {
        player.activeAbility = null;
      }
    });

    this.tileManager.forEach((tile) => {
      tile.captureFlash = Math.max(0, tile.captureFlash - dt * 1.8);
      tile.reinforcement = Math.max(0, tile.reinforcement - dt * 0.24);
    });

    this.economyManager.update(this.players, dt);
    this.botManager.update(dt);

    if (this.time - this.lastUiUpdate > 0.12) {
      this.ui.update();
      this.lastUiUpdate = this.time;
    }

    if (this.time - this.lastWinCheck > 0.4) {
      this.checkWinCondition();
      this.lastWinCheck = this.time;
    }
  }

  resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(320, this.canvas.clientWidth);
    const height = Math.max(240, this.canvas.clientHeight);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.miniMap.width = Math.floor(this.miniMap.clientWidth * dpr);
    this.miniMap.height = Math.floor(this.miniMap.clientHeight * dpr);
    this.miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tileSize = Math.floor(Math.min(width / this.tileManager.cols, height / this.tileManager.rows));
    const boardWidth = tileSize * this.tileManager.cols;
    const boardHeight = tileSize * this.tileManager.rows;
    this.layout = {
      width,
      height,
      tileSize,
      offsetX: Math.floor((width - boardWidth) / 2),
      offsetY: Math.floor((height - boardHeight) / 2),
      dpr,
    };
    this.updateTileScreens();
    this.draw();
  }

  updateTileScreens() {
    const { tileSize, offsetX, offsetY } = this.layout;
    this.tileManager.forEach((tile) => {
      tile.screenX = offsetX + tile.x * tileSize;
      tile.screenY = offsetY + tile.y * tileSize;
      tile.size = tileSize;
    });
  }

  tileFromCanvas(x, y) {
    const { tileSize, offsetX, offsetY } = this.layout;
    const tx = Math.floor((x - offsetX) / tileSize);
    const ty = Math.floor((y - offsetY) / tileSize);
    return this.tileManager.get(tx, ty);
  }

  handleTileClick(tile) {
    this.lastActionTile = tile;
    const player = this.getHuman();
    if (!player || player.defeated) return { ok: false, reason: "You are out of territory" };

    if (this.mode === "build") {
      const built = this.economyManager.build(player, tile, this.selectedBuilding);
      return built ? { ok: true, reason: "Built" } : { ok: false, reason: "Cannot build there" };
    }

    if (this.mode === "defend") {
      if (tile.owner !== player.id) return { ok: false, reason: "Choose your border" };
      return this.combatManager.reinforce(player, tile, this.sendPercent);
    }

    const result = this.combatManager.expandOrAttack(
      this,
      player,
      tile,
      this.sendPercent,
      this.selectedTiles,
    );
    if (result.ok && result.captured) this.selectedTiles = [];
    return result;
  }

  getTileActionKind(tile, player = this.getHuman()) {
    if (!tile || !player || TILE_TYPES[tile.type].blocks) return "blocked";

    if (this.mode === "build") {
      return this.economyManager.canBuild(player, tile, this.selectedBuilding) ? "build" : "none";
    }

    if (this.mode === "defend") {
      return tile.owner === player.id ? "defend" : "none";
    }

    if (tile.owner === player.id) return "defend";
    const owner = this.getPlayer(tile.owner);
    if (owner && this.areAllied(player.id, owner.id)) return "ally";
    const reach = this.tileManager.getReachInfo(player, tile, this.selectedTiles);
    if (!reach.reachable) return "none";
    return tile.owner ? "attack" : "expand";
  }

  toggleDefendMode() {
    this.mode = this.mode === "defend" ? "expand" : "defend";
  }

  toggleBuildMode() {
    this.mode = this.mode === "build" ? "expand" : "build";
  }

  useAbility() {
    const player = this.getHuman();
    if (!player) return { ok: false, reason: "No animal selected" };
    return this.combatManager.activateAbility(this, player);
  }

  selectBordersInRect(rect) {
    const player = this.getHuman();
    if (!player) return;
    this.selectedTiles = this.tileManager
      .getTilesInRect(rect)
      .filter((tile) => this.tileManager.isBorderTile(tile, player.id))
      .map((tile) => tile.id);
  }

  handleDiplomacy(action) {
    const player = this.getHuman();
    const target = this.getPlayer(this.diplomacyTarget);
    if (!player || !target) return;

    if (action === "ally") {
      player.alliances.add(target.id);
      target.alliances.add(player.id);
      this.ui.toast(`Alliance formed with ${target.name}`);
    }

    if (action === "attack") {
      player.alliances.delete(target.id);
      target.alliances.delete(player.id);
      this.ui.toast(`${target.name} marked for attack`);
    }

    if (action === "warn") {
      target.warnedAt = this.time;
      this.ui.toast(`Warning sent to ${target.name}`);
    }

    if (action === "break") {
      player.alliances.delete(target.id);
      target.alliances.delete(player.id);
      this.ui.toast(`Alliance broken with ${target.name}`);
    }
  }

  areAllied(a, b) {
    if (!a || !b || a === b) return false;
    const player = this.getPlayer(a);
    return Boolean(player?.alliances.has(b));
  }

  getHuman() {
    return this.getPlayer(this.humanId);
  }

  getPlayer(id) {
    if (!id) return null;
    return this.players.find((player) => player.id === id) ?? null;
  }

  getTerritoryPercent(player) {
    const playable = this.tileManager.countPlayableTiles();
    return playable ? player.territory / playable : 0;
  }

  checkWinCondition() {
    if (!this.running) return;
    const active = this.players.filter((player) => !player.defeated);
    const winner = active.find((player) => this.getTerritoryPercent(player) >= WIN_CONTROL);
    if (winner) {
      this.running = false;
      this.ui.showResult(winner, false);
      return;
    }

    if (this.time >= MATCH_SECONDS) {
      const leader = active.slice().sort((a, b) => b.territory - a.territory)[0];
      this.running = false;
      this.ui.showResult(leader, true);
    }
  }

  draw() {
    const { width, height } = this.layout;
    this.ctx.clearRect(0, 0, width, height);
    this.drawWaterBackdrop();
    this.drawLakeFrame();
    this.drawTiles();
    this.drawLegalHints();
    this.drawSelection();
    this.drawActors();
    this.drawMatchClock();
    this.drawMiniMap();
  }

  drawWaterBackdrop() {
    const ctx = this.ctx;
    const { width, height } = this.layout;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#b7f4ef");
    gradient.addColorStop(0.45, "#61cce6");
    gradient.addColorStop(1, "#b7edcd");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#f4f0bb";
    ctx.beginPath();
    ctx.ellipse(-60, height * 0.12, 220, 110, -0.3, 0, Math.PI * 2);
    ctx.ellipse(width + 60, height * 0.82, 240, 140, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#f7ffff";
    ctx.lineWidth = 1.2;
    for (let y = 28; y < height; y += 48) {
      ctx.beginPath();
      for (let x = -20; x < width + 20; x += 24) {
        const ripple = Math.sin((x + this.time * 32 + y * 2) * 0.022) * 4;
        ctx.lineTo(x, y + ripple);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 26; i += 1) {
      const x = (i * 97 + this.time * 13) % (width + 80) - 40;
      const y = (i * 53) % Math.max(1, height);
      const radius = 1.4 + (i % 4) * 0.7;
      ctx.globalAlpha = 0.12 + (i % 3) * 0.04;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLakeFrame() {
    const ctx = this.ctx;
    const { offsetX, offsetY, tileSize } = this.layout;
    const width = this.tileManager.cols * tileSize;
    const height = this.tileManager.rows * tileSize;
    const pad = Math.max(12, tileSize * 0.65);
    const x = offsetX - pad;
    const y = offsetY - pad;
    const w = width + pad * 2;
    const h = height + pad * 2;
    const radius = Math.max(22, tileSize * 1.4);

    ctx.save();
    ctx.shadowColor = "rgba(18, 76, 98, 0.25)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    const pond = ctx.createLinearGradient(x, y, x + w, y + h);
    pond.addColorStop(0, "rgba(122, 226, 232, 0.82)");
    pond.addColorStop(0.55, "rgba(55, 176, 213, 0.74)");
    pond.addColorStop(1, "rgba(145, 229, 198, 0.82)");
    ctx.fillStyle = pond;
    this.roundedRect(ctx, x, y, w, h, radius);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(3, tileSize * 0.14);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.44)";
    this.roundedRect(ctx, x + 2, y + 2, w - 4, h - 4, radius);
    ctx.stroke();

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#267c78";
    ctx.lineWidth = Math.max(2, tileSize * 0.08);
    for (let i = 0; i < 9; i += 1) {
      const px = x + 24 + i * (w - 48) / 8;
      ctx.beginPath();
      ctx.moveTo(px, y + 8);
      ctx.lineTo(px + Math.sin(i) * 12, y + 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, y + h - 8);
      ctx.lineTo(px - Math.cos(i) * 12, y + h - 26);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTiles() {
    const ctx = this.ctx;
    const gap = Math.max(0.75, this.layout.tileSize * 0.045);
    ctx.save();

    this.tileManager.forEach((tile) => {
      const x = tile.screenX + gap / 2;
      const y = tile.screenY + gap / 2;
      const size = tile.size - gap;
      const type = TILE_TYPES[tile.type];
      const radius = Math.max(4, size * 0.2);

      ctx.shadowColor = tile.type === "water" ? "transparent" : "rgba(19, 74, 83, 0.16)";
      ctx.shadowBlur = tile.type === "water" ? 0 : Math.max(2, size * 0.14);
      ctx.shadowOffsetY = tile.type === "water" ? 0 : Math.max(1, size * 0.05);
      ctx.fillStyle = this.getTerrainPaint(ctx, tile, x, y, size);
      ctx.globalAlpha = tile.type === "water" ? 0.72 : 0.98;
      this.roundedRect(ctx, x, y, size, size, radius);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.globalAlpha = 1;

      this.drawTerrainDetail(tile, x, y, size);
      this.drawOwnerOverlay(tile, x, y, size);
      this.drawBuilding(tile, x, y, size);
      if (tile.captureFlash > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${tile.captureFlash * 0.76})`;
        ctx.lineWidth = Math.max(2, size * 0.1);
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * (0.18 + tile.captureFlash * 0.34), 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    this.tileManager.forEach((tile) => this.drawTileBorder(tile));
    ctx.restore();
  }

  getTerrainPaint(ctx, tile, x, y, size) {
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    const colors = {
      water: ["#7ee3eb", "#51c5df"],
      lily: ["#a2e77f", "#5cad5d"],
      reeds: ["#92c96a", "#567f3e"],
      mud: ["#cfaa67", "#9b6a3f"],
      rock: ["#b0bac3", "#6f7f8c"],
      nest: ["#f0c98e", "#c9894e"],
      critter: ["#edd979", "#b49a45"],
    };
    const [start, end] = colors[tile.type] ?? [TILE_TYPES[tile.type].color, TILE_TYPES[tile.type].color];
    gradient.addColorStop(0, start);
    gradient.addColorStop(1, end);
    return gradient;
  }

  drawTerrainDetail(tile, x, y, size) {
    const ctx = this.ctx;
    const cx = x + size / 2;
    const cy = y + size / 2;

    if (tile.type === "water") {
      if (tile.id % 5 !== Math.floor(this.time) % 5) return;
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy + Math.sin(this.time + tile.id) * size * 0.03, size * 0.24, Math.PI * 0.1, Math.PI * 0.88);
      ctx.stroke();
    }

    if (tile.type === "lily") {
      ctx.fillStyle = "#3f9c55";
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.03, cy, size * 0.35, size * 0.24, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.1, cy - size * 0.04, size * 0.16, size * 0.07, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6d7df";
      ctx.beginPath();
      ctx.arc(cx + size * 0.13, cy - size * 0.07, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffeef4";
      ctx.beginPath();
      ctx.arc(cx + size * 0.18, cy - size * 0.02, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.type === "reeds") {
      ctx.strokeStyle = "#365f32";
      ctx.lineWidth = Math.max(1, size * 0.068);
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i += 1) {
        const ox = (i - 1.5) * size * 0.14;
        const sway = Math.sin(this.time * 2 + tile.id + i) * size * 0.04;
        ctx.beginPath();
        ctx.moveTo(cx + ox, y + size * 0.82);
        ctx.quadraticCurveTo(cx + ox + sway, y + size * 0.45, cx + ox + size * 0.08 + sway, y + size * 0.17);
        ctx.stroke();
      }
    }

    if (tile.type === "mud") {
      ctx.fillStyle = "rgba(86, 62, 39, 0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.34, size * 0.22, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(cx - size * 0.12, cy - size * 0.04, size * 0.045, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.11, cy + size * 0.07, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.type === "rock") {
      ctx.fillStyle = "#eef6f7";
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.03, cy + size * 0.23, size * 0.32, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6f7f8c";
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.28, cy + size * 0.22);
      ctx.lineTo(cx - size * 0.14, cy - size * 0.25);
      ctx.lineTo(cx + size * 0.24, cy - size * 0.16);
      ctx.lineTo(cx + size * 0.32, cy + size * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.08, cy - size * 0.2);
      ctx.lineTo(cx + size * 0.2, cy - size * 0.13);
      ctx.lineTo(cx + size * 0.04, cy - size * 0.02);
      ctx.closePath();
      ctx.fill();
    }

    if (tile.type === "nest") {
      ctx.strokeStyle = "#8d602c";
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.14, Math.PI * 0.18, Math.PI * 1.35);
      ctx.stroke();
    }

    if (tile.type === "critter") {
      ctx.fillStyle = "#fff1a8";
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#725e2c";
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#725e2c";
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.2, cy);
      ctx.lineTo(cx + size * 0.2, cy);
      ctx.stroke();
    }
  }

  drawOwnerOverlay(tile, x, y, size) {
    const player = this.getPlayer(tile.owner);
    if (!player) return;
    const hidden = tile.borderHiddenUntil > this.time && player.id !== this.humanId;
    const ctx = this.ctx;
    const rgb = this.hexToRgb(player.color);
    const radius = Math.max(4, size * 0.2);
    const overlay = ctx.createRadialGradient(
      x + size * 0.34,
      y + size * 0.28,
      size * 0.05,
      x + size * 0.5,
      y + size * 0.5,
      size * 0.72,
    );
    overlay.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${hidden ? 0.18 : 0.62})`);
    overlay.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},${hidden ? 0.1 : 0.4})`);
    ctx.fillStyle = overlay;
    this.roundedRect(ctx, x + size * 0.06, y + size * 0.06, size * 0.88, size * 0.88, radius);
    ctx.fill();

    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${hidden ? 0.14 : 0.38})`;
    ctx.lineWidth = Math.max(1, size * 0.035);
    this.roundedRect(ctx, x + size * 0.12, y + size * 0.12, size * 0.76, size * 0.76, radius * 0.7);
    ctx.stroke();

    if (tile.reinforcement > 2) {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      this.roundedRect(ctx, x + size * 0.2, y + size * 0.74, size * 0.6, Math.max(2, size * 0.09), size * 0.05);
      ctx.fill();
    }
  }

  drawTileBorder(tile) {
    const player = this.getPlayer(tile.owner);
    if (!player) return;
    if (tile.borderHiddenUntil > this.time && player.id !== this.humanId) return;
    const ctx = this.ctx;
    const { tileSize } = this.layout;
    const x = tile.screenX;
    const y = tile.screenY;
    ctx.strokeStyle = player.color;
    ctx.lineWidth = Math.max(2.5, tileSize * 0.12);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = player.color;
    ctx.shadowBlur = Math.max(3, tileSize * 0.18);

    tile.neighbors.forEach((neighbor) => {
      if (neighbor.owner === tile.owner) return;
      ctx.beginPath();
      if (neighbor.x < tile.x) {
        ctx.moveTo(x + 1, y + 2);
        ctx.lineTo(x + 1, y + tileSize - 2);
      } else if (neighbor.x > tile.x) {
        ctx.moveTo(x + tileSize - 1, y + 2);
        ctx.lineTo(x + tileSize - 1, y + tileSize - 2);
      } else if (neighbor.y < tile.y) {
        ctx.moveTo(x + 2, y + 1);
        ctx.lineTo(x + tileSize - 2, y + 1);
      } else if (neighbor.y > tile.y) {
        ctx.moveTo(x + 2, y + tileSize - 1);
        ctx.lineTo(x + tileSize - 2, y + tileSize - 1);
      }
      ctx.stroke();
    });
    ctx.shadowColor = "transparent";
  }

  drawBuilding(tile, x, y, size) {
    if (!tile.building) return;
    const ctx = this.ctx;
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = "rgba(19, 55, 64, 0.22)";
    ctx.shadowBlur = Math.max(2, size * 0.16);
    ctx.shadowOffsetY = Math.max(1, size * 0.08);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "rgba(23,50,74,0.56)";
    ctx.lineWidth = Math.max(1, size * 0.045);

    if (tile.building === "duckNest") {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f0b63f";
      ctx.beginPath();
      ctx.arc(size * 0.07, -size * 0.02, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.building === "reedGuard") {
      ctx.fillStyle = "#f7fff0";
      this.roundedRect(ctx, -size * 0.2, -size * 0.26, size * 0.4, size * 0.52, size * 0.06);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4f8f52";
      ctx.fillRect(-size * 0.04, -size * 0.34, size * 0.08, size * 0.68);
    }

    if (tile.building === "lilyFarm") {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.24, size * 0.16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6abf69";
      ctx.beginPath();
      ctx.arc(size * 0.16, -size * 0.08, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.building === "mudTunnel") {
      ctx.fillStyle = "#7d5a3b";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, Math.PI, Math.PI * 2);
      ctx.lineTo(size * 0.22, size * 0.18);
      ctx.lineTo(-size * 0.22, size * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(0, size * 0.08, size * 0.13, size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.building === "jumpPad") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.beginPath();
      ctx.arc(0, size * 0.05, size * 0.22, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = "#cc5f9b";
      ctx.beginPath();
      ctx.arc(0, -size * 0.02, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSelection() {
    const ctx = this.ctx;
    const { tileSize } = this.layout;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2.5, tileSize * 0.1);
    ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
    ctx.shadowBlur = Math.max(4, tileSize * 0.22);
    this.selectedTiles.forEach((id) => {
      const tile = this.tileManager.getById(id);
      if (!tile) return;
      this.roundedRect(ctx, tile.screenX + 3, tile.screenY + 3, tileSize - 6, tileSize - 6, tileSize * 0.2);
      ctx.stroke();
    });

    if (this.dragRect) {
      const x = Math.min(this.dragRect.x1, this.dragRect.x2);
      const y = Math.min(this.dragRect.y1, this.dragRect.y2);
      const width = Math.abs(this.dragRect.x2 - this.dragRect.x1);
      const height = Math.abs(this.dragRect.y2 - this.dragRect.y1);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      this.roundedRect(ctx, x, y, width, height, 8);
      ctx.fill();
      ctx.stroke();
    }

    if (this.hoverTile && !TILE_TYPES[this.hoverTile.type].blocks) {
      const tile = this.hoverTile;
      const player = this.getHuman();
      const owned = tile.owner === this.humanId;
      const allied = player && tile.owner && this.areAllied(player.id, tile.owner);
      const color = this.mode === "build" || owned ? "#ffffff" : allied ? "#55d6a7" : "#ffef9a";
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.max(5, tileSize * 0.28);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, tileSize * 0.1);
      this.roundedRect(ctx, tile.screenX + 2, tile.screenY + 2, tileSize - 4, tileSize - 4, tileSize * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLegalHints() {
    const player = this.getHuman();
    if (!player || player.defeated || !this.running) return;

    let tiles = [];
    let color = "#ffe985";
    if (this.mode === "build") {
      tiles = this.tileManager
        .getOwnedTiles(player.id)
        .filter((tile) => this.economyManager.canBuild(player, tile, this.selectedBuilding));
      color = "#73e6a6";
    } else if (this.mode === "defend") {
      tiles = this.tileManager.getBorderTiles(player.id);
      color = "#ffffff";
    } else {
      tiles = this.tileManager
        .getCapturableNeighbors(player.id)
        .filter((tile) => {
          const owner = this.getPlayer(tile.owner);
          return !owner || !this.areAllied(player.id, owner.id);
        });
      color = "#ffed8a";
    }

    const ctx = this.ctx;
    const pulse = 0.65 + Math.sin(this.time * 5) * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.max(5, this.layout.tileSize * 0.22);

    tiles.slice(0, 120).forEach((tile) => {
      if (TILE_TYPES[tile.type].blocks) return;
      const size = tile.size;
      const x = tile.screenX + size / 2;
      const y = tile.screenY + size / 2;
      const enemy = tile.owner && tile.owner !== player.id;
      const radius = size * (enemy ? 0.22 : 0.16) * pulse;
      ctx.lineWidth = Math.max(1.5, size * 0.055);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = enemy ? 0.7 : 0.45;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, size * 0.055), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.82;
    });

    ctx.restore();
  }

  drawActors() {
    const ctx = this.ctx;
    const labelIds = new Set(
      this.players
        .filter((player) => !player.defeated)
        .slice()
        .sort((a, b) => b.territory - a.territory)
        .slice(0, 4)
        .map((player) => player.id),
    );
    labelIds.add(this.humanId);

    this.players.forEach((player) => {
      if (player.defeated || player.territory <= 0) return;
      const owned = this.tileManager.getOwnedTiles(player.id);
      if (!owned.length) return;
      const sample = owned[Math.floor((this.time * 2 + owned.length) % owned.length)];
      const bob = Math.sin(this.time * 3 + player.id.length) * 2;
      const x = sample.screenX + sample.size / 2;
      const y = sample.screenY + sample.size / 2 + bob;
      const size = Math.max(11, sample.size * 0.72);

      ctx.save();
      if (player.activeAbility) {
        const rgb = this.hexToRgb(player.color);
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.62)`;
        ctx.lineWidth = Math.max(2, size * 0.08);
        ctx.beginPath();
        ctx.arc(x, y, size * (0.58 + Math.sin(this.time * 8) * 0.05), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (player.animal === "duck") this.drawDuck(ctx, x, y, size, player);
      if (player.animal === "snake") this.drawSnake(ctx, x, y, size, player);
      if (player.animal === "frog") this.drawFrog(ctx, x, y, size, player);
      ctx.restore();

      if (sample.size > 17 && labelIds.has(player.id)) {
        ctx.font = `900 ${Math.max(9, sample.size * 0.33)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.86)";
        ctx.fillStyle = "rgba(19,48,68,0.82)";
        ctx.strokeText(player.id === this.humanId ? "You" : player.name.split(" ")[0], x, y + size * 0.48);
        ctx.fillText(player.id === this.humanId ? "You" : player.name.split(" ")[0], x, y + size * 0.48);
      }
    });
  }

  drawDuck(ctx, x, y, size, player) {
    this.drawSpriteShadow(ctx, x, y, size);
    ctx.strokeStyle = "rgba(121, 83, 35, 0.36)";
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.34, size * 0.22, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size * 0.2, y - size * 0.17, size * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.beginPath();
    ctx.ellipse(x - size * 0.08, y - size * 0.05, size * 0.16, size * 0.08, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e87835";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.35, y - size * 0.16);
    ctx.lineTo(x + size * 0.52, y - size * 0.1);
    ctx.lineTo(x + size * 0.35, y - size * 0.05);
    ctx.closePath();
    ctx.fill();
    this.drawEye(ctx, x + size * 0.24, y - size * 0.2, size);
  }

  drawSnake(ctx, x, y, size, player) {
    this.drawSpriteShadow(ctx, x, y + size * 0.05, size);
    ctx.strokeStyle = player.color;
    ctx.lineWidth = size * 0.2;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(21, 76, 56, 0.24)";
    ctx.shadowBlur = size * 0.14;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.35, y + size * 0.1);
    ctx.bezierCurveTo(x - size * 0.12, y - size * 0.28, x + size * 0.08, y + size * 0.28, x + size * 0.34, y - size * 0.05);
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = size * 0.055;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.28, y + size * 0.05);
    ctx.bezierCurveTo(x - size * 0.08, y - size * 0.18, x + size * 0.1, y + size * 0.15, x + size * 0.28, y - size * 0.07);
    ctx.stroke();
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x + size * 0.34, y - size * 0.05, size * 0.17, 0, Math.PI * 2);
    ctx.fill();
    this.drawEye(ctx, x + size * 0.39, y - size * 0.09, size);
  }

  drawFrog(ctx, x, y, size, player) {
    this.drawSpriteShadow(ctx, x, y + size * 0.03, size);
    ctx.strokeStyle = "rgba(101, 43, 91, 0.34)";
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - size * 0.16, y - size * 0.23, size * 0.12, 0, Math.PI * 2);
    ctx.arc(x + size * 0.16, y - size * 0.23, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.ellipse(x - size * 0.08, y - size * 0.03, size * 0.09, size * 0.05, -0.2, 0, Math.PI * 2);
    ctx.fill();
    this.drawEye(ctx, x - size * 0.16, y - size * 0.25, size);
    this.drawEye(ctx, x + size * 0.16, y - size * 0.25, size);
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.arc(x, y + size * 0.02, size * 0.15, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  drawEye(ctx, x, y, size) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17324a";
    ctx.beginPath();
    ctx.arc(x + size * 0.012, y, size * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSpriteShadow(ctx, x, y, size) {
    ctx.fillStyle = "rgba(13, 54, 68, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.28, size * 0.38, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMatchClock() {
    const ctx = this.ctx;
    const left = Math.max(0, MATCH_SECONDS - this.time);
    const minutes = Math.floor(left / 60);
    const seconds = Math.floor(left % 60)
      .toString()
      .padStart(2, "0");
    ctx.font = "900 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = `${minutes}:${seconds}`;
    const x = this.layout.width / 2;
    const y = 24;
    ctx.save();
    ctx.shadowColor = "rgba(24, 73, 91, 0.18)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    this.roundedRect(ctx, x - 38, y - 16, 76, 32, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#17324a";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawMiniMap() {
    const ctx = this.miniCtx;
    const width = this.miniMap.clientWidth;
    const height = this.miniMap.clientHeight;
    const cellW = width / this.tileManager.cols;
    const cellH = height / this.tileManager.rows;
    ctx.clearRect(0, 0, width, height);
    const miniGradient = ctx.createLinearGradient(0, 0, width, height);
    miniGradient.addColorStop(0, "#9feaf0");
    miniGradient.addColorStop(1, "#52bdd8");
    ctx.fillStyle = miniGradient;
    this.roundedRect(ctx, 0, 0, width, height, 8);
    ctx.fill();

    this.tileManager.forEach((tile) => {
      if (TILE_TYPES[tile.type].blocks) ctx.fillStyle = "#71808a";
      else if (tile.owner) ctx.fillStyle = this.getPlayer(tile.owner)?.color ?? "#d9c56a";
      else ctx.fillStyle = TILE_TYPES[tile.type].color;
      ctx.globalAlpha = tile.owner ? 0.88 : tile.type === "water" ? 0.18 : 0.62;
      ctx.fillRect(tile.x * cellW, tile.y * cellH, Math.ceil(cellW), Math.ceil(cellH));
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 2;
    this.roundedRect(ctx, 1, 1, width - 2, height - 2, 8);
    ctx.stroke();
  }

  roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }
}

const game = new PondFrontGame();
window.pondFrontGame = game;

})();
