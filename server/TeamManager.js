const config = require("../shared/gameConfig");
const teamConfig = require("../shared/teamConfig");

class TeamManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
    this.teams = [];
    this.commands = [];
    this.commandId = 1;
  }

  setup(players, settings = {}) {
    this.players = players;
    this.settings = settings;
    this.mode = settings.gameMode || "solo";
    this.teams = [];
    this.commands = [];
    players.forEach((player, index) => {
      player.teamId = null;
      player.teamName = "";
      player.teamColor = "";
      player.teamBadge = "";
      player.role = player.isBot ? "rival" : "commander";
      player.spawnIndex = index;
      player.allies?.clear?.();
    });

    if (this.mode === "coop") this.setupCoop(players, settings);
    else if (this.mode === "teamBattle") this.setupTeamBattle(players, settings);
  }

  setupCoop(players, settings) {
    const humans = players.filter((player) => !player.isBot);
    if (!humans.length) return;
    const teammateCount = Math.max(1, Math.min(3, Number(settings.coopTeammates || 2)));
    const team = this.addTeam(teamConfig.teams[0]);
    const usedSpawnIndices = new Set();
    humans.forEach((human, index) => {
      const spawnIndex = this.coopHumanSpawnIndex(index);
      usedSpawnIndices.add(spawnIndex);
      this.assign(human, team, index === 0 ? "commander" : "guardian", spawnIndex);
    });

    const roles = ["guardian", "attacker", "builder", "scout"];
    const teammateBots = players.filter((player) => player.isBot).slice(0, Math.max(0, teammateCount));
    teammateBots.forEach((bot, index) => {
      bot.difficulty = this.normalizeTeamDifficulty(settings.teamBotDifficulty, bot.difficulty);
      const spawnIndex = this.nextFreeSpawnIndex(usedSpawnIndices, this.coopSpawnIndex(index));
      usedSpawnIndices.add(spawnIndex);
      this.assign(bot, team, roles[index % roles.length], spawnIndex);
      bot.personality = this.rolePersonality(bot.role);
      bot.favoriteTerrain = bot.role === "scout" ? "lily" : bot.favoriteTerrain;
    });

    const rivals = players.filter((player) => player.isBot && !player.teamId);
    const rivalTeams = teamConfig.teams.slice(1);
    rivals.forEach((bot, index) => {
      const rivalTeam = this.addTeam(rivalTeams[index % rivalTeams.length]);
      const spawnIndex = this.nextFreeSpawnIndex(usedSpawnIndices, index + 1);
      usedSpawnIndices.add(spawnIndex);
      this.assign(bot, rivalTeam, "rival", spawnIndex);
    });
    this.syncAlliances(players);
  }

  setupTeamBattle(players, settings) {
    const teamCount = Math.max(2, Math.min(4, Number(settings.teamCount || 2)));
    const teams = teamConfig.teams.slice(0, teamCount).map((team) => this.addTeam(team));
    const waveByTeam = Array.from({ length: teamCount }, () => 0);
    const humans = players.filter((player) => !player.isBot);
    humans.forEach((human, index) => {
      const teamIndex = this.preferredTeamIndex(human.preferredTeamId, teamCount, index);
      const wave = waveByTeam[teamIndex];
      waveByTeam[teamIndex] += 1;
      this.assign(human, teams[teamIndex], wave === 0 ? "commander" : "guardian", this.teamSpawnIndex(teamIndex, wave, teamCount));
    });

    const roles = ["guardian", "attacker", "builder", "scout"];
    players
      .filter((player) => player.isBot)
      .forEach((bot, index) => {
        const teamIndex = index % teamCount;
        const team = teams[teamIndex];
        const wave = waveByTeam[teamIndex];
        waveByTeam[teamIndex] += 1;
        const role = roles[(wave + teamIndex) % roles.length];
        this.assign(bot, team, role, this.teamSpawnIndex(teamIndex, wave, teamCount));
        bot.personality = this.rolePersonality(role);
      });
    this.syncAlliances(players);
  }

  addTeam(definition) {
    const id = `team-${definition.id}`;
    let team = this.teams.find((candidate) => candidate.id === id);
    if (!team) {
      team = {
        id,
        name: definition.name,
        color: definition.color,
        badge: definition.badge,
      };
      this.teams.push(team);
    }
    return team;
  }

  assign(player, team, role, spawnIndex) {
    player.teamId = team.id;
    player.teamName = team.name;
    player.teamColor = team.color;
    player.teamBadge = team.badge;
    player.role = role;
    player.spawnIndex = spawnIndex;
  }

  syncAlliances(players) {
    players.forEach((player) => {
      if (!player.teamId) return;
      players.forEach((other) => {
        if (other.id !== player.id && other.teamId === player.teamId) {
          if (this.settings?.friendlyFire) player.allies.delete(other.id);
          else player.allies.add(other.id);
          player.enemies.delete(other.id);
        }
      });
    });
  }

  normalizeTeamDifficulty(value, fallback = "normal") {
    if (value === "aggressive") return "smart";
    if (["easy", "normal", "smart"].includes(value)) return value;
    return fallback || "normal";
  }

  rolePersonality(role) {
    return (
      {
        guardian: "defensive",
        attacker: "aggressive",
        builder: "farmer",
        scout: "objectiveHunter",
      }[role] || "opportunist"
    );
  }

  coopSpawnIndex(index) {
    return [8, 12, 14][index] ?? index + 1;
  }

  coopHumanSpawnIndex(index) {
    return [0, 8, 12, 14, 4, 6, 10, 16][index] ?? index;
  }

  preferredTeamIndex(preferredTeamId, teamCount, fallbackIndex = 0) {
    if (preferredTeamId) {
      const normalized = String(preferredTeamId).replace(/^team-/, "");
      const index = teamConfig.teams.slice(0, teamCount).findIndex((team) => team.id === normalized || `team-${team.id}` === preferredTeamId);
      if (index >= 0) return index;
    }
    return fallbackIndex % teamCount;
  }

  nextFreeSpawnIndex(used, offset = 0) {
    const preferred = [1, 2, 3, 5, 7, 9, 10, 11, 13, 15, 4, 6, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    for (let i = 0; i < preferred.length; i += 1) {
      const value = preferred[(i + offset) % preferred.length];
      if (!used.has(value)) return value;
    }
    for (let i = 0; i < 64; i += 1) {
      if (!used.has(i)) return i;
    }
    return offset + 1;
  }

  teamSpawnIndex(teamIndex, wave, teamCount) {
    const lanes = [
      [4, 8, 12, 16, 20, 24],
      [1, 5, 9, 13, 17, 21],
      [2, 6, 10, 14, 18, 22],
      [3, 7, 11, 15, 19, 23],
    ];
    if (teamCount === 2) {
      const twoTeam = teamIndex === 0 ? [4, 6, 8, 12, 16, 20] : [1, 5, 7, 9, 13, 17];
      return twoTeam[wave % twoTeam.length];
    }
    return lanes[teamIndex % lanes.length][wave % lanes[teamIndex % lanes.length].length];
  }

  active() {
    return this.mode === "coop" || this.mode === "teamBattle";
  }

  sameTeam(a, b) {
    const left = typeof a === "string" ? this.player(a) : a;
    const right = typeof b === "string" ? this.player(b) : b;
    return Boolean(this.active() && !this.settings?.friendlyFire && left?.teamId && right?.teamId && left.teamId === right.teamId);
  }

  player(id) {
    return this.players?.find((player) => player.id === id) || null;
  }

  relationship(actorId, targetId) {
    if (!this.active()) return "solo";
    if (actorId === targetId) return "self";
    if (this.sameTeam(actorId, targetId)) return "teammate";
    return "enemyTeam";
  }

  handleCommand(game, actor, body = {}) {
    if (!this.active()) return { ok: false, message: "Team commands are available in Co-Op and Team Battle." };
    if (!actor?.teamId) return { ok: false, message: "You are not on a team." };
    const commandType = teamConfig.commands[body.command] ? body.command : "help";
    const commandDef = teamConfig.commands[commandType];
    const tile = game.tileManager.getById(Number(body.tileId));
    if (!tile) return { ok: false, message: "Choose a valid tile for the team command." };
    const now = game.now();
    const command = {
      id: `tc-${this.commandId}`,
      command: commandType,
      label: commandDef.label,
      teamId: actor.teamId,
      teamName: actor.teamName,
      teamColor: actor.teamColor,
      playerId: actor.id,
      targetId: body.targetId || tile.owner || null,
      tileId: tile.id,
      createdAt: now,
      expiresAt: now + (commandType === "retreat" ? 12 : 28),
    };
    this.commandId += 1;
    this.commands.push(command);
    this.commands = this.commands.filter((entry) => entry.expiresAt > now).slice(-36);

    const teammates = game.players.filter((player) => player.isBot && !player.defeated && player.teamId === actor.teamId);
    teammates.forEach((bot) => {
      bot.flags = bot.flags || {};
      bot.flags.teamCommand = {
        id: command.id,
        command: command.command,
        tileId: command.tileId,
        targetId: command.targetId,
        issuedBy: actor.id,
        expiresAt: command.expiresAt,
      };
      bot.flags.teamCommandReactionAt = now + this.reactionDelay(bot, command.command);
    });

    this.pushEvent({
      kind: "teamCommand",
      command: command.command,
      label: command.label,
      playerId: actor.id,
      teamId: actor.teamId,
      teamColor: actor.teamColor,
      targetId: command.targetId,
      to: tile.id,
      at: now,
    });
    this.pushEvent({
      kind: "ping",
      pingType: commandDef.pingType,
      playerId: actor.id,
      targetId: command.targetId,
      teamId: actor.teamId,
      teamColor: actor.teamColor,
      to: tile.id,
      visibility: "allies",
      at: now,
    });
    return { ok: true, message: `Team command sent: ${commandDef.label}.` };
  }

  revive(game, actor, targetId, tileId) {
    if (!this.active() || (this.settings?.teamRevives || "off") === "off") return { ok: false, message: "Team revives are disabled." };
    const target = game.getPlayer(targetId);
    const tile = game.tileManager.getById(Number(tileId));
    if (!target || target.teamId !== actor.teamId || target.id === actor.id) return { ok: false, message: "Choose an eliminated teammate." };
    if (!target.defeated && game.isPlayerAlive(target)) return { ok: false, message: "That teammate is still active." };
    if (!tile || tile.owner !== actor.id || !game.tileManager.isBorder(tile, actor.id)) return { ok: false, message: "Revive on one of your safe border tiles." };
    const mode = this.settings.teamRevives;
    const used = Number(target.flags?.revivesUsed || 0);
    if (mode === "one" && used >= 1) return { ok: false, message: "That teammate already used their revive." };
    game.teamRevivePool = game.teamRevivePool || new Map();
    const poolUsed = game.teamRevivePool.get(actor.teamId) || 0;
    if (mode === "pool" && poolUsed >= Math.max(1, game.players.filter((player) => player.teamId === actor.teamId).length)) {
      return { ok: false, message: "Your team revive pool is empty." };
    }
    const cost = Math.round(100 * (1 + used * 0.55 + poolUsed * 0.2));
    if (actor.energy < cost) return { ok: false, message: `Need ${cost - Math.round(actor.energy)} more Animal Energy (${cost} total).` };
    actor.energy -= cost;
    target.defeated = false;
    target.removed = false;
    target.flags = target.flags || {};
    delete target.flags.surrendered;
    target.flags.revivesUsed = used + 1;
    target.flags.reviveProtectionUntil = game.now() + 10;
    target.flags.reviveAttackLockUntil = game.now() + 10;
    game.tileManager.claimStartAt(target, tile.id, game.now(), 1);
    game.core.setup(game.players.filter((player) => !player.removed), game.now());
    game.teamRevivePool.set(actor.teamId, poolUsed + 1);
    game.economy.recalculate(game.players, game.now(), game);
    this.pushEvent({ kind: "teamRevive", playerId: target.id, targetId: actor.id, to: tile.id, cost, protectionUntil: target.flags.reviveProtectionUntil, message: `${actor.name} revived ${target.name}.`, at: game.now() });
    return { ok: true, message: `${target.name} revived with 10s protection.`, cost };
  }

  reactionDelay(bot, command) {
    const role = bot.role || "rival";
    const base =
      role === "guardian" || command === "defend" || command === "help" || command === "protect"
        ? 0.4
        : role === "attacker" || command === "attack" || command === "push"
          ? 0.65
          : role === "scout" || command === "objective"
            ? 0.8
            : 1.1;
    return base + Math.random() * 1.6;
  }

  update(game) {
    const now = game.now();
    this.commands = this.commands.filter((command) => command.expiresAt > now);
    if (!this.active()) return;
    this.syncAlliances(game.players);
  }

  bestTeammate(teamId, humanId) {
    const members = (this.players || []).filter((player) => player.teamId === teamId && player.id !== humanId);
    if (!members.length) return null;
    return members
      .slice()
      .sort(
        (a, b) =>
          (b.stats?.tilesCaptured || 0) +
          (b.stats?.objectivesCaptured || 0) * 6 +
          (b.stats?.defenses || 0) * 2 -
          ((a.stats?.tilesCaptured || 0) + (a.stats?.objectivesCaptured || 0) * 6 + (a.stats?.defenses || 0) * 2),
      )[0];
  }

  territoryStats(players, playable) {
    if (!this.active()) return [];
    const byId = new Map(this.teams.map((team) => [team.id, { ...team, territory: 0, energy: 0, income: 0, members: 0, defeatedMembers: 0 }]));
    players.forEach((player) => {
      if (!player.teamId) return;
      if (!byId.has(player.teamId)) {
        byId.set(player.teamId, {
          id: player.teamId,
          name: player.teamName,
          color: player.teamColor,
          badge: player.teamBadge,
          territory: 0,
          energy: 0,
          income: 0,
          members: 0,
          defeatedMembers: 0,
        });
      }
      const team = byId.get(player.teamId);
      team.territory += player.territory || 0;
      team.energy += player.energy || 0;
      team.income += player.income || 0;
      team.members += 1;
      if (player.defeated) team.defeatedMembers += 1;
    });
    return [...byId.values()]
      .map((team) => ({
        ...team,
        territoryPct: playable ? team.territory / playable : 0,
        energy: Math.round(team.energy),
        income: Number(team.income.toFixed(1)),
      }))
      .sort((a, b) => b.territoryPct - a.territoryPct);
  }

  snapshot(game) {
    const playable = game.tileManager.playable().length || 1;
    return {
      mode: this.mode,
      active: this.active(),
      teams: this.territoryStats(game.players, playable),
      commands: this.commands
        .filter((command) => command.expiresAt > game.now())
        .map((command) => ({
          ...command,
          expiresIn: Math.max(0, Math.ceil(command.expiresAt - game.now())),
        })),
    };
  }
}

module.exports = TeamManager;
