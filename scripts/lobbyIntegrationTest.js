const LobbyManager = require("../server/LobbyManager");

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function fakeMatch(settings) {
  return {
    settings,
    ended: false,
    players: settings.humanPlayers || [],
    snapshot(playerId) {
      return { humanId: playerId, phase: "SPAWN_SELECTION", players: this.players };
    },
    getPlayer(playerId) {
      return this.players.find((player) => player.id === playerId) || null;
    },
    tick() {},
  };
}

const manager = new LobbyManager();
const hostAccount = { id: "account-host", username: "HostUser" };
const guestAccount = { id: "account-guest", username: "GuestUser" };
const created = manager.createLobby({
  playerName: "Host",
  animal: "duck",
  accountUser: hostAccount,
  settings: { mapSize: "small", maxPlayers: 2, botCount: 0, spawnSelectionSeconds: 30 },
});
check("lobby creation returns host session", created.ok && created.session.isHost && created.lobby.playerCount === 1, created.message);

const invalid = manager.joinLobby("bad", { playerName: "Nope" });
check("invalid room code is rejected", !invalid.ok && /not found|invalid/i.test(invalid.message), invalid.message);

const joined = manager.joinLobby(created.lobby.roomCode, { playerName: "Guest", animal: "frog", accountUser: guestAccount });
check("valid room join succeeds", joined.ok && joined.lobby.playerCount === 2, joined.message);

const duplicate = manager.joinLobby(created.lobby.roomCode, { playerName: "Duplicate", animal: "snake", accountUser: guestAccount });
check(
  "authenticated repeat join restores one player",
  duplicate.ok && duplicate.session.playerId === joined.session.playerId && duplicate.lobby.playerCount === 2,
  duplicate.message,
);

const full = manager.joinLobby(created.lobby.roomCode, { playerName: "Third", accountUser: { id: "account-third" } });
check("full lobby rejects a new account", !full.ok && /full/i.test(full.message), full.message);

const nonHostSettings = manager.updateLobby(created.lobby.roomCode, joined.session.playerId, joined.session.playerToken, { settings: { botCount: 2 } });
check("non-host cannot change settings", !nonHostSettings.ok && /host/i.test(nonHostSettings.message), nonHostSettings.message);

const premature = manager.startLobbyMatch(created.lobby.roomCode, created.session.playerId, created.session.playerToken, ({ settings }) => fakeMatch(settings));
check("unready player blocks match start", !premature.ok && /ready/i.test(premature.message), premature.message);

const ready = manager.updateLobby(created.lobby.roomCode, joined.session.playerId, joined.session.playerToken, { ready: true });
check("player can become ready", ready.ok && ready.lobby.players.find((player) => player.id === joined.session.playerId)?.ready);

const wrongStart = manager.startLobbyMatch(created.lobby.roomCode, joined.session.playerId, joined.session.playerToken, ({ settings }) => fakeMatch(settings));
check("only host can start", !wrongStart.ok && /host/i.test(wrongStart.message), wrongStart.message);

const started = manager.startLobbyMatch(created.lobby.roomCode, created.session.playerId, created.session.playerToken, ({ settings }) => fakeMatch(settings));
check("ready lobby starts one match", started.ok && started.lobby.status === "inGame" && started.matchState.phase === "SPAWN_SELECTION", started.message);

const repeated = manager.startLobbyMatch(created.lobby.roomCode, created.session.playerId, created.session.playerToken, ({ settings }) => fakeMatch(settings));
check("repeated start is rejected", !repeated.ok && /started/i.test(repeated.message), repeated.message);

const reconnected = manager.state(created.lobby.roomCode, joined.session.playerId, joined.session.playerToken);
check("valid lobby token reconnects to match", reconnected.ok && reconnected.matchState?.humanId === joined.session.playerId);

const invalidToken = manager.state(created.lobby.roomCode, joined.session.playerId, "wrong-token");
check("invalid reconnect token is rejected", !invalidToken.ok && /invalid/i.test(invalidToken.message), invalidToken.message);

const transferManager = new LobbyManager();
const transferLobby = transferManager.createLobby({ playerName: "First", accountUser: { id: "first" } });
const next = transferManager.joinLobby(transferLobby.lobby.roomCode, { playerName: "Next", accountUser: { id: "next" } });
const left = transferManager.leaveLobby(transferLobby.lobby.roomCode, transferLobby.session.playerId, transferLobby.session.playerToken);
check("host leave transfers host safely", left.ok && left.lobby.hostId === next.session.playerId && left.lobby.players.find((player) => player.id === next.session.playerId)?.isHost);

const unavailable = transferManager.createLobby({ playerName: "Host", settings: { ruleMode: "riverDomination" } });
check("Coming Soon mode cannot create a lobby", !unavailable.ok && /not available/i.test(unavailable.message), unavailable.message);

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;

