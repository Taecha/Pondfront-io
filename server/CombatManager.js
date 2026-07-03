const config = require("../shared/gameConfig");
const animals = require("../shared/animals");
const combatConfig = require("../shared/combatConfig");
const balance = config.BALANCE;

const ATTACK_COOLDOWN_SECONDS = combatConfig.attackCooldownSeconds;
const MAX_ACTIVE_ATTACKS_PER_PLAYER = combatConfig.maxActiveAttacksPerPlayer;
const WAVE_TICK_SECONDS = combatConfig.waveTickSeconds;
const WAVE_CAPTURE_LIMIT = combatConfig.waveCaptureLimit;
const COMBAT_FORMULA = combatConfig.formula;

class CombatManager {
  constructor(tileManager, pushEvent) {
    this.tileManager = tileManager;
    this.pushEvent = pushEvent;
    this.activeAttacks = [];
    this.nextAttackId = 1;
  }

  update(game) {
    const now = game.now();
    game.players.forEach((player) => this.expireAbilityFlags(game, player, now));
    if (!this.activeAttacks.length) return;
    this.activeAttacks = this.activeAttacks.filter((wave) => this.processWave(game, wave, now));
  }

  snapshot() {
    return this.activeAttacks.map((wave) => ({
      id: wave.id,
      attackerId: wave.attackerId,
      defenderId: wave.defenderId,
      remainingPower: Math.round(wave.remainingPower),
      frontierTiles: wave.frontierTiles.slice(0, 26),
      capturedTiles: wave.capturedTiles.slice(-34),
      sourceTile: wave.sourceTile,
      targetStartTile: wave.targetStartTile,
      ambushApplied: Boolean(wave.ambushApplied),
      createdAt: wave.createdAt,
      lastTick: wave.lastTick,
    }));
  }

  expandOrAttack(game, player, tileId, percent, sourceIds = []) {
    const target = this.tileManager.getById(tileId);
    if (!player || player.defeated) return { ok: false, message: "You are defeated." };
    if (!target) return { ok: false, resultType: "invalidTarget", message: "Invalid target." };
    if (config.TILE_TYPES[target.type].blocks) return { ok: false, resultType: "blockedTile", message: "Blocked by terrain." };
    if (target.owner === player.id) return this.defend(player, tileId, percent, game.now());

    const defender = game.getPlayer(target.owner);
    if (defender) return this.startWaveAttack(game, player, defender, target, percent, sourceIds);
    return this.expandNeutral(game, player, target, percent, sourceIds);
  }

  expandNeutral(game, player, target, percent, sourceIds = []) {
    const now = game.now();
    const reach = this.tileManager.reachInfo(player, target, sourceIds);
    if (!reach.reachable) return { ok: false, resultType: "tooFar", message: "Too far from border." };

    const cost = this.neutralCaptureCost(game, player, target, reach);
    const progress = target.captureProgress?.[player.id] || 0;
    const remaining = Math.max(0, cost - progress);
    const available = this.spendEnergy(player, percent);
    if (available < 1 || player.energy < 1) {
      return { ok: false, resultType: "notEnoughEnergy", message: "Not enough Animal Energy. Send a higher percent or wait for income." };
    }

    const spend = Math.min(available, remaining);
    player.energy -= spend;
    player.stats.energyUsed += spend;
    target.captureProgress = target.captureProgress || {};
    target.captureProgress[player.id] = Math.min(cost, progress + spend);
    const currentProgress = target.captureProgress[player.id];

    if (currentProgress >= cost) {
      target.owner = player.id;
      target.building = null;
      target.buildingLevel = 0;
      target.buildingActiveAt = 0;
      target.captureProgress = {};
      target.defenseEnergy = Math.min(14, Math.max(2, spend * 0.16));
      target.lastChanged = now;
      player.stats.tilesCaptured += 1;
      this.pushEvent({
        kind: "expand",
        resultType: "expanded",
        from: reach.source.id,
        to: target.id,
        amount: Math.round(spend),
        cost,
        progress: cost,
        playerId: player.id,
        at: now,
      });
      return {
        ok: true,
        resultType: "expanded",
        captured: true,
        spentEnergy: Math.round(spend),
        unusedEnergy: Math.round(Math.max(0, available - spend)),
        cost,
        progress: cost,
        message: `Expanded: captured ${config.TILE_TYPES[target.type]?.label || "tile"} for ${Math.round(spend)} energy.`,
      };
    }

    target.lastChanged = now;
    this.pushEvent({
      kind: "expandProgress",
      resultType: "partial",
      from: reach.source.id,
      to: target.id,
      amount: Math.round(spend),
      cost,
      progress: Math.round(currentProgress),
      playerId: player.id,
      at: now,
    });

    return {
      ok: true,
      resultType: "partial",
      captured: false,
      spentEnergy: Math.round(spend),
      unusedEnergy: Math.round(Math.max(0, available - spend)),
      cost,
      progress: Math.round(currentProgress),
      remaining: Math.round(Math.max(0, cost - currentProgress)),
      message: `Expansion progress ${Math.round(currentProgress)}/${cost}. Send more energy to finish capture.`,
    };
  }

