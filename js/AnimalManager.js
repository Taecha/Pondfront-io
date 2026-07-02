import { ANIMALS } from "./config.js";

export class AnimalManager {
  get(animal) {
    return ANIMALS[animal];
  }

  getExpansionMultiplier(player, targetTile, sourceTile, reachInfo) {
    let multiplier = 1;

    if (player.animal === "duck") {
      if (targetTile.type === "water") multiplier *= 0.68;
      if (targetTile.type === "reeds") multiplier *= 1.28;
      if (player.activeAbility === "flockRush") multiplier *= 0.62;
    }

    if (player.animal === "snake") {
      if (targetTile.type === "water") multiplier *= 1.28;
      if (targetTile.type === "reeds" || targetTile.type === "mud") multiplier *= 0.78;
      if (player.flags.mudTunnel && (targetTile.type === "reeds" || targetTile.type === "mud")) {
        multiplier *= 0.72;
      }
    }

    if (player.animal === "frog") {
      if (targetTile.type === "lily") multiplier *= 0.8;
      if (reachInfo?.jumped) multiplier *= 1.08;
      if (player.activeAbility === "bigLeap") multiplier *= 0.55;
    }

    if (sourceTile?.type === "reeds" && player.animal === "snake" && player.activeAbility === "ambush") {
      multiplier *= 0.72;
    }

    return multiplier;
  }

  getAttackMultiplier(player, targetTile, sourceTile) {
    let multiplier = 1;

    if (player.animal === "snake" && sourceTile?.type === "reeds") {
      multiplier *= 1.2;
      if (player.activeAbility === "ambush") multiplier *= 1.35;
    }

    if (player.animal === "duck" && targetTile.type === "water" && player.activeAbility === "flockRush") {
      multiplier *= 1.12;
    }

    if (player.animal === "frog" && targetTile.type === "lily") {
      multiplier *= 1.1;
    }

    return multiplier;
  }

  getDefenseMultiplier(player, tile) {
    let multiplier = 1;

    if (player.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) {
      multiplier *= 1.2;
    }

    if (player.animal === "duck" && tile.type === "reeds") {
      multiplier *= 0.88;
    }

    if (player.animal === "frog" && tile.type === "water") {
      multiplier *= 0.88;
    }

    return multiplier;
  }

  getIncomeBonus(player, tile) {
    if (player.animal === "frog" && tile.type === "lily") return 0.22;
    return 0;
  }

  canUseBuilding(player, building) {
    return !building.animal || building.animal === player.animal;
  }

  abilityReady(player, now) {
    return now >= player.abilityReadyAt && !player.defeated;
  }
}
