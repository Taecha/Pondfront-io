const animals = require("../shared/animals");

class ProgressionManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
    this.thresholds = [0, 30, 80, 150, 240];
  }

  setup(players) {
    players.forEach((player) => {
      player.xp = player.xp || 0;
      player.level = player.level || 1;
      player.evolutionTitle = this.evolutionTitle(player);
    });
  }

  handleEvent(game, event) {
    if (!event?.playerId) return;
    const player = game.getPlayer(event.playerId);
    if (!player || player.defeated) return;
    const xp = this.eventXp(event);
    if (xp > 0) this.award(game, player, xp, event.kind);
  }

  eventXp(event) {
    if (event.kind === "expand") return event.amount === 0 ? 2 : 3;
    if (event.kind === "waveCapture") return 4;
    if (event.kind === "objectiveCaptured") return 22;
    if (event.kind === "campCaptured") return 12;
    if (event.kind === "defend") return 3;
    if (event.kind === "ability" || event.kind === "abilityUsed") return 8;
    if (event.kind === "buildComplete") return 6;
    return 0;
  }

  award(game, player, amount, reason = "XP") {
    player.xp = Math.max(0, (player.xp || 0) + amount);
    const oldLevel = player.level || 1;
    const nextLevel = this.levelForXp(player.xp);
    player.level = nextLevel;
    player.evolutionTitle = this.evolutionTitle(player);
    if (nextLevel > oldLevel) {
      this.pushEvent({
        kind: "levelUp",
        playerId: player.id,
        level: nextLevel,
        animal: player.animal,
        message: `${animals[player.animal]?.label || "Animal"} reached Level ${nextLevel}!`,
        at: game.now(),
        reason,
      });
    }
  }

  levelForXp(xp) {
    let level = 1;
    this.thresholds.forEach((threshold, index) => {
      if (xp >= threshold) level = index + 1;
    });
    return Math.min(5, level);
  }

  progress(player) {
    const level = player.level || 1;
    const current = this.thresholds[level - 1] || 0;
    const next = this.thresholds[level] || current;
    const xp = player.xp || 0;
    return {
      xp,
      level,
      current,
      next,
      ratio: next > current ? Math.max(0, Math.min(1, (xp - current) / (next - current))) : 1,
      title: this.evolutionTitle(player),
      levelText: `Level ${level}`,
    };
  }

  evolutionTitle(player) {
    if ((player.level || 1) < 5) return "Starter";
    if (player.animal === "duck") return "Royal Duck";
    if (player.animal === "snake") return "Marsh Serpent";
    if (player.animal === "frog") return "Lotus Frog";
    return "Evolved";
  }
}

module.exports = ProgressionManager;