  startWaveAttack(game, player, defender, target, percent, sourceIds = []) {
    const now = game.now();
    const diplomacyCheck = game.diplomacy.canAttack(player.id, defender.id, now);
    if (!diplomacyCheck.ok) return { ok: false, resultType: "diplomacyBlocked", message: diplomacyCheck.reason };
    if (now < (player.attackCooldownUntil || 0)) return { ok: false, resultType: "cooldown", message: "Attack cooldown is active." };
    if (this.activeAttacks.filter((wave) => wave.attackerId === player.id).length >= MAX_ACTIVE_ATTACKS_PER_PLAYER) {
      return { ok: false, resultType: "tooManyWaves", message: "Frontline already moving." };
    }

    const reach = this.tileManager.borderReachInfo(player, target, sourceIds);
    if (!reach.reachable) return { ok: false, resultType: "tooFar", message: "Too far from border." };

    const spend = this.spendEnergy(player, percent);
    if (spend < 5) return { ok: false, resultType: "notEnoughEnergy", message: "Not enough Animal Energy. Attacks need at least 5 energy." };

    const exhaustion = Math.min(balance.maxWarExhaustion, player.flags?.warExhaustion || 0);
    const attackInfo = this.attackModifierInfo(game, player, target, reach.source, false);
    const attackPower = spend * balance.attackPowerMultiplier * (1 - exhaustion) * attackInfo.multiplier;
    player.energy -= spend;
    player.stats.energyUsed += spend;
    player.stats.attacksLaunched = (player.stats.attacksLaunched || 0) + 1;
    player.flags.warExhaustion = Math.min(balance.maxWarExhaustion, (player.flags.warExhaustion || 0) + balance.warExhaustionPerAttack);
    player.attackCooldownUntil = now + ATTACK_COOLDOWN_SECONDS;

    const wave = {
      id: `wave-${this.nextAttackId}`,
      attackerId: player.id,
      defenderId: defender.id,
      remainingPower: Math.max(0, attackPower),
      frontierTiles: [target.id],
      capturedTiles: [],
      distanceByTile: { [target.id]: 0 },
      fromByTile: { [target.id]: reach.source.id },
      sourceTile: reach.source.id,
      targetStartTile: target.id,
      spentEnergy: spend,
      ambushApplied: attackInfo.ambushApplied,
      createdAt: now,
      lastTick: now - WAVE_TICK_SECONDS,
      tickRate: WAVE_TICK_SECONDS,
    };
    this.nextAttackId += 1;
    this.activeAttacks.push(wave);
    game.recordWar?.(player.id, defender.id, { attack: true, damage: spend, energySpent: spend });

    this.pushEvent({
      kind: "attackWave",
      waveId: wave.id,
      from: reach.source.id,
      to: target.id,
      amount: Math.round(spend),
      playerId: player.id,
      targetOwner: defender.id,
      abilityModifier: attackInfo.ambushApplied ? "Ambush" : null,
      at: now,
    });

    if (attackInfo.ambushApplied) {
      this.pushEvent({
        kind: "abilityUsed",
        playerId: player.id,
        skillType: player.animal,
        ability: animals[player.animal].ability,
        from: reach.source.id,
        to: target.id,
        at: now,
      });
    }

    return {
      ok: true,
      message: attackInfo.ambushApplied
        ? `Ambush wave launched with ${Math.round(spend)} energy.`
        : `Frontline wave launched with ${Math.round(spend)} energy.`,
      spentEnergy: Math.round(spend),
      attackPower: Math.round(attackPower),
      gameplayChanges: attackInfo.ambushApplied ? ["Ambush applied: +40% attack power", "Ambush applied: enemy border costs -20%"] : [],
      activeEffect: attackInfo.ambushApplied ? null : this.abilityStatus(player, now).activeEffect,
    };
  }

  processWave(game, wave, now) {
    if (now - wave.lastTick < wave.tickRate) return true;

    const attacker = game.getPlayer(wave.attackerId);
    const defender = game.getPlayer(wave.defenderId);
    if (!attacker || !defender || attacker.defeated || defender.defeated) return false;
    const diplomacyCheck = game.diplomacy.canAttack(wave.attackerId, wave.defenderId, now);
    if (!diplomacyCheck.ok) {
      this.finishWave(game, wave, diplomacyCheck.reason);
      return false;
    }

    const candidates = this.waveCandidates(game, wave, attacker, defender);
    if (!candidates.length) {
      this.finishWave(game, wave, "No connected enemy tiles.");
      return false;
    }

    let captured = 0;
    const nextFrontier = new Set(wave.frontierTiles);
    for (const candidate of candidates) {
      if (captured >= WAVE_CAPTURE_LIMIT) break;
      if (candidate.tile.owner !== defender.id) continue;

      const cost = this.waveCaptureCost(game, wave, attacker, defender, candidate);
      if (cost > wave.remainingPower) {
        if (captured === 0) this.resistWave(game, wave, candidate, cost);
        break;
      }

      this.captureWaveTile(game, wave, attacker, defender, candidate, cost, now);
      nextFrontier.add(candidate.tile.id);
      captured += 1;
    }

    wave.lastTick = now;
    wave.frontierTiles = this.trimWaveFrontier(wave, nextFrontier, defender.id);

    if (captured === 0) return false;
    if (wave.remainingPower < this.cheapestFrontierCost(game, wave, attacker, defender)) {
      this.finishWave(game, wave, "Attack energy ran out.");
      return false;
    }
    return true;
  }

