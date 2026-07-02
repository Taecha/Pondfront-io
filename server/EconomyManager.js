const config = require("../shared/gameConfig");
const animals = require("../shared/animals");
const balance = config.BALANCE;

class EconomyManager {
  constructor(tileManager) {
    this.tileManager = tileManager;
  }

  update(players, dt, now = Date.now() / 1000) {
    this.recalculate(players, now);
    players.forEach((player) => {
      if (player.defeated) return;
      player.flags.warExhaustion = Math.max(0, (player.flags.warExhaustion || 0) - balance.warExhaustionDecayPerSecond * dt);
      player.energy = Math.min(player.maxEnergy, player.energy + player.income * dt);
      player.energy = Math.max(0, player.energy);
    });
  }

  recalculate(players, now = Date.now() / 1000) {
    players.forEach((player) => {
      const preservedFlags = player.flags || {};
      player.territory = 0;
      player.maxEnergy = balance.maxEnergyBase;
      player.flags = { ...preservedFlags, jumpPad: false, mudTunnel: false };
      player.buildings = { nest: 0, lilyFarm: 0, reedGuard: 0, mudTunnel: 0, jumpPad: 0 };
      player.incomeBreakdown = {
        base: balance.baseIncome,
        territory: 0,
        terrain: 0,
        buildings: 0,
        animal: 0,
        recovery: 0,
        temporary: 0,
      };
    });

    this.tileManager.tiles.forEach((tile) => {
      if (!tile.owner || config.TILE_TYPES[tile.type].blocks) return;
      const player = players.find((candidate) => candidate.id === tile.owner);
      if (!player || player.defeated) return;
      const type = config.TILE_TYPES[tile.type];

      player.territory += 1;
      player.maxEnergy += balance.maxEnergyPerTile;
      player.incomeBreakdown.territory += balance.territoryIncome;
      player.incomeBreakdown.terrain += type.incomeBonus * balance.terrainIncomeMultiplier;

      if (player.animal === "duck") player.maxEnergy += balance.duckMaxEnergyPerTile;
      if (player.animal === "frog" && tile.type === "lily") player.incomeBreakdown.animal += balance.frogLilyBonus;

      this.applyBuilding(player, tile, now);
    });

    players.forEach((player) => {
      const playable = this.tileManager.playable().length || 1;
      const territoryPct = player.territory / playable;
      if (territoryPct < balance.recoveryTerritoryPct && player.territory > 0) {
        player.incomeBreakdown.recovery += balance.recoveryIncomeMax * (1 - territoryPct / balance.recoveryTerritoryPct);
      }
      if (player.animal === "duck" && player.abilityActiveUntil > now) player.incomeBreakdown.temporary += 0.25;
      player.income = Object.values(player.incomeBreakdown).reduce((sum, value) => sum + value, 0);
      if (player.income > balance.empireIncomeSoftCap) {
        player.income =
          balance.empireIncomeSoftCap + (player.income - balance.empireIncomeSoftCap) * (1 - balance.empireIncomeDamping);
      }
      if (player.animal === "duck") player.maxEnergy *= 1.08;
      player.energy = Math.min(player.energy, player.maxEnergy);
      if (player.territory <= 0 && !player.defeated) player.defeated = true;
    });
  }

  applyBuilding(player, tile, now) {
    if (!tile.building) return;
    const level = Math.max(1, Math.min(3, Number(tile.buildingLevel) || 1));
    const boost = 1 + (level - 1) * 0.42;
    player.buildings[tile.building] += 1;
    if (tile.buildingActiveAt && now < tile.buildingActiveAt) return;
    if (tile.building === "nest") {
      player.maxEnergy += balance.nestMaxEnergyBonus * boost;
      player.incomeBreakdown.buildings += balance.nestIncomeBonus * level;
    }
    if (tile.building === "lilyFarm") {
      const nearEnemy = tile.neighbors?.some((neighbor) => neighbor.owner && neighbor.owner !== player.id) ? balance.farmBorderPenalty : 0;
      player.incomeBreakdown.buildings += Math.max(0.35, (balance.farmIncomeBonus + (tile.type === "lily" ? balance.farmLilyBonus : 0) - nearEnemy) * boost);
      if (player.animal === "frog") player.incomeBreakdown.animal += balance.farmFrogBonus * level;
    }
    if (tile.building === "reedGuard") player.incomeBreakdown.buildings += balance.reedGuardIncomeBonus * level;
    if (tile.building === "mudTunnel") {
      player.flags.mudTunnel = true;
      player.incomeBreakdown.buildings += balance.mudTunnelIncomeBonus * level;
    }
    if (tile.building === "jumpPad") {
      player.flags.jumpPad = true;
      player.maxEnergy += balance.jumpPadMaxEnergyBonus * boost;
    }
  }

