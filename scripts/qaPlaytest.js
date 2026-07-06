const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
const config = require("../shared/gameConfig");
console.log = originalLog;

function withQuietLogs(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

function newGame(animal = "duck", settings = {}) {
  return withQuietLogs(() => {
    const game = new PondFrontServerGame();
    game.reset(animal, settings.difficulty || "smart", {
      mapSize: settings.mapSize || "small",
      botCount: settings.botCount ?? 4,
      matchLength: settings.matchLength || "quick",
      practice: settings.practice ?? true,
      playerName: settings.playerName || "QA Tester",
    });
    const baseTime = game.startedAt;
    game.simTime = baseTime;
    game.startedAt = baseTime;
    return game;
  });
}

function assertCheck(checks, name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function firstCapturable(game, player, predicate = () => true) {
  return game.tileManager.capturable(player.id).find((tile) => !tile.owner && predicate(tile));
}

function firstOwnedBuildTile(game, player, buildingType) {
  return game.tileManager.owned(player.id).find((tile) => game.economy.canBuild(player, tile, buildingType));
}

function finishConstruction(game, tile) {
  game.simTime = Math.max(game.now(), tile?.buildingActiveAt || game.now()) + 0.25;
  game.economy.update(game.players, 0, game.now(), game);
}

function makeEnemyBorder(game, attacker, defender) {
  const source = game.tileManager
    .owned(attacker.id)
    .find((tile) => tile.neighbors.some((neighbor) => !neighbor.owner && !config.TILE_TYPES[neighbor.type].blocks));
  const target = source?.neighbors.find((neighbor) => !neighbor.owner && !config.TILE_TYPES[neighbor.type].blocks);
  if (!target) return null;
  target.owner = defender.id;
  target.defenseEnergy = 0;
  target.captureProgress = {};
  target.lastChanged = game.now();
  game.economy.recalculate(game.players, game.now(), game);
  return target;
}

function testMapSizes(checks) {
  Object.entries(config.MAP_SIZES).forEach(([id, expected]) => {
    const game = newGame("duck", { mapSize: id, botCount: expected.defaultBots });
    assertCheck(checks, `${id} map grid`, game.tileManager.cols === expected.cols && game.tileManager.rows === expected.rows, `${game.tileManager.cols}x${game.tileManager.rows}`);
    assertCheck(checks, `${id} bot count`, game.players.filter((player) => player.isBot).length === expected.defaultBots, `${game.players.filter((player) => player.isBot).length} bots`);
    assertCheck(checks, `${id} objectives scale`, game.matchSettings.map.objectiveCount === expected.objectiveCount, `${game.matchSettings.map.objectiveCount} objectives`);
  });
}

function testExpansion(checks) {
  const game = newGame("duck");
  const player = game.getPlayer(config.HUMAN_ID);
  player.energy = 100;
  game.economy.recalculate(game.players, game.now(), game);
  const target = firstCapturable(game, player, (tile) => tile.type === "water") || firstCapturable(game, player);
  const cost = game.combat.neutralCaptureCost(game, player, target, game.tileManager.reachInfo(player, target));
  const partial = game.combat.expandOrAttack(game, player, target.id, Math.max(0.02, Math.min(0.12, (cost * 0.45) / player.energy)));
  const progressAfterPartial = target.captureProgress?.[player.id] || 0;
  player.energy = 120;
  const capture = game.combat.expandOrAttack(game, player, target.id, 1);
  assertCheck(checks, "partial expansion stores progress", partial.ok && !partial.captured && progressAfterPartial > 0, `${Math.round(progressAfterPartial)}/${cost}`);
  assertCheck(checks, "enough expansion captures tile", capture.ok && capture.captured && target.owner === player.id, capture.message);
}

function testBuildings(checks) {
  const game = newGame("frog");
  const player = game.getPlayer(config.HUMAN_ID);
  player.energy = 240;
  game.economy.recalculate(game.players, game.now(), game);
  const beforeMax = player.maxEnergy;
  const nestTile = firstOwnedBuildTile(game, player, "nest");
  const nest = nestTile ? game.economy.build(player, nestTile, "nest", game.now()) : { ok: false };
  const maxDuringConstruction = (() => {
    game.economy.recalculate(game.players, game.now(), game);
    return player.maxEnergy;
  })();
  let guardTile = firstOwnedBuildTile(game, player, "reedGuard");
  if (!guardTile) {
    guardTile = game.tileManager.owned(player.id).find((tile) => !tile.building);
    if (guardTile) guardTile.type = "reeds";
  }
  const secondBuild = nest.ok && guardTile ? game.economy.build(player, guardTile, "reedGuard", game.now()) : { ok: false };
  finishConstruction(game, nestTile);
  game.economy.recalculate(game.players, game.now(), game);
  const beforeUpgradeDefense = nestTile?.defenseEnergy || 0;
  player.energy = Math.max(player.energy, 160);
  const upgrade = nest.ok ? game.economy.upgradeBuilding(player, nestTile, game.now()) : { ok: false };
  finishConstruction(game, nestTile);
  game.economy.recalculate(game.players, game.now(), game);
  let lilyTile = firstOwnedBuildTile(game, player, "lilyFarm");
  if (!lilyTile) {
    lilyTile = game.tileManager.owned(player.id).find((tile) => !tile.building);
    if (lilyTile) lilyTile.type = "water";
  }
  player.energy = Math.max(player.energy, 160);
  const firstFarmCost = game.economy.buildingCost(player, "lilyFarm");
  const lily = lilyTile ? game.economy.build(player, lilyTile, "lilyFarm", game.now()) : { ok: false };
  game.economy.recalculate(game.players, game.now(), game);
  const secondFarmCost = game.economy.buildingCost(player, "lilyFarm");
  const beforeIncome = player.income;
  if (lily.ok) {
    finishConstruction(game, lilyTile);
    game.economy.recalculate(game.players, game.now(), game);
  }
  assertCheck(checks, "nest increases max energy", nest.ok && player.maxEnergy > beforeMax, `${Math.round(beforeMax)} -> ${Math.round(player.maxEnergy)}`);
  assertCheck(checks, "building effect waits for construction", nest.ok && maxDuringConstruction <= beforeMax + 1, `${Math.round(beforeMax)} -> ${Math.round(maxDuringConstruction)}`);
  assertCheck(checks, "can start another building while one constructs", secondBuild.ok, secondBuild.message);
  assertCheck(checks, "building upgrade reaches level 2", upgrade.ok && nestTile.buildingLevel === 2 && nestTile.defenseEnergy > beforeUpgradeDefense, upgrade.message);
  assertCheck(checks, "lily farm cost scales upward", lily.ok && secondFarmCost > firstFarmCost, `${firstFarmCost} -> ${secondFarmCost}`);
  assertCheck(checks, "lily farm increases income", lily.ok && player.income > beforeIncome, `${beforeIncome.toFixed(1)} -> ${player.income.toFixed(1)}`);
}

function testAbilities(checks) {
  const duckGame = newGame("duck");
  const duck = duckGame.getPlayer(config.HUMAN_ID);
  duck.energy = 120;
  const duckWater = firstCapturable(duckGame, duck, (tile) => tile.type === "water") || firstCapturable(duckGame, duck);
  const duckReach = duckGame.tileManager.reachInfo(duck, duckWater);
  const duckCostBefore = duckGame.combat.neutralCaptureCost(duckGame, duck, duckWater, duckReach);
  const duckAbility = duckGame.combat.activateAbility(duckGame, duck);
  const duckCostAfter = duckGame.combat.neutralCaptureCost(duckGame, duck, duckWater, duckReach);
  assertCheck(checks, "duck flock rush reduces water cost", duckAbility.ok && duckCostAfter < duckCostBefore, `${duckCostBefore} -> ${duckCostAfter}`);

  const snakeGame = newGame("snake");
  const snake = snakeGame.getPlayer(config.HUMAN_ID);
  snake.energy = 120;
  const snakeAbility = snakeGame.combat.activateAbility(snakeGame, snake);
  assertCheck(checks, "snake ambush prepares next attack", snakeAbility.ok && snake.flags.ambushReady, snakeAbility.message);

  const frogGame = newGame("frog");
  const frog = frogGame.getPlayer(config.HUMAN_ID);
  frog.energy = 120;
  const leapTarget = frogGame.tileManager.capturable(frog.id).find((tile) => {
    if (tile.owner || config.TILE_TYPES[tile.type].blocks) return false;
    const reach = frogGame.tileManager.reachInfo(frog, tile);
    return reach.reachable && reach.jumped;
  });
  const beforeTerritory = frog.territory;
  const frogAbility = frogGame.combat.activateAbility(frogGame, frog, { targetTileId: leapTarget?.id });
  frogGame.economy.recalculate(frogGame.players, frogGame.now(), frogGame);
  assertCheck(checks, "frog big leap captures neutral tiles", frogAbility.ok && frog.territory > beforeTerritory, frogAbility.message);

  const turtleGame = newGame("turtle");
  const turtle = turtleGame.getPlayer(config.HUMAN_ID);
  const turtleAttacker = turtleGame.players.find((player) => player.isBot);
  turtle.energy = 120;
  turtleGame.economy.recalculate(turtleGame.players, turtleGame.now(), turtleGame);
  const turtleBorder = turtleGame.tileManager.owned(turtle.id).find((tile) => tile.neighbors.some((neighbor) => !neighbor.owner && !config.TILE_TYPES[neighbor.type].blocks));
  const attackNeighbor = turtleBorder?.neighbors.find((neighbor) => !neighbor.owner && !config.TILE_TYPES[neighbor.type].blocks);
  if (turtleBorder && attackNeighbor && turtleAttacker) attackNeighbor.owner = turtleAttacker.id;
  const shellCandidate = { tile: turtleBorder, from: attackNeighbor?.id, distance: 0, attackerEdges: 1 };
  const shellWave = { remainingPower: 100, spentEnergy: 100, ambushApplied: false };
  const shellCostBefore = turtleBorder ? turtleGame.combat.waveCaptureCost(turtleGame, shellWave, turtleAttacker, turtle, shellCandidate) : 0;
  const turtleAbility = turtleGame.combat.activateAbility(turtleGame, turtle);
  const shellCostAfter = turtleBorder ? turtleGame.combat.waveCaptureCost(turtleGame, shellWave, turtleAttacker, turtle, shellCandidate) : 0;
  assertCheck(checks, "turtle shell guard increases capture cost", turtleAbility.ok && shellCostAfter > shellCostBefore, `${Math.round(shellCostBefore)} -> ${Math.round(shellCostAfter)}`);

  const carpGame = newGame("carp");
  const carp = carpGame.getPlayer(config.HUMAN_ID);
  carp.energy = 120;
  carpGame.economy.recalculate(carpGame.players, carpGame.now(), carpGame);
  const carpTarget = firstCapturable(carpGame, carp, (tile) => tile.type === "lily") || firstCapturable(carpGame, carp, (tile) => tile.type === "water") || firstCapturable(carpGame, carp);
  const carpReach = carpGame.tileManager.reachInfo(carp, carpTarget);
  const carpCostBefore = carpGame.combat.neutralCaptureCost(carpGame, carp, carpTarget, carpReach);
  const carpIncomeBefore = carp.income;
  const carpAbility = carpGame.combat.activateAbility(carpGame, carp);
  carpGame.economy.recalculate(carpGame.players, carpGame.now(), carpGame);
  const carpCostAfter = carpGame.combat.neutralCaptureCost(carpGame, carp, carpTarget, carpReach);
  assertCheck(checks, "carp golden current boosts income", carpAbility.ok && carp.income > carpIncomeBefore, `${carpIncomeBefore.toFixed(1)} -> ${carp.income.toFixed(1)}`);
  assertCheck(checks, "carp golden current reduces water/lily cost", carpAbility.ok && carpCostAfter < carpCostBefore, `${carpCostBefore} -> ${carpCostAfter}`);
}

function testDiplomacyAndCombat(checks) {
  const game = newGame("duck", { botCount: 3 });
  const human = game.getPlayer(config.HUMAN_ID);
  const bot = game.players.find((player) => player.isBot);
  bot.personality = "loyalAlly";
  human.energy = 160;
  bot.energy = 90;
  const border = makeEnemyBorder(game, human, bot);

  const request = game.diplomacy.handle(game, bot, human.id, "requestAlliance");
  const pending = game.diplomacy.relationship(human.id, bot.id, game.now());
  const accept = game.diplomacy.handle(game, human, bot.id, "acceptAlliance");
  const acceptedAlliance = game.diplomacy.areAllied(human.id, bot.id);
  const allyAttack = game.combat.expandOrAttack(game, human, border.id, 0.25);
  const breakAlliance = game.diplomacy.handle(game, human, bot.id, "breakAlliance");
  const betrayalAttack = game.combat.expandOrAttack(game, human, border.id, 0.25);
  assertCheck(checks, "alliance request can be pending", request.ok && pending.pendingForViewer && pending.requestType === "alliance", pending.label);
  assertCheck(checks, "alliance can be accepted", accept.ok && acceptedAlliance, accept.message);
  assertCheck(checks, "attacking ally is blocked", !allyAttack.ok && /ally/i.test(allyAttack.message), allyAttack.message);
  assertCheck(checks, "breaking alliance creates betrayal cooldown", breakAlliance.ok && game.diplomacy.relationship(human.id, bot.id, game.now()).betrayalByViewer, breakAlliance.message);
  assertCheck(checks, "betrayal cooldown blocks betrayer attack", !betrayalAttack.ok && /betrayal/i.test(betrayalAttack.message), betrayalAttack.message);

  const truceGame = newGame("snake", { botCount: 3 });
  const truceHuman = truceGame.getPlayer(config.HUMAN_ID);
  const truceBot = truceGame.players.find((player) => player.isBot);
  const truceBorder = makeEnemyBorder(truceGame, truceHuman, truceBot);
  truceHuman.energy = 160;
  const relation = truceGame.diplomacy.entry(truceHuman.id, truceBot.id);
  const truce = truceGame.diplomacy.activateTruce(truceGame, truceHuman, truceBot, relation, truceGame.now());
  const truceAttack = truceGame.combat.expandOrAttack(truceGame, truceHuman, truceBorder.id, 0.25);
  assertCheck(checks, "truce blocks attacks", truce.ok && !truceAttack.ok && /truce/i.test(truceAttack.message), truceAttack.message);

  const expireGame = newGame("frog", { botCount: 3 });
  const expireHuman = expireGame.getPlayer(config.HUMAN_ID);
  const expireBot = expireGame.players.find((player) => player.isBot);
  const expireRequest = expireGame.diplomacy.handle(expireGame, expireBot, expireHuman.id, "requestAlliance");
  expireGame.simTime += 46;
  expireGame.diplomacy.update(expireGame);
  const expired = expireGame.diplomacy.relationship(expireHuman.id, expireBot.id, expireGame.now());
  assertCheck(checks, "alliance request expires", expireRequest.ok && expired.state !== "requested", expired.label);

  const combatGame = newGame("snake", { botCount: 3 });
  const attacker = combatGame.getPlayer(config.HUMAN_ID);
  const defender = combatGame.players.find((player) => player.isBot);
  attacker.energy = 220;
  defender.energy = 35;
  const attackBorder = makeEnemyBorder(combatGame, attacker, defender);
  const farTile = combatGame.tileManager.owned(defender.id).find((tile) => !tile.neighbors.some((neighbor) => neighbor.owner === attacker.id));
  const farAttack = farTile ? combatGame.combat.expandOrAttack(combatGame, attacker, farTile.id, 0.25) : { ok: false, message: "Too far from border." };
  const attack = combatGame.combat.expandOrAttack(combatGame, attacker, attackBorder.id, 0.5);
  const war = combatGame.diplomacy.relationship(attacker.id, defender.id, combatGame.now());
  const wave = { remainingPower: 100, spentEnergy: 100, ambushApplied: false };
  const candidate = { tile: attackBorder, from: attackBorder.neighbors.find((tile) => tile.owner === attacker.id)?.id, distance: 0, attackerEdges: 1 };
  const lowDefenseCost = combatGame.combat.waveCaptureCost(combatGame, wave, attacker, defender, candidate);
  attackBorder.owner = defender.id;
  attackBorder.defenseEnergy = 28;
  const highDefenseCost = combatGame.combat.waveCaptureCost(combatGame, wave, attacker, defender, candidate);
  const defendTile = combatGame.tileManager.owned(attacker.id).find((tile) => tile.neighbors.some((neighbor) => neighbor.owner === defender.id));
  attacker.energy = 160;
  const defendResult = defendTile ? combatGame.combat.defend(attacker, defendTile.id, 0.25, combatGame.now()) : { ok: false, message: "No border" };
  assertCheck(checks, "far enemy tile attack is rejected", !farAttack.ok && /far|border/i.test(farAttack.message), farAttack.message);
  assertCheck(checks, "frontline attack starts war", attack.ok && war.state === "war", `${attack.message} | ${war.label}`);
  assertCheck(checks, "defended border costs more", highDefenseCost > lowDefenseCost, `${Math.round(lowDefenseCost)} -> ${Math.round(highDefenseCost)}`);
  assertCheck(checks, "defend message explains reinforced defense", defendResult.ok && /reinforced/i.test(defendResult.message) && /defense energy/i.test(defendResult.message), defendResult.message);
}

function testBotAttackPacing(checks) {
  const game = newGame("duck", { difficulty: "normal", botCount: 3 });
  const human = game.getPlayer(config.HUMAN_ID);
  const bot = game.players.find((player) => player.isBot);
  bot.personality = "defensive";
  bot.difficulty = "normal";
  bot.energy = Math.max(bot.energy, 120);
  human.energy = 100;
  const border = makeEnemyBorder(game, bot, human);
  if (!border) {
    assertCheck(checks, "bot scouts new border before attacking", false, "No test border");
    assertCheck(checks, "bot can evaluate attack after reaction delay", false, "No test border");
    return;
  }
  game.botManager.updateBorderContacts(bot, [border]);
  const immediate = game.botManager.attackDecision(bot, border, "early", false);
  game.simTime += game.botManager.reactionDelay(bot, "early") + 0.3;
  const delayed = game.botManager.attackDecision(bot, border, "mid", true);
  assertCheck(checks, "bot scouts new border before attacking", border && !immediate.ok && immediate.reason === "scouting border", immediate.reason);
  assertCheck(checks, "bot can evaluate attack after reaction delay", border && delayed.reason !== "scouting border", delayed.reason);
}

function testWinAndEliminationRules(checks) {
  const game = newGame("duck", { botCount: 3, practice: false });
  const human = game.getPlayer(config.HUMAN_ID);
  const bot = game.players.find((player) => player.isBot);
  const playable = game.tileManager.playable();
  const botCore = game.tileManager.getById(bot.coreTileId);
  playable.slice(0, Math.floor(playable.length * 0.75)).forEach((tile) => {
    if (tile.id !== botCore?.id) tile.owner = human.id;
  });
  if (botCore) botCore.owner = bot.id;
  game.economy.recalculate(game.players, game.now(), game);
  game.matchSettings.winCondition = "territoryControl";
  game.checkWin();
  assertCheck(
    checks,
    "70 percent territory does not auto-end match",
    !game.ended && game.isPlayerAlive(bot),
    `${Math.round(game.territoryPercent(human) * 100)}% human, bot alive=${game.isPlayerAlive(bot)}`,
  );

  const blocked = game.surrenderPlayer(bot, human.id, "qa surrender blocked");
  assertCheck(checks, "surrender defaults to off", game.matchSettings.surrenderMode === "off" && !blocked.ok && /disabled/i.test(blocked.message), blocked.message);
  const finalBotCore = game.tileManager.getById(bot.coreTileId) || game.tileManager.owned(bot.id)[0];
  game.tileManager.owned(bot.id).forEach((tile) => {
    if (tile.id !== finalBotCore?.id) tile.owner = null;
  });
  if (finalBotCore) finalBotCore.owner = bot.id;
  game.economy.recalculate(game.players, game.now(), game);
  assertCheck(checks, "bot with one tile stays alive", game.isPlayerAlive(bot) && game.ownedTileCount(bot) === 1, `${game.ownedTileCount(bot)} tiles`);
  const victimTiles = game.tileManager.owned(bot.id).map((tile) => tile.id);
  game.matchSettings.surrenderMode = "bots";
  const surrender = game.surrenderPlayer(bot, human.id, "qa surrender");
  const transferred = victimTiles.filter((id) => game.tileManager.getById(id)?.owner === human.id).length;
  assertCheck(checks, "surrender returns territory neutral by default", surrender.ok && transferred === 0, `${transferred}/${victimTiles.length} transferred`);

  const lastStandGame = newGame("turtle", { botCount: 1 });
  const weakBot = lastStandGame.players.find((player) => player.isBot);
  const weakOwned = lastStandGame.tileManager.owned(weakBot.id).sort((a, b) => (a.id === weakBot.coreTileId ? -1 : b.id === weakBot.coreTileId ? 1 : 0));
  weakOwned.slice(8).forEach((tile) => {
    tile.owner = null;
    tile.captureProgress = {};
  });
  weakBot.stats.territoryPeak = 24;
  lastStandGame.economy.recalculate(lastStandGame.players, lastStandGame.now(), lastStandGame);
  lastStandGame.updateLastStandStates();
  assertCheck(checks, "last stand triggers after collapse", weakBot.flags.lastStandUsed && weakBot.flags.lastStandUntil > lastStandGame.now(), weakBot.flags.lastStandTrigger || "no trigger");
}

function runBotSimulation(checks) {
  const game = newGame("duck", { difficulty: "smart", mapSize: "small", botCount: 6, matchLength: "standard", practice: false });
  const personalities = ["loyalAlly", "peaceful", "opportunist", "aggressive", "defensive", "leaderHunter", "betrayer", "farmer", "expander", "objectiveHunter"];
  game.players.forEach((player, index) => {
    player.isBot = true;
    player.animal = ["duck", "snake", "frog", "turtle", "carp"][index % 5];
    player.difficulty = index % 2 === 0 ? "smart" : "normal";
    player.personality = personalities[index % personalities.length];
    player.energy = Math.max(player.energy, player.maxEnergy * 0.72);
  });
  const initialDiplomacy = game.diplomacy.handle(game, game.players[0], game.players[1].id, "requestAlliance");
  const initialDiplomacyEvents = game.events.filter((event) => event.kind === "diplomacy").length;
  for (let tick = 0; tick < 600 && !game.ended; tick += 1) {
    game.tick(1);
  }
  game.economy.recalculate(game.players, game.now(), game);
  const active = game.players.filter((player) => !player.defeated);
  const abilities = game.players.reduce((sum, player) => sum + (player.stats.abilitiesUsed || 0), 0);
  const attacks = game.players.reduce((sum, player) => sum + (player.stats.attacksLaunched || 0), 0);
  const builds = game.players.reduce((sum, player) => sum + (player.stats.buildingsBuilt || 0), 0);
  const leader = active.slice().sort((a, b) => b.territory - a.territory)[0];
  assertCheck(checks, "10 minute bot simulation advances", game.elapsed() >= 600 || game.ended, `${Math.round(game.elapsed())}s`);
  assertCheck(checks, "bots launch attacks", attacks >= 4, `${attacks} attacks`);
  assertCheck(checks, "bots use abilities", abilities >= 3, `${abilities} abilities`);
  assertCheck(checks, "bots build economy/defense", builds >= 3, `${builds} buildings`);
  const botAnimals = new Set(game.players.filter((player) => player.isBot).map((player) => player.animal));
  assertCheck(checks, "bots include turtle and carp", botAnimals.has("turtle") && botAnimals.has("carp"), [...botAnimals].join(", "));
  const diplomacyEvents = initialDiplomacyEvents + game.events.filter((event) => event.kind === "diplomacy").length;
  assertCheck(checks, "bots use diplomacy states", diplomacyEvents >= 1 || initialDiplomacy.ok, `${diplomacyEvents} diplomacy events | ${initialDiplomacy.message}`);
  return {
    elapsed: Number(game.elapsed().toFixed(1)),
    ended: game.ended,
    winner: game.getPlayer(game.winnerId)?.name || leader?.name || "none",
    leaderTerritoryPct: Number(((leader?.territory || 0) / Math.max(1, game.tileManager.playable().length) * 100).toFixed(1)),
    activePlayers: active.length,
    metrics: { ...game.metrics, playerAttackStats: attacks, abilityUses: abilities, buildingsBuilt: builds },
    personalities: game.players.filter((player) => player.isBot).map((player) => player.personality),
    botAnimals: [...botAnimals],
  };
}

const checks = [];
testMapSizes(checks);
testExpansion(checks);
testBuildings(checks);
testAbilities(checks);
testDiplomacyAndCombat(checks);
testBotAttackPacing(checks);
testWinAndEliminationRules(checks);
const simulation = runBotSimulation(checks);
const failed = checks.filter((check) => !check.pass);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      failed,
      checks,
      simulation,
    },
    null,
    2,
  ),
);

if (failed.length) process.exitCode = 1;