  waveCandidates(game, wave, attacker, defender) {
    const seen = new Set();
    const candidates = [];

    wave.frontierTiles.forEach((tileId) => {
      const frontier = this.tileManager.getById(tileId);
      if (!frontier) return;

      if (frontier.owner === defender.id) {
        this.addWaveCandidate(game, wave, attacker, defender, candidates, seen, frontier, wave.fromByTile[tileId], wave.distanceByTile[tileId] || 0);
        return;
      }

      if (frontier.owner !== attacker.id) return;
      const nextDistance = (wave.distanceByTile[tileId] || 0) + 1;
      frontier.neighbors.forEach((neighbor) => {
        if (neighbor.owner !== defender.id || config.TILE_TYPES[neighbor.type].blocks) return;
        this.addWaveCandidate(game, wave, attacker, defender, candidates, seen, neighbor, frontier.id, nextDistance);
      });
    });

    return candidates.sort((a, b) => {
      if (b.attackerEdges !== a.attackerEdges) return b.attackerEdges - a.attackerEdges;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.roughCost - b.roughCost;
    });
  }

  addWaveCandidate(game, wave, attacker, defender, candidates, seen, tile, from, distance) {
    if (!tile || seen.has(tile.id)) return;
    seen.add(tile.id);
    const attackerEdges = tile.neighbors.filter((neighbor) => neighbor.owner === attacker.id).length;
    candidates.push({
      tile,
      from,
      distance,
      attackerEdges,
      roughCost: this.waveCaptureCost(game, wave, attacker, defender, { tile, from, distance, attackerEdges }, true),
    });
  }

  captureWaveTile(game, wave, attacker, defender, candidate, cost, now) {
    const tile = candidate.tile;
    wave.remainingPower = Math.max(0, wave.remainingPower - cost);
    defender.energy = Math.max(0, defender.energy - Math.min(defender.energy, cost * 0.14 + 1.5));

    tile.owner = attacker.id;
    tile.building = null;
    tile.buildingLevel = 0;
    tile.buildingActiveAt = 0;
    tile.captureProgress = {};
    tile.defenseEnergy = Math.min(24, Math.max(2, wave.remainingPower * 0.025));
    tile.lastChanged = now;

    attacker.stats.tilesCaptured += 1;
    attacker.stats.damageDealt = (attacker.stats.damageDealt || 0) + cost;
    attacker.stats.bestAttackWave = Math.max(attacker.stats.bestAttackWave || 0, wave.capturedTiles.length + 1);
    wave.capturedTiles.push(tile.id);
    wave.distanceByTile[tile.id] = candidate.distance;
    wave.fromByTile[tile.id] = candidate.from;

    if (!this.tileManager.owned(defender.id).length && !defender.defeated) {
      defender.defeated = true;
      attacker.stats.playersDefeated += 1;
    }

    this.pushEvent({
      kind: "waveCapture",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      amount: Math.round(cost),
      remaining: Math.round(wave.remainingPower),
      playerId: attacker.id,
      targetOwner: defender.id,
      at: now,
    });
    game.recordWar?.(attacker.id, defender.id, { tilesCaptured: 1, damage: cost, biggestWave: wave.capturedTiles.length });
  }

  resistWave(game, wave, candidate, cost) {
    const tile = candidate.tile;
    const now = game.now();
    tile.defenseEnergy = Math.min(90, tile.defenseEnergy + Math.max(1, wave.remainingPower * 0.15));
    this.pushEvent({
      kind: "waveResist",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      amount: Math.round(cost - wave.remainingPower),
      playerId: wave.attackerId,
      targetOwner: wave.defenderId,
      at: now,
    });
    this.finishWave(game, wave, "Attack blocked: reinforced border too strong. Send more energy or choose a weaker border.");
  }

  finishWave(game, wave, reason) {
    this.pushEvent({
      kind: "waveEnd",
      waveId: wave.id,
      playerId: wave.attackerId,
      targetOwner: wave.defenderId,
      captured: wave.capturedTiles.length,
      remaining: Math.round(wave.remainingPower),
      message: reason,
      at: game.now(),
    });
  }

  trimWaveFrontier(wave, ids, defenderId) {
    const frontier = [];
    ids.forEach((id) => {
      const tile = this.tileManager.getById(id);
      if (!tile || tile.owner !== wave.attackerId) return;
      if (tile.neighbors.some((neighbor) => neighbor.owner === defenderId)) frontier.push(id);
    });
    return frontier.slice(-80);
  }

  cheapestFrontierCost(game, wave, attacker, defender) {
    const candidates = this.waveCandidates(game, wave, attacker, defender);
    if (!candidates.length) return Infinity;
    return Math.min(...candidates.slice(0, 8).map((candidate) => this.waveCaptureCost(game, wave, attacker, defender, candidate)));
  }

