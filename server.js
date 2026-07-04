const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./shared/gameConfig");
const animals = require("./shared/animals");
const balance = config.BALANCE;
const progressionConfig = require("./shared/progressionConfig");
const achievementConfig = require("./shared/achievementConfig");
const badgeConfig = require("./shared/badgeConfig");
const TileManager = require("./server/TileManager");
const EconomyManager = require("./server/EconomyManager");
const CombatManager = require("./server/CombatManager");
const BotManager = require("./server/BotManager");
const DiplomacyManager = require("./server/DiplomacyManager");
const TeamManager = require("./server/TeamManager");
const LobbyManager = require("./server/LobbyManager");
const SupportManager = require("./server/SupportManager");
const CoreManager = require("./server/CoreManager");
const SpecialManager = require("./server/SpecialManager");
const ObjectiveManager = require("./server/ObjectiveManager");
const EventManager = require("./server/EventManager");
const ProgressionManager = require("./server/ProgressionManager");
const MissionManager = require("./server/MissionManager");
const PondDatabase = require("./server/db");
const AuthManager = require("./server/AuthManager");
const AchievementManager = require("./server/AchievementManager");
const MatchHistoryManager = require("./server/MatchHistoryManager");
const ProfileManager = require("./server/ProfileManager");
const StatsManager = require("./server/StatsManager");
const SandboxManager = require("./server/SandboxManager");
const objectives = require("./shared/objectives");
const lakeEvents = require("./shared/lakeEvents");
const diplomacyConfig = require("./shared/diplomacyConfig");
const combatConfig = require("./shared/combatConfig");
const teamConfig = require("./shared/teamConfig");
const botDifficultyConfig = require("./shared/botDifficultyConfig");
const sandboxConfig = require("./shared/sandboxConfig");
const specialConfig = require("./shared/specialConfig");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 5173);

class PondFrontServerGame {
  constructor(options = {}) {
    this.accountServices = options.accountServices || null;
    if (!options.skipInitialReset) this.reset("duck", "normal");
  }

