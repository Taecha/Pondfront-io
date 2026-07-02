const config = require("../shared/gameConfig");
const objectiveConfig = require("../shared/objectives");

class ObjectiveManager {
  constructor(tileManager, pushEvent) {
    this.tileManager = tileManager;
    this.pushEvent = pushEvent;
    this.objectives = [];
    this.camps = [];
    this.objectiveOwner = new Map();
    this.campOwner = new Map();
    this.campSeed = 1;
  }

  setup(now) {
    this.objectives = [];
    this.camps = [];
    this.objectiveOwner.clear();
    this.campOwner.clear();
    this.clearMarkers();
    this.placeObjectives(now);
    this.placeCamps(now);
  }

  clearMarkers() {
    this.tileManager.tiles.forEach((tile) => {
      tile.objectiveId = null;
      tile.objectiveType = null;
      tile.campId = null;
      tile.campType = null;
      tile.specialActive = false;
    });
  }

  placeObjectives(now) {
    const objectiveCount = this.tileManager.map?.objectiveCount || Object.keys(objectiveConfig.LAKE_OBJECTIVES).length;
    const definitions = Object.entries(objectiveConfig.LAKE_OBJECTIVES);
    const centers = this.objectiveCenters(objectiveCount);
    for (let i = 0; i < objectiveCount; i += 1) {
      const [type, definition] = definitions[i % definitions.length];
      const center = centers[i] || this.scaledCenter(definition.spawn);
      const tile = this.bestTile(center, definition.tilePreference);
      if (!tile) continue;
      const id = i < definitions.length ? type : `${type}-${i + 1}`;
      tile.objectiveId = id;
      tile.objectiveType = type;
      tile.specialActive = false;
      tile.defenseEnergy = Math.max(tile.defenseEnergy || 0, 16);
      this.objectives.push({
        id,
        type,
        tileId: tile.id,
        active: false,
        appeared: false,
        activeAt: now + config.BALANCE.objectiveSpawnTime,
        owner: null,
      });
    }
  }

  placeCamps(now) {
    const campCount = this.tileManager.map?.campCount || 8;
    const definitions = Object.entries(objectiveConfig.CRITTER_CAMPS);
    const centers = this.campCenters(campCount);
    for (let i = 0; i < campCount; i += 1) {
      const [type, definition] = definitions[i % definitions.length];
      const fallbackPosition = definition.positions[i % definition.positions.length] || { x: 42, y: 27 };
      const tile = this.bestTile(centers[i] || this.scaledCenter({ ...fallbackPosition, radius: 4 }), ["water", "lily", "reeds", "mud", "nest"]);
      if (!tile || tile.objectiveId || tile.campId) continue;
      const id = `${type}-${i + 1}`;
      tile.campId = id;
      tile.campType = type;
      tile.specialActive = true;
      tile.defenseEnergy = Math.max(tile.defenseEnergy || 0, 10);
      this.camps.push({
        id,
        type,
        tileId: tile.id,
        active: true,
        owner: null,
        lastCapturedBy: null,
        refreshedAt: now,
      });
    }
  }

  update(game) {
    const now = game.now();
    this.objectives.forEach((objective) => {
      const tile = this.tileManager.getById(objective.tileId);
      if (!tile) return;
      if (!objective.active && now >= objective.activeAt) {
        objective.active = true;
        objective.appeared = true;
        tile.specialActive = true;
        this.pushEvent({
          kind: "objectiveAppeared",
          objectiveId: objective.id,
          objectiveType: objective.type,
          to: tile.id,
          message: `${this.objectiveDefinition(objective.type).label} has appeared!`,
          at: now,
        });
      }
      if (!objective.active) return;
      this.checkObjectiveCapture(game, objective, tile);
    });

    this.camps.forEach((camp) => {
      const tile = this.tileManager.getById(camp.tileId);
      if (!tile) return;
      this.checkCampCapture(game, camp, tile);
    });
  }

  checkObjectiveCapture(game, objective, tile) {
    const previous = this.objectiveOwner.get(objective.id) || null;
    const owner = tile.owner || null;
    objective.owner = owner;
    if (owner && owner !== previous) {
      const player = game.getPlayer(owner);
      this.objectiveOwner.set(objective.id, owner);
      if (player) {
        player.stats.objectivesCaptured = (player.stats.objectivesCaptured || 0) + 1;
        this.pushEvent({
          kind: "objectiveCaptured",
          objectiveId: objective.id,
          objectiveType: objective.type,
          playerId: owner,
          to: tile.id,
          message: `${player.name} controls ${this.objectiveDefinition(objective.type).label}.`,
          at: game.now(),
        });
      }
    } else if (!owner && previous) {
      this.objectiveOwner.delete(objective.id);
    }
  }

  checkCampCapture(game, camp, tile) {
    const previous = this.campOwner.get(camp.id) || null;
    const owner = tile.owner || null;
    camp.owner = owner;
    if (!owner || owner === previous) return;
    const player = game.getPlayer(owner);
    if (!player) return;
    const definition = this.campDefinition(camp.type);
    camp.lastCapturedBy = owner;
    this.campOwner.set(camp.id, owner);
    this.applyCampReward(player, definition, game.now());
    player.stats.campsCaptured = (player.stats.campsCaptured || 0) + 1;
    this.pushEvent({
      kind: "campCaptured",
      campId: camp.id,
      campType: camp.type,
      playerId: owner,
      to: tile.id,
      message: `${player.name} captured ${definition.label}.`,
      at: game.now(),
    });
  }