  waveCaptureCost(game, wave, attacker, defender, candidate, rough = false) {
    const tile = candidate.tile;
    const type = config.TILE_TYPES[tile.type];
    if (!type || type.blocks) return Infinity;

    let cost = tile.building ? COMBAT_FORMULA.buildingBaseCost : COMBAT_FORMULA.baseCostByTile[tile.type] || 10;
    cost *= balance.attackCostMultiplier;
    cost += type.defenseBonus * COMBAT_FORMULA.terrainDefenseMultiplier;
    cost += tile.defenseEnergy * COMBAT_FORMULA.defenseEnergyMultiplier;
    cost += Math.max(0, candidate.distance || 0) * COMBAT_FORMULA.distanceCost;
    cost += Math.max(0, 2 - (candidate.attackerEdges || 0)) * COMBAT_FORMULA.weakBorderPenalty;

    if (defender) {
      const energyRatio = defender.energy / Math.max(1, defender.maxEnergy);
      cost += Math.min(COMBAT_FORMULA.defenderEnergyFlatCap, defender.energy * COMBAT_FORMULA.defenderEnergyFlatMultiplier);
      cost *= COMBAT_FORMULA.defenderEnergyRatioBase + energyRatio * COMBAT_FORMULA.defenderEnergyRatioMultiplier;
      if (defender.territory > attacker.territory * 1.35 && energyRatio < 0.35) cost *= COMBAT_FORMULA.bigDefenderWeakEnergyMultiplier;
      if (defender.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) cost *= 1.2;
      if (tile.type === "water" && defender.animal === "frog") cost *= 0.95;
      if (defender.animal === "turtle") {
        cost *= balance.turtleBorderDefenseMultiplier || 1.25;
        cost += this.turtleTerrainDefense(tile);
        if (game.now() < (defender.abilityActiveUntil || 0)) {
          cost *= balance.shellGuardCaptureCostMultiplier || 1.35;
          if ((tile.defenseEnergy || 0) > 4) cost *= balance.shellGuardDefendedExtraMultiplier || 1.2;
        }
      }
      if (defender.animal === "carp") cost *= balance.carpDefenseMultiplier || 0.92;
      cost += this.reedGuardBonus(defender.id, tile, defender);
      cost += defender.flags?.objectiveDefenseBonus || 0;
      if (game.now() < (defender.flags?.campDefenseUntil || 0)) cost += balance.campDefenseBonus || 4;
      if (defender.flags?.lastNestProtection && this.nearCore(defender, tile)) cost += balance.lastNestProtectionDefense || 18;
    }

    if (attacker.animal === "duck" && tile.type === "water") cost *= 0.86;
    if (attacker.animal === "duck" && tile.type === "water" && game.now() < attacker.abilityActiveUntil) cost *= balance.flockRushOpenWaterCostMultiplier || 0.65;
    if (attacker.animal === "duck" && tile.type === "water" && (attacker.level || 1) >= 5) cost *= balance.level5DuckWaterCostMultiplier || 0.9;
    if (attacker.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) cost *= 0.86;
    if (attacker.animal === "snake" && (tile.type === "reeds" || tile.type === "mud") && (attacker.level || 1) >= 5) cost *= 1 / (balance.level5SnakeReedAttackMultiplier || 1.12);
    if (wave.ambushApplied) cost *= balance.snakeAmbushDefenseCostMultiplier || 0.8;
    if (attacker.animal === "frog" && tile.type === "lily") cost *= 0.92;
    if (attacker.animal === "carp" && game.now() < (attacker.abilityActiveUntil || 0) && tile.type === "water") cost *= balance.goldenCurrentWaterCostMultiplier || 0.8;
    if (attacker.animal === "carp" && game.now() < (attacker.abilityActiveUntil || 0) && tile.type === "lily") cost *= balance.goldenCurrentLilyCostMultiplier || 0.7;
    if (game.eventsManager?.isActive("mudslide") && tile.type === "mud") cost *= balance.mudslideDefenseMultiplier || 1.22;
    cost += game.objectives?.tileCostBonus(tile) || 0;
    if (!rough && wave.remainingPower / Math.max(1, wave.spentEnergy) < 0.18) cost *= COMBAT_FORMULA.lowPowerFatigueMultiplier;

    return Math.max(4, cost);
  }

  defend(player, tileId, percent, now = Date.now() / 1000) {
    const tile = this.tileManager.getById(tileId);
    if (!tile || tile.owner !== player.id) return { ok: false, message: "Choose your territory to defend." };
    const spend = this.spendEnergy(player, percent) * balance.defendSpendMultiplier;
    if (spend < 3) return { ok: false, message: "Not enough Animal Energy. Defending needs at least 3 energy." };
    player.energy -= spend;
    player.stats.energyUsed += spend;
    player.stats.defenses = (player.stats.defenses || 0) + 1;
    const animalBoost = player.animal === "turtle" ? balance.turtleDefendMultiplier || 1.16 : 1;
    const shellBoost = player.animal === "turtle" && now < (player.abilityActiveUntil || 0) ? 1.18 : 1;
    tile.defenseEnergy = Math.min(90, tile.defenseEnergy + spend * balance.defendEnergyMultiplier * animalBoost * shellBoost);
    tile.lastChanged = now;
    this.pushEvent({ kind: "defend", to: tile.id, amount: Math.round(spend), playerId: player.id, defense: Math.round(tile.defenseEnergy), at: now });
    return {
      ok: true,
      resultType: "reinforced",
      defenseEnergy: Math.round(tile.defenseEnergy),
      message: `Border reinforced: ${Math.round(tile.defenseEnergy)} stored defense energy. Enemy attacks now cost more.`,
    };
  }

