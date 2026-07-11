const config = require("../shared/gameConfig");
const specials = require("../shared/specialConfig");

class SpecialManager {
  constructor(tileManager, pushEvent) {
    this.tileManager = tileManager;
    this.pushEvent = pushEvent;
    this.pending = [];
    this.zones = [];
    this.nextId = 1;
  }

  reset() {
    this.pending = [];
    this.zones = [];
    this.nextId = 1;
  }

  update(game) {
    const now = game.now();
    this.zones = this.zones.filter((zone) => zone.expiresAt > now);
    const ready = [];
    this.pending = this.pending.filter((strike) => {
      if (strike.impactAt <= now) {
        ready.push(strike);
        return false;
      }
      return true;
    });
    ready.forEach((strike) => this.resolveLilyBarrage(game, strike, now));
  }

  activate(game, player, type, tileId, options = {}) {
    const special = specials[type];
    if (!special) return { ok: false, resultType: "invalidSpecial", message: "Unknown pond special." };
    const now = game.now();
    const tile = this.tileManager.getById(Number(tileId));
    if (!tile || config.TILE_TYPES[tile.type]?.blocks) return { ok: false, resultType: "invalidTarget", message: "Choose a valid pond tile." };
    const cooldowns = player.specialCooldowns || {};
    const cooldownLeft = Math.max(0, (cooldowns[type] || 0) - now);
    if (cooldownLeft > 0) return { ok: false, resultType: "cooldown", message: `${special.label} cooling down for ${Math.ceil(cooldownLeft)}s.` };
    const cost = this.costFor(game, player, type);
    if (player.energy < cost) return { ok: false, resultType: "notEnoughEnergy", message: `${special.label} needs ${cost} Animal Energy.` };
    const validation = this.validateTarget(game, player, special, type, tile, options);
    if (!validation.ok) return validation;

    player.energy = Math.max(0, player.energy - cost);
    player.stats.specialsUsed = (player.stats.specialsUsed || 0) + 1;
    player.stats.energyUsed = (player.stats.energyUsed || 0) + cost;
    player.specialCooldowns = {
      ...player.specialCooldowns,
      [type]: now + (special.cooldown || 45),
    };

    if (type === "lilyBarrage") return this.launchLilyBarrage(game, player, tile, special, cost, now);
    return this.placeDefenseZone(game, player, tile, special, type, cost, now);
  }

  costFor(game, player, type) {
    const special = specials[type];
    let cost = special?.cost || 0;
    if (type === "lilyBarrage" && game.matchSettings?.beginnerCombat && player.isBot) cost = Math.round(cost * 1.25);
    return cost;
  }

