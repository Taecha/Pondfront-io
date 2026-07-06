const lakeEvents = require("../shared/lakeEvents");
const balance = require("../shared/balanceConfig");
const config = require("../shared/gameConfig");

class EventManager {
  constructor(pushEvent) {
    this.pushEvent = pushEvent;
    this.active = null;
    this.nextAt = 0;
    this.lastType = null;
    this.pendingType = null;
    this.pendingArea = null;
    this.warningSent = false;
  }

  reset(now) {
    this.active = null;
    this.nextAt = now + (balance.lakeEventFirstAt || 150);
    this.lastType = null;
    this.pendingType = null;
    this.pendingArea = null;
    this.warningSent = false;
  }

  update(game) {
    const now = game.now();
    if (this.active && now >= this.active.endsAt) {
      this.pushEvent({
        kind: "lakeEventEnded",
        eventType: this.active.type,
        message: this.active.definition.endText || `${this.active.definition.label} faded.`,
        color: this.active.definition.color,
        visual: this.active.definition.visual,
        area: this.active.area,
        at: now,
      });
      this.active = null;
      this.nextAt = now + (balance.lakeEventInterval || 95);
      this.pendingType = null;
      this.pendingArea = null;
      this.warningSent = false;
    }

    if (!this.active && !this.warningSent && !game.ended && now >= this.nextAt - this.warningLead(game)) {
      this.preparePending(game);
      const definition = lakeEvents[this.pendingType];
      this.pushEvent({
        kind: "lakeEventWarning",
        eventType: this.pendingType,
        message: `${definition.warningText || `${definition.label} Incoming`}: ${definition.description}`,
        color: definition.color,
        visual: definition.visual,
        area: this.pendingArea,
        startsIn: Math.max(1, Math.ceil(this.nextAt - now)),
        at: now,
      });
      this.warningSent = true;
    }

    if (!this.active && now >= this.nextAt && !game.ended) {
      this.start(game);
    }
  }

  start(game) {
    const now = game.now();
    this.preparePending(game);
    const type = this.pendingType;
    const definition = lakeEvents[type];
    const area = this.pendingArea || this.buildArea(game, type);
    this.active = {
      type,
      startedAt: now,
      endsAt: now + definition.duration,
      definition,
      area,
    };
    this.lastType = type;
    if (type === "migration") game.objectives?.refreshNeutralCamps(game);
    this.pushEvent({
      kind: "lakeEventStarted",
      eventType: type,
      message: `${definition.startText || definition.label}: ${definition.description}`,
      color: definition.color,
      visual: definition.visual,
      area,
      at: now,
    });
    this.pendingType = null;
    this.pendingArea = null;
    this.warningSent = false;
  }

  pickType(game) {
    const types = Object.keys(lakeEvents).filter((type) => type !== this.lastType);
    const human = game.getPlayer(config.HUMAN_ID);
    if (human?.animal === "frog" && Math.random() < 0.3 && this.lastType !== "lilyBloom") return "lilyBloom";
    if (human?.animal === "snake" && Math.random() < 0.25 && this.lastType !== "mudslide") return "mudslide";
    if (human?.animal === "carp" && Math.random() < 0.28 && this.lastType !== "lilyBloom") return "lilyBloom";
    if (human?.animal === "turtle" && Math.random() < 0.22 && this.lastType !== "mudslide") return "mudslide";
    return types[Math.floor(Math.random() * types.length)] || "rainstorm";
  }

  preparePending(game) {
    if (this.pendingType && this.pendingArea) return;
    this.pendingType = this.pickType(game);
    this.pendingArea = this.buildArea(game, this.pendingType);
  }

  warningLead() {
    const definition = lakeEvents[this.pendingType] || {};
    return Math.max(4, Math.min(12, definition.warningLead || 8));
  }

  buildArea(game, type) {
    const definition = lakeEvents[type] || lakeEvents.rainstorm;
    const preferred = new Set(definition.tileTypes || ["water"]);
    const tiles = game.tileManager.tiles.filter((tile) => preferred.has(tile.type));
    const fallback = game.tileManager.playable?.() || game.tileManager.tiles.filter((tile) => !config.TILE_TYPES[tile.type]?.blocks);
    const source = tiles.length ? tiles : fallback;
    const stride = Math.max(1, Math.floor(source.length / 96));
    const offset = Math.floor(Math.random() * stride);
    const areaTiles = source
      .filter((_, index) => (index + offset) % stride === 0)
      .slice(0, 96)
      .map((tile) => tile.id);
    const focus = this.focusTile(source);
    const boundsTiles = areaTiles.length ? areaTiles.map((id) => game.tileManager.getById(id)).filter(Boolean) : source.slice(0, 1);
    const bounds = this.bounds(boundsTiles);
    return {
      tileIds: areaTiles,
      focusTile: focus?.id ?? areaTiles[0] ?? null,
      label: definition.areaLabel || "the lake",
      bounds,
      direction: definition.directional ? this.randomDirection() : null,
      radius: Math.max(3, Math.ceil(Math.sqrt(Math.max(1, areaTiles.length)) * 0.55)),
    };
  }

  focusTile(tiles) {
    if (!tiles.length) return null;
    return tiles[Math.floor(Math.random() * tiles.length)] || tiles[0];
  }

  bounds(tiles) {
    if (!tiles.length) return null;
    const xs = tiles.map((tile) => tile.x);
    const ys = tiles.map((tile) => tile.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  randomDirection() {
    const directions = ["east", "west", "north", "south"];
    return directions[Math.floor(Math.random() * directions.length)];
  }

  isActive(type) {
    return this.active?.type === type;
  }

  snapshot(now = Date.now() / 1000) {
    if (!this.active) {
      const pending = this.pendingType ? lakeEvents[this.pendingType] : null;
      return {
        active: null,
        upcoming: pending
          ? {
              type: this.pendingType,
              label: pending.warningText || pending.label,
              description: pending.description,
              color: pending.color,
              visual: pending.visual,
              startsIn: Math.max(0, this.nextAt - now),
              area: this.pendingArea,
            }
          : null,
        nextIn: Math.max(0, this.nextAt - now),
      };
    }
    return {
      active: {
        type: this.active.type,
        label: this.active.definition.label,
        description: this.active.definition.description,
        color: this.active.definition.color,
        visual: this.active.definition.visual,
        area: this.active.area,
        startedAt: this.active.startedAt,
        endsAt: this.active.endsAt,
        remaining: Math.max(0, this.active.endsAt - now),
      },
      upcoming: null,
      nextIn: 0,
    };
  }
}

module.exports = EventManager;
