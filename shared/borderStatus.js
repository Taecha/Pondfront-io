(function initBorderStatus(root, factory) {
  const borderStatus = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = borderStatus;
  else root.PondBorderStatus = borderStatus;
})(typeof self !== "undefined" ? self : this, function factory() {
  const labels = {
    open: "Open Border",
    enemy: "Enemy Border",
    weak: "Weak Border",
    strong: "Strong Border",
    reinforced: "Reinforced Border",
    defended: "Defended Border",
    allied: "Allied Border",
    truce: "Truce Border",
    war: "At War",
    blocked: "Blocked Terrain",
    invalid: "Invalid Target",
    underAttack: "Under Attack",
  };

  function defenseLevel(value = 0) {
    if (value >= 36) return "Very High";
    if (value >= 22) return "High";
    if (value >= 10) return "Medium";
    return "Low";
  }

  function riskLevel(sendEnergy = 0, cost = 0, estimatedTiles = 0) {
    if (cost <= 0) return "Unknown";
    const ratio = sendEnergy / Math.max(1, cost);
    if (ratio >= 3 && estimatedTiles >= 5) return "Safe";
    if (ratio >= 1.65) return "Fair";
    if (ratio >= 1.05) return "Risky";
    if (ratio >= 0.72) return "Very Risky";
    return "Bad Attack";
  }

  function statusFor({ tile, tileType, relation, ownerIsHuman, canExpand, canAttack, underAttack, estimatedCost = 0 } = {}) {
    if (!tile || !tileType) return { id: "invalid", label: labels.invalid, detail: "Select a valid tile." };
    if (tileType.blocks) return { id: "blocked", label: labels.blocked, detail: "Rock blocks movement and cannot be captured." };
    if (underAttack) return { id: "underAttack", label: labels.underAttack, detail: "This border is currently being invaded." };
    if (!tile.owner && canExpand) return { id: "open", label: labels.open, detail: "Can expand here." };
    if (!tile.owner) return { id: "invalid", label: labels.invalid, detail: "Too far from your connected border." };
    if (ownerIsHuman) {
      if ((tile.defenseEnergy || 0) >= 10) return { id: "defended", label: labels.defended, detail: "This tile stores defensive energy." };
      return { id: "open", label: labels.open, detail: "Your border can be reinforced or used as an attack source." };
    }
    if (relation?.state === "allied" || relation?.allied) return { id: "allied", label: labels.allied, detail: "You cannot attack allies." };
    if (relation?.state === "truce") return { id: "truce", label: labels.truce, detail: "Truce active. Attacks are disabled." };
    if (relation?.state === "war") return { id: "war", label: labels.war, detail: "You are at war with this player." };
    if (!canAttack) return { id: "invalid", label: labels.invalid, detail: relation?.blockReason || "Need a connected enemy border." };
    if ((tile.defenseEnergy || 0) >= 24 || estimatedCost >= 34) {
      return { id: "reinforced", label: labels.reinforced, detail: "Enemy defense is boosted. Attacks cost more energy." };
    }
    if ((tile.defenseEnergy || 0) >= 10 || estimatedCost >= 22) {
      return { id: "strong", label: labels.strong, detail: "High estimated defense. Send more energy or avoid." };
    }
    if ((tile.defenseEnergy || 0) <= 3 && estimatedCost <= 15) {
      return { id: "weak", label: labels.weak, detail: "Low estimated defense. Good attack target." };
    }
    return { id: "enemy", label: labels.enemy, detail: "Can attack from your connected border." };
  }

  return {
    labels,
    defenseLevel,
    riskLevel,
    statusFor,
  };
});
