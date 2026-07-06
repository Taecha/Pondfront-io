const config = require("../shared/gameConfig");
const balance = config.BALANCE;
const botDifficultyConfig = require("../shared/botDifficultyConfig");

class BotManager {
  constructor(game) {
    this.game = game;
    this.timers = new Map();
    this.expansionTargets = new Map();
    this.borderContacts = new Map();
  }

  update(dt) {
    if (this.game.sandbox?.enabled && this.game.sandbox.botsPaused) return;
    const started = Date.now();
    let thinkers = 0;
    this.game.players.forEach((bot) => {
      if (!bot.isBot || bot.defeated) return;
      const mode = this.sandboxMode(bot);
      if (mode === "passive") return;
      const now = this.game.now();
      const paceByAnimal = balance.botAnimalTurnPace || {};
      const animalPace = paceByAnimal[bot.animal] || 1;
      if (!bot.aiNextThinkAt) {
        bot.aiNextThinkAt = now + this.thinkDelay(bot, animalPace) * (0.45 + Math.random() * 0.9);
        return;
      }
      if (now < bot.aiNextThinkAt) {
        return;
      }
      thinkers += 1;
      this.takeTurn(bot);
      bot.aiNextThinkAt = now + this.thinkDelay(bot, animalPace);
    });
    if (this.game.metrics) {
      this.game.metrics.lastBotThinkMs = Date.now() - started;
      this.game.metrics.lastBotThinkers = thinkers;
    }
  }

  difficultyProfile(bot) {
    return botDifficultyConfig[bot?.difficulty] || botDifficultyConfig.normal;
  }

  randomRange(range, fallback = [4, 8]) {
    const source = Array.isArray(range) ? range : fallback;
    const min = Number(source[0] ?? fallback[0] ?? 0);
    const max = Number(source[1] ?? source[0] ?? fallback[1] ?? min);
    return min + Math.random() * Math.max(0, max - min);
  }

  thinkDelay(bot, animalPace = 1) {
    const profile = this.difficultyProfile(bot);
    const interval = profile.thinkInterval || [profile.turnPaceMultiplier || 1, profile.turnPaceMultiplier || 1.4];
    const base = this.randomRange(interval, [1, 1.8]);
    return Math.max(0.25, base * animalPace);
  }

  takeTurn(bot) {
    const phase = this.phase();
    const now = this.game.now();
    const profile = this.difficultyProfile(bot);
    if (bot.difficulty === "passive" || profile.label === "Passive") return;
    if (this.trySandboxLimitedTurn(bot, phase)) return;
    if (bot.energy < 8) return;
    const enemy = this.game.tileManager
      .capturable(bot.id)
      .filter((tile) => tile.owner && tile.owner !== bot.id && this.game.diplomacy.canAttack(bot.id, tile.owner, now).ok);
    this.updateBorderContacts(bot, enemy);
    if (this.trySurrender(bot, phase)) return;
    if (this.shouldSurvive(bot) && this.trySurvivalTurn(bot, enemy, phase)) return;

    if (this.tryEnergySupport(bot, phase)) return;
    if (this.tryTeamCommand(bot, phase)) return;
    if (this.tryTeamSupport(bot, phase)) return;

    if (this.nearWinning(bot)) this.breakWeakAlliances(bot);
    if (bot.personality === "betrayer" && phase !== "early" && Math.random() < 0.08) this.breakWeakAlliances(bot);
    if (phase !== "early" && Math.random() < (bot.personality === "peaceful" ? 0.14 : 0.05)) this.tryTruce(bot, phase);
    if (Math.random() < (phase === "early" ? 0.16 : bot.personality === "loyalAlly" || bot.personality === "peaceful" ? 0.16 : 0.06)) this.tryAlliance(bot, phase);

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

    if (this.trySpecial(bot, phase, enemy)) return;

    const retaliationTarget = this.pickRetaliation(bot, enemy, phase);
    if (retaliationTarget && this.shouldAttack(bot, this.game.getPlayer(retaliationTarget.owner), phase, true, retaliationTarget)) {
      this.launchAttack(bot, retaliationTarget, phase);
      return;
    }

    const objectiveTarget = this.pickObjectiveTarget(bot, phase);
    if (objectiveTarget) {
      if (!objectiveTarget.owner && this.tryExpandNeutral(bot, objectiveTarget)) return;
      if (
        objectiveTarget.owner &&
        objectiveTarget.owner !== bot.id &&
        this.game.diplomacy.canAttack(bot.id, objectiveTarget.owner, now).ok &&
        this.shouldAttack(bot, this.game.getPlayer(objectiveTarget.owner), phase, true, objectiveTarget)
      ) {
        this.launchAttack(bot, objectiveTarget, phase);
        return;
      }
    }

    const attackTarget = this.pickAttack(bot, enemy, phase);
    if (attackTarget && this.shouldAttack(bot, this.game.getPlayer(attackTarget.owner), phase, false, attackTarget)) {
      this.launchAttack(bot, attackTarget, phase);
      return;
    }

    if (this.trySkirmish(bot, enemy, phase)) return;

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
    if (lateAttackTarget && this.tryWaterRoute(bot, lateAttackTarget, phase)) return;
    if (lateAttackTarget && this.shouldAttack(bot, this.game.getPlayer(lateAttackTarget.owner), phase, true, lateAttackTarget)) {
      this.launchAttack(bot, lateAttackTarget, phase);
      return;
    }

    if (Math.random() < (phase === "early" ? 0.08 : 0.04)) this.tryAlliance(bot, phase);
  }

