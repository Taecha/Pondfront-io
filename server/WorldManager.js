const worldConfig = require("../shared/worldAtmosphereConfig");

class WorldManager {
  constructor(settings = {}, seed = 0, pushEvent = null) {
    this.state = worldConfig.createMatchWorld(settings, seed);
    this.pushEvent = pushEvent;
    this.lastPhaseId = null;
  }

  snapshot(game) {
    return worldConfig.snapshotFor({
      elapsed: game.elapsed(),
      serverTime: game.now(),
      world: this.state,
      lakeEvent: game.eventsManager?.snapshot(game.now()) || null,
    });
  }

  modifiers(game) {
    return this.snapshot(game).modifiers;
  }

  update(game, dt) {
    const snapshot = this.snapshot(game);
    if (this.lastPhaseId && this.lastPhaseId !== snapshot.phase.id) {
      this.pushEvent?.({
        kind: "worldPhase",
        phaseId: snapshot.phase.id,
        seasonId: snapshot.season.id,
        at: game.now(),
        message: `${snapshot.phase.label}: ${snapshot.phase.message}`,
      });
    }
    this.lastPhaseId = snapshot.phase.id;
    const modifiers = snapshot.modifiers;
    if (!modifiers.enabled) return;
    const now = game.now();
    if (modifiers.abilityRecovery > 0) {
      game.players.forEach((player) => {
        if ((player.abilityReadyAt || 0) > now) player.abilityReadyAt = Math.max(now, player.abilityReadyAt - dt * modifiers.abilityRecovery);
      });
    }
  }
}

module.exports = WorldManager;