  applyCampReward(player, definition, now) {
    player.flags = player.flags || {};
    const until = now + definition.duration;
    if (definition.effect === "defense") player.flags.campDefenseUntil = Math.max(player.flags.campDefenseUntil || 0, until);
    if (definition.effect === "attack") player.flags.campAttackUntil = Math.max(player.flags.campAttackUntil || 0, until);
    if (definition.effect === "income") player.flags.campIncomeUntil = Math.max(player.flags.campIncomeUntil || 0, until);
    if (definition.effect === "vision") player.flags.campVisionUntil = Math.max(player.flags.campVisionUntil || 0, until);
  }

  refreshNeutralCamps(game) {
    const now = game.now();
    this.camps.forEach((camp, index) => {
      const oldTile = this.tileManager.getById(camp.tileId);
      if (oldTile?.owner) return;
      if (oldTile) {
        oldTile.campId = null;
        oldTile.campType = null;
      }
      const definition = this.campDefinition(camp.type);
      const base = definition.positions[index % definition.positions.length] || { x: 42, y: 27 };
      const drift = (this.campSeed++ % 5) - 2;
      const scaled = this.scaledCenter({ x: base.x + drift * 2, y: base.y - drift, radius: 7 });
      const next = this.bestTile(scaled, ["water", "lily", "reeds", "mud", "nest"]);
      if (!next || next.objectiveId || next.campId || next.owner) {
        if (oldTile) {
          oldTile.campId = camp.id;
          oldTile.campType = camp.type;
        }
        return;
      }
      next.campId = camp.id;
      next.campType = camp.type;
      next.specialActive = true;
      next.defenseEnergy = Math.max(next.defenseEnergy || 0, 10);
      camp.tileId = next.id;
      camp.owner = null;
      camp.refreshedAt = now;
      this.pushEvent({
        kind: "campMoved",
        campId: camp.id,
        campType: camp.type,
        to: next.id,
        message: `${definition.label} moved with the migration.`,
        at: now,
      });
    });
  }

  bestTile(center, preferredTypes) {
    const candidates = [];
    const radius = center.radius || 4;
    for (let y = Math.max(2, center.y - radius); y <= Math.min(this.tileManager.rows - 3, center.y + radius); y += 1) {
      for (let x = Math.max(2, center.x - radius); x <= Math.min(this.tileManager.cols - 3, center.x + radius); x += 1) {
        const tile = this.tileManager.get(x, y);
        if (!tile || config.TILE_TYPES[tile.type].blocks || tile.objectiveId || tile.campId) continue;
        const d = Math.abs(tile.x - center.x) + Math.abs(tile.y - center.y);
        const preference = preferredTypes.includes(tile.type) ? preferredTypes.length - preferredTypes.indexOf(tile.type) : 0;
        candidates.push({ tile, score: preference * 8 - d + Math.random() * 0.1 });
      }
    }
    return candidates.sort((a, b) => b.score - a.score)[0]?.tile || null;
  }

  objectiveCenters(count) {
    const base = [
      [0.5, 0.5],
      [0.24, 0.24],
      [0.76, 0.76],
      [0.74, 0.25],
      [0.28, 0.72],
      [0.5, 0.22],
      [0.5, 0.78],
      [0.82, 0.52],
    ];
    return base.slice(0, count).map(([x, y]) => this.percentCenter(x, y, 6));
  }

  campCenters(count) {
    const centers = [];
    const rings = [
      [0.16, 0.5],
      [0.84, 0.5],
      [0.34, 0.22],
      [0.66, 0.78],
      [0.34, 0.78],
      [0.66, 0.22],
      [0.5, 0.32],
      [0.5, 0.68],
      [0.18, 0.18],
      [0.82, 0.82],
      [0.18, 0.82],
      [0.82, 0.18],
      [0.42, 0.48],
      [0.58, 0.52],
      [0.25, 0.38],
      [0.75, 0.62],
      [0.25, 0.62],
      [0.75, 0.38],
      [0.42, 0.12],
      [0.58, 0.88],
    ];
    for (let i = 0; i < count; i += 1) centers.push(this.percentCenter(...rings[i % rings.length], 5));
    return centers;
  }

  percentCenter(px, py, radius = 5) {
    return {
      x: Math.max(3, Math.min(this.tileManager.cols - 4, Math.round(this.tileManager.cols * px))),
      y: Math.max(3, Math.min(this.tileManager.rows - 4, Math.round(this.tileManager.rows * py))),
      radius,
    };
  }

  scaledCenter(center) {
    return {
      x: Math.max(3, Math.min(this.tileManager.cols - 4, Math.round((center.x / 84) * this.tileManager.cols))),
      y: Math.max(3, Math.min(this.tileManager.rows - 4, Math.round((center.y / 54) * this.tileManager.rows))),
      radius: center.radius || 5,
    };
  }

  objectiveDefinition(type) {
    return objectiveConfig.LAKE_OBJECTIVES[type] || {};
  }

  campDefinition(type) {
    return objectiveConfig.CRITTER_CAMPS[type] || {};
  }

  tileCostBonus(tile) {
    if (!tile) return 0;
    if (tile.objectiveId) {
      const objective = this.objectives.find((entry) => entry.id === tile.objectiveId);
      if (objective?.active) return this.objectiveDefinition(objective.type).captureCostBonus || 0;
    }
    if (tile.campId) {
      const camp = this.camps.find((entry) => entry.id === tile.campId);
      if (camp?.active) return this.campDefinition(camp.type).captureCostBonus || 0;
    }
    return 0;
  }

  snapshot() {
    return {
      objectives: this.objectives.map((objective) => ({
        ...objective,
        definition: this.objectiveDefinition(objective.type),
      })),
      camps: this.camps.map((camp) => ({
        ...camp,
        definition: this.campDefinition(camp.type),
      })),
    };
  }
}

module.exports = ObjectiveManager;
