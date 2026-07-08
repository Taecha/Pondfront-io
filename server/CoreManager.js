const config = require("../shared/gameConfig");

const balance = config.BALANCE;

class CoreManager {
  constructor(tileManager, pushEvent) {
    this.tileManager = tileManager;
    this.pushEvent = pushEvent;
  }

  setup(players, now = Date.now() / 1000) {
    this.tileManager.tiles.forEach((tile) => {
      tile.isCore = false;
      tile.coreOwnerId = null;
      tile.coreHealth = 0;
      tile.coreMaxHealth = 0;
    });
    players.forEach((player) => {
      const core = this.tileManager.getById(player.coreTileId);
      if (!core) return;
      core.type = "nest";
      core.isCore = true;
      core.coreOwnerId = player.id;
      core.coreMaxHealth = balance.coreHealth || 125;
      core.coreHealth = core.coreMaxHealth;
      core.defenseEnergy = Math.max(core.defenseEnergy || 0, balance.coreDefenseEnergy || 42);
      core.lastChanged = now;
      player.coreHealth = core.coreHealth;
      player.coreMaxHealth = core.coreMaxHealth;
      player.coreLost = false;
      player.flags = player.flags || {};
      delete player.flags.coreLostAt;
      delete player.flags.coreLost;
      delete player.flags.coreLostNotified;
    });
  }

  update(game) {
    const now = game.now();
    game.players.forEach((player) => {
      const core = this.tileManager.getById(player.coreTileId);
      if (!core) return;
      player.coreHealth = Math.round(core.coreHealth || 0);
      player.coreMaxHealth = Math.round(core.coreMaxHealth || balance.coreHealth || 125);
      player.coreLost = core.owner !== player.id;
      if (core.owner === player.id && !player.defeated) {
        core.coreHealth = Math.min(core.coreMaxHealth || balance.coreHealth || 125, (core.coreHealth || 0) + 0.03);
        if (player.flags) {
          delete player.flags.coreLostAt;
          player.flags.coreLost = false;
        }
      } else if (!player.defeated) {
        player.flags = player.flags || {};
        player.flags.coreLostAt = player.flags.coreLostAt || now;
        player.flags.coreLost = true;
        if (!player.flags.coreLostNotified) {
          player.flags.coreLostNotified = true;
          this.pushEvent({
            kind: "coreLost",
            playerId: player.id,
            targetOwner: player.id,
            to: core.id,
            at: now,
            message: `${player.name}'s Core Nest is gone, but they stay alive while they hold territory.`,
          });
        }
      }
      if (now > (player.flags?.coreUnderAttackUntil || 0) && player.flags) player.flags.coreUnderAttack = false;
    });
  }

  applyEconomy(player) {
    const core = this.tileManager.getById(player.coreTileId);
    if (!core || core.owner !== player.id) {
      player.maxEnergy *= balance.coreLostMaxEnergyPenalty || 0.78;
      player.incomeBreakdown.temporary -= Math.max(0, player.incomeBreakdown.base * (1 - (balance.coreLostIncomePenalty || 0.72)));
      return;
    }
    player.maxEnergy += balance.coreMaxEnergyBonus || 34;
    player.incomeBreakdown.base += balance.coreIncomeBonus || 0.75;
  }

  defenseBonus(defender, tile, now = Date.now() / 1000) {
    const core = this.tileManager.getById(defender?.coreTileId);
    if (!core || core.owner !== defender.id || !tile) return 0;
    const distance = Math.abs(core.x - tile.x) + Math.abs(core.y - tile.y);
    if (distance > (balance.coreDefenseAuraRange || 3)) return 0;
    const lastStand = now < (defender.flags?.lastStandUntil || 0) ? balance.coreLastStandDefenseBonus || 18 : 0;
    const playable = this.tileManager.playable().length || 1;
    const comeback = defender.territory > 0 && defender.territory / playable < (balance.comebackTerritoryPct || 0.08) ? balance.comebackCoreDefenseBonus || 5 : 0;
    return (balance.coreDefenseAuraBonus || 8) + lastStand + comeback;
  }

  handleCoreHit(game, wave, attacker, defender, candidate, cost) {
    const tile = candidate.tile;
    if (!tile?.isCore || tile.coreOwnerId !== defender.id || tile.owner !== defender.id) return { blocked: false };

    const now = game.now();
    const damage = Math.max(8, Math.min(cost, wave.remainingPower) * 0.82);
    tile.coreHealth = Math.max(0, (tile.coreHealth || balance.coreHealth || 125) - damage);
    tile.defenseEnergy = Math.min(120, (tile.defenseEnergy || 0) + 8);
    wave.remainingPower = Math.max(0, wave.remainingPower - damage * 0.62);
    defender.flags = defender.flags || {};
    defender.flags.coreUnderAttack = true;
    defender.flags.coreUnderAttackUntil = now + 12;
    game.triggerLastStand?.(defender, "core under attack");
    defender.flags.lastAttackerId = attacker.id;
    defender.flags.underAttackUntil = Math.max(defender.flags.underAttackUntil || 0, now + 24);

    this.pushEvent({
      kind: "coreUnderAttack",
      playerId: defender.id,
      targetOwner: defender.id,
      attackerId: attacker.id,
      to: tile.id,
      coreHealth: Math.round(tile.coreHealth),
      coreMaxHealth: Math.round(tile.coreMaxHealth || balance.coreHealth || 125),
      amount: Math.round(damage),
      at: now,
      message: `${defender.name}'s Core Nest is under attack!`,
    });

    if (tile.coreHealth > 0) return { blocked: true, reason: "Core Nest resisted the attack." };
    return { blocked: false, coreBroken: true };
  }

  handleCoreCaptured(game, attacker, defender, tile) {
    if (!tile?.isCore || tile.coreOwnerId !== defender.id) return;
    const now = game.now();
    const behavior = game.matchSettings?.coreCaptureBehavior || "transfer";
    defender.flags = defender.flags || {};
    defender.flags.coreLost = true;
    defender.flags.coreLostAt = now;
    defender.coreLost = true;
    defender.coreHealth = 0;
    tile.coreHealth = 0;
    if (behavior === "neutralize") {
      tile.owner = null;
      tile.defenseEnergy = Math.max(0, (tile.defenseEnergy || 0) * 0.35);
    }
    this.pushEvent({
      kind: "coreCaptured",
      playerId: attacker.id,
      targetOwner: defender.id,
      to: tile.id,
      coreCaptureBehavior: behavior,
      at: now,
      message: `Core Nest captured! ${attacker.name} took ${defender.name}'s Core Nest.`,
    });
    if (behavior === "eliminate") game.eliminatePlayer?.(defender, attacker, "core captured");
  }
}

module.exports = CoreManager;
