const gameModeConfig = require("../shared/gameModeConfig");
const spawnConfig = require("../shared/spawnConfig");

class GameModeManager {
  constructor(game) {
    this.game = game;
    this.modeId = game.matchSettings.ruleMode;
    this.rules = gameModeConfig.modes[this.modeId];
    if (!this.rules?.implemented) throw new Error(`Game mode "${this.modeId || "unknown"}" is not implemented.`);
    this.modeRules = Object.freeze({
      ...this.rules,
      scoreTarget: this.modeId === "goldenLily" ? game.matchSettings.goldenLilyScoreTarget : null,
      totalWaves: this.modeId === "floodSurvival" ? game.matchSettings.floodWaveCount : null,
      coreProtectionSeconds: this.modeId === "lastNest" ? game.matchSettings.lastNestProtectionSeconds : this.rules.coreProtectionSeconds,
      coreRules: Object.freeze({
        captureBehavior: this.modeId === "lastNest" || this.modeId === "floodSurvival" ? "eliminate" : game.matchSettings.coreCaptureBehavior,
        health: this.modeId === "lastNest" ? this.rules.coreHealth : this.modeId === "floodSurvival" ? this.rules.sanctuaryHealth : null,
        protectionSeconds: this.modeId === "lastNest" ? game.matchSettings.lastNestProtectionSeconds : 0,
      }),
      objectiveRules: Object.freeze({ ...(this.rules.objectiveRules || {}), type: this.modeId === "goldenLily" ? "goldenLilyControl" : this.modeId === "floodSurvival" ? "sanctuary" : "standard" }),
      scoreRules: Object.freeze({ target: this.modeId === "goldenLily" ? game.matchSettings.goldenLilyScoreTarget : null, intervalSeconds: this.rules.scoreIntervalSeconds || null }),
      eventRules: Object.freeze({ waves: this.modeId === "floodSurvival", standardLakeEvents: this.modeId !== "floodSurvival" }),
      overtimeRules: Object.freeze({ enabled: this.modeId === "goldenLily", closeScore: this.rules.overtimeCloseScore || 0 }),
      matchDuration: game.matchSeconds,
      progressionAllowed: this.rules.progressionAllowed !== false && !game.matchSettings.progressionDisabled,
    });
    this.game.modeRules = this.modeRules;
    this.scores = new Map();
    this.scoreAccumulator = 0;
    this.controlStates = [];
    this.overtime = false;
    this.overtimeStartedAt = 0;
    this.flood = {
      phase: "inactive",
      wave: 0,
      totalWaves: 0,
      phaseEndsAt: 0,
      activeEnemyIds: new Set(),
      sanctuaryOwnerId: null,
      sanctuaryTileId: null,
      sanctuaryMaxHealth: this.rules.sanctuaryHealth || 0,
      completed: false,
      lossReason: null,
      revives: this.rules.teamRevives || 0,
    };
    this.lastNestRecoveryAt = new Map();
  }

  applySettings() {
    if (this.modeId === "sandbox") this.game.matchSettings.progressionDisabled = true;
    if (this.modeId === "lastNest" || this.modeId === "floodSurvival") this.game.matchSettings.coreCaptureBehavior = "eliminate";
    if (this.modeId === "goldenLily") this.configureGoldenLilies();
    if (this.modeId === "floodSurvival") {
      this.game.objectives.clearMarkers();
      this.game.objectives.objectives = [];
      this.game.objectives.camps = [];
      this.game.objectives.objectiveOwner.clear();
      this.game.objectives.campOwner.clear();
    }
  }

