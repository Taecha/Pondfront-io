class DiplomacyManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
  }

  areAllied(a, b) {
    return Boolean(a && b && a !== b && this.player(a)?.allies?.has(b));
  }

  attach(players) {
    this.players = players;
  }

  player(id) {
    return this.players?.find((player) => player.id === id) || null;
  }

  handle(game, actor, targetId, command) {
    const target = game.getPlayer(targetId);
    if (!actor || !target || actor.id === target.id) return { ok: false, message: "No diplomacy target." };

    if (command === "requestAlliance" || command === "sendPeace") {
      const accept = !target.isBot || this.botAccepts(actor, target, game);
      if (accept) {
        actor.allies.add(target.id);
        target.allies.add(actor.id);
        actor.enemies.delete(target.id);
        target.enemies.delete(actor.id);
        this.pushEvent({ kind: "diplomacy", subtype: "alliance", playerId: actor.id, targetId: target.id, at: game.now() });
        return { ok: true, message: `Alliance formed with ${target.name}.` };
      }
      this.pushEvent({ kind: "diplomacy", subtype: "declined", playerId: actor.id, targetId: target.id, at: game.now() });
      return { ok: false, message: `${target.name} declined for now.` };
    }

    if (command === "breakAlliance") {
      actor.allies.delete(target.id);
      target.allies.delete(actor.id);
      this.pushEvent({ kind: "diplomacy", subtype: "broken", playerId: actor.id, targetId: target.id, at: game.now() });
      return { ok: true, message: `Alliance broken with ${target.name}.` };
    }

    if (command === "markEnemy") {
      actor.allies.delete(target.id);
      target.allies.delete(actor.id);
      actor.enemies.add(target.id);
      this.pushEvent({ kind: "diplomacy", subtype: "enemy", playerId: actor.id, targetId: target.id, at: game.now() });
      return { ok: true, message: `${target.name} marked as enemy.` };
    }

    if (command === "signal") {
      this.pushEvent({ kind: "signal", playerId: actor.id, targetId: target.id, at: game.now() });
      return { ok: true, message: `Signal sent to ${target.name}.` };
    }

    return { ok: false, message: "Unknown diplomacy command." };
  }

  botAccepts(actor, target, game) {
    const actorShare = game.territoryPercent(actor);
    const targetShare = game.territoryPercent(target);
    if (actorShare > 0.42) return Math.random() < 0.18;
    if (targetShare > actorShare * 1.5) return Math.random() < 0.72;
    return Math.random() < 0.45;
  }
}

module.exports = DiplomacyManager;
