(function initPondProgressionConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondProgressionConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeProgressionConfig() {
  const titles = [
    { id: "pond_rookie", label: "Pond Rookie", unlockLevel: 1 },
    { id: "lily_lord", label: "Lily Lord", unlockLevel: 4 },
    { id: "river_warrior", label: "River Warrior", unlockLevel: 7 },
    { id: "marsh_defender", label: "Marsh Defender", unlockLevel: 10 },
    { id: "golden_current", label: "Golden Current", unlockLevel: 14 },
    { id: "lake_emperor", label: "Lake Emperor", unlockLevel: 20 },
  ];

  const cosmetics = [
    { id: "clear_ripple", label: "Clear Ripple Border", type: "border", unlockLevel: 1, color: "#83dced" },
    { id: "lily_glow", label: "Lily Glow Border", type: "border", unlockLevel: 3, color: "#8ee6a2" },
    { id: "reed_edge", label: "Reed Edge Border", type: "border", unlockLevel: 6, color: "#cddf83" },
    { id: "sunset_wave", label: "Sunset Wave Accent", type: "attack", unlockLevel: 9, color: "#f2b36d" },
    { id: "moon_pond", label: "Moon Pond Nameplate", type: "nameplate", unlockLevel: 12, color: "#b7c8ff" },
    { id: "gold_scale", label: "Gold Scale Frame", type: "frame", unlockLevel: 16, color: "#f1d27a" },
  ];

  function xpForLevel(level) {
    const safe = Math.max(1, Number(level) || 1);
    return Math.round(90 + safe * 42 + Math.pow(safe - 1, 1.52) * 28);
  }

  function levelFromXp(xp) {
    let remaining = Math.max(0, Math.floor(Number(xp) || 0));
    let level = 1;
    while (level < 80) {
      const needed = xpForLevel(level);
      if (remaining < needed) break;
      remaining -= needed;
      level += 1;
    }
    return { level, currentXp: remaining, nextXp: xpForLevel(level), progress: remaining / xpForLevel(level) };
  }

  return {
    rewards: {
      playMatch: 20,
      winMatch: 100,
      elimination: 25,
      objective: 20,
      building: 5,
      upgrade: 10,
      ability: 10,
      longSurvival: 35,
      coinDivisor: 10,
    },
    titles,
    cosmetics,
    defaultTitle: "pond_rookie",
    defaultCosmetic: "clear_ripple",
    xpForLevel,
    levelFromXp,
  };
});
