const http = require("http");
const fs = require("fs");
const path = require("path");
const config = require("./shared/gameConfig");
const animals = require("./shared/animals");
const balance = config.BALANCE;
const TileManager = require("./server/TileManager");
const EconomyManager = require("./server/EconomyManager");
const CombatManager = require("./server/CombatManager");
const BotManager = require("./server/BotManager");
const DiplomacyManager = require("./server/DiplomacyManager");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 5173);

class PondFrontServerGame {
  constructor() {
    this.reset("duck", "normal");
  }

  reset(animal = "duck", difficulty = "normal", settings = {}) {
    this.simTime = null;
    this.startedAt = this.now();
    this.matchSettings = this.sanitizeMatchSettings({ difficulty, ...settings });
    this.matchSeconds = this.matchSettings.matchSeconds;
    this.ended = false;
    this.winnerId = null;
    this.events = [];
    this.eventId = 1;
    this.metrics = {
      attacks: 0,
      waveCaptures: 0,
      expansions: 0,
      builds: 0,
      defenses: 0,
      pings: 0,
    };
    this.tileManager = new TileManager(Date.now() % 999999);
    this.tileManager.generate();
    this.economy = new EconomyManager(this.tileManager);
    this.diplomacy = new DiplomacyManager((event) => this.pushEvent(event));
    this.combat = new CombatManager(this.tileManager, (event) => this.pushEvent(event));
    this.players = this.createPlayers(animal, this.matchSettings.difficulty);
    this.diplomacy.attach(this.players);
    this.players.forEach((player, index) => this.tileManager.claimStart(player, index, this.now()));
    this.economy.recalculate(this.players, this.now());
    this.botManager = new BotManager(this);
    this.pushEvent({ kind: "notice", message: "Match started. Expand from your border.", at: this.now() });
  }

  sanitizeMatchSettings(settings = {}) {
    const difficulty = ["easy", "normal", "smart", "chaos"].includes(settings.difficulty) ? settings.difficulty : "normal";
    const requestedBots = Number(settings.botCount || config.BOT_COUNT || 11);
    const botCount = Math.max(4, Math.min(16, requestedBots));
    const matchLength = ["quick", "standard", "long"].includes(settings.matchLength) ? settings.matchLength : "standard";
    const matchSeconds =
      matchLength === "quick" ? Math.round(config.MATCH_SECONDS * 0.66) : matchLength === "long" ? Math.round(config.MATCH_SECONDS * 1.35) : config.MATCH_SECONDS;
    return {
      difficulty,
      botCount,
      matchLength,
      matchSeconds,
      mapSize: ["small", "medium", "large", "huge"].includes(settings.mapSize) ? settings.mapSize : "large",
      playerName: this.cleanPlayerName(settings.playerName),
      practice: Boolean(settings.practice),
    };
  }

