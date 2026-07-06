const config = require("../shared/gameConfig");
const animals = require("../shared/animals");
const objectiveConfig = require("../shared/objectives");
const balance = config.BALANCE;

class EconomyManager {
  constructor(tileManager) {
    this.tileManager = tileManager;
  }

  update(players, dt, now = Date.now() / 1000, game = null) {
    this.recalculate(players, now, game);
    this.completeBuildings(now, game);
    players.forEach((player) => {
      if (player.defeated) return;
      player.flags.warExhaustion = Math.max(0, (player.flags.warExhaustion || 0) - balance.warExhaustionDecayPerSecond * dt);
      player.energy = Math.min(player.maxEnergy, player.energy + player.income * dt);
      if (game?.sandbox?.enabled && game.sandbox.rules?.infiniteEnergy && !player.isBot) player.energy = player.maxEnergy;
      player.energy = Math.max(0, player.energy);
    });
  }

  completeBuildings(now, game = null) {
    if (!game) return;
    this.tileManager.tiles.forEach((tile) => {
      if (!tile.building || !tile.buildingActiveAt || tile.buildingActiveAt > now || tile.buildingCompleteNotified) return;
      tile.buildingCompleteNotified = true;
      const player = game.getPlayer(tile.owner);
      game.pushEvent({
        kind: tile.buildingPendingEvent === "upgrade" ? "buildUpgrade" : "buildComplete",
        playerId: tile.owner,
        to: tile.id,
        buildingType: tile.building,
        level: tile.buildingLevel || 1,
        at: now,
        message: `${config.BUILDINGS[tile.building]?.label || "Building"} ${tile.buildingPendingEvent === "upgrade" ? `upgraded to level ${tile.buildingLevel || 1}` : "finished"}.`,
      });
      delete tile.buildingPendingEvent;
      if (player) player.flags = player.flags || {};
    });
  }

