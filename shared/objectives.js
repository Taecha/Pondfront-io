(function initPondObjectives(root, factory) {
  const objectives = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = objectives;
  else root.PondObjectives = objectives;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeObjectives() {
  const LAKE_OBJECTIVES = {
    goldenLily: {
      label: "Golden Lily",
      short: "GL",
      color: "#e3bd4f",
      spawn: { x: 42, y: 27, radius: 5 },
      tilePreference: ["lily", "water", "nest"],
      captureCostBonus: 26,
      incomeBonus: 2.2,
      xp: 22,
      description: "Bonus income while controlled.",
    },
    ancientReed: {
      label: "Ancient Reed",
      short: "AR",
      color: "#91c579",
      spawn: { x: 22, y: 15, radius: 6 },
      tilePreference: ["reeds", "mud", "water"],
      captureCostBonus: 24,
      defenseBonus: 5,
      xp: 20,
      description: "Adds border defense to your whole front.",
    },
    mudSpring: {
      label: "Mud Spring",
      short: "MS",
      color: "#c39a62",
      spawn: { x: 64, y: 39, radius: 6 },
      tilePreference: ["mud", "nest", "reeds"],
      captureCostBonus: 28,
      maxEnergyBonus: 32,
      xp: 20,
      description: "Increases maximum Animal Energy.",
    },
    clearWaterShrine: {
      label: "Clear Water Shrine",
      short: "CW",
      color: "#83dced",
      spawn: { x: 60, y: 15, radius: 6 },
      tilePreference: ["water", "lily", "nest"],
      captureCostBonus: 24,
      cooldownReduction: 0.14,
      xp: 22,
      description: "Reduces animal ability cooldowns.",
    },
    deepCurrent: {
      label: "Deep Current",
      short: "DC",
      color: "#6fb8f0",
      spawn: { x: 42, y: 40, radius: 7 },
      tilePreference: ["water", "lily", "reeds"],
      captureCostBonus: 25,
      routePowerBonus: 0.18,
      xp: 22,
      description: "Improves Current Push water-route attacks.",
    },
  };

  const CRITTER_CAMPS = {
    turtleCamp: {
      label: "Turtle Camp",
      short: "TC",
      color: "#91b978",
      positions: [
        { x: 16, y: 25 },
        { x: 68, y: 31 },
      ],
      captureCostBonus: 18,
      duration: 70,
      effect: "defense",
      xp: 12,
      description: "Temporary border defense after capture.",
    },
    crabCamp: {
      label: "Crab Camp",
      short: "CC",
      color: "#df806d",
      positions: [
        { x: 31, y: 14 },
        { x: 54, y: 41 },
      ],
      captureCostBonus: 18,
      duration: 60,
      effect: "attack",
      xp: 12,
      description: "Temporary attack bonus after capture.",
    },
    otterCamp: {
      label: "Otter Camp",
      short: "OC",
      color: "#d2a769",
      positions: [
        { x: 31, y: 40 },
        { x: 54, y: 14 },
      ],
      captureCostBonus: 16,
      duration: 75,
      effect: "income",
      xp: 12,
      description: "Temporary income bonus after capture.",
    },
    dragonflySwarm: {
      label: "Dragonfly Swarm",
      short: "DS",
      color: "#b58be0",
      positions: [
        { x: 42, y: 17 },
        { x: 42, y: 38 },
      ],
      captureCostBonus: 15,
      duration: 75,
      effect: "vision",
      xp: 12,
      description: "Temporary scouting clarity after capture.",
    },
  };

  return {
    LAKE_OBJECTIVES,
    CRITTER_CAMPS,
  };
});
