const originalLog = console.log;
const fs = require("fs");
const path = require("path");
console.log = () => {};
const { PondFrontServerGame } = require("../server");
const config = require("../shared/gameConfig");
console.log = originalLog;

const game = new PondFrontServerGame({ skipInitialReset: true });
console.log = () => {};
game.reset("duck", "normal", {
  mapSize: "amazon",
  botCount: 20,
  practice: true,
  privateMatch: true,
  matchLength: "long",
  skipSpawnSelection: true,
});
const originalCheckWin = game.checkWin.bind(game);
game.checkWin = () => {};
const startMemory = process.memoryUsage().heapUsed;
const samples = [];
const simulatedSeconds = 20 * 60;
const dt = 0.25;

for (let elapsed = 0; elapsed < simulatedSeconds; elapsed += dt) {
  const started = performance.now();
  game.simTime = (game.simTime || game.startedAt) + dt;
  game.tick(dt);
  samples.push(performance.now() - started);
}

game.checkWin = originalCheckWin;
console.log = originalLog;
const endMemory = process.memoryUsage().heapUsed;
const sorted = samples.slice().sort((a, b) => a - b);
const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
const result = {
  ok: true,
  simulatedSeconds,
  ticks: samples.length,
  map: "amazon",
  bots: game.players.filter((player) => player.isBot).length,
  avgTickMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(3)),
  p95TickMs: Number(percentile(0.95).toFixed(3)),
  p99TickMs: Number(percentile(0.99).toFixed(3)),
  maxTickMs: Number(Math.max(...samples).toFixed(3)),
  heapGrowthMb: Number(((endMemory - startMemory) / 1024 / 1024).toFixed(2)),
  retainedEvents: game.events.length,
  eventCap: config.MAX_EVENTS,
  metrics: game.metrics,
};
result.ok = result.avgTickMs < 12 && result.p99TickMs < 40 && result.retainedEvents <= config.MAX_EVENTS && result.heapGrowthMb < 96;
fs.writeFileSync(path.join(__dirname, "..", "performance-release-results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
