(function initDiplomacyConfig(root, factory) {
  const diplomacyConfig = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = diplomacyConfig;
  else root.PondDiplomacy = diplomacyConfig;
})(typeof self !== "undefined" ? self : this, function factory() {
  return {
    states: {
      neutral: { label: "Neutral", icon: "-", color: "#9bb8c6" },
      requested: { label: "Alliance Requested", icon: "?", color: "#f0cc74" },
      allied: { label: "Allied", icon: "A", color: "#77d99e" },
      war: { label: "At War", icon: "W", color: "#e9857c" },
      truce: { label: "Truce", icon: "T", color: "#83dced" },
      betrayal: { label: "Betrayal Cooldown", icon: "!", color: "#f08b67" },
      markedEnemy: { label: "Marked Enemy", icon: "E", color: "#d96b61" },
    },
    timing: {
      allianceRequestSeconds: 45,
      truceSeconds: 60,
      betrayalCooldownSeconds: 45,
      warMemorySeconds: 90,
      relationMemorySeconds: 220,
      requestSpamSeconds: 12,
      pingCooldownSeconds: 2.5,
    },
    pingTypes: {
      attack: { label: "Attack Here", visibility: "allies" },
      defend: { label: "Defend Here", visibility: "allies" },
      help: { label: "Help Me", visibility: "allies" },
      weak: { label: "Enemy Weak", visibility: "allies" },
      strong: { label: "Enemy Strong", visibility: "allies" },
      objective: { label: "Capture Objective", visibility: "allies" },
      danger: { label: "Danger", visibility: "allies" },
      good: { label: "Good Job", visibility: "allies" },
      warning: { label: "Warning", visibility: "public" },
      peace: { label: "Peace", visibility: "public" },
    },
  };
});