  configureGoldenLilies() {
    const manager = this.game.objectives;
    const playable = this.game.tileManager.playable().length;
    const count = Math.max(3, Math.min(7, playable >= 15000 ? 7 : playable >= 10500 ? 6 : playable >= 7000 ? 5 : playable >= 3800 ? 4 : 3));
    manager.objectives.forEach((objective) => {
      const oldTile = this.game.tileManager.getById(objective.tileId);
      if (oldTile) {
        oldTile.objectiveId = null;
        oldTile.objectiveType = null;
        oldTile.specialActive = false;
      }
    });
    manager.objectives = [];
    manager.objectiveOwner.clear();
    const centers = manager.objectiveCenters(count);
    centers.forEach((center, index) => {
      const tile = manager.bestTile(center, ["lily", "water", "reeds", "mud", "nest"]);
      if (!tile) return;
      const id = `golden-control-${index + 1}`;
      tile.objectiveId = id;
      tile.objectiveType = "goldenLily";
      tile.specialActive = false;
      tile.defenseEnergy = Math.max(tile.defenseEnergy || 0, index === 0 ? 24 : 16);
      manager.objectives.push({
        id,
        type: "goldenLily",
        tileId: tile.id,
        active: false,
        appeared: false,
        activeAt: this.game.now(),
        owner: null,
        major: index === 0,
        pointValue: index === 0 ? this.rules.centralLilyScore : this.rules.scorePerLily,
      });
    });
  }

  onMatchStart() {
    const now = this.game.now();
    if (this.modeId === "goldenLily") {
      this.scores.clear();
      this.scoreAccumulator = 0;
      this.game.objectives.objectives.forEach((objective) => {
        objective.active = true;
        objective.appeared = true;
        objective.activeAt = now;
        const tile = this.game.tileManager.getById(objective.tileId);
        if (tile) tile.specialActive = true;
      });
      this.refreshControlStates();
    }
    if (this.modeId === "floodSurvival") this.startFloodPreparation(now);
    if (this.modeId === "lastNest") this.configureLastNests(now);
  }

  configureLastNests(now) {
    this.game.players.filter((player) => !player.removed).forEach((player) => {
      const core = this.game.tileManager.getById(player.coreTileId);
      if (!core) return;
      core.coreMaxHealth = this.rules.coreHealth || 220;
      core.coreHealth = core.coreMaxHealth;
      core.defenseEnergy = Math.max(core.defenseEnergy || 0, 58);
      core.lastChanged = now;
      player.coreHealth = core.coreHealth;
      player.coreMaxHealth = core.coreMaxHealth;
      player.flags.nestProtectionUntil = now + (this.modeRules.coreProtectionSeconds || 75);
    });
  }

  startFloodPreparation(now) {
    const humans = this.game.players.filter((player) => !player.isBot && !player.removed);
    const sanctuaryOwner = humans[0];
    const sanctuary = sanctuaryOwner ? this.game.tileManager.getById(sanctuaryOwner.coreTileId) : null;
    this.flood.phase = "preparation";
    this.flood.wave = 0;
    this.flood.totalWaves = this.modeRules.totalWaves || 10;
    this.flood.phaseEndsAt = now + (this.rules.preparationSeconds || 18);
    this.flood.activeEnemyIds.clear();
    this.flood.sanctuaryOwnerId = sanctuaryOwner?.id || null;
    this.flood.sanctuaryTileId = sanctuary?.id || null;
    this.flood.completed = false;
    this.flood.lossReason = null;
    if (sanctuary) {
      sanctuary.coreMaxHealth = this.rules.sanctuaryHealth || 300;
      sanctuary.coreHealth = sanctuary.coreMaxHealth;
      sanctuary.defenseEnergy = Math.max(sanctuary.defenseEnergy || 0, 72);
      sanctuaryOwner.coreHealth = sanctuary.coreHealth;
      sanctuaryOwner.coreMaxHealth = sanctuary.coreMaxHealth;
    }
    const waveNames = ["Mud Crawler", "Reed Raider", "Flood Carp", "Marsh Serpent", "Shell Breaker"];
    this.game.players.filter((player) => player.isBot).forEach((bot, index) => {
      bot.name = `${waveNames[index % waveNames.length]} ${index + 1}`;
      bot.personality = "aggressive";
      bot.aggression = Math.max(bot.aggression || 0, 0.64);
      bot.flags.floodEnemy = true;
    });
    this.game.pushEvent({ kind: "floodPreparation", message: `Flood preparation: Wave 1 begins in ${this.rules.preparationSeconds || 18}s.`, at: now });
  }

