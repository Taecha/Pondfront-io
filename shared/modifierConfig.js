(function initModifierConfig(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondModifierConfig = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createModifierConfig() {
  const definitions = {
    doubleIncome: { label: "Double Energy Income", group: "economy" },
    tripleIncome: { label: "Triple Energy Income", group: "economy" },
    cheapBuildings: { label: "Cheap Buildings", group: "building" },
    fastBuildings: { label: "Fast Building", group: "building" },
    fastAbilities: { label: "Fast Abilities", group: "ability" },
    unlimitedCurrentPush: { label: "Unlimited Current Push", group: "combat" },
    strongerAbilities: { label: "Stronger Animal Abilities", group: "ability" },
    extraTerritory: { label: "Extra Starting Territory", group: "spawn" },
    oneLife: { label: "One-Life Mode", group: "revive" },
    reviveTeammates: { label: "Revive Teammates", group: "revive" },
    sharedTeamEnergy: { label: "Shared Team Energy", group: "team" },
    suddenEvents: { label: "Sudden Events", group: "world" },
    giantBotArmy: { label: "Giant Bot Army", group: "bots" },
    bossAnimal: { label: "Boss Animal", group: "bots" },
    noSpecials: { label: "No Special Attacks", group: "rules" },
    noBuildings: { label: "No Buildings", group: "rules" },
    noObjectives: { label: "No Objectives", group: "rules" },
    permanentFog: { label: "Permanent Fog", group: "world" },
    fastMatch: { label: "Fast Match", group: "time" },
    longMatch: { label: "Long Match", group: "time" },
    unlimitedEnergy: { label: "Unlimited Energy", group: "sandbox", sandboxOnly: true },
  };

  function sanitize(input = {}, context = {}) {
    const allowed = Boolean(context.privateMatch || context.sandbox || context.customMatch);
    if (!allowed || context.publicMatch || context.ranked) return {};
    const output = {};
    Object.entries(definitions).forEach(([id, definition]) => {
      if (!input[id] || (definition.sandboxOnly && !context.sandbox)) return;
      output[id] = true;
    });
    if (output.doubleIncome && output.tripleIncome) delete output.doubleIncome;
    if (output.fastMatch && output.longMatch) delete output.fastMatch;
    return output;
  }

  return Object.freeze({ definitions: Object.freeze(definitions), sanitize });
});
