const config = require("../shared/gameConfig");
const animals = require("../shared/animals");
const combatConfig = require("../shared/combatConfig");
const balance = config.BALANCE;

const MAX_ACTIVE_ATTACKS_PER_PLAYER = combatConfig.maxActiveAttacksPerPlayer;
const MIN_ATTACK_ENERGY = combatConfig.minimumAttackEnergy || 5;
const WAVE_TICK_SECONDS = combatConfig.waveTickSeconds;
const WAVE_CAPTURE_LIMIT = combatConfig.waveCaptureLimit;
const COMBAT_FORMULA = combatConfig.formula;
const CURRENT_PUSH = combatConfig.currentPush || {};
const PRESSURE = combatConfig.pressure || {};
const ATTACK_EFFICIENCY = combatConfig.attackEfficiency || 0.86;
const WAVE_MAX_DURATION_SECONDS = combatConfig.waveMaxDurationSeconds || 12;
const CONTEST_POWER_LOSS_RATIO = combatConfig.contestPowerLossRatio || 0.18;
const CONTEST_WINNER_LOSS_RATIO = combatConfig.contestWinnerLossRatio || 0.45;
const EXPANSION_TICK_SECONDS = balance.expansionWaveTickSeconds || 0.42;
const EXPANSION_CAPTURE_LIMIT = balance.expansionWaveCaptureLimit || 3;
const EXPANSION_MAX_DURATION_SECONDS = balance.expansionWaveMaxDurationSeconds || 14;
const MAX_ACTIVE_EXPANSIONS_PER_PLAYER = balance.maxActiveExpansionsPerPlayer || 2;

class CombatManager {
  constructor(tileManager, pushEvent) {
    this.tileManager = tileManager;
    this.pushEvent = pushEvent;
    this.activeAttacks = [];
    this.activeExpansions = [];
    this.continuousAttacks = [];
    this.currentPushes = [];
    this.nextAttackId = 1;
    this.nextExpansionId = 1;
    this.nextContinuousId = 1;
    this.nextCurrentPushId = 1;
    this.lastCombatDecayAt = 0;
  }

  update(game) {
    const now = game.now();
    game.players.forEach((player) => this.expireAbilityFlags(game, player, now));
    this.decayCombatState(game, now);
    this.processExpansionWaves(game, now);
    this.processCurrentPushes(game, now);
    if (this.activeAttacks.length) this.activeAttacks = this.activeAttacks.filter((wave) => this.processWave(game, wave, now));
  }

  snapshot(now = Date.now() / 1000) {
    const waves = this.activeAttacks.map((wave) => ({
      id: wave.id,
      continuous: false,
      routeAttack: Boolean(wave.routeAttack),
      attackerId: wave.attackerId,
      defenderId: wave.defenderId,
      startTileId: wave.startTileId || wave.sourceTile,
      targetTileId: wave.targetTileId || wave.targetStartTile,
      sentEnergy: Math.round(wave.sentEnergy || wave.spentEnergy || 0),
      attackBudget: Math.round(wave.attackBudget || wave.remainingPower || 0),
      remainingBudget: Math.round(wave.remainingBudget ?? wave.remainingPower ?? 0),
      remainingPower: Math.round(wave.remainingPower),
      frontierTiles: wave.frontierTiles.slice(0, 26),
      capturedTiles: wave.capturedTiles.slice(-34),
      weakenedTiles: (wave.weakenedTiles || []).slice(-24),
      status: wave.status || "pushing",
      sourceTile: wave.sourceTile,
      targetStartTile: wave.targetStartTile,
      ambushApplied: Boolean(wave.ambushApplied),
      createdAt: wave.createdAt,
      lastTick: wave.lastTick,
    }));
    const orders = this.continuousAttacks.map((order) => ({
      id: order.id,
      continuous: true,
      attackerId: order.attackerId,
      defenderId: order.defenderId,
      remainingPower: Math.round(order.lastSpend || 0),
      frontierTiles: [order.targetTileId].filter((id) => id != null),
      capturedTiles: [],
      sourceTile: order.sourceTile,
      targetStartTile: order.targetTileId,
      drainPerSecond: Math.round(order.drainPerSecond || 0),
      estimatedCaptureSpeed: order.estimatedCaptureSpeed || "steady",
      createdAt: order.createdAt,
      lastTick: order.lastTick,
    }));
    const currents = this.currentPushes.map((push) => {
      const progress = Math.max(0, Math.min(1, (now - push.startTime) / Math.max(0.1, push.travelTime || 1)));
      return {
        id: push.id,
        currentPush: true,
        routeAttack: true,
        continuous: false,
        attackerId: push.attackerId,
        defenderId: push.defenderId,
        remainingPower: Math.round(push.remainingPower),
        sentEnergy: Math.round(push.sentEnergy),
        frontierTiles: [push.targetStartTile].filter((id) => id != null),
        capturedTiles: [],
        sourceTile: push.sourceTile,
        targetStartTile: push.targetStartTile,
        routeTiles: push.routeTiles.slice(0, 64),
        currentRouteIndex: push.currentRouteIndex || 0,
        positionTile: push.routeTiles[Math.min(push.routeTiles.length - 1, push.currentRouteIndex || 0)] || push.sourceTile,
        startTime: push.startTime,
        impactTime: push.impactTime,
        travelTime: push.travelTime,
        warningAt: push.warningAt,
        status: push.status,
        progress,
      };
    });
    return waves.concat(orders, currents);
  }

