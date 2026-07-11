(function initGameModeConfig(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondGameModes = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGameModeConfig() {
  const modes = {
    classic: {
      id: "classic",
      label: "Classic Elimination",
      icon: "CE",
      implemented: true,
      short: "Capture territory and eliminate every rival animal.",
      primaryObjective: "Capture territory and eliminate every rival animal.",
      win: "elimination",
      winConditionType: "lastStanding",
      eliminationEnabled: true,
      noTerritoryEliminates: true,
      respawnEnabled: false,
      teamRequirement: "Solo or teams",
      recommendedMap: "Any lake",
      recommendedBots: "6-12",
      tutorial: ["Expand from your border.", "Build energy and defense.", "Eliminate every rival animal."],
      botRules: { expand: 1, attack: 1, objectives: 0.65, defendCore: 0.7 },
    },
    goldenLily: {
      id: "goldenLily",
      label: "Golden Lily Control",
      icon: "GL",
      implemented: true,
      short: "Capture and hold Golden Lilies to earn control points.",
      primaryObjective: "Capture and hold Golden Lilies to earn control points.",
      win: "score",
      winConditionType: "controlScore",
      eliminationEnabled: true,
      noTerritoryEliminates: true,
      respawnEnabled: false,
      scoreTargets: Object.freeze({ quick: 250, standard: 500, long: 750 }),
      scoreIntervalSeconds: 2,
      scorePerLily: 1,
      centralLilyScore: 2,
      overtimeCloseScore: 10,
      objectiveRules: Object.freeze({ minZones: 3, maxZones: 7, contestedPausesScore: true }),
      teamRequirement: "Solo or teams",
      recommendedMap: "Medium or larger",
      recommendedBots: "6-10",
      tutorial: ["Reach a Golden Lily.", "Hold it to score every two seconds.", "Contest the leader and reach the score target."],
      botRules: { expand: 0.75, attack: 0.8, objectives: 1.8, defendCore: 0.45 },
    },
    floodSurvival: {
      id: "floodSurvival",
      label: "Flood Survival",
      icon: "FS",
      implemented: true,
      short: "Work together and survive every flood wave.",
      primaryObjective: "Work together and survive every flood wave.",
      win: "survival",
      winConditionType: "survivalWaves",
      eliminationEnabled: true,
      noTerritoryEliminates: true,
      respawnEnabled: false,
      requiresCoop: true,
      waveTargets: Object.freeze({ quick: 8, standard: 10, long: 15 }),
      preparationSeconds: 18,
      recoverySeconds: 12,
      waveSeconds: 34,
      sanctuaryHealth: 300,
      recoveryEnergy: 22,
      teamRevives: 0,
      teamRequirement: "Co-op defenders",
      recommendedMap: "Medium or large",
      recommendedBots: "8-14 wave enemies",
      tutorial: ["Build around the Sanctuary.", "Fight each incoming flood wave together.", "Keep the Sanctuary alive through the final wave."],
      botRules: { expand: 0.45, attack: 1.35, objectives: 0.25, sanctuary: 2, diplomacy: false },
    },
    lastNest: {
      id: "lastNest",
      label: "Last Nest",
      icon: "LN",
      implemented: true,
      short: "Protect your Nest and capture every enemy Nest.",
      primaryObjective: "Protect your Nest and capture every enemy Nest.",
      win: "core",
      winConditionType: "lastCore",
      eliminationEnabled: true,
      noTerritoryEliminates: false,
      respawnEnabled: false,
      coreHealth: 220,
      coreProtectionSeconds: 75,
      coreRecoverySeconds: 8,
      teamRequirement: "Solo or teams",
      recommendedMap: "Medium or larger",
      recommendedBots: "5-9",
      tutorial: ["Your Core Nest is your life.", "Reinforce paths near your Nest.", "Reach and capture every enemy Nest."],
      botRules: { expand: 0.65, attack: 0.85, objectives: 0.35, defendCore: 1.8, attackCore: 1.55 },
    },
    riverDomination: { id: "riverDomination", label: "River Domination", implemented: false, comingSoon: true, short: "Coming Soon" },
    pondRush: { id: "pondRush", label: "Pond Rush", implemented: false, comingSoon: true, short: "Coming Soon" },
    migration: { id: "migration", label: "Migration", implemented: false, comingSoon: true, short: "Coming Soon" },
    animalKing: { id: "animalKing", label: "Animal King", implemented: false, comingSoon: true, short: "Coming Soon" },
    peacefulExpansion: { id: "peacefulExpansion", label: "Peaceful Expansion", implemented: false, comingSoon: true, short: "Coming Soon" },
    sandbox: {
      id: "sandbox",
      label: "Sandbox",
      icon: "SB",
      implemented: true,
      short: "Custom pond controls with progression disabled.",
      primaryObjective: "Test the pond with custom rules.",
      win: "sandbox",
      winConditionType: "sandbox",
      eliminationEnabled: false,
      noTerritoryEliminates: false,
      progressionAllowed: false,
    },
  };

  function sanitize(value, sandbox = false) {
    if (sandbox) return "sandbox";
    const id = String(value || "classic");
    return modes[id]?.implemented && id !== "sandbox" ? id : null;
  }

  function scoreTarget(modeId, matchLength = "standard") {
    const rules = modes[modeId];
    return rules?.scoreTargets?.[matchLength] || null;
  }

  function waveTarget(modeId, matchLength = "standard") {
    const rules = modes[modeId];
    return rules?.waveTargets?.[matchLength] || null;
  }

  return Object.freeze({ modes: Object.freeze(modes), sanitize, scoreTarget, waveTarget });
});