  reset(animal = "duck", difficulty = "normal", settings = {}) {
    this.simTime = null;
    this.matchId = settings.matchId || `match_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    this.accountRewardsRecorded = false;
    this.accountRewardsByPlayer = {};
    this.startedAt = this.now();
    this.matchSettings = this.sanitizeMatchSettings({ difficulty, ...settings });
    if (this.matchSettings.sandbox?.enabled) {
      this.simTime = this.startedAt;
      this.matchSettings.accountUser = this.matchSettings.accountUser || null;
    }
    this.matchSeconds = this.matchSettings.matchSeconds;
    this.ended = false;
    this.winnerId = null;
    this.winnerTeamId = null;
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
      specials: 0,
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
    this.teamManager = new TeamManager((event) => this.pushEvent(event));
    this.diplomacy = new DiplomacyManager((event) => this.pushEvent(event));
    this.combat = new CombatManager(this.tileManager, (event) => this.pushEvent(event));
    this.support = new SupportManager((event) => this.pushEvent(event));
    this.core = new CoreManager(this.tileManager, (event) => this.pushEvent(event));
    this.specials = new SpecialManager(this.tileManager, (event) => this.pushEvent(event));
    this.sandbox = this.matchSettings.sandbox?.enabled ? new SandboxManager(this, this.matchSettings.sandbox) : null;
    this.players = this.createPlayers(animal, this.matchSettings.difficulty);
    this.teamManager.setup(this.players, this.matchSettings);
    this.progression.setup(this.players);
    this.missions.setup(this.players);
    this.diplomacy.attach(this.players);
    this.players.forEach((player, index) => this.tileManager.claimStart(player, player.spawnIndex ?? index, this.now()));
    this.core.setup(this.players, this.now());
    this.economy.recalculate(this.players, this.now(), this);
    this.botManager = new BotManager(this);
    this.sandbox?.afterReset(this);
    this.logMatchStart();
    this.pushEvent({ kind: "notice", message: "Match started. Expand from your border.", at: this.now() });
  }

  sanitizeMatchSettings(settings = {}) {
    const sandboxEnabled = Boolean(settings.sandbox || settings.gameMode === "sandbox");
    const difficultyValue = String(settings.difficulty || settings.botDifficulty || "normal");
    const difficulty =
      sandboxEnabled && sandboxConfig.botDifficulties[difficultyValue === "hard" ? "smart" : difficultyValue]
        ? difficultyValue === "hard"
          ? "smart"
          : difficultyValue
        : ["easy", "normal", "smart", "chaos"].includes(difficultyValue)
          ? difficultyValue
          : "normal";
    const gameMode = sandboxEnabled ? "sandbox" : ["solo", "coop", "teamBattle"].includes(settings.gameMode) ? settings.gameMode : "solo";
    const mapSize = ["small", "medium", "large", "huge"].includes(settings.mapSize) ? settings.mapSize : "medium";
    const map = config.MAP_SIZES[mapSize] || config.MAP_SIZES.medium;
    const humanPlayers = Array.isArray(settings.humanPlayers)
      ? settings.humanPlayers
          .slice(0, 12)
          .map((player, index) => ({
            id: String(player.id || `${config.HUMAN_ID}-${index}`).slice(0, 32),
            socketId: player.socketId || null,
            name: this.cleanPlayerName(player.name || player.playerName || `Player ${index + 1}`),
            animal: animals[player.animal] ? player.animal : "duck",
            teamId: player.teamId || null,
            ready: Boolean(player.ready),
            isHost: Boolean(player.isHost),
            connected: player.connected !== false,
            color: player.color || config.PLAYER_COLORS[index % config.PLAYER_COLORS.length],
            spawnIndex: Number.isFinite(Number(player.spawnIndex)) ? Number(player.spawnIndex) : index,
            accountUserId: player.accountUserId || null,
            accountUsername: player.accountUsername || "",
            selectedBadge: player.selectedBadge || "rookie",
            selectedTitle: player.selectedTitle || progressionConfig.defaultTitle,
            selectedCosmetic: player.selectedCosmetic || progressionConfig.defaultCosmetic,
            accountLevel: Number(player.accountLevel || 0),
          }))
      : [];
    const humanCount = Math.max(1, humanPlayers.length || 1);
    const allowBots = settings.allowBots !== false;
    const coopTeammates = Math.max(0, Math.min(4, Number(settings.coopTeammates ?? 2)));
    const teamCount = Math.max(2, Math.min(4, Number(settings.teamCount || 2)));
    const botsPerTeam = Math.max(0, Math.min(6, Number(settings.botsPerTeam ?? 4)));
    const requestedBots = Number(settings.botCount ?? map.defaultBots ?? config.BOT_COUNT ?? 9);
    const teamBattleBots = Math.max(teamCount * botsPerTeam - humanCount, teamCount);
    const coopBots = Math.max(requestedBots, coopTeammates + Math.max(4, map.minBots));
    const modeBotCount = gameMode === "teamBattle" ? teamBattleBots : gameMode === "coop" ? coopBots : requestedBots;
    const botCap = sandboxEnabled ? Math.max(map.maxBots, 16) : gameMode === "teamBattle" ? Math.min(map.maxBots, teamCount * botsPerTeam + 2) : map.maxBots;
    const botCount = allowBots ? (sandboxEnabled ? Math.max(0, Math.min(botCap, modeBotCount)) : Math.max(map.minBots, Math.min(botCap, modeBotCount))) : 0;
    const matchLength = ["quick", "standard", "long"].includes(settings.matchLength) ? settings.matchLength : "standard";
    const lengthMultiplier = matchLength === "quick" ? 0.8 : matchLength === "long" ? 1.2 : 1;
    const matchSeconds =
      sandboxEnabled ? Math.max(map.matchSeconds, 7200) : settings.practice && mapSize === "small" ? Math.round(map.matchSeconds * 0.75) : Math.round(map.matchSeconds * lengthMultiplier);
    const sandboxRules = settings.sandboxRules || settings.rules || {};
    const requestedWinCondition = String(settings.winCondition || "");
    const winCondition = sandboxEnabled ? "sandbox" : requestedWinCondition === "territoryControl" ? "territoryControl" : "elimination";
    return {
      difficulty,
      botCount,
      allowBots,
      gameMode,
      humanPlayers,
      coopTeammates,
      teamBotDifficulty: ["normal", "smart", "aggressive"].includes(settings.teamBotDifficulty) ? settings.teamBotDifficulty : "normal",
      teamCount,
      botsPerTeam,
      matchLength,
      matchSeconds,
      winCondition,
      mapSize,
      map: { ...map, id: mapSize },
      playerName: this.cleanPlayerName(settings.playerName),
      accountUser: settings.accountUser || null,
      practice: Boolean(settings.practice),
      beginnerCombat: Boolean(settings.beginnerCombat || settings.practice || difficulty === "easy"),
      sandbox: sandboxEnabled
        ? {
            enabled: true,
            rules: Object.fromEntries(
              Object.entries(sandboxConfig.defaultRules).map(([key, fallback]) => [key, typeof sandboxRules[key] === "boolean" ? sandboxRules[key] : fallback]),
            ),
            difficulty,
            botDifficulty: difficulty,
            botPersonality: settings.sandboxBotPersonality || sandboxConfig.botDifficulties[difficulty]?.personality || "fighter",
            speed: sandboxConfig.speeds.includes(Number(settings.sandboxSpeed)) ? Number(settings.sandboxSpeed) : 1,
            statsDisabled: true,
          }
        : { enabled: false },
    };
  }

  logMatchStart() {
    const map = this.matchSettings.map;
    console.log(
      [
        `Map size selected: ${map.label}`,
        `Grid: ${this.tileManager.cols} x ${this.tileManager.rows}`,
        `Bot count: ${this.matchSettings.botCount}`,
        `Mode: ${this.matchSettings.gameMode}`,
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
    const personalities = ["aggressive", "defensive", "expander", "objectiveHunter", "leaderHunter", "supporter", "betrayer", "farmer", "peaceful", "loyalAlly", "opportunist"];
    const lobbyHumans = this.matchSettings.humanPlayers || [];
    const players = lobbyHumans.length
      ? lobbyHumans.map((entry, index) => {
          const animal = animals[entry.animal] ? entry.animal : "duck";
          const player = this.makePlayer(entry.id, entry.name, animal, entry.color || config.PLAYER_COLORS[index % config.PLAYER_COLORS.length], false, "human");
          player.preferredTeamId = entry.teamId || null;
          player.socketId = entry.socketId || null;
          player.connected = entry.connected !== false;
          player.isHost = Boolean(entry.isHost);
          player.lobbyReady = Boolean(entry.ready);
          player.spawnIndex = Number.isFinite(Number(entry.spawnIndex)) ? Number(entry.spawnIndex) : index;
          this.applyAccountToPlayer(player, entry);
          return player;
        })
      : [
          this.makePlayer(
            config.HUMAN_ID,
            this.matchSettings.playerName || "Player",
            animals[humanAnimal] ? humanAnimal : "duck",
            animals[animals[humanAnimal] ? humanAnimal : "duck"].color,
            false,
            "human",
          ),
        ];
    if (!lobbyHumans.length && this.matchSettings.accountUser) this.applyAccountToPlayer(players[0], this.matchSettings.accountUser);
    const botCount = this.matchSettings.botCount ?? config.BOT_COUNT ?? 9;
    const botNames = this.shuffled(config.BOT_NAMES).filter((name) => name !== "You");
    const botAnimals = this.mixedBotAnimals(botCount);
    for (let i = 0; i < botCount; i += 1) {
      const animal = botAnimals[i];
      const name = botNames[i] || `Rainlake ${i + 1}`;
      const color = config.PLAYER_COLORS[(players.length + i) % config.PLAYER_COLORS.length];
      const botDifficulty = this.matchSettings.sandbox?.enabled
        ? sandboxConfig.botDifficulties[difficulty]?.serverDifficulty || difficulty
        : ["easy", "normal", "smart", "chaos"].includes(difficulty)
          ? difficulty
          : "normal";
      const player = this.makePlayer(`b${i}`, name, animal, color, true, botDifficulty);
      const sandboxPersonality = this.matchSettings.sandbox?.botPersonality;
      player.personality = this.matchSettings.sandbox?.enabled
        ? sandboxPersonality === "passive"
          ? "passive"
          : sandboxPersonality === "fighter" || sandboxPersonality === "chaos"
            ? "aggressive"
            : sandboxPersonality || "expander"
        : difficulty === "chaos"
          ? personalities[(i + Math.floor(Math.random() * personalities.length)) % personalities.length]
          : personalities[i % personalities.length];
      if (this.matchSettings.sandbox?.enabled) {
        player.flags.sandboxPersonality = sandboxPersonality || sandboxConfig.botDifficulties[difficulty]?.personality || "fighter";
      }
      player.favoriteTerrain = animal === "snake" ? "reeds" : animal === "frog" || animal === "carp" ? "lily" : animal === "turtle" ? "mud" : "water";
      player.aggression =
        player.personality === "aggressive" || player.personality === "leaderHunter"
          ? 0.78
          : player.personality === "passive"
            ? 0
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
      currentPushCooldownUntil: 0,
      specialCooldowns: {},
      flags: {},
      xp: 0,
      level: 1,
      evolutionTitle: "Starter",
      coreTileId: null,
      personality: "human",
      preferredTeamId: null,
      connected: true,
      isHost: false,
      socketId: null,
      accountUserId: null,
      accountUsername: "",
      profileBadge: "rookie",
      profileTitle: progressionConfig.defaultTitle,
      selectedCosmetic: progressionConfig.defaultCosmetic,
      accountLevel: 0,
      matchRewards: null,
      buildings: {},
      stats: {
        tilesCaptured: 0,
        energyUsed: 0,
        playersDefeated: 0,
        supportSent: 0,
        supportReceived: 0,
        surrenderedEnemies: 0,
        attacksLaunched: 0,
        defenses: 0,
        buildingsBuilt: 0,
        buildingUpgrades: 0,
        abilitiesUsed: 0,
        specialsUsed: 0,
        objectivesCaptured: 0,
        campsCaptured: 0,
        bestAttackWave: 0,
        damageDealt: 0,
        incomePeak: 0,
      },
    };
  }

  applyAccountToPlayer(player, account = {}) {
    if (!player || !account?.id && !account?.accountUserId) return player;
    player.accountUserId = account.id || account.accountUserId || null;
    player.accountUsername = account.username || account.accountUsername || player.name;
    player.name = this.cleanPlayerName(account.username || account.accountUsername || player.name);
    player.profileBadge = account.selectedBadge || account.profileBadge || "rookie";
    player.profileTitle = account.selectedTitle || account.profileTitle || progressionConfig.defaultTitle;
    player.selectedCosmetic = account.selectedCosmetic || progressionConfig.defaultCosmetic;
    player.accountLevel = Number(account.level || account.accountLevel || 1);
    return player;
  }

  tick(dt) {
    const effectiveDt = this.sandbox?.enabled ? this.sandbox.tickDelta(dt) : dt;
    if (this.simTime != null) this.simTime += effectiveDt;
    if (this.ended) return;
    if (effectiveDt <= 0) return;
    this.combat.update(this, effectiveDt);
    this.diplomacy.update(this);
    this.teamManager.update(this);
    this.objectives.update(this);
    this.eventsManager.update(this);
    this.specials?.update(this);
    this.core.update(this);
    this.economy.update(this.players, effectiveDt, this.now(), this);
    this.players.forEach((player) => {
      player.stats.incomePeak = Math.max(player.stats.incomePeak || 0, player.income || 0);
    });
    this.missions.update(this);
    this.botManager.update(effectiveDt);
    this.checkWin();
  }

  handleAction(body) {
    const actorId = body.playerId || config.HUMAN_ID;
    const player = this.getPlayer(actorId);
    if (!player || player.defeated) return { ok: false, message: "You are out of the pond." };
    if (player.isBot) return { ok: false, message: "Bots cannot be controlled by this client." };
    const percent = Math.max(0.01, Math.min(1, Number(body.percent) || 0.25));
    if (body.type === "sandbox") return this.sandbox?.handle(this, player, body) || { ok: false, message: "Sandbox tools only work in Sandbox Mode." };

    const sandboxCheck = this.sandbox?.beforeAction(this, player, body);
    if (sandboxCheck && !sandboxCheck.ok) return sandboxCheck;

    if (body.type === "expand" || body.type === "attack") {
      const result = this.combat.expandOrAttack(this, player, Number(body.tileId), percent, body.sourceIds || []);
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "defend") {
      const result = this.combat.defend(player, Number(body.tileId), percent, this.now());
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "build") {
      const tile = this.tileManager.getById(Number(body.tileId));
      const result = this.economy.build(player, tile, body.buildingType, this.now(), this);
      if (result.ok) {
        this.pushEvent({
          kind: "buildStarted",
          playerId: player.id,
          to: tile.id,
          buildingType: body.buildingType,
          finishesAt: result.buildingActiveAt,
          at: this.now(),
        });
      }
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "upgradeBuilding") {
      const tile = this.tileManager.getById(Number(body.tileId));
      const result = this.economy.upgradeBuilding(player, tile, this.now(), this);
      if (result.ok) {
        this.pushEvent({
          kind: "buildUpgradeStarted",
          playerId: player.id,
          to: tile.id,
          buildingType: tile.building,
          level: tile.buildingLevel || 1,
          finishesAt: result.buildingActiveAt,
          at: this.now(),
        });
      }
      this.sandbox?.afterAction(this, player, body, result);
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
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "ability") {
      const result = this.combat.activateAbility(this, player, {
        targetTileId: body.tileId,
      });
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "special") {
      const result = this.specials.activate(this, player, String(body.specialType || ""), Number(body.tileId), body);
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "startContinuousAttack") {
      const target = this.tileManager.getById(Number(body.tileId));
      const defender = target?.owner ? this.getPlayer(target.owner) : null;
      const result =
        target && defender && defender.id !== player.id
          ? this.combat.startWaveAttack(this, player, defender, target, percent, body.sourceIds || [])
          : { ok: false, message: "Choose an enemy border for a committed attack." };
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "stopContinuousAttack") return { ok: true, resultType: "legacyNoop", message: "Committed waves stop automatically when spent." };
    if (body.type === "support") return this.support.send(this, player, body.targetId, percent);
    if (body.type === "waterRoute") {
      const result = this.combat.startWaterRouteAttack(this, player, Number(body.tileId), percent, body.sourceIds || []);
      this.sandbox?.afterAction(this, player, body, result);
      return result;
    }
    if (body.type === "diplomacy") return this.diplomacy.handle(this, player, body.targetId, body.command);
    if (body.type === "teamCommand") return this.teamManager.handleCommand(this, player, body);
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
    const state = this.winCheckState();
    this.lastWinCheck = state.debug;
    if (!state.canEnd) return;

    if (this.teamManager?.active()) {
      if (this.matchSettings.winCondition === "territoryControl") {
        const leadingTeam = state.teamStats[0];
        if (leadingTeam?.territoryPct >= config.WIN_CONTROL) {
          const leadMember = state.alivePlayers
            .filter((player) => player.teamId === leadingTeam.id)
            .sort((a, b) => this.ownedTileCount(b) - this.ownedTileCount(a))[0];
          this.end(leadMember?.id || null, leadingTeam.id, "territoryControl", state);
        }
        return;
      }

      if (state.aliveTeams.length === 1) {
        const aliveTeamId = state.aliveTeams[0].id;
        const leadMember = this.players
          .filter((player) => player.teamId === aliveTeamId && this.isPlayerAlive(player))
          .sort((a, b) => this.ownedTileCount(b) - this.ownedTileCount(a))[0];
        this.end(leadMember?.id || null, aliveTeamId, "teamElimination", state);
      }
      return;
    }

    if (this.matchSettings.winCondition === "territoryControl") {
      const leader = state.alivePlayers.slice().sort((a, b) => this.ownedTileCount(b) - this.ownedTileCount(a))[0];
      if (leader && this.territoryPercent(leader) >= config.WIN_CONTROL) this.end(leader.id, null, "territoryControl", state);
      return;
    }

    if (state.alivePlayers.length <= 1) this.end(state.alivePlayers[0]?.id || null, null, "elimination", state);
  }

  winCheckState() {
    const alivePlayers = this.players.filter((player) => this.isPlayerAlive(player));
    const teamStats = this.teamManager?.active() ? this.teamManager.territoryStats(this.players, this.tileManager.playable().length) : [];
    const aliveTeams = this.teamManager?.active() ? teamStats.filter((team) => this.isTeamAlive(team.id)) : [];
    let canEnd = true;
    let reason = "Waiting for a valid win condition.";
    let blockedReason = "";

    if (this.sandbox?.enabled && this.sandbox.rules?.elimination === false) {
      canEnd = false;
      reason = "Sandbox Mode - match ending disabled.";
      blockedReason = reason;
    } else if (this.teamManager?.active()) {
      if (this.matchSettings.winCondition === "territoryControl") {
        const leadingTeam = teamStats[0];
        reason = leadingTeam?.territoryPct >= config.WIN_CONTROL ? "Territory control reached by a team." : "No team has reached territory control.";
      } else {
        reason = aliveTeams.length === 1 ? "One active team remains." : "More than one active team remains.";
      }
    } else if (this.matchSettings.winCondition === "territoryControl") {
      const leader = alivePlayers.slice().sort((a, b) => this.ownedTileCount(b) - this.ownedTileCount(a))[0];
      reason = leader && this.territoryPercent(leader) >= config.WIN_CONTROL ? "Territory control reached." : "No animal has reached territory control.";
    } else {
      reason = alivePlayers.length <= 1 ? "One active animal remains." : "More than one active animal remains.";
    }

    const aliveBots = alivePlayers.filter((player) => player.isBot);
    const eliminated = this.players.filter((player) => player.defeated || player.flags?.surrendered).length;
    if (process.env.NODE_ENV === "development" && (this.lastAliveLogAt == null || this.now() - this.lastAliveLogAt > 12)) {
      this.lastAliveLogAt = this.now();
      aliveBots.slice(0, 6).forEach((bot) => {
        console.log(
          `[BOT ALIVE CHECK] ${bot.name}: ownedTiles=${this.ownedTileCount(bot)} hasCore=${this.hasOwnedCore(bot)} eliminated=${Boolean(bot.defeated)} alive=${this.isPlayerAlive(bot)}`,
        );
      });
    }

    return {
      canEnd,
      alivePlayers,
      aliveTeams,
      aliveBots,
      eliminated,
      teamStats,
      debug: {
        mode: this.matchSettings.winCondition,
        alivePlayers: alivePlayers.length,
        aliveTeams: this.teamManager?.active() ? aliveTeams.length : null,
        aliveBots: aliveBots.length,
        eliminated,
        canEnd,
        reason,
        blockedReason,
      },
    };
  }

  end(winnerId, winnerTeamId = null, reason = "elimination", state = null) {
    if (this.ended) return;
    this.ended = true;
    this.winnerId = winnerId;
    this.winnerTeamId = winnerTeamId;
    const winner = this.getPlayer(winnerId);
    const winnerTeam = this.teamManager?.territoryStats(this.players, this.tileManager.playable().length).find((team) => team.id === winnerTeamId);
    const finalState = state || this.winCheckState();
    this.pushEvent({
      kind: "ended",
      eventType: "matchEnded",
      winnerId,
      winnerTeamId,
      reason,
      remainingPlayers: finalState.alivePlayers?.length || 0,
      remainingTeams: finalState.aliveTeams?.length || 0,
      finalStats: this.finalStatsSnapshot(finalState),
      message: winnerTeam ? `${winnerTeam.name} is the last team standing.` : winner ? `${winner.name} is the last animal standing.` : "The match ended.",
      elapsed: Math.round(this.elapsed()),
      at: this.now(),
    });
    if (this.sandbox?.shouldSkipAccountRewards?.()) {
      this.pushEvent({
        kind: "notice",
        message: "Sandbox ended. No stats saved.",
        at: this.now(),
      });
      return;
    }
    this.accountServices?.stats?.recordMatch(this);
  }

  finalStatsSnapshot(state = null) {
    const playable = this.tileManager.playable().length || 1;
    const alivePlayers = state?.alivePlayers || this.players.filter((player) => this.isPlayerAlive(player));
    return {
      remainingPlayers: alivePlayers.map((player) => ({
        id: player.id,
        name: player.name,
        animal: player.animal,
        ownedTiles: this.ownedTileCount(player),
        territoryPct: this.ownedTileCount(player) / playable,
      })),
      remainingTeams: state?.aliveTeams || [],
    };
  }

  surrenderPlayer(player, targetId = null, reason = "surrendered") {
    if (!player || player.defeated) return { ok: false, message: "Player already defeated." };
    const target = targetId ? this.getPlayer(targetId) : null;
    const now = this.now();
    const owned = this.tileManager.owned(player.id);
    owned.forEach((tile, index) => {
      const transfer = target && index % 3 !== 0;
      tile.owner = transfer ? target.id : null;
      tile.captureProgress = {};
      tile.defenseEnergy = transfer ? Math.min(12, tile.defenseEnergy || 2) : Math.max(0, (tile.defenseEnergy || 0) * 0.35);
      tile.building = null;
      tile.buildingLevel = 0;
      tile.lastChanged = now;
    });
    player.stats.surrendered = 1;
    player.flags = player.flags || {};
    player.flags.surrendered = true;
    if (target) {
      target.stats.playersDefeated = (target.stats.playersDefeated || 0) + 1;
      target.stats.surrenderedEnemies = (target.stats.surrenderedEnemies || 0) + 1;
    }
    this.eliminatePlayer(player, target, reason, { notify: false });
    this.pushEvent({
      kind: "surrender",
      playerId: player.id,
      targetId: target?.id || null,
      amount: owned.length,
      message: target ? `${player.name} surrendered to ${target.name}. Territory absorbed.` : `${player.name} surrendered. Territory returned to the pond.`,
      reason,
      at: now,
    });
    this.economy.recalculate(this.players, now, this);
    return { ok: true, message: `${player.name} surrendered.` };
  }

  eliminatePlayer(player, attacker = null, reason = "eliminated", options = {}) {
    if (!player || player.defeated) return false;
    player.defeated = true;
    player.flags = player.flags || {};
    player.flags.eliminatedAt = this.now();
    player.flags.eliminationReason = reason;
    this.clearPlayerActivity(player.id);
    if (attacker && attacker.id !== player.id) attacker.stats.playersDefeated = (attacker.stats.playersDefeated || 0) + 1;
    if (options.notify !== false) {
      this.pushEvent({
        kind: "eliminated",
        playerId: player.id,
        targetId: attacker?.id || null,
        at: this.now(),
        message: attacker ? `${player.name} was eliminated by ${attacker.name}.` : `${player.name} was eliminated.`,
      });
    }
    return true;
  }

  clearPlayerActivity(playerId) {
    if (!playerId || !this.combat) return;
    this.combat.activeAttacks = this.combat.activeAttacks.filter((wave) => wave.attackerId !== playerId && wave.defenderId !== playerId);
    this.combat.continuousAttacks = this.combat.continuousAttacks.filter((order) => order.attackerId !== playerId && order.defenderId !== playerId);
    this.combat.currentPushes = this.combat.currentPushes.filter((push) => push.attackerId !== playerId && push.defenderId !== playerId);
    if (this.specials) {
      this.specials.pending = this.specials.pending.filter((strike) => strike.playerId !== playerId && strike.targetOwner !== playerId);
      this.specials.zones = this.specials.zones.filter((zone) => zone.ownerId !== playerId);
    }
  }

  snapshot(viewerId = config.HUMAN_ID) {
    const viewer = this.getPlayer(viewerId) || this.players.find((player) => !player.isBot) || this.getPlayer(config.HUMAN_ID);
    const effectiveViewerId = viewer?.id || config.HUMAN_ID;
    const playable = this.tileManager.playable().length;
    const players = this.players.map((player) => ({
      id: player.id,
      name: player.name,
      animal: player.animal,
      personality: player.personality,
      role: player.role || (player.isBot ? "rival" : "commander"),
      teamId: player.teamId || null,
      teamName: player.teamName || "",
      teamColor: player.teamColor || "",
      teamBadge: player.teamBadge || "",
      color: player.color,
      energy: Math.round(player.energy),
      maxEnergy: Math.round(player.maxEnergy),
      income: Number(player.income.toFixed(1)),
      incomeBreakdown: this.roundIncomeBreakdown(player.incomeBreakdown),
      coreTileId: player.coreTileId,
      coreHealth: Math.round(player.coreHealth || 0),
      coreMaxHealth: Math.round(player.coreMaxHealth || 0),
      coreLost: Boolean(player.coreLost || player.flags?.coreLost),
      territory: player.territory,
      territoryPct: playable ? player.territory / playable : 0,
      ownedTiles: this.ownedTileCount(player),
      hasCore: this.hasOwnedCore(player),
      alive: this.isPlayerAlive(player),
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
      specialCooldowns: player.specialCooldowns || {},
      specialStatus: this.specials?.specialStatus(player, this.now()) || {},
      progression: this.progression.progress(player),
      attackCooldownUntil: player.attackCooldownUntil || 0,
      currentPushCooldownUntil: player.currentPushCooldownUntil || 0,
      supportReadyAt: player.supportReadyAt || 0,
      buildings: player.buildings,
      flags: player.flags,
      stats: player.stats,
      accountUserId: player.accountUserId || null,
      accountUsername: player.accountUsername || "",
      profileBadge: player.profileBadge || "rookie",
      profileTitle: player.profileTitle || progressionConfig.defaultTitle,
      selectedCosmetic: player.selectedCosmetic || progressionConfig.defaultCosmetic,
      accountLevel: player.accountLevel || 0,
      matchRewards: player.matchRewards || null,
    }));

    const winState = this.winCheckState();

    return {
      serverTime: this.now(),
      timeLeft: this.timeLeft(),
      elapsed: this.elapsed(),
      animalsLeft: winState.alivePlayers.length,
      teamsLeft: this.teamManager?.active() ? winState.aliveTeams.length : 0,
      winDebug: winState.debug,
      regions: this.tileManager.regions,
      objectives: this.objectives.snapshot().objectives,
      camps: this.objectives.snapshot().camps,
      lakeEvent: this.eventsManager.snapshot(this.now()),
      missions: this.missions.snapshot(effectiveViewerId),
      wars: this.warSnapshot(),
      relationships: this.diplomacy.snapshot(effectiveViewerId, this.now()),
      matchSettings: this.matchSettings,
      sandbox: this.sandbox?.snapshot(this) || { enabled: false },
      teamState: this.teamManager.snapshot(this),
      ended: this.ended,
      winnerId: this.winnerId,
      winnerTeamId: this.winnerTeamId || null,
      winControl: config.WIN_CONTROL,
      cols: this.tileManager.cols,
      rows: this.tileManager.rows,
      humanId: effectiveViewerId,
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
        buildingPendingEvent: tile.buildingPendingEvent || null,
        captureProgress: this.roundCaptureProgress(tile.captureProgress),
        defenseEnergy: Math.round(tile.defenseEnergy),
        objectiveId: tile.objectiveId || null,
        objectiveType: tile.objectiveType || null,
        campId: tile.campId || null,
        campType: tile.campType || null,
        specialActive: Boolean(tile.specialActive),
        isCore: Boolean(tile.isCore),
        coreOwnerId: tile.coreOwnerId || null,
        coreHealth: Math.round(tile.coreHealth || 0),
        coreMaxHealth: Math.round(tile.coreMaxHealth || 0),
        lastChanged: tile.lastChanged,
      })),
      players,
      activeAttacks: this.combat.snapshot(this.now()),
      specials: this.specials?.snapshot(this.now()) || { pending: [], zones: [] },
      events: this.visibleEventsFor(effectiveViewerId).slice(-config.MAX_EVENTS),
      config: {
        tileTypes: config.TILE_TYPES,
        buildings: config.BUILDINGS,
        animals,
        objectives,
        lakeEvents,
        diplomacy: diplomacyConfig,
        combat: combatConfig,
        botDifficulty: botDifficultyConfig,
        teams: teamConfig,
        mapSizes: config.MAP_SIZES,
        balance,
        achievements: achievementConfig,
        badges: badgeConfig,
        progression: progressionConfig,
        sandbox: sandboxConfig,
        specials: specialConfig,
        buildingCosts: this.playerBuildingCosts(viewer),
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

  ownedTileCount(playerOrId) {
    const id = typeof playerOrId === "string" ? playerOrId : playerOrId?.id;
    if (!id) return 0;
    return this.tileManager.owned(id).length;
  }

  hasOwnedCore(player) {
    if (!player || player.coreTileId == null) return false;
    const core = this.tileManager.getById(player.coreTileId);
    return Boolean(core && core.owner === player.id);
  }

  isPlayerAlive(player) {
    if (!player) return false;
    if (player.defeated || player.flags?.surrendered || player.removed || player.spectator) return false;
    if (!player.isBot && player.connected === false) return false;
    return this.ownedTileCount(player) > 0;
  }

  isTeamAlive(teamOrId) {
    const teamId = typeof teamOrId === "string" ? teamOrId : teamOrId?.id;
    if (!teamId) return false;
    const members = this.players.filter((player) => player.teamId === teamId);
    if (!members.some((player) => this.isPlayerAlive(player))) return false;
    return members.some((player) => this.ownedTileCount(player) > 0);
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
      if (event.kind === "teamCommand") return Boolean(event.teamId && this.getPlayer(viewerId)?.teamId === event.teamId);
      if (event.kind === "teamResponse") return Boolean(event.teamId && this.getPlayer(viewerId)?.teamId === event.teamId);
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
    if (event.kind === "buildStarted") this.metrics.builds += 1;
    if (event.kind === "defend") this.metrics.defenses += 1;
    if (event.kind === "ping") this.metrics.pings += 1;
    if (event.kind === "objectiveCaptured") this.metrics.objectives += 1;
    if (event.kind === "campCaptured") this.metrics.camps += 1;
    if (event.kind === "specialLaunch" || event.kind === "specialDefense") this.metrics.specials += 1;
  }
}

const db = new PondDatabase();
const authManager = new AuthManager(db);
const achievementManager = new AchievementManager(db);
const matchHistoryManager = new MatchHistoryManager(db);
const profileManager = new ProfileManager(db, matchHistoryManager);
const statsManager = new StatsManager(db, achievementManager);
const accountServices = {
  db,
  auth: authManager,
  achievements: achievementManager,
  matchHistory: matchHistoryManager,
  profile: profileManager,
  stats: statsManager,
};

const game = new PondFrontServerGame({ accountServices });
const lobbyManager = new LobbyManager();

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

function requireAccount(req, res) {
  const user = authManager.currentUser(req);
  if (!user) {
    sendJson(res, 401, { ok: false, message: "Login required." });
    return null;
  }
  return user;
}

function accountPayload(req) {
  const user = authManager.currentUser(req);
  return user ? authManager.publicUser(user) : null;
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

function createLobbyMatch({ animal, difficulty, settings }) {
  const match = new PondFrontServerGame({ skipInitialReset: true, accountServices });
  match.reset(animal || "duck", difficulty || "normal", settings || {});
  return match;
}

function actionResponse(match, body, viewerId) {
  const result = match.handleAction(body);
  match.objectives.update(match);
  match.economy.completeBuildings(match.now(), match);
  match.economy.recalculate(match.players, match.now(), match);
  match.missions.update(match);
  if (result.message) match.pushEvent({ kind: "notice", message: result.message, ok: result.ok, at: match.now() });
  return { result, state: match.snapshot(viewerId) };
}

function lobbyQuery(url) {
  return {
    roomCode: url.searchParams.get("roomCode") || "",
    playerId: url.searchParams.get("playerId") || "",
    playerToken: url.searchParams.get("playerToken") || "",
  };
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

  if (req.method === "POST" && url.pathname === "/api/auth/signup") {
    const body = await readJson(req);
    const result = authManager.signup(body, req, res);
    sendJson(res, result.status || (result.ok ? 200 : 400), result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    const result = authManager.login(body, req, res);
    sendJson(res, result.status || (result.ok ? 200 : 400), result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const result = authManager.logout(req, res);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const user = authManager.currentUser(req);
    sendJson(res, 200, { ok: true, user: authManager.publicUser(user), guest: !user });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/profile/me") {
    const user = requireAccount(req, res);
    if (!user) return;
    sendJson(res, 200, { ok: true, profile: profileManager.profile(user.id) });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/profile/")) {
    const userId = decodeURIComponent(url.pathname.replace("/api/profile/", ""));
    const profile = profileManager.profile(userId);
    sendJson(res, profile ? 200 : 404, profile ? { ok: true, profile } : { ok: false, message: "Profile not found." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/stats/me") {
    const user = requireAccount(req, res);
    if (!user) return;
    sendJson(res, 200, { ok: true, stats: db.statsFor(user.id), animals: db.allAnimalStats(user.id) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    sendJson(res, 200, { ok: true, leaderboard: profileManager.leaderboard(url.searchParams.get("category") || "highestLevel", url.searchParams.get("limit") || 20) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile/select-badge") {
    const user = requireAccount(req, res);
    if (!user) return;
    const body = await readJson(req);
    const result = profileManager.selectBadge(user.id, String(body.badgeId || ""));
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile/select-title") {
    const user = requireAccount(req, res);
    if (!user) return;
    const body = await readJson(req);
    const result = profileManager.selectTitle(user.id, String(body.titleId || ""));
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile/select-cosmetic") {
    const user = requireAccount(req, res);
    if (!user) return;
    const body = await readJson(req);
    const result = profileManager.selectCosmetic(user.id, String(body.cosmeticId || ""));
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start") {
    const body = await readJson(req);
    const accountUser = accountPayload(req);
    game.reset(body.animal || "duck", body.difficulty || "normal", {
      playerName: body.playerName,
      accountUser,
      botCount: body.botCount,
      mapSize: body.mapSize,
      matchLength: body.matchLength,
      practice: body.practice,
      beginnerCombat: body.beginnerCombat,
      gameMode: body.gameMode,
      coopTeammates: body.coopTeammates,
      teamBotDifficulty: body.teamBotDifficulty,
      teamCount: body.teamCount,
      botsPerTeam: body.botsPerTeam,
      allowBots: body.allowBots,
      sandbox: body.sandbox,
      sandboxRules: body.sandboxRules,
      sandboxBotDifficulty: body.sandboxBotDifficulty,
      sandboxBotPersonality: body.sandboxBotPersonality,
      sandboxSpeed: body.sandboxSpeed,
    });
    sendJson(res, 200, game.snapshot(config.HUMAN_ID));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lobby/create") {
    const body = await readJson(req);
    const result = lobbyManager.createLobby({ ...body, accountUser: accountPayload(req) });
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lobby/join") {
    const body = await readJson(req);
    const result = lobbyManager.joinLobby(body.roomCode, { ...body, accountUser: accountPayload(req) });
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/lobby/state") {
    const query = lobbyQuery(url);
    const result = lobbyManager.state(query.roomCode, query.playerId, query.playerToken);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lobby/update") {
    const body = await readJson(req);
    const result = lobbyManager.updateLobby(body.roomCode, body.playerId, body.playerToken, body);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lobby/leave") {
    const body = await readJson(req);
    const result = lobbyManager.leaveLobby(body.roomCode, body.playerId, body.playerToken);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lobby/start") {
    const body = await readJson(req);
    const result = lobbyManager.startLobbyMatch(body.roomCode, body.playerId, body.playerToken, createLobbyMatch);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const query = lobbyQuery(url);
    if (query.roomCode) {
      const session = lobbyManager.validateSession(query.roomCode, query.playerId, query.playerToken);
      if (!session.ok) {
        sendJson(res, 400, session);
        return;
      }
      if (!session.lobby.match) {
        sendJson(res, 400, { ok: false, message: "Lobby match has not started." });
        return;
      }
      sendJson(res, 200, session.lobby.match.snapshot(session.player.id));
      return;
    }
    sendJson(res, 200, game.snapshot(config.HUMAN_ID));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/action") {
    const body = await readJson(req);
    if (body.roomCode) {
      const session = lobbyManager.validateSession(body.roomCode, body.playerId, body.playerToken);
      if (!session.ok) {
        sendJson(res, 400, session);
        return;
      }
      if (!session.lobby.match) {
        sendJson(res, 400, { ok: false, message: "Lobby match has not started." });
        return;
      }
      const { result, state } = actionResponse(session.lobby.match, { ...body, playerId: session.player.id }, session.player.id);
      sendJson(res, result.ok ? 200 : 400, { ...result, state });
      return;
    }
    const { result, state } = actionResponse(game, { ...body, playerId: config.HUMAN_ID }, config.HUMAN_ID);
    sendJson(res, result.ok ? 200 : 400, { ...result, state });
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
    lobbyManager.tick(dt);
  }, config.TICK_RATE_MS);

  server.listen(PORT, () => {
    console.log(`PondFront.io server running at http://localhost:${PORT}/`);
  });
}

module.exports = { PondFrontServerGame, game, lobbyManager, server };
