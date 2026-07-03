const { PondFrontServerGame } = require("../server");
const config = require("../shared/gameConfig");

function runMatch(index, difficulty = "smart") {
  const animals = ["duck", "snake", "frog", "turtle", "carp"];
  const game = new PondFrontServerGame();
  game.reset(animals[index % animals.length], difficulty);
  game.simTime = 0;
  game.startedAt = 0;
  game.players.forEach((player, playerIndex) => {
    player.isBot = true;
    player.difficulty = playerIndex % 3 === 0 ? "smart" : difficulty;
  });

  const dt = 1;
  const maxTicks = Math.ceil((Number(process.env.PONDFRONT_SIM_SECONDS) || config.MATCH_SECONDS * 3) / dt);
  for (let tick = 0; tick < maxTicks && !game.ended; tick += 1) {
    game.tick(dt);
  }

  game.economy.recalculate(game.players, game.now(), game);
  const active = game.players.filter((player) => !player.defeated);
  const winner = game.getPlayer(game.winnerId) || active.slice().sort((a, b) => b.territory - a.territory)[0];
  const farms = game.tileManager.tiles.filter((tile) => tile.building === "lilyFarm").length;
  const avgIncome = active.reduce((sum, player) => sum + player.income, 0) / Math.max(1, active.length);
  const avgAttacks = active.reduce((sum, player) => sum + (player.stats.attacksLaunched || 0), 0) / Math.max(1, active.length);

  return {
    match: index + 1,
    duration: Number(game.elapsed().toFixed(1)),
    winner: winner?.name || "None",
    winnerTerritoryPct: Number((game.territoryPercent(winner || {}) * 100).toFixed(1)),
    attacks: game.metrics.attacks,
    waveCaptures: game.metrics.waveCaptures,
    builds: game.metrics.builds,
    farms,
    avgIncome: Number(avgIncome.toFixed(2)),
    avgAttacks: Number(avgAttacks.toFixed(2)),
  };
}

function summarize(rows) {
  const avg = (key) => Number((rows.reduce((sum, row) => sum + row[key], 0) / Math.max(1, rows.length)).toFixed(2));
  return {
    matches: rows.length,
    averageDuration: avg("duration"),
    averageWinnerTerritoryPct: avg("winnerTerritoryPct"),
    averageAttacks: avg("attacks"),
    averageWaveCaptures: avg("waveCaptures"),
    averageBuilds: avg("builds"),
    averageFarms: avg("farms"),
    averageIncome: avg("avgIncome"),
  };
}

const count = Number(process.argv[2] || 10);
const rows = Array.from({ length: count }, (_, index) => runMatch(index));
console.log(JSON.stringify({ summary: summarize(rows), matches: rows }, null, 2));