  cleanPlayerName(value) {
    const safe = String(value || "Player")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 18);
    return safe || "Player";
  }

  createPlayers(humanAnimal, difficulty) {
    const personalities = ["expander", "aggressive", "defensive", "opportunist", "betrayer"];
    const human = this.makePlayer(config.HUMAN_ID, this.matchSettings.playerName || "Player", humanAnimal, animals[humanAnimal].color, false, "human");
    const players = [human];
    const botCount = this.matchSettings.botCount || config.BOT_COUNT || 9;
    const botNames = this.shuffled(config.BOT_NAMES).filter((name) => name !== "You");
    const botAnimals = this.mixedBotAnimals(botCount);
    for (let i = 0; i < botCount; i += 1) {
      const animal = botAnimals[i];
      const name = botNames[i] || `Rainlake ${i + 1}`;
      const color = config.PLAYER_COLORS[(i + 1) % config.PLAYER_COLORS.length];
      const botDifficulty =
        difficulty === "chaos" ? "smart" : difficulty === "smart" || difficulty === "easy" ? difficulty : i % 4 === 0 ? "smart" : "normal";
      const player = this.makePlayer(`b${i}`, name, animal, color, true, botDifficulty);
      player.personality = difficulty === "chaos" ? personalities[(i + Math.floor(Math.random() * personalities.length)) % personalities.length] : personalities[i % personalities.length];
      players.push(player);
    }
    return players;
  }

  mixedBotAnimals(count) {
    const base = [];
    while (base.length < count) base.push("duck", "snake", "frog");
    return this.shuffled(base).slice(0, count);
  }

  shuffled(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  makePlayer(id, name, animal, color, isBot, difficulty) {
    return {
      id,
      name,
      animal,
      color,
      isBot,
      difficulty,
      energy: isBot ? 48 : 64,
      maxEnergy: 80,
      income: 1,
      territory: 0,
      defeated: false,
      allies: new Set(),
      enemies: new Set(),
      abilityReadyAt: 0,
      abilityActiveUntil: 0,
      attackCooldownUntil: 0,
      flags: {},
      coreTileId: null,
      personality: "human",
      buildings: {},
      stats: {
        tilesCaptured: 0,
        energyUsed: 0,
        playersDefeated: 0,
        attacksLaunched: 0,
        defenses: 0,
        buildingsBuilt: 0,
      },
    };
  }

  tick(dt) {
    if (this.simTime != null) this.simTime += dt;
    if (this.ended) return;
    this.combat.update(this, dt);
    this.economy.update(this.players, dt, this.now());
    this.botManager.update(dt);
    this.checkWin();
  }

  handleAction(body) {
    const player = this.getPlayer(config.HUMAN_ID);
    if (!player || player.defeated) return { ok: false, message: "You are out of the pond." };
    const percent = Math.max(0.01, Math.min(1, Number(body.percent) || 0.25));

    if (body.type === "expand" || body.type === "attack") {
      return this.combat.expandOrAttack(this, player, Number(body.tileId), percent, body.sourceIds || []);
    }
    if (body.type === "defend") return this.combat.defend(player, Number(body.tileId), percent);
    if (body.type === "build") {
      const tile = this.tileManager.getById(Number(body.tileId));
      const result = this.economy.build(player, tile, body.buildingType, this.now());
      if (result.ok) {
        this.pushEvent({
          kind: "buildComplete",
          playerId: player.id,
          to: tile.id,
          buildingType: body.buildingType,
          at: this.now(),
        });
      }
      return result;
    }
    if (body.type === "upgradeBuilding") {
      const tile = this.tileManager.getById(Number(body.tileId));
      const result = this.economy.upgradeBuilding(player, tile, this.now());
      if (result.ok) {
        this.pushEvent({
          kind: "buildUpgrade",
          playerId: player.id,
          to: tile.id,
          buildingType: tile.building,
          at: this.now(),
        });
      }
      return result;
    }
    if (body.type === "removeBuilding") {
      const tile = this.tileManager.getById(Number(body.tileId));
      const buildingType = tile?.building;
      const result = this.economy.removeBuilding(player, tile, this.now());
      if (result.ok) {
        this.pushEvent({
          kind: "buildRemove",
          playerId: player.id,
          to: tile.id,
          buildingType,
          at: this.now(),
        });
      }
      return result;
    }
    if (body.type === "ability") {
      return this.combat.activateAbility(this, player, {
        targetTileId: body.tileId,
      });
    }
    if (body.type === "diplomacy") return this.diplomacy.handle(this, player, body.targetId, body.command);
    if (body.type === "ping") return this.handlePing(player, body);
    if (body.type === "restartTutorial") {
      this.pushEvent({ kind: "notice", message: "Tutorial restarted.", at: this.now() });
      return { ok: true, message: "Tutorial restarted." };
    }
    return { ok: false, message: "Unknown command." };
  }

  handlePing(player, body) {
    const allowed = new Set(["attack", "defend", "weak", "danger", "help", "peace", "good", "warning"]);
    const tile = this.tileManager.getById(Number(body.tileId));
    const pingType = allowed.has(body.pingType) ? body.pingType : "warning";
    if (!tile) return { ok: false, message: "Select a valid tile first." };

    const target = body.targetId ? this.getPlayer(body.targetId) : tile.owner ? this.getPlayer(tile.owner) : null;
    const visibility = target && player.allies.has(target.id) ? "allies" : pingType === "warning" || pingType === "peace" ? "public" : "self";
    this.pushEvent({
      kind: "ping",
      pingType,
      playerId: player.id,
      targetId: target?.id || null,
      to: tile.id,
      visibility,
      at: this.now(),
    });
    return { ok: true, message: `${this.pingLabel(pingType)} signal sent.` };
  }

  pingLabel(type) {
    return {
      attack: "Attack Here",
      defend: "Defend Here",
      weak: "Enemy Weak",
      danger: "Danger",
      help: "Help",
      peace: "Peace",
      good: "Good Job",
      warning: "Warning",
    }[type] || "Signal";
  }

  checkWin() {
    const active = this.players.filter((player) => !player.defeated);
    const winner = active.find((player) => this.territoryPercent(player) >= config.WIN_CONTROL);
    if (winner) {
      this.end(winner.id);
      return;
    }
    if (this.timeLeft() <= 0) {
      const leader = active.slice().sort((a, b) => b.territory - a.territory)[0];
      this.end(leader?.id || null);
    }
  }

  end(winnerId) {
    this.ended = true;
    this.winnerId = winnerId;
    const winner = this.getPlayer(winnerId);
    this.pushEvent({
      kind: "ended",
      winnerId,
      message: winner ? `${winner.name} controls the pond.` : "The match ended.",
      at: this.now(),
    });
  }

  snapshot() {
    const playable = this.tileManager.playable().length;
    const players = this.players.map((player) => ({
      id: player.id,
      name: player.name,
      animal: player.animal,
      personality: player.personality,
      color: player.color,
      energy: Math.round(player.energy),
      maxEnergy: Math.round(player.maxEnergy),
      income: Number(player.income.toFixed(1)),
      incomeBreakdown: this.roundIncomeBreakdown(player.incomeBreakdown),
      coreTileId: player.coreTileId,
      territory: player.territory,
      territoryPct: playable ? player.territory / playable : 0,
      defeated: player.defeated,
      isBot: player.isBot,
      allies: [...player.allies],
      enemies: [...player.enemies],
      abilityReadyAt: player.abilityReadyAt,
      abilityActiveUntil: player.abilityActiveUntil,
      abilityStatus: this.combat.abilityStatus(player, this.now()),
      attackCooldownUntil: player.attackCooldownUntil || 0,
      buildings: player.buildings,
      flags: player.flags,
      stats: player.stats,
    }));

    return {
      serverTime: this.now(),
      timeLeft: this.timeLeft(),
      regions: this.tileManager.regions,
      matchSettings: this.matchSettings,
      ended: this.ended,
      winnerId: this.winnerId,
      winControl: config.WIN_CONTROL,
      cols: this.tileManager.cols,
      rows: this.tileManager.rows,
      humanId: config.HUMAN_ID,
      playable,
      tiles: this.tileManager.tiles.map((tile) => ({
        id: tile.id,
        x: tile.x,
        y: tile.y,
        type: tile.type,
        owner: tile.owner,
        building: tile.building,
        buildingLevel: tile.buildingLevel || 0,
        buildingActiveAt: tile.buildingActiveAt || 0,
        captureProgress: this.roundCaptureProgress(tile.captureProgress),
        defenseEnergy: Math.round(tile.defenseEnergy),
        lastChanged: tile.lastChanged,
      })),
      players,
      activeAttacks: this.combat.snapshot(),
      events: this.events.slice(-config.MAX_EVENTS),
      config: {
        tileTypes: config.TILE_TYPES,
        buildings: config.BUILDINGS,
        animals,
        balance,
        buildingCosts: this.playerBuildingCosts(this.getPlayer(config.HUMAN_ID)),
      },
    };
  }

  pushEvent(event) {
    this.events.push({ id: this.eventId, ...event });
    this.countMetric(event);
    this.eventId += 1;
    if (this.events.length > config.MAX_EVENTS) this.events.splice(0, this.events.length - config.MAX_EVENTS);
  }

  getPlayer(id) {
    return this.players.find((player) => player.id === id) || null;
  }

  territoryPercent(player) {
    const playable = this.tileManager.playable().length;
    return playable ? player.territory / playable : 0;
  }

  roundIncomeBreakdown(breakdown = {}) {
    return {
      base: Number((breakdown.base || 0).toFixed(1)),
      territory: Number((breakdown.territory || 0).toFixed(1)),
      terrain: Number((breakdown.terrain || 0).toFixed(1)),
      buildings: Number((breakdown.buildings || 0).toFixed(1)),
      animal: Number((breakdown.animal || 0).toFixed(1)),
      recovery: Number((breakdown.recovery || 0).toFixed(1)),
      temporary: Number((breakdown.temporary || 0).toFixed(1)),
      total: Number(Object.values(breakdown).reduce((sum, value) => sum + (Number(value) || 0), 0).toFixed(1)),
    };
  }

  roundCaptureProgress(progress = {}) {
    const entries = Object.entries(progress || {}).filter(([, value]) => Number(value) > 0);
    return Object.fromEntries(entries.map(([id, value]) => [id, Number(Number(value).toFixed(1))]));
  }

  now() {
    return this.simTime != null ? this.simTime : Date.now() / 1000;
  }

  timeLeft() {
    return Math.max(0, (this.matchSeconds || config.MATCH_SECONDS) - (this.now() - this.startedAt));
  }

  elapsed() {
    return Math.max(0, this.now() - this.startedAt);
  }

  playerBuildingCosts(player) {
    if (!player) return {};
    return Object.fromEntries(Object.keys(config.BUILDINGS).map((buildingType) => [buildingType, this.economy.buildingCost(player, buildingType)]));
  }

  countMetric(event) {
    if (!this.metrics) return;
    if (event.kind === "attackWave") this.metrics.attacks += 1;
    if (event.kind === "waveCapture") this.metrics.waveCaptures += 1;
    if (event.kind === "expand") this.metrics.expansions += 1;
    if (event.kind === "buildComplete") this.metrics.builds += 1;
    if (event.kind === "defend") this.metrics.defenses += 1;
    if (event.kind === "ping") this.metrics.pings += 1;
  }
}

