(function initPondMapConfig(root, factory) {
  const mapConfig = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mapConfig;
  else root.PondMapConfig = mapConfig;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeMapConfig() {
  return {
    small: {
      label: "Small",
      cols: 60,
      rows: 36,
      minBots: 4,
      maxBots: 6,
      defaultBots: 5,
      matchSeconds: 600,
      objectiveCount: 2,
      campCount: 4,
      terrainScale: 0.9,
    },
    medium: {
      label: "Medium",
      cols: 90,
      rows: 54,
      minBots: 8,
      maxBots: 10,
      defaultBots: 9,
      matchSeconds: 840,
      objectiveCount: 5,
      campCount: 10,
      terrainScale: 1,
    },
    large: {
      label: "Large",
      cols: 130,
      rows: 78,
      minBots: 12,
      maxBots: 16,
      defaultBots: 14,
      matchSeconds: 1080,
      objectiveCount: 8,
      campCount: 16,
      terrainScale: 1.16,
    },
    huge: {
      label: "Huge",
      cols: 170,
      rows: 100,
      minBots: 18,
      maxBots: 24,
      defaultBots: 20,
      matchSeconds: 1440,
      objectiveCount: 10,
      campCount: 22,
      terrainScale: 1.3,
    },
  };
});
