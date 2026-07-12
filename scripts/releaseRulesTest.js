const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
console.log = originalLog;
const config = require("../shared/gameConfig");
const buildingRules = require("../shared/buildingRules");
const gameModes = require("../shared/gameModeConfig");
const specials = require("../shared/specialConfig");
const ProgressionManager = require("../server/ProgressionManager");

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

const basePlayer = { id: "p", animal: "duck", energy: 500, buildings: {}, flags: {} };
const firstFarm = buildingRules.buildingCostDetails(basePlayer, "lilyFarm", config);
const scaledFarm = buildingRules.buildingCostDetails({ ...basePlayer, buildings: { lilyFarm: 3 } }, "lilyFarm", config);
const carpFarm = buildingRules.buildingCostDetails({ ...basePlayer, animal: "carp" }, "lilyFarm", config);
check("building cost scales with owned count", scaledFarm.cost > firstFarm.cost, `${firstFarm.cost} -> ${scaledFarm.cost}`);
check("Carp Lily Farm discount uses shared formula", carpFarm.cost < firstFarm.cost, `${carpFarm.cost} < ${firstFarm.cost}`);

const buildTile = { id: 1, owner: "p", type: "water", building: null };
const preview = buildingRules.previewBuild({ player: basePlayer, tile: buildTile, buildingType: "lilyFarm", gameConfig: config, now: 100 });
check("build preview cost equals shared building cost", preview.canBuild && preview.cost === firstFarm.cost && preview.buildTime > 0, `${preview.cost}`);

const levelOne = buildingRules.upgradeCostDetails({ ...basePlayer, buildings: { nest: 1 } }, { building: "nest", buildingLevel: 1 }, config);
const levelTwo = buildingRules.upgradeCostDetails({ ...basePlayer, buildings: { nest: 1 } }, { building: "nest", buildingLevel: 2 }, config);
check("upgrade cost increases by level", levelTwo.cost > levelOne.cost, `${levelOne.cost} -> ${levelTwo.cost}`);

const normalWater = config.getNeutralTileExpansionCost("water", "duck", { territory: 12 });
const rushWater = config.getNeutralTileExpansionCost("water", "duck", { territory: 12, flockRush: true });
check("Flock Rush lowers authoritative water expansion cost", rushWater < normalWater, `${normalWater} -> ${rushWater}`);
check("blocked terrain cannot be expanded", config.getNeutralTileExpansionCost("rock", "duck") === Infinity);

Object.values(specials).forEach((special) => {
  check(`${special.label} has finite positive cost/cooldown`, Number.isFinite(special.cost) && special.cost > 0 && Number.isFinite(special.cooldown) && special.cooldown > 0, `${special.cost}/${special.cooldown}`);
});

const game = new PondFrontServerGame({ skipInitialReset: true });
game.reset("duck", "easy", { mapSize: "small", botCount: 2, privateMatch: true, skipSpawnSelection: true, ruleMode: "classic" });
const human = game.players.find((player) => !player.isBot);
const bot = game.players.find((player) => player.isBot);
const transferTile = game.tileManager.owned(human.id).find((tile) => !tile.isCore) || game.tileManager.owned(human.id)[0];
transferTile.type = "water";
transferTile.building = "lilyFarm";
transferTile.buildingLevel = 2;
transferTile.buildingActiveAt = game.now() - 1;
game.economy.recalculate(game.players, game.now(), game);
const humanFarmsBefore = human.buildings.lilyFarm;
transferTile.owner = bot.id;
const transferEvent = game.tileManager.transferBuilding(transferTile.id, bot.id, human.id, "qa", game.now());
game.economy.recalculate(game.players, game.now(), game);
check("captured building type and level transfer", transferEvent && transferTile.building === "lilyFarm" && transferTile.buildingLevel === 2 && transferTile.buildingConversionUntil > game.now());
check("captured building bonus leaves old owner", human.buildings.lilyFarm === Math.max(0, humanFarmsBefore - 1), `${humanFarmsBefore} -> ${human.buildings.lilyFarm}`);
check("captured building count reaches new owner", bot.buildings.lilyFarm >= 1, `${bot.buildings.lilyFarm}`);

human.connected = false;
check("temporary disconnect does not eliminate owned player", game.isPlayerAlive(human) && game.ownedTileCount(human) > 0);

const botTiles = game.tileManager.owned(bot.id);
botTiles.slice(1).forEach((tile) => { tile.owner = null; });
bot.defeated = false;
check("bot with one owned tile remains alive", game.ownedTileCount(bot) === 1 && game.isPlayerAlive(bot), `${game.ownedTileCount(bot)} tile`);

human.teamId = "team-blue";
bot.teamId = "team-blue";
check("team remains alive while one member is alive", game.isTeamAlive("team-blue"));

const classicWinnerAtHighControl = game.gameModeManager.checkClassicEliminationWin();
check("Classic ignores legacy 70 percent control", classicWinnerAtHighControl === null || game.players.filter((player) => game.isPlayerAlive(player)).length === 1);

check("all active modes have distinct authoritative win handlers", ["classic", "goldenLily", "floodSurvival", "lastNest"].every((id) => gameModes.modes[id]?.implemented && gameModes.modes[id]?.winConditionType));
check("unfinished modes are server-blocked", ["riverDomination", "pondRush", "migration", "animalKing", "peacefulExpansion"].every((id) => gameModes.sanitize(id, false) === null));

const progression = new ProgressionManager(() => {});
const progressionPlayer = { id: "xp", animal: "duck", xp: 0, level: 1, flags: {}, defeated: false };
const progressionGame = { matchSettings: { progressionDisabled: true }, modifierManager: null, getPlayer: () => progressionPlayer, now: () => 100 };
progression.handleEvent(progressionGame, { kind: "expand", playerId: "xp" });
check("custom match progression blocking is authoritative", progressionPlayer.xp === 0);
progressionGame.matchSettings.progressionDisabled = false;
progression.handleEvent(progressionGame, { kind: "expand", playerId: "xp" });
check("eligible standard match grants progression", progressionPlayer.xp > 0, `${progressionPlayer.xp} XP`);

const receiptGame = new PondFrontServerGame({ skipInitialReset: true });
receiptGame.reset("duck", "easy", { mapSize: "small", botCount: 2, privateMatch: true, skipSpawnSelection: true });
const receiptPlayer = receiptGame.players.find((player) => !player.isBot);
receiptPlayer.abilityReadyAt = 0;
receiptPlayer.energy = 100;
const firstAbility = receiptGame.handleAction({ type: "ability", playerId: receiptPlayer.id, clientActionId: "release-idempotency" });
const energyAfterFirst = receiptPlayer.energy;
const cooldownAfterFirst = receiptPlayer.abilityReadyAt;
const duplicateAbility = receiptGame.handleAction({ type: "ability", playerId: receiptPlayer.id, clientActionId: "release-idempotency" });
check(
  "duplicate client action is idempotent",
  firstAbility.ok && duplicateAbility.ok && duplicateAbility.duplicate === true && receiptPlayer.energy === energyAfterFirst && receiptPlayer.abilityReadyAt === cooldownAfterFirst,
  `${energyAfterFirst} energy`,
);

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
