const gameModeConfig = require("../shared/gameModeConfig");
const spawnConfig = require("../shared/spawnConfig");

class GameModeManager {
  constructor(game) {
    this.game = game;
    this.modeId = game.matchSettings.ruleMode || "classic";
    this.rules = gameModeConfig.modes[this.modeId] || gameModeConfig.modes.classic;
    this.scores = new Map();
    this.lastScoreTickAt = 0;
    this.tide = 0;
    this.kingId = null;
    this.migrationIndex = 0;
    this.nextMigrationAt = 0;
    this.migrationTiles = [];
  }

  applySettings() {
    if (this.rules.matchMultiplier) this.game.matchSeconds = Math.max(120, Math.round(this.game.matchSeconds * this.rules.matchMultiplier));
    if (this.modeId === "lastNest") this.game.matchSettings.coreCaptureBehavior = "eliminate";
    if (this.modeId === "pondRush") {
      this.game.players.forEach((player) => {
        player.flags.modifierBuildTimeMultiplier = Math.min(player.flags.modifierBuildTimeMultiplier || 1, 0.65);
      });
    }
    if (this.modeId === "sandbox") this.game.matchSettings.progressionDisabled = true;
    this.ensureControlObjective();
  }

  ensureControlObjective() {
    if (this.modeId !== "goldenLily" && this.modeId !== "riverDomination") return;
    const accepted =
      this.modeId === "goldenLily"
        ? new Set(["goldenLily", "goldenLilyBasin", "goldenLotus", "lotusField"])
        : new Set(["riverGate", "canalGate", "deepCurrent", "riverShrine", "clearWaterShrine"]);
    if (this.game.objectives.objectives.some((objective) => accepted.has(objective.type))) return;
    const objective = this.game.objectives.objectives[0];
    if (!objective) return;
    objective.type = this.modeId === "goldenLily" ? "goldenLily" : "riverGate";
    const tile = this.game.tileManager.getById(objective.tileId);
    if (tile) tile.objectiveType = objective.type;
  }

  onMatchStart() {
    const now = this.game.now();
    this.lastScoreTickAt = now;
    this.nextMigrationAt = now + (this.rules.migrationSeconds || 70);
    if (this.modeId === "animalKing") this.chooseKing();
    if (this.modeId === "floodSurvival") {
      this.game.players.filter((player) => player.isBot).forEach((bot) => {
        bot.personality = "aggressive";
        bot.aggression = Math.max(bot.aggression || 0, 0.68);
      });
    }
  }

  chooseKing() {
    const candidates = this.game.players.filter((player) => player.isBot && !player.removed);
    const king = candidates[Math.floor(Math.random() * candidates.length)] || this.game.players.find((player) => !player.removed);
    if (!king) return;
    this.kingId = king.id;
    king.flags = king.flags || {};
    king.flags.kingAnimal = true;
    king.flags.modifierAbilityPower = Math.max(king.flags.modifierAbilityPower || 1, 1.35);
    king.flags.modifierAbilityCooldownMultiplier = Math.min(king.flags.modifierAbilityCooldownMultiplier || 1, 0.72);
    king.energy *= this.rules.kingEnergyMultiplier || 1.5;
    king.maxEnergy *= this.rules.kingEnergyMultiplier || 1.5;
    const challengers = this.game.players.filter((player) => player.id !== king.id && !player.removed);
    challengers.forEach((player) => {
      player.enemies.add(king.id);
      king.enemies.add(player.id);
      challengers.forEach((other) => {
        if (other.id !== player.id) player.allies.add(other.id);
      });
    });
    this.game.pushEvent({ kind: "kingChosen", playerId: king.id, to: king.coreTileId, message: `${king.name} is the King Animal.`, at: this.game.now() });
  }

  ownerKey(player) {
    return this.game.teamManager?.active() && player?.teamId ? player.teamId : player?.id || null;
  }

  update(dt) {
    if (this.game.phase !== spawnConfig.PHASES.PLAYING || this.game.ended) return;
    const now = this.game.now();
    if (this.modeId === "goldenLily" || this.modeId === "riverDomination") this.updateControlScores(dt);
    if (this.modeId === "floodSurvival") this.updateSurvival(now);
    if (this.modeId === "migration" && now >= this.nextMigrationAt) this.advanceMigration(now);
  }

