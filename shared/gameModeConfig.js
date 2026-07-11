(function initGameModeConfig(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondGameModes = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGameModeConfig() {
  const modes = {
    classic: { id: "classic", label: "Classic Elimination", short: "Last animal or team alive wins.", win: "elimination" },
    goldenLily: { id: "goldenLily", label: "Golden Lily Control", short: "Hold major lilies to reach the score target.", win: "score", scoreTarget: 300 },
    riverDomination: { id: "riverDomination", label: "River Domination", short: "Hold River Gates and control the current.", win: "scoreOrElimination", scoreTarget: 260 },
    floodSurvival: { id: "floodSurvival", label: "Flood Survival", short: "Survive eight rising tides with your team.", win: "survival", survivalTides: 8, tideSeconds: 45 },
    pondRush: { id: "pondRush", label: "Pond Rush", short: "Fast economy and a clear territory target.", win: "territory", territoryTarget: 0.45, matchMultiplier: 0.55, incomeMultiplier: 1.45 },
    lastNest: { id: "lastNest", label: "Last Nest", short: "Protect your Core Nest and break every rival nest.", win: "core", coreProtectionSeconds: 45 },
    migration: { id: "migration", label: "Migration", short: "Safe water shifts as the match continues.", win: "elimination", migrationSeconds: 70 },
    animalKing: { id: "animalKing", label: "Animal King", short: "Challenge one empowered King Animal together.", win: "king", kingEnergyMultiplier: 1.5 },
    peacefulExpansion: { id: "peacefulExpansion", label: "Peaceful Expansion", short: "Build first; combat opens after the preparation tide.", win: "elimination", peaceSeconds: 90 },
    sandbox: { id: "sandbox", label: "Sandbox", short: "Custom pond controls with progression disabled.", win: "sandbox" },
  };

  function sanitize(value, sandbox = false) {
    if (sandbox) return "sandbox";
    return modes[value] && value !== "sandbox" ? value : "classic";
  }

  return Object.freeze({ modes: Object.freeze(modes), sanitize });
});