  update(dt) {
    if (this.game.phase !== spawnConfig.PHASES.PLAYING || this.game.ended) return;
    if (this.modeId === "goldenLily") this.updateControlScores(dt);
    if (this.modeId === "floodSurvival") this.updateFlood(this.game.now());
    if (this.modeId === "lastNest") this.updateLastNestRecovery(this.game.now());
  }

  ownerKey(player) {
    return this.game.teamManager?.active() && player?.teamId ? player.teamId : player?.id || null;
  }

  refreshControlStates() {
    this.controlStates = this.game.objectives.objectives.map((objective) => {
      const tile = this.game.tileManager.getById(objective.tileId);
      const ownerIds = new Set([tile, ...(tile?.neighbors || [])].map((entry) => entry?.owner).filter(Boolean));
      const keys = new Set([...ownerIds].map((id) => this.ownerKey(this.game.getPlayer(id))).filter(Boolean));
      const contested = keys.size > 1;
      const ownerKey = !contested && keys.size === 1 ? [...keys][0] : null;
      const directOwner = tile?.owner ? this.game.getPlayer(tile.owner) : null;
      objective.owner = directOwner?.id || null;
      return {
        id: objective.id,
        tileId: objective.tileId,
        ownerKey,
        ownerId: directOwner?.id || null,
        contested,
        major: Boolean(objective.major),
        pointValue: objective.pointValue || (objective.major ? 2 : 1),
      };
    });
    return this.controlStates;
  }

  updateControlScores(dt) {
    this.scoreAccumulator += Math.max(0, Number(dt) || 0);
    const interval = this.rules.scoreIntervalSeconds || 2;
    while (this.scoreAccumulator >= interval) {
      this.scoreAccumulator -= interval;
      const states = this.refreshControlStates();
      states.forEach((control) => {
        if (!control.ownerKey || control.contested) return;
        this.scores.set(control.ownerKey, (this.scores.get(control.ownerKey) || 0) + control.pointValue);
      });
    }
  }

  updateFlood(now) {
    const sanctuary = this.game.tileManager.getById(this.flood.sanctuaryTileId);
    if (!sanctuary || sanctuary.owner !== this.flood.sanctuaryOwnerId || sanctuary.coreHealth <= 0) {
      this.flood.lossReason = "sanctuaryLost";
      return;
    }
    if (this.flood.phase === "preparation" && now >= this.flood.phaseEndsAt) this.startFloodWave(now);
    else if (this.flood.phase === "active") {
      const remaining = this.floodEnemiesRemaining();
      if (remaining === 0 || now >= this.flood.phaseEndsAt) this.finishFloodWave(now);
    } else if (this.flood.phase === "recovery" && now >= this.flood.phaseEndsAt) this.startFloodWave(now);
  }

