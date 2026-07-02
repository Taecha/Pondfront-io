import { BUILDINGS, TILE_TYPES } from "./config.js";

export class CombatManager {
  constructor(tileManager, animalManager) {
    this.tileManager = tileManager;
    this.animalManager = animalManager;
  }

  expandOrAttack(game, player, targetTile, sendPercent, selectedTiles = []) {
    if (!targetTile || player.defeated) return { ok: false, reason: "No target" };
    if (TILE_TYPES[targetTile.type].blocks) return { ok: false, reason: "Rocks block movement" };
    if (targetTile.owner === player.id) return this.reinforce(player, targetTile, sendPercent);

    const targetOwner = game.getPlayer(targetTile.owner);
    if (targetOwner && game.areAllied(player.id, targetOwner.id)) {
      return { ok: false, reason: "Alliance border" };
    }

    const reachInfo = this.tileManager.getReachInfo(player, targetTile, selectedTiles);
    if (!reachInfo.reachable) return { ok: false, reason: "Out of border range" };

    const spend = Math.max(4, player.energy * sendPercent);
    if (player.energy < spend) return { ok: false, reason: "Low energy" };

    const captureCost = this.getCaptureCost(game, player, targetTile, reachInfo, selectedTiles);
    const attackPower =
      spend *
      this.animalManager.getAttackMultiplier(player, targetTile, reachInfo.source) *
      this.selectionPressure(selectedTiles);

    player.energy -= spend;

    if (attackPower >= captureCost) {
      if (targetOwner) {
        targetOwner.energy = Math.max(0, targetOwner.energy - spend * 0.28);
      }
      targetTile.owner = player.id;
      targetTile.building = null;
      targetTile.reinforcement = Math.max(0, attackPower - captureCost) * 0.12;
      targetTile.captureFlash = 1;
      targetTile.borderHiddenUntil = 0;
      return {
        ok: true,
        captured: true,
        jumped: reachInfo.jumped,
        reason: targetOwner ? "Captured enemy border" : "Captured neutral tile",
      };
    }

    targetTile.reinforcement = Math.max(0, targetTile.reinforcement - attackPower * 0.08);
    if (targetOwner) targetOwner.energy = Math.max(0, targetOwner.energy - spend * 0.12);

    return {
      ok: true,
      captured: false,
      reason: "Attack softened the border",
    };
  }

  reinforce(player, tile, sendPercent) {
    const spend = Math.max(3, player.energy * sendPercent * 0.6);
    if (player.energy < spend) return { ok: false, reason: "Low energy" };
    player.energy -= spend;
    tile.reinforcement = Math.min(36, tile.reinforcement + spend * 0.42);
    tile.captureFlash = 1;
    return { ok: true, captured: false, reason: "Border reinforced" };
  }

  getCaptureCost(game, player, targetTile, reachInfo, selectedTiles) {
    const targetOwner = game.getPlayer(targetTile.owner);
    const base = TILE_TYPES[targetTile.type].captureCost;
    let cost = base + targetTile.defenseBonus * 3.2 + targetTile.reinforcement;

    if (targetOwner) {
      const reserve = Math.min(targetOwner.energy * 0.12, 32);
      cost += 14 + reserve;
      cost *= this.animalManager.getDefenseMultiplier(targetOwner, targetTile);
    }

    cost += this.reedGuardBonus(targetTile, targetOwner?.id);
    cost *= this.animalManager.getExpansionMultiplier(player, targetTile, reachInfo.source, reachInfo);

    if (selectedTiles.length > 2) {
      cost *= Math.max(0.76, 1 - Math.min(selectedTiles.length, 8) * 0.025);
    }

    return Math.max(6, cost);
  }

  reedGuardBonus(tile, ownerId) {
    if (!ownerId) return 0;
    let bonus = 0;
    const nearby = [tile, ...tile.neighbors];
    nearby.forEach((neighbor) => {
      if (neighbor.owner === ownerId && neighbor.building === "reedGuard") bonus += 8;
    });
    return Math.min(24, bonus);
  }

  selectionPressure(selectedTiles) {
    if (!selectedTiles?.length) return 1;
    return 1 + Math.min(selectedTiles.length, 10) * 0.045;
  }

  activateAbility(game, player) {
    const now = game.time;
    const animal = this.animalManager.get(player.animal);
    if (!this.animalManager.abilityReady(player, now)) {
      return { ok: false, reason: "Ability cooling down" };
    }

    if (player.animal === "duck") {
      player.activeAbility = "flockRush";
      player.activeAbilityUntil = now + animal.abilityDuration;
      player.abilityReadyAt = now + animal.abilityCooldown;
      return { ok: true, reason: "Flock Rush" };
    }

    if (player.animal === "snake") {
      player.activeAbility = "ambush";
      player.activeAbilityUntil = now + animal.abilityDuration;
      player.abilityReadyAt = now + animal.abilityCooldown;
      this.tileManager.getBorderTiles(player.id).forEach((tile) => {
        tile.borderHiddenUntil = now + animal.abilityDuration;
      });
      return { ok: true, reason: "Camouflage" };
    }

    if (player.animal === "frog") {
      player.abilityReadyAt = now + animal.abilityCooldown;
      return this.bigLeap(game, player);
    }

    return { ok: false, reason: "No ability" };
  }

  bigLeap(game, player) {
    const border = this.tileManager.getBorderTiles(player.id);
    const options = [];
    border.forEach((source) => {
      for (let y = source.y - 3; y <= source.y + 3; y += 1) {
        for (let x = source.x - 3; x <= source.x + 3; x += 1) {
          const tile = this.tileManager.get(x, y);
          if (!tile || tile.owner === player.id || TILE_TYPES[tile.type].blocks) continue;
          const distance = Math.abs(source.x - x) + Math.abs(source.y - y);
          if (distance >= 2 && distance <= (player.flags.jumpPad ? 3 : 2)) options.push(tile);
        }
      }
    });

    const unique = [...new Map(options.map((tile) => [tile.id, tile])).values()];
    unique
      .sort((a, b) => this.tileScore(b) - this.tileScore(a))
      .slice(0, 4)
      .forEach((tile) => {
        const targetOwner = game.getPlayer(tile.owner);
        if (targetOwner && game.areAllied(player.id, targetOwner.id)) return;
        tile.owner = player.id;
        tile.building = null;
        tile.reinforcement = 2;
        tile.captureFlash = 1;
      });

    if (!unique.length) return { ok: false, reason: "No leap target" };
    player.activeAbility = "bigLeap";
    player.activeAbilityUntil = game.time + 0.8;
    return { ok: true, reason: "Big Leap captured a pocket" };
  }

  tileScore(tile) {
    let score = 1 + tile.incomeBonus * 12 + tile.defenseBonus;
    if (tile.type === "lily") score += 4;
    if (tile.type === "critter") score += 5;
    if (tile.building && BUILDINGS[tile.building]) score += 8;
    return score;
  }
}
