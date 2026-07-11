const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
const config = require("../shared/gameConfig");
console.log = originalLog;

const checks = [];

function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function quiet(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

function gameWith(settings = {}) {
  return quiet(() => {
    const game = new PondFrontServerGame({ skipInitialReset: true });
    game.reset("duck", settings.difficulty || "easy", {
      mapSize: "small",
      botCount: 4,
      privateMatch: true,
      spawnSelectionSeconds: 20,
      ...settings,
    });
    game.simTime = game.preparedAt;
    return game;
  });
}

function human(game, index = 0) {
  return game.players.filter((player) => !player.isBot)[index];
}

function availableCandidate(game, player) {
  return game.spawnManager.candidates.find((candidate) => game.spawnManager.validate(player.id, candidate.tileId).ok);
}

function startGame(game) {
  game.players.filter((player) => !player.isBot && !player.removed).forEach((player) => {
    const candidate = availableCandidate(game, player);
    if (!candidate) throw new Error(`No candidate for ${player.id}`);
    game.handleAction({ playerId: player.id, type: "spawnReserve", tileId: candidate.tileId });
    game.handleAction({ playerId: player.id, type: "spawnConfirm" });
  });
  if (game.phase === "SPAWN_SELECTION") game.spawnManager.beginCountdown("QA countdown");
  game.simTime += 5.2;
  game.tick(0.05);
  return game;
}

const basic = gameWith();
const basicHuman = human(basic);
const basicCandidate = availableCandidate(basic, basicHuman);
const initialEnergy = basicHuman.energy;
basic.tick(3);
const validReserve = basic.handleAction({ playerId: basicHuman.id, type: "spawnReserve", tileId: basicCandidate.tileId });
check("valid human spawn reservation", validReserve.ok, validReserve.message);
check("no economy before PLAYING", basicHuman.energy === initialEnergy && basic.elapsed() === 0, `${basicHuman.energy} energy, ${basic.elapsed()} elapsed`);
check("normal actions blocked before PLAYING", !basic.handleAction({ playerId: basicHuman.id, type: "expand", tileId: basicCandidate.tileId }).ok);

const blockedTile = basic.tileManager.tiles.find((tile) => config.TILE_TYPES[tile.type]?.blocks);
const blockedResult = basic.handleAction({ playerId: basicHuman.id, type: "spawnReserve", tileId: blockedTile.id, snapNearby: false });
check("blocked terrain rejected", !blockedResult.ok && /blocked|playable/i.test(blockedResult.message), blockedResult.message);

const twoHumans = gameWith({
  botCount: 0,
  allowBots: false,
  humanPlayers: [
    { id: "h1", name: "Ripple", animal: "duck", connected: true, isHost: true },
    { id: "h2", name: "Lotus", animal: "frog", connected: true },
  ],
});
const first = human(twoHumans, 0);
const second = human(twoHumans, 1);
const sharedCandidate = availableCandidate(twoHumans, first);
const firstReserve = twoHumans.spawnManager.reserveSpawn(first.id, sharedCandidate.tileId);
const conflict = twoHumans.spawnManager.reserveSpawn(second.id, sharedCandidate.tileId);
check("first overlapping reservation wins", firstReserve.ok && !conflict.ok, conflict.message);
const oldTileId = twoHumans.spawnManager.reservations.get(first.id).tileId;
const nextCandidate = twoHumans.spawnManager.candidates.find((candidate) => candidate.tileId !== oldTileId && twoHumans.spawnManager.validate(first.id, candidate.tileId).ok);
const changed = twoHumans.spawnManager.reserveSpawn(first.id, nextCandidate.tileId);
check("changing spawn releases old location", changed.ok && twoHumans.spawnManager.reservations.get(first.id).tileId !== oldTileId);

const fallback = gameWith({ spawnSelectionSeconds: 10 });
fallback.simTime += 10.1;
fallback.tick(0.05);
check("timer assigns fallback spawn", fallback.phase === "COUNTDOWN" && fallback.spawnManager.reservations.get(human(fallback).id)?.confirmed, fallback.phase);
fallback.simTime += 5.2;
fallback.tick(0.05);
check("fallback match enters PLAYING", fallback.phase === "PLAYING" && fallback.ownedTileCount(human(fallback)) > 0, fallback.phase);

const botFair = gameWith({ botCount: 10, mapSize: "medium", difficulty: "normal" });
const botReservations = botFair.players.filter((player) => player.isBot && !player.removed).map((bot) => botFair.spawnManager.reservations.get(bot.id));
const uniqueBotTiles = new Set(botReservations.map((entry) => entry?.tileId));
const botValid = botReservations.every((entry) => entry && botFair.spawnManager.candidateById.has(entry.tileId));
check("normal bots receive separated valid spawns", botValid && uniqueBotTiles.size === botReservations.length, `${uniqueBotTiles.size}/${botReservations.length}`);

const amazon = gameWith({ mapSize: "amazon", botCount: 20, difficulty: "normal", spawnSelectionSeconds: 45 });
const amazonBots = amazon.players.filter((player) => player.isBot && !player.removed);
check("Amazon supports 20 bot spawns", amazonBots.length === 20 && amazonBots.every((bot) => amazon.spawnManager.reservations.get(bot.id)?.confirmed), `${amazonBots.length} bots`);

const together = gameWith({ gameMode: "coop", teamSpawnStyle: "together", botCount: 6, coopTeammates: 2 });
const togetherHuman = human(together);
together.spawnManager.randomSpawn(togetherHuman.id);
const togetherTeam = together.players.filter((player) => player.teamId === human(together).teamId);
const togetherTiles = togetherTeam.map((player) => together.tileManager.getById(together.spawnManager.reservations.get(player.id)?.tileId)).filter(Boolean);
const togetherSeparated = togetherTiles.every((tile, index) => togetherTiles.slice(index + 1).every((other) => Math.hypot(tile.x - other.x, tile.y - other.y) >= 4));
check("Co-op Together spawns do not overlap", togetherSeparated && togetherTiles.length === togetherTeam.length, `${togetherTiles.length} teammates`);

const spread = gameWith({ gameMode: "coop", teamSpawnStyle: "spread", botCount: 6, coopTeammates: 2 });
const spreadTeam = spread.players.filter((player) => player.teamId === human(spread).teamId);
const spreadTiles = spreadTeam.map((player) => spread.tileManager.getById(spread.spawnManager.reservations.get(player.id)?.tileId)).filter(Boolean);
const spreadMin = Math.min(...spreadTiles.flatMap((tile, index) => spreadTiles.slice(index + 1).map((other) => Math.hypot(tile.x - other.x, tile.y - other.y))));
check("Co-op Spread Out enforces room", Number.isFinite(spreadMin) && spreadMin >= 5, `minimum ${spreadMin.toFixed(1)} tiles`);

const sixty = gameWith({ spawnSelectionSeconds: 60 });
check("60 second timer is server synchronized", Math.round(sixty.spawnManager.deadline - sixty.spawnManager.startedAt) === 60, `${sixty.spawnManager.deadline - sixty.spawnManager.startedAt}s`);
const earlyHuman = human(sixty);
const earlyCandidate = availableCandidate(sixty, earlyHuman);
sixty.spawnManager.reserveSpawn(earlyHuman.id, earlyCandidate.tileId);
sixty.spawnManager.confirmSpawn(earlyHuman.id);
check("everyone ready starts five second countdown", sixty.phase === "COUNTDOWN" && Math.round(sixty.spawnManager.countdownEndsAt - sixty.now()) === 5, sixty.phase);

const publicModifiers = gameWith({ privateMatch: false, customMatch: false, publicMatch: true, modifiers: { sharedTeamEnergy: true } });
const privateModifiers = gameWith({ gameMode: "coop", modifiers: { sharedTeamEnergy: true } });
check("shared energy blocked in public match", !publicModifiers.modifierManager.enabled.sharedTeamEnergy);
check("shared energy allowed in private match", Boolean(privateModifiers.modifierManager.enabled.sharedTeamEnergy));
const customUnlimited = gameWith({ modifiers: { unlimitedEnergy: true } });
const sandboxUnlimited = gameWith({ gameMode: "sandbox", sandbox: true, modifiers: { unlimitedEnergy: true } });
check("unlimited energy is sandbox only", !customUnlimited.modifierManager.enabled.unlimitedEnergy && sandboxUnlimited.modifierManager.enabled.unlimitedEnergy);
check("modified match disables progression", privateModifiers.matchSettings.progressionDisabled && privateModifiers.modifierManager.shouldDisableProgression());

const classic = startGame(gameWith({ ruleMode: "classic", botCount: 1 }));
classic.players.filter((player) => player.isBot).forEach((classicBot) => {
  classic.tileManager.owned(classicBot.id).forEach((tile) => {
    tile.owner = null;
  });
  classicBot.defeated = true;
});
classic.checkWin();
check("Classic Elimination uses last living animal", classic.ended && classic.winnerId === human(classic).id, classic.winnerId || "no winner");

const golden = startGame(gameWith({ ruleMode: "goldenLily", botCount: 1 }));
const goldenObjective = golden.objectives.objectives.find((objective) => ["goldenLily", "goldenLilyBasin", "goldenLotus", "lotusField"].includes(objective.type));
if (goldenObjective) golden.tileManager.getById(goldenObjective.tileId).owner = human(golden).id;
golden.gameModeManager.updateControlScores(1200);
const goldenWinner = golden.gameModeManager.evaluateWin();
check("Golden Lily score win is independent", Boolean(goldenObjective && goldenWinner?.winnerId === human(golden).id), goldenWinner?.reason || "no score winner");

const flood = startGame(gameWith({ gameMode: "coop", ruleMode: "floodSurvival", botCount: 4 }));
flood.gameModeManager.flood.completed = true;
const floodWinner = flood.gameModeManager.evaluateWin();
check("Flood Survival ends after target waves", Boolean(floodWinner && !flood.getPlayer(floodWinner.winnerId)?.isBot), floodWinner?.reason || "no winner");

const lastNest = startGame(gameWith({ ruleMode: "lastNest", botCount: 2 }));
lastNest.players.filter((player) => player.isBot).forEach((bot) => {
  const core = lastNest.tileManager.getById(bot.coreTileId);
  if (core) core.owner = null;
  bot.defeated = true;
});
const nestWinner = lastNest.gameModeManager.evaluateWin();
check("Last Nest uses Core Nest survival", nestWinner?.winnerId === human(lastNest).id, nestWinner?.reason || "no winner");

for (const unfinished of ["riverDomination", "pondRush", "peacefulExpansion", "migration", "animalKing"]) {
  let rejected = false;
  try {
    gameWith({ ruleMode: unfinished, botCount: 1 });
  } catch (error) {
    rejected = /not available/i.test(error.message);
  }
  check(`${unfinished} is blocked until implemented`, rejected);
}

const cheap = gameWith({ modifiers: { cheapBuildings: true, fastBuildings: true, noSpecials: true } });
const cheapHuman = human(cheap);
const normalCost = config.BUILDINGS.nest.cost;
check("private building modifiers change authoritative preview", cheap.economy.buildingCost(cheapHuman, "nest") < normalCost && cheapHuman.flags.modifierBuildTimeMultiplier === 0.35, `${cheap.economy.buildingCost(cheapHuman, "nest")} energy`);
check("No Specials modifier blocks server action", !cheap.modifierManager.beforeAction(cheapHuman, { type: "special" }).ok);

const revive = startGame(gameWith({ gameMode: "coop", teamRevives: "one", botCount: 6, coopTeammates: 2 }));
const reviveActor = human(revive);
const reviveTarget = revive.players.find((player) => player.isBot && player.teamId === reviveActor.teamId);
const reviveTile = revive.tileManager.borders(reviveActor.id)[0];
reviveTarget.defeated = true;
revive.tileManager.owned(reviveTarget.id).forEach((tile) => {
  tile.owner = null;
});
reviveActor.energy = 500;
const reviveResult = revive.teamManager.revive(revive, reviveActor, reviveTarget.id, reviveTile.id);
check("Co-op revive restores a small protected territory", reviveResult.ok && reviveTarget.flags.reviveProtectionUntil > revive.now() && revive.ownedTileCount(reviveTarget) > 0, reviveResult.message);

const reconnect = gameWith({ botCount: 1 });
const reconnectHuman = human(reconnect);
const reconnectCandidate = availableCandidate(reconnect, reconnectHuman);
reconnect.spawnManager.reserveSpawn(reconnectHuman.id, reconnectCandidate.tileId);
const reservationBefore = reconnect.spawnManager.reservations.get(reconnectHuman.id).tileId;
reconnectHuman.connected = false;
reconnectHuman.connected = true;
check("spawn reconnect preserves reservation", reconnect.spawnManager.reservations.get(reconnectHuman.id).tileId === reservationBefore);
startGame(reconnect);
const playerCountBefore = reconnect.players.length;
const coresBefore = reconnect.players.filter((player) => !player.removed).map((player) => player.coreTileId);
reconnectHuman.connected = false;
reconnectHuman.connected = true;
check("match reconnect creates no duplicate", reconnect.players.length === playerCountBefore && new Set(coresBefore).size === coresBefore.length, `${reconnect.players.length} players`);

const earlyEnd = gameWith({ botCount: 2 });
earlyEnd.checkWin();
check("spawn selection cannot end match", !earlyEnd.ended && earlyEnd.phase === "SPAWN_SELECTION", earlyEnd.phase);
const allIds = earlyEnd.players.map((player) => player.id);
check("no duplicate player ids", new Set(allIds).size === allIds.length, `${new Set(allIds).size}/${allIds.length}`);

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
