import { BUILDINGS, TILE_TYPES } from "./config.js";

export class BotManager {
  constructor(game) {
    this.game = game;
    this.timers = new Map();
  }

  reset() {
    this.timers.clear();
  }

  update(dt) {
    this.game.players.forEach((player) => {
      if (!player.isBot || player.defeated) return;
      const elapsed = (this.timers.get(player.id) ?? 0) + dt;
      const interval = this.getInterval(player);
      if (elapsed < interval) {
        this.timers.set(player.id, elapsed);
        return;
      }
      this.timers.set(player.id, 0);
      this.takeTurn(player);
    });
  }

  getInterval(player) {
    if (player.difficulty === "easy") return 1.65;
    if (player.difficulty === "smart") return 0.78;
    return 1.08;
  }

  takeTurn(player) {
    if (player.energy < 9) return;

    if (this.shouldUseAbility(player)) {
      this.game.combatManager.activateAbility(this.game, player);
    }

    if (this.shouldBuild(player)) {
      const built = this.tryBuild(player);
      if (built && player.difficulty !== "smart") return;
    }

    const target = this.pickTarget(player);
    if (!target) return;

    const send = player.difficulty === "easy" ? 0.25 : player.difficulty === "smart" ? 0.38 : 0.32;
    const selected = this.game.tileManager
      .getBorderTiles(player.id)
      .filter((tile) => tile.neighbors.includes(target))
      .map((tile) => tile.id);

    this.game.combatManager.expandOrAttack(this.game, player, target, send, selected);
  }

  shouldUseAbility(player) {
    if (this.game.time < player.abilityReadyAt) return false;
    if (player.energy < player.maxEnergy * 0.32) return false;
    return Math.random() < (player.difficulty === "smart" ? 0.38 : 0.18);
  }

  shouldBuild(player) {
    const ratio = player.energy / Math.max(1, player.maxEnergy);
    if (ratio < 0.42) return false;
    if (player.difficulty === "easy") return Math.random() < 0.18;
    if (player.difficulty === "smart") return Math.random() < 0.46;
    return Math.random() < 0.28;
  }

  tryBuild(player) {
    const owned = this.game.tileManager.getOwnedTiles(player.id).filter((tile) => !tile.building);
    const order = this.getBuildOrder(player);

    for (const buildingType of order) {
      const cfg = BUILDINGS[buildingType];
      const candidates = owned
        .filter((tile) => cfg.validTiles.includes(tile.type))
        .sort((a, b) => this.tileBuildScore(player, buildingType, b) - this.tileBuildScore(player, buildingType, a));
      const tile = candidates[0];
      if (tile && this.game.economyManager.build(player, tile, buildingType)) return true;
    }

    return false;
  }

  getBuildOrder(player) {
    const common = ["lilyFarm", "reedGuard"];
    if (player.animal === "duck") return ["duckNest", ...common];
    if (player.animal === "snake") return ["mudTunnel", ...common];
    if (player.animal === "frog") return ["jumpPad", ...common];
    return common;
  }

  tileBuildScore(player, buildingType, tile) {
    let score = tile.incomeBonus * 10 + tile.defenseBonus;
    if (buildingType === "reedGuard" && this.game.tileManager.isBorderTile(tile, player.id)) score += 12;
    if (buildingType === "lilyFarm" && tile.type === "lily") score += 12;
    if (buildingType === "duckNest" && tile.type === "nest") score += 10;
    if (buildingType === "mudTunnel" && tile.type === "mud") score += 8;
    if (buildingType === "jumpPad" && tile.type === "lily") score += 8;
    return score;
  }

  pickTarget(player) {
    const options = this.game.tileManager.getCapturableNeighbors(player.id);
    if (!options.length) return null;

    if (player.difficulty === "easy") {
      return options[Math.floor(Math.random() * options.length)];
    }

    const scored = options
      .filter((tile) => {
        const targetOwner = this.game.getPlayer(tile.owner);
        return !targetOwner || !this.game.areAllied(player.id, targetOwner.id);
      })
      .map((tile) => ({ tile, score: this.scoreTarget(player, tile) }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.tile ?? null;
  }

  scoreTarget(player, tile) {
    let score = 4 + tile.incomeBonus * 20 - TILE_TYPES[tile.type].captureCost * 0.12;
    if (tile.type === "water" && player.animal === "duck") score += 5;
    if ((tile.type === "reeds" || tile.type === "mud") && player.animal === "snake") score += 5;
    if (tile.type === "lily" && player.animal === "frog") score += 6;
    if (tile.type === "critter") score += 7;
    if (tile.owner && tile.owner !== player.id) {
      const targetOwner = this.game.getPlayer(tile.owner);
      if (targetOwner && targetOwner.energy < player.energy * 0.8) score += 10;
      if (this.game.areAllied(player.id, tile.owner)) score -= 999;
      score += player.difficulty === "smart" ? 4 : 1;
    }
    return score + Math.random() * 3;
  }
}