  updateControlScores(dt) {
    const desiredTypes =
      this.modeId === "goldenLily"
        ? new Set(["goldenLily", "goldenLilyBasin", "goldenLotus", "lotusField"])
        : new Set(["riverGate", "canalGate", "deepCurrent", "riverShrine", "clearWaterShrine"]);
    this.game.objectives.objectives.forEach((objective) => {
      const tile = this.game.tileManager.getById(objective.tileId);
      const player = tile?.owner ? this.game.getPlayer(tile.owner) : null;
      if (!player || !desiredTypes.has(objective.type)) return;
      const key = this.ownerKey(player);
      this.scores.set(key, (this.scores.get(key) || 0) + dt * 2);
      if (this.modeId === "riverDomination") player.flags.routePowerBonus = Math.max(player.flags.routePowerBonus || 0, 0.08);
    });
  }

  updateSurvival(now) {
    const nextTide = Math.min(this.rules.survivalTides || 8, Math.floor(this.game.elapsed() / (this.rules.tideSeconds || 45)) + 1);
    if (nextTide <= this.tide) return;
    this.tide = nextTide;
    this.game.players.filter((player) => player.isBot && !player.defeated).forEach((bot) => {
      bot.energy = Math.min(bot.maxEnergy, bot.energy + 8 + this.tide * 2);
      bot.aggression = Math.min(0.95, (bot.aggression || 0.5) + 0.025);
    });
    this.game.pushEvent({ kind: "survivalTide", tide: this.tide, message: `Flood Tide ${this.tide}/${this.rules.survivalTides} is rising.`, at: now });
  }

  advanceMigration(now) {
    this.migrationTiles.forEach((entry) => {
      const tile = this.game.tileManager.getById(entry.tileId);
      if (tile && tile.type === "mud" && tile.migrationChanged) {
        tile.type = entry.originalType;
        tile.migrationChanged = false;
        tile.lastChanged = now;
      }
    });
    this.migrationTiles = [];
    this.migrationIndex += 1;
    this.nextMigrationAt = now + (this.rules.migrationSeconds || 70);
    const regions = this.game.tileManager.regions || [];
    const safeRegion = regions.length ? regions[this.migrationIndex % regions.length] : null;
    if (safeRegion) {
      const outside = this.game.tileManager
        .playable()
        .filter((tile, index) => {
          if (tile.owner || tile.objectiveId || tile.campId || tile.type === "nest" || index % 19 !== this.migrationIndex % 19) return false;
          return Math.hypot(tile.x - safeRegion.x, tile.y - safeRegion.y) > safeRegion.radius * 2.2;
        })
        .slice(0, 72);
      outside.forEach((tile) => {
        this.migrationTiles.push({ tileId: tile.id, originalType: tile.type });
        tile.type = "mud";
        tile.migrationChanged = true;
        tile.lastChanged = now;
      });
    }
    this.game.pushEvent({
      kind: "migrationShift",
      regionId: safeRegion?.id || null,
      affectedTiles: this.migrationTiles.map((entry) => entry.tileId),
      message: safeRegion?.name ? `Migration water shifted toward ${safeRegion.name}.` : "Migration water shifted across the pond.",
      at: now,
    });
  }

  beforeAction(player, body = {}) {
    const attackTypes = new Set(["attack", "startContinuousAttack", "waterRoute"]);
    if (body.type === "special" && body.specialType === "lilyBarrage") attackTypes.add("special");
    if (attackTypes.has(body.type) && this.game.now() < (player.flags?.reviveAttackLockUntil || 0)) {
      return { ok: false, message: `Revive protection active for ${Math.ceil(player.flags.reviveAttackLockUntil - this.game.now())}s. Attacking is locked.` };
    }
    if (this.modeId === "peacefulExpansion" && attackTypes.has(body.type) && this.game.elapsed() < (this.rules.peaceSeconds || 90)) {
      const left = Math.ceil((this.rules.peaceSeconds || 90) - this.game.elapsed());
      return { ok: false, message: `Preparation tide active. Combat opens in ${left}s.` };
    }
    return null;
  }

