const config = require("../shared/gameConfig");
const balance = config.BALANCE;

class BotManager {
  constructor(game) {
    this.game = game;
    this.timers = new Map();
    this.expansionTargets = new Map();
  }

  update(dt) {
    this.game.players.forEach((bot) => {
      if (!bot.isBot || bot.defeated) return;
      const elapsed = (this.timers.get(bot.id) || 0) + dt;
      const animalPace = bot.animal === "duck" ? 0.9 : bot.animal === "snake" ? 1.08 : 0.98;
      const pace = (bot.difficulty === "smart" ? 0.72 : bot.difficulty === "easy" ? 1.45 : 1) * animalPace;
      if (elapsed < pace) {
        this.timers.set(bot.id, elapsed);
        return;
      }
      this.timers.set(bot.id, 0);
      this.takeTurn(bot);
    });
  }

  takeTurn(bot) {
    if (bot.energy < 8) return;
    const phase = this.phase();
    const enemy = this.game.tileManager
      .capturable(bot.id)
      .filter((tile) => tile.owner && tile.owner !== bot.id && !this.game.diplomacy.areAllied(bot.id, tile.owner));

    if (this.nearWinning(bot)) this.breakWeakAlliances(bot);

    const abilityDecision = this.abilityDecision(bot, phase, enemy);
    if (abilityDecision.use) {
      const result = this.game.combat.activateAbility(this.game, bot, {
        targetTileId: abilityDecision.targetId,
        reason: abilityDecision.reason,
      });
      this.debugAbilityDecision(bot, abilityDecision, result);
    }

    if (this.shouldDefend(bot, enemy, phase)) {
      if (this.tryDefend(bot)) return;
    }

    const objectiveTarget = this.pickObjectiveTarget(bot, phase);
    if (objectiveTarget) {
      if (!objectiveTarget.owner && this.tryExpandNeutral(bot, objectiveTarget)) return;
      if (objectiveTarget.owner && objectiveTarget.owner !== bot.id && !this.game.diplomacy.areAllied(bot.id, objectiveTarget.owner)) {
        this.launchAttack(bot, objectiveTarget, phase);
        return;
      }
    }

    const attackTarget = this.pickAttack(bot, enemy, phase);
    if (attackTarget && this.shouldAttack(bot, this.game.getPlayer(attackTarget.owner), phase)) {
      this.launchAttack(bot, attackTarget, phase);
      return;
    }

    if (bot.energy > bot.maxEnergy * 0.55 && Math.random() < this.buildChance(bot, phase)) {
      if (this.tryBuild(bot)) return;
    }

    const neutral = this.game.tileManager.capturable(bot.id).filter((tile) => !tile.owner);

    if (neutral.length && this.shouldExpand(bot, phase)) {
      const target = this.pickNeutralExpansion(bot, neutral);
      if (target && this.tryExpandNeutral(bot, target)) return;
      if (target) return;
    }

    const progressTarget = this.pickNeutralExpansion(bot, neutral);
    if (progressTarget && (progressTarget.captureProgress?.[bot.id] || 0) > 0) {
      if (this.tryExpandNeutral(bot, progressTarget)) return;
      return;
    }

    const lateAttackTarget = this.pickAttack(bot, enemy, phase);
    if (lateAttackTarget && this.shouldAttack(bot, this.game.getPlayer(lateAttackTarget.owner), phase, true)) {
      this.launchAttack(bot, lateAttackTarget, phase);
      return;
    }

    if (Math.random() < (phase === "early" ? 0.08 : 0.04)) this.tryAlliance(bot);
  }

  phase() {
    const elapsed = this.game.elapsed();
    if (elapsed >= balance.finalSurgeTime) return "surge";
    if (elapsed >= balance.lateGameTime) return "late";
    if (elapsed >= balance.midGameTime) return "mid";
    return "early";
  }