  startFloodWave(now) {
    if (this.flood.wave >= this.flood.totalWaves) {
      this.flood.completed = true;
      this.flood.phase = "complete";
      return;
    }
    this.flood.wave += 1;
    this.flood.phase = "active";
    this.flood.phaseEndsAt = now + (this.rules.waveSeconds || 34) + Math.min(16, this.flood.wave * 1.2);
    const bots = this.game.players.filter((player) => player.isBot && !player.removed && !player.defeated);
    const activeCount = Math.min(bots.length, Math.max(1, 1 + Math.ceil(this.flood.wave / 2)));
    this.flood.activeEnemyIds = new Set(bots.slice(0, activeCount).map((bot) => bot.id));
    bots.forEach((bot, index) => {
      bot.flags.floodActive = this.flood.activeEnemyIds.has(bot.id);
      bot.flags.floodElite = this.flood.wave % 3 === 0 && index === 0;
      bot.flags.floodBoss = this.flood.wave === this.flood.totalWaves && index === 0;
      if (!bot.flags.floodActive) return;
      const wavePower = 1 + this.flood.wave * 0.055 + (bot.flags.floodElite ? 0.12 : 0) + (bot.flags.floodBoss ? 0.22 : 0);
      bot.energy = Math.min(bot.maxEnergy, bot.energy + 10 + this.flood.wave * 2);
      bot.flags.floodPower = wavePower;
      bot.aggression = Math.min(0.94, 0.64 + this.flood.wave * 0.018);
      bot.aiNextThinkAt = now + 1.2 + index * 0.35;
    });
    const title = this.flood.wave === this.flood.totalWaves ? "Final Flood" : this.flood.wave % 3 === 0 ? "Elite Flood" : `Flood Wave ${this.flood.wave}`;
    this.game.pushEvent({ kind: "floodWave", wave: this.flood.wave, totalWaves: this.flood.totalWaves, message: `${title} has reached the lake.`, at: now });
  }

  finishFloodWave(now) {
    if (this.flood.wave >= this.flood.totalWaves) {
      this.flood.completed = true;
      this.flood.phase = "complete";
      this.flood.activeEnemyIds.clear();
      this.game.pushEvent({ kind: "floodComplete", message: "The final flood wave has broken.", at: now });
      return;
    }
    this.flood.phase = "recovery";
    this.flood.phaseEndsAt = now + (this.rules.recoverySeconds || 12);
    this.flood.activeEnemyIds.clear();
    this.game.players.filter((player) => !player.isBot && this.game.isPlayerAlive(player)).forEach((player) => {
      player.energy = Math.min(player.maxEnergy, player.energy + (this.rules.recoveryEnergy || 22));
    });
    this.game.pushEvent({ kind: "floodRecovery", message: `Wave ${this.flood.wave} survived. Recover and rebuild.`, at: now });
  }

  floodEnemiesRemaining() {
    return [...this.flood.activeEnemyIds].filter((id) => this.game.isPlayerAlive(this.game.getPlayer(id))).length;
  }

  canBotAct(bot) {
    if (this.modeId !== "floodSurvival") return true;
    return this.flood.phase === "active" && this.flood.activeEnemyIds.has(bot.id);
  }

  updateLastNestRecovery(now) {
    this.game.players.filter((player) => this.game.isPlayerAlive(player) && this.game.hasOwnedCore(player)).forEach((player) => {
      if (this.game.ownedTileCount(player) > 2 || now < (this.lastNestRecoveryAt.get(player.id) || 0)) return;
      const core = this.game.tileManager.getById(player.coreTileId);
      const neutral = core?.neighbors?.find((tile) => !tile.owner && !tile.objectiveId && !tile.campId);
      if (neutral) {
        neutral.owner = player.id;
        neutral.captureProgress = {};
        neutral.lastChanged = now;
      }
      player.energy = Math.min(player.maxEnergy, player.energy + 8);
      this.lastNestRecoveryAt.set(player.id, now + (this.rules.coreRecoverySeconds || 8));
    });
  }

  shouldEliminateForNoTerritory(player) {
    if (this.modeId === "lastNest" && this.game.hasOwnedCore(player)) return false;
    return this.rules.noTerritoryEliminates !== false;
  }

  beforeAction(player, body = {}) {
    const attackTypes = new Set(["attack", "startContinuousAttack", "waterRoute"]);
    if (body.type === "special" && body.specialType === "lilyBarrage") attackTypes.add("special");
    if (attackTypes.has(body.type) && this.game.now() < (player.flags?.reviveAttackLockUntil || 0)) {
      return { ok: false, message: `Revive protection active for ${Math.ceil(player.flags.reviveAttackLockUntil - this.game.now())}s. Attacking is locked.` };
    }
    return null;
  }

