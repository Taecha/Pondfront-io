class MissionManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
    this.state = new Map();
    this.definitions = [
      { id: "capture20", label: "Capture 20 tiles", target: 20, rewardXp: 14, rewardEnergy: 10 },
      { id: "firstNest", label: "Build any structure", target: 1, rewardXp: 10, rewardEnergy: 8 },
      { id: "useAbility", label: "Use your ability", target: 1, rewardXp: 10, rewardEnergy: 8 },
      { id: "captureObjective", label: "Capture an objective", target: 1, rewardXp: 18, rewardEnergy: 14 },
      { id: "defendBorder", label: "Defend a border", target: 1, rewardXp: 10, rewardEnergy: 8 },
      { id: "reach10", label: "Reach 10% territory", target: 0.1, rewardXp: 16, rewardEnergy: 12 },
      { id: "winWar", label: "Win a border war", target: 6, rewardXp: 16, rewardEnergy: 12 },
    ];
  }

  setup(players) {
    this.state.clear();
    players.forEach((player) => {
      this.state.set(player.id, Object.fromEntries(this.definitions.map((mission) => [mission.id, { done: false, progress: 0 }])));
    });
  }

  handleEvent(game, event) {
    if (game.matchSettings?.sandbox?.enabled) return;
    if (!event?.playerId) return;
    this.updatePlayer(game, game.getPlayer(event.playerId));
  }

  update(game) {
    if (game.matchSettings?.sandbox?.enabled) return;
    game.players.forEach((player) => this.updatePlayer(game, player));
  }

  updatePlayer(game, player) {
    if (game.matchSettings?.sandbox?.enabled) return;
    if (!player || player.defeated) return;
    const state = this.state.get(player.id);
    if (!state) return;
    const values = this.progressValues(game, player);
    this.definitions.forEach((mission) => {
      const entry = state[mission.id];
      if (!entry || entry.done) return;
      entry.progress = values[mission.id] || 0;
      if (entry.progress >= mission.target) this.complete(game, player, mission, entry);
    });
  }

  progressValues(game, player) {
    return {
      capture20: player.stats.tilesCaptured || 0,
      firstNest: player.stats.buildingsBuilt || 0,
      useAbility: player.stats.abilitiesUsed || 0,
      captureObjective: player.stats.objectivesCaptured || 0,
      defendBorder: player.stats.defenses || 0,
      reach10: game.territoryPercent(player),
      winWar: player.stats.bestAttackWave || 0,
    };
  }

  complete(game, player, mission, entry) {
    entry.done = true;
    entry.progress = mission.target;
    player.energy = Math.min(player.maxEnergy, player.energy + mission.rewardEnergy);
    game.progression?.award(game, player, mission.rewardXp, "mission");
    this.pushEvent({
      kind: "missionComplete",
      playerId: player.id,
      missionId: mission.id,
      message: `${mission.label} complete.`,
      at: game.now(),
    });
  }

  snapshot(playerId) {
    const state = this.state.get(playerId) || {};
    return this.definitions.map((mission) => ({
      ...mission,
      progress: state[mission.id]?.progress || 0,
      done: Boolean(state[mission.id]?.done),
    }));
  }
}

module.exports = MissionManager;