  shouldExpand(bot, phase) {
    const animalPush = bot.animal === "duck" ? 0.12 : bot.animal === "frog" ? 0.06 : -0.03;
    const eventPush = this.game.eventsManager?.isActive("rainstorm") ? 0.22 : this.game.eventsManager?.isActive("lilyBloom") && bot.animal === "frog" ? 0.16 : 0;
    if (phase === "early") return bot.territory < 68 || bot.energy < bot.maxEnergy * 0.72 || Math.random() < 0.42 + animalPush + eventPush;
    if (bot.personality === "expander" && bot.territory < 110 && Math.random() < 0.55) return true;
    if (bot.personality === "objectiveHunter" && phase !== "early" && Math.random() < 0.38) return true;
    if (bot.personality === "defensive" && bot.energy < bot.maxEnergy * 0.5) return true;
    return Math.random() < (phase === "mid" ? 0.28 : 0.14) + animalPush * 0.5 + eventPush;
  }

  buildChance(bot, phase) {
    const base = phase === "early" ? 0.34 : phase === "mid" ? 0.22 : 0.13;
    const animal = bot.animal === "snake" ? 0.05 : bot.animal === "frog" ? 0.03 : 0;
    if (bot.personality === "defensive") return base + 0.12;
    if (bot.personality === "aggressive") return base - 0.1;
    return base + animal;
  }

  bestTile(bot, tiles) {
    return tiles
      .map((tile) => ({ tile, score: this.tileScore(bot, tile) + Math.random() * 2 }))
      .sort((a, b) => b.score - a.score)[0].tile;
  }

  pickNeutralExpansion(bot, tiles) {
    const rememberedId = this.expansionTargets.get(bot.id);
    const remembered = rememberedId ? this.game.tileManager.getById(rememberedId) : null;
    if (remembered && !remembered.owner && tiles.some((tile) => tile.id === remembered.id)) return remembered;

    const withProgress = tiles
      .filter((tile) => (tile.captureProgress?.[bot.id] || 0) > 0)
      .sort((a, b) => (b.captureProgress?.[bot.id] || 0) - (a.captureProgress?.[bot.id] || 0))[0];
    return withProgress || (tiles.length ? this.bestTile(bot, tiles) : null);
  }

  pickObjectiveTarget(bot, phase) {
    if (phase === "early" && !this.game.objectives?.objectives?.some((objective) => objective.active)) return null;
    const capturable = this.game.tileManager
      .capturable(bot.id)
      .filter((tile) => tile.objectiveId || tile.campId)
      .filter((tile) => !tile.owner || (tile.owner !== bot.id && !this.game.diplomacy.areAllied(bot.id, tile.owner)));
    if (!capturable.length) return null;
    const chance =
      bot.personality === "objectiveHunter"
        ? 0.78
        : bot.personality === "peacefulFarmer"
          ? 0.38
          : bot.animal === "frog"
            ? 0.58
            : 0.48;
    if (Math.random() > chance) return null;
    return capturable
      .map((tile) => ({ tile, score: this.tileScore(bot, tile) + (tile.objectiveId ? 18 : 9) - (tile.owner ? this.roughAttackCost(tile, this.game.getPlayer(tile.owner)) * 0.18 : 0) }))
      .sort((a, b) => b.score - a.score)[0]?.tile || null;
  }

  tryExpandNeutral(bot, target) {
    const cost = this.game.combat.neutralCaptureCost(this.game, bot, target, {});
    const progress = target.captureProgress?.[bot.id] || 0;
    const remaining = Math.max(0, cost - progress);
    if (remaining <= 0) {
      this.expansionTargets.delete(bot.id);
      return false;
    }

    const hasProgress = progress > 0;
    if (!hasProgress && bot.energy < remaining) {
      this.expansionTargets.set(bot.id, target.id);
      this.debugExpansion(bot, target, cost, 0, { ok: false, resultType: "waiting" });
      return true;
    }
    if (hasProgress && bot.energy < Math.min(remaining, 4)) {
      this.expansionTargets.set(bot.id, target.id);
      this.debugExpansion(bot, target, cost, 0, { ok: false, resultType: "saving" });
      return true;
    }

    const desiredSpend = hasProgress ? Math.min(bot.energy, remaining) : remaining;
    const percent = Math.max(0.04, Math.min(1, desiredSpend / Math.max(1, bot.energy)));
    const plannedSpend = Math.min(bot.energy, desiredSpend);
    const result = this.game.combat.expandOrAttack(this.game, bot, target.id, percent);
    this.debugExpansion(bot, target, cost, plannedSpend, result);

    if (result.resultType === "partial") this.expansionTargets.set(bot.id, target.id);
    else this.expansionTargets.delete(bot.id);
    return true;
  }

