const modifierConfig = require("../shared/modifierConfig");
const spawnConfig = require("../shared/spawnConfig");

class ModifierManager {
  constructor(game) {
    this.game = game;
    this.enabled = modifierConfig.sanitize(game.matchSettings.modifiers || {}, {
      privateMatch: game.matchSettings.privateMatch,
      customMatch: game.matchSettings.customMatch,
      sandbox: game.matchSettings.sandbox?.enabled,
      publicMatch: game.matchSettings.publicMatch,
      ranked: game.matchSettings.ranked,
    });
    this.activeIds = Object.keys(this.enabled);
    this.modified = this.activeIds.length > 0;
    if (this.modified) game.matchSettings.progressionDisabled = true;
  }

  applySettings() {
    if (this.enabled.fastMatch) this.game.matchSeconds = Math.max(120, Math.round(this.game.matchSeconds * 0.6));
    if (this.enabled.longMatch) this.game.matchSeconds = Math.round(this.game.matchSeconds * 1.8);
    if (this.enabled.giantBotArmy) this.game.matchSettings.giantBotArmy = true;
  }

  applyPlayerSetup(player) {
    if (this.enabled.fastAbilities) player.flags.modifierAbilityCooldownMultiplier = 0.45;
    if (this.enabled.strongerAbilities) player.flags.modifierAbilityPower = 1.3;
    if (this.enabled.cheapBuildings) player.flags.modifierBuildingCostMultiplier = 0.5;
    if (this.enabled.fastBuildings) player.flags.modifierBuildTimeMultiplier = 0.35;
    if (this.enabled.unlimitedCurrentPush) player.flags.unlimitedCurrentPush = true;
    if (this.enabled.bossAnimal && player.isBot && !this.game.players.some((entry) => entry.flags?.bossAnimal)) {
      player.flags.bossAnimal = true;
      player.energy *= 1.7;
      player.maxEnergy *= 1.7;
    }
  }

  startingTerritoryRadius() {
    return this.enabled.extraTerritory ? spawnConfig.EXTRA_TERRITORY_RADIUS : spawnConfig.START_RADIUS;
  }

  incomeMultiplier() {
    if (this.enabled.tripleIncome) return 3;
    if (this.enabled.doubleIncome) return 2;
    return 1;
  }

  buildingCostMultiplier() {
    return this.enabled.cheapBuildings ? 0.5 : 1;
  }

  buildTimeMultiplier() {
    return this.enabled.fastBuildings ? 0.35 : 1;
  }

  beforeAction(player, body = {}) {
    if (this.enabled.noBuildings && ["build", "upgradeBuilding"].includes(body.type)) return { ok: false, message: "Buildings are disabled for this custom match." };
    if (this.enabled.noSpecials && body.type === "special") return { ok: false, message: "Special attacks are disabled for this custom match." };
    if (this.enabled.unlimitedCurrentPush && body.type === "waterRoute") player.currentPushCooldownUntil = 0;
    return null;
  }

  afterAction(player, body = {}, result = {}) {
    if (!result.ok) return;
    if (this.enabled.fastAbilities && body.type === "ability") {
      const now = this.game.now();
      player.abilityReadyAt = now + Math.max(5, (player.abilityReadyAt - now) * 0.45);
    }
    if (this.enabled.unlimitedCurrentPush && body.type === "waterRoute") player.currentPushCooldownUntil = 0;
  }

  update() {
    if (this.game.phase !== spawnConfig.PHASES.PLAYING) return;
    if (this.enabled.unlimitedEnergy) {
      this.game.players.filter((player) => !player.isBot && !player.defeated).forEach((player) => {
        player.energy = player.maxEnergy;
      });
    }
    if (this.enabled.sharedTeamEnergy && this.game.teamManager?.active()) {
      const teams = new Map();
      this.game.players.filter((player) => !player.defeated && player.teamId).forEach((player) => {
        if (!teams.has(player.teamId)) teams.set(player.teamId, []);
        teams.get(player.teamId).push(player);
      });
      teams.forEach((members) => {
        const ratio = members.reduce((sum, player) => sum + player.energy / Math.max(1, player.maxEnergy), 0) / members.length;
        members.forEach((player) => {
          player.energy = Math.min(player.maxEnergy, player.maxEnergy * ratio);
        });
      });
    }
  }

  shouldDisableProgression() {
    return this.modified || Boolean(this.game.matchSettings.progressionDisabled);
  }

  snapshot() {
    return {
      modified: this.modified,
      progressionDisabled: this.shouldDisableProgression(),
      label: this.modified ? "Modified Match - Progression Disabled" : "Standard Match",
      active: this.activeIds.map((id) => ({ id, label: modifierConfig.definitions[id]?.label || id })),
    };
  }
}

module.exports = ModifierManager;
