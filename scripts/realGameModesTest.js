const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
const gameModeConfig = require("../shared/gameModeConfig");
console.log = originalLog;

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function makeGame(ruleMode, settings = {}) {
  const log = console.log;
  console.log = () => {};
  try {
    const game = new PondFrontServerGame({ skipInitialReset: true });
    game.reset("duck", "easy", {
      ruleMode,
      mapSize: "small",
      botCount: 4,
      privateMatch: true,
      skipSpawnSelection: true,
      matchLength: "quick",
      ...settings,
    });
    game.simTime = game.startedAt;
    return game;
  } finally {
    console.log = log;
  }
}

function human(game) {
  return game.players.find((player) => !player.isBot);
}

function removePlayerTerritory(game, player, keepCore = false) {
  game.tileManager.owned(player.id).forEach((tile) => {
    if (keepCore && tile.id === player.coreTileId) return;
    tile.owner = null;
  });
}

const classic = makeGame("classic", { botCount: 2 });
check("Classic has authoritative elimination rules", classic.modeRules.winConditionType === "lastStanding" && classic.modeRules.noTerritoryEliminates);
check("Classic HUD state has no score or waves", classic.gameModeManager.snapshot().scoreTarget == null && classic.gameModeManager.snapshot().waveTarget == null);
classic.players.filter((player) => player.isBot).forEach((bot) => {
  removePlayerTerritory(classic, bot);
  bot.defeated = true;
});
classic.checkWin();
check("Classic ends with last animal", classic.ended && classic.endReason === "lastAnimalRemaining", classic.endReason);

const golden = makeGame("goldenLily", { botCount: 2 });
const lilies = golden.objectives.objectives;
check("Golden Lily creates 3-7 control zones", lilies.length >= 3 && lilies.length <= 7 && lilies.every((objective) => objective.type === "goldenLily"), `${lilies.length} zones`);
golden.players.filter((player) => player.isBot).forEach((bot) => {
  removePlayerTerritory(golden, bot);
  bot.defeated = true;
});
golden.checkWin();
check("Golden Lily ignores last-animal victory", !golden.ended);
const goldenHuman = human(golden);
lilies.forEach((objective) => {
  const tile = golden.tileManager.getById(objective.tileId);
  tile.owner = goldenHuman.id;
  tile.neighbors.forEach((neighbor) => {
    if (!neighbor.owner) neighbor.owner = goldenHuman.id;
  });
});
golden.gameModeManager.updateControlScores(200);
const goldenState = golden.gameModeManager.snapshot();
check("Golden Lily scores held zones", goldenState.currentScore > 0 && goldenState.controlledLilies === lilies.length, `${goldenState.currentScore} points`);
golden.gameModeManager.scores.set(goldenHuman.id, goldenState.scoreTarget);
golden.checkWin();
check("Golden Lily ends at score target", golden.ended && golden.endReason === "scoreTargetReached", golden.endReason);

const flood = makeGame("floodSurvival", { botCount: 6, gameMode: "solo" });
const floodHumans = flood.players.filter((player) => !player.isBot);
const floodBots = flood.players.filter((player) => player.isBot);
check("Flood forces co-op team mode", flood.matchSettings.teamMode === "coop" && flood.teamManager.active());
check("Flood groups all defenders and enemies", new Set(floodHumans.map((player) => player.teamId)).size === 1 && new Set(floodBots.map((player) => player.teamId)).size === 1 && floodHumans[0].teamId !== floodBots[0].teamId);
check("Flood bots do not act during preparation", floodBots.every((bot) => !flood.gameModeManager.canBotAct(bot)));
flood.simTime = flood.gameModeManager.flood.phaseEndsAt + 0.1;
flood.tick(0.1);
const floodState = flood.gameModeManager.snapshot();
check("Flood starts Wave 1 after preparation", floodState.wave === 1 && floodState.wavePhase === "active", `${floodState.wavePhase} ${floodState.wave}`);
check("Flood exposes wave HUD state", floodState.waveTarget === 8 && floodState.enemiesRemaining > 0 && floodState.sanctuary?.maxHealth === 300);
const sanctuary = flood.tileManager.getById(flood.gameModeManager.flood.sanctuaryTileId);
sanctuary.owner = floodBots[0].id;
flood.checkWin();
check("Flood loses when Sanctuary falls", flood.ended && flood.endReason === "sanctuaryLost", flood.endReason);

const floodWin = makeGame("floodSurvival", { botCount: 4 });
floodWin.gameModeManager.flood.wave = floodWin.gameModeManager.flood.totalWaves;
floodWin.gameModeManager.flood.completed = true;
floodWin.checkWin();
check("Flood wins after all waves", floodWin.ended && floodWin.endReason === "allWavesSurvived", floodWin.endReason);

const lastNest = makeGame("lastNest", { botCount: 2 });
const nestHuman = human(lastNest);
removePlayerTerritory(lastNest, nestHuman, true);
lastNest.checkWin();
check("Last Nest owner survives on Core tile", lastNest.isPlayerAlive(nestHuman) && !nestHuman.defeated && !lastNest.ended);
const nestState = lastNest.gameModeManager.snapshot();
check("Last Nest exposes health and protection HUD", nestState.nests.length >= 3 && nestState.nestProtectionRemaining > 0 && nestState.nests.find((nest) => nest.playerId === nestHuman.id)?.maxHealth === 220);
lastNest.players.filter((player) => player.isBot).forEach((bot) => {
  const core = lastNest.tileManager.getById(bot.coreTileId);
  core.owner = nestHuman.id;
  core.coreHealth = 0;
  bot.defeated = true;
});
lastNest.checkWin();
check("Last Nest ends only on final Nest", lastNest.ended && ["finalEnemyNestCaptured", "lastNestStanding"].includes(lastNest.endReason), lastNest.endReason);

for (const unavailable of ["riverDomination", "pondRush", "migration", "animalKing", "peacefulExpansion"]) {
  check(`${unavailable} is marked Coming Soon`, gameModeConfig.modes[unavailable].comingSoon && !gameModeConfig.modes[unavailable].implemented);
  check(`${unavailable} cannot silently fall back`, gameModeConfig.sanitize(unavailable, false) === null);
}

const switchedClassic = makeGame("classic", { botCount: 1 });
const switchedGolden = makeGame("goldenLily", { botCount: 1 });
check("Mode switching does not retain Classic state", switchedGolden.modeRules.id === "goldenLily" && switchedGolden.gameModeManager.scores.size === 0 && switchedGolden.objectives.objectives.length >= 3);
check("Every active mode has distinct objective text", new Set(["classic", "goldenLily", "floodSurvival", "lastNest"].map((id) => gameModeConfig.modes[id].primaryObjective)).size === 4);
check("Mode end messages are not generic", /Golden Lily points/.test(switchedGolden.gameModeManager.endMessage({ reason: "scoreTargetReached" }, human(switchedGolden), null)));
check("Classic state remains independent after switching", switchedClassic.modeRules.id === "classic" && switchedClassic.objectives.objectives.some((objective) => objective.type !== "goldenLily"));

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