  evaluateWin() {
    if (this.game.phase !== spawnConfig.PHASES.PLAYING || this.game.ended) return null;
    if (this.modeId === "goldenLily" || this.modeId === "riverDomination") {
      const winner = [...this.scores.entries()].sort((a, b) => b[1] - a[1]).find(([, score]) => score >= (this.rules.scoreTarget || 300));
      return winner ? this.resultForKey(winner[0], this.modeId === "goldenLily" ? "goldenLilyControl" : "riverDomination") : null;
    }
    if (this.modeId === "pondRush") {
      const playable = Math.max(1, this.game.tileManager.playable().length);
      if (this.game.teamManager?.active()) {
        const team = this.game.teamManager.territoryStats(this.game.players, playable).find((entry) => entry.territoryPct >= (this.rules.territoryTarget || 0.45));
        return team ? this.resultForKey(team.id, "pondRushTarget") : null;
      }
      const player = this.game.players.find((entry) => this.game.isPlayerAlive(entry) && this.game.ownedTileCount(entry) / playable >= (this.rules.territoryTarget || 0.45));
      return player ? { winnerId: player.id, winnerTeamId: null, reason: "pondRushTarget" } : null;
    }
    if (this.modeId === "floodSurvival" && this.tide >= (this.rules.survivalTides || 8)) {
      const human = this.game.players.find((player) => !player.isBot && this.game.isPlayerAlive(player));
      if (human) return { winnerId: human.id, winnerTeamId: human.teamId || null, reason: "floodSurvived" };
    }
    if (this.modeId === "lastNest") {
      const living = this.game.players.filter((player) => !player.removed && !player.defeated && this.game.hasOwnedCore(player));
      if (this.game.teamManager?.active()) {
        const teams = [...new Set(living.map((player) => player.teamId).filter(Boolean))];
        if (teams.length === 1) return this.resultForKey(teams[0], "lastNest");
      } else if (living.length === 1) return { winnerId: living[0].id, winnerTeamId: null, reason: "lastNest" };
      return null;
    }
    if (this.modeId === "animalKing" && this.kingId) {
      const king = this.game.getPlayer(this.kingId);
      const challengers = this.game.players.filter((player) => player.id !== this.kingId && this.game.isPlayerAlive(player));
      if (!this.game.isPlayerAlive(king) && challengers.length) return { winnerId: challengers[0].id, winnerTeamId: challengers[0].teamId || null, reason: "kingDefeated" };
      if (this.game.isPlayerAlive(king) && !challengers.length) return { winnerId: king.id, winnerTeamId: king.teamId || null, reason: "kingSurvived" };
    }
    return null;
  }

  resultForKey(key, reason) {
    if (this.game.teamManager?.active() && String(key).startsWith("team-")) {
      const member = this.game.players.filter((player) => player.teamId === key && this.game.isPlayerAlive(player)).sort((a, b) => this.game.ownedTileCount(b) - this.game.ownedTileCount(a))[0];
      return { winnerId: member?.id || null, winnerTeamId: key, reason };
    }
    return { winnerId: key, winnerTeamId: null, reason };
  }

  timerWinner() {
    if ((this.modeId === "goldenLily" || this.modeId === "riverDomination") && this.scores.size) {
      const [key] = [...this.scores.entries()].sort((a, b) => b[1] - a[1])[0];
      return this.resultForKey(key, "timerScore");
    }
    return null;
  }

  snapshot() {
    const peaceLeft = this.modeId === "peacefulExpansion" ? Math.max(0, (this.rules.peaceSeconds || 90) - this.game.elapsed()) : 0;
    return {
      id: this.modeId,
      label: this.rules.label,
      description: this.rules.short,
      winType: this.rules.win,
      scoreTarget: this.rules.scoreTarget || null,
      territoryTarget: this.rules.territoryTarget || null,
      scores: [...this.scores.entries()].map(([id, score]) => ({ id, score: Math.floor(score) })).sort((a, b) => b.score - a.score),
      tide: this.tide,
      tideTarget: this.rules.survivalTides || null,
      kingId: this.kingId,
      combatLocked: peaceLeft > 0,
      peaceLeft: Math.ceil(peaceLeft),
      migrationIndex: this.migrationIndex,
      nextMigrationAt: this.nextMigrationAt,
    };
  }
}

module.exports = GameModeManager;