  validateTarget(game, player, special, type, tile) {
    const inRange = this.inRange(player, tile, special.range || 18);
    if (!inRange) return { ok: false, resultType: "outOfRange", message: `${special.label} is out of range.` };
    if (type === "lilyBarrage") {
      const defender = tile.owner ? game.getPlayer(tile.owner) : null;
      if (!defender || defender.id === player.id) return { ok: false, resultType: "invalidTarget", message: "Lily Barrage needs enemy territory." };
      const diplomacy = game.diplomacy.canAttack(player.id, defender.id, game.now());
      if (!diplomacy.ok) return { ok: false, resultType: "diplomacyBlocked", message: diplomacy.reason || "Cannot target an ally or truce player." };
      if (tile.isCore && !this.isExposedCore(tile, defender.id)) return { ok: false, resultType: "coreProtected", message: "Core Nest cannot be directly targeted while protected by nearby territory." };
      return { ok: true };
    }
    if (type === "dragonflyGuard") {
      if (!tile.owner) return { ok: false, resultType: "invalidTarget", message: "Dragonfly Guard needs your or allied territory." };
      const owner = game.getPlayer(tile.owner);
      const sameTeam = Boolean(!game.matchSettings?.friendlyFire && player.teamId && owner?.teamId && player.teamId === owner.teamId);
      if (tile.owner !== player.id && !game.diplomacy.areAllied(player.id, tile.owner) && !sameTeam) {
        return { ok: false, resultType: "invalidTarget", message: "Dragonfly Guard can protect only your territory or allies." };
      }
      return { ok: true };
    }
    if (type === "reedShield") {
      if (tile.owner !== player.id) return { ok: false, resultType: "invalidTarget", message: "Reed Shield needs your border territory." };
      if (!tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== player.id)) return { ok: false, resultType: "invalidTarget", message: "Reed Shield must be placed on your border." };
      return { ok: true };
    }
    return { ok: false, resultType: "invalidSpecial", message: "Unknown pond special." };
  }

  launchLilyBarrage(game, player, tile, special, cost, now) {
    const id = `special-${this.nextId}`;
    this.nextId += 1;
    const strike = {
      id,
      type: "lilyBarrage",
      playerId: player.id,
      targetOwner: tile.owner,
      targetTileId: tile.id,
      radius: special.radius || 2,
      impactAt: now + (special.warningSeconds || 4),
      cost,
    };
    this.pending.push(strike);
    game.recordWar?.(player.id, tile.owner, { attack: true, damage: cost, energySpent: cost });
    this.pushEvent({
      kind: "specialLaunch",
      specialType: "lilyBarrage",
      specialId: id,
      playerId: player.id,
      targetOwner: tile.owner,
      to: tile.id,
      radius: strike.radius,
      impactAt: strike.impactAt,
      warningSeconds: special.warningSeconds || 4,
      amount: cost,
      at: now,
      message: `${player.name} launched Lily Barrage. Impact in ${special.warningSeconds || 4}s.`,
    });
    return { ok: true, resultType: "specialLaunched", message: "Lily Barrage launched. Defender has a short warning.", cooldown: special.cooldown, cost };
  }

  placeDefenseZone(game, player, tile, special, type, cost, now) {
    const id = `zone-${this.nextId}`;
    this.nextId += 1;
    const zone = {
      id,
      type,
      playerId: player.id,
      ownerId: tile.owner || player.id,
      tileId: tile.id,
      radius: special.radius || 3,
      expiresAt: now + (special.duration || 18),
    };
    this.zones.push(zone);
    this.pushEvent({
      kind: "specialDefense",
      specialType: type,
      specialId: id,
      playerId: player.id,
      targetOwner: zone.ownerId,
      to: tile.id,
      radius: zone.radius,
      expiresAt: zone.expiresAt,
      amount: cost,
      at: now,
      message: `${special.label} active for ${special.duration || 18}s.`,
    });
    return { ok: true, resultType: "specialDefense", message: `${special.label} active.`, cooldown: special.cooldown, cost };
  }

  resolveLilyBarrage(game, strike, now) {
    const attacker = game.getPlayer(strike.playerId);
    const defender = game.getPlayer(strike.targetOwner);
    const center = this.tileManager.getById(strike.targetTileId);
    if (!attacker || attacker.defeated || !defender || defender.defeated || !center) return;
    const special = specials.lilyBarrage;
    const tiles = this.tilesInRadius(center, strike.radius)
      .filter((tile) => tile.owner === defender.id && !config.TILE_TYPES[tile.type]?.blocks)
      .sort((a, b) => this.distance(center, a) - this.distance(center, b));
    let captured = 0;
    let weakened = 0;
    let reduced = 0;
    const capturedTiles = [];
    const weakenedTiles = [];
    const defenderOwnedAtStart = this.tileManager.owned(defender.id).length;

    tiles.forEach((tile) => {
      const reduction = this.strikeDamageMultiplier(defender, tile, now);
      if (reduction < 0.98) reduced += 1;
      const distanceFalloff = 1 - Math.min(0.42, this.distance(center, tile) * 0.12);
      const coreMultiplier = tile.isCore ? special.corePressureMultiplier || 0.35 : 1;
      const beginnerMultiplier = game.matchSettings?.beginnerCombat && !defender.isBot && attacker.isBot ? 0.72 : 1;
      const pressure = (special.basePressure || 42) * reduction * distanceFalloff * coreMultiplier * beginnerMultiplier;
      const fakeWave = {
        attackerId: attacker.id,
        defenderId: defender.id,
        spentEnergy: strike.cost,
        remainingPower: strike.cost,
        remainingBudget: strike.cost,
        ambushApplied: false,
      };
      const candidate = {
        tile,
        from: strike.targetTileId,
        distance: this.distance(center, tile),
        attackerEdges: tile.neighbors.filter((neighbor) => neighbor.owner === attacker.id).length,
      };
      const cost = game.combat.waveCaptureCost(game, fakeWave, attacker, defender, candidate, true);
      const progress = Math.min(cost * 0.95, (tile.captureProgress?.[attacker.id] || 0) + pressure);
      tile.captureProgress = { ...(tile.captureProgress || {}), [attacker.id]: progress };
      tile.defenseEnergy = Math.max(0, (tile.defenseEnergy || 0) - pressure * 0.18);
      const canCaptureMore = captured < (special.maxCaptures || 4) && defenderOwnedAtStart - captured > 1;
      const lowDefense = (tile.defenseEnergy || 0) < 12 && !tile.isCore;
      if (canCaptureMore && lowDefense && progress >= cost * 0.82) {
        const previousOwner = tile.owner || defender.id;
        tile.owner = attacker.id;
        this.tileManager.transferBuilding(tile.id, attacker.id, previousOwner, "lilyBarrage", now, (event) => this.pushEvent(event));
        tile.captureProgress = {};
        tile.defenseEnergy = Math.min(14, Math.max(3, pressure * 0.08));
        tile.lastChanged = now;
        attacker.stats.tilesCaptured += 1;
        captured += 1;
        capturedTiles.push(tile.id);
      } else {
        weakened += 1;
        weakenedTiles.push(tile.id);
      }
    });

    game.economy.recalculate(game.players, now, game);
    this.pushEvent({
      kind: "specialImpact",
      specialType: "lilyBarrage",
      specialId: strike.id,
      playerId: attacker.id,
      targetOwner: defender.id,
      to: center.id,
      radius: strike.radius,
      captured,
      weakened,
      reduced,
      capturedTiles,
      weakenedTiles: weakenedTiles.slice(0, 12),
      at: now,
      message:
        captured > 0
          ? `Lily Barrage captured ${captured} tile${captured === 1 ? "" : "s"} and weakened ${weakened}.`
          : reduced > 0
            ? "Lily Barrage reduced by defenses."
            : "Lily Barrage weakened the border.",
    });
  }

  tilesInRadius(center, radius) {
    const tiles = [];
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const tile = this.tileManager.getById(y * this.tileManager.cols + x);
        if (tile && Math.abs(tile.x - center.x) + Math.abs(tile.y - center.y) <= radius) tiles.push(tile);
      }
    }
    return tiles;
  }

  inRange(player, tile, range) {
    return this.tileManager.owned(player.id).some((owned) => this.distance(owned, tile) <= range);
  }

  isExposedCore(tile, defenderId) {
    return tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== defenderId);
  }

  distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  zoneCovers(zone, tile, ownerId = null) {
    if (!zone || !tile) return false;
    if (ownerId && zone.ownerId && zone.ownerId !== ownerId) return false;
    const center = this.tileManager.getById(zone.tileId);
    return Boolean(center && this.distance(center, tile) <= zone.radius);
  }

  strikeDamageMultiplier(defender, tile, now = Date.now() / 1000) {
    let multiplier = 1;
    this.zones.forEach((zone) => {
      if (zone.expiresAt <= now || !this.zoneCovers(zone, tile, defender.id)) return;
      if (zone.type === "dragonflyGuard") multiplier *= 1 - (specials.dragonflyGuard.damageReduction || 0.5);
      if (zone.type === "reedShield") multiplier *= specials.reedShield.strikeMultiplier || 0.82;
    });
    if (now < (defender.abilityActiveUntil || 0) && defender.animal === "turtle") multiplier *= specials.lilyBarrage.turtleShellMultiplier || 0.68;
    if ((tile.defenseEnergy || 0) > 12) multiplier *= specials.lilyBarrage.defendedMultiplier || 0.58;
    return Math.max(0.18, multiplier);
  }

  waveCostMultiplier(defender, tile, now = Date.now() / 1000) {
    if (!defender || !tile) return 1;
    let multiplier = 1;
    this.zones.forEach((zone) => {
      if (zone.expiresAt <= now || zone.type !== "reedShield" || !this.zoneCovers(zone, tile, defender.id)) return;
      multiplier *= specials.reedShield.waveCostMultiplier || 1.25;
    });
    return multiplier;
  }

  currentPushPowerMultiplier(defender, tile, now = Date.now() / 1000) {
    if (!defender || !tile) return 1;
    let multiplier = 1;
    this.zones.forEach((zone) => {
      if (zone.expiresAt <= now || zone.type !== "dragonflyGuard" || !this.zoneCovers(zone, tile, defender.id)) return;
      multiplier *= specials.dragonflyGuard.currentPushMultiplier || 0.62;
    });
    return multiplier;
  }

  specialStatus(player, now = Date.now() / 1000) {
    const cooldowns = player?.specialCooldowns || {};
    return Object.fromEntries(
      Object.entries(specials).map(([id, special]) => [
        id,
        {
          ready: Math.max(0, (cooldowns[id] || 0) - now) <= 0,
          cooldownLeft: Math.max(0, (cooldowns[id] || 0) - now),
          cooldown: special.cooldown || 0,
          cost: this.costFor({ matchSettings: {} }, player || {}, id),
        },
      ]),
    );
  }

  snapshot(now = Date.now() / 1000) {
    return {
      pending: this.pending.map((strike) => ({
        id: strike.id,
        type: strike.type,
        playerId: strike.playerId,
        targetOwner: strike.targetOwner,
        tileId: strike.targetTileId,
        radius: strike.radius,
        impactAt: strike.impactAt,
        remaining: Math.max(0, strike.impactAt - now),
      })),
      zones: this.zones.map((zone) => ({
        id: zone.id,
        type: zone.type,
        playerId: zone.playerId,
        ownerId: zone.ownerId,
        tileId: zone.tileId,
        radius: zone.radius,
        expiresAt: zone.expiresAt,
        remaining: Math.max(0, zone.expiresAt - now),
      })),
    };
  }
}

module.exports = SpecialManager;