const game = new PondFrontServerGame();

function sendJson(res, status, data) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".html"
        ? "text/html"
        : ext === ".css"
          ? "text/css"
          : ext === ".js"
            ? "application/javascript"
            : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      name: "PondFront.io",
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start") {
    const body = await readJson(req);
    game.reset(body.animal || "duck", body.difficulty || "normal", {
      playerName: body.playerName,
      botCount: body.botCount,
      mapSize: body.mapSize,
      matchLength: body.matchLength,
      practice: body.practice,
    });
    sendJson(res, 200, game.snapshot());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, game.snapshot());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/action") {
    const body = await readJson(req);
    const result = game.handleAction(body);
    game.economy.recalculate(game.players, game.now());
    if (result.message) game.pushEvent({ kind: "notice", message: result.message, ok: result.ok, at: game.now() });
    sendJson(res, result.ok ? 200 : 400, { ...result, state: game.snapshot() });
    return;
  }

  let filePath;
  const publicRoot = path.resolve(PUBLIC);
  const sharedRoot = path.resolve(ROOT, "shared");
  const requestPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (url.pathname === "/" || url.pathname === "/index.html") filePath = path.join(PUBLIC, "index.html");
  else if (url.pathname.startsWith("/shared/")) filePath = path.join(ROOT, requestPath);
  else filePath = path.join(PUBLIC, requestPath);

  filePath = path.resolve(filePath);
  const inPublic = filePath === publicRoot || filePath.startsWith(`${publicRoot}${path.sep}`);
  const inShared = filePath === sharedRoot || filePath.startsWith(`${sharedRoot}${path.sep}`);
  if (!inPublic && !inShared) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  serveFile(res, filePath);
});

if (require.main === module) {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(1, (now - lastTick) / 1000);
    lastTick = now;
    game.tick(dt);
  }, config.TICK_RATE_MS);

  server.listen(PORT, () => {
    console.log(`PondFront.io server running at http://localhost:${PORT}/`);
  });
}

module.exports = { PondFrontServerGame, game, server };