  evaluateWin() {
    if (this.game.phase !== spawnConfig.PHASES.PLAYING || this.game.ended || this.modeId === "sandbox") return null;
    if (this.modeId === "classic") return this.checkClassicEliminationWin();
    if (this.modeId === "goldenLily") return this.checkGoldenLilyControlWin();
    if (this.modeId === "floodSurvival") return this.checkFloodSurvivalWin();
    if (this.modeId === "lastNest") return this.checkLastNestWin();
    throw new Error(`No win-condition handler for mode "${this.modeId}".`);
  }

  checkClassicEliminationWin() {
    const alive = this.game.players.filter((player) => this.game.isPlayerAlive(player));
    if (this.game.teamManager?.active()) {
      const teamIds = [...new Set(alive.map((player) => player.teamId).filter(Boolean))];
      return teamIds.length === 1 ? this.resultForKey(teamIds[0], "lastTeamRemaining") : null;
    }
    return alive.length === 1 ? { winnerId: alive[0].id, winnerTeamId: null, reason: "lastAnimalRemaining" } : null;
  }

  checkGoldenLilyControlWin() {
    const target = this.modeRules.scoreTarget || 500;
    const ranked = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
    if (this.overtime) {
      const contested = this.refreshControlStates().some((control) => control.contested);
      if (!contested && ranked.length && ranked[0][1] > (ranked[1]?.[1] || 0)) return this.resultForKey(ranked[0][0], "overtimeControlSecured");
      return null;
    }
    const winner = ranked.find(([, score]) => score >= target);
    return winner ? this.resultForKey(winner[0], "scoreTargetReached") : null;
  }

  checkFloodSurvivalWin() {
    const humans = this.game.players.filter((player) => !player.isBot && !player.removed);
    const livingHumans = humans.filter((player) => this.game.isPlayerAlive(player));
    const sanctuary = this.game.tileManager.getById(this.flood.sanctuaryTileId);
    if (!sanctuary || sanctuary.owner !== this.flood.sanctuaryOwnerId || sanctuary.coreHealth <= 0) {
      this.flood.lossReason = "sanctuaryLost";
      return this.floodEnemyResult("sanctuaryLost");
    }
    if (!livingHumans.length) return this.floodEnemyResult("allDefendersEliminated");
    if (this.flood.completed) return { winnerId: livingHumans[0].id, winnerTeamId: livingHumans[0].teamId || null, reason: "allWavesSurvived" };
    return null;
  }

  floodEnemyResult(reason) {
    const enemy = this.game.players.find((player) => player.isBot && this.game.isPlayerAlive(player)) || this.game.players.find((player) => player.isBot);
    return { winnerId: enemy?.id || null, winnerTeamId: enemy?.teamId || null, reason };
  }

  checkLastNestWin() {
    const living = this.game.players.filter((player) => !player.removed && this.game.hasOwnedCore(player));
    if (this.game.teamManager?.active()) {
      const teams = [...new Set(living.map((player) => player.teamId).filter(Boolean))];
      return teams.length === 1 ? this.resultForKey(teams[0], "lastNestStanding") : null;
    }
    return living.length === 1 ? { winnerId: living[0].id, winnerTeamId: null, reason: "finalEnemyNestCaptured" } : null;
  }

  resultForKey(key, reason) {
    if (this.game.teamManager?.active() && String(key).startsWith("team-")) {
      const member = this.game.players.filter((player) => player.teamId === key && this.game.isPlayerAlive(player)).sort((a, b) => this.game.ownedTileCount(b) - this.game.ownedTileCount(a))[0];
      return { winnerId: member?.id || null, winnerTeamId: key, reason };
    }
    return { winnerId: key, winnerTeamId: null, reason };
  }