  expansionSnapshot() {
    return this.activeExpansions.map((wave) => ({
      id: wave.id,
      playerId: wave.playerId,
      startTileId: wave.startTileId,
      sourceTile: wave.sourceTile,
      targetStartTile: wave.startTileId,
      sentEnergy: Math.round(wave.sentEnergy || wave.expansionBudget || 0),
      expansionBudget: Math.round(wave.expansionBudget || 0),
      remainingBudget: Math.round(wave.remainingBudget || 0),
      frontierTiles: (wave.frontierTiles || []).slice(0, 34),
      capturedTiles: (wave.capturedTiles || []).slice(-42),
      weakenedTiles: (wave.weakenedTiles || []).slice(-24),
      status: wave.status || "expanding",
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

    const spend = this.spendEnergy(player, percent);
    if (spend < 1 || player.energy < 1) {
      return { ok: false, resultType: "notEnoughEnergy", message: "Not enough Animal Energy. Send a higher percent or wait for income." };
    }

    player.energy -= spend;
    player.stats.energyUsed += spend;

    const mergeWave = this.activeExpansionForTarget(player.id, target.id);
    const activeCount = this.activeExpansions.filter((wave) => wave.playerId === player.id && !wave.finished).length;
    if (!mergeWave && activeCount >= MAX_ACTIVE_EXPANSIONS_PER_PLAYER) {
      player.energy += spend;
      player.stats.energyUsed = Math.max(0, player.stats.energyUsed - spend);
      return {
        ok: false,
        resultType: "tooManyExpansions",
        message: `Too many active expansion waves (${activeCount}/${MAX_ACTIVE_EXPANSIONS_PER_PLAYER}). Wait for one to finish or send energy to the same front.`,
      };
    }

    const wave = mergeWave || {
      id: `expand-${this.nextExpansionId}`,
      playerId: player.id,
      startTileId: target.id,
      sourceTile: reach.source.id,
      sentEnergy: 0,
      expansionBudget: 0,
      remainingBudget: 0,
      frontierTiles: [target.id],
      capturedTiles: [],
      weakenedTiles: [],
      distanceByTile: { [target.id]: 0 },
      fromByTile: { [target.id]: reach.source.id },
      status: "expanding",
      createdAt: now,
      lastTick: now - EXPANSION_TICK_SECONDS,
      tickRate: EXPANSION_TICK_SECONDS,
      maxDuration: EXPANSION_MAX_DURATION_SECONDS,
    };
    if (!mergeWave) {
      this.nextExpansionId += 1;
      this.activeExpansions.push(wave);
    }
    if (!wave.frontierTiles.includes(target.id)) wave.frontierTiles.push(target.id);
    wave.distanceByTile[target.id] = Math.min(wave.distanceByTile[target.id] ?? Infinity, 0);
    wave.fromByTile[target.id] = reach.source.id;
    wave.sentEnergy += spend;
    wave.expansionBudget += spend;
    wave.remainingBudget += spend;
    wave.status = mergeWave ? "reinforced" : "expanding";

    this.pushEvent({
      kind: "expansionWaveStart",
      waveId: wave.id,
      merged: Boolean(mergeWave),
      from: reach.source.id,
      to: target.id,
      amount: Math.round(spend),
      sentEnergy: Math.round(spend),
      expansionBudget: Math.round(wave.expansionBudget),
      remainingBudget: Math.round(wave.remainingBudget),
      playerId: player.id,
      status: wave.status,
      at: now,
      message: `${mergeWave ? "Added" : "Committed"} ${Math.round(spend)} Animal Energy to expansion.`,
    });

    const beforeCaptures = wave.capturedTiles.length;
    const keepActive = this.processExpansionWave(game, wave, now, true);
    if (!keepActive) this.activeExpansions = this.activeExpansions.filter((entry) => entry !== wave);
    const capturedNow = wave.capturedTiles.length - beforeCaptures;
    const targetCost = this.neutralCaptureCost(game, player, target, reach);
    const targetProgress = target.captureProgress?.[player.id] || 0;

    return {
      ok: true,
      resultType: capturedNow > 0 ? "expansionWave" : "partial",
      captured: capturedNow > 0,
      waveId: wave.id,
      active: keepActive,
      capturedTiles: wave.capturedTiles.slice(),
      spentEnergy: Math.round(spend),
      cost: targetCost,
      progress: Math.round(targetProgress),
      remaining: Math.round(Math.max(0, targetCost - targetProgress)),
      message:
        capturedNow > 0
          ? `Expansion wave captured ${capturedNow} tile${capturedNow === 1 ? "" : "s"} and will keep moving while energy remains.`
          : `Expansion wave started: ${Math.round(targetProgress)}/${targetCost} progress. Send more energy or wait for income.`,
    };
  }

  activeExpansionForTarget(playerId, tileId) {
    return this.activeExpansions.find(
      (wave) =>
        !wave.finished &&
        wave.playerId === playerId &&
        (wave.startTileId === tileId || (wave.frontierTiles || []).includes(tileId) || (wave.capturedTiles || []).includes(tileId)),
    );
  }

  processExpansionWaves(game, now) {
    if (!this.activeExpansions.length) return;
    this.activeExpansions = this.activeExpansions.filter((wave) => this.processExpansionWave(game, wave, now, false));
  }

  processExpansionWave(game, wave, now, force = false) {
    if (wave.finished) return false;
    if (!force && now - wave.lastTick < (wave.tickRate || EXPANSION_TICK_SECONDS)) return true;

    const player = game.getPlayer(wave.playerId);
    if (!player || player.defeated) {
      this.finishExpansionWave(game, wave, "Expansion stopped: animal is gone.");
      return false;
    }
    if (now - wave.createdAt >= (wave.maxDuration || EXPANSION_MAX_DURATION_SECONDS)) {
      this.finishExpansionWave(game, wave, wave.capturedTiles.length ? "Expansion wave reached its limit." : "Expansion wave faded before capturing.");
      return false;
    }

    let captured = 0;
    let progressed = 0;
    let changed = false;
    const captureLimit = force ? 1 : EXPANSION_CAPTURE_LIMIT;

    while (wave.remainingBudget > 0.5 && captured < captureLimit) {
      const candidates = this.expansionWaveCandidates(game, wave, player);
      if (!candidates.length) {
        if (changed) break;
        this.finishExpansionWave(game, wave, "Expansion wave has no connected neutral tiles.");
        return false;
      }

      const candidate = candidates[0];
      const tile = candidate.tile;
      const reach = { source: candidate.source, jumped: Boolean(candidate.jumped) };
      const cost = this.neutralCaptureCost(game, player, tile, reach);
      const currentProgress = Number(tile.captureProgress?.[player.id] || 0);
      const needed = Math.max(0, cost - currentProgress);
      const spend = Math.min(wave.remainingBudget, needed);
      if (spend <= 0.25 && needed > 0.25) break;

      wave.remainingBudget = Math.max(0, wave.remainingBudget - spend);
      if (currentProgress + spend >= cost - 0.01) {
        this.captureExpansionTile(game, wave, player, candidate, spend, cost, now);
        captured += 1;
        changed = true;
        continue;
      }

      const progress = currentProgress + spend;
      tile.captureProgress = tile.captureProgress || {};
      tile.captureProgress[player.id] = progress;
      tile.lastChanged = now;
      if (!wave.weakenedTiles.includes(tile.id)) wave.weakenedTiles.push(tile.id);
      wave.status = "building";
      changed = true;
      progressed += 1;
      this.pushEvent({
        kind: "expandProgress",
        resultType: "partial",
        waveId: wave.id,
        from: candidate.from,
        to: tile.id,
        amount: Math.round(spend),
        cost,
        progress: Math.round(progress),
        playerId: player.id,
        remainingBudget: Math.round(wave.remainingBudget),
        at: now,
      });
      break;
    }

    wave.lastTick = now;
    wave.frontierTiles = this.trimExpansionFrontier(wave, player.id);
    if (captured > 0) {
      wave.status = "expanding";
      game.economy.recalculate(game.players, now, game);
    } else if (progressed > 0) {
      wave.status = "building";
    }

    if (wave.remainingBudget <= 0.5) {
      this.finishExpansionWave(game, wave, captured > 0 ? `Expansion wave captured ${captured} tile${captured === 1 ? "" : "s"}.` : "Expansion wave spent.");
      return false;
    }
    if (!this.expansionWaveCandidates(game, wave, player).length) {
      this.finishExpansionWave(game, wave, "Expansion wave reached the edge of connected neutral water.");
      return false;
    }
    if (!changed) {
      this.finishExpansionWave(game, wave, "Expansion wave stalled.");
      return false;
    }
    return true;
  }

  expansionWaveCandidates(game, wave, player) {
    const seen = new Set();
    const candidates = [];
    const anchors = (wave.frontierTiles?.length ? wave.frontierTiles : [wave.startTileId])
      .map((id) => this.tileManager.getById(id))
      .filter(Boolean);

    anchors.forEach((anchor) => {
      if (!anchor.owner && anchor.id === wave.startTileId) {
        this.addExpansionCandidate(game, wave, player, candidates, seen, anchor, wave.fromByTile?.[anchor.id] || wave.sourceTile, 0);
        return;
      }
      if (anchor.owner !== player.id) return;
      const nextDistance = (wave.distanceByTile?.[anchor.id] || 0) + 1;
      anchor.neighbors.forEach((neighbor) => {
        if (neighbor.owner || config.TILE_TYPES[neighbor.type].blocks) return;
        this.addExpansionCandidate(game, wave, player, candidates, seen, neighbor, anchor.id, nextDistance);
      });
    });

    return candidates.sort((a, b) => a.score - b.score);
  }

  addExpansionCandidate(game, wave, player, candidates, seen, tile, from, distance) {
    if (!tile || tile.owner || config.TILE_TYPES[tile.type].blocks || seen.has(tile.id)) return;
    const source = this.tileManager.getById(from) || this.tileManager.getById(wave.sourceTile);
    if (!source) return;
    seen.add(tile.id);
    const playerEdges = tile.neighbors.filter((neighbor) => neighbor.owner === player.id).length;
    const reach = { source, jumped: false };
    const cost = this.neutralCaptureCost(game, player, tile, reach);
    candidates.push({
      tile,
      source,
      from: source.id,
      distance,
      playerEdges,
      cost,
      score: this.expansionTileScore(game, wave, player, tile, cost, distance, playerEdges),
    });
  }

  expansionTileScore(game, wave, player, tile, cost, distance, playerEdges) {
    const start = this.tileManager.getById(wave.startTileId);
    const startDistance = start ? Math.abs(start.x - tile.x) + Math.abs(start.y - tile.y) : distance;
    const progress = tile.captureProgress?.[player.id] ? -5 : 0;
    const startBias = tile.id === wave.startTileId ? -12 : 0;
    const edgeBonus = -playerEdges * 1.7;
    const rangePenalty = startDistance * 0.55 + distance * 0.35;
    let animalBias = 0;
    if (player.animal === "duck" && tile.type === "water") animalBias -= 2.4;
    if (player.animal === "duck" && tile.type === "reeds") animalBias += 2.2;
    if (player.animal === "snake" && tile.type === "water") animalBias += 2.6;
    if (player.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) animalBias -= 2.5;
    if (player.animal === "frog" && tile.type === "lily") animalBias -= 2.1;
    return cost + rangePenalty + animalBias + edgeBonus + progress + startBias + Math.random() * 0.08;
  }

  trimExpansionFrontier(wave, playerId) {
    const ids = new Set([...(wave.frontierTiles || []), ...(wave.capturedTiles || []).slice(-28)]);
    const frontier = [];
    ids.forEach((id) => {
      const tile = this.tileManager.getById(id);
      if (!tile) return;
      if (!tile.owner && id === wave.startTileId) {
        frontier.push(id);
        return;
      }
      if (tile.owner !== playerId) return;
      if (tile.neighbors.some((neighbor) => !neighbor.owner && !config.TILE_TYPES[neighbor.type].blocks)) frontier.push(id);
    });
    return frontier.slice(-80);
  }

  captureExpansionTile(game, wave, player, candidate, spend, cost, now) {
    const tile = candidate.tile;
    const previousOwner = tile.owner || null;
    wave.remainingBudget = Math.max(0, wave.remainingBudget);
    tile.owner = player.id;
    this.tileManager.transferBuilding(tile.id, player.id, previousOwner, "expansionWave", now, (event) => this.pushEvent(event));
    tile.captureProgress = {};
    tile.defenseEnergy = Math.min(14, Math.max(2, spend * 0.14));
    tile.lastChanged = now;
    player.stats.tilesCaptured += 1;
    player.stats.bestExpansionWave = Math.max(player.stats.bestExpansionWave || 0, wave.capturedTiles.length + 1);
    wave.capturedTiles.push(tile.id);
    wave.distanceByTile[tile.id] = candidate.distance;
    wave.fromByTile[tile.id] = candidate.from;
    if (!wave.frontierTiles.includes(tile.id)) wave.frontierTiles.push(tile.id);

    this.pushEvent({
      kind: "expand",
      resultType: "expanded",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      amount: Math.round(spend),
      cost,
      progress: cost,
      playerId: player.id,
      remainingBudget: Math.round(wave.remainingBudget),
      at: now,
    });
    this.pushEvent({
      kind: "expansionWaveCapture",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      amount: Math.round(spend),
      cost,
      playerId: player.id,
      captured: wave.capturedTiles.length,
      remainingBudget: Math.round(wave.remainingBudget),
      at: now,
    });
  }

  finishExpansionWave(game, wave, message = "Expansion wave spent.") {
    if (wave.finished) return;
    wave.finished = true;
    wave.status = "finished";
    this.pushEvent({
      kind: "expansionWaveEnd",
      waveId: wave.id,
      playerId: wave.playerId,
      to: wave.capturedTiles.slice(-1)[0] || wave.startTileId,
      captured: wave.capturedTiles.length,
      remainingBudget: Math.round(wave.remainingBudget || 0),
      message,
      at: game.now(),
    });
  }

  startWaveAttack(game, player, defender, target, percent, sourceIds = [], options = {}) {
    const now = game.now();
    const diplomacyCheck = game.diplomacy.canAttack(player.id, defender.id, now);
    if (!diplomacyCheck.ok) return { ok: false, resultType: "diplomacyBlocked", message: diplomacyCheck.reason };

    const reach = options.routeReach || this.tileManager.borderReachInfo(player, target, sourceIds);
    if (!reach.reachable) return { ok: false, resultType: "tooFar", message: "Too far for Border Attack. Try Current Push if there is an open water route." };

    const spend = this.spendEnergy(player, percent);
    if (spend < MIN_ATTACK_ENERGY) {
      return {
        ok: false,
        resultType: "notEnoughEnergy",
        message: `Not enough Animal Energy. Attacks need at least ${MIN_ATTACK_ENERGY} energy.`,
      };
    }

    const exhaustion = Math.min(balance.maxWarExhaustion, player.flags?.warExhaustion || 0);
    const attackInfo = this.attackModifierInfo(game, player, target, reach.source, false);
    const routeMultiplier = options.routeAttack ? 0.74 * (1 + Math.min(0.45, player.flags?.routePowerBonus || 0)) : 1;
    const attackPower = spend * ATTACK_EFFICIENCY * balance.attackPowerMultiplier * (1 - exhaustion) * attackInfo.multiplier * routeMultiplier;
    const mergeWave = this.activeWaveForTarget(player.id, defender.id, target.id);
    if (!mergeWave && this.activeAttacks.filter((wave) => wave.attackerId === player.id).length >= MAX_ACTIVE_ATTACKS_PER_PLAYER) {
      return { ok: false, resultType: "tooManyWaves", message: "Too many active waves. Wait for one to finish." };
    }

    player.energy -= spend;
    player.stats.energyUsed += spend;
    player.stats.attacksLaunched = (player.stats.attacksLaunched || 0) + 1;
    player.flags.warExhaustion = Math.min(balance.maxWarExhaustion, (player.flags.warExhaustion || 0) + balance.warExhaustionPerAttack);
    player.attackCooldownUntil = 0;

    if (mergeWave) {
      return this.mergeWaveAttack(game, mergeWave, player, defender, target, reach, spend, attackPower, attackInfo, options, now);
    }

    const wave = {
      id: `wave-${this.nextAttackId}`,
      attackerId: player.id,
      defenderId: defender.id,
      startTileId: reach.source.id,
      targetTileId: target.id,
      sentEnergy: spend,
      attackBudget: Math.max(0, attackPower),
      remainingBudget: Math.max(0, attackPower),
      remainingPower: Math.max(0, attackPower),
      frontierTiles: [target.id],
      capturedTiles: [],
      weakenedTiles: [],
      status: "pushing",
      distanceByTile: { [target.id]: 0 },
      fromByTile: { [target.id]: reach.source.id },
      sourceTile: reach.source.id,
      targetStartTile: target.id,
      spentEnergy: spend,
      ambushApplied: attackInfo.ambushApplied,
      continuous: Boolean(options.continuous),
      routeAttack: Boolean(options.routeAttack),
      createdAt: now,
      lastTick: now - WAVE_TICK_SECONDS,
      tickRate: WAVE_TICK_SECONDS,
      maxDuration: options.maxDuration || WAVE_MAX_DURATION_SECONDS,
    };
    this.nextAttackId += 1;
    this.activeAttacks.push(wave);
    game.recordWar?.(player.id, defender.id, { attack: true, damage: spend, energySpent: spend });

    this.pushEvent({
      kind: "attackWave",
      waveId: wave.id,
      continuous: Boolean(options.continuous),
      routeAttack: Boolean(options.routeAttack),
      from: reach.source.id,
      to: target.id,
      amount: Math.round(spend),
      sentEnergy: Math.round(spend),
      attackBudget: Math.round(wave.attackBudget),
      remainingBudget: Math.round(wave.remainingBudget),
      status: wave.status,
      playerId: player.id,
      targetOwner: defender.id,
      abilityModifier: attackInfo.ambushApplied ? "Ambush" : null,
      message: `Committed ${Math.round(spend)} Animal Energy to a frontline wave.`,
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
        : options.routeAttack
          ? `Current Push launched with ${Math.round(spend)} energy.`
          : options.continuous
            ? `Continuous attack sent ${Math.round(spend)} energy.`
            : `Frontline wave committed ${Math.round(spend)} energy.`,
      spentEnergy: Math.round(spend),
      attackPower: Math.round(attackPower),
      gameplayChanges: attackInfo.ambushApplied ? ["Ambush applied: +40% attack power", "Ambush applied: enemy border costs -20%"] : [],
      activeEffect: attackInfo.ambushApplied ? null : this.abilityStatus(player, now).activeEffect,
    };
  }

  activeWaveForTarget(attackerId, defenderId, targetId) {
    return this.activeAttacks.find(
      (wave) =>
        !wave.finished &&
        wave.attackerId === attackerId &&
        wave.defenderId === defenderId &&
        (wave.targetStartTile === targetId || (wave.frontierTiles || []).includes(targetId)),
    );
  }

  mergeWaveAttack(game, wave, player, defender, target, reach, spend, attackPower, attackInfo, options, now) {
    wave.sentEnergy = (wave.sentEnergy || 0) + spend;
    wave.spentEnergy = (wave.spentEnergy || 0) + spend;
    wave.attackBudget = (wave.attackBudget || 0) + Math.max(0, attackPower);
    wave.remainingPower = Math.max(0, (wave.remainingPower || 0) + attackPower);
    wave.remainingBudget = wave.remainingPower;
    wave.status = "pushing";
    wave.sourceTile = reach.source?.id || wave.sourceTile;
    wave.fromByTile[target.id] = reach.source?.id || wave.fromByTile[target.id] || wave.sourceTile;
    wave.distanceByTile[target.id] = wave.distanceByTile[target.id] ?? 0;
    if (target.owner === defender.id && !(wave.frontierTiles || []).includes(target.id)) wave.frontierTiles.push(target.id);
    wave.ambushApplied = Boolean(wave.ambushApplied || attackInfo.ambushApplied);
    wave.maxDuration = Math.max(wave.maxDuration || WAVE_MAX_DURATION_SECONDS, now - wave.createdAt + (options.maxDuration || WAVE_MAX_DURATION_SECONDS));
    this.syncWaveBudget(wave);
    game.recordWar?.(player.id, defender.id, { attack: true, damage: spend, energySpent: spend });

    this.pushEvent({
      kind: "attackWave",
      waveId: wave.id,
      merged: true,
      continuous: Boolean(options.continuous),
      routeAttack: Boolean(options.routeAttack),
      from: reach.source?.id || wave.sourceTile,
      to: target.id,
      amount: Math.round(spend),
      sentEnergy: Math.round(spend),
      attackBudget: Math.round(wave.attackBudget),
      remainingBudget: Math.round(wave.remainingBudget),
      status: wave.status,
      playerId: player.id,
      targetOwner: defender.id,
      abilityModifier: attackInfo.ambushApplied ? "Ambush" : null,
      message: `Added ${Math.round(spend)} Animal Energy to active wave.`,
      at: now,
    });

    if (attackInfo.ambushApplied) {
      this.pushEvent({
        kind: "abilityUsed",
        playerId: player.id,
        skillType: player.animal,
        ability: animals[player.animal].ability,
        from: reach.source?.id || wave.sourceTile,
        to: target.id,
        at: now,
      });
    }

    return {
      ok: true,
      resultType: "mergedAttack",
      merged: true,
      waveId: wave.id,
      message: attackInfo.ambushApplied
        ? `Ambush added ${Math.round(spend)} energy to the active wave.`
        : `Added ${Math.round(spend)} Animal Energy to active wave.`,
      spentEnergy: Math.round(spend),
      attackPower: Math.round(attackPower),
      gameplayChanges: attackInfo.ambushApplied ? ["Ambush applied: +40% attack power", "Ambush applied: enemy border costs -20%"] : [],
      activeEffect: attackInfo.ambushApplied ? null : this.abilityStatus(player, now).activeEffect,
    };
  }

  startContinuousAttack(game, player, tileId, percent, sourceIds = []) {
    const now = game.now();
    const target = this.tileManager.getById(tileId);
    if (!target || !target.owner || target.owner === player.id) return { ok: false, message: "Choose an enemy border to start a continuous attack." };
    const defender = game.getPlayer(target.owner);
    if (!defender || defender.defeated) return { ok: false, message: "Target player is no longer active." };
    const diplomacyCheck = game.diplomacy.canAttack(player.id, defender.id, now);
    if (!diplomacyCheck.ok) return { ok: false, message: diplomacyCheck.reason };
    const reach = this.tileManager.borderReachInfo(player, target, sourceIds);
    if (!reach.reachable) return { ok: false, message: "Continuous attack needs a connected enemy border." };
    if (player.energy < (balance.continuousAttackMinEnergy || 6)) return { ok: false, message: "Not enough Animal Energy to start a continuous attack." };

    this.stopContinuousAttack(game, player.id, "Attack retargeted.", true);
    const cleanPercent = Math.max(0.1, Math.min(1, Number(percent) || 0.25));
    const drainPerSecond = Math.max(balance.continuousAttackMinEnergy || 6, player.maxEnergy * 0.025, player.energy * cleanPercent * 0.1);
    const order = {
      id: `cont-${this.nextContinuousId}`,
      attackerId: player.id,
      defenderId: defender.id,
      targetTileId: target.id,
      sourceTile: reach.source.id,
      sourceIds,
      percent: cleanPercent,
      drainPerSecond,
      estimatedCaptureSpeed: cleanPercent >= 0.75 ? "fast" : cleanPercent >= 0.5 ? "steady" : "probing",
      createdAt: now,
      lastTick: now - (balance.continuousAttackTickSeconds || 1.45),
      lastSpend: 0,
    };
    this.nextContinuousId += 1;
    this.continuousAttacks.push(order);
    this.pushEvent({
      kind: "continuousAttackStart",
      orderId: order.id,
      playerId: player.id,
      targetOwner: defender.id,
      from: reach.source.id,
      to: target.id,
      drainPerSecond: Math.round(drainPerSecond),
      at: now,
      message: `${player.name} started a continuous frontline attack.`,
    });
    return {
      ok: true,
      resultType: "continuousAttack",
      message: `Continuous attack started. Draining about ${Math.round(drainPerSecond)} energy/s.`,
      drainPerSecond: Math.round(drainPerSecond),
    };
  }

  stopContinuousAttack(game, playerId, reason = "Attack stopped.", silent = false) {
    const now = game.now();
    const stopped = this.continuousAttacks.filter((order) => order.attackerId === playerId);
    this.continuousAttacks = this.continuousAttacks.filter((order) => order.attackerId !== playerId);
    if (!stopped.length) return { ok: true, message: "No continuous attack active." };
    if (!silent) {
      stopped.forEach((order) =>
        this.pushEvent({
          kind: "continuousAttackStop",
          orderId: order.id,
          playerId,
          targetOwner: order.defenderId,
          to: order.targetTileId,
          message: reason,
          at: now,
        }),
      );
    }
    return { ok: true, resultType: "continuousStopped", message: reason };
  }

  processContinuousAttacks(game, now) {
    if (!this.continuousAttacks.length) return;
    this.continuousAttacks = this.continuousAttacks.filter((order) => {
      if (now - order.lastTick < (balance.continuousAttackTickSeconds || 1.45)) return true;
      const attacker = game.getPlayer(order.attackerId);
      const defender = game.getPlayer(order.defenderId);
      if (!attacker || !defender || attacker.defeated || defender.defeated) return false;
      const diplomacyCheck = game.diplomacy.canAttack(attacker.id, defender.id, now);
      if (!diplomacyCheck.ok) {
        this.pushEvent({ kind: "continuousAttackStop", playerId: attacker.id, targetOwner: defender.id, to: order.targetTileId, message: diplomacyCheck.reason, at: now });
        return false;
      }
      if (attacker.energy < (balance.continuousAttackMinEnergy || 6)) {
        this.pushEvent({ kind: "continuousAttackStop", playerId: attacker.id, targetOwner: defender.id, to: order.targetTileId, message: "Continuous attack stopped: energy too low.", at: now });
        return false;
      }
      if (this.activeAttacks.filter((wave) => wave.attackerId === attacker.id).length >= MAX_ACTIVE_ATTACKS_PER_PLAYER) return true;

      const target = this.continuousTarget(attacker, defender, order);
      if (!target) {
        this.pushEvent({ kind: "continuousAttackStop", playerId: attacker.id, targetOwner: defender.id, to: order.targetTileId, message: "Continuous attack stopped: no connected front.", at: now });
        return false;
      }
      const spendTarget = Math.max(balance.continuousAttackMinEnergy || 6, attacker.energy * order.percent * (balance.continuousAttackEnergyMultiplier || 0.34));
      const tickPercent = Math.min(balance.continuousAttackMaxPercentPerTick || 0.22, Math.max(0.04, spendTarget / Math.max(1, attacker.energy)));
      const result = this.startWaveAttack(game, attacker, defender, target, tickPercent, order.sourceIds, {
        continuous: true,
        ignoreCooldown: true,
      });
      order.lastTick = now;
      order.targetTileId = target.id;
      order.lastSpend = result.spentEnergy || spendTarget;
      if (!result.ok && !["tooManyWaves"].includes(result.resultType)) {
        this.pushEvent({ kind: "continuousAttackStop", playerId: attacker.id, targetOwner: defender.id, to: target.id, message: result.message, at: now });
        return false;
      }
      if (result.ok) {
        this.pushEvent({
          kind: "continuousAttackPulse",
          playerId: attacker.id,
          targetOwner: defender.id,
          to: target.id,
          amount: Math.round(result.spentEnergy || 0),
          at: now,
        });
      }
      return true;
    });
  }

  continuousTarget(attacker, defender, order) {
    const original = this.tileManager.getById(order.targetTileId);
    if (original?.owner === defender.id && this.tileManager.borderReachInfo(attacker, original, order.sourceIds).reachable) return original;
    const candidates = this.tileManager
      .capturable(attacker.id)
      .filter((tile) => tile.owner === defender.id && this.tileManager.borderReachInfo(attacker, tile, order.sourceIds).reachable);
    if (!candidates.length) return null;
    const anchor = original || this.tileManager.getById(order.sourceTile);
    return candidates
      .sort((a, b) => {
        const ad = anchor ? Math.abs(a.x - anchor.x) + Math.abs(a.y - anchor.y) : 0;
        const bd = anchor ? Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y) : 0;
        return ad - bd || a.defenseEnergy - b.defenseEnergy;
      })[0];
  }

  startWaterRouteAttack(game, player, tileId, percent, sourceIds = []) {
    const now = game.now();
    const target = this.tileManager.getById(tileId);
    if (!target || !target.owner || target.owner === player.id) return { ok: false, message: "Choose an enemy coastal tile for Current Push." };
    const defender = game.getPlayer(target.owner);
    if (!defender || defender.defeated) return { ok: false, message: "Target player is no longer active." };
    const diplomacyCheck = game.diplomacy.canAttack(player.id, defender.id, now);
    if (!diplomacyCheck.ok) return { ok: false, message: diplomacyCheck.reason || "Cannot attack ally." };
    if (now < (player.currentPushCooldownUntil || 0)) {
      return { ok: false, resultType: "cooldown", message: `Current Push cooling down for ${Math.ceil(player.currentPushCooldownUntil - now)}s.` };
    }
    const route = this.waterRoute(player, target, sourceIds);
    if (!route) return { ok: false, resultType: "routeBlocked", message: "Current Push route blocked. Pick an enemy border reachable through open water or lily pads." };
    const distance = route.path.length;
    if (distance > (CURRENT_PUSH.maxRange || 32)) return { ok: false, resultType: "tooFar", message: "Current Push route is too far. Pick a closer coastal border." };
    const spend = this.spendEnergy(player, percent);
    if (spend < (CURRENT_PUSH.minEnergy || 10)) {
      return { ok: false, resultType: "notEnoughEnergy", message: `Current Push needs at least ${CURRENT_PUSH.minEnergy || 10} Animal Energy.` };
    }

    const tiers = Math.max(0, Math.ceil((distance - (CURRENT_PUSH.distanceTier || 8)) / (CURRENT_PUSH.distanceTier || 8)));
    const efficiency = Math.max(
      CURRENT_PUSH.minEfficiency || 0.5,
      (CURRENT_PUSH.baseEfficiency || 0.78) - tiers * (CURRENT_PUSH.distancePenaltyPerTier || 0.1),
    );
    const beginnerProtection =
      defender.id === config.HUMAN_ID &&
      (game.matchSettings?.difficulty === "easy" || game.matchSettings?.beginnerCombat || game.matchSettings?.practice)
        ? CURRENT_PUSH.beginnerHumanPowerMultiplier || 0.75
        : 1;
    const travelTime = Math.max(
      CURRENT_PUSH.minTravelSeconds || 3,
      Math.min(CURRENT_PUSH.maxTravelSeconds || 12, distance * (CURRENT_PUSH.secondsPerTile || 0.28)),
    );
    const remainingPower = spend * (balance.attackPowerMultiplier || 1) * efficiency * beginnerProtection * (1 + Math.min(0.25, player.flags?.routePowerBonus || 0));

    player.energy -= spend;
    player.stats.energyUsed += spend;
    player.stats.attacksLaunched = (player.stats.attacksLaunched || 0) + 1;
    player.currentPushCooldownUntil = player.flags?.unlimitedCurrentPush ? 0 : now + (CURRENT_PUSH.cooldownSeconds || 45);
    player.flags.warExhaustion = Math.min(balance.maxWarExhaustion, (player.flags.warExhaustion || 0) + (balance.warExhaustionPerAttack || 0.08) * 0.65);

    const push = {
      id: `current-${this.nextCurrentPushId}`,
      attackerId: player.id,
      defenderId: defender.id,
      routeTiles: route.path.map((tile) => tile.id),
      currentRouteIndex: 0,
      sentEnergy: spend,
      remainingPower,
      sourceTile: route.source.id,
      targetStartTile: target.id,
      targetOwner: defender.id,
      startTime: now,
      impactTime: now + travelTime,
      warningAt: now + Math.max(0, travelTime - (CURRENT_PUSH.warningLeadSeconds || 2)),
      travelTime,
      efficiency,
      distance,
      distanceTiers: tiers,
      warningSent: false,
      status: "traveling",
      maxCaptures: Math.max(2, (CURRENT_PUSH.maxImpactCaptures || 7) - tiers * (CURRENT_PUSH.longRouteCapturePenalty || 1)),
    };
    this.nextCurrentPushId += 1;
    this.currentPushes.push(push);
    game.recordWar?.(player.id, defender.id, { attack: true, damage: spend, energySpent: spend });

    this.pushEvent({
      kind: "waterRouteAttack",
      currentPushId: push.id,
      playerId: player.id,
      targetOwner: defender.id,
      from: route.source.id,
      to: target.id,
      routeTiles: push.routeTiles.slice(0, 64),
      amount: Math.round(spend),
      impactPower: Math.round(remainingPower),
      travelTime: Number(travelTime.toFixed(1)),
      impactTime: push.impactTime,
      distance,
      efficiency: Number(efficiency.toFixed(2)),
      at: now,
      message: `Current Push launched. Impact in ${travelTime.toFixed(1)}s.`,
    });

    return {
      ok: true,
      resultType: "currentPush",
      message: `Current Push launched. Impact in ${travelTime.toFixed(1)}s.`,
      spentEnergy: Math.round(spend),
      impactPower: Math.round(remainingPower),
      travelTime: Number(travelTime.toFixed(1)),
      routeDistance: distance,
      efficiency: Number(efficiency.toFixed(2)),
      cooldown: CURRENT_PUSH.cooldownSeconds || 45,
    };
  }

  waterRoute(player, target, sourceIds = []) {
    const waterTypes = new Set(["water", "lily"]);
    const starts = sourceIds
      .map((id) => this.tileManager.getById(id))
      .filter((tile) => tile?.owner === player.id && waterTypes.has(tile.type));
    if (!starts.length) {
      starts.push(...this.tileManager.owned(player.id).filter((tile) => waterTypes.has(tile.type)));
    }
    const targetCoast = target.neighbors.some((neighbor) => waterTypes.has(neighbor.type) && !config.TILE_TYPES[neighbor.type].blocks);
    if (!starts.length || !targetCoast) return null;
    const maxDistance = CURRENT_PUSH.maxRange || (player.animal === "duck" || player.animal === "carp" ? 28 : 20);
    const queue = starts.slice(0, 24).map((tile) => ({ tile, path: [tile] }));
    const seen = new Set(queue.map((entry) => entry.tile.id));
    while (queue.length) {
      const current = queue.shift();
      if (Math.abs(current.tile.x - target.x) + Math.abs(current.tile.y - target.y) <= 1) return { source: current.path[0], path: current.path };
      if (current.path.length > maxDistance) continue;
      current.tile.neighbors.forEach((neighbor) => {
        if (seen.has(neighbor.id) || config.TILE_TYPES[neighbor.type].blocks || !waterTypes.has(neighbor.type)) return;
        if (neighbor.owner && neighbor.owner !== player.id && neighbor.owner !== target.owner) return;
        seen.add(neighbor.id);
        queue.push({ tile: neighbor, path: current.path.concat(neighbor) });
      });
    }
    return null;
  }

  processCurrentPushes(game, now) {
    if (!this.currentPushes.length) return;
    this.currentPushes = this.currentPushes.filter((push) => {
      const attacker = game.getPlayer(push.attackerId);
      const defender = game.getPlayer(push.defenderId);
      if (!attacker || !defender || attacker.defeated || defender.defeated) {
        this.currentPushCancelled(game, push, "Current Push ended: attacker or defender is gone.");
        return false;
      }
      const diplomacyCheck = game.diplomacy.canAttack(push.attackerId, push.defenderId, now);
      if (!diplomacyCheck.ok) {
        this.currentPushCancelled(game, push, diplomacyCheck.reason || "Current Push cancelled by diplomacy.");
        return false;
      }

      const invalidRouteTile = push.routeTiles
        .map((id) => this.tileManager.getById(id))
        .find((tile) => !tile || config.TILE_TYPES[tile.type]?.blocks);
      if (invalidRouteTile) {
        this.currentPushCancelled(game, push, "Current Push route blocked.");
        return false;
      }

      const progress = Math.max(0, Math.min(1, (now - push.startTime) / Math.max(0.1, push.travelTime)));
      push.currentRouteIndex = Math.min(push.routeTiles.length - 1, Math.floor(progress * Math.max(1, push.routeTiles.length - 1)));

      if (!push.warningSent && now >= push.warningAt) {
        push.warningSent = true;
        this.pushEvent({
          kind: "currentPushWarning",
          currentPushId: push.id,
          playerId: push.attackerId,
          targetOwner: push.defenderId,
          to: push.targetStartTile,
          routeTiles: push.routeTiles.slice(0, 64),
          impactTime: push.impactTime,
          impactIn: Math.max(0, Number((push.impactTime - now).toFixed(1))),
          message: "Enemy Current Push incoming. Reinforce now.",
          at: now,
        });
      }

      if (now < push.impactTime) return true;
      this.resolveCurrentPush(game, push, attacker, defender, now);
      return false;
    });
  }

  currentPushCancelled(game, push, message) {
    push.status = "blocked";
    this.pushEvent({
      kind: "currentPushBlocked",
      currentPushId: push.id,
      playerId: push.attackerId,
      targetOwner: push.defenderId,
      to: push.targetStartTile,
      routeTiles: push.routeTiles?.slice(0, 64) || [],
      message,
      at: game.now(),
    });
  }

  resolveCurrentPush(game, push, attacker, defender, now) {
    const target = this.tileManager.getById(push.targetStartTile);
    if (!target || target.owner !== defender.id) {
      this.currentPushCancelled(game, push, "Current Push missed: target border changed before impact.");
      return;
    }

    const routeTiles = push.routeTiles.map((id) => this.tileManager.getById(id)).filter(Boolean);
    const interceptTiles = routeTiles.filter((tile) => tile.owner === defender.id && tile.id !== target.id);
    const interceptLoss = Math.min(CURRENT_PUSH.maxInterceptPowerLoss || 0.45, interceptTiles.length * (CURRENT_PUSH.interceptPowerLossPerTile || 0.055));
    const shellMultiplier = defender.animal === "turtle" && now < (defender.abilityActiveUntil || 0) ? CURRENT_PUSH.turtleShellPowerMultiplier || 0.72 : 1;
    const dragonflyMultiplier = game.specials?.currentPushPowerMultiplier(defender, target, now) || 1;
    const finalPower = Math.max(0, push.remainingPower * (1 - interceptLoss) * shellMultiplier * dragonflyMultiplier);

    const wave = {
      id: push.id,
      attackerId: attacker.id,
      defenderId: defender.id,
      remainingPower: finalPower,
      frontierTiles: [target.id],
      capturedTiles: [],
      distanceByTile: { [target.id]: 0 },
      fromByTile: { [target.id]: routeTiles.at(-1)?.id || push.sourceTile },
      sourceTile: push.sourceTile,
      targetStartTile: target.id,
      spentEnergy: push.sentEnergy,
      ambushApplied: false,
      continuous: false,
      routeAttack: true,
      currentPush: true,
      createdAt: push.startTime,
      lastTick: now,
      tickRate: WAVE_TICK_SECONDS,
    };

    let captured = 0;
    const maxCaptures = Math.max(1, push.maxCaptures || CURRENT_PUSH.maxImpactCaptures || 7);
    const nextFrontier = new Set(wave.frontierTiles);
    while (captured < maxCaptures) {
      const candidates = this.waveCandidates(game, wave, attacker, defender);
      if (!candidates.length) break;
      const candidate = candidates[0];
      if (!candidate || candidate.tile.owner !== defender.id) break;
      const cost = this.waveCaptureCost(game, wave, attacker, defender, candidate) * (CURRENT_PUSH.impactCostMultiplier || 1.08);
      const pressure = this.attackPressure(candidate.tile, attacker.id);
      const adjustedCost = Math.max(3, cost - pressure);
      const closeEnough = pressure + wave.remainingPower >= cost * (PRESSURE.captureThreshold || 0.82);
      if (adjustedCost > wave.remainingPower && !closeEnough) {
        const progress = this.applyAttackPressure(game, wave, candidate, cost, now, { routeAttack: true });
        this.pushEvent({
          kind: "currentPushBlocked",
          currentPushId: push.id,
          playerId: attacker.id,
          targetOwner: defender.id,
          to: candidate.tile.id,
          amount: Math.round(Math.max(0, adjustedCost - wave.remainingPower)),
          progress: Math.round(progress.progress),
          cost: Math.round(progress.cost),
          message:
            captured > 0
              ? `Current Push weakened the next border ${Math.round(progress.progress)}/${Math.round(progress.cost)}.`
              : `Current Push weakened the border ${Math.round(progress.progress)}/${Math.round(progress.cost)}.`,
          at: now,
        });
        break;
      }
      const capturedTile = this.captureWaveTile(game, wave, attacker, defender, candidate, Math.min(wave.remainingPower, adjustedCost), now, cost);
      if (!capturedTile) break;
      nextFrontier.add(candidate.tile.id);
      wave.frontierTiles = this.trimWaveFrontier(wave, nextFrontier, defender.id);
      captured += 1;
    }

    const message =
      captured > 0
        ? `Current Push impacted: captured ${captured} tile${captured === 1 ? "" : "s"}.`
        : interceptLoss > 0 || shellMultiplier < 1 || dragonflyMultiplier < 1
          ? "Current Push weakened by defense and captured nothing."
          : "Current Push blocked by reinforced border.";
    this.pushEvent({
      kind: "currentPushImpact",
      currentPushId: push.id,
      playerId: attacker.id,
      targetOwner: defender.id,
      from: push.sourceTile,
      to: target.id,
      routeTiles: push.routeTiles.slice(0, 64),
      captured,
      remaining: Math.round(wave.remainingPower),
      interceptTiles: interceptTiles.length,
      shellGuarded: shellMultiplier < 1,
      dragonflyGuarded: dragonflyMultiplier < 1,
      message,
      at: now,
    });
    this.finishWave(game, wave, captured > 0 ? `Border Attack captured ${captured} tiles via Current Push.` : message);
  }

  processWave(game, wave, now) {
    if (wave.finished) return false;
    if (now - wave.lastTick < wave.tickRate) return true;

    const attacker = game.getPlayer(wave.attackerId);
    const defender = game.getPlayer(wave.defenderId);
    if (!attacker || !defender || attacker.defeated || defender.defeated) return false;
    if (now - wave.createdAt >= (wave.maxDuration || WAVE_MAX_DURATION_SECONDS)) {
      this.finishWave(game, wave, wave.capturedTiles.length ? "Wave spent after reaching its limit." : "Wave stalled and faded out.");
      return false;
    }
    const diplomacyCheck = game.diplomacy.canAttack(wave.attackerId, wave.defenderId, now);
    if (!diplomacyCheck.ok) {
      this.finishWave(game, wave, diplomacyCheck.reason);
      return false;
    }
    if (!this.resolveWaveContest(game, wave, attacker, defender, now)) return false;

    const candidates = this.waveCandidates(game, wave, attacker, defender);
    if (!candidates.length) {
      this.finishWave(game, wave, "Wave spent: no connected enemy border remains.");
      return false;
    }

    let captured = 0;
    const nextFrontier = new Set(wave.frontierTiles);
    wave.status = "pushing";
    for (const candidate of candidates) {
      if (captured >= WAVE_CAPTURE_LIMIT) break;
      if (candidate.tile.owner !== defender.id) continue;

      const cost = this.waveCaptureCost(game, wave, attacker, defender, candidate);
      const pressure = this.attackPressure(candidate.tile, attacker.id);
      const adjustedCost = Math.max(3, cost - pressure);
      const closeEnough = pressure + wave.remainingPower >= cost * (PRESSURE.captureThreshold || 0.82);
      if (adjustedCost > wave.remainingPower && !closeEnough) {
        if (captured === 0) {
          wave.status = "stalled";
          this.resistWave(game, wave, candidate, cost, adjustedCost);
        }
        break;
      }

      const capturedTile = this.captureWaveTile(game, wave, attacker, defender, candidate, Math.min(wave.remainingPower, adjustedCost), now, cost);
      if (!capturedTile) break;
      nextFrontier.add(candidate.tile.id);
      captured += 1;
    }

    wave.lastTick = now;
    wave.frontierTiles = this.trimWaveFrontier(wave, nextFrontier, defender.id);
    this.syncWaveBudget(wave);

    if (captured === 0) return false;
    if (wave.remainingPower < this.cheapestFrontierCost(game, wave, attacker, defender)) {
      this.finishWave(game, wave, "Wave spent.");
      return false;
    }
    return true;
  }

  resolveWaveContest(game, wave, attacker, defender, now) {
    const opposing = this.activeAttacks.find(
      (other) =>
        other !== wave &&
        !other.finished &&
        other.attackerId === defender.id &&
        other.defenderId === attacker.id &&
        this.wavesTouch(wave, other),
    );
    if (!opposing) return true;

    const combined = Math.max(1, (wave.remainingPower || 0) + (opposing.remainingPower || 0));
    const clash = Math.max(4, combined * CONTEST_POWER_LOSS_RATIO);
    let winnerId = null;
    if ((wave.remainingPower || 0) > (opposing.remainingPower || 0) * 1.12) {
      winnerId = wave.attackerId;
      opposing.remainingPower = Math.max(0, opposing.remainingPower - clash);
      wave.remainingPower = Math.max(0, wave.remainingPower - clash * CONTEST_WINNER_LOSS_RATIO);
    } else if ((opposing.remainingPower || 0) > (wave.remainingPower || 0) * 1.12) {
      winnerId = opposing.attackerId;
      wave.remainingPower = Math.max(0, wave.remainingPower - clash);
      opposing.remainingPower = Math.max(0, opposing.remainingPower - clash * CONTEST_WINNER_LOSS_RATIO);
    } else {
      wave.remainingPower = Math.max(0, wave.remainingPower - clash * 0.75);
      opposing.remainingPower = Math.max(0, opposing.remainingPower - clash * 0.75);
    }
    wave.status = "contested";
    opposing.status = "contested";
    this.syncWaveBudget(wave);
    this.syncWaveBudget(opposing);
    this.pushEvent({
      kind: "waveContested",
      waveId: wave.id,
      opposingWaveId: opposing.id,
      playerId: wave.attackerId,
      targetOwner: wave.defenderId,
      winnerId,
      amount: Math.round(clash),
      remaining: Math.round(wave.remainingPower),
      opposingRemaining: Math.round(opposing.remainingPower),
      to: wave.targetStartTile,
      at: now,
      message: winnerId ? "Contested border: stronger wave kept pushing." : "Contested border: both waves lost power.",
    });
    if (opposing.remainingPower <= 1) {
      this.finishWave(game, opposing, "Wave spent in contested pressure.");
      opposing.finished = true;
    }
    if (wave.remainingPower <= 1) {
      this.finishWave(game, wave, "Wave spent in contested pressure.");
      return false;
    }
    return true;
  }

  wavesTouch(a, b) {
    const aIds = new Set([a.targetStartTile, ...(a.frontierTiles || [])].filter((id) => id != null));
    const bIds = new Set([b.targetStartTile, ...(b.frontierTiles || [])].filter((id) => id != null));
    for (const id of aIds) {
      if (bIds.has(id)) return true;
      const tile = this.tileManager.getById(id);
      if (tile?.neighbors.some((neighbor) => bIds.has(neighbor.id))) return true;
    }
    return false;
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
      const aStart = a.tile.id === wave.targetStartTile ? -2.5 : 0;
      const bStart = b.tile.id === wave.targetStartTile ? -2.5 : 0;
      const aScore = a.roughCost + a.distance * 0.65 - a.attackerEdges * 1.7 + aStart;
      const bScore = b.roughCost + b.distance * 0.65 - b.attackerEdges * 1.7 + bStart;
      return aScore - bScore;
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

  captureWaveTile(game, wave, attacker, defender, candidate, spendCost, now, rawCost = spendCost) {
    const tile = candidate.tile;
    const previousOwner = tile.owner || defender?.id || null;
    const pressureSpent = Math.round(this.attackPressure(tile, attacker.id));
    const coreHit = game.core?.handleCoreHit(game, wave, attacker, defender, candidate, rawCost);
    if (coreHit?.blocked) {
      this.finishWave(game, wave, coreHit.reason || "Core Nest resisted the attack.");
      return false;
    }
    wave.remainingPower = Math.max(0, wave.remainingPower - spendCost);
    this.syncWaveBudget(wave);
    defender.energy = Math.max(0, defender.energy - Math.min(defender.energy, rawCost * 0.11 + 1.25));

    tile.owner = attacker.id;
    this.tileManager.transferBuilding(tile.id, attacker.id, previousOwner, wave.currentPush ? "currentPush" : "attackWave", now, (event) => this.pushEvent(event));
    tile.captureProgress = {};
    tile.defenseEnergy = Math.min(24, Math.max(2, wave.remainingPower * 0.025));
    tile.lastChanged = now;

    attacker.stats.tilesCaptured += 1;
    attacker.stats.damageDealt = (attacker.stats.damageDealt || 0) + rawCost;
    attacker.stats.bestAttackWave = Math.max(attacker.stats.bestAttackWave || 0, wave.capturedTiles.length + 1);
    wave.capturedTiles.push(tile.id);
    wave.distanceByTile[tile.id] = candidate.distance;
    wave.fromByTile[tile.id] = candidate.from;

    if (!this.tileManager.owned(defender.id).length && !defender.defeated) game.eliminatePlayer?.(defender, attacker, "no territory");
    if (coreHit?.coreBroken) game.core?.handleCoreCaptured(game, attacker, defender, tile);

    this.pushEvent({
      kind: "waveCapture",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      amount: Math.round(rawCost),
      remaining: Math.round(wave.remainingPower),
      remainingBudget: Math.round(wave.remainingBudget),
      playerId: attacker.id,
      targetOwner: defender.id,
      pressureSpent,
      at: now,
    });
    game.recordWar?.(attacker.id, defender.id, { tilesCaptured: 1, damage: rawCost, biggestWave: wave.capturedTiles.length });
    return true;
  }

  resistWave(game, wave, candidate, cost, adjustedCost = cost) {
    const tile = candidate.tile;
    const now = game.now();
    const progress = this.applyAttackPressure(game, wave, candidate, cost, now);
    const needed = Math.max(0, adjustedCost - progress.spent);
    const reason = this.defenseReason(game, wave, candidate, cost);
    this.pushEvent({
      kind: "waveResist",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      amount: Math.round(needed),
      progress: Math.round(progress.progress),
      cost: Math.round(progress.cost),
      remainingBudget: Math.round(wave.remainingBudget),
      reason,
      playerId: wave.attackerId,
      targetOwner: wave.defenderId,
      at: now,
    });
    this.finishWave(
      game,
      wave,
      `Border weakened ${Math.round(progress.progress)}/${Math.round(progress.cost)}. ${needed > 0 ? `Need about ${Math.round(needed)} more energy. ` : ""}${reason}`,
    );
  }

  finishWave(game, wave, reason) {
    wave.status = "finished";
    wave.finished = true;
    this.syncWaveBudget(wave);
    this.pushEvent({
      kind: "waveEnd",
      waveId: wave.id,
      playerId: wave.attackerId,
      targetOwner: wave.defenderId,
      captured: wave.capturedTiles.length,
      weakened: (wave.weakenedTiles || []).length,
      remaining: Math.round(wave.remainingPower),
      remainingBudget: Math.round(wave.remainingBudget),
      status: wave.status,
      message: reason,
      at: game.now(),
    });
  }

  syncWaveBudget(wave) {
    wave.remainingPower = Math.max(0, Number(wave.remainingPower || 0));
    wave.remainingBudget = wave.remainingPower;
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
    cost += Math.min(5, type.defenseBonus) * COMBAT_FORMULA.terrainDefenseMultiplier;
    cost += this.effectiveDefenseEnergy(defender, tile) * COMBAT_FORMULA.defenseEnergyMultiplier;
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
      cost += game.core?.defenseBonus(defender, tile, game.now()) || 0;
      const defenderTerritoryPct = this.territoryPct(game, defender);
      if (defenderTerritoryPct > (balance.empireDefenseSoftTerritoryPct || 0.22)) {
        const over = defenderTerritoryPct - (balance.empireDefenseSoftTerritoryPct || 0.22);
        cost *= 1 - Math.min(balance.empireDefenseMaxPenalty || 0.1, over * 0.32);
      }
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
    cost *= game.specials?.waveCostMultiplier(defender, tile, game.now()) || 1;
    if (!rough && wave.remainingPower / Math.max(1, wave.spentEnergy) < 0.18) cost *= COMBAT_FORMULA.lowPowerFatigueMultiplier;

    const pressure = this.attackPressure(tile, attacker.id);
    return Math.max(4, cost - (rough ? pressure * 0.65 : 0));
  }

  attackPressure(tile, attackerId) {
    if (!tile?.owner || !attackerId || tile.owner === attackerId) return 0;
    return Math.max(0, Number(tile.captureProgress?.[attackerId] || 0));
  }

  applyAttackPressure(game, wave, candidate, cost, now = game.now()) {
    const tile = candidate.tile;
    const attackerId = wave.attackerId;
    const current = this.attackPressure(tile, attackerId);
    const maxProgress = cost * (PRESSURE.maxProgressRatio || 0.95);
    const spend = Math.min(wave.remainingPower, Math.max(0, cost - current));
    const progress = Math.min(maxProgress, current + spend);
    tile.captureProgress = tile.captureProgress || {};
    tile.captureProgress[attackerId] = progress;
    tile.defenseEnergy = Math.max(0, (tile.defenseEnergy || 0) - spend * (PRESSURE.defenseDamageMultiplier || 0.22));
    tile.lastChanged = now;
    wave.remainingPower = Math.max(0, wave.remainingPower - spend);
    wave.weakenedTiles = wave.weakenedTiles || [];
    if (!wave.weakenedTiles.includes(tile.id)) wave.weakenedTiles.push(tile.id);
    wave.status = "stalled";
    this.syncWaveBudget(wave);
    this.pushEvent({
      kind: "borderWeakened",
      waveId: wave.id,
      from: candidate.from,
      to: tile.id,
      playerId: attackerId,
      targetOwner: wave.defenderId,
      progress: Math.round(progress),
      cost: Math.round(cost),
      amount: Math.round(spend),
      remainingBudget: Math.round(wave.remainingBudget),
      at: now,
    });
    return { progress, cost, spent: spend };
  }

  clearAttackPressure(tile, amount = Infinity, defenderId = null) {
    if (!tile?.captureProgress || !tile.owner) return;
    Object.keys(tile.captureProgress).forEach((key) => {
      if (key === defenderId || key === tile.owner) return;
      tile.captureProgress[key] = Math.max(0, Number(tile.captureProgress[key] || 0) - amount);
      if (tile.captureProgress[key] <= 0.5) delete tile.captureProgress[key];
    });
  }

  defenseReason(game, wave, candidate, cost) {
    const tile = candidate.tile;
    const defender = game.getPlayer(wave.defenderId);
    const type = config.TILE_TYPES[tile.type];
    const reasons = [];
    if ((tile.defenseEnergy || 0) >= 24) reasons.push("Reinforced border absorbed part of the wave.");
    if ((type?.defenseBonus || 0) >= 2 || tile.type === "reeds" || tile.type === "mud") reasons.push("High terrain defense.");
    if (tile.building) reasons.push("Building defense is increasing the break cost.");
    if (defender?.animal === "turtle" && game.now() < (defender.abilityActiveUntil || 0)) reasons.push("Turtle Shell Guard reduced the attack.");
    if (defender?.energy > defender?.maxEnergy * 0.7) reasons.push("Enemy has high stored Animal Energy.");
    if (!reasons.length) reasons.push(`Try Strong Push or send about ${Math.ceil(cost)} total pressure.`);
    return reasons[0];
  }

  effectiveDefenseEnergy(defender, tile) {
    const cap = defender?.animal === "turtle" ? balance.turtleDefendMaxEnergy || 72 : balance.defendMaxEnergy || 56;
    return Math.max(0, Math.min(cap, Number(tile?.defenseEnergy || 0)));
  }

  decayCombatState(game, now) {
    const interval = PRESSURE.decayIntervalSeconds || 2;
    if (!this.lastCombatDecayAt) {
      this.lastCombatDecayAt = now;
      return;
    }
    const dt = now - this.lastCombatDecayAt;
    if (dt < interval) return;
    this.lastCombatDecayAt = now;
    const pressureDecay = Math.max(0, PRESSURE.decayPerSecond || 0.5) * dt;
    const defenseDecay = Math.max(0, balance.defenseDecayPerSecond || 0.45) * dt;
    const defenseDelay = balance.defenseDecayDelaySeconds || 8;
    this.tileManager.playable().forEach((tile) => {
      if (tile.owner && tile.captureProgress) {
        Object.keys(tile.captureProgress).forEach((attackerId) => {
          if (attackerId === tile.owner) return;
          tile.captureProgress[attackerId] = Math.max(0, Number(tile.captureProgress[attackerId] || 0) - pressureDecay);
          if (tile.captureProgress[attackerId] <= 0.5) delete tile.captureProgress[attackerId];
        });
      }
      if ((tile.defenseEnergy || 0) > 0 && now - (tile.lastDefendedAt || tile.lastChanged || 0) >= defenseDelay) {
        tile.defenseEnergy = Math.max(0, tile.defenseEnergy - defenseDecay);
      }
    });
  }

  defend(player, tileId, percent, now = Date.now() / 1000) {
    const tile = this.tileManager.getById(tileId);
    if (!tile || tile.owner !== player.id) return { ok: false, message: "Choose your territory to defend." };
    if (now < (player.defendCooldownUntil || 0)) {
      return { ok: false, resultType: "defendCooldown", message: `Reinforce cooldown ${Math.ceil(player.defendCooldownUntil - now)}s.` };
    }
    const spend = this.spendEnergy(player, percent) * balance.defendSpendMultiplier;
    if (spend < 3) return { ok: false, message: "Not enough Animal Energy. Defending needs at least 3 energy." };
    player.energy -= spend;
    player.stats.energyUsed += spend;
    player.stats.defenses = (player.stats.defenses || 0) + 1;
    const animalBoost = player.animal === "turtle" ? balance.turtleDefendMultiplier || 1.16 : 1;
    const shellBoost = player.animal === "turtle" && now < (player.abilityActiveUntil || 0) ? 1.18 : 1;
    const maxDefense = player.animal === "turtle" ? balance.turtleDefendMaxEnergy || 72 : balance.defendMaxEnergy || 56;
    tile.defenseEnergy = Math.min(maxDefense, tile.defenseEnergy + spend * balance.defendEnergyMultiplier * animalBoost * shellBoost);
    this.clearAttackPressure(tile, spend * 0.9, player.id);
    player.defendCooldownUntil = now + (balance.defendCooldownSeconds || 10);
    tile.lastDefendedAt = now;
    tile.lastChanged = now;
    this.pushEvent({ kind: "defend", to: tile.id, amount: Math.round(spend), playerId: player.id, defense: Math.round(tile.defenseEnergy), cooldown: balance.defendCooldownSeconds || 10, at: now });
    return {
      ok: true,
      resultType: "reinforced",
      defenseEnergy: Math.round(tile.defenseEnergy),
      cooldown: balance.defendCooldownSeconds || 10,
      message: `Border reinforced: ${Math.round(tile.defenseEnergy)} stored defense energy. Attack pressure was reduced.`,
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
      const duration = Math.round((animal.duration + ((player.level || 1) >= 3 ? balance.level3DuckDurationBonus || 4 : 0)) * (player.flags?.modifierAbilityPower ? 1.2 : 1));
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
      player.abilityActiveUntil = now + Math.round(animal.duration * (player.flags?.modifierAbilityPower ? 1.2 : 1));
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
      player.abilityActiveUntil = now + Math.round(animal.duration * (player.flags?.modifierAbilityPower ? 1.2 : 1));
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
      player.abilityActiveUntil = now + Math.round(animal.duration * (player.flags?.modifierAbilityPower ? 1.2 : 1));
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

    const clusterSize =
      (balance.frogBigLeapClusterSize || 5) +
      ((player.level || 1) >= 3 ? balance.level3FrogLeapBonus || 2 : 0) +
      (player.flags?.modifierAbilityPower ? 2 : 0);
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
    cost += Math.min(5, type.defenseBonus) * COMBAT_FORMULA.terrainDefenseMultiplier;
    cost += this.effectiveDefenseEnergy(defender, target) * COMBAT_FORMULA.defenseEnergyMultiplier;
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
    const territoryPct = this.territoryPct(game, player);
    const comebackThreshold = balance.comebackTerritoryPct || 0.08;
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
      comebackCore: this.nearCore(player, target) && territoryPct < comebackThreshold,
      comebackSmall: target.neighbors.some((neighbor) => neighbor.owner === player.id) && territoryPct < comebackThreshold,
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
    cooldown *= Math.max(0.1, Number(player.flags?.modifierAbilityCooldownMultiplier || 1));
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
    const animalBoost = owner?.animal === "turtle" ? balance.turtleReedGuardMultiplier || 1.16 : 1;
    const now = Date.now() / 1000;
    const total = [target, ...target.neighbors].reduce((sum, tile) => {
      if (tile.owner !== ownerId || tile.building !== "reedGuard") return sum;
      if (tile.buildingActiveAt && tile.buildingActiveAt > now) return sum;
      const conversionMultiplier = tile.buildingConversionUntil && now < tile.buildingConversionUntil ? balance.capturedBuildingEffectMultiplier || 0.5 : 1;
      return sum + 4.5 * Math.max(1, Number(tile.buildingLevel) || 1) * animalBoost * conversionMultiplier;
    }, 0);
    return Math.min(owner?.animal === "turtle" ? 18 : 14, total);
  }
}

module.exports = CombatManager;