  activateAbility(game, player, options = {}) {
    const now = game.now();
    const animal = animals[player.animal];
    const beforeEnergy = player.energy;
    const cooldownBefore = Math.max(0, (player.abilityReadyAt || 0) - now);
    if (!animal) return { ok: false, message: "No ability available." };
    if (now < player.abilityReadyAt) {
      const result = {
        ok: false,
        message: `Ability cooling down for ${Math.ceil(player.abilityReadyAt - now)}s.`,
        cooldown: Math.ceil(player.abilityReadyAt - now),
        activeEffect: this.abilityStatus(player, now).activeEffect,
      };
      this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
      return result;
    }

    if (player.animal === "duck") {
      const duration = animal.duration + ((player.level || 1) >= 3 ? balance.level3DuckDurationBonus || 4 : 0);
      player.abilityActiveUntil = now + duration;
      player.abilityReadyAt = now + this.abilityCooldown(player, animal);
      player.stats.abilitiesUsed = (player.stats.abilitiesUsed || 0) + 1;
      const result = {
        ok: true,
        message: `Flock Rush active: open-water expansion costs 35% less for ${duration}s.`,
        cooldown: this.abilityCooldown(player, animal),
        activeEffect: "Flock Rush",
        duration,
        effectApplied: true,
        gameplayChanges: ["Open-water neutral expansion cost x0.65", "Small temporary income boost"],
        affectedTiles: [],
      };
      this.pushEvent({
        kind: "ability",
        playerId: player.id,
        skillType: player.animal,
        ability: animal.ability,
        activeEffect: result.activeEffect,
        gameplayChanges: result.gameplayChanges,
        at: now,
      });
      this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
      return result;
    }

    if (player.animal === "snake") {
      player.flags.ambushReady = true;
      player.abilityActiveUntil = now + animal.duration;
      player.abilityReadyAt = now + this.abilityCooldown(player, animal);
      player.stats.abilitiesUsed = (player.stats.abilitiesUsed || 0) + 1;
      const result = {
        ok: true,
        message: "Ambush ready: next attack from reeds or mud gets +40% attack power.",
        cooldown: this.abilityCooldown(player, animal),
        activeEffect: "Ambush Ready",
        duration: animal.duration,
        effectApplied: true,
        gameplayChanges: ["Next reed/mud attack power x1.40", "That attack wave reduces enemy border costs x0.80"],
        affectedTiles: [],
      };
      this.pushEvent({
        kind: "ability",
        playerId: player.id,
        skillType: player.animal,
        ability: animal.ability,
        activeEffect: result.activeEffect,
        gameplayChanges: result.gameplayChanges,
        at: now,
      });
      this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
      return result;
    }

    if (player.animal === "turtle") {
      player.abilityActiveUntil = now + animal.duration;
      player.abilityReadyAt = now + this.abilityCooldown(player, animal);
      player.stats.abilitiesUsed = (player.stats.abilitiesUsed || 0) + 1;
      const affectedTiles = this.tileManager
        .borders(player.id)
        .filter((tile) => tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== player.id))
        .slice(0, 36)
        .map((tile) => tile.id);
      const result = {
        ok: true,
        message: `Shell Guard active: enemy waves cost more against Turtle borders for ${animal.duration}s.`,
        cooldown: this.abilityCooldown(player, animal),
        activeEffect: "Shell Guard",
        duration: animal.duration,
        effectApplied: true,
        gameplayChanges: ["Enemy capture cost x1.35 against Turtle borders", "Defended Turtle tiles gain extra resistance"],
        affectedTiles,
      };
      this.pushEvent({
        kind: "ability",
        playerId: player.id,
        skillType: player.animal,
        ability: animal.ability,
        activeEffect: result.activeEffect,
        gameplayChanges: result.gameplayChanges,
        affectedTiles,
        at: now,
      });
      this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
      return result;
    }

    if (player.animal === "carp") {
      player.abilityActiveUntil = now + animal.duration;
      player.abilityReadyAt = now + this.abilityCooldown(player, animal);
      player.stats.abilitiesUsed = (player.stats.abilitiesUsed || 0) + 1;
      const affectedTiles = this.tileManager
        .owned(player.id)
        .filter((tile) => tile.type === "water" || tile.type === "lily")
        .slice(0, 42)
        .map((tile) => tile.id);
      const result = {
        ok: true,
        message: `Golden Current active: income and water/lily expansion improve for ${animal.duration}s.`,
        cooldown: this.abilityCooldown(player, animal),
        activeEffect: "Golden Current",
        duration: animal.duration,
        effectApplied: true,
        gameplayChanges: ["Income +30%", "Open-water expansion cost x0.80", "Lily expansion cost x0.70"],
        affectedTiles,
      };
      this.pushEvent({
        kind: "ability",
        playerId: player.id,
        skillType: player.animal,
        ability: animal.ability,
        activeEffect: result.activeEffect,
        gameplayChanges: result.gameplayChanges,
        affectedTiles,
        at: now,
      });
      this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
      return result;
    }

