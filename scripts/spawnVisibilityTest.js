const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
console.log = originalLog;

const checks = [];

function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function gameWith(settings = {}) {
  const log = console.log;
  console.log = () => {};
  try {
    const game = new PondFrontServerGame({ skipInitialReset: true });
    game.reset("duck", settings.difficulty || "easy", {
      mapSize: "small",
      botCount: 0,
      allowBots: false,
      privateMatch: true,
      spawnSelectionSeconds: 20,
      startEarlyWhenReady: false,
      humanPlayers: [
        { id: "h1", name: "Golden Beak", animal: "duck", connected: true, isHost: true },
        { id: "h2", name: "Amazon Fang", animal: "snake", connected: true },
      ],
      ...settings,
    });
    game.simTime = game.preparedAt;
    return game;
  } finally {
    console.log = log;
  }
}

function candidateFor(game, player) {
  return game.spawnManager.candidates.find((candidate) => game.spawnManager.validate(player.id, candidate.tileId).ok);
}

function activate(game) {
  game.players.filter((player) => !player.isBot && !player.removed).forEach((player) => {
    const candidate = candidateFor(game, player);
    game.spawnManager.reserveSpawn(player.id, candidate.tileId);
    game.spawnManager.confirmSpawn(player.id);
  });
  if (game.phase === "SPAWN_SELECTION") game.spawnManager.beginCountdown("QA countdown");
  game.simTime += 5.2;
  game.tick(0.05);
  return game;
}

const visible = gameWith({ enemySpawnVisibility: "visible" });
const first = visible.getPlayer("h1");
const second = visible.getPlayer("h2");
const firstCandidate = candidateFor(visible, first);
const reserve = visible.spawnManager.reserveSpawn(first.id, firstCandidate.tileId);
const visibleSnapshot = visible.spawnManager.snapshot(second.id, true);
const visibleMarker = visibleSnapshot.reservations.find((entry) => entry.playerId === first.id);
check("reservation advances authoritative version", reserve.ok && visibleSnapshot.version > 0, `v${visibleSnapshot.version}`);
check(
  "visible mode exposes labeled claimed radius",
  visibleMarker?.playerName === first.name && visibleMarker?.animal === first.animal && visibleMarker?.reservationRadius >= 2 && visibleMarker?.minimumDistanceRadius >= 4,
  visibleMarker?.playerName || "missing",
);
check("claimed candidate is removed from availability", visibleSnapshot.unavailableCandidateIds.includes(firstCandidate.tileId));

const conflict = visible.spawnManager.reserveSpawn(second.id, firstCandidate.tileId);
check(
  "visible conflict names the owner",
  !conflict.ok && conflict.conflictingPlayerId === first.id && conflict.message.includes(first.name),
  conflict.message,
);

const oldTileId = visible.spawnManager.reservations.get(first.id).tileId;
const versionBeforeChange = visible.spawnManager.version;
const changedCandidate = visible.spawnManager.candidates.find(
  (candidate) => candidate.tileId !== oldTileId && visible.spawnManager.validate(first.id, candidate.tileId).ok,
);
visible.spawnManager.reserveSpawn(first.id, changedCandidate.tileId);
const markersAfterChange = visible.spawnManager.snapshot(second.id).reservations.filter((entry) => entry.playerId === first.id);
check(
  "change emits release and reserve versions without duplicate marker",
  visible.spawnManager.version === versionBeforeChange + 2 && markersAfterChange.length === 1 && markersAfterChange[0].tileId === changedCandidate.tileId,
  `${markersAfterChange.length} marker at v${visible.spawnManager.version}`,
);
visible.spawnManager.confirmSpawn(first.id);
const status = visible.spawnManager.snapshot(first.id).statusRows.find((row) => row.playerId === first.id);
check("spawn status reports confirmation", status?.status === "Confirmed", status?.status || "missing");

const teamOnly = gameWith({ enemySpawnVisibility: "teamOnly" });
const teamOwner = teamOnly.getPlayer("h1");
const teamViewer = teamOnly.getPlayer("h2");
const teamCandidate = candidateFor(teamOnly, teamOwner);
teamOnly.spawnManager.reserveSpawn(teamOwner.id, teamCandidate.tileId);
const anonymousTeamMarker = teamOnly.spawnManager.snapshot(teamViewer.id).reservations[0];
check(
  "team-only mode keeps enemy zone but hides identity",
  anonymousTeamMarker?.anonymous && anonymousTeamMarker.tileId === teamCandidate.tileId && anonymousTeamMarker.playerId == null && anonymousTeamMarker.animal == null,
  anonymousTeamMarker?.playerName || "missing",
);