  buildingCost(player, buildingType) {
    const building = config.BUILDINGS[buildingType];
    if (!building) return Infinity;
    if (buildingType !== "lilyFarm") return building.cost;
    const farms = player.buildings?.lilyFarm || 0;
    return Math.round(balance.farmBaseCost * Math.pow(1 + balance.farmCostGrowth, farms));
  }

  maxLilyFarms(player) {
    return Math.max(1, Math.floor(Math.max(0, player.territory) / balance.farmTerritoryPerFarm) + 1);
  }

  hasLilyFarmSupport(tile) {
    if (!tile) return false;
    if (tile.type === "lily" || tile.type === "nest") return true;
    return tile.neighbors?.some((neighbor) => neighbor.type === "lily" || neighbor.type === "nest");
  }

  canBuild(player, tile, buildingType) {
    const building = config.BUILDINGS[buildingType];
    if (!building || !tile || tile.owner !== player.id || tile.building) return false;
    if (building.animal && building.animal !== player.animal) return false;
    if (!building.validTiles.includes(tile.type)) return false;
    if (buildingType === "lilyFarm") {
      if ((player.buildings?.lilyFarm || 0) >= this.maxLilyFarms(player)) return false;
      if (!this.hasLilyFarmSupport(tile)) return false;
    }
    return player.energy >= this.buildingCost(player, buildingType);
  }

  build(player, tile, buildingType, now) {
    if (!this.canBuild(player, tile, buildingType)) {
      return { ok: false, message: "Cannot build there." };
    }
    const building = config.BUILDINGS[buildingType];
    const cost = this.buildingCost(player, buildingType);
    player.energy -= cost;
    tile.building = buildingType;
    tile.buildingLevel = 1;
    tile.buildingActiveAt = buildingType === "lilyFarm" ? now + balance.farmActivationTime : now;
    tile.lastChanged = now;
    player.stats.buildingsBuilt = (player.stats.buildingsBuilt || 0) + 1;
    return { ok: true, message: buildingType === "lilyFarm" ? `${building.label} planted. Active in ${balance.farmActivationTime}s.` : `${building.label} built.` };
  }

  upgradeBuilding(player, tile, now) {
    if (!tile || tile.owner !== player.id || !tile.building) return { ok: false, message: "Choose one of your buildings." };
    const building = config.BUILDINGS[tile.building];
    const level = Math.max(1, Number(tile.buildingLevel) || 1);
    if (level >= 3) return { ok: false, message: "Building is already max level." };
    const cost = Math.round((building?.cost || 40) * (0.72 + level * 0.55));
    if (player.energy < cost) return { ok: false, message: "Not enough Animal Energy." };
    player.energy -= cost;
    tile.buildingLevel = level + 1;
    tile.defenseEnergy = Math.min(90, tile.defenseEnergy + 8 + level * 4);
    tile.lastChanged = now;
    return { ok: true, message: `${building?.label || "Building"} upgraded to level ${tile.buildingLevel}.` };
  }

  removeBuilding(player, tile, now) {
    if (!tile || tile.owner !== player.id || !tile.building) return { ok: false, message: "Choose one of your buildings." };
    const building = config.BUILDINGS[tile.building];
    tile.building = null;
    tile.buildingLevel = 0;
    tile.buildingActiveAt = 0;
    tile.lastChanged = now;
    return { ok: true, message: `${building?.label || "Building"} removed.` };
  }

  animalPerk(player) {
    return animals[player.animal]?.perk || "";
  }
}

module.exports = EconomyManager;
