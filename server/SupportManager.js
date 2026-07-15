const config = require("../shared/gameConfig");
const combatConfig = require("../shared/combatConfig");

const balance = config.BALANCE;

class SupportManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
  }

  send(game, actor, targetId, percent = 0.25) {
    const now = game.now();
    const target = game.getPlayer(targetId);
    if (!actor || actor.defeated) return { ok: false, message: "You are out of the pond." };
    if (!target || target.defeated || target.id === actor.id) return { ok: false, message: "Choose a valid ally to support." };
    if (!this.canSupport(game, actor, target)) return { ok: false, message: "Support can only go to allies or teammates." };
    if (now < (actor.supportReadyAt || 0)) {
      return { ok: false, message: `Support cooldown ${Math.ceil(actor.supportReadyAt - now)}s.` };
    }

    const sent = combatConfig.energyForPercent?.(actor.energy, percent)
      ?? Math.min(actor.energy, Math.max(0, Math.round(actor.energy * Math.max(0.1, Math.min(1, Number(percent) || 0.25)))));
    if (sent < (balance.supportMinEnergy || 6)) return { ok: false, message: "Not enough Animal Energy to send support." };

    const efficiency = balance.supportEfficiency || 0.75;
    const received = Math.min(target.maxEnergy - target.energy, sent * efficiency);
    if (received <= 0) return { ok: false, message: `${target.name} is already full on Animal Energy.` };

    actor.energy = Math.max(0, actor.energy - sent);
    target.energy = Math.min(target.maxEnergy, target.energy + received);
    actor.supportReadyAt = now + (balance.supportCooldownSeconds || 14);
    actor.stats.energyUsed = (actor.stats.energyUsed || 0) + sent;
    actor.stats.supportSent = (actor.stats.supportSent || 0) + sent;
    target.stats.supportReceived = (target.stats.supportReceived || 0) + received;

    this.pushEvent({
      kind: "supportSent",
      playerId: actor.id,
      targetId: target.id,
      amount: Math.round(sent),
      received: Math.round(received),
      efficiency,
      at: now,
      message: `${actor.name} sent ${Math.round(sent)} Animal Energy to ${target.name}.`,
    });

    return {
      ok: true,
      resultType: "support",
      sent: Math.round(sent),
      received: Math.round(received),
      cooldown: balance.supportCooldownSeconds || 14,
      message: `Sent ${Math.round(sent)} Animal Energy. ${target.name} received ${Math.round(received)}.`,
    };
  }

  canSupport(game, actor, target) {
    if (!actor || !target) return false;
    const sameTeam = Boolean(actor.teamId && target.teamId && actor.teamId === target.teamId);
    return sameTeam || game.diplomacy?.areAllied(actor.id, target.id);
  }
}

module.exports = SupportManager;
