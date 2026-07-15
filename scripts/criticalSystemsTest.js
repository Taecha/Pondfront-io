const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
console.log = originalLog;
const PondActions = require("../shared/actionConfig");

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function ids(result) {
  return result.actions.filter((item) => !item.separator).map((item) => item.id);
}

const player = {
  id: "human",
  animal: "duck",
  energy: 100,
  allies: [],
  buildings: {},
  abilityReadyAt: 0,
  specialCooldowns: {},
  specialStatus: {},
};
const state = {
  phase: "PLAYING",
  serverTime: 100,
  players: [player, { id: "enemy", name: "Enemy" }, { id: "ally", name: "Ally" }],
  config: {
    tileTypes: { water: { label: "Open Water" }, rock: { label: "Rock", blocks: true } },
    buildings: {
      nest: { label: "Nest", cost: 45 },
      lilyFarm: { label: "Lily Farm", cost: 40 },
      reedGuard: { label: "Reed Guard", cost: 55 },
      mudTunnel: { label: "Mud Tunnel", cost: 60 },
      jumpPad: { label: "Jump Pad", cost: 60 },
    },
    specials: {
      lilyBarrage: { label: "Lily Barrage", cost: 120 },
      dragonflyGuard: { label: "Dragonfly Guard", cost: 90 },
      reedShield: { label: "Reed Shield", cost: 70 },
    },
  },
  teamState: { active: true },
};
player.teamId = "team-a";
const helpers = {
  isBlocked: (tile) => tile.type === "rock",
  relationship: (owner) => owner === "ally" ? { allied: true, canAttack: false } : { canAttack: true },
  buildPreview: (type) => ({ cost: state.config.buildings[type].cost + 13, canBuild: type !== "mudTunnel", reason: type === "mudTunnel" ? "Snake only." : "", buildTime: 10 }),
  validAbilityTarget: () => true,
  validSpecialTarget: () => true,
};

const neutral = PondActions.getAvailableTileActions({ state, player, tile: { id: 1, type: "water", owner: null }, context: { canExpand: true }, helpers });
check("neutral actions include five shared expansion sizes", ids(neutral).filter((id) => id === "expand").length === 5, ids(neutral).join(","));

const enemy = PondActions.getAvailableTileActions({ state, player, tile: { id: 2, type: "water", owner: "enemy" }, context: { canAttack: true, currentPushPreview: { valid: true } }, helpers });
check("enemy actions include five attacks and specials", ids(enemy).filter((id) => id === "attack").length === 5 && ids(enemy).includes("waterRoute") && ids(enemy).includes("special"), ids(enemy).join(","));

const own = PondActions.getAvailableTileActions({ state, player, tile: { id: 3, type: "water", owner: "human" }, context: { canBuild: true, canDefend: true }, helpers });
const buildMenu = own.actions.find((item) => item.id === "buildMenu");
check("own tile has build, defend, ability and shield", Boolean(buildMenu) && ids(own).includes("defend") && ids(own).includes("ability") && ids(own).includes("special"), ids(own).join(","));
check("build submenu uses live preview costs and blocked reason", buildMenu.submenu[0].cost === 58 && buildMenu.submenu.find((item) => item.payload.buildingType === "mudTunnel").disabledReason === "Snake only.");

const ally = PondActions.getAvailableTileActions({ state, player, tile: { id: 4, type: "water", owner: "ally" }, context: {}, helpers });
check("ally tile has support and guard", ids(ally).includes("support") && ids(ally).includes("special"), ids(ally).join(","));

const blocked = PondActions.getAvailableTileActions({ state, player, tile: { id: 5, type: "rock", owner: null }, context: {}, helpers });
check("blocked terrain is inspect-only", ids(blocked).length === 1 && ids(blocked)[0] === "viewTerrain", ids(blocked).join(","));

const spawn = PondActions.getAvailableTileActions({ state: { ...state, phase: "SPAWN_SELECTION", spawn: {} }, player, tile: { id: 6, type: "water" }, context: {}, helpers });
check("spawn phase excludes gameplay actions", ids(spawn).includes("spawnReserve") && !ids(spawn).some((id) => ["expand", "attack", "buildMenu"].includes(id)), ids(spawn).join(","));

const game = new PondFrontServerGame({ skipInitialReset: true });
game.reset("duck", "easy", { mapSize: "small", botCount: 2, privateMatch: true, skipSpawnSelection: true });
const human = game.players.find((candidate) => !candidate.isBot);
human.abilityReadyAt = 0;
const result = game.handleAction({ type: "ability", playerId: human.id, clientActionId: "qa-ability" });
const status = game.combat.abilityStatus(human, game.now());
const snapshotHuman = game.snapshot(human.id).players.find((candidate) => candidate.id === human.id);
check("successful ability returns authoritative cooldown", result.ok && result.cooldownEndsAt > game.now() && result.actionId === "qa-ability", JSON.stringify(result));
check("cooldown status and reconnect snapshot agree", status.cooldownEndsAt === result.cooldownEndsAt && snapshotHuman.abilityCooldownEndsAt === result.cooldownEndsAt && snapshotHuman.abilityStatus.cooldownLeft > 0);
const beforeRejected = human.abilityReadyAt;
const rejected = game.handleAction({ type: "ability", playerId: human.id, clientActionId: "qa-rejected" });
check("rejected ability does not restart cooldown", !rejected.ok && human.abilityReadyAt === beforeRejected, rejected.message);

checks.forEach((entry) => console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.name}${entry.detail ? ` - ${entry.detail}` : ""}`));
const failed = checks.filter((entry) => !entry.pass);
if (failed.length) process.exitCode = 1;
else console.log(`PASS critical systems regression (${checks.length} checks)`);
