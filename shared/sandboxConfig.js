(function initPondSandboxConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondSandboxConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeSandboxConfig() {
  const animals = ["duck", "snake", "frog", "turtle", "carp"];
  const mapSizes = ["small", "medium", "large", "huge"];
  const botCounts = [0, 2, 4, 8, 12, 16];
  const botDifficulties = {
    passive: { label: "Passive", serverDifficulty: "easy", personality: "passive" },
    easy: { label: "Easy", serverDifficulty: "easy", personality: "expander" },
    normal: { label: "Normal", serverDifficulty: "normal", personality: "fighter" },
    smart: { label: "Hard", serverDifficulty: "smart", personality: "fighter" },
    chaos: { label: "Chaos", serverDifficulty: "chaos", personality: "chaos" },
  };
  const personalities = {
    passive: "Passive",
    expander: "Expander",
    defender: "Defender",
    fighter: "Fighter",
    objectiveHunter: "Objective Hunter",
    leaderHunter: "Leader Hunter",
    chaos: "Chaos",
  };
  const defaultRules = {
    infiniteEnergy: false,
    instantBuild: false,
    noCooldowns: false,
    revealMap: true,
    botsFight: true,
    objectives: true,
    currentPush: true,
    elimination: true,
  };
  const presets = {
    empty: {
      label: "Empty Map",
      mapSize: "medium",
      botCount: 0,
      botDifficulty: "passive",
      rules: { ...defaultRules, botsFight: false },
    },
    botWar: {
      label: "Bot War",
      mapSize: "large",
      botCount: 12,
      botDifficulty: "smart",
      rules: { ...defaultRules, revealMap: true, botsFight: true },
    },
    economy: {
      label: "Economy Test",
      mapSize: "medium",
      botCount: 2,
      botDifficulty: "passive",
      rules: { ...defaultRules, infiniteEnergy: true, instantBuild: true, botsFight: false },
    },
    combat: {
      label: "Combat Test",
      mapSize: "small",
      botCount: 4,
      botDifficulty: "normal",
      rules: { ...defaultRules, infiniteEnergy: false, instantBuild: true, botsFight: true },
    },
    currentPush: {
      label: "Current Push Test",
      mapSize: "large",
      botCount: 4,
      botDifficulty: "normal",
      rules: { ...defaultRules, infiniteEnergy: true, currentPush: true },
    },
    chaos: {
      label: "Huge Chaos",
      mapSize: "huge",
      botCount: 16,
      botDifficulty: "chaos",
      rules: { ...defaultRules, botsFight: true, objectives: true },
    },
  };

  return {
    animals,
    mapSizes,
    botCounts,
    botDifficulties,
    personalities,
    defaultRules,
    presets,
    speeds: [0.5, 1, 2, 4],
  };
});
