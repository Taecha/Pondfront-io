const pointerMath = require("../shared/pointerMath");

const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
console.log = originalLog;

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function pointerCase(name, { rect, dpr, camera, world, tileSize = 26, expected }) {
  const metrics = {
    rect,
    dpr,
    backingWidth: Math.round(rect.width * dpr),
    backingHeight: Math.round(rect.height * dpr),
  };
  const client = pointerMath.worldPointToClient(world.x, world.y, metrics, camera);
  const restored = pointerMath.screenPointToWorld(client.x, client.y, metrics, camera);
  const tile = pointerMath.tileCoordinates(restored.x, restored.y, tileSize);
  check(name, tile.x === expected.x && tile.y === expected.y && Math.abs(restored.x - world.x) < 0.01 && Math.abs(restored.y - world.y) < 0.01, `${tile.x},${tile.y}`);
}

const rects = [
  { left: 0, top: 0, width: 1280, height: 720 },
  { left: 143.5, top: 78.25, width: 903.4, height: 517.8 },
  { left: 0, top: 52, width: 390, height: 708 },
];
const zooms = [0.2, 1, 2.45];
const dprs = [1, 1.25, 2];
let pointerIndex = 0;
rects.forEach((rect) => {
  zooms.forEach((zoom) => {
    dprs.forEach((dpr) => {
      pointerIndex += 1;
      pointerCase(`pointer round trip ${pointerIndex}`, {
        rect,
        dpr,
        camera: { x: 940.5, y: 612.25, zoom },
        world: { x: 12 * 26 + 13, y: 8 * 26 + 13 },
        expected: { x: 12, y: 8 },
      });
    });
  });
});

const edgeMetrics = { rect: { left: 100, top: 70, width: 900, height: 540 }, backingWidth: 1800, backingHeight: 1080, dpr: 2 };
const edgeCamera = { x: 520, y: 390, zoom: 1.37 };
[
  { point: { x: 8 * 26 + 0.01, y: 6 * 26 + 0.01 }, expected: { x: 8, y: 6 }, label: "inside top edge stays in visible tile" },
  { point: { x: 8 * 26 + 13, y: 6 * 26 + 25.99 }, expected: { x: 8, y: 6 }, label: "inside bottom edge stays in visible tile" },
  { point: { x: 8 * 26 + 13, y: 7 * 26 + 0.01 }, expected: { x: 8, y: 7 }, label: "crossing boundary selects neighbor" },
].forEach((entry) => pointerCase(entry.label, { rect: edgeMetrics.rect, dpr: 2, camera: edgeCamera, world: entry.point, expected: entry.expected }));

function gameWith(mapSize, botCount, extra = {}) {
  const log = console.log;
  console.log = () => {};
  try {
    const game = new PondFrontServerGame({ skipInitialReset: true });
    game.reset("duck", "easy", {
      mapSize,
      botCount,
      allowBots: botCount > 0,
      privateMatch: true,
      spawnSelectionSeconds: 45,
      startEarlyWhenReady: false,
      humanPlayers: [{ id: "qa-human", name: "Pointer QA", animal: "duck", connected: true, isHost: true }],
      ...extra,
    });
    game.simTime = game.preparedAt;
    return game;
  } finally {
    console.log = log;
  }
}

[
  ["amazon", 20],
  ["mekong", 22],
  ["everglades", 20],
  ["nile", 20],
].forEach(([mapSize, botCount]) => {
  const game = gameWith(mapSize, botCount);
  const human = game.getPlayer("qa-human");
  const valid = game.tileManager.playable().filter((tile) => game.spawnManager.validate(human.id, tile.id).ok);
  check(`${mapSize} leaves several valid human spawn tiles with ${botCount} bots`, valid.length >= 12, `${valid.length} valid tiles`);
  check(`${mapSize} bots have unique reservations`, new Set([...game.spawnManager.reservations.values()].map((entry) => entry.tileId)).size === botCount, `${game.spawnManager.reservations.size} reservations`);
  const arbitrary = valid.find((tile) => !game.spawnManager.candidateById.has(tile.id));
  check(`${mapSize} accepts valid water outside sampled markers`, Boolean(arbitrary && game.spawnManager.validate(human.id, arbitrary.id).ok), arbitrary ? `tile ${arbitrary.id}` : "no arbitrary tile");
});

const snapGame = gameWith("medium", 8);
const snapHuman = snapGame.getPlayer("qa-human");
const snapOrigin = snapGame.tileManager.tiles.find(
  (tile) => !snapGame.spawnManager.validate(snapHuman.id, tile.id).ok && snapGame.spawnManager.findNearbyValidSpawn(snapHuman.id, tile.id, 3),
);
const snapped = snapOrigin ? snapGame.spawnManager.reserveSpawn(snapHuman.id, snapOrigin.id, { snapNearby: true }) : null;
check("nearby invalid click snaps only to local valid water", Boolean(snapped?.ok && snapped.adjusted && snapped.reservation.tileId !== snapOrigin.id), snapped?.message || "no snap case");

const findGame = gameWith("medium", 9);
const found = findGame.spawnManager.findAvailableSpawn("qa-human");
check("Find Available Spawn reserves a valid location", Boolean(found.ok && findGame.spawnManager.validate("qa-human", found.reservation.tileId).ok), found.message);

const together = gameWith("medium", 6, { gameMode: "coop", teamMode: "coop", coopTeammates: 2, teamSpawnStyle: "together" });
const togetherHuman = together.getPlayer("qa-human");
const togetherResult = together.spawnManager.findAvailableSpawn(togetherHuman.id);
check("Co-op Together retains an available non-overlapping human spawn", togetherResult.ok, togetherResult.message);

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
