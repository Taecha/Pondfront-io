const crypto = require("crypto");
const animals = require("../shared/animals");
const teamConfig = require("../shared/teamConfig");
const config = require("../shared/gameConfig");

const TEAM_IDS = new Set(teamConfig.teams.map((team) => `team-${team.id}`));
const TEAM_ALIASES = new Map(teamConfig.teams.map((team) => [team.id, `team-${team.id}`]));

class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.playerLobby = new Map();
    this.cleanupSeconds = 60;
    this.disconnectGraceSeconds = 18;
  }

  createLobby(payload = {}) {
    const settings = this.sanitizeSettings(payload.settings || payload);
    const roomCode = this.generateRoomCode();
    const host = this.makePlayer(payload, settings, true);
    const lobby = {
      lobbyId: this.id("lobby"),
      roomCode,
      hostId: host.id,
      status: "waiting",
      createdAt: this.now(),
      updatedAt: this.now(),
      startedAt: 0,
      settings,
      players: [host],
      bots: [],
      teams: teamConfig.teams.slice(0, settings.teamCount),
      match: null,
      notices: [{ id: this.id("notice"), message: `${host.name} created the lobby.`, at: this.now() }],
    };
    this.lobbies.set(roomCode, lobby);
    this.playerLobby.set(host.id, roomCode);
    return {
      ok: true,
      message: "Lobby created.",
      lobby: this.publicState(lobby, host.id),
      session: this.session(host, lobby),
    };
  }

  joinLobby(roomCode, payload = {}) {
    const normalized = this.normalizeRoomCode(roomCode);
    if (!normalized) return { ok: false, message: "Invalid room code." };
    const lobby = this.lobbies.get(normalized);
    if (!lobby) return { ok: false, message: "Lobby not found." };
    if (lobby.status !== "waiting") return { ok: false, message: "Lobby already started." };
    const connectedPlayers = lobby.players.filter((player) => player.connected);
    if (connectedPlayers.length >= lobby.settings.maxPlayers) return { ok: false, message: "Lobby is full." };

    const player = this.makePlayer(payload, lobby.settings, false);
    lobby.players.push(player);
    this.playerLobby.set(player.id, lobby.roomCode);
    this.notice(lobby, `${player.name} joined the lobby.`);
    this.touch(lobby, player);
    return {
      ok: true,
      message: "Lobby joined.",
      lobby: this.publicState(lobby, player.id),
      session: this.session(player, lobby),
    };
  }

  state(roomCode, playerId, token) {
    const lobby = this.requireLobby(roomCode);
    if (!lobby.ok) return lobby;
    const player = this.validatePlayer(lobby.lobby, playerId, token);
    if (!player.ok) return player;
    this.touch(lobby.lobby, player.player);
    return {
      ok: true,
      lobby: this.publicState(lobby.lobby, player.player.id),
      session: this.session(player.player, lobby.lobby),
      matchState: lobby.lobby.status === "inGame" && lobby.lobby.match ? lobby.lobby.match.snapshot(player.player.id) : null,
    };
  }

  updateLobby(roomCode, playerId, token, payload = {}) {
    const found = this.requireLobby(roomCode);
    if (!found.ok) return found;
    const lobby = found.lobby;
    if (lobby.status !== "waiting") return { ok: false, message: "Lobby already started." };
    const foundPlayer = this.validatePlayer(lobby, playerId, token);
    if (!foundPlayer.ok) return foundPlayer;
    const player = foundPlayer.player;
    this.touch(lobby, player);

    let changed = false;
    if (payload.playerName != null) {
      const name = this.cleanPlayerName(payload.playerName);
      if (name && player.name !== name) {
        player.name = name;
        changed = true;
      }
    }
    if (payload.animal != null) {
      const animal = this.cleanAnimal(payload.animal);
      if (player.animal !== animal) {
        player.animal = animal;
        if (!player.isHost) player.ready = false;
        changed = true;
      }
    }
    if (payload.teamId != null) {
      const teamId = this.cleanTeamId(payload.teamId, lobby.settings);
      if (player.teamId !== teamId) {
        player.teamId = teamId;
        if (!player.isHost) player.ready = false;
        changed = true;
      }
    }
    if (payload.ready != null) {
      player.ready = Boolean(payload.ready);
      changed = true;
    }
    if (payload.settings) {
      if (player.id !== lobby.hostId) return { ok: false, message: "Only the host can change lobby settings." };
      lobby.settings = this.sanitizeSettings({ ...lobby.settings, ...payload.settings });
      lobby.teams = teamConfig.teams.slice(0, lobby.settings.teamCount);
      this.normalizeLobbyTeams(lobby);
      changed = true;
    }

    if (changed) lobby.updatedAt = this.now();
    return { ok: true, message: "Lobby updated.", lobby: this.publicState(lobby, player.id), session: this.session(player, lobby) };
  }

  leaveLobby(roomCode, playerId, token) {
    const found = this.requireLobby(roomCode);
    if (!found.ok) return found;
    const lobby = found.lobby;
    const foundPlayer = this.validatePlayer(lobby, playerId, token);
    if (!foundPlayer.ok) return foundPlayer;
    const player = foundPlayer.player;
    if (lobby.status === "inGame") {
      player.connected = false;
      player.lastSeenAt = this.now() - this.cleanupSeconds;
      this.notice(lobby, `${player.name} left the match.`);
      this.assignHost(lobby);
      return { ok: true, message: "Left lobby.", lobby: this.publicState(lobby, lobby.hostId) };
    }
    lobby.players = lobby.players.filter((candidate) => candidate.id !== player.id);
    this.playerLobby.delete(player.id);
    this.notice(lobby, `${player.name} left the lobby.`);
    if (!lobby.players.length) {
      this.lobbies.delete(lobby.roomCode);
      return { ok: true, message: "Lobby closed." };
    }
    this.assignHost(lobby);
    lobby.updatedAt = this.now();
    return { ok: true, message: "Left lobby.", lobby: this.publicState(lobby, lobby.hostId) };
  }

  startLobbyMatch(roomCode, playerId, token, createMatch) {
    const found = this.requireLobby(roomCode);
    if (!found.ok) return found;
    const lobby = found.lobby;
    const foundPlayer = this.validatePlayer(lobby, playerId, token);
    if (!foundPlayer.ok) return foundPlayer;
    const player = foundPlayer.player;
    if (lobby.status !== "waiting") return { ok: false, message: "Lobby already started." };
    if (player.id !== lobby.hostId) return { ok: false, message: "Only the host can start the match." };

    const activePlayers = lobby.players.filter((entry) => entry.connected);
    const unready = activePlayers.filter((entry) => !entry.isHost && !entry.ready);
    if (unready.length && !lobby.settings.forceStart) {
      return { ok: false, message: "Players must ready up first, or host can enable Force Start." };
    }

    lobby.status = "starting";
    lobby.updatedAt = this.now();
    const humanPlayers = activePlayers.map((entry, index) => ({
      id: entry.id,
      socketId: entry.socketId || null,
      name: entry.name,
      animal: entry.animal,
      teamId: this.teamForMatch(entry, lobby.settings, index),
      ready: entry.ready,
      isHost: entry.id === lobby.hostId,
      connected: entry.connected,
      color: config.PLAYER_COLORS[index % config.PLAYER_COLORS.length],
      spawnIndex: index,
      accountUserId: entry.accountUserId || null,
      accountUsername: entry.accountUsername || "",
      selectedBadge: entry.selectedBadge || "rookie",
      selectedTitle: entry.selectedTitle || "pond_rookie",
      selectedCosmetic: entry.selectedCosmetic || "clear_ripple",
      accountLevel: entry.accountLevel || 0,
    }));

    try {
      lobby.match = createMatch({
        animal: humanPlayers[0]?.animal || "duck",
        difficulty: lobby.settings.botDifficulty,
        settings: {
          ...lobby.settings,
          difficulty: lobby.settings.botDifficulty,
          humanPlayers,
          playerName: humanPlayers[0]?.name || "Player",
          practice: false,
          lobbyRoomCode: lobby.roomCode,
        },
      });
      lobby.status = "inGame";
      lobby.startedAt = this.now();
      lobby.players.forEach((entry) => {
        entry.ready = true;
      });
      this.notice(lobby, "Match started.");
      return {
        ok: true,
        message: "Match started.",
        lobby: this.publicState(lobby, player.id),
        session: this.session(player, lobby, true),
        matchState: lobby.match.snapshot(player.id),
      };
    } catch (error) {
      lobby.status = "waiting";
      return { ok: false, message: error?.message || "Connection failed." };
    }
  }

  tick(dt) {
    const now = this.now();
    for (const lobby of this.lobbies.values()) {
      if (lobby.status === "inGame" && lobby.match && !lobby.match.ended) lobby.match.tick(dt);
      if (lobby.status === "inGame" && lobby.match?.ended) lobby.status = "ended";
      lobby.players.forEach((player) => {
        if (now - (player.lastSeenAt || lobby.createdAt) > this.disconnectGraceSeconds) player.connected = false;
      });
      if (lobby.status === "waiting") {
        const before = lobby.players.length;
        lobby.players = lobby.players.filter((player) => now - (player.lastSeenAt || lobby.createdAt) <= this.cleanupSeconds);
        if (lobby.players.length !== before) this.assignHost(lobby);
      }
      if (!lobby.players.length && lobby.status !== "inGame") this.lobbies.delete(lobby.roomCode);
    }
  }

  validateSession(roomCode, playerId, token) {
    const found = this.requireLobby(roomCode);
    if (!found.ok) return found;
    const player = this.validatePlayer(found.lobby, playerId, token);
    if (!player.ok) return player;
    this.touch(found.lobby, player.player);
    return { ok: true, lobby: found.lobby, player: player.player };
  }

  requireLobby(roomCode) {
    const normalized = this.normalizeRoomCode(roomCode);
    if (!normalized) return { ok: false, message: "Invalid room code." };
    const lobby = this.lobbies.get(normalized);
    if (!lobby) return { ok: false, message: "Lobby not found." };
    return { ok: true, lobby };
  }

  validatePlayer(lobby, playerId, token) {
    const player = lobby.players.find((entry) => entry.id === playerId);
    if (!player) return { ok: false, message: "Player session not found." };
    if (!token || player.token !== token) return { ok: false, message: "Invalid lobby session." };
    return { ok: true, player };
  }

  touch(lobby, player) {
    player.connected = true;
    player.lastSeenAt = this.now();
    player.isHost = player.id === lobby.hostId;
  }

  assignHost(lobby) {
    const nextHost = lobby.players.find((player) => player.connected) || lobby.players[0] || null;
    lobby.hostId = nextHost?.id || null;
    lobby.players.forEach((player) => {
      player.isHost = player.id === lobby.hostId;
      if (player.isHost) player.ready = true;
    });
    if (nextHost) this.notice(lobby, `${nextHost.name} is now host.`);
  }

  makePlayer(payload, settings, isHost) {
    const animal = this.cleanAnimal(payload.animal);
    const player = {
      id: this.id("p"),
      socketId: payload.socketId || null,
      token: this.id("token"),
      name: this.cleanPlayerName(payload.playerName || payload.name || (isHost ? "Host" : "Player")),
      animal,
      teamId: this.cleanTeamId(payload.teamId, settings),
      ready: Boolean(isHost),
      isHost: Boolean(isHost),
      connected: true,
      joinedAt: this.now(),
      lastSeenAt: this.now(),
      accountUserId: payload.accountUser?.id || payload.accountUserId || null,
      accountUsername: payload.accountUser?.username || payload.accountUsername || "",
      selectedBadge: payload.accountUser?.selectedBadge || payload.selectedBadge || "rookie",
      selectedTitle: payload.accountUser?.selectedTitle || payload.selectedTitle || "pond_rookie",
      selectedCosmetic: payload.accountUser?.selectedCosmetic || payload.selectedCosmetic || "clear_ripple",
      accountLevel: payload.accountUser?.level || payload.accountLevel || 0,
    };
    return player;
  }

  sanitizeSettings(settings = {}) {
    const gameMode = ["solo", "coop", "teamBattle"].includes(settings.gameMode) ? settings.gameMode : "solo";
    const mapSize = ["small", "medium", "large", "huge"].includes(settings.mapSize) ? settings.mapSize : "medium";
    const botDifficulty = ["easy", "normal", "smart", "chaos"].includes(settings.botDifficulty || settings.difficulty)
      ? settings.botDifficulty || settings.difficulty
      : "normal";
    const teamCount = Math.max(2, Math.min(4, Number(settings.teamCount || 2)));
    const botsPerTeam = Math.max(0, Math.min(6, Number(settings.botsPerTeam ?? 4)));
    const map = config.MAP_SIZES[mapSize] || config.MAP_SIZES.medium;
    const maxPlayers = Math.max(2, Math.min(12, Number(settings.maxPlayers || 8)));
    const allowBots = settings.allowBots !== false;
    const botCount = allowBots ? Math.max(0, Math.min(map.maxBots, Number(settings.botCount ?? map.defaultBots ?? config.BOT_COUNT ?? 8))) : 0;
    return {
      gameMode,
      mapSize,
      botCount,
      botDifficulty,
      difficulty: botDifficulty,
      teamCount,
      botsPerTeam,
      allowBots,
      maxPlayers,
      matchLength: ["quick", "standard", "long"].includes(settings.matchLength) ? settings.matchLength : "standard",
      coopTeammates: Math.max(0, Math.min(4, Number(settings.coopTeammates ?? 2))),
      teamBotDifficulty: ["normal", "smart", "aggressive"].includes(settings.teamBotDifficulty) ? settings.teamBotDifficulty : "normal",
      forceStart: Boolean(settings.forceStart),
    };
  }

  normalizeLobbyTeams(lobby) {
    lobby.players.forEach((player, index) => {
      player.teamId = this.teamForMatch(player, lobby.settings, index);
    });
  }

  teamForMatch(player, settings, index = 0) {
    if (settings.gameMode === "coop") return "team-blue";
    if (settings.gameMode !== "teamBattle") return null;
    const cleaned = this.cleanTeamId(player.teamId, settings);
    if (cleaned) return cleaned;
    const team = teamConfig.teams[index % Math.max(2, settings.teamCount)];
    return `team-${team.id}`;
  }

  cleanTeamId(value, settings = {}) {
    if (!value || settings.gameMode === "solo") return null;
    if (settings.gameMode === "coop") return "team-blue";
    const normalized = String(value).trim().toLowerCase().replace(/^team-/, "");
    const teamId = TEAM_ALIASES.get(normalized) || (TEAM_IDS.has(value) ? value : null);
    const allowed = teamConfig.teams.slice(0, Math.max(2, Number(settings.teamCount || 2))).map((team) => `team-${team.id}`);
    return allowed.includes(teamId) ? teamId : allowed[0];
  }

  cleanAnimal(value) {
    return animals[value] ? value : "duck";
  }

  cleanPlayerName(value) {
    const safe = String(value || "Player")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 18);
    return safe || "Player";
  }

  generateRoomCode() {
    for (let attempts = 0; attempts < 40; attempts += 1) {
      const code = `POND-${Math.floor(100 + Math.random() * 900)}`;
      if (!this.lobbies.has(code)) return code;
    }
    let code;
    do {
      code = crypto.randomBytes(3).toString("hex").toUpperCase();
    } while (this.lobbies.has(code));
    return code;
  }

  normalizeRoomCode(value) {
    const raw = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (raw.length < 3) return "";
    if (raw.startsWith("POND") && raw.length > 4) return `POND-${raw.slice(4, 10)}`;
    return raw.slice(0, 8);
  }

  publicState(lobby, viewerId = null) {
    const settings = { ...lobby.settings };
    const players = lobby.players.map((player) => ({
      id: player.id,
      name: player.name,
      animal: player.animal,
      teamId: this.teamForMatch(player, settings),
      ready: player.ready,
      isHost: player.id === lobby.hostId,
      connected: player.connected,
      isViewer: player.id === viewerId,
      joinedAt: player.joinedAt,
      accountUserId: player.accountUserId || null,
      accountUsername: player.accountUsername || "",
      selectedBadge: player.selectedBadge || "rookie",
      selectedTitle: player.selectedTitle || "pond_rookie",
      selectedCosmetic: player.selectedCosmetic || "clear_ripple",
      accountLevel: player.accountLevel || 0,
    }));
    return {
      lobbyId: lobby.lobbyId,
      roomCode: lobby.roomCode,
      hostId: lobby.hostId,
      status: lobby.status,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
      startedAt: lobby.startedAt,
      settings,
      players,
      playerCount: players.filter((player) => player.connected).length,
      teams: teamConfig.teams.slice(0, settings.teamCount),
      notices: lobby.notices.slice(-6),
    };
  }

  session(player, lobby, inGame = lobby.status === "inGame") {
    return {
      roomCode: lobby.roomCode,
      playerId: player.id,
      playerToken: player.token,
      isHost: player.id === lobby.hostId,
      inGame,
    };
  }

  notice(lobby, message) {
    lobby.notices.push({ id: this.id("notice"), message, at: this.now() });
    lobby.notices = lobby.notices.slice(-16);
    lobby.updatedAt = this.now();
  }

  id(prefix) {
    return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
  }

  now() {
    return Date.now() / 1000;
  }
}

module.exports = LobbyManager;
