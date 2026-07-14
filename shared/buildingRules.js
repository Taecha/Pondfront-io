(function initPondBuildingRules(root, factory) {
  const rules = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = rules;
  else root.PondBuildingRules = rules;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeBuildingRules() {
  function buildingSet(gameConfig = {}) {
    return gameConfig.BUILDINGS || gameConfig.buildings || {};
  }

  function tileTypeSet(gameConfig = {}) {
    return gameConfig.TILE_TYPES || gameConfig.tileTypes || {};
  }

  function balanceSet(gameConfig = {}, balance = null) {
    return balance || gameConfig.BALANCE || gameConfig.balance || {};
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function countOwned(player, buildingType) {
    return Math.max(0, number(player?.buildings?.[buildingType], 0));
  }

  function buildingCostDetails(player, buildingType, gameConfig = {}, balance = null) {
    const buildings = buildingSet(gameConfig);
    const building = buildings[buildingType];
    if (!building) {
      return {
        buildingType,
        cost: Infinity,
        baseCost: 0,
        ownedCount: 0,
        growth: 0,
        scalingMultiplier: 1,
        animalMultiplier: 1,
        scalingCost: 0,
        reason: "Unknown building.",
      };
    }
    const configBalance = balanceSet(gameConfig, balance);
    const ownedCount = countOwned(player, buildingType);
    const growth =
      buildingType === "lilyFarm"
        ? number(configBalance.farmCostGrowth, number(configBalance.buildingCostGrowth, 0.35))
        : number(configBalance.buildingCostGrowth, 0.35);
    const baseCost = buildingType === "lilyFarm" ? number(configBalance.farmBaseCost, number(building.cost, 0)) : number(building.cost, 0);
    const scalingMultiplier = 1 + ownedCount * growth;
    const animalMultiplier = player?.animal === "carp" && buildingType === "lilyFarm" ? number(configBalance.carpLilyFarmCostMultiplier, 0.9) : 1;
    const modifierMultiplier = Math.max(0.05, number(player?.flags?.modifierBuildingCostMultiplier, 1));
    const rawCost = baseCost * scalingMultiplier * animalMultiplier * modifierMultiplier;
    const cost = Math.max(0, Math.round(rawCost));

    return {
      buildingType,
      label: building.label || buildingType,
      cost,
      baseCost,
      ownedCount,
      growth,
      scalingMultiplier,
      animalMultiplier,
      modifierMultiplier,
      terrainMultiplier: 1,
      scalingCost: Math.max(0, cost - Math.round(baseCost * animalMultiplier)),
      reason: "",
    };
  }

  function buildingCost(player, buildingType, gameConfig = {}, balance = null) {
    return buildingCostDetails(player, buildingType, gameConfig, balance).cost;
  }

  function validTileLabels(building, gameConfig = {}) {
    const types = tileTypeSet(gameConfig);
    return (building?.validTiles || []).map((type) => types[type]?.label || type).join(", ");
  }

  function previewBuild({ player, tile, buildingType, gameConfig = {}, balance = null, now = 0, instantBuild = false } = {}) {
    const buildings = buildingSet(gameConfig);
    const types = tileTypeSet(gameConfig);
    const configBalance = balanceSet(gameConfig, balance);
    const building = buildings[buildingType];
    const costInfo = buildingCostDetails(player, buildingType, gameConfig, configBalance);
    const playerEnergy = Math.max(0, Math.round(number(player?.energy, 0)));
    const cost = Number.isFinite(costInfo.cost) ? costInfo.cost : 0;
    const buildTimeMultiplier = Math.max(0.05, number(player?.flags?.modifierBuildTimeMultiplier, 1) * number(player?.flags?.worldBuildTimeMultiplier, 1));
    const buildTime = instantBuild ? 0 : Math.max(0, number(configBalance.buildTimeSeconds, 10) * buildTimeMultiplier);
    const requirements = [];
    let reason = "";
    let cooldownRemaining = 0;

    if (!player || player.defeated) reason = "You are out of the pond.";
    else if (!building) reason = "Unknown building.";
    else if (!tile || tile.owner !== player.id) reason = "Choose one of your territory tiles.";
    else if (types[tile.type]?.blocks) reason = "Blocked terrain cannot hold a building.";
    else if (tile.building) {
      cooldownRemaining = Math.max(0, Math.ceil(number(tile.buildingActiveAt, 0) - number(now, 0)));
      reason =
        cooldownRemaining > 0
          ? `Building is still under construction. Wait ${cooldownRemaining}s.`
          : "That tile already has a building.";
    } else if (building.animal && building.animal !== player.animal) {
      reason = `${building.label || buildingType} is for ${building.animal} only.`;
    } else if (!building.validTiles?.includes(tile.type)) {
      reason = `Needs ${validTileLabels(building, gameConfig)}.`;
    } else if (playerEnergy < cost) {
      reason = `Need ${cost - playerEnergy} more Animal Energy (${cost} total).`;
    }

    if (building?.animal) requirements.push(`${building.animal} only`);
    if (building?.validTiles?.length) requirements.push(`Tile: ${validTileLabels(building, gameConfig)}`);
    if (costInfo.ownedCount > 0) requirements.push(`Cost scales from ${costInfo.ownedCount} owned`);
    if (player?.animal === "carp" && buildingType === "lilyFarm") requirements.push("Carp farm discount applied");

    return {
      ...costInfo,
      cost,
      canBuild: !reason,
      reason,
      requirements,
      cooldownRemaining,
      energyRequired: Math.max(0, cost - playerEnergy),
      playerEnergy,
      buildTime,
      affordable: playerEnergy >= cost,
      validTiles: building?.validTiles || [],
    };
  }

  function previewAllBuilds({ player, tile, gameConfig = {}, balance = null, now = 0, instantBuild = false } = {}) {
    return Object.fromEntries(
      Object.keys(buildingSet(gameConfig)).map((buildingType) => [
        buildingType,
        previewBuild({ player, tile, buildingType, gameConfig, balance, now, instantBuild }),
      ]),
    );
  }

  function upgradeCostDetails(player, tile, gameConfig = {}, balance = null) {
    const buildings = buildingSet(gameConfig);
    const configBalance = balanceSet(gameConfig, balance);
    const buildingType = tile?.building;
    const building = buildings[buildingType];
    if (!building) return { buildingType, cost: Infinity, label: "Building", level: 0, ownedCount: 0, reason: "Choose one of your buildings." };
    const level = Math.max(1, Math.min(3, number(tile?.buildingLevel, 1)));
    const ownedCount = countOwned(player, buildingType);
    const modifierMultiplier = Math.max(0.05, number(player?.flags?.modifierBuildingCostMultiplier, 1));
    const cost = Math.round(number(building.cost, 40) * (0.78 + level * number(configBalance.upgradeCostGrowth, 0.82)) * (1 + Math.max(0, ownedCount - 1) * 0.08) * modifierMultiplier);
    return {
      buildingType,
      label: building.label || buildingType,
      cost,
      baseCost: number(building.cost, 40),
      level,
      ownedCount,
      modifierMultiplier,
      nextLevel: Math.min(3, level + 1),
      reason: "",
    };
  }

  function previewUpgrade({ player, tile, gameConfig = {}, balance = null, now = 0, instantBuild = false } = {}) {
    const costInfo = upgradeCostDetails(player, tile, gameConfig, balance);
    const configBalance = balanceSet(gameConfig, balance);
    const playerEnergy = Math.max(0, Math.round(number(player?.energy, 0)));
    const buildTimeMultiplier = Math.max(0.05, number(player?.flags?.modifierBuildTimeMultiplier, 1) * number(player?.flags?.worldBuildTimeMultiplier, 1));
    const upgradeTime = instantBuild ? 0 : Math.max(0, number(configBalance.upgradeTimeSeconds, number(configBalance.buildTimeSeconds, 8)) * buildTimeMultiplier);
    const constructionRemaining = Math.max(0, Math.ceil(number(tile?.buildingActiveAt, 0) - number(now, 0)));
    let reason = "";
    if (!player || player.defeated) reason = "You are out of the pond.";
    else if (!tile || tile.owner !== player.id || !tile.building) reason = "Choose one of your buildings.";
    else if (constructionRemaining > 0) reason = `Building is still under construction. Wait ${constructionRemaining}s.`;
    else if (costInfo.level >= 3) reason = "Building is already max level.";
    else if (playerEnergy < costInfo.cost) reason = `Need ${costInfo.cost - playerEnergy} more Animal Energy (${costInfo.cost} total).`;

    return {
      ...costInfo,
      cost: Number.isFinite(costInfo.cost) ? costInfo.cost : 0,
      canUpgrade: !reason,
      reason,
      playerEnergy,
      energyRequired: Math.max(0, (Number.isFinite(costInfo.cost) ? costInfo.cost : 0) - playerEnergy),
      upgradeTime,
      constructionRemaining,
      affordable: playerEnergy >= costInfo.cost,
    };
  }

  return {
    buildingCostDetails,
    buildingCost,
    previewBuild,
    previewAllBuilds,
    upgradeCostDetails,
    previewUpgrade,
  };
});
