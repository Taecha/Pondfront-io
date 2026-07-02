(function initPondConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeConfig() {
  const balance =
    typeof require === "function"
      ? require("./balanceConfig")
      : (typeof globalThis !== "undefined" ? globalThis.PondBalance : window.PondBalance);

  const TILE_TYPES = {
    water: {
      label: "Open Water",
      color: "#203f4d",
      neutralColor: "#234f5e",
      incomeBonus: 0,
      defenseBonus: 0,
      captureCost: 12,
      blocks: false,
      strategic: false,
    },
    lily: {
      label: "Lily Pad",
      color: "#4f8d72",
      neutralColor: "#315e58",
      incomeBonus: 0.24,
      defenseBonus: 1,
      captureCost: 15,
      blocks: false,
      strategic: true,
    },
    reeds: {
      label: "Reeds",
      color: "#56764b",
      neutralColor: "#354f41",
      incomeBonus: 0.05,
      defenseBonus: 3,
      captureCost: 16,
      blocks: false,
      strategic: true,
    },
    mud: {
      label: "Mud Island",
      color: "#886a48",
      neutralColor: "#5d4b3d",
      incomeBonus: 0.16,
      defenseBonus: 2,
      captureCost: 21,
      blocks: false,
      strategic: true,
    },
    rock: {
      label: "Rock",
      color: "#53606a",
      neutralColor: "#53606a",
      incomeBonus: 0,
      defenseBonus: 999,
      captureCost: 999,
      blocks: true,
      strategic: true,
    },
    nest: {
      label: "Nest Zone",
      color: "#9b7c4e",
      neutralColor: "#725b42",
      incomeBonus: 0.08,
      defenseBonus: 1,
      captureCost: 16,
      blocks: false,
      strategic: true,
    },
  };

  const BUILDINGS = {
    nest: {
      label: "Nest",
      cost: 45,
      animal: null,
      validTiles: ["nest", "water", "lily"],
      stat: "max",
    },
    lilyFarm: {
      label: "Lily Farm",
      cost: 42,
      animal: null,
      validTiles: ["lily", "water"],
      stat: "income",
    },
    reedGuard: {
      label: "Reed Guard",
      cost: 38,
      animal: null,
      validTiles: ["reeds", "mud", "nest"],
      stat: "defense",
    },
    mudTunnel: {
      label: "Mud Tunnel",
      cost: 44,
      animal: "snake",
      validTiles: ["mud", "reeds"],
      stat: "mobility",
    },
    jumpPad: {
      label: "Jump Pad",
      cost: 44,
      animal: "frog",
      validTiles: ["lily", "nest", "water"],
      stat: "mobility",
    },
  };

  const PLAYER_COLORS = [
    "#d8ad48",
    "#5fbf83",
    "#bc6ca2",
    "#5d84dd",
    "#d96b61",
    "#8d70db",
    "#49b7ad",
    "#d78845",
    "#78a95b",
    "#cf5c83",
    "#58a4cf",
    "#b89652",
    "#6fc5d8",
    "#a8be5b",
    "#d0779f",
    "#8fb2e8",
    "#c99a5c",
    "#7bc7a6",
  ];

  function getNeutralTileExpansionCost(tileType, playerAnimal, modifiers = {}) {
    const type = TILE_TYPES[tileType];
    if (!type || type.blocks) return Infinity;
    const territory = Number(modifiers.territory || 0);
    const distance = Number(modifiers.distanceFromCore || 0);
    const nearbyEnemyBorders = Number(modifiers.nearbyEnemyBorders || 0);
    let cost = type.captureCost * balance.expansionBaseMultiplier;

    cost += Math.max(0, territory - balance.expansionFreeTerritory) * balance.expansionTerritoryPenalty;
    cost += Math.max(0, distance - 3) * balance.expansionDistancePenalty;
    cost += nearbyEnemyBorders * balance.expansionEnemyBorderPenalty;
    if (type.strategic) cost += balance.expansionStrategicPenalty;

    if (modifiers.jumped) cost *= 1.1;
    if (playerAnimal === "duck" && tileType === "water" && modifiers.flockRush) {
      cost *= balance.flockRushOpenWaterCostMultiplier || 0.65;
    }

    return Math.max(1, Math.round(cost));
  }

  return {
    GRID_COLS: 84,
    GRID_ROWS: 54,
    WIN_CONTROL: 0.7,
    MATCH_SECONDS: balance.maxMatchTime,
    TICK_RATE_MS: 250,
    MAX_EVENTS: 180,
    HUMAN_ID: "p0",
    BOT_COUNT: 12,
    TILE_TYPES,
    BUILDINGS,
    getNeutralTileExpansionCost,
    BALANCE: balance,
    PLAYER_COLORS,
    BOT_NAMES: [
      "Amazon Fang",
      "Nile Jumper",
      "Mekong Stripe",
      "Tahoe Snap",
      "Baikal Leap",
      "Marshlight Coil",
      "Stillwater Beak",
      "Rainlake Reed",
      "Delta Bloom",
      "Fen Ripple",
      "Yukon Crest",
      "Zambezi Flick",
      "Orinoco Skim",
      "Volga Moss",
      "Erie Glimmer",
      "Victoria Sedge",
      "Titicaca Drift",
      "Bluewater Snap",
      "Cedar Marsh",
      "Silverdelta",
    ],
  };
});