  timerWinner() {
    if (this.modeId === "floodSurvival" || this.modeId === "sandbox") return null;
    if (this.modeId === "goldenLily") {
      const ranked = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
      if (!ranked.length) return null;
      const contested = this.refreshControlStates().some((control) => control.contested);
      const close = ranked.length > 1 && ranked[0][1] - ranked[1][1] <= (this.rules.overtimeCloseScore || 10);
      if (contested || close) {
        this.overtime = true;
        this.overtimeStartedAt = this.game.now();
        this.game.pushEvent({ kind: "overtime", message: "Golden Lily Overtime: secure uncontested control to win.", at: this.game.now() });
        return null;
      }
      return this.resultForKey(ranked[0][0], "highestScoreAtTimeLimit");
    }
    if (this.modeId === "lastNest") {
      const living = this.game.players.filter((player) => this.game.hasOwnedCore(player));
      const leader = living.sort((a, b) => (b.coreHealth || 0) - (a.coreHealth || 0) || this.game.ownedTileCount(b) - this.game.ownedTileCount(a))[0];
      return leader ? { winnerId: leader.id, winnerTeamId: leader.teamId || null, reason: "strongestNestAtTimeLimit" } : null;
    }
    const alive = this.game.players.filter((player) => this.game.isPlayerAlive(player));
    if (this.game.teamManager?.active()) {
      const team = this.game.teamManager.territoryStats(this.game.players, this.game.tileManager.playable().length).filter((entry) => this.game.isTeamAlive(entry.id)).sort((a, b) => b.territory - a.territory)[0];
      return team ? this.resultForKey(team.id, "highestTerritoryAtTimeLimit") : null;
    }
    const leader = alive.sort((a, b) => this.game.ownedTileCount(b) - this.game.ownedTileCount(a))[0];
    return leader ? { winnerId: leader.id, winnerTeamId: null, reason: "highestTerritoryAtTimeLimit" } : null;
  }

  winStatus() {
    if (this.modeId === "classic") return { reason: "Classic ends when one animal or team remains." };
    if (this.modeId === "goldenLily") return { reason: this.overtime ? "Overtime: secure uncontested Lily control." : "The first side to the control score target wins." };
    if (this.modeId === "floodSurvival") return { reason: "The match ends when every wave is survived or the defenders lose." };
    if (this.modeId === "lastNest") return { reason: "Only Core Nests determine elimination and victory." };
    return { reason: "Match ending is disabled." };
  }

  endMessage(result, winner, winnerTeam) {
    const count = this.flood.totalWaves || 0;
    const score = winnerTeam ? this.scores.get(winnerTeam.id) : winner ? this.scores.get(winner.id) : 0;
    const messages = {
      lastAnimalRemaining: `${winner?.name || "An animal"} wins as the last animal remaining.`,
      lastTeamRemaining: `${winnerTeam?.name || "A team"} wins as the last team remaining.`,
      scoreTargetReached: `${winnerTeam?.name || winner?.name || "The leader"} wins with ${Math.floor(score || 0)} Golden Lily points.`,
      overtimeControlSecured: `${winnerTeam?.name || winner?.name || "The leader"} secured uncontested Lily control in Overtime.`,
      highestScoreAtTimeLimit: `${winnerTeam?.name || winner?.name || "The leader"} wins with the highest Golden Lily score.`,
      allWavesSurvived: `Victory: all ${count} flood waves survived.`,
      sanctuaryLost: "Defeat: the Sanctuary Nest was lost.",
      allDefendersEliminated: "Defeat: all pond defenders were eliminated.",
      lastNestStanding: `${winnerTeam?.name || winner?.name || "The winner"} has the last Core Nest standing.`,
      finalEnemyNestCaptured: `${winner?.name || "The winner"} captured the final enemy Core Nest.`,
      strongestNestAtTimeLimit: `${winnerTeam?.name || winner?.name || "The winner"} has the strongest surviving Nest.`,
      highestTerritoryAtTimeLimit: `${winnerTeam?.name || winner?.name || "The winner"} controls the most territory at time.`,
    };
    return messages[result?.reason] || "The match ended by its active mode rules.";
  }

