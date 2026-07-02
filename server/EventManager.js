const lakeEvents = require("../shared/lakeEvents");
const balance = require("../shared/balanceConfig");
const config = require("../shared/gameConfig");

class EventManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
    this.active = null;
    this.nextAt = 0;
    this.lastType = null;
  }

  reset(now) {
    this.active = null;
    this.nextAt = now + (balance.lakeEventFirstAt || 150);
    this.lastType = null;
  }

  update(game) {
    const now = game.now();
    if (this.active && now >= this.active.endsAt) {
      this.pushEvent({
        kind: "lakeEventEnded",
        eventType: this.active.type,
        message: `${this.active.definition.label} faded.`,
        at: now,
      });
      this.active = null;
      this.nextAt = now + (balance.lakeEventInterval || 95);
    }

    if (!this.active && now >= this.nextAt && !game.ended) {
      this.start(game);
    }
  }

  start(game) {
    const now = game.now();
    const type = this.pickType(game);
    const definition = lakeEvents[type];
    this.active = {
      type,
      startedAt: now,
      endsAt: now + definition.duration,
      definition,
    };
    this.lastType = type;
    if (type === "migration") game.objectives?.refreshNeutralCamps(game);
    this.pushEvent({
      kind: "lakeEventStarted",
      eventType: type,
      message: `${definition.label}: ${definition.description}`,
      at: now,
    });
  }

  pickType(game) {
    const types = Object.keys(lakeEvents).filter((type) => type !== this.lastType);
    const human = game.getPlayer(config.HUMAN_ID);
    if (human?.animal === "frog" && Math.random() < 0.3 && this.lastType !== "lilyBloom") return "lilyBloom";
    if (human?.animal === "snake" && Math.random() < 0.25 && this.lastType !== "mudslide") return "mudslide";
    return types[Math.floor(Math.random() * types.length)] || "rainstorm";
  }

  isActive(type) {
    return this.active?.type === type;
  }

  snapshot(now = Date.now() / 1000) {
    if (!this.active) {
      return {
        active: null,
        nextIn: Math.max(0, this.nextAt - now),
      };
    }
    return {
      active: {
        type: this.active.type,
        label: this.active.definition.label,
        description: this.active.definition.description,
        color: this.active.definition.color,
        startedAt: this.active.startedAt,
        endsAt: this.active.endsAt,
        remaining: Math.max(0, this.active.endsAt - now),
      },
      nextIn: 0,
    };
  }
}

module.exports = EventManager;
