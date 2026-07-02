import { BUILDINGS, TILE_TYPES } from "./config.js";

export class EconomyManager {
  constructor(tileManager, animalManager) {
    this.tileManager = tileManager;
    this.animalManager = animalManager;
  }

  update(players, dt) {
    this.recalculate(players);

    players.forEach((player) => {
      if (player.defeated) return;
      player.energy = Math.min(player.maxEnergy, player.energy + player.income * dt);
    });
  }

  recalculate(players) {
    players.forEach((player) => {
      player.territory = 0;
      player.income = 1.2;
      player.maxEnergy = 78;
      player.buildings = {
        duckNest: 0,
        reedGuard: 0,
        lilyFarm: 0,
        mudTunnel: 0,
        jumpPad: 0,
      };
      player.flags.mudTunnel = false;
      player.flags.jumpPad = false;
    });

    this.tileManager.forEach((tile) => {
      if (!tile.owner || TILE_TYPES[tile.type].blocks) return;
      const player = players.find((candidate) => candidate.id === tile.owner);
      if (!player || player.defeated) return;

      player.territory += 1;
      player.maxEnergy += 2.6;
      player.income += 0.075 + tile.incomeBonus + this.animalManager.getIncomeBonus(player, tile);

      if (tile.building) {
        player.buildings[tile.building] += 1;
        this.applyBuilding(player, tile);
      }
    });

    players.forEach((player) => {
      player.maxEnergy += player.territory * 0.12;
      player.energy = Math.min(player.energy, player.maxEnergy);
      if (player.territory <= 0 && !player.defeated) {
        player.defeated = true;
        player.energy = 0;
      }
    });
  }

  applyBuilding(player, tile) {
    if (tile.building === "duckNest") {
      player.maxEnergy += 34;
      player.income += 0.16;
    }

    if (tile.building === "lilyFarm") {
      player.income += tile.type === "lily" ? 0.72 : 0.46;
    }

    if (tile.building === "reedGuard") {
      player.income += 0.06;
    }

    if (tile.building === "mudTunnel") {
      player.flags.mudTunnel = true;
      player.income += 0.12;
    }

    if (tile.building === "jumpPad") {
      player.flags.jumpPad = true;
      player.maxEnergy += 8;
    }
  }

  canBuild(player, tile, buildingType) {
    const building = BUILDINGS[buildingType];
    if (!building || !tile || tile.owner !== player.id || tile.building) return false;
    if (!this.animalManager.canUseBuilding(player, building)) return false;
    if (!building.validTiles.includes(tile.type)) return false;
    return player.energy >= building.cost;
  }

  build(player, tile, buildingType) {
    if (!this.canBuild(player, tile, buildingType)) return false;
    const building = BUILDINGS[buildingType];
    player.energy -= building.cost;
    tile.building = buildingType;
    tile.captureFlash = 1;
    return true;
  }
}