  recalculate(players, now = Date.now() / 1000, game = null) {
    players.forEach((player) => {
      const preservedFlags = player.flags || {};
      player.territory = 0;
      player.maxEnergy = balance.maxEnergyBase;
      player.flags = {
        ...preservedFlags,
        jumpPad: false,
        mudTunnel: false,
        objectiveDefenseBonus: 0,
        abilityCooldownReduction: 0,
        routePowerBonus: 0,
      };
      player.buildings = { nest: 0, lilyFarm: 0, reedGuard: 0, mudTunnel: 0, jumpPad: 0 };
      player.incomeBreakdown = {
        base: balance.baseIncome,
        territory: 0,
        terrain: 0,
        buildings: 0,
        animal: 0,
        recovery: 0,
        temporary: 0,
        objectives: 0,
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
      if (player.animal === "frog" && tile.type === "lily") {
        const evolved = (player.level || 1) >= 5 ? balance.level5FrogLilyIncomeMultiplier || 1.22 : 1;
        player.incomeBreakdown.animal += balance.frogLilyBonus * evolved;
      }
      if (player.animal === "carp") {
        if (tile.type === "water") {
          player.incomeBreakdown.animal += balance.carpWaterIncomeBonus || 0.012;
          const waterLinks = tile.neighbors?.filter((neighbor) => neighbor.owner === player.id && neighbor.type === "water").length || 0;
          player.incomeBreakdown.animal += waterLinks * (balance.carpConnectedWaterIncomeBonus || 0.004);
        }
        if (tile.type === "lily") player.incomeBreakdown.animal += balance.carpLilyBonus || 0.12;
      }
      if (game?.eventsManager?.isActive("lilyBloom") && tile.type === "lily") {
        player.incomeBreakdown.temporary += balance.lilyBloomIncomeBonus || 0.18;
      }

      this.applyBuilding(player, tile, now);
      this.applyObjective(player, tile);
    });

    players.forEach((player) => {
      const playable = this.tileManager.playable().length || 1;
      const territoryPct = player.territory / playable;
      if (territoryPct < balance.recoveryTerritoryPct && player.territory > 0) {
        player.incomeBreakdown.recovery += balance.recoveryIncomeMax * (1 - territoryPct / balance.recoveryTerritoryPct);
      }
      const comebackActive = territoryPct < (balance.comebackTerritoryPct || 0.08) && player.territory > 0;
      player.flags.comebackActive = comebackActive;
      if (comebackActive) {
        player.incomeBreakdown.recovery += balance.comebackIncomeBonus || 0.22;
        const core = player.coreTileId != null ? this.tileManager.getById(player.coreTileId) : null;
        if (core?.owner === player.id) core.defenseEnergy = Math.max(core.defenseEnergy || 0, balance.coreDefenseEnergy || 50);
      }
      game?.core?.applyEconomy(player);
      if (player.animal === "duck" && player.abilityActiveUntil > now) player.incomeBreakdown.temporary += 0.25;
      if (player.animal === "carp" && player.abilityActiveUntil > now) {
        const current = Object.values(player.incomeBreakdown).reduce((sum, value) => sum + value, 0);
        player.incomeBreakdown.temporary += current * (balance.goldenCurrentIncomeMultiplier || 0.3);
      }
      if (now < (player.flags?.campIncomeUntil || 0)) player.incomeBreakdown.temporary += balance.campIncomeBonus || 1.25;
      if (now < (player.flags?.lastStandUntil || 0)) {
        player.incomeBreakdown.recovery += balance.lastStandIncomeBonus || 0.55;
      }
      if (territoryPct < (balance.lastNestProtectionTerritoryPct || 0.035) && player.territory > 0) {
        player.flags.lastNestProtection = true;
        player.incomeBreakdown.recovery += 0.35;
        const core = player.coreTileId != null ? this.tileManager.getById(player.coreTileId) : null;
        if (core?.owner === player.id) core.defenseEnergy = Math.max(core.defenseEnergy || 0, balance.lastNestProtectionDefense || 18);
      } else {
        player.flags.lastNestProtection = false;
      }
      player.income = Object.values(player.incomeBreakdown).reduce((sum, value) => sum + value, 0);
      if (comebackActive) player.income = Math.max(player.income, balance.comebackIncomeFloor || 1.55);
      if (player.income > balance.empireIncomeSoftCap) {
        player.income =
          balance.empireIncomeSoftCap + (player.income - balance.empireIncomeSoftCap) * (1 - balance.empireIncomeDamping);
      }
      if (player.animal === "duck") player.maxEnergy *= 1.08;
      if ((player.level || 1) >= 5 && player.animal === "duck") player.maxEnergy *= 1.04;
      if (game?.sandbox?.enabled && player.flags?.sandboxMaxEnergyOverride) {
        player.maxEnergy = Math.max(player.maxEnergy, Number(player.flags.sandboxMaxEnergyOverride) || 0);
      }
      if (!(game?.sandbox?.enabled && game.sandbox.rules?.infiniteEnergy && !player.isBot)) player.energy = Math.min(player.energy, player.maxEnergy);
      if (player.territory <= 0 && !player.defeated && !(game?.sandbox?.enabled && game.sandbox.rules?.elimination === false)) {
        game?.eliminatePlayer?.(player, null, "no territory");
      }
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
      const efficiency = this.farmEfficiency(player);
      player.incomeBreakdown.buildings += Math.max(0.25, (balance.farmIncomeBonus + (tile.type === "lily" ? balance.farmLilyBonus : 0) - nearEnemy) * boost * efficiency);
      if (player.animal === "frog") player.incomeBreakdown.animal += balance.farmFrogBonus * level;
    }
    if (tile.building === "reedGuard") {
      const turtleBoost = player.animal === "turtle" ? balance.turtleReedGuardMultiplier || 1.28 : 1;
      player.incomeBreakdown.buildings += balance.reedGuardIncomeBonus * level * turtleBoost;
    }
    if (tile.building === "mudTunnel") {
      player.flags.mudTunnel = true;
      player.incomeBreakdown.buildings += balance.mudTunnelIncomeBonus * level;
    }
    if (tile.building === "jumpPad") {
      player.flags.jumpPad = true;
      player.maxEnergy += balance.jumpPadMaxEnergyBonus * boost;
    }
  }

  applyObjective(player, tile) {
    if (!tile.specialActive || !tile.objectiveId) return;
    const objective = objectiveConfig.LAKE_OBJECTIVES[tile.objectiveType || tile.objectiveId];
    if (!objective) return;
    if (objective.incomeBonus) player.incomeBreakdown.objectives += objective.incomeBonus;
    if (objective.maxEnergyBonus) player.maxEnergy += objective.maxEnergyBonus;
    if (objective.defenseBonus) player.flags.objectiveDefenseBonus += objective.defenseBonus;
    if (objective.cooldownReduction) player.flags.abilityCooldownReduction += objective.cooldownReduction;
    if (objective.routePowerBonus) player.flags.routePowerBonus = Math.max(player.flags.routePowerBonus || 0, objective.routePowerBonus);
  }

  buildingCost(player, buildingType) {
    const building = config.BUILDINGS[buildingType];
    if (!building) return Infinity;
    const ownedCount = player.buildings?.[buildingType] || 0;
    const growth = buildingType === "lilyFarm" ? balance.farmCostGrowth || balance.buildingCostGrowth || 0.35 : balance.buildingCostGrowth || 0.35;
    const baseCost = buildingType === "lilyFarm" ? balance.farmBaseCost || building.cost : building.cost;
    const carpDiscount = player.animal === "carp" && buildingType === "lilyFarm" ? balance.carpLilyFarmCostMultiplier || 0.9 : 1;
    return Math.round(baseCost * (1 + ownedCount * growth) * carpDiscount);
  }

  farmEfficiency(player) {
    const farms = player.buildings?.lilyFarm || 0;
    const softCap = Math.max(1, Math.ceil(Math.max(1, player.territory || 1) / (balance.farmSoftCapTerritory || balance.farmTerritoryPerFarm || 16)));
    const over = Math.max(0, farms - softCap);
    return Math.max(0.45, 1 - over * (balance.farmSoftCapPenalty || 0.08));
  }

  buildUnavailableReason(player, tile, buildingType, now = Date.now() / 1000) {
    const building = config.BUILDINGS[buildingType];
    if (!player || player.defeated) return "You are out of the pond.";
    if (!building) return "Unknown building.";
    if (!tile || tile.owner !== player.id) return "Choose one of your territory tiles.";
    if (tile.building) return "That tile already has a building.";
    if (building.animal && building.animal !== player.animal) return `${building.label} is for ${building.animal} only.`;
    if (!building.validTiles.includes(tile.type)) return `Needs ${building.validTiles.map((type) => config.TILE_TYPES[type]?.label || type).join(", ")}.`;
    const cost = this.buildingCost(player, buildingType);
    if (player.energy < cost) return `Need ${cost} Animal Energy.`;
    return "";
  }

  canBuild(player, tile, buildingType, now = Date.now() / 1000) {
    return !this.buildUnavailableReason(player, tile, buildingType, now);
  }

  build(player, tile, buildingType, now, game = null) {
    const reason = this.buildUnavailableReason(player, tile, buildingType, now);
    if (reason) {
      return { ok: false, message: reason };
    }
    const building = config.BUILDINGS[buildingType];
    const cost = this.buildingCost(player, buildingType);
    const buildTime = game?.sandbox?.enabled && game.sandbox.rules?.instantBuild ? 0 : balance.buildTimeSeconds || 10;
    player.energy -= cost;
    tile.building = buildingType;
    tile.buildingLevel = 1;
    tile.buildingActiveAt = now + buildTime;
    tile.buildingCompleteNotified = false;
    tile.buildingPendingEvent = "build";
    tile.lastChanged = now;
    player.buildings = player.buildings || {};
    player.buildings[buildingType] = (player.buildings[buildingType] || 0) + 1;
    player.stats.buildingsBuilt = (player.stats.buildingsBuilt || 0) + 1;
    return {
      ok: true,
      message: buildTime > 0 ? `${building.label} construction started. Finishes in ${buildTime}s.` : `${building.label} finished instantly.`,
      spentEnergy: cost,
      buildTime,
      buildingActiveAt: tile.buildingActiveAt,
      nextCost: this.buildingCost(player, buildingType),
    };
  }

  upgradeBuilding(player, tile, now, game = null) {
    if (!tile || tile.owner !== player.id || !tile.building) return { ok: false, message: "Choose one of your buildings." };
    if (tile.buildingActiveAt && tile.buildingActiveAt > now) return { ok: false, message: `Building is still under construction. Wait ${Math.ceil(tile.buildingActiveAt - now)}s.` };
    const building = config.BUILDINGS[tile.building];
    const level = Math.max(1, Number(tile.buildingLevel) || 1);
    if (level >= 3) return { ok: false, message: "Building is already max level." };
    const ownedCount = player.buildings?.[tile.building] || 0;
    const cost = Math.round((building?.cost || 40) * (0.78 + level * (balance.upgradeCostGrowth || 0.82)) * (1 + Math.max(0, ownedCount - 1) * 0.08));
    if (player.energy < cost) return { ok: false, message: "Not enough Animal Energy." };
    const upgradeTime = game?.sandbox?.enabled && game.sandbox.rules?.instantBuild ? 0 : balance.upgradeTimeSeconds || balance.buildTimeSeconds || 8;
    player.energy -= cost;
    tile.buildingLevel = level + 1;
    tile.buildingActiveAt = now + upgradeTime;
    tile.buildingCompleteNotified = false;
    tile.buildingPendingEvent = "upgrade";
    tile.defenseEnergy = Math.min(90, tile.defenseEnergy + 8 + level * 4);
    tile.lastChanged = now;
    player.stats.buildingUpgrades = (player.stats.buildingUpgrades || 0) + 1;
    return {
      ok: true,
      message:
        upgradeTime > 0
          ? `${building?.label || "Building"} upgrading to level ${tile.buildingLevel}. Finishes in ${upgradeTime}s.`
          : `${building?.label || "Building"} upgraded instantly to level ${tile.buildingLevel}.`,
      spentEnergy: cost,
      buildingActiveAt: tile.buildingActiveAt,
    };
  }

  removeBuilding(player, tile, now) {
    if (!tile || tile.owner !== player.id || !tile.building) return { ok: false, message: "Choose one of your buildings." };
    const building = config.BUILDINGS[tile.building];
    tile.building = null;
    tile.buildingLevel = 0;
    tile.buildingActiveAt = 0;
    tile.buildingCompleteNotified = false;
    delete tile.buildingPendingEvent;
    tile.lastChanged = now;
    return { ok: true, message: `${building?.label || "Building"} removed.` };
  }

  animalPerk(player) {
    return animals[player.animal]?.perk || "";
  }
}

module.exports = EconomyManager;