  tryEnergySupport(bot, phase) {
    if (!this.game.support || bot.energy < bot.maxEnergy * 0.42) return false;
    const now = this.game.now();
    if (now < (bot.aiSupportCooldownUntil || 0) || now < (bot.supportReadyAt || 0)) return false;
    const allies = this.game.players
      .filter((player) => player.id !== bot.id && !player.defeated && this.game.support.canSupport(this.game, bot, player))
      .map((player) => ({
        player,
        score:
          (now < (player.flags?.underAttackUntil || 0) ? 26 : 0) +
          Math.max(0, 1 - player.energy / Math.max(1, player.maxEnergy)) * 22 +
          (player.id === config.HUMAN_ID ? 5 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const target = allies[0]?.player;
    if (!target || allies[0].score < 13) return false;
    const chance = bot.personality === "supporter" || bot.personality === "loyalAlly" ? 0.74 : bot.role === "guardian" ? 0.44 : 0.22;
    if (Math.random() > chance) return false;
    const result = this.game.support.send(this.game, bot, target.id, bot.energy > bot.maxEnergy * 0.75 ? 0.25 : 0.15);
    bot.aiSupportCooldownUntil = now + (result.ok ? 10 : 4);
    return result.ok;
  }

  trySurrender(bot, phase) {
    const surrenderAllowed = this.game.canSurrender?.(bot, { log: false }) || { ok: false, reason: "Surrender is disabled in this match." };
    if (!surrenderAllowed.ok) {
      if (process.env.NODE_ENV === "development" && this.game.now() > (bot.flags?.nextSurrenderBlockLogAt || 0)) {
        bot.flags.nextSurrenderBlockLogAt = this.game.now() + 20;
        this.debugBotAction(bot, "surrender-blocked", {
          difficulty: bot.difficulty,
          energy: Math.round(bot.energy),
          reason: surrenderAllowed.reason,
          cooldown: 0,
        });
        console.log("Surrender blocked by match setting.");
      }
      return false;
    }
    const elapsed = this.game.elapsed();
    if (phase === "early" || elapsed < Math.min(balance.surrenderEarliestTime || 330, 260)) return false;
    if (bot.personality === "betrayer" && Math.random() < 0.7) return false;
    const territoryPct = this.game.territoryPercent(bot);
    const energyRatio = bot.energy / Math.max(1, bot.maxEnergy);
    const coreLost = Boolean(bot.coreLost || bot.flags?.coreLost);
    const recentWar = [...(this.game.wars?.values?.() || [])].some((war) => war.players?.includes(bot.id) && this.game.now() - war.lastAt < 180);
    const directPressure = coreLost || Boolean(bot.flags?.lastAttackerId) || recentWar;
    if (!directPressure && elapsed < 900) return false;
    const active = this.game.players.filter((player) => !player.defeated && player.territory > 0).length;
    const averageTerritory = this.game.players
      .filter((player) => !player.defeated && player.territory > 0)
      .reduce((sum, player) => sum + this.game.territoryPercent(player), 0) / Math.max(1, active);
    const hopeless =
      (coreLost && territoryPct < 0.055 && energyRatio < 0.32) ||
      (territoryPct < (balance.surrenderTerritoryPct || 0.025) && energyRatio < (balance.surrenderEnergyRatio || 0.16)) ||
      (phase !== "mid" && territoryPct < Math.max(0.035, averageTerritory * 0.42) && energyRatio < 0.24) ||
      (elapsed > 900 && territoryPct < Math.max(0.045, averageTerritory * 0.55) && energyRatio < 0.34);
    const chance =
      phase === "surge"
        ? 0.56
        : phase === "late"
          ? 0.34
          : elapsed > 900
            ? 0.42
            : 0.18;
    if (!hopeless || Math.random() > chance) return false;
    const attacker = bot.flags?.lastAttackerId ? this.game.getPlayer(bot.flags.lastAttackerId) : this.leader();
    if (!attacker || attacker.id === bot.id || attacker.defeated) return false;
    const result = this.game.surrenderPlayer(bot, attacker.id, "hopeless bot");
    return result.ok;
  }

  shouldSurvive(bot) {
    const owned = this.game.ownedTileCount(bot);
    const territoryPct = this.game.territoryPercent(bot);
    bot.stats.territoryPeak = Math.max(bot.stats.territoryPeak || 0, owned);
    const lostGround = owned < Math.max(balance.lastStandTriggerTiles || 10, (bot.stats.territoryPeak || owned) * 0.55);
    return Boolean(
      owned > 0 &&
        (owned <= (balance.lastStandTriggerTiles || 10) ||
          (lostGround && territoryPct < (balance.comebackTerritoryPct || 0.08)) ||
          this.game.now() < (bot.flags?.underAttackUntil || 0) ||
          bot.flags?.coreUnderAttack ||
          bot.flags?.lastNestProtection),
    );
  }

  trySurvivalTurn(bot, enemyTiles, phase) {
    const now = this.game.now();
    const core = bot.coreTileId != null ? this.game.tileManager.getById(bot.coreTileId) : null;
    if (this.tryDefendNear(bot, core || this.game.tileManager.owned(bot.id)[0])) {
      this.debugBotAction(bot, "survival-defend", { difficulty: bot.difficulty, energy: Math.round(bot.energy), reason: "protect core", cooldown: Math.round(Math.max(0, (bot.aiDefendCooldownUntil || 0) - now)) });
      return true;
    }
    if (this.trySurvivalAbility(bot, core)) return true;
    if (this.trySurvivalSpecial(bot, core, enemyTiles)) return true;
    if (bot.energy > bot.maxEnergy * 0.38 && this.tryBuild(bot)) {
      this.debugBotAction(bot, "survival-build", { difficulty: bot.difficulty, energy: Math.round(bot.energy), reason: "recover defense", cooldown: 0 });
      return true;
    }
    const retaliation = this.pickRetaliation(bot, enemyTiles, phase) || enemyTiles.sort((a, b) => this.roughAttackCost(a, this.game.getPlayer(a.owner)) - this.roughAttackCost(b, this.game.getPlayer(b.owner)))[0];
    if (retaliation && bot.energy > bot.maxEnergy * 0.34 && this.launchAttack(bot, retaliation, phase)) {
      this.debugBotAction(bot, "survival-counter", { difficulty: bot.difficulty, energy: Math.round(bot.energy), target: retaliation.id, reason: "weak nearby border", cooldown: Math.round(Math.max(0, (bot.aiAttackCooldownUntil || 0) - now)) });
      return true;
    }
    const neutral = this.game.tileManager.capturable(bot.id).filter((tile) => !tile.owner);
    const preferredNeutral = neutral.filter((tile) => this.survivalExpansionTile(bot, tile));
    const escapeTarget = this.pickNeutralExpansion(bot, preferredNeutral.length ? preferredNeutral : neutral);
    if (escapeTarget && this.tryExpandNeutral(bot, escapeTarget)) {
      this.debugBotAction(bot, "survival-expand", { difficulty: bot.difficulty, energy: Math.round(bot.energy), target: escapeTarget.id, reason: "recover territory", cooldown: Math.round(Math.max(0, (bot.aiExpandCooldownUntil || 0) - now)) });
      return true;
    }
    return false;
  }

  survivalExpansionTile(bot, tile) {
    if (!tile) return false;
    if (bot.animal === "duck") return tile.type === "water";
    if (bot.animal === "snake") return tile.type === "reeds" || tile.type === "mud";
    if (bot.animal === "frog") return tile.type === "lily" || tile.type === "water";
    if (bot.animal === "carp") return tile.type === "water" || tile.type === "lily";
    return tile.type === "mud" || tile.type === "nest" || tile.type === "reeds";
  }

  trySurvivalAbility(bot, core = null) {
    if (!this.game.combat || this.game.now() < (bot.abilityReadyAt || 0) || bot.energy < 18) return false;
    const useful =
      bot.animal === "turtle" ||
      bot.animal === "carp" ||
      bot.animal === "frog" ||
      (bot.animal === "snake" && this.game.now() < (bot.flags?.underAttackUntil || 0)) ||
      (bot.animal === "duck" && this.game.tileManager.capturable(bot.id).some((tile) => !tile.owner && tile.type === "water"));
    if (!useful) return false;
    const result = this.game.combat.activateAbility(this.game, bot, { targetTileId: core?.id, reason: "survival" });
    this.debugAbilityDecision(bot, { use: true, reason: "survival", targetId: core?.id }, result);
    return result.ok;
  }

  trySurvivalSpecial(bot, core = null, enemyTiles = []) {
    if (!this.game.specials || this.game.sandbox?.rules?.specials === false) return false;
    if (bot.energy < 90 || this.game.now() < (bot.aiSpecialCooldownUntil || 0)) return false;
    const border = this.game.tileManager
      .borders(bot.id)
      .sort((a, b) => (core ? Math.abs(a.x - core.x) + Math.abs(a.y - core.y) - (Math.abs(b.x - core.x) + Math.abs(b.y - core.y)) : 0))[0];
    const type = enemyTiles.length ? "reedShield" : "dragonflyGuard";
    const target = type === "reedShield" ? border : core || border;
    if (!target) return false;
    const result = this.game.specials.activate(this.game, bot, type, target.id, { reason: "survival" });
    bot.aiSpecialCooldownUntil = this.game.now() + (result.ok ? 24 : 8);
    this.debugBotAction(bot, result.ok ? "survival-special" : "survival-special-failed", {
      difficulty: bot.difficulty,
      energy: Math.round(bot.energy),
      target: target.id,
      reason: type,
      cooldown: Math.round(Math.max(0, bot.aiSpecialCooldownUntil - this.game.now())),
    });
    return result.ok;
  }

  tryWaterRoute(bot, target, phase) {
    if (this.game.sandbox?.enabled && this.game.sandbox.rules?.currentPush === false) return false;
    if (!target || phase === "early" || !this.game.combat?.startWaterRouteAttack) return false;
    const profile = this.difficultyProfile(bot);
    if (bot.difficulty === "easy" && this.game.elapsed() < 480) return false;
    if (phase === "early" && bot.difficulty !== "chaos") return false;
    if (this.game.now() < (bot.aiCurrentPushCooldownUntil || 0)) return false;
    if (bot.animal !== "duck" && bot.animal !== "carp" && bot.personality !== "leaderHunter") return false;
    const owner = target.owner ? this.game.getPlayer(target.owner) : null;
    const valuable = target.objectiveId || target.campId || owner?.id === this.leader()?.id || owner?.energy < bot.energy * 0.72;
    if (!valuable && bot.difficulty !== "chaos") return false;
    if (bot.energy < bot.maxEnergy * 0.52 || Math.random() > (profile.currentPushChance || 0.03)) return false;
    const result = this.game.combat.startWaterRouteAttack(this.game, bot, target.id, Math.min(0.42, this.attackPlanPercent(bot, target, phase) + 0.08));
    bot.aiCurrentPushCooldownUntil = this.game.now() + (result.ok ? profile.currentPushCooldown || 70 : 8);
    return result.ok;
  }

  trySpecial(bot, phase, enemyTiles = []) {
    if (!this.game.specials || this.game.sandbox?.rules?.specials === false) return false;
    const profile = this.difficultyProfile(bot);
    const now = this.game.now();
    if ((profile.specialChance || 0) <= 0) return false;
    if (this.game.elapsed() < (profile.specialEarliestTime || 180)) return false;
    if (now < (bot.aiSpecialCooldownUntil || 0)) return false;
    if (bot.energy < 72 || bot.energy < bot.maxEnergy * 0.42) return false;
    if (Math.random() > (profile.specialChance || 0)) return false;

    const underAttack = now < (bot.flags?.underAttackUntil || 0);
    const choices = [];
    const borders = this.game.tileManager
      .borders(bot.id)
      .filter((tile) => tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== bot.id));

    if (underAttack || (borders.length >= 3 && phase !== "early")) {
      const weakBorder = borders
        .slice()
        .sort((a, b) => (a.defenseEnergy || 0) - (b.defenseEnergy || 0))[0];
      if (weakBorder && bot.energy >= 70) choices.push({ type: "reedShield", tile: weakBorder, score: underAttack ? 42 : 20, reason: "border pressure" });
    }

    if ((underAttack || phase === "late" || phase === "surge") && bot.energy >= 90) {
      const protectTile = this.game.tileManager.getById(bot.coreTileId) || this.game.tileManager.owned(bot.id)[0];
      if (protectTile) choices.push({ type: "dragonflyGuard", tile: protectTile, score: underAttack ? 34 : 12, reason: "guard valuable area" });
    }

    if (phase !== "early" && bot.energy >= 125 && enemyTiles.length) {
      const leader = this.leader();
      const target = enemyTiles
        .filter((tile) => {
          const owner = tile.owner ? this.game.getPlayer(tile.owner) : null;
          if (!owner || owner.defeated) return false;
          if (owner.id === config.HUMAN_ID && leader?.id !== owner.id && bot.flags?.lastAttackerId !== owner.id) return Math.random() < 0.35;
          return true;
        })
        .map((tile) => {
          const owner = this.game.getPlayer(tile.owner);
          const exposed = tile.neighbors.filter((neighbor) => neighbor.owner === bot.id).length;
          const cluster = tile.neighbors?.filter((neighbor) => neighbor.owner === tile.owner).length || 0;
          return {
            tile,
            score:
              this.tileScore(bot, tile) +
              cluster * 3 +
              exposed * 2 +
              (owner?.id === leader?.id ? 18 : 0) +
              (tile.objectiveId || tile.campId ? 18 : 0) -
              (tile.defenseEnergy || 0) * 0.35,
          };
        })
        .sort((a, b) => b.score - a.score)[0]?.tile;
      if (target) choices.push({ type: "lilyBarrage", tile: target, score: 30 + (target.owner === leader?.id ? 16 : 0), reason: "valuable enemy cluster" });
    }

    const pick = choices
      .map((choice) => ({ ...choice, score: choice.score + Math.random() * 12 - (Math.random() < (profile.mistakeChance || 0) ? 18 : 0) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!pick) return false;

    const result = this.game.specials.activate(this.game, bot, pick.type, pick.tile.id, { source: "bot" });
    bot.aiSpecialCooldownUntil = now + (result.ok ? this.randomRange(profile.specialCooldown, [85, 120]) : 8);
    this.debugBotAction(bot, "special", {
      difficulty: bot.difficulty,
      energy: Math.round(bot.energy),
      target: pick.tile.id,
      special: pick.type,
      reason: pick.reason,
      cooldown: Math.round(Math.max(0, bot.aiSpecialCooldownUntil - now)),
      result: result.resultType || result.message,
    });
    return result.ok;
  }

  phase() {
    const elapsed = this.game.elapsed();
    if (elapsed >= balance.finalSurgeTime) return "surge";
    if (elapsed >= balance.lateGameTime) return "late";
    if (elapsed >= balance.midGameTime) return "mid";
    return "early";
  }

  sandboxMode(bot) {
    if (!this.game.sandbox?.enabled) return "";
    return bot.flags?.sandboxPersonality || this.game.sandbox.defaultBotPersonality || "";
  }

  trySandboxLimitedTurn(bot, phase) {
    if (!this.game.sandbox?.enabled) return false;
    const mode = this.sandboxMode(bot);
    if (mode === "passive") return true;
    const noCombat = this.game.sandbox.rules?.botsFight === false;
    if (!noCombat && !["expander", "defender"].includes(mode)) return false;
    if ((mode === "defender" || noCombat) && this.tryDefend(bot)) return true;
    if (bot.energy > bot.maxEnergy * 0.6 && this.tryBuild(bot)) return true;
    const neutral = this.game.tileManager.capturable(bot.id).filter((tile) => !tile.owner);
    if (neutral.length) {
      const target = this.pickNeutralExpansion(bot, neutral);
      if (target) this.tryExpandNeutral(bot, target);
    }
    return true;
  }

  aggressionScale(bot = null) {
    const elapsed = this.game.elapsed();
    const active = this.game.players.filter((player) => !player.defeated && player.territory > 0).length;
    let scale = 1;
    if (elapsed >= 120) scale += 0.25;
    if (elapsed >= 300) scale += 0.25;
    if (active <= Math.max(3, Math.ceil(this.game.players.length * 0.35))) scale += 0.25;
    return scale * (balance.botAggressionMultiplier || 1) * (bot ? this.difficultyProfile(bot).aggression || 1 : 1);
  }

  shouldFavorCombat(phase) {
    return phase !== "early" && this.aggressionScale() >= 1.35;
  }

  tryTeamCommand(bot, phase) {
    const command = bot.flags?.teamCommand;
    if (!command || !this.game.teamManager?.active()) return false;
    const now = this.game.now();
    if (command.expiresAt <= now) {
      delete bot.flags.teamCommand;
      return false;
    }
    if (now < (bot.flags.teamCommandReactionAt || 0)) return false;
    if (bot.energy < 8 && command.command !== "retreat") return false;

    const requestedTile = this.game.tileManager.getById(command.tileId);
    if (!requestedTile) {
      delete bot.flags.teamCommand;
      return false;
    }

    if (command.command === "retreat") {
      bot.aiAttackCooldownUntil = Math.max(bot.aiAttackCooldownUntil || 0, now + 5);
      delete bot.flags.teamCommand;
      return true;
    }

    if (["defend", "help", "protect"].includes(command.command)) {
      if (this.tryDefendNear(bot, requestedTile)) {
        delete bot.flags.teamCommand;
        return true;
      }
    }

    const target = this.teamCommandTarget(bot, requestedTile, command.command);
    if (!target) return false;

    if (!target.owner) {
      const result = this.tryExpandNeutral(bot, target);
      if (result) delete bot.flags.teamCommand;
      return result;
    }

    if (target.owner !== bot.id && this.game.diplomacy.canAttack(bot.id, target.owner, now).ok) {
      const percent =
        bot.role === "attacker" || command.command === "push"
          ? Math.max(0.35, this.attackPlanPercent(bot, target, phase))
          : this.attackPlanPercent(bot, target, phase);
      const result = this.game.combat.expandOrAttack(this.game, bot, target.id, percent);
      bot.aiAttackCooldownUntil = now + (result.ok ? this.attackCooldownSeconds(bot, phase) * 0.75 : 2.5);
      if (result.ok) {
        this.game.pushEvent({
          kind: "teamResponse",
          playerId: bot.id,
          teamId: bot.teamId,
          command: command.command,
          to: target.id,
          at: now,
        });
        delete bot.flags.teamCommand;
      }
      return result.ok;
    }

    return false;
  }

  teamCommandTarget(bot, requestedTile, command) {
    const capturable = this.game.tileManager
      .capturable(bot.id)
      .filter((tile) => !tile.owner || this.game.diplomacy.canAttack(bot.id, tile.owner, this.game.now()).ok);
    if (!capturable.length) return null;
    if (capturable.some((tile) => tile.id === requestedTile.id)) return requestedTile;
    const objectiveOnly = command === "objective";
    const owner = requestedTile.owner;
    return capturable
      .filter((tile) => {
        if (objectiveOnly) return tile.objectiveId || tile.campId || !tile.owner;
        if (owner && owner !== bot.id) return tile.owner === owner || !tile.owner;
        return !tile.owner || tile.objectiveId || tile.campId;
      })
      .map((tile) => ({
        tile,
        score:
          this.tileScore(bot, tile) +
          (tile.owner && owner && tile.owner === owner ? 18 : 0) +
          (tile.objectiveId ? 22 : tile.campId ? 12 : 0) -
          (Math.abs(tile.x - requestedTile.x) + Math.abs(tile.y - requestedTile.y)) * 1.8,
      }))
      .sort((a, b) => b.score - a.score)[0]?.tile || null;
  }

  tryTeamSupport(bot, phase) {
    if (!this.game.teamManager?.active() || !bot.teamId || bot.energy < 14) return false;
    const now = this.game.now();
    if (now < (bot.aiTeamSupportCooldownUntil || 0)) return false;
    const teammate = this.game.players.find(
      (player) =>
        player.id !== bot.id &&
        player.teamId === bot.teamId &&
        !player.defeated &&
        now < (player.flags?.underAttackUntil || 0),
    );
    if (!teammate) return false;
    const attackerId = teammate.flags?.lastAttackerId;
    const enemyTiles = attackerId
      ? this.game.tileManager.capturable(bot.id).filter((tile) => tile.owner === attackerId && this.game.diplomacy.canAttack(bot.id, attackerId, now).ok)
      : [];
    if (bot.role === "guardian" || bot.energy < bot.maxEnergy * 0.42 || !enemyTiles.length) {
      const core = teammate.coreTileId != null ? this.game.tileManager.getById(teammate.coreTileId) : null;
      if (this.tryDefendNear(bot, core || this.game.tileManager.owned(teammate.id)[0])) {
        bot.aiTeamSupportCooldownUntil = now + 5;
        return true;
      }
    }
    const target = enemyTiles.sort((a, b) => this.roughAttackCost(a, this.game.getPlayer(a.owner)) - this.roughAttackCost(b, this.game.getPlayer(b.owner)))[0];
    if (target && this.shouldAttack(bot, this.game.getPlayer(target.owner), phase, true, target)) {
      bot.aiTeamSupportCooldownUntil = now + 7;
      return this.launchAttack(bot, target, phase);
    }
    return false;
  }

  tryDefendNear(bot, targetTile = null) {
    const now = this.game.now();
    if (now < (bot.aiDefendCooldownUntil || 0)) return false;
    if (this.botDefenseMistake(bot)) return false;
    const borders = this.game.tileManager
      .borders(bot.id)
      .filter((tile) => tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== bot.id && this.game.diplomacy.canAttack(neighbor.owner, bot.id, this.game.now()).ok));
    const candidates = borders.length ? borders : this.game.tileManager.borders(bot.id);
    if (!candidates.length) return false;
    const target = candidates
      .slice()
      .sort((a, b) => {
        const ad = targetTile ? Math.abs(a.x - targetTile.x) + Math.abs(a.y - targetTile.y) : 0;
        const bd = targetTile ? Math.abs(b.x - targetTile.x) + Math.abs(b.y - targetTile.y) : 0;
        return ad - bd || a.defenseEnergy - b.defenseEnergy;
      })[0];
    const percent = bot.role === "guardian" ? 0.28 : bot.difficulty === "easy" ? 0.16 : 0.2;
    const result = this.game.combat.defend(bot, target.id, percent, now);
    bot.aiDefendCooldownUntil = now + (result.ok ? this.randomRange(this.difficultyProfile(bot).defenseCooldown, [12, 20]) : 4);
    return result.ok;
  }

  shouldExpand(bot, phase) {
    const profile = this.difficultyProfile(bot);
    if ((profile.expansionAggression || 0) <= 0 || this.game.now() < (bot.aiExpandCooldownUntil || 0)) return false;
    const expansionAggression = profile.expansionAggression ?? profile.expansionMultiplier ?? 1;
    const animalPush = bot.animal === "duck" ? 0.12 : bot.animal === "frog" ? 0.06 : bot.animal === "carp" ? 0.04 : bot.animal === "turtle" ? -0.08 : -0.03;
    const eventPush =
      this.game.eventsManager?.isActive("rainstorm")
        ? 0.22
        : this.game.eventsManager?.isActive("lilyBloom") && (bot.animal === "frog" || bot.animal === "carp")
          ? 0.16
          : 0;
    if (phase === "early") {
      const targetTerritory = 22 + 46 * expansionAggression;
      const energyReady = bot.energy > bot.maxEnergy * (0.24 + Math.max(0, 1 - expansionAggression) * 0.18);
      return (bot.territory < targetTerritory && energyReady) || Math.random() < Math.max(0.04, (0.22 + animalPush + eventPush) * expansionAggression);
    }
    if (bot.personality === "expander" && bot.territory < 95 * expansionAggression && Math.random() < 0.42 * expansionAggression) return true;
    if (bot.personality === "objectiveHunter" && phase !== "early" && Math.random() < 0.28 * expansionAggression) return true;
    if (bot.personality === "defensive" && bot.energy < bot.maxEnergy * 0.5) return Math.random() < 0.35 * expansionAggression;
    return Math.random() < Math.max(0.03, ((phase === "mid" ? 0.2 : 0.1) + animalPush * 0.5 + eventPush) * expansionAggression);
  }

  buildChance(bot, phase) {
    const base = phase === "early" ? 0.34 : phase === "mid" ? 0.16 : 0.08;
    const animal = bot.animal === "snake" ? 0.05 : bot.animal === "frog" ? 0.03 : bot.animal === "turtle" ? 0.12 : bot.animal === "carp" ? 0.14 : 0;
    const multiplier = this.difficultyProfile(bot).buildMultiplier ?? 1;
    if (bot.personality === "defensive") return (base + 0.12) * multiplier;
    if (bot.personality === "aggressive") return Math.max(0.02, (base - 0.1) * multiplier);
    return Math.max(0.02, (base + animal - (this.aggressionScale(bot) - 1) * 0.08) * multiplier);
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
      .filter((tile) => !tile.owner || (tile.owner !== bot.id && this.game.diplomacy.canAttack(bot.id, tile.owner, this.game.now()).ok));
    if (!capturable.length) return null;
    const aggression = this.aggressionScale(bot);
    const chance =
      bot.personality === "objectiveHunter"
        ? 0.88
        : bot.personality === "farmer"
          ? 0.42
          : bot.animal === "frog" || bot.animal === "turtle"
            ? 0.68
            : bot.animal === "carp"
              ? 0.62
            : 0.58;
    const finalChance = Math.min(0.94, chance + (aggression - 1) * 0.12);
    if (Math.random() > finalChance) return null;
    return capturable
      .map((tile) => ({ tile, score: this.tileScore(bot, tile) + (tile.objectiveId ? 32 : 16) + (tile.owner ? 12 : 0) - (tile.owner ? this.roughAttackCost(tile, this.game.getPlayer(tile.owner)) * 0.14 : 0) }))
      .sort((a, b) => b.score - a.score)[0]?.tile || null;
  }

  tryExpandNeutral(bot, target) {
    const now = this.game.now();
    const profile = this.difficultyProfile(bot);
    if ((profile.expansionMultiplier || 0) <= 0) return false;
    if (now < (bot.aiExpandCooldownUntil || 0)) {
      this.debugBotAction(bot, "expand-wait", {
        difficulty: bot.difficulty,
        energy: Math.round(bot.energy),
        target: target?.id,
        reason: "expand cooldown",
        cooldown: Math.round((bot.aiExpandCooldownUntil || 0) - now),
      });
      return true;
    }
    const cost = this.game.combat.neutralCaptureCost(this.game, bot, target, {});
    const progress = target.captureProgress?.[bot.id] || 0;
    const remaining = Math.max(0, cost - progress);
    if (remaining <= 0) {
      this.expansionTargets.delete(bot.id);
      return false;
    }

    const hasProgress = progress > 0;
    const energyReserveMultiplier = 1 + Math.max(0, 1 - (profile.expansionMultiplier || 1)) * 0.55;
    if (!hasProgress && bot.energy < remaining * energyReserveMultiplier) {
      this.expansionTargets.set(bot.id, target.id);
      this.debugExpansion(bot, target, cost, 0, { ok: false, resultType: "waiting" });
      return true;
    }
    if (hasProgress && bot.energy < Math.min(remaining, 4)) {
      this.expansionTargets.set(bot.id, target.id);
      this.debugExpansion(bot, target, cost, 0, { ok: false, resultType: "saving" });
      return true;
    }

    if (!hasProgress && Math.random() < (profile.mistakeChance || 0)) {
      bot.aiExpandCooldownUntil = now + this.randomRange(profile.expandCooldown, profile.expansionDelay || [3, 6]) * 0.7;
      this.debugExpansion(bot, target, cost, 0, { ok: false, resultType: "mistake" });
      this.debugBotAction(bot, "expand-mistake", {
        difficulty: bot.difficulty,
        energy: Math.round(bot.energy),
        target: target.id,
        reason: "picked a bad moment",
        cooldown: Math.round(bot.aiExpandCooldownUntil - now),
      });
      return true;
    }

    const phase = this.phase();
    const maxSend = phase === "early" ? profile.maxEarlyExpansionSend || 0.5 : 0.72;
    const expansionMultiplier = profile.expansionMultiplier ?? 1;
    const partialSpend = Math.max(3, Math.min(remaining, remaining * expansionMultiplier));
    const desiredSpend = hasProgress ? Math.min(bot.energy, remaining, Math.max(4, bot.energy * maxSend)) : Math.min(bot.energy * maxSend, partialSpend);
    const percent = Math.max(0.04, Math.min(1, desiredSpend / Math.max(1, bot.energy)));
    const plannedSpend = Math.min(bot.energy, desiredSpend);
    const result = this.game.combat.expandOrAttack(this.game, bot, target.id, percent);
    this.debugExpansion(bot, target, cost, plannedSpend, result);
    bot.aiExpandCooldownUntil = now + this.randomRange(profile.expandCooldown, profile.expansionDelay || [3, 6]);

    if (result.resultType === "partial") this.expansionTargets.set(bot.id, target.id);
    else this.expansionTargets.delete(bot.id);
    return true;
  }

  pickAttack(bot, tiles, phase = "early") {
    const leader = this.leader();
    const aggression = this.aggressionScale(bot);
    const candidates = tiles
      .map((tile) => {
        const owner = this.game.getPlayer(tile.owner);
        if (!owner || owner.defeated) return null;
        const pressure = owner.energy / Math.max(1, owner.maxEnergy);
        const exposed = tile.neighbors.filter((neighbor) => neighbor.owner === bot.id).length;
        const roughCost = this.roughAttackCost(tile, owner);
        const threat = this.threatScore(owner, leader);
        const energyEdge = Math.max(0, bot.energy - owner.energy);
        if (owner.energy > bot.energy * (1.75 - Math.min(0.35, (aggression - 1) * 0.2)) && !bot.enemies.has(owner.id) && exposed < 2 && phase !== "surge") return null;
        return {
          tile,
          owner,
          score:
            this.tileScore(bot, tile) +
            exposed * 4 +
            energyEdge * 0.06 +
            threat * balance.leaderThreatMultiplier * aggression +
            (tile.objectiveId || tile.campId ? 18 : 0) +
            (bot.enemies.has(owner.id) ? 14 : 0) +
            this.personalityAttackBonus(bot, owner, phase) -
            roughCost * (phase === "early" ? 0.28 : 0.21) -
            pressure * 3,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) return null;
    const mistakeChance = this.difficultyProfile(bot).mistakeChance || 0;
    if (Math.random() < mistakeChance) {
      const pool = candidates.slice(0, Math.min(candidates.length, bot.difficulty === "easy" ? 6 : 4));
      return pool[Math.floor(Math.random() * pool.length)]?.tile || candidates[0].tile;
    }
    return candidates[0]?.tile || null;
  }

  updateBorderContacts(bot, enemyTiles) {
    const now = this.game.now();
    const seen = new Set();
    enemyTiles.forEach((tile) => {
      if (!tile.owner || tile.owner === bot.id) return;
      seen.add(tile.owner);
      const key = this.contactKey(bot.id, tile.owner);
      const contact = this.borderContacts.get(key) || { firstSeen: now, lastSeen: now };
      contact.lastSeen = now;
      this.borderContacts.set(key, contact);
    });
    [...this.borderContacts.entries()].forEach(([key, contact]) => {
      if (!key.startsWith(`${bot.id}:`)) return;
      const ownerId = key.split(":")[1];
      if (!seen.has(ownerId) && now - contact.lastSeen > 45) this.borderContacts.delete(key);
    });
  }

  contactKey(botId, ownerId) {
    return `${botId}:${ownerId}`;
  }

  contactAge(bot, ownerId) {
    const contact = this.borderContacts.get(this.contactKey(bot.id, ownerId));
    if (!contact) return 0;
    return Math.max(0, this.game.now() - contact.firstSeen);
  }

  reactionDelay(bot, phase) {
    const personality =
      bot.personality === "aggressive"
        ? 1.4
        : bot.personality === "leaderHunter" || bot.personality === "betrayer" || bot.personality === "opportunist"
          ? 2.2
          : bot.personality === "defensive" || bot.personality === "farmer" || bot.personality === "peaceful" || bot.personality === "loyalAlly"
            ? 4.2
            : 3;
    const difficulty = bot.difficulty === "easy" ? 1.45 : bot.difficulty === "smart" ? 0.82 : 1;
    const phaseFactor = phase === "early" ? 1.18 : phase === "surge" ? 0.35 : phase === "late" ? 0.62 : 0.82;
    const profileDelay = this.difficultyProfile(bot).reactionDelay || [3, 6];
    const profileFloor = profileDelay[0] + Math.random() * Math.max(0, profileDelay[1] - profileDelay[0]);
    return Math.max(profileFloor, (personality * difficulty * phaseFactor) / Math.min(1.7, this.aggressionScale(bot)));
  }

  attackPlanPercent(bot, tile, phase) {
    const owner = tile?.owner ? this.game.getPlayer(tile.owner) : null;
    const weak = owner && owner.energy < bot.energy * 0.55;
    const leaderTarget = owner && this.leader()?.id === owner.id;
    let percent = 0.25;
    if (bot.personality === "aggressive") percent = phase === "early" ? 0.25 : 0.42;
    if (bot.personality === "betrayer" && weak) percent = 0.5;
    if (bot.personality === "leaderHunter" && leaderTarget) percent = phase === "surge" ? 0.62 : 0.5;
    if (bot.personality === "defensive") percent = 0.22;
    if (bot.personality === "farmer" || bot.personality === "peaceful" || bot.personality === "loyalAlly") percent = 0.2;
    if (bot.personality === "opportunist" && weak) percent = phase === "surge" ? 0.58 : 0.42;
    if (bot.animal === "turtle") percent = Math.min(percent, phase === "surge" ? 0.38 : 0.28);
    if (bot.animal === "carp" && phase === "early") percent = Math.min(percent, 0.2);
    if (bot.animal === "carp" && phase !== "early" && bot.energy > bot.maxEnergy * 0.72) percent = Math.max(percent, 0.35);
    if (leaderTarget && phase !== "early") percent = Math.max(percent, 0.45);
    if (weak && phase === "surge") percent = 0.62;
    if (phase !== "early") percent += Math.min(0.12, (this.aggressionScale(bot) - 1) * 0.06);
    percent *= this.difficultyProfile(bot).attackPercentMultiplier || 1;
    return Math.min(0.75, Math.max(0.1, percent));
  }

  attackCooldownSeconds(bot, phase) {
    const baseCooldown = phase === "early" ? 10.5 : phase === "mid" ? 6.4 : phase === "late" ? 4.8 : 3.8;
    const personality =
      bot.personality === "aggressive"
        ? 0.82
        : bot.personality === "leaderHunter" || bot.personality === "betrayer"
          ? 0.95
          : bot.personality === "defensive"
            ? 1.4
            : bot.personality === "farmer" || bot.personality === "peaceful" || bot.personality === "loyalAlly"
              ? 1.6
              : 1.12;
    const difficulty = bot.difficulty === "easy" ? 1.35 : bot.difficulty === "smart" ? 0.9 : 1.08;
    const range = this.difficultyProfile(bot).attackCooldown || [10, 18];
    const profiledCooldown = range[0] + Math.random() * Math.max(0, range[1] - range[0]);
    return Math.max(profiledCooldown, (baseCooldown * personality * difficulty) / Math.min(1.65, this.aggressionScale(bot)));
  }

  attackDecision(bot, tile, phase, fallback = false) {
    const owner = tile?.owner ? this.game.getPlayer(tile.owner) : null;
    const now = this.game.now();
    if (!owner) return { ok: false, reason: "no target" };
    const diplomacy = this.game.diplomacy.canAttack(bot.id, owner.id, now);
    if (!diplomacy.ok) return { ok: false, reason: diplomacy.reason || "diplomacy blocked" };
    const thinkLeft = Math.max(0, (bot.aiAttackCooldownUntil || 0) - now);
    if (thinkLeft > 0) return { ok: false, reason: "ai pacing", thinkLeft };

    const recentlyHit = bot.flags?.lastAttackerId === owner.id && now < (bot.flags?.underAttackUntil || 0);
    const leaderTarget = this.leader()?.id === owner.id;
    const contactAge = this.contactAge(bot, owner.id);
    const reactionDelay = this.reactionDelay(bot, phase);
    if (!recentlyHit && !(leaderTarget && phase !== "early") && phase !== "surge" && contactAge < reactionDelay) {
      return { ok: false, reason: "scouting border", contactAge, reactionDelay };
    }

    const energyRatio = bot.energy / Math.max(1, bot.maxEnergy);
    const threshold =
      bot.personality === "aggressive"
        ? 0.3
        : bot.personality === "leaderHunter" || bot.personality === "betrayer"
          ? 0.33
        : bot.personality === "farmer" || bot.personality === "peaceful" || bot.personality === "loyalAlly"
            ? 0.46
            : balance.botAttackEnergyThreshold;
    const aggression = this.aggressionScale(bot);
    const animalThreshold = Math.max(
      0.2,
      (bot.animal === "turtle" ? threshold + 0.08 : bot.animal === "carp" && phase === "early" ? threshold + 0.12 : threshold) -
        (phase === "early" ? 0 : (aggression - 1) * 0.08),
    );
    if (energyRatio < animalThreshold && !fallback) return { ok: false, reason: "saving energy", energyRatio, threshold: animalThreshold };
    const percent = this.attackPlanPercent(bot, tile, phase);
    const spend = bot.energy * percent;
    const roughCost = this.roughAttackCost(tile, owner);
    const minimumSpend = this.difficultyProfile(bot).minimumAttackSpend || (bot.difficulty === "easy" ? 14 : bot.difficulty === "smart" ? 10 : 12);
    if (spend < minimumSpend && !fallback) return { ok: false, reason: "tiny attack", spend, minimumSpend };
    if (spend < roughCost * (phase === "early" ? 0.48 : 0.38) && owner.energy >= bot.energy * 0.5 && !recentlyHit && !fallback) {
      return { ok: false, reason: "border too strong", spend, roughCost };
    }
    if (phase === "early" && bot.animal === "carp" && !fallback && Math.random() > 0.08) return { ok: false, reason: "carp economy first" };
    const earlyCaution = bot.difficulty === "easy" ? 0.08 : bot.difficulty === "normal" ? 0.14 : 0.2;
    if (phase === "early" && bot.personality !== "aggressive" && !recentlyHit && Math.random() > earlyCaution) return { ok: false, reason: "early caution" };
    if (owner.energy < bot.energy * 0.78) {
      const chance = Math.min(0.95, (phase === "early" ? 0.28 : 0.74) + (aggression - 1) * 0.1);
      return { ok: Math.random() < chance, reason: "weak neighbor", chance, percent, spend, roughCost, contactAge };
    }
    if (leaderTarget && phase !== "early") {
      const chance = Math.min(0.98, (bot.personality === "leaderHunter" ? 0.94 : 0.86) + (aggression - 1) * 0.08);
      return { ok: Math.random() < chance, reason: "leader target", chance, percent, spend, roughCost, contactAge };
    }
    const phaseChance = phase === "mid" ? 0.58 : phase === "late" ? 0.74 : phase === "surge" ? 0.86 : 0.18;
    const personality =
      bot.personality === "aggressive"
        ? 0.22
        : bot.personality === "leaderHunter"
          ? 0.18
          : bot.personality === "betrayer"
            ? 0.14
            : bot.personality === "defensive"
              ? -0.14
            : bot.personality === "farmer"
                ? -0.2
                : 0;
    const chance = Math.max(0.05, Math.min(0.96, phaseChance + personality + (phase === "early" ? 0 : (aggression - 1) * 0.08)));
    return { ok: Math.random() < chance, reason: "pressure roll", chance, percent, spend, roughCost, contactAge };
  }

  shouldAttack(bot, owner, phase, fallback = false, tile = null) {
    if (!owner) return false;
    const target = tile || this.game.tileManager.capturable(bot.id).find((candidate) => candidate.owner === owner.id);
    const decision = this.attackDecision(bot, target, phase, fallback);
    this.debugAttackDecision(bot, target, decision);
    return decision.ok;
  }

  trySkirmish(bot, enemyTiles, phase) {
    if (!enemyTiles.length || phase === "early") return false;
    const now = this.game.now();
    if (now < (bot.aiAttackCooldownUntil || 0)) return false;
    const profile = this.difficultyProfile(bot);
    const minEnergy = Math.max((profile.minimumAttackSpend || 14) * 2.2, bot.maxEnergy * (bot.difficulty === "easy" ? 0.7 : 0.44));
    if (bot.energy < minEnergy) return false;

    const quietBonus = (this.game.metrics?.attacks || 0) < 4 && this.game.elapsed() > 300 ? 0.16 : 0;
    const personalityBonus =
      bot.personality === "aggressive" || bot.personality === "leaderHunter"
        ? 0.08
        : bot.personality === "defensive" || bot.personality === "farmer" || bot.personality === "peaceful" || bot.personality === "loyalAlly"
          ? -0.06
          : 0;
    const chanceByDifficulty = {
      easy: 0.025,
      normal: 0.13,
      smart: 0.3,
      chaos: 0.48,
    };
    const chance = Math.max(0.02, Math.min(0.62, (chanceByDifficulty[bot.difficulty] || 0.13) + quietBonus + personalityBonus));
    if (Math.random() > chance) return false;

    const humanId = config.HUMAN_ID;
    let candidates = enemyTiles.filter((tile) => {
      const owner = tile.owner ? this.game.getPlayer(tile.owner) : null;
      if (!owner || owner.defeated) return false;
      if (bot.difficulty === "easy" && owner.id === humanId && bot.flags?.lastAttackerId !== owner.id) return false;
      return this.game.diplomacy.canAttack(bot.id, owner.id, now).ok;
    });
    if (!candidates.length) return false;
    candidates = candidates
      .map((tile) => {
        const owner = this.game.getPlayer(tile.owner);
        const ownerPressure = owner?.id === humanId ? -5 : 4;
        return { tile, score: this.tileScore(bot, tile) + ownerPressure - this.roughAttackCost(tile, owner) * 0.18 + Math.random() * 5 };
      })
      .sort((a, b) => b.score - a.score);
    const target = candidates[0]?.tile;
    if (!target) return false;
    const launched = this.launchAttack(bot, target, phase);
    this.debugBotAction(bot, launched ? "skirmish" : "skirmish-failed", {
      difficulty: bot.difficulty,
      energy: Math.round(bot.energy),
      target: target.id,
      reason: "midgame pressure",
      cooldown: Math.round(Math.max(0, (bot.aiAttackCooldownUntil || 0) - now)),
    });
    return launched;
  }

  launchAttack(bot, tile, phase) {
    const percent = this.attackPlanPercent(bot, tile, phase);
    const plannedSpend = bot.energy * percent;
    const result = this.game.combat.expandOrAttack(this.game, bot, tile.id, percent);
    this.debugAttackDecision(bot, tile, { ok: result.ok, reason: result.resultType || result.message, percent, spend: plannedSpend }, result);
    bot.aiAttackCooldownUntil = this.game.now() + (result.ok ? this.attackCooldownSeconds(bot, phase) : 2.5);
    return result.ok;
  }

  tryBuild(bot) {
    const order =
      bot.animal === "snake"
        ? ["mudTunnel", "reedGuard", "lilyFarm", "nest"]
        : bot.animal === "frog"
          ? ["jumpPad", "lilyFarm", "reedGuard", "nest"]
          : bot.animal === "turtle"
            ? ["reedGuard", "nest", "lilyFarm"]
            : bot.animal === "carp"
              ? ["lilyFarm", "nest", "reedGuard"]
              : ["nest", "lilyFarm", "reedGuard"];

    const owned = this.game.tileManager.owned(bot.id).filter((tile) => !tile.building);
    for (const buildingType of order) {
      const building = config.BUILDINGS[buildingType];
      const cost = this.game.economy.buildingCost(bot, buildingType);
      if (bot.energy < cost) continue;
      const tile = owned.find((candidate) => this.game.economy.canBuild(bot, candidate, buildingType, this.game.now()));
      if (tile) {
        const result = this.game.economy.build(bot, tile, buildingType, this.game.now(), this.game);
        if (result.ok) {
          this.game.pushEvent({ kind: "buildStarted", playerId: bot.id, to: tile.id, buildingType, finishesAt: result.buildingActiveAt, at: this.game.now() });
        }
        return result.ok;
      }
    }
    return false;
  }

  tryAlliance(bot, phase = "early") {
    const neighbors = new Set();
    this.game.tileManager.borders(bot.id).forEach((tile) => {
      tile.neighbors.forEach((neighbor) => {
        if (neighbor.owner && neighbor.owner !== bot.id) neighbors.add(neighbor.owner);
      });
    });
    [...neighbors].some((id) => {
      const target = this.game.getPlayer(id);
      if (!target || target.defeated || this.game.diplomacy.areAllied(bot.id, id)) return false;
      const relation = this.game.diplomacy.relationship(bot.id, id, this.game.now());
      if (relation.state === "requested" || relation.state === "truce" || relation.betrayalLeft > 0) return false;
      const commonEnemy = [...bot.enemies].some((enemyId) => target.enemies?.includes?.(enemyId) || target.enemies?.has?.(enemyId));
      const targetStronger = this.game.territoryPercent(target) > this.game.territoryPercent(bot) * 1.22;
      const leaderThreat = this.leader()?.id !== bot.id && this.leader()?.id !== id && phase !== "early";
      const chance =
        bot.personality === "loyalAlly"
          ? 0.78
          : bot.personality === "peaceful"
            ? 0.62
            : bot.personality === "betrayer"
              ? 0.22
              : 0.38;
      const wantsPeace = bot.personality === "peaceful" || bot.personality === "loyalAlly";
      if ((targetStronger || commonEnemy || leaderThreat || wantsPeace) && Math.random() < chance) {
        this.game.diplomacy.handle(this.game, bot, id, "requestAlliance");
        return true;
      }
      return false;
    });
  }

  tryTruce(bot, phase = "mid") {
    const leader = this.leader();
    const candidates = this.game.players
      .filter((player) => player.id !== bot.id && !player.defeated && !this.game.diplomacy.areAllied(bot.id, player.id))
      .map((player) => ({ player, relation: this.game.diplomacy.relationship(bot.id, player.id, this.game.now()) }))
      .filter(({ relation }) => relation.state === "war" && relation.truceLeft <= 0)
      .sort((a, b) => b.player.energy - a.player.energy);
    const target = candidates.find(({ player }) => player.energy > bot.energy * 1.15 || player.id === leader?.id)?.player;
    if (!target) return false;
    if (bot.personality === "aggressive" && Math.random() > 0.18) return false;
    if (bot.personality === "betrayer" && phase !== "surge" && Math.random() > 0.08) return false;
    const result = this.game.diplomacy.handle(this.game, bot, target.id, "offerTruce");
    return result.ok;
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
      const use = (valuableLeapTargets >= 2 || neutral.length >= 8 || blockedAngles >= 2) && Math.random() < (phase === "early" ? 0.28 : 0.38);
      return {
        use,
        targetId: best?.id,
        reason: use ? `${valuableLeapTargets} valuable leap targets, ${blockedAngles} blocked angles` : "no valuable leap cluster",
      };
    }
    if (bot.animal === "turtle") {
      const threatened = this.game.now() < (bot.flags?.underAttackUntil || 0) || enemyTiles.length >= 3;
      const borderObjectives = this.game.tileManager.borders(bot.id).some((tile) => tile.objectiveId || tile.campId);
      const weakBorders = this.game.tileManager
        .borders(bot.id)
        .filter((tile) => tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== bot.id) && tile.defenseEnergy < 18).length;
      const use = (threatened || borderObjectives || weakBorders >= 4) && Math.random() < (phase === "early" ? 0.38 : 0.7);
      return {
        use,
        reason: use ? `${weakBorders} weak borders or objective pressure` : "no pressure worth Shell Guard",
      };
    }
    if (bot.animal === "carp") {
      const waterTargets = neutral.filter((tile) => tile.type === "water").length;
      const lilyTargets = neutral.filter((tile) => tile.type === "lily").length;
      const shouldScale = phase === "early" || bot.energy < bot.maxEnergy * 0.72 || bot.personality === "farmer";
      const use = shouldScale && (waterTargets >= 4 || lilyTargets >= 1) && Math.random() < (phase === "early" ? 0.56 : 0.42);
      return {
        use,
        targetId: neutral.find((tile) => tile.type === "lily")?.id || neutral.find((tile) => tile.type === "water")?.id,
        reason: use ? `${waterTargets} water and ${lilyTargets} lily economy targets` : "not enough economy targets",
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
    if (bot.animal === "frog" && tile.type === "lily") score += 5;
    if (bot.animal === "turtle" && (tile.type === "mud" || tile.type === "reeds" || tile.type === "nest")) score += 5;
    if (bot.animal === "carp" && tile.type === "water") score += 3;
    if (bot.animal === "carp" && tile.type === "lily") score += 8;
    if (this.game.eventsManager?.isActive("lilyBloom") && tile.type === "lily") score += bot.animal === "frog" || bot.animal === "carp" ? 9 : 4;
    if (this.game.eventsManager?.isActive("mudslide") && tile.type === "mud" && bot.animal === "snake") score += 6;
    if (tile.type === "nest") score += 3;
    if (tile.objectiveId) score += bot.personality === "objectiveHunter" ? 24 : 16;
    if (tile.campId) score += 8;
    score += this.objectivePullScore(bot, tile);
    return score;
  }

  objectivePullScore(bot, tile) {
    const objectives = this.game.objectives?.objectives || [];
    let score = 0;
    objectives.forEach((objective) => {
      if (!objective.active || objective.owner === bot.id) return;
      const target = this.game.tileManager.getById(objective.tileId);
      if (!target) return;
      const d = Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y);
      if (d > 10) return;
      const personality = bot.personality === "objectiveHunter" ? 1.9 : bot.animal === "frog" ? 1.28 : bot.animal === "turtle" ? 1.25 : bot.animal === "carp" ? 1.16 : 1;
      const ownerPressure = objective.owner ? 1.25 : 1;
      score += Math.max(0, 10 - d) * 1.15 * personality * ownerPressure;
    });
    return score;
  }

  roughAttackCost(tile, owner) {
    const type = config.TILE_TYPES[tile.type];
    let cost = tile.building ? 18 : tile.type === "water" ? 6 : tile.type === "lily" ? 8 : tile.type === "reeds" ? 12 : tile.type === "mud" ? 14 : 16;
    cost += Math.min(5, type.defenseBonus) * 1.05 + Math.min(tile.defenseEnergy || 0, owner?.animal === "turtle" ? balance.turtleDefendMaxEnergy || 72 : balance.defendMaxEnergy || 56) * 0.58;
    cost += Math.min(12, owner.energy * 0.024);
    return cost;
  }

  shouldDefend(bot, enemyTiles, phase) {
    if (this.game.now() < (bot.aiDefendCooldownUntil || 0)) return false;
    if (!enemyTiles.length || bot.energy < 18) return false;
    if (this.botDefenseMistake(bot)) return false;
    if (this.game.now() < (bot.flags?.underAttackUntil || 0)) return Math.random() < (bot.animal === "turtle" ? 0.58 : 0.28);
    const base = bot.animal === "turtle" ? 0.18 : bot.personality === "defensive" ? 0.2 : 0.06;
    const phaseBoost = phase === "early" ? 0 : phase === "mid" ? 0.05 : 0.1;
    return Math.random() < base + phaseBoost;
  }

  tryDefend(bot) {
    const now = this.game.now();
    if (now < (bot.aiDefendCooldownUntil || 0)) return false;
    const border = this.game.tileManager
      .borders(bot.id)
      .filter((tile) => tile.neighbors.some((neighbor) => neighbor.owner && neighbor.owner !== bot.id))
      .sort((a, b) => a.defenseEnergy - b.defenseEnergy)[0];
    if (!border) return false;
    const result = this.game.combat.defend(bot, border.id, bot.personality === "defensive" ? 0.26 : bot.difficulty === "easy" ? 0.16 : 0.2, now);
    bot.aiDefendCooldownUntil = now + (result.ok ? this.randomRange(this.difficultyProfile(bot).defenseCooldown, [12, 20]) : 4);
    return result.ok;
  }

  botDefenseMistake(bot) {
    const chance = this.difficultyProfile(bot).defenseMistakeChance ?? this.difficultyProfile(bot).mistakeChance ?? 0;
    return Math.random() < chance;
  }

  pickRetaliation(bot, enemyTiles, phase) {
    const attackerId = bot.flags?.lastAttackerId;
    if (!attackerId || this.game.now() > (bot.flags?.underAttackUntil || 0)) return null;
    const attacker = this.game.getPlayer(attackerId);
    if (!attacker || attacker.defeated || !this.game.diplomacy.canAttack(bot.id, attackerId, this.game.now()).ok) return null;
    if (phase === "early" && bot.personality === "farmer") return null;
    return enemyTiles
      .filter((tile) => tile.owner === attackerId)
      .sort((a, b) => this.roughAttackCost(a, attacker) - this.roughAttackCost(b, attacker))[0] || null;
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
    if (bot.personality === "leaderHunter" && this.leader()?.id === owner.id) bonus += 8;
    if (bot.personality === "betrayer" && phase !== "early" && owner.territory > bot.territory * 0.85) bonus += 4;
    if (bot.personality === "farmer" && phase !== "surge") bonus -= 3;
    if (bot.personality === "peaceful" || bot.personality === "loyalAlly") bonus -= 4;
    if (bot.personality === "opportunist" && owner.energy < bot.energy * 0.66) bonus += 5;
    if (bot.personality === "defensive") bonus -= 3;
    return bonus;
  }

  debugExpansion(bot, target, cost, sent, result) {
    if (process.env.NODE_ENV !== "development") return;
    const profile = this.difficultyProfile(bot);
    const cooldown = Math.max(0, (bot.aiExpandCooldownUntil || 0) - this.game.now());
    console.log(
      `[bot-expand] ${bot.name} difficulty=${bot.difficulty} energy=${Math.round(bot.energy)} tile=${target.id} cost=${Math.round(cost)} sent=${Math.round(sent)} result=${result.resultType || result.message || "unknown"} mistake=${profile.mistakeChance ?? 0} cooldown=${cooldown.toFixed(1)}`,
    );
  }

  debugBotAction(bot, action, data = {}) {
    if (process.env.NODE_ENV !== "development") return;
    const details = Object.entries(data)
      .map(([key, value]) => `${key}=${typeof value === "number" ? Number(value.toFixed?.(2) ?? value) : JSON.stringify(value)}`)
      .join(" ");
    console.log(`[bot-ai] ${bot.name} action=${action} ${details}`);
  }

  debugAbilityDecision(bot, decision, result) {
    if (process.env.NODE_ENV !== "development") return;
    console.log(
      `[bot-ability] ${bot.name} ${bot.animal} ability reason="${decision.reason}" target=${decision.targetId ?? "none"} result=${result.message}`,
    );
  }

  debugAttackDecision(bot, target, decision, result = null) {
    if (process.env.NODE_ENV !== "development") return;
    const targetText = target ? `tile=${target.id} owner=${target.owner}` : "tile=none";
    const owner = target?.owner ? this.game.getPlayer(target.owner) : null;
    const spend = decision.spend == null ? "" : ` spend=${Math.round(decision.spend)}`;
    const chance = decision.chance == null ? "" : ` chance=${decision.chance.toFixed(2)}`;
    const contact =
      decision.contactAge == null
        ? ""
        : ` contact=${decision.contactAge.toFixed(1)}${decision.reactionDelay ? `/${decision.reactionDelay.toFixed(1)}` : ""}`;
    const outcome = result ? ` server=${result.resultType || result.message || result.ok}` : "";
    console.log(`[bot-attack] ${bot.name} -> ${owner?.name || "neutral"} ${targetText} ok=${decision.ok} reason="${decision.reason}"${spend}${chance}${contact}${outcome}`);
  }
}

module.exports = BotManager;