  pickAttack(bot, tiles, phase = "early") {
    const leader = this.leader();
    const candidates = tiles
      .map((tile) => {
        const owner = this.game.getPlayer(tile.owner);
        if (!owner || owner.defeated) return null;
        const pressure = owner.energy / Math.max(1, owner.maxEnergy);
        const exposed = tile.neighbors.filter((neighbor) => neighbor.owner === bot.id).length;
        const roughCost = this.roughAttackCost(tile, owner);
        const threat = this.threatScore(owner, leader);
        const energyEdge = Math.max(0, bot.energy - owner.energy);
        if (owner.energy > bot.energy * 1.55 && !bot.enemies.has(owner.id) && exposed < 2 && phase !== "surge") return null;
        return {
          tile,
          owner,
          score:
            this.tileScore(bot, tile) +
            exposed * 4 +
            energyEdge * 0.06 +
            threat * balance.leaderThreatMultiplier +
            this.personalityAttackBonus(bot, owner, phase) -
            roughCost * 0.28 -
            pressure * 3,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    return candidates[0]?.tile || null;
  }

  shouldAttack(bot, owner, phase, fallback = false) {
    if (!owner) return false;
    if (this.game.now() < (bot.aiAttackCooldownUntil || 0)) return false;
    const energyRatio = bot.energy / Math.max(1, bot.maxEnergy);
    const threshold = bot.personality === "aggressive" ? 0.3 : bot.personality === "opportunist" ? 0.34 : balance.botAttackEnergyThreshold;
    if (energyRatio < threshold && !fallback) return false;
    if (phase === "early" && bot.personality !== "aggressive" && Math.random() > 0.2) return false;
    if (owner.energy < bot.energy * 0.78) return Math.random() < (phase === "early" ? 0.28 : 0.68);
    if (this.leader()?.id === owner.id && phase !== "early") return Math.random() < 0.82;
    const phaseChance = phase === "mid" ? 0.46 : phase === "late" ? 0.64 : phase === "surge" ? 0.78 : 0.18;
    const personality = bot.personality === "aggressive" ? 0.22 : bot.personality === "opportunist" ? 0.15 : bot.personality === "defensive" ? -0.14 : 0;
    return Math.random() < Math.max(0.05, Math.min(0.92, phaseChance + personality));
  }

  launchAttack(bot, tile, phase) {
    const owner = this.game.getPlayer(tile.owner);
    const weak = owner && owner.energy < bot.energy * 0.55;
    const leaderTarget = this.leader()?.id === tile.owner;
    let percent = 0.25;
    if (bot.personality === "aggressive") percent = phase === "early" ? 0.25 : 0.42;
    if (bot.personality === "opportunist" && weak) percent = 0.5;
    if (bot.personality === "defensive") percent = 0.22;
    if (leaderTarget && phase !== "early") percent = Math.max(percent, 0.45);
    if (weak && phase === "surge") percent = 0.62;
    this.game.combat.expandOrAttack(this.game, bot, tile.id, Math.min(0.75, percent));
    const baseCooldown = phase === "early" ? 9 : phase === "mid" ? 6 : phase === "late" ? 4.5 : 3.5;
    const personality =
      bot.personality === "aggressive" ? 0.72 : bot.personality === "opportunist" ? 0.86 : bot.personality === "defensive" ? 1.35 : 1;
    bot.aiAttackCooldownUntil = this.game.now() + baseCooldown * personality;
  }

  tryBuild(bot) {
    const order =
      bot.animal === "snake"
        ? ["mudTunnel", "reedGuard", "lilyFarm", "nest"]
        : bot.animal === "frog"
          ? ["jumpPad", "lilyFarm", "reedGuard", "nest"]
          : ["nest", "lilyFarm", "reedGuard"];

    const owned = this.game.tileManager.owned(bot.id).filter((tile) => !tile.building);
    for (const buildingType of order) {
      const building = config.BUILDINGS[buildingType];
      const cost = this.game.economy.buildingCost(bot, buildingType);
      if (bot.energy < cost) continue;
      const tile = owned.find((candidate) => this.game.economy.canBuild(bot, candidate, buildingType));
      if (tile) {
        const result = this.game.economy.build(bot, tile, buildingType, this.game.now());
        if (result.ok) {
          this.game.pushEvent({ kind: "buildComplete", playerId: bot.id, to: tile.id, buildingType, at: this.game.now() });
        }
        return result.ok;
      }
    }
    return false;
  }

  tryAlliance(bot) {
    const neighbors = new Set();
    this.game.tileManager.borders(bot.id).forEach((tile) => {
      tile.neighbors.forEach((neighbor) => {
        if (neighbor.owner && neighbor.owner !== bot.id) neighbors.add(neighbor.owner);
      });
    });
    [...neighbors].some((id) => {
      const target = this.game.getPlayer(id);
      if (!target || target.defeated || this.game.diplomacy.areAllied(bot.id, id)) return false;
      if (this.game.territoryPercent(target) > this.game.territoryPercent(bot) * 1.35) {
        this.game.diplomacy.handle(this.game, bot, id, "requestAlliance");
        return true;
      }
      return false;
    });
  }

  breakWeakAlliances(bot) {
    [...bot.allies].forEach((id) => {
      const ally = this.game.getPlayer(id);
      if (!ally || this.game.territoryPercent(bot) > 0.52) this.game.diplomacy.handle(this.game, bot, id, "breakAlliance");
    });
  }

  shouldUseAbility(bot, phase, enemyTiles = []) {
    return this.abilityDecision(bot, phase, enemyTiles).use;
  }

  abilityDecision(bot, phase, enemyTiles = []) {
    if (this.game.now() < bot.abilityReadyAt || bot.energy < bot.maxEnergy * 0.28) {
      return { use: false, reason: "cooldown or low energy" };
    }
    const neutral = this.game.tileManager.capturable(bot.id).filter((tile) => !tile.owner);
    if (bot.animal === "duck") {
      const waterTargets = neutral.filter((tile) => tile.type === "water").length;
      const chance = phase === "early" ? 0.55 : phase === "mid" ? 0.34 : 0.24;
      const use = waterTargets >= 4 && Math.random() < chance;
      return { use, reason: use ? `${waterTargets} open-water expansion targets` : "not enough open water" };
    }
    if (bot.animal === "snake") {
      const ambushTargets = enemyTiles.filter((tile) =>
        tile.neighbors.some((neighbor) => neighbor.owner === bot.id && (neighbor.type === "reeds" || neighbor.type === "mud")),
      );
      const reedFront = this.game.tileManager.borders(bot.id).filter((tile) => tile.type === "reeds" || tile.type === "mud").length;
      const chance = phase === "early" ? 0.18 : phase === "mid" ? 0.5 : 0.58;
      const use = enemyTiles.length > 0 && (ambushTargets.length > 0 || reedFront >= 3) && bot.energy > bot.maxEnergy * 0.34 && Math.random() < chance;
      return {
        use,
        targetId: ambushTargets[0]?.id || enemyTiles[0]?.id,
        reason: use ? `${ambushTargets.length} reed/mud ambush targets` : "no good ambush border",
      };
    }
    if (bot.animal === "frog") {
      const valuableLeapTargets = neutral.filter((tile) => tile.type === "lily" || tile.type === "nest").length;
      const blockedAngles = neutral.filter((tile) => tile.neighbors.some((neighbor) => config.TILE_TYPES[neighbor.type]?.blocks)).length;
      const best = neutral
        .slice()
        .sort((a, b) => this.tileScore(bot, b) - this.tileScore(bot, a))[0];
      const use = (valuableLeapTargets >= 2 || neutral.length >= 8 || blockedAngles >= 2) && Math.random() < (phase === "early" ? 0.36 : 0.46);
      return {
        use,
        targetId: best?.id,
        reason: use ? `${valuableLeapTargets} valuable leap targets, ${blockedAngles} blocked angles` : "no valuable leap cluster",
      };
    }
    return { use: false, reason: "unknown animal" };
  }

  nearWinning(bot) {
    return this.game.territoryPercent(bot) > 0.5;
  }

  tileScore(bot, tile) {
    const type = config.TILE_TYPES[tile.type];
    let score = 6 + type.incomeBonus * 25 + type.defenseBonus;
    if (bot.animal === "duck" && tile.type === "water") score += 4;
    if (bot.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) score += 5;
    if (bot.animal === "frog" && tile.type === "lily") score += 6;
    if (this.game.eventsManager?.isActive("lilyBloom") && tile.type === "lily") score += bot.animal === "frog" ? 9 : 4;
    if (this.game.eventsManager?.isActive("mudslide") && tile.type === "mud" && bot.animal === "snake") score += 6;
    if (tile.type === "nest") score += 3;
    if (tile.objectiveId) score += bot.personality === "objectiveHunter" ? 24 : 16;
    if (tile.campId) score += 8;
    return score;
  }

  roughAttackCost(tile, owner) {
    const type = config.TILE_TYPES[tile.type];
    let cost = tile.building ? 18 : tile.type === "water" ? 6 : tile.type === "lily" ? 8 : tile.type === "reeds" ? 12 : tile.type === "mud" ? 14 : 16;
    cost += type.defenseBonus * 1.25 + tile.defenseEnergy * 0.8;
    cost += Math.min(18, owner.energy * 0.035);
    return cost;
  }

  shouldDefend(bot, enemyTiles, phase) {
    if (!enemyTiles.length || bot.energy < 18) return false;
    const base = bot.personality === "defensive" ? 0.28 : 0.1;
    const phaseBoost = phase === "early" ? 0 : phase === "mid" ? 0.05 : 0.1;
    return Math.random() < base + phaseBoost;
  }

  tryDefend(bot) {
    const border = this.game.tileManager
      .borders(bot.id)
      .filter((tile) => tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== bot.id))
      .sort((a, b) => a.defenseEnergy - b.defenseEnergy)[0];
    if (!border) return false;
    const result = this.game.combat.defend(bot, border.id, bot.personality === "defensive" ? 0.34 : 0.24);
    return result.ok;
  }

  leader() {
    return this.game.players
      .filter((player) => !player.defeated)
      .slice()
      .sort((a, b) => b.territory - a.territory)[0];
  }

  threatScore(player, leader) {
    const territory = this.game.territoryPercent(player);
    const winProgress = territory / config.WIN_CONTROL;
    const incomeRank = player.income / Math.max(1, Math.max(...this.game.players.map((candidate) => candidate.income || 0)));
    const leaderBonus = leader?.id === player.id ? 0.3 : 0;
    return territory + incomeRank * 0.25 + winProgress * 0.35 + leaderBonus;
  }

  personalityAttackBonus(bot, owner, phase) {
    let bonus = 0;
    if (bot.personality === "aggressive") bonus += 6;
    if (bot.personality === "opportunist" && owner.energy < bot.energy) bonus += 7;
    if (bot.personality === "betrayer" && phase !== "early" && owner.territory > bot.territory * 0.85) bonus += 4;
    if (bot.personality === "defensive") bonus -= 3;
    return bonus;
  }

  debugExpansion(bot, target, cost, sent, result) {
    if (process.env.NODE_ENV !== "development") return;
    console.log(
      `[bot-expand] ${bot.name} tile=${target.id} cost=${cost} sent=${Math.round(sent)} result=${result.resultType || result.message || "unknown"}`,
    );
  }

  debugAbilityDecision(bot, decision, result) {
    if (process.env.NODE_ENV !== "development") return;
    console.log(
      `[bot-ability] ${bot.name} ${bot.animal} ability reason="${decision.reason}" target=${decision.targetId ?? "none"} result=${result.message}`,
    );
  }
}

module.exports = BotManager;
