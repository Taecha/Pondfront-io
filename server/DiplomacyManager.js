const diplomacyConfig = require("../shared/diplomacyConfig");

const { timing, states, pingTypes } = diplomacyConfig;

class DiplomacyManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
    this.relations = new Map();
    this.cooldowns = new Map();
  }

  attach(players) {
    this.players = players;
  }

  update(game) {
    const now = game.now();
    this.relations.forEach((relation) => this.cleanup(relation, now));
  }

  player(id) {
    return this.players?.find((player) => player.id === id) || null;
  }

  key(a, b) {
    return [a, b].sort().join(":");
  }

  entry(a, b) {
    const key = this.key(a, b);
    if (!this.relations.has(key)) {
      this.relations.set(key, {
        id: key,
        players: key.split(":"),
        state: "neutral",
        requestedBy: null,
        requestType: null,
        requestExpiresAt: 0,
        truceUntil: 0,
        betrayalUntil: 0,
        betrayedBy: null,
        warUntil: 0,
        lastAttackAt: 0,
        attacksSent: 0,
        tilesCaptured: 0,
        damage: 0,
        energySpent: 0,
        biggestWave: 0,
        betrayedCount: {},
        rejectedAt: 0,
      });
    }
    return this.relations.get(key);
  }

  peek(a, b) {
    return this.relations.get(this.key(a, b)) || null;
  }

  cleanup(relation, now) {
    if (!relation) return relation;
    if (relation.requestExpiresAt && now >= relation.requestExpiresAt) {
      relation.requestedBy = null;
      relation.requestType = null;
      relation.requestExpiresAt = 0;
    }
    if (relation.truceUntil && now >= relation.truceUntil) relation.truceUntil = 0;
    if (relation.betrayalUntil && now >= relation.betrayalUntil) {
      relation.betrayalUntil = 0;
      relation.betrayedBy = null;
    }
    if (relation.warUntil && now >= relation.warUntil) relation.warUntil = 0;
    if (!relation.requestedBy && !relation.truceUntil && !relation.betrayalUntil && !relation.warUntil && relation.state !== "markedEnemy") {
      relation.state = "neutral";
    }
    return relation;
  }

  areAllied(a, b) {
    return Boolean(a && b && a !== b && this.player(a)?.allies?.has(b));
  }

  canAttack(attackerId, targetId, now = Date.now() / 1000) {
    if (!attackerId || !targetId || attackerId === targetId) return { ok: false, reason: "No combat target." };
    const relation = this.cleanup(this.peek(attackerId, targetId), now);
    if (this.areAllied(attackerId, targetId)) return { ok: false, reason: "Cannot attack ally." };
    if (relation?.truceUntil > now) return { ok: false, reason: `Truce active for ${Math.ceil(relation.truceUntil - now)}s.` };
    if (relation?.betrayalUntil > now && relation.betrayedBy === attackerId) {
      return { ok: false, reason: `Betrayal cooldown active for ${Math.ceil(relation.betrayalUntil - now)}s.` };
    }
    return { ok: true, reason: "" };
  }

  blocksAttack(attackerId, targetId, now = Date.now() / 1000) {
    return !this.canAttack(attackerId, targetId, now).ok;
  }

  handle(game, actor, targetId, command) {
    const target = game.getPlayer(targetId);
    if (!actor || !target || actor.id === target.id) return { ok: false, message: "No diplomacy target." };

    const now = game.now();
    const normalized = this.normalizeCommand(command);
    const relation = this.cleanup(this.entry(actor.id, target.id), now);

    if (["requestAlliance", "offerTruce"].includes(normalized) && this.isCoolingDown(actor.id, target.id, normalized, now)) {
      return { ok: false, message: "Diplomacy request cooldown active." };
    }

    if (normalized === "requestAlliance") return this.requestAlliance(game, actor, target, relation, now);
    if (normalized === "acceptAlliance") return this.acceptRequest(game, actor, target, relation, now, "alliance");
    if (normalized === "rejectAlliance") return this.rejectRequest(game, actor, target, relation, now);
    if (normalized === "breakAlliance") return this.breakAlliance(game, actor, target, relation, now);
    if (normalized === "offerTruce") return this.offerTruce(game, actor, target, relation, now);
    if (normalized === "acceptTruce") return this.acceptRequest(game, actor, target, relation, now, "truce");
    if (normalized === "declareWar") return this.declareWar(game, actor, target, relation, now);
    if (normalized === "markEnemy") return this.markEnemy(game, actor, target, relation, now);
    if (normalized === "pingAlly" || normalized === "requestHelp" || normalized === "sendWarning" || normalized === "signal") {
      return this.sendSignal(game, actor, target, normalized, now);
    }

    return { ok: false, message: "Unknown diplomacy command." };
  }

  normalizeCommand(command) {
    if (command === "sendPeace") return "offerTruce";
    return command || "";
  }

  requestAlliance(game, actor, target, relation, now) {
    if (this.areAllied(actor.id, target.id)) return { ok: true, message: `Already allied with ${target.name}.` };
    if (relation.truceUntil > now) return { ok: false, message: "Truce active. Wait before changing diplomacy." };
    if (relation.betrayalUntil > now && relation.betrayedBy === actor.id) {
      return { ok: false, message: "Betrayal cooldown active." };
    }
    if (relation.requestedBy && relation.requestType === "alliance") {
      if (relation.requestedBy !== actor.id) return this.acceptRequest(game, actor, target, relation, now, "alliance");
      return { ok: true, message: `Alliance request already sent to ${target.name}.` };
    }

    this.setCooldown(actor.id, target.id, "requestAlliance", now, timing.requestSpamSeconds);
    if (target.isBot) {
      if (this.botAcceptsAlliance(actor, target, relation, game)) return this.formAlliance(game, actor, target, relation, now, "accepted");
      relation.rejectedAt = now;
      this.pushEvent({ kind: "diplomacy", subtype: "rejected", playerId: actor.id, targetId: target.id, at: now });
      return { ok: false, message: `${target.name} rejected the alliance.` };
    }

    relation.state = "requested";
    relation.requestedBy = actor.id;
    relation.requestType = "alliance";
    relation.requestExpiresAt = now + timing.allianceRequestSeconds;
    this.pushEvent({ kind: "diplomacy", subtype: "requested", playerId: actor.id, targetId: target.id, expiresAt: relation.requestExpiresAt, at: now });
    return { ok: true, message: `Alliance request sent to ${target.name}.` };
  }

  acceptRequest(game, actor, target, relation, now, type) {
    if (!relation.requestedBy || relation.requestedBy === actor.id || relation.requestType !== type || relation.requestExpiresAt <= now) {
      return { ok: false, message: type === "truce" ? "No truce offer to accept." : "No alliance request to accept." };
    }
    if (type === "truce") return this.activateTruce(game, actor, target, relation, now, "accepted");
    return this.formAlliance(game, actor, target, relation, now, "accepted");
  }

  rejectRequest(game, actor, target, relation, now) {
    if (!relation.requestedBy || relation.requestedBy === actor.id || relation.requestExpiresAt <= now) {
      return { ok: false, message: "No pending request to reject." };
    }
    relation.rejectedAt = now;
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    if (relation.state === "requested") relation.state = relation.warUntil > now ? "war" : "neutral";
    this.pushEvent({ kind: "diplomacy", subtype: "rejected", playerId: actor.id, targetId: target.id, at: now });
    return { ok: true, message: `Alliance rejected with ${target.name}.` };
  }

  formAlliance(game, actor, target, relation, now, subtype = "alliance") {
    actor.allies.add(target.id);
    target.allies.add(actor.id);
    actor.enemies.delete(target.id);
    target.enemies.delete(actor.id);
    relation.state = "allied";
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    relation.truceUntil = 0;
    relation.warUntil = 0;
    this.pushEvent({ kind: "diplomacy", subtype: subtype === "accepted" ? "allianceAccepted" : "alliance", playerId: actor.id, targetId: target.id, at: now });
    return { ok: true, message: `Alliance accepted with ${target.name}.` };
  }

  breakAlliance(game, actor, target, relation, now) {
    if (!this.areAllied(actor.id, target.id)) return { ok: false, message: "No alliance to break." };
    actor.allies.delete(target.id);
    target.allies.delete(actor.id);
    relation.state = "betrayal";
    relation.betrayedBy = actor.id;
    relation.betrayalUntil = now + timing.betrayalCooldownSeconds;
    relation.betrayedCount[actor.id] = (relation.betrayedCount[actor.id] || 0) + 1;
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    this.pushEvent({ kind: "diplomacy", subtype: "broken", playerId: actor.id, targetId: target.id, betrayalUntil: relation.betrayalUntil, at: now });
    return { ok: true, message: `Alliance broken with ${target.name}. Betrayal cooldown active.` };
  }

  offerTruce(game, actor, target, relation, now) {
    if (this.areAllied(actor.id, target.id)) return { ok: false, message: "Allies do not need a truce." };
    if (relation.truceUntil > now) return { ok: true, message: `Truce already active with ${target.name}.` };
    this.setCooldown(actor.id, target.id, "offerTruce", now, timing.requestSpamSeconds);

    if (target.isBot) {
      if (this.botAcceptsTruce(actor, target, relation, game)) return this.activateTruce(game, actor, target, relation, now, "accepted");
      this.pushEvent({ kind: "diplomacy", subtype: "truceRejected", playerId: actor.id, targetId: target.id, at: now });
      return { ok: false, message: `${target.name} refused the truce.` };
    }

    relation.state = "requested";
    relation.requestedBy = actor.id;
    relation.requestType = "truce";
    relation.requestExpiresAt = now + timing.allianceRequestSeconds;
    this.pushEvent({ kind: "diplomacy", subtype: "truceRequested", playerId: actor.id, targetId: target.id, expiresAt: relation.requestExpiresAt, at: now });
    return { ok: true, message: `Truce offered to ${target.name}.` };
  }

  activateTruce(game, actor, target, relation, now) {
    actor.allies.delete(target.id);
    target.allies.delete(actor.id);
    actor.enemies.delete(target.id);
    target.enemies.delete(actor.id);
    relation.state = "truce";
    relation.truceUntil = now + timing.truceSeconds;
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    relation.warUntil = 0;
    this.pushEvent({ kind: "diplomacy", subtype: "truce", playerId: actor.id, targetId: target.id, truceUntil: relation.truceUntil, at: now });
    return { ok: true, message: `Truce active with ${target.name}.` };
  }

  declareWar(game, actor, target, relation, now) {
    const wasAllied = this.areAllied(actor.id, target.id);
    actor.allies.delete(target.id);
    target.allies.delete(actor.id);
    actor.enemies.add(target.id);
    target.enemies.add(actor.id);
    relation.state = wasAllied ? "betrayal" : "war";
    relation.warUntil = now + timing.warMemorySeconds;
    relation.truceUntil = 0;
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    if (wasAllied) {
      relation.betrayedBy = actor.id;
      relation.betrayalUntil = now + timing.betrayalCooldownSeconds;
      relation.betrayedCount[actor.id] = (relation.betrayedCount[actor.id] || 0) + 1;
    }
    this.pushEvent({ kind: "diplomacy", subtype: "war", playerId: actor.id, targetId: target.id, warUntil: relation.warUntil, at: now });
    return {
      ok: true,
      message: wasAllied ? `War declared on ${target.name}. Betrayal cooldown active.` : `War declared on ${target.name}.`,
    };
  }

  markEnemy(game, actor, target, relation, now) {
    actor.allies.delete(target.id);
    target.allies.delete(actor.id);
    actor.enemies.add(target.id);
    relation.state = "markedEnemy";
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    this.pushEvent({ kind: "diplomacy", subtype: "enemy", playerId: actor.id, targetId: target.id, at: now });
    return { ok: true, message: `${target.name} marked as enemy.` };
  }

  sendSignal(game, actor, target, command, now) {
    const type = command === "requestHelp" ? "help" : command === "sendWarning" ? "warning" : command === "pingAlly" ? "good" : "warning";
    const allowed = type === "warning" || this.areAllied(actor.id, target.id);
    if (!allowed) return { ok: false, message: "Ally pings require an alliance." };
    const cooldownKey = `${actor.id}:${type}`;
    const until = this.cooldowns.get(cooldownKey) || 0;
    if (now < until) return { ok: false, message: "Ping cooldown active." };
    this.cooldowns.set(cooldownKey, now + timing.pingCooldownSeconds);
    const ping = pingTypes[type] || pingTypes.warning;
    this.pushEvent({
      kind: "ping",
      pingType: type,
      playerId: actor.id,
      targetId: target.id,
      to: target.coreTileId,
      visibility: ping.visibility,
      at: now,
    });
    return { ok: true, message: `${ping.label} signal sent to ${target.name}.` };
  }

  recordAttack(attackerId, defenderId, data = {}, now = Date.now() / 1000) {
    const relation = this.entry(attackerId, defenderId);
    relation.state = "war";
    relation.warUntil = now + timing.warMemorySeconds;
    relation.truceUntil = 0;
    relation.requestedBy = null;
    relation.requestType = null;
    relation.requestExpiresAt = 0;
    relation.lastAttackAt = now;
    relation.attacksSent += data.attack ? 1 : 0;
    relation.tilesCaptured += data.tilesCaptured || 0;
    relation.damage += data.damage || 0;
    relation.energySpent += data.energySpent || data.damage || 0;
    relation.biggestWave = Math.max(relation.biggestWave || 0, data.biggestWave || data.tilesCaptured || 0);
  }

  snapshot(viewerId, now = Date.now() / 1000) {
    return (this.players || [])
      .filter((player) => player.id !== viewerId)
      .map((player) => this.relationship(viewerId, player.id, now));
  }

  relationship(actorId, targetId, now = Date.now() / 1000) {
    const actor = this.player(actorId);
    const target = this.player(targetId);
    const relation = this.cleanup(this.peek(actorId, targetId), now);
    const canAttack = this.canAttack(actorId, targetId, now);
    const allied = this.areAllied(actorId, targetId);
    const markedEnemy = Boolean(actor?.enemies?.has(targetId));
    const activeState = this.stateFor(actorId, targetId, relation, allied, markedEnemy, now);
    const definition = states[activeState] || states.neutral;
    return {
      playerId: targetId,
      targetName: target?.name || "Player",
      state: activeState,
      label: definition.label,
      icon: definition.icon,
      color: definition.color,
      allied,
      markedEnemy,
      canAttack: canAttack.ok,
      blockReason: canAttack.reason,
      requestedBy: relation?.requestedBy || null,
      requestType: relation?.requestType || null,
      pendingForViewer: Boolean(relation?.requestedBy && relation.requestedBy !== actorId && relation.requestExpiresAt > now),
      requestExpiresIn: Math.max(0, Math.ceil((relation?.requestExpiresAt || 0) - now)),
      truceLeft: Math.max(0, Math.ceil((relation?.truceUntil || 0) - now)),
      betrayalLeft: Math.max(0, Math.ceil((relation?.betrayalUntil || 0) - now)),
      betrayalByViewer: relation?.betrayedBy === actorId && (relation?.betrayalUntil || 0) > now,
      warLeft: Math.max(0, Math.ceil((relation?.warUntil || 0) - now)),
      attacks: relation?.attacksSent || 0,
      tilesCaptured: relation?.tilesCaptured || 0,
      damage: Math.round(relation?.damage || 0),
      energySpent: Math.round(relation?.energySpent || 0),
      biggestWave: relation?.biggestWave || 0,
      lastAttackAgo: relation?.lastAttackAt ? Math.max(0, Math.round(now - relation.lastAttackAt)) : null,
      betrayedCount: relation?.betrayedCount?.[targetId] || 0,
    };
  }

  stateFor(actorId, targetId, relation, allied, markedEnemy, now) {
    if (allied) return "allied";
    if (relation?.truceUntil > now) return "truce";
    if (relation?.requestExpiresAt > now && relation.requestedBy) return "requested";
    if (relation?.betrayalUntil > now) return "betrayal";
    if (relation?.warUntil > now) return "war";
    if (markedEnemy || relation?.state === "markedEnemy") return "markedEnemy";
    return "neutral";
  }

  isCoolingDown(actorId, targetId, command, now) {
    return now < (this.cooldowns.get(`${actorId}:${targetId}:${command}`) || 0);
  }

  setCooldown(actorId, targetId, command, now, seconds) {
    this.cooldowns.set(`${actorId}:${targetId}:${command}`, now + seconds);
  }

  botAcceptsAlliance(actor, bot, relation, game) {
    const actorShare = game.territoryPercent(actor);
    const botShare = game.territoryPercent(bot);
    const betrayedByActor = relation.betrayedCount?.[actor.id] || 0;
    if (betrayedByActor > 0 && Math.random() < 0.75) return false;
    if (actorShare > 0.46 && botShare < actorShare * 0.8) return Math.random() < 0.15;
    const commonEnemy = [...actor.enemies].some((id) => bot.enemies.has(id));
    let chance = 0.42;
    if (bot.personality === "peaceful" || bot.personality === "loyalAlly") chance += 0.28;
    if (bot.personality === "aggressive" || bot.personality === "betrayer") chance -= 0.18;
    if (commonEnemy) chance += 0.18;
    if (actorShare < botShare * 0.7) chance += 0.08;
    return Math.random() < Math.max(0.08, Math.min(0.86, chance));
  }

  botAcceptsTruce(actor, bot, relation, game) {
    const actorShare = game.territoryPercent(actor);
    const botShare = game.territoryPercent(bot);
    let chance = bot.energy < actor.energy || botShare < actorShare ? 0.65 : 0.32;
    if (bot.personality === "peaceful" || bot.personality === "defensive" || bot.personality === "farmer") chance += 0.18;
    if (bot.personality === "aggressive" || bot.personality === "leaderHunter") chance -= 0.18;
    if ((relation.attacksSent || 0) > 3 && relation.lastAttackAt && game.now() - relation.lastAttackAt < 30) chance -= 0.12;
    return Math.random() < Math.max(0.08, Math.min(0.82, chance));
  }
}

module.exports = DiplomacyManager;
