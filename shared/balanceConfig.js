(function initPondBalance(root, factory) {
  const balance = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = balance;
  else root.PondBalance = balance;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeBalanceConfig() {
  return {
    expansionBaseMultiplier: 1.08,
    expansionFreeTerritory: 18,
    expansionTerritoryPenalty: 0.1,
    expansionDistancePenalty: 0.08,
    expansionEnemyBorderPenalty: 2.25,
    expansionStrategicPenalty: 1.5,

    baseIncome: 0.95,
    territoryIncome: 0.048,
    terrainIncomeMultiplier: 0.72,
    frogLilyBonus: 0.14,
    duckMaxEnergyPerTile: 0.12,
    maxEnergyBase: 72,
    maxEnergyPerTile: 1.48,
    recoveryIncomeMax: 0.8,
    recoveryTerritoryPct: 0.06,
    empireIncomeSoftCap: 18,
    empireIncomeDamping: 0.06,

    farmBaseCost: 34,
    farmCostGrowth: 0.2,
    farmIncomeBonus: 1,
    farmLilyBonus: 0.25,
    farmFrogBonus: 0.18,
    farmActivationTime: 20,
    farmTerritoryPerFarm: 18,
    farmBorderPenalty: 0.4,

    nestMaxEnergyBonus: 24,
    nestIncomeBonus: 0.08,
    reedGuardIncomeBonus: 0.08,
    mudTunnelIncomeBonus: 0.14,
    jumpPadMaxEnergyBonus: 6,

    defendSpendMultiplier: 0.72,
    defendEnergyMultiplier: 0.82,
    attackPowerMultiplier: 0.92,
    attackCostMultiplier: 1.12,
    warExhaustionPerAttack: 0.08,
    warExhaustionDecayPerSecond: 0.018,
    maxWarExhaustion: 0.28,

    flockRushOpenWaterCostMultiplier: 0.65,
    snakeAmbushAttackPowerMultiplier: 1.4,
    snakeAmbushDefenseCostMultiplier: 0.8,
    frogBigLeapClusterSize: 5,
    frogBigLeapRange: 2,
    frogBigLeapJumpPadRange: 3,

    botAggressionMultiplier: 1.2,
    botAttackEnergyThreshold: 0.38,
    leaderThreatMultiplier: 2.2,
    objectiveSpawnTime: 120,
    midGameTime: 120,
    aggressionTime: 240,
    lateGameTime: 360,
    finalSurgeTime: 480,
    maxMatchTime: 1200,
  };
});
