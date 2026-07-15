(function initCombatConfig(root, factory) {
  const combatConfig = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = combatConfig;
  else root.PondCombat = combatConfig;
})(typeof self !== "undefined" ? self : this, function factory() {
  const sendProfiles = Object.freeze([
    Object.freeze({ id: "probe", label: "Probe", short: "Probe", expansion: "Scout", defense: "Light", percent: 0.1, danger: false }),
    Object.freeze({ id: "bite", label: "Quick Bite", short: "Bite", expansion: "Small", defense: "Standard", percent: 0.25, danger: false }),
    Object.freeze({ id: "push", label: "Strong Push", short: "Push", expansion: "Medium", defense: "Strong", percent: 0.5, danger: true }),
    Object.freeze({ id: "wave", label: "Full Wave", short: "Wave", expansion: "Large", defense: "Heavy", percent: 0.75, danger: true }),
    Object.freeze({ id: "max", label: "Max Wave", short: "Max", expansion: "Max", defense: "Max", percent: 1, danger: true }),
  ]);
  const attackStyles = Object.freeze(Object.fromEntries(sendProfiles.map((profile) => [
    profile.id,
    Object.freeze({
      label: profile.label,
      short: profile.short,
      percent: profile.percent,
      description:
        profile.id === "probe"
          ? "Low-risk pressure that scouts or softens a weak border."
          : profile.id === "bite"
            ? "Cheap pressure that weakens or nips weak borders."
            : profile.id === "push"
              ? "Recommended attack for breaking normal borders."
              : profile.id === "wave"
                ? "Large splash attack for pushing through several tiles."
                : "All-in attack when the enemy border is ready to break.",
    }),
  ])));

  function profileForPercent(value, fallback = 0.25) {
    const percent = Math.max(0.1, Math.min(1, Number(value) || fallback));
    return sendProfiles.reduce((best, profile) =>
      Math.abs(profile.percent - percent) < Math.abs(best.percent - percent) ? profile : best,
    sendProfiles[1]);
  }

  function isAllowedSendPercent(value) {
    const percent = Number(value);
    return Number.isFinite(percent) && sendProfiles.some((profile) => Math.abs(profile.percent - percent) < 0.0001);
  }

  function energyForPercent(energy, value, fallback = 0.25) {
    const available = Math.max(0, Number(energy) || 0);
    const percent = Math.max(0.1, Math.min(1, Number(value) || fallback));
    return Math.min(available, Math.max(0, Math.round(available * percent)));
  }

  return {
    sendProfiles,
    profileForPercent,
    isAllowedSendPercent,
    energyForPercent,
    attackCooldownSeconds: 0,
    minimumExpansionEnergy: 1,
    minimumAttackEnergy: 5,
    maxActiveAttacksPerPlayer: 3,
    waveTickSeconds: 0.4,
    waveCaptureLimit: 2,
    attackEfficiency: 0.86,
    waveMaxDurationSeconds: 12,
    contestPowerLossRatio: 0.18,
    contestWinnerLossRatio: 0.45,
    currentPush: {
      cooldownSeconds: 45,
      minEnergy: 10,
      maxRange: 32,
      minTravelSeconds: 3,
      maxTravelSeconds: 12,
      secondsPerTile: 0.28,
      warningLeadSeconds: 2,
      baseEfficiency: 0.78,
      minEfficiency: 0.5,
      distanceTier: 8,
      distancePenaltyPerTier: 0.1,
      maxImpactCaptures: 7,
      longRouteCapturePenalty: 1,
      impactCostMultiplier: 1.08,
      interceptPowerLossPerTile: 0.055,
      maxInterceptPowerLoss: 0.45,
      turtleShellPowerMultiplier: 0.82,
      beginnerHumanPowerMultiplier: 0.75,
    },
    attackStyles,
    pressure: {
      captureThreshold: 0.82,
      nearMissKeepRatio: 0.72,
      defenseDamageMultiplier: 0.22,
      decayPerSecond: 0.5,
      decayIntervalSeconds: 2,
      maxProgressRatio: 0.95,
    },
    formula: {
      baseCostByTile: {
        water: 6,
        lily: 8,
        reeds: 12,
        mud: 14,
        nest: 16,
      },
      buildingBaseCost: 18,
      terrainDefenseMultiplier: 1.05,
      defenseEnergyMultiplier: 0.58,
      defenderEnergyFlatMultiplier: 0.024,
      defenderEnergyFlatCap: 12,
      defenderEnergyRatioBase: 0.82,
      defenderEnergyRatioMultiplier: 0.32,
      distanceCost: 1.1,
      weakBorderPenalty: 1.2,
      lowPowerFatigueMultiplier: 1.06,
      bigDefenderWeakEnergyMultiplier: 0.88,
    },
  };
});