  snapshot() {
    const scoreTarget = this.modeId === "goldenLily" ? this.modeRules.scoreTarget : null;
    const controls = this.modeId === "goldenLily" ? this.refreshControlStates() : [];
    const nests = this.modeId === "lastNest"
      ? this.game.players.filter((player) => !player.removed).map((player) => {
          const core = this.game.tileManager.getById(player.coreTileId);
          const ratio = (core?.coreHealth || 0) / Math.max(1, core?.coreMaxHealth || 1);
          const status = !this.game.hasOwnedCore(player) ? "Captured" : player.flags?.coreUnderAttack ? ratio <= 0.25 ? "Critical" : "Under Attack" : ratio < 0.7 ? "Threatened" : "Safe";
          return { playerId: player.id, teamId: player.teamId || null, tileId: player.coreTileId, health: Math.round(core?.coreHealth || 0), maxHealth: Math.round(core?.coreMaxHealth || 0), status };
        })
      : [];
    const floodSanctuary = this.game.tileManager.getById(this.flood.sanctuaryTileId);
    const phaseCountdown = this.modeId === "floodSurvival" && ["preparation", "active", "recovery"].includes(this.flood.phase) ? Math.max(0, Math.ceil(this.flood.phaseEndsAt - this.game.now())) : 0;
    return {
      activeModeId: this.modeId,
      activeModeName: this.rules.label,
      id: this.modeId,
      label: this.rules.label,
      icon: this.rules.icon || "PF",
      description: this.rules.short,
      primaryObjective: this.rules.primaryObjective,
      tutorial: this.rules.tutorial || [],
      winType: this.rules.winConditionType,
      eliminationEnabled: this.rules.eliminationEnabled,
      scoreTarget,
      currentScore: this.scores.size ? Math.max(...this.scores.values()) : 0,
      scores: [...this.scores.entries()].map(([id, score]) => ({ id, score: Math.floor(score) })).sort((a, b) => b.score - a.score),
      controls,
      controlledLilies: controls.filter((control) => control.ownerKey).length,
      contestedLilies: controls.filter((control) => control.contested).length,
      overtime: this.overtime,
      wave: this.flood.wave,
      waveTarget: this.flood.totalWaves || null,
      remainingWaves: this.flood.totalWaves ? Math.max(0, this.flood.totalWaves - this.flood.wave) : null,
      wavePhase: this.flood.phase,
      enemiesRemaining: this.modeId === "floodSurvival" ? this.floodEnemiesRemaining() : null,
      nextWaveCountdown: phaseCountdown,
      sanctuary: this.modeId === "floodSurvival" ? { tileId: this.flood.sanctuaryTileId, health: Math.round(floodSanctuary?.coreHealth || 0), maxHealth: Math.round(floodSanctuary?.coreMaxHealth || this.flood.sanctuaryMaxHealth || 0), status: this.flood.lossReason ? "Lost" : "Protected" } : null,
      revives: this.flood.revives,
      nests,
      nestsRemaining: nests.filter((nest) => nest.status !== "Captured").length,
      nestProtectionRemaining: this.modeId === "lastNest" ? Math.max(0, Math.ceil((this.modeRules.coreProtectionSeconds || 75) - this.game.elapsed())) : 0,
      modeSpecificState: this.modeId === "goldenLily" ? { controls, overtime: this.overtime } : this.modeId === "floodSurvival" ? { phase: this.flood.phase, completed: this.flood.completed, lossReason: this.flood.lossReason } : this.modeId === "lastNest" ? { nests } : {},
    };
  }
}

module.exports = GameModeManager;