const hidden = gameWith({ enemySpawnVisibility: "hidden" });
const hiddenOwner = hidden.getPlayer("h1");
const hiddenViewer = hidden.getPlayer("h2");
const hiddenCandidate = candidateFor(hidden, hiddenOwner);
hidden.spawnManager.reserveSpawn(hiddenOwner.id, hiddenCandidate.tileId);
const hiddenSnapshot = hidden.spawnManager.snapshot(hiddenViewer.id, true);
const hiddenMarker = hiddenSnapshot.reservations[0];
check(
  "hidden mode returns a masked unavailable zone",
  hiddenMarker?.masked && hiddenMarker.tileId == null && hiddenMarker.playerId == null && hiddenMarker.animal == null && hiddenSnapshot.unavailableCandidateIds.includes(hiddenCandidate.tileId),
  hiddenMarker?.maskedId || "missing",
);
const hiddenConflict = hidden.spawnManager.reserveSpawn(hiddenViewer.id, hiddenCandidate.tileId);
check(
  "hidden rejection does not leak owner",
  !hiddenConflict.ok && hiddenConflict.conflictingPlayerId == null && !hiddenConflict.message.includes(hiddenOwner.name),
  hiddenConflict.message,
);
const hiddenEvents = hidden.visibleEventsFor(hiddenViewer.id).filter((event) => String(event.kind).startsWith("spawn"));
check(
  "hidden network events do not leak exact tile or owner",
  hiddenEvents.every((event) => event.kind === "spawnSync" || event.playerId === hiddenViewer.id),
  `${hiddenEvents.length} sanitized events`,
);

const reconnectTile = hidden.spawnManager.reservations.get(hiddenOwner.id).tileId;
hiddenOwner.connected = false;
hiddenOwner.connected = true;
check(
  "reconnect restores one reservation",
  hidden.spawnManager.reservations.size === 1 && hidden.spawnManager.reservations.get(hiddenOwner.id).tileId === reconnectTile,
);

const fallback = gameWith({ spawnSelectionSeconds: 10 });
fallback.simTime += 10.1;
fallback.tick(0.05);
check(
  "timer confirms valid fallback locations",
  fallback.phase === "COUNTDOWN" && [...fallback.spawnManager.reservations.values()].every((entry) => entry.confirmed),
  fallback.phase,
);

const bots = gameWith({
  mapSize: "amazon",
  botCount: 20,
  allowBots: true,
  humanPlayers: [{ id: "h1", name: "Golden Beak", animal: "duck", connected: true, isHost: true }],
  enemySpawnVisibility: "visible",
});
const botPlayers = bots.players.filter((player) => player.isBot && !player.removed);
const botMarkers = bots.spawnManager.snapshot("h1").reservations.filter((entry) => entry.isBot);
check(
  "Amazon 20-bot markers are confirmed and unique",
  botMarkers.length === 20 && botMarkers.every((entry) => entry.confirmed) && new Set(botMarkers.map((entry) => entry.tileId)).size === 20,
  `${botMarkers.length} markers`,
);

const together = gameWith({
  gameMode: "coop",
  teamSpawnStyle: "together",
  botCount: 6,
  allowBots: true,
  coopTeammates: 2,
  humanPlayers: [{ id: "h1", name: "Golden Beak", animal: "duck", connected: true, isHost: true }],
});
const togetherHuman = together.getPlayer("h1");
together.spawnManager.randomSpawn(togetherHuman.id);
const teamTiles = together.players
  .filter((player) => player.teamId === togetherHuman.teamId)
  .map((player) => together.tileManager.getById(together.spawnManager.reservations.get(player.id)?.tileId))
  .filter(Boolean);
const separated = teamTiles.every((tile, index) =>
  teamTiles.slice(index + 1).every((other) => Math.hypot(tile.x - other.x, tile.y - other.y) >= 4),
);
check("Co-op Together markers are nearby but non-overlapping", separated && teamTiles.length >= 2, `${teamTiles.length} teammates`);

const classicMatch = activate(
  gameWith({
    botCount: 2,
    allowBots: true,
    humanPlayers: [{ id: "h1", name: "Golden Beak", animal: "duck", connected: true, isHost: true }],
  }),
);
classicMatch.players.filter((player) => player.isBot).forEach((bot) => {
  classicMatch.tileManager.owned(bot.id).forEach((tile) => {
    tile.owner = null;
  });
  bot.defeated = true;
});
classicMatch.checkWin();
check("Classic full win path ends for the last living animal", classicMatch.ended && classicMatch.winnerId === "h1", classicMatch.winnerId || "no winner");

const coopMatch = activate(
  gameWith({
    gameMode: "coop",
    teamSpawnStyle: "together",
    botCount: 6,
    allowBots: true,
    coopTeammates: 2,
    humanPlayers: [{ id: "h1", name: "Golden Beak", animal: "duck", connected: true, isHost: true }],
  }),
);
const coopHuman = coopMatch.getPlayer("h1");
coopMatch.players.filter((player) => player.teamId !== coopHuman.teamId).forEach((enemy) => {
  coopMatch.tileManager.owned(enemy.id).forEach((tile) => {
    tile.owner = null;
  });
  enemy.defeated = true;
});
coopMatch.checkWin();
check(
  "Co-op full win path waits for and defeats the enemy team",
  coopMatch.ended && coopMatch.winnerTeamId === coopHuman.teamId,
  coopMatch.winnerTeamId || "no team winner",
);

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
