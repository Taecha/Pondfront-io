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
const ObjectiveManager = require("./server/ObjectiveManager");
const EventManager = require("./server/EventManager");
const ProgressionManager = require("./server/ProgressionManager");
const MissionManager = require("./server/MissionManager");
const objectives = require("./shared/objectives");
const lakeEvents = require("./shared/lakeEvents");
const diplomacyConfig = require("./shared/diplomacyConfig");
const combatConfig = require("./shared/combatConfig");

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
      objectives: 0,
      camps: 0,
    };
    this.wars = new Map();
    this.tileManager = new TileManager(Date.now() % 999999, this.matchSettings.map);
    this.tileManager.generate();
    this.objectives = new ObjectiveManager(this.tileManager, (event) => this.pushEvent(event));
    this.eventsManager = new EventManager((event) => this.pushEvent(event));
    this.progression = new ProgressionManager((event) => this.pushEvent(event));
    this.missions = new MissionManager((event) => this.pushEvent(event));
    this.objectives.setup(this.now());
    this.eventsManager.reset(this.now());
    this.economy = new EconomyManager(this.tileManager);
    this.diplomacy = new DiplomacyManager((event) => this.pushEvent(event));
    this.combat = new CombatManager(this.tileManager, (event) => this.pushEvent(event));
    this.players = this.createPlayers(animal, this.matchSettings.difficulty);
    this.progression.setup(this.players);
    this.missions.setup(this.players);
    this.diplomacy.attach(this.players);
    this.players.forEach((player, index) => this.tileManager.claimStart(player, index, this.now()));
    this.economy.recalculate(this.players, this.now(), this);
    this.botManager = new BotManager(this);
    this.logMatchStart();
    this.pushEvent({ kind: "notice", message: "Match started. Expand from your border.", at: this.now() });
  }

  sanitizeMatchSettings(settings = {}) {
    const difficulty = ["easy", "normal", "smart", "chaos"].includes(settings.difficulty) ? settings.difficulty : "normal";
    const mapSize = ["small", "medium", "large", "huge"].includes(settings.mapSize) ? settings.mapSize : "medium";
    const map = config.MAP_SIZES[mapSize] || config.MAP_SIZES.medium;
    const requestedBots = Number(settings.botCount || map.defaultBots || config.BOT_COUNT || 9);
    const botCount = Math.max(map.minBots, Math.min(map.maxBots, requestedBots));
    const matchLength = ["quick", "standard", "long"].includes(settings.matchLength) ? settings.matchLength : "standard";
    const lengthMultiplier = matchLength === "quick" ? 0.8 : matchLength === "long" ? 1.2 : 1;
    const matchSeconds =
      settings.practice && mapSize === "small" ? Math.round(map.matchSeconds * 0.75) : Math.round(map.matchSeconds * lengthMultiplier);
    return {
      difficulty,
      botCount,
      matchLength,
      matchSeconds,
      mapSize,
      map: { ...map, id: mapSize },
      playerName: this.cleanPlayerName(settings.playerName),
      practice: Boolean(settings.practice),
    };
  }

  logMatchStart() {
    const map = this.matchSettings.map;
    console.log(
      [
        `Map size selected: ${map.label}`,
        `Grid: ${this.tileManager.cols} x ${this.tileManager.rows}`,
        `Bot count: ${this.matchSettings.botCount}`,
        `Spawn points: ${this.tileManager.spawnPoints.length >= this.players.length ? "valid" : "short"} (${this.tileManager.spawnPoints.length})`,
      ].join(" | "),
    );
  }

  cleanPlayerName(value) {
    const safe = String(value || "Player")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 18);
    return safe || "Player";
  }

  createPlayers(humanAnimal, difficulty) {
    const personalities = ["aggressive", "defensive", "expander", "objectiveHunter", "leaderHunter", "betrayer", "farmer", "peaceful", "loyalAlly", "opportunist"];
    const safeHumanAnimal = animals[humanAnimal] ? humanAnimal : "duck";
    const human = this.makePlayer(config.HUMAN_ID, this.matchSettings.playerName || "Player", safeHumanAnimal, animals[safeHumanAnimal].color, false, "human");
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
      player.favoriteTerrain = animal === "snake" ? "reeds" : animal === "frog" || animal === "carp" ? "lily" : animal === "turtle" ? "mud" : "water";
      player.aggression =
        player.personality === "aggressive" || player.personality === "leaderHunter"
          ? 0.78
          : player.personality === "peacefulFarmer"
            ? 0.22
            : player.personality === "defensive"
              ? 0.35
              : 0.5;
      players.push(player);
    }
    return players;
  }

  mixedBotAnimals(count) {
    const species = ["duck", "snake", "frog", "turtle", "carp"];
    if (count <= species.length) return this.shuffled(species).slice(0, count);
    const base = species.slice();
    while (base.length < count) base.push(...this.shuffled(species));
    return this.shuffled(base.slice(0, count));
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
      xp: 0,
      level: 1,
      evolutionTitle: "Starter",
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
        abilitiesUsed: 0,
        objectivesCaptured: 0,
        campsCaptured: 0,
        bestAttackWave: 0,
        damageDealt: 0,
      },
    };
  }

  tick(dt) {
    if (this.simTime != null) this.simTime += dt;
    if (this.ended) return;
    this.combat.update(this, dt);
    this.diplomacy.update(this);
    this.objectives.update(this);
    this.eventsManager.update(this);
    this.economy.update(this.players, dt, this.now(), this);
    this.missions.update(this);
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
    if (body.type === "defend") return this.combat.defend(player, Number(body.tileId), percent, this.now());
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
    const allowed = new Set(Object.keys(diplomacyConfig.pingTypes));
    const tile = this.tileManager.getById(Number(body.tileId));
    const pingType = allowed.has(body.pingType) ? body.pingType : "warning";
    if (!tile) return { ok: false, message: "Select a valid tile first." };

    const target = body.targetId ? this.getPlayer(body.targetId) : tile.owner ? this.getPlayer(tile.owner) : null;
    const ping = diplomacyConfig.pingTypes[pingType] || diplomacyConfig.pingTypes.warning;
    if (ping.visibility === "allies" && target && !this.diplomacy.areAllied(player.id, target.id) && target.id !== player.id) {
      return { ok: false, message: "Private ally pings require an alliance." };
    }
    const visibility = ping.visibility === "public" ? "public" : target && player.allies.has(target.id) ? "allies" : player.allies.size ? "allies" : "self";
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
    return diplomacyConfig.pingTypes[type]?.label || "Signal";
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
      xp: Math.round(player.xp || 0),
      level: player.level || 1,
      evolutionTitle: player.evolutionTitle || "Starter",
      allies: [...player.allies],
      enemies: [...player.enemies],
      abilityReadyAt: player.abilityReadyAt,
      abilityActiveUntil: player.abilityActiveUntil,
      abilityStatus: this.combat.abilityStatus(player, this.now()),
      progression: this.progression.progress(player),
      attackCooldownUntil: player.attackCooldownUntil || 0,
      buildings: player.buildings,
      flags: player.flags,
      stats: player.stats,
    }));

    return {
      serverTime: this.now(),
      timeLeft: this.timeLeft(),
      regions: this.tileManager.regions,
      objectives: this.objectives.snapshot().objectives,
      camps: this.objectives.snapshot().camps,
      lakeEvent: this.eventsManager.snapshot(this.now()),
      missions: this.missions.snapshot(config.HUMAN_ID),
      wars: this.warSnapshot(),
      relationships: this.diplomacy.snapshot(config.HUMAN_ID, this.now()),
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
        objectiveId: tile.objectiveId || null,
        objectiveType: tile.objectiveType || null,
        campId: tile.campId || null,
        campType: tile.campType || null,
        specialActive: Boolean(tile.specialActive),
        lastChanged: tile.lastChanged,
      })),
      players,
      activeAttacks: this.combat.snapshot(),
      events: this.visibleEventsFor(config.HUMAN_ID).slice(-config.MAX_EVENTS),
      config: {
        tileTypes: config.TILE_TYPES,
        buildings: config.BUILDINGS,
        animals,
        objectives,
        lakeEvents,
        diplomacy: diplomacyConfig,
        combat: combatConfig,
        mapSizes: config.MAP_SIZES,
        balance,
        buildingCosts: this.playerBuildingCosts(this.getPlayer(config.HUMAN_ID)),
      },
    };
  }

  pushEvent(event) {
    const stamped = { id: this.eventId, ...event };
    this.eventId += 1;
    this.events.push(stamped);
    this.progression?.handleEvent(this, stamped);
    this.missions?.handleEvent(this, stamped);
    this.countMetric(stamped);
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
      objectives: Number((breakdown.objectives || 0).toFixed(1)),
      total: Number(Object.values(breakdown).reduce((sum, value) => sum + (Number(value) || 0), 0).toFixed(1)),
    };
  }

  recordWar(attackerId, defenderId, data = {}) {
    if (!attackerId || !defenderId || attackerId === defenderId) return;
    const key = [attackerId, defenderId].sort().join(":");
    const current =
      this.wars.get(key) || {
        id: key,
        players: [attackerId, defenderId],
        attacks: 0,
        tilesCaptured: 0,
        damage: 0,
        lastAt: 0,
        aggressorId: attackerId,
      };
    current.attacks += data.attack ? 1 : 0;
    current.tilesCaptured += data.tilesCaptured || 0;
    current.damage += data.damage || 0;
    current.lastAt = this.now();
    current.aggressorId = attackerId;
    this.wars.set(key, current);
    this.diplomacy?.recordAttack(attackerId, defenderId, data, this.now());
    const attacker = this.getPlayer(attackerId);
    const defender = this.getPlayer(defenderId);
    attacker?.enemies?.add(defenderId);
    defender?.enemies?.add(attackerId);
    if (defender) {
      defender.flags = defender.flags || {};
      defender.flags.lastAttackerId = attackerId;
      defender.flags.underAttackUntil = this.now() + 28;
    }
  }

  warSnapshot() {
    const now = this.now();
    return [...this.wars.values()]
      .filter((war) => now - war.lastAt < 220)
      .map((war) => ({
        ...war,
        atWar: now - war.lastAt < 90,
        peacePossible: now - war.lastAt > 45,
        damage: Math.round(war.damage),
      }));
  }

  visibleEventsFor(viewerId) {
    return this.events.filter((event) => {
      if (event.kind !== "ping" && event.kind !== "signal") return true;
      if (event.visibility === "public") return true;
      if (event.playerId === viewerId || event.targetId === viewerId) return true;
      if (event.visibility === "allies") return this.diplomacy?.areAllied(event.playerId, viewerId);
      return false;
    });
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
    if (event.kind === "objectiveCaptured") this.metrics.objectives += 1;
    if (event.kind === "campCaptured") this.metrics.camps += 1;
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
    game.objectives.update(game);
    game.economy.recalculate(game.players, game.now(), game);
    game.missions.update(game);
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
