(function initCombatConfig(root, factory) {
  const combatConfig = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = combatConfig;
  else root.PondCombat = combatConfig;
})(typeof self !== "undefined" ? self : this, function factory() {
  return {
    attackCooldownSeconds: 3.5,
    maxActiveAttacksPerPlayer: 2,
    waveTickSeconds: 0.18,
    waveCaptureLimit: 4,
    formula: {
      baseCostByTile: {
        water: 6,
        lily: 8,
        reeds: 12,
        mud: 14,
        nest: 16,
      },
      buildingBaseCost: 18,
      terrainDefenseMultiplier: 1.25,
      defenseEnergyMultiplier: 0.82,
      defenderEnergyFlatMultiplier: 0.035,
      defenderEnergyFlatCap: 18,
      defenderEnergyRatioBase: 0.86,
      defenderEnergyRatioMultiplier: 0.45,
      distanceCost: 1.1,
      weakBorderPenalty: 1.2,
      lowPowerFatigueMultiplier: 1.06,
      bigDefenderWeakEnergyMultiplier: 0.88,
    },
  };
});