    if (player.animal === "frog") {
      const leap = this.bigLeap(game, player, options.targetTileId);
      if (leap.captured <= 0) {
        const result = {
          ok: false,
          message: options.targetTileId != null ? "No valid neutral leap target there." : "No nearby neutral leap cluster.",
          cooldown: 0,
          activeEffect: null,
          effectApplied: false,
          gameplayChanges: [],
          affectedTiles: [],
        };
        this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
        return result;
      }
      player.abilityReadyAt = now + this.abilityCooldown(player, animal);
      player.stats.abilitiesUsed = (player.stats.abilitiesUsed || 0) + 1;
      const result = {
        ok: true,
        message: `Big Leap captured ${leap.captured} neutral tiles.`,
        cooldown: this.abilityCooldown(player, animal),
        activeEffect: null,
        duration: 0,
        effectApplied: true,
        gameplayChanges: [`Captured ${leap.captured} neutral leap tiles`, "Can cross one small blocked gap within range"],
        affectedTiles: leap.affectedTiles,
      };
      this.pushEvent({
        kind: "ability",
        playerId: player.id,
        skillType: player.animal,
        ability: animal.ability,
        activeEffect: result.activeEffect,
        gameplayChanges: result.gameplayChanges,
        affectedTiles: result.affectedTiles,
        at: now,
      });
      this.debugAbility(game, player, animal.ability, beforeEnergy, cooldownBefore, result, options);
      return result;
    }

