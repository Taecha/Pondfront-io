export const GRID_COLS = 34;
export const GRID_ROWS = 24;
export const WIN_CONTROL = 0.7;
export const MATCH_SECONDS = 720;

export const TILE_TYPES = {
  water: {
    label: "Open Water",
    color: "#74d7e6",
    defenseBonus: 0,
    incomeBonus: 0,
    captureCost: 13,
    blocks: false,
  },
  lily: {
    label: "Lily Pad",
    color: "#8ed16b",
    defenseBonus: 1,
    incomeBonus: 0.26,
    captureCost: 15,
    blocks: false,
  },
  reeds: {
    label: "Reeds",
    color: "#77a85d",
    defenseBonus: 4,
    incomeBonus: 0.06,
    captureCost: 17,
    blocks: false,
  },
  mud: {
    label: "Mud Island",
    color: "#b98f59",
    defenseBonus: 2,
    incomeBonus: 0.18,
    captureCost: 22,
    blocks: false,
  },
  rock: {
    label: "Rock",
    color: "#8f9aa3",
    defenseBonus: 999,
    incomeBonus: 0,
    captureCost: 999,
    blocks: true,
  },
  nest: {
    label: "Nest Zone",
    color: "#eabf83",
    defenseBonus: 1,
    incomeBonus: 0.1,
    captureCost: 16,
    blocks: false,
  },
  critter: {
    label: "Neutral Critter",
    color: "#d9c56a",
    defenseBonus: 3,
    incomeBonus: 0.2,
    captureCost: 26,
    blocks: false,
  },
};

export const ANIMALS = {
  duck: {
    label: "Duck",
    color: "#f0b63f",
    dark: "#c5792c",
    ability: "Flock Rush",
    abilityCooldown: 34,
    abilityDuration: 8,
    description: "Fast on open water and can build nests.",
  },
  snake: {
    label: "Snake",
    color: "#38a86f",
    dark: "#206d52",
    ability: "Camouflage",
    abilityCooldown: 40,
    abilityDuration: 9,
    description: "Strong around reeds and mud with hidden borders.",
  },
  frog: {
    label: "Frog",
    color: "#cc5f9b",
    dark: "#7c3d77",
    ability: "Big Leap",
    abilityCooldown: 38,
    abilityDuration: 0,
    description: "Jumps gaps and earns more from lily pads.",
  },
};

export const BUILDINGS = {
  duckNest: {
    label: "Duck Nest",
    cost: 48,
    animal: "duck",
    validTiles: ["nest", "water", "lily"],
    color: "#f0b63f",
  },
  reedGuard: {
    label: "Reed Guard",
    cost: 38,
    animal: null,
    validTiles: ["reeds", "mud", "nest"],
    color: "#4b8756",
  },
  lilyFarm: {
    label: "Lily Farm",
    cost: 42,
    animal: null,
    validTiles: ["lily", "water"],
    color: "#6abf69",
  },
  mudTunnel: {
    label: "Mud Tunnel",
    cost: 44,
    animal: "snake",
    validTiles: ["mud", "reeds"],
    color: "#7d5a3b",
  },
  jumpPad: {
    label: "Jump Pad",
    cost: 44,
    animal: "frog",
    validTiles: ["lily", "nest", "water"],
    color: "#cc5f9b",
  },
};

export const PLAYER_COLORS = [
  "#f0b63f",
  "#38a86f",
  "#cc5f9b",
  "#5378e8",
  "#e15c55",
  "#7d61d8",
  "#2ba8a0",
  "#d66f38",
  "#5b9e46",
  "#be4b7c",
];

export const BOT_NAMES = [
  "Bay Beak",
  "Reed Coil",
  "Lily Jumper",
  "North Nest",
  "Moss Stripe",
  "Pebble Snap",
  "Cattail Crew",
  "Ripple Band",
  "Mud Skipper",
];