    return { ok: false, message: "No ability available." };
  }

  bigLeap(game, player, targetTileId = null) {
    const options = [];
    const targetTile = targetTileId != null ? this.tileManager.getById(Number(targetTileId)) : null;
    this.tileManager.borders(player.id).forEach((source) => {
      const range = player.flags.jumpPad ? balance.frogBigLeapJumpPadRange || 3 : balance.frogBigLeapRange || 2;
      for (let y = source.y - range; y <= source.y + range; y += 1) {
        for (let x = source.x - range; x <= source.x + range; x += 1) {
          const tile = this.tileManager.get(x, y);
          if (!tile || tile.owner || config.TILE_TYPES[tile.type].blocks) continue;
          const d = Math.abs(source.x - x) + Math.abs(source.y - y);
          if (d < 2 || d > range) continue;
          if (targetTile && tile.id !== targetTile.id && Math.abs(tile.x - targetTile.x) + Math.abs(tile.y - targetTile.y) > 1) continue;
          options.push({ tile, score: this.leapScore(tile, targetTile) });
        }
      }
    });

    const clusterSize = (balance.frogBigLeapClusterSize || 5) + ((player.level || 1) >= 3 ? balance.level3FrogLeapBonus || 2 : 0);
    const unique = [...new Map(options.map((entry) => [entry.tile.id, entry])).values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, clusterSize)
      .map((entry) => entry.tile);
    unique.forEach((tile) => {
      tile.owner = player.id;
      tile.captureProgress = {};
      tile.buildingActiveAt = 0;
      tile.lastChanged = game.now();
      tile.defenseEnergy = 2;
      player.stats.tilesCaptured += 1;
      this.pushEvent({ kind: "expand", to: tile.id, amount: 0, playerId: player.id, at: game.now() });
    });
    return { captured: unique.length, affectedTiles: unique.map((tile) => tile.id) };
  }

  leapScore(tile, targetTile) {
    const typeScore = tile.type === "lily" ? 8 : tile.type === "nest" ? 7 : tile.type === "mud" ? 4 : tile.type === "reeds" ? 3 : 2;
    const targetBonus = targetTile ? Math.max(0, 5 - Math.abs(tile.x - targetTile.x) - Math.abs(tile.y - targetTile.y)) : 0;
    return typeScore + targetBonus + Math.random() * 0.1;
  }

  spendEnergy(player, percent) {
    const clean = Math.max(0.01, Math.min(1, Number(percent) || 0.25));
    return Math.min(player.energy, Math.max(0, player.energy * clean));
  }

  captureCost(game, attacker, defender, target, reach) {
    const type = config.TILE_TYPES[target.type];
    let cost = (target.building ? COMBAT_FORMULA.buildingBaseCost : COMBAT_FORMULA.baseCostByTile[target.type] || type.captureCost) * balance.attackCostMultiplier;
    cost += type.defenseBonus * COMBAT_FORMULA.terrainDefenseMultiplier;
    cost += target.defenseEnergy * COMBAT_FORMULA.defenseEnergyMultiplier;
    if (defender) {
      const energyRatio = defender.energy / Math.max(1, defender.maxEnergy);
      cost += Math.min(COMBAT_FORMULA.defenderEnergyFlatCap, defender.energy * COMBAT_FORMULA.defenderEnergyFlatMultiplier);
      cost *= COMBAT_FORMULA.defenderEnergyRatioBase + energyRatio * COMBAT_FORMULA.defenderEnergyRatioMultiplier;
      if (defender.animal === "snake" && (target.type === "reeds" || target.type === "mud")) cost *= 1.22;
      if (target.type === "water" && defender.animal === "frog") cost *= 0.94;
      if (defender.animal === "turtle") {
        cost *= balance.turtleBorderDefenseMultiplier || 1.25;
        cost += this.turtleTerrainDefense(target);
        if (game.now() < (defender.abilityActiveUntil || 0)) cost *= balance.shellGuardCaptureCostMultiplier || 1.35;
      }
      if (defender.animal === "carp") cost *= balance.carpDefenseMultiplier || 0.92;
      cost += this.reedGuardBonus(defender.id, target, defender);
    }
    if (reach.jumped) cost *= 1.08;
    if (attacker.animal === "duck" && target.type === "water" && game.now() < attacker.abilityActiveUntil) cost *= balance.flockRushOpenWaterCostMultiplier || 0.65;
    if (attacker.animal === "duck" && target.type === "water") cost *= 0.78;
    if (attacker.animal === "snake" && target.type === "water") cost *= 1.18;
    if (attacker.animal === "snake" && (target.type === "reeds" || target.type === "mud")) cost *= 0.84;
    if (attacker.animal === "carp" && game.now() < (attacker.abilityActiveUntil || 0) && target.type === "water") cost *= balance.goldenCurrentWaterCostMultiplier || 0.8;
    if (attacker.animal === "carp" && game.now() < (attacker.abilityActiveUntil || 0) && target.type === "lily") cost *= balance.goldenCurrentLilyCostMultiplier || 0.7;
    return Math.max(6, cost);
  }

  neutralCaptureCost(game, player, target, reach = {}) {
    const core = player.coreTileId != null ? this.tileManager.getById(player.coreTileId) : null;
    const distanceFromCore = core ? Math.abs(core.x - target.x) + Math.abs(core.y - target.y) : 0;
    const nearbyEnemyBorders = target.neighbors.filter((neighbor) => neighbor.owner && neighbor.owner !== player.id).length;
    return config.getNeutralTileExpansionCost(target.type, player.animal, {
      jumped: Boolean(reach.jumped),
      flockRush: player.animal === "duck" && game.now() < player.abilityActiveUntil,
      goldenCurrent: player.animal === "carp" && game.now() < player.abilityActiveUntil,
      mudTunnel: Boolean(player.flags?.mudTunnel),
      jumpPad: Boolean(player.flags?.jumpPad),
      territory: player.territory,
      distanceFromCore,
      nearbyEnemyBorders,
      specialCostBonus: game.objectives?.tileCostBonus(target) || 0,
      rainstorm: game.eventsManager?.isActive("rainstorm"),
      evolved: (player.level || 1) >= 5,
      comebackCore: this.nearCore(player, target) && this.territoryPct(game, player) < (balance.recoveryTerritoryPct || 0.06),
    });
  }

  attackModifierInfo(game, player, target, source, jumped) {
    let multiplier = 1;
    let ambushApplied = false;
    if (player.energy / Math.max(1, player.maxEnergy) < 0.18) multiplier *= 0.72;
    if (player.animal === "snake" && source && (source.type === "reeds" || source.type === "mud")) multiplier *= 1.18;
    if (player.animal === "snake" && source && (source.type === "reeds" || source.type === "mud") && (player.level || 1) >= 5) {
      multiplier *= balance.level5SnakeReedAttackMultiplier || 1.12;
    }
    if (game.now() < (player.flags?.campAttackUntil || 0)) multiplier *= balance.campAttackMultiplier || 1.12;
    if (this.canApplyAmbush(game, player, source)) {
      multiplier *= balance.snakeAmbushAttackPowerMultiplier || 1.4;
      ambushApplied = true;
      player.flags.ambushReady = false;
      player.flags.ambushConsumedAt = game.now();
      player.abilityActiveUntil = Math.min(player.abilityActiveUntil || game.now(), game.now());
    }
    if (player.animal === "frog" && target.type === "lily") multiplier *= 1.08;
    if (player.animal === "turtle") multiplier *= balance.turtleAttackPowerMultiplier || 0.94;
    if (player.animal === "carp" && game.now() < (player.abilityActiveUntil || 0) && (target.type === "water" || target.type === "lily")) multiplier *= 1.04;
    if (jumped) multiplier *= 0.94;
    return { multiplier, ambushApplied };
  }

  abilityCooldown(player, animal) {
    let cooldown = animal.cooldown;
    if (player.animal === "snake" && (player.level || 1) >= 3) cooldown *= balance.level3SnakeCooldownMultiplier || 0.82;
    cooldown *= 1 - Math.min(0.35, player.flags?.abilityCooldownReduction || 0);
    return Math.max(8, Math.round(cooldown));
  }

  nearCore(player, tile) {
    const core = player.coreTileId != null ? this.tileManager.getById(player.coreTileId) : null;
    if (!core || !tile) return false;
    return Math.abs(core.x - tile.x) + Math.abs(core.y - tile.y) <= 3;
  }

  territoryPct(game, player) {
    const playable = this.tileManager.playable().length || 1;
    return (player.territory || 0) / playable;
  }

  canApplyAmbush(game, player, source) {
    return Boolean(
      player.animal === "snake" &&
        player.flags?.ambushReady &&
        game.now() < (player.abilityActiveUntil || 0) &&
        source &&
        (source.type === "reeds" || source.type === "mud"),
    );
  }

  expireAbilityFlags(game, player, now = game.now()) {
    if (player?.animal === "snake" && player.flags?.ambushReady && now >= (player.abilityActiveUntil || 0)) {
      player.flags.ambushReady = false;
      player.flags.ambushExpiredAt = now;
    }
  }

  abilityStatus(player, now = Date.now() / 1000) {
    const animal = animals[player?.animal];
    if (!player || !animal) return { abilityName: "", ready: false, cooldownLeft: 0, activeLeft: 0, activeEffect: null, realModifier: "" };
    const cooldownLeft = Math.max(0, (player.abilityReadyAt || 0) - now);
    const activeLeft = Math.max(0, (player.abilityActiveUntil || 0) - now);
    const cooldown = this.abilityCooldown(player, animal);
    if (player.animal === "duck") {
      return {
        abilityName: animal.ability,
        ready: cooldownLeft <= 0,
        cooldownLeft,
        cooldown,
        activeLeft,
        activeEffect: activeLeft > 0 ? "Flock Rush Active" : null,
        realModifier: (player.level || 1) >= 3 ? "Open-water expansion cost x0.65 for 14s." : "Open-water expansion cost x0.65 for 10s.",
        targetNeeded: false,
      };
    }
    if (player.animal === "snake") {
      const ambushReady = Boolean(player.flags?.ambushReady && activeLeft > 0);
      return {
        abilityName: animal.ability,
        ready: cooldownLeft <= 0,
        cooldownLeft,
        cooldown,
        activeLeft,
        activeEffect: ambushReady ? "Ambush Ready" : null,
        realModifier:
          (player.level || 1) >= 5
            ? "Next reeds/mud attack gets x1.40 power; Marsh Serpent adds stronger reed pressure."
            : "Next reeds/mud attack gets x1.40 power and enemy border cost x0.80.",
        targetNeeded: false,
      };
    }
    if (player.animal === "frog") {
      return {
        abilityName: animal.ability,
        ready: cooldownLeft <= 0,
        cooldownLeft,
        cooldown,
        activeLeft: 0,
        activeEffect: null,
        realModifier: (player.level || 1) >= 3 ? "Captures up to 7 nearby neutral leap tiles; never enemy tiles." : "Captures up to 5 nearby neutral leap tiles; never enemy tiles.",
        targetNeeded: true,
      };
    }
    if (player.animal === "turtle") {
      return {
        abilityName: animal.ability,
        ready: cooldownLeft <= 0,
        cooldownLeft,
        cooldown,
        activeLeft,
        activeEffect: activeLeft > 0 ? "Shell Guard Active" : null,
        realModifier: "Enemy waves cost x1.35 against your borders; defended borders resist even harder.",
        targetNeeded: false,
      };
    }
    if (player.animal === "carp") {
      return {
        abilityName: animal.ability,
        ready: cooldownLeft <= 0,
        cooldownLeft,
        cooldown,
        activeLeft,
        activeEffect: activeLeft > 0 ? "Golden Current Active" : null,
        realModifier: "Income +30%; open-water expansion x0.80 and lily expansion x0.70.",
        targetNeeded: false,
      };
    }
    return {
      abilityName: animal.ability,
      ready: cooldownLeft <= 0,
      cooldownLeft,
      cooldown,
      activeLeft: 0,
      activeEffect: null,
      realModifier: animal.perk || "",
      targetNeeded: false,
    };
  }

  debugAbility(game, player, abilityName, beforeEnergy, cooldownBefore, result, options = {}) {
    if (process.env.NODE_ENV !== "development") return;
    const status = this.abilityStatus(player, game.now());
    console.log(
      `[ABILITY] ${player.name} (${player.id}) ${player.animal} used ${abilityName}`,
      JSON.stringify(
        {
          beforeEnergy: Math.round(beforeEnergy),
          afterEnergy: Math.round(player.energy),
          cooldownBefore: Math.round(cooldownBefore),
          cooldownAfter: Math.round(status.cooldownLeft),
          targetTile: options.targetTileId ?? null,
          effectApplied: Boolean(result.effectApplied),
          gameplayChange: result.gameplayChanges || [],
          affectedTiles: result.affectedTiles || [],
          result: result.message,
        },
        null,
        2,
      ),
    );
  }

  turtleTerrainDefense(tile) {
    if (!tile) return 0;
    const nearRock = tile.neighbors?.some((neighbor) => config.TILE_TYPES[neighbor.type]?.blocks) || false;
    const terrainBonus = tile.type === "mud" || nearRock ? balance.turtleMudRockAdjDefense || 3 : 0;
    return terrainBonus;
  }

  reedGuardBonus(ownerId, target, owner = null) {
    const animalBoost = owner?.animal === "turtle" ? balance.turtleReedGuardMultiplier || 1.28 : 1;
    return [target, ...target.neighbors].reduce((sum, tile) => {
      if (tile.owner === ownerId && tile.building === "reedGuard") return sum + 7 * Math.max(1, Number(tile.buildingLevel) || 1) * animalBoost;
      return sum;
    }, 0);
  }
}

module.exports = CombatManager;
