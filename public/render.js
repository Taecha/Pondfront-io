(function initRenderer(root) {
  class PondRenderer {
    constructor(canvas, miniMap) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.miniMap = miniMap;
      this.miniCtx = miniMap.getContext("2d");
      this.state = null;
      this.dpr = 1;
      this.baseTile = 26;
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.eventAnims = [];
      this.ownerTransitions = new Map();
      this.pendingActions = new Map();
      this.lastMiniMapDrawAt = 0;
      this.miniMapDirty = true;
      this.lastVisibleTileCount = 0;
      this.vfx = root.PondVFX ? new root.PondVFX(this) : null;
      this.fitted = false;
      this.resize();
    }

    resize() {
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      const mini = this.miniMap.getBoundingClientRect();
      this.miniMap.width = Math.max(1, Math.floor(mini.width * this.dpr));
      this.miniMap.height = Math.max(1, Math.floor(mini.height * this.dpr));
      this.miniCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.miniMapDirty = true;
      if (this.state) this.fit(false);
    }

    setState(state, options = {}) {
      const deltaTiles = options.changedTiles || [];
      const deltaMode = Boolean(options.delta && this.state && this.tileMap);
      const oldOwners = !deltaMode && this.state ? new Map(this.state.tiles.map((tile) => [tile.id, tile.owner])) : null;
      const oldPlayers = this.playerMap || new Map();
      const previousTileMap = this.tileMap || new Map();
      const previousTiles = deltaMode ? new Map(deltaTiles.map((tile) => [tile.id, previousTileMap.get(tile.id)])) : new Map();
      const miniChanged =
        !deltaMode ||
        deltaTiles.some((tile) => {
          const oldTile = previousTiles.get(tile.id);
          return !oldTile || oldTile.owner !== tile.owner || oldTile.type !== tile.type || oldTile.objectiveId !== tile.objectiveId || oldTile.campId !== tile.campId || oldTile.isCore !== tile.isCore;
        });
      this.state = state;
      if (deltaMode) {
        deltaTiles.forEach((tile) => {
          const resolved = state.tiles[tile.id] || { ...(previousTileMap.get(tile.id) || {}), ...tile };
          this.tileMap.set(resolved.id, resolved);
        });
      } else {
        this.tileMap = new Map(state.tiles.map((tile) => [tile.id, tile]));
      }
      this.playerMap = new Map(state.players.map((player) => [player.id, player]));
      this.miniMapDirty = this.miniMapDirty || miniChanged;
      if (!this.fitted) this.fit(true);
      if (deltaMode) {
        deltaTiles.forEach((update) => {
          const tile = this.tileMap.get(update.id);
          if (!tile) return;
          const previous = previousTiles.get(update.id);
          const oldOwner = previous ? previous.owner : undefined;
          if (oldOwner === tile.owner) return;
          const oldColor = oldOwner ? oldPlayers.get(oldOwner)?.color : "#234f5e";
          const newColor = tile.owner ? this.playerMap.get(tile.owner)?.color : "#234f5e";
          this.ownerTransitions.set(tile.id, { oldColor, newColor, atMs: performance.now() });
          this.eventAnims.push({ kind: "ripple", to: tile.id, atMs: performance.now(), playerId: tile.owner });
        });
      } else if (oldOwners) {
        state.tiles.forEach((tile) => {
          const oldOwner = oldOwners.get(tile.id);
          if (oldOwner !== tile.owner) {
            const oldColor = oldOwner ? oldPlayers.get(oldOwner)?.color : "#234f5e";
            const newColor = tile.owner ? this.playerMap.get(tile.owner)?.color : "#234f5e";
            this.ownerTransitions.set(tile.id, { oldColor, newColor, atMs: performance.now() });
            this.eventAnims.push({ kind: "ripple", to: tile.id, atMs: performance.now(), playerId: tile.owner });
          }
        });
      }
    }

    setPendingAction(action) {
      if (!action?.id || action.tileId == null) return;
      this.pendingActions.set(action.id, { ...action, atMs: performance.now() });
    }

    clearPendingAction(actionId) {
      if (actionId == null) return;
      this.pendingActions.delete(actionId);
    }

    fit(force = false) {
      if (!this.state || (!force && !this.fitted)) return;
      const rect = this.canvas.getBoundingClientRect();
      const mapW = this.state.cols * this.baseTile;
      const mapH = this.state.rows * this.baseTile;
      const zoom = Math.min(rect.width / (mapW * 1.08), rect.height / (mapH * 1.08));
      this.camera = { x: mapW / 2, y: mapH / 2, zoom: Math.max(this.minZoom(), Math.min(this.maxZoom(), zoom)) };
      this.fitted = true;
      this.clampCamera();
    }

    addEvents(events) {
      const now = performance.now();
      this.vfx?.addEvents(events, this.state);
      events.forEach((event) => {
        if (
          [
            "attack",
            "attackWave",
            "waveCapture",
            "waveResist",
            "waveContested",
            "expand",
            "expandProgress",
            "expansionWaveStart",
            "expansionWaveCapture",
            "expansionWaveEnd",
            "defend",
            "ability",
            "abilityUsed",
            "lastStand",
            "objectiveAppeared",
            "objectiveCaptured",
            "campCaptured",
            "campMoved",
            "ping",
            "teamCommand",
            "teamResponse",
            "buildComplete",
            "buildUpgrade",
            "buildRemove",
            "specialLaunch",
            "specialDefense",
            "specialImpact",
            "lakeEventWarning",
            "lakeEventStarted",
            "lakeEventEnded",
          ].includes(event.kind)
        ) {
          this.eventAnims.push({ ...event, atMs: now });
        }
      });
      this.eventAnims = this.eventAnims.slice(-120);
    }

    pan(dx, dy) {
      this.camera.x -= dx / this.camera.zoom;
      this.camera.y -= dy / this.camera.zoom;
      this.clampCamera();
    }

    zoomAt(screenX, screenY, delta) {
      this.zoomAtFactor(screenX, screenY, delta < 0 ? 1.12 : 0.9);
    }

    zoomAtFactor(screenX, screenY, factor) {
      const before = this.screenToWorld(screenX, screenY);
      const next = Math.max(this.minZoom(), Math.min(this.maxZoom(), this.camera.zoom * factor));
      this.camera.zoom = next;
      const after = this.screenToWorld(screenX, screenY);
      this.camera.x += before.x - after.x;
      this.camera.y += before.y - after.y;
      this.clampCamera();
    }

    zoomBy(factor) {
      const rect = this.canvas.getBoundingClientRect();
      this.zoomAtFactor(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    }

    centerOnTile(tileId) {
      if (!this.state || tileId == null) return;
      const tile = this.tileMap.get(tileId);
      if (!tile) return;
      this.camera.x = (tile.x + 0.5) * this.baseTile;
      this.camera.y = (tile.y + 0.5) * this.baseTile;
      this.clampCamera();
    }

    centerOnMiniMap(clientX, clientY) {
      if (!this.state) return;
      const rect = this.miniMap.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const py = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
      this.camera.x = px * this.state.cols * this.baseTile;
      this.camera.y = py * this.state.rows * this.baseTile;
      this.clampCamera();
    }

    minZoom() {
      if (!this.state) return 0.22;
      const rect = this.canvas.getBoundingClientRect();
      const mapW = this.state.cols * this.baseTile;
      const mapH = this.state.rows * this.baseTile;
      return Math.max(0.16, Math.min(rect.width / mapW, rect.height / mapH) * 0.86);
    }

    maxZoom() {
      return 2.45;
    }

    clampCamera() {
      if (!this.state) return;
      const rect = this.canvas.getBoundingClientRect();
      const mapW = this.state.cols * this.baseTile;
      const mapH = this.state.rows * this.baseTile;
      const halfW = rect.width / 2 / Math.max(0.001, this.camera.zoom);
      const halfH = rect.height / 2 / Math.max(0.001, this.camera.zoom);
      const margin = 24 / Math.max(0.001, this.camera.zoom);
      if (mapW <= halfW * 2) this.camera.x = mapW / 2;
      else this.camera.x = Math.max(halfW - margin, Math.min(mapW - halfW + margin, this.camera.x));
      if (mapH <= halfH * 2) this.camera.y = mapH / 2;
      else this.camera.y = Math.max(halfH - margin, Math.min(mapH - halfH + margin, this.camera.y));
    }

    screenToWorld(x, y) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (x - rect.left - rect.width / 2) / this.camera.zoom + this.camera.x,
        y: (y - rect.top - rect.height / 2) / this.camera.zoom + this.camera.y,
      };
    }

    screenToTile(x, y) {
      if (!this.state) return null;
      const world = this.screenToWorld(x, y);
      const tx = Math.floor(world.x / this.baseTile);
      const ty = Math.floor(world.y / this.baseTile);
      if (tx < 0 || ty < 0 || tx >= this.state.cols || ty >= this.state.rows) return null;
      return this.tileMap.get(ty * this.state.cols + tx) || null;
    }

    worldToScreen(x, y) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (x - this.camera.x) * this.camera.zoom + rect.width / 2,
        y: (y - this.camera.y) * this.camera.zoom + rect.height / 2,
      };
    }

    draw(options) {
      const drawOptions = this.effectiveOptions(options);
      this.vfx?.configure({
        ...(drawOptions.effects || {}),
        visualQuality: drawOptions.visualQuality,
        mapDecorations: drawOptions.mapDecorations,
        isMobile: Boolean(drawOptions.isMobile),
      });
      const rect = this.canvas.getBoundingClientRect();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const shake = this.vfx?.shakeOffset?.(performance.now()) || { x: 0, y: 0 };
      ctx.save();
      ctx.translate(shake.x, shake.y);
      this.drawWater(ctx, rect, drawOptions);
      if (this.state) {
        this.drawMap(ctx, drawOptions);
        this.drawEvents(ctx, drawOptions);
      }
      ctx.restore();
      if (!this.state) return;
      this.drawMiniMap(drawOptions);
    }

    effectiveOptions(options = {}) {
      const effects = { ...(options.effects || {}) };
      const mobile = Boolean(options.isMobile);
      const autoStrategic = Boolean(options.autoStrategicView) && this.camera.zoom < (mobile ? 0.78 : 0.48);
      const lowPower = Boolean(effects.autoLowPerformance) && (options.performanceLow || mobile || this.camera.zoom < 0.5);
      let visualQuality = options.visualQuality || "high";
      const next = {
        ...options,
        strategicView: Boolean(options.strategicView || autoStrategic),
        showIcons: autoStrategic ? false : options.showIcons,
        showAnimalIcons: options.showAnimalIcons !== false,
        showAnimalSprites: options.showAnimalSprites !== false && !autoStrategic,
        showAnimalAnimations: options.showAnimalAnimations !== false && !effects.reducedMotion,
        visualQuality,
        mapDecorations: options.mapDecorations !== false,
        effects,
      };
      if (lowPower) {
        next.strategicView = true;
        next.showIcons = false;
        next.mapDecorations = false;
        if (effects.level === "ultra") effects.level = mobile || this.camera.zoom < 0.5 ? "medium" : "high";
        else if (effects.level === "high") effects.level = mobile || this.camera.zoom < 0.5 ? "low" : "medium";
        if (effects.particles === "ultra") effects.particles = mobile || this.camera.zoom < 0.5 ? "medium" : "high";
        else if (effects.particles === "high") effects.particles = mobile || this.camera.zoom < 0.5 ? "low" : "medium";
        if (mobile && this.camera.zoom < 0.72) effects.floatingText = false;
        if (mobile && this.camera.zoom < 0.72) next.showAnimalAnimations = false;
        if (mobile && this.camera.zoom < 0.58) next.showAnimalSprites = false;
        if (visualQuality === "ultra") visualQuality = mobile || this.camera.zoom < 0.5 ? "medium" : "high";
        else if (visualQuality === "high") visualQuality = mobile || this.camera.zoom < 0.5 ? "low" : "medium";
        next.visualQuality = visualQuality;
      }
      if (effects.reducedMotion) {
        effects.floatingText = false;
        next.mapDecorations = false;
        next.showAnimalAnimations = false;
      }
      return next;
    }

    drawWater(ctx, rect, options = {}) {
      const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, "#061724");
      gradient.addColorStop(0.42, "#123f52");
      gradient.addColorStop(0.78, "#0c2a3b");
      gradient.addColorStop(1, "#05121d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
      const now = performance.now();
      const lowPower = options.visualQuality === "low" || options.effects?.level === "low" || options.effects?.reducedMotion;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "#b8edf5";
      ctx.lineWidth = 1;
      for (let y = -24; y < rect.height + 42; y += lowPower ? 58 : 34) {
        ctx.beginPath();
        for (let x = -34; x <= rect.width + 34; x += lowPower ? 40 : 22) {
          const drift = now * 0.018 + y * 0.7;
          ctx.lineTo(x, y + Math.sin((x + drift) * 0.026) * 2.2);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = "#5ec9dc";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < (lowPower ? 5 : 16); i += 1) {
        const y = (i * 71 + now * 0.009) % (rect.height + 90) - 45;
        const xOffset = ((i * 113 + now * 0.014) % 180) - 90;
        ctx.beginPath();
        for (let x = -80; x <= rect.width + 80; x += 36) {
          ctx.lineTo(x + xOffset, y + Math.sin((x + now * 0.02 + i * 17) * 0.018) * 6);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.18;
      const sheen = ctx.createLinearGradient(0, rect.height * 0.12, rect.width, rect.height * 0.82);
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(0.48, "rgba(255,255,255,0.09)");
      sheen.addColorStop(0.55, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.restore();
      this.drawLakeEventOverlay(ctx, rect);
    }

    drawLakeEventOverlay(ctx, rect) {
      const event = this.state?.lakeEvent?.active || this.state?.lakeEvent?.upcoming;
      if (!event) return;
      ctx.save();
      const now = performance.now();
      const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
      const warning = Boolean(!this.state?.lakeEvent?.active && this.state?.lakeEvent?.upcoming);
      const visual = event.visual || event.type;
      ctx.globalAlpha = warning ? 0.035 + pulse * 0.02 : 0.05 + pulse * 0.025;
      ctx.fillStyle = event.color || "#83dced";
      ctx.fillRect(0, 0, rect.width, rect.height);
      if (visual === "storm") {
        const lines = warning ? 10 : 18;
        ctx.globalAlpha = warning ? 0.12 : 0.18;
        ctx.strokeStyle = "rgba(210,245,255,0.62)";
        ctx.lineWidth = 1;
        for (let i = 0; i < lines; i += 1) {
          const x = (i * 91 + now * 0.025) % (rect.width + 120) - 60;
          const y = (i * 57 + now * 0.08) % (rect.height + 90) - 45;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 9, y + 24);
          ctx.stroke();
        }
      } else if (visual === "fog") {
        ctx.globalAlpha = warning ? 0.09 : 0.16;
        ctx.fillStyle = "rgba(218,240,245,0.56)";
        for (let i = 0; i < 6; i += 1) {
          const x = ((i * 211 + now * 0.014) % (rect.width + 220)) - 110;
          const y = rect.height * (0.18 + i * 0.12);
          ctx.beginPath();
          ctx.ellipse(x, y + Math.sin(now * 0.001 + i) * 12, 160, 18, 0.04, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawMap(ctx, options) {
      const s = this.baseTile * this.camera.zoom;
      const topLeft = this.worldToScreen(0, 0);
      const mapW = this.state.cols * s;
      const mapH = this.state.rows * s;
      const radius = Math.max(8, Math.min(20, 12 * this.camera.zoom));
      const cleanMode = options.strategicView || options.visualQuality === "low" || options.effects?.level === "low";
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.32)";
      ctx.shadowBlur = cleanMode ? 8 : 28;
      ctx.shadowOffsetY = cleanMode ? 3 : 10;
      ctx.fillStyle = "rgba(3,12,19,0.48)";
      this.roundRect(ctx, topLeft.x - 10, topLeft.y - 10, mapW + 20, mapH + 20, radius + 8);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowOffsetY = 0;
      const lake = ctx.createLinearGradient(topLeft.x, topLeft.y, topLeft.x + mapW, topLeft.y + mapH);
      lake.addColorStop(0, "#1a4c5f");
      lake.addColorStop(0.5, "#286477");
      lake.addColorStop(1, "#12384b");
      ctx.fillStyle = lake;
      this.roundRect(ctx, topLeft.x, topLeft.y, mapW, mapH, radius);
      ctx.fill();

      ctx.save();
      this.roundRect(ctx, topLeft.x, topLeft.y, mapW, mapH, radius);
      ctx.clip();
      if (!cleanMode) this.drawMapWaterTexture(ctx, topLeft, mapW, mapH, options);
      if (!cleanMode) this.drawRegionUnderlays(ctx);
      const visibleTiles = this.visibleTiles(1);
      visibleTiles.forEach((tile) => this.drawTile(ctx, tile, options));
      if (!cleanMode) this.drawTerrainEdges(ctx, visibleTiles, options);
      this.drawLakeEventArea(ctx, visibleTiles, options);
      if (!cleanMode) this.drawMapDecorations(ctx, visibleTiles, options);
      visibleTiles.forEach((tile) => this.drawBorders(ctx, tile));
      if (!cleanMode) this.drawLocalGlow(ctx, visibleTiles);
      if (!cleanMode) this.drawRegionNames(ctx);
      this.drawDefense(ctx, visibleTiles);
      this.drawBorderStatus(ctx, visibleTiles, options);
      this.drawSpecialMarkers(ctx);
      this.drawLegalHints(ctx, options);
      this.drawPendingActions(ctx);
      this.drawPreview(ctx, options);
      this.drawSelection(ctx, options);
      this.drawActiveExpansions(ctx);
      this.drawActiveAttacks(ctx);
      this.drawSpecialOverlays(ctx);
      this.vfx?.draw(ctx);
      this.drawAnimalPresence(ctx, options);
      this.drawNames(ctx);
      ctx.restore();
      ctx.strokeStyle = "rgba(210, 242, 247, 0.28)";
      ctx.lineWidth = Math.max(1, 1.4 * this.camera.zoom);
      this.roundRect(ctx, topLeft.x + 0.5, topLeft.y + 0.5, mapW - 1, mapH - 1, radius);
      ctx.stroke();
      ctx.restore();
    }

    visibleTiles(pad = 0) {
      if (!this.state) return [];
      const rect = this.canvas.getBoundingClientRect();
      const topLeft = this.screenToWorld(rect.left, rect.top);
      const bottomRight = this.screenToWorld(rect.right, rect.bottom);
      const startX = Math.max(0, Math.floor(topLeft.x / this.baseTile) - pad);
      const startY = Math.max(0, Math.floor(topLeft.y / this.baseTile) - pad);
      const endX = Math.min(this.state.cols - 1, Math.ceil(bottomRight.x / this.baseTile) + pad);
      const endY = Math.min(this.state.rows - 1, Math.ceil(bottomRight.y / this.baseTile) + pad);
      const tiles = [];
      for (let y = startY; y <= endY; y += 1) {
        for (let x = startX; x <= endX; x += 1) {
          const tile = this.tileMap.get(y * this.state.cols + x);
          if (tile) tiles.push(tile);
        }
      }
      this.lastVisibleTileCount = tiles.length;
      return tiles;
    }

    drawLakeEventArea(ctx, visibleTiles, options = {}) {
      const lakeEvent = this.state?.lakeEvent;
      const active = lakeEvent?.active;
      const upcoming = !active ? lakeEvent?.upcoming : null;
      const event = active || upcoming;
      if (!event) return;
      const definition = this.state.config?.lakeEvents?.[event.type] || {};
      const visual = event.visual || definition.visual || event.type;
      const color = event.color || definition.color || "#83dced";
      const warning = Boolean(upcoming);
      const tileSet = new Set(event.area?.tileIds || []);
      const preferred = new Set(definition.tileTypes || []);
      const now = performance.now();
      const pulse = 0.5 + Math.sin(now * 0.006) * 0.5;
      const maxTiles = options.isMobile ? 130 : options.visualQuality === "low" ? 150 : 260;
      const affected = visibleTiles.filter((tile) => this.lakeEventAffectsTile(tile, tileSet, preferred)).slice(0, maxTiles);
      if (!affected.length) return;
      const s = this.baseTile * this.camera.zoom;
      if (s < 3.2) return;
      ctx.save();
      affected.forEach((tile, index) => {
        const p = this.tileCenter(tile);
        const seed = tile.id * 0.618;
        const localPulse = 0.5 + Math.sin(now * 0.005 + seed) * 0.5;
        const inset = Math.max(0.6, s * 0.08);
        ctx.save();
        ctx.globalAlpha = warning ? 0.14 + localPulse * 0.06 : 0.16 + localPulse * 0.12;
        ctx.fillStyle = this.withAlpha(color, visual === "fog" ? 0.22 : 0.34);
        if (warning) {
          ctx.strokeStyle = this.withAlpha(color, 0.82);
          ctx.lineWidth = Math.max(1, s * 0.045);
          ctx.setLineDash([Math.max(3, s * 0.18), Math.max(2, s * 0.12)]);
          this.roundRect(ctx, p.x - s * 0.5 + inset, p.y - s * 0.5 + inset, s - inset * 2, s - inset * 2, Math.max(2, s * 0.14));
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          this.roundRect(ctx, p.x - s * 0.5 + inset, p.y - s * 0.5 + inset, s - inset * 2, s - inset * 2, Math.max(2, s * 0.12));
          ctx.fill();
        }
        ctx.globalAlpha = warning ? 0.42 : 0.56;
        ctx.strokeStyle = this.withAlpha(color, 0.9);
        ctx.fillStyle = this.withAlpha(color, 0.58);
        ctx.lineWidth = Math.max(1, s * 0.035);
        if (visual === "mud") {
          for (let i = 0; i < 2; i += 1) {
            const y = p.y - s * 0.16 + i * s * 0.28;
            ctx.beginPath();
            ctx.moveTo(p.x - s * 0.38, y);
            ctx.quadraticCurveTo(p.x, y + Math.sin(now * 0.008 + seed + i) * s * 0.12, p.x + s * 0.38, y + s * 0.04);
            ctx.stroke();
          }
        } else if (visual === "flood" || visual === "current" || visual === "storm") {
          const dir = event.area?.direction || "east";
          const angle = dir === "north" ? -Math.PI / 2 : dir === "south" ? Math.PI / 2 : dir === "west" ? Math.PI : 0;
          const drift = ((now * 0.006 + index * 0.23) % 1 - 0.5) * s * 0.44;
          ctx.beginPath();
          ctx.moveTo(p.x - Math.cos(angle) * s * 0.32 - Math.sin(angle) * drift, p.y - Math.sin(angle) * s * 0.32 + Math.cos(angle) * drift);
          ctx.lineTo(p.x + Math.cos(angle) * s * 0.32 - Math.sin(angle) * drift, p.y + Math.sin(angle) * s * 0.32 + Math.cos(angle) * drift);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(angle) * s * 0.34 - Math.sin(angle) * drift, p.y + Math.sin(angle) * s * 0.34 + Math.cos(angle) * drift, Math.max(1.4, s * 0.045), 0, Math.PI * 2);
          ctx.fill();
        } else if (visual === "lily") {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, s * (0.22 + pulse * 0.04), s * 0.1, seed, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x + s * 0.18, p.y - s * 0.12, Math.max(1.4, s * 0.035), 0, Math.PI * 2);
          ctx.fill();
        } else if (visual === "reed") {
          for (let i = -1; i <= 1; i += 1) {
            const x = p.x + i * s * 0.18;
            ctx.beginPath();
            ctx.moveTo(x, p.y + s * 0.35);
            ctx.quadraticCurveTo(x + Math.sin(now * 0.006 + seed + i) * s * 0.14, p.y, x + s * 0.08, p.y - s * 0.36);
            ctx.stroke();
          }
        } else if (visual === "rock") {
          ctx.beginPath();
          ctx.moveTo(p.x - s * 0.28, p.y - s * 0.08);
          ctx.lineTo(p.x - s * 0.04, p.y + s * 0.05);
          ctx.lineTo(p.x + s * 0.12, p.y - s * 0.18);
          ctx.lineTo(p.x + s * 0.32, p.y + s * 0.12);
          ctx.stroke();
        } else if (visual === "fog") {
          ctx.globalAlpha = warning ? 0.2 : 0.3;
          ctx.beginPath();
          ctx.ellipse(p.x + Math.sin(now * 0.002 + seed) * s * 0.12, p.y, s * 0.42, s * 0.16, 0.08, 0, Math.PI * 2);
          ctx.fill();
        } else if (visual === "migration") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, s * (0.16 + localPulse * 0.08), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();
    }

    lakeEventAffectsTile(tile, tileSet, preferred) {
      if (!tile) return false;
      if (tileSet.size) return tileSet.has(tile.id);
      if (preferred.size) return preferred.has(tile.type);
      return false;
    }

    drawPendingActions(ctx) {
      if (!this.pendingActions.size) return;
      const now = performance.now();
      const s = this.baseTile * this.camera.zoom;
      ctx.save();
      this.pendingActions.forEach((action) => {
        const tile = this.tileMap.get(action.tileId);
        if (!tile) return;
        const p = this.tileCenter(tile);
        const age = now - action.atMs;
        const pulse = 0.5 + Math.sin(age * 0.012) * 0.5;
        const color = action.color || (action.type === "attack" ? "#f2d87a" : action.type === "defend" ? "#87d7ea" : "#77d99e");
        const source = action.sourceTileId != null ? this.tileMap.get(action.sourceTileId) : null;
        if (source) {
          const from = this.tileCenter(source);
          this.drawStrategicFlow(ctx, from, p, color, now, 0.42 + pulse * 0.22, action.type === "expand" ? "Energy" : "");
        }
        ctx.globalAlpha = 0.32 + pulse * 0.2;
        ctx.fillStyle = color;
        this.roundRect(ctx, p.x - s * 0.45, p.y - s * 0.45, s * 0.9, s * 0.9, Math.max(3, s * 0.16));
        ctx.fill();
        ctx.globalAlpha = 0.18 + pulse * 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(8, s * (0.62 + pulse * 0.12)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, 3.2 * this.camera.zoom);
        ctx.setLineDash([Math.max(4, s * 0.18), Math.max(3, s * 0.1)]);
        ctx.lineDashOffset = -age * 0.035;
        ctx.strokeRect(p.x - s * 0.43, p.y - s * 0.43, s * 0.86, s * 0.86);
        ctx.setLineDash([]);
        if (s > 10) {
          const label = action.type === "attack" ? "Sending" : action.type === "defend" ? "Defend" : action.type === "waterRoute" ? "Current" : "Expanding";
          this.drawPillText(ctx, label, p.x, p.y - s * 0.62, color);
        }
      });
      ctx.restore();
    }

    drawRegionUnderlays(ctx) {
      if (!this.state.regions?.length) return;
      ctx.save();
      this.state.regions.forEach((region) => {
        const center = this.worldToScreen((region.x + 0.5) * this.baseTile, (region.y + 0.5) * this.baseTile);
        const radius = region.radius * this.baseTile * this.camera.zoom;
        if (center.x + radius < -40 || center.y + radius < -40 || center.x - radius > this.canvas.clientWidth + 40 || center.y - radius > this.canvas.clientHeight + 40) return;
        const gradient = ctx.createRadialGradient(center.x, center.y, radius * 0.1, center.x, center.y, radius * 1.15);
        gradient.addColorStop(0, this.withAlpha(region.tone || "#9ee7f4", 0.18));
        gradient.addColorStop(0.68, this.withAlpha(region.tone || "#9ee7f4", 0.06));
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, radius * 1.35, radius * 0.92, 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    drawMapWaterTexture(ctx, topLeft, mapW, mapH, options) {
      if (!options.mapDecorations || options.visualQuality === "low") return;
      const now = performance.now();
      const ultra = options.visualQuality === "ultra";
      const high = options.visualQuality === "high" || ultra;
      const quality = ultra ? 1.1 : high ? 0.9 : 0.56;
      ctx.save();
      ctx.globalAlpha = 0.1 * quality;
      ctx.strokeStyle = "rgba(199, 241, 247, 0.58)";
      ctx.lineWidth = Math.max(0.7, this.camera.zoom * 0.8);
      const spacing = Math.max(high ? 46 : 60, this.baseTile * this.camera.zoom * (high ? 5.2 : 6.8));
      for (let y = topLeft.y + 18; y < topLeft.y + mapH; y += spacing) {
        ctx.beginPath();
        for (let x = topLeft.x - 20; x <= topLeft.x + mapW + 20; x += high ? 26 : 34) {
          const wave = Math.sin((x + now * 0.006 + y * 0.65) * 0.022) * 1.8 * quality;
          ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }
      const shimmerCount = ultra ? 42 : high ? 28 : 16;
      ctx.globalAlpha = 0.12 * quality;
      ctx.strokeStyle = "rgba(223, 250, 252, 0.56)";
      ctx.lineWidth = Math.max(0.6, this.camera.zoom * 0.62);
      for (let i = 0; i < shimmerCount; i += 1) {
        const x = topLeft.x + ((i * 173 + this.seedOffset(11)) % Math.max(1, mapW));
        const y = topLeft.y + ((i * 97 + this.seedOffset(23)) % Math.max(1, mapH));
        const drift = Math.sin(now * 0.0012 + i) * 2.4;
        ctx.beginPath();
        ctx.moveTo(x - 9, y + drift);
        ctx.quadraticCurveTo(x, y - 2 + drift, x + 12, y + drift * 0.5);
        ctx.stroke();
      }
      if (this.state.regions?.length) {
        this.state.regions.slice(0, ultra ? 12 : options.visualQuality === "high" ? 8 : 5).forEach((region, index) => {
          const p = this.worldToScreen((region.x + 0.5) * this.baseTile, (region.y + 0.5) * this.baseTile);
          const r = Math.max(18, region.radius * this.baseTile * this.camera.zoom * (0.42 + index * 0.012));
          ctx.globalAlpha = 0.06 * quality;
          ctx.fillStyle = region.tone || "#9ee7f4";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r * 1.8, r * 0.78, index * 0.18, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
    }

    drawMapDecorations(ctx, visibleTiles, options) {
      if (!options.mapDecorations || options.visualQuality === "low" || this.camera.zoom < 0.42) return;
      const ultra = options.visualQuality === "ultra";
      const high = options.visualQuality === "high" || ultra;
      const limit = options.isMobile ? 32 : ultra ? 170 : high ? 116 : 72;
      const size = this.baseTile * this.camera.zoom;
      let drawn = 0;
      ctx.save();
      for (const tile of visibleTiles) {
        if (drawn >= limit) break;
        const seed = this.tileNoise(tile.id + 17, 0, 1);
        if (tile.owner && seed < 0.985) continue;
        const typeInfo = this.state.config.tileTypes[tile.type] || {};
        const nearBank = tile.type === "water" && this.neighbors(tile).some((neighbor) => neighbor && neighbor.type !== "water" && !neighbor.owner);
        if (!tile.owner && tile.type === "water" && !(nearBank ? seed > (high ? 0.74 : 0.82) : seed > (ultra ? 0.965 : high ? 0.978 : 0.988))) continue;
        if (tile.type !== "water" && !typeInfo.strategic && !typeInfo.blocks && !this.isDecorationClusterAnchor(tile, seed)) continue;
        if ((typeInfo.strategic || typeInfo.blocks) && !this.isDecorationClusterAnchor(tile, seed) && seed < 0.74) continue;
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        const x = p.x + size * this.tileNoise(tile.id + 3, 0.25, 0.78);
        const y = p.y + size * this.tileNoise(tile.id + 9, 0.25, 0.78);
        if (tile.type === "water") {
          this.drawWaterAccent(ctx, tile, x, y, size, seed, nearBank ? 0.3 : 0.2);
          drawn += 1;
        } else if (
          tile.type === "lily" ||
          tile.type === "reeds" ||
          tile.type === "mud" ||
          tile.type === "nest" ||
          tile.type === "rock" ||
          typeInfo.blocks
        ) {
          this.drawTerrainAccent(ctx, tile, p.x, p.y, size);
          drawn += 1;
        } else if (tile.owner && this.camera.zoom > 0.9) {
          const player = this.playerMap.get(tile.owner);
          this.drawAnimalTrace(ctx, x, y, size, player?.animal, player?.color);
          drawn += 1;
        }
      }
      ctx.restore();
    }

    drawTerrainEdges(ctx, visibleTiles, options) {
      if (!options.mapDecorations || options.visualQuality === "low") return;
      const size = this.baseTile * this.camera.zoom;
      if (size < 5.2) return;
      const limit = options.isMobile ? 220 : options.visualQuality === "ultra" ? 760 : options.visualQuality === "high" ? 620 : 430;
      let drawn = 0;
      ctx.save();
      ctx.lineCap = "round";
      for (const tile of visibleTiles) {
        if (drawn >= limit || tile.owner || tile.type === "water") continue;
        const type = this.state.config.tileTypes[tile.type] || {};
        if (!type.blocks && !type.strategic && !["mud", "reeds", "lily"].includes(tile.type)) continue;
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        const edges = [
          [0, -1, p.x + size * 0.12, p.y + size * 0.1, p.x + size * 0.88, p.y + size * 0.1],
          [1, 0, p.x + size * 0.9, p.y + size * 0.12, p.x + size * 0.9, p.y + size * 0.88],
          [0, 1, p.x + size * 0.12, p.y + size * 0.9, p.x + size * 0.88, p.y + size * 0.9],
          [-1, 0, p.x + size * 0.1, p.y + size * 0.12, p.x + size * 0.1, p.y + size * 0.88],
        ];
        const color =
          tile.type === "mud"
            ? "rgba(193, 139, 95, 0.28)"
            : tile.type === "reeds"
              ? "rgba(182, 219, 126, 0.26)"
              : tile.type === "lily"
                ? "rgba(170, 238, 166, 0.22)"
                : tile.type === "desert"
                  ? "rgba(246, 220, 160, 0.24)"
                  : "rgba(225, 246, 236, 0.18)";
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0.8, Math.min(2.2, size * 0.045));
        for (const [dx, dy, x1, y1, x2, y2] of edges) {
          const nx = tile.x + dx;
          const ny = tile.y + dy;
          if (nx < 0 || ny < 0 || nx >= this.state.cols || ny >= this.state.rows) continue;
          const neighbor = this.tileMap.get(ny * this.state.cols + nx);
          if (!neighbor || neighbor.owner || neighbor.type !== "water") continue;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          drawn += 1;
          if (drawn >= limit) break;
        }
      }
      ctx.restore();
    }

    isDecorationClusterAnchor(tile, seed) {
      const sameNearby = this.neighbors(tile).filter((neighbor) => neighbor?.type === tile.type).length;
      const bankNearby = this.neighbors(tile).some((neighbor) => neighbor && neighbor.type === "water");
      return seed > 0.78 || (sameNearby >= 2 && seed > 0.54) || (bankNearby && seed > 0.66);
    }

    drawWaterAccent(ctx, tile, x, y, size, seed, alpha) {
      if (seed > 0.92) {
        this.drawTinyLeaf(ctx, x, y, size, tile.id, alpha * 0.92);
      } else if (seed > 0.84) {
        this.drawTinyBubbles(ctx, x, y, size, tile.id, alpha * 0.82);
      } else {
        this.drawTinyRipple(ctx, x, y, size, tile.id, alpha);
      }
    }

    drawTinyRipple(ctx, x, y, size, seed, alpha) {
      const now = performance.now();
      const wobble = Math.sin(now * 0.003 + seed) * size * 0.025;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(217, 247, 250, 0.72)";
      ctx.lineWidth = Math.max(0.7, size * 0.026);
      ctx.beginPath();
      ctx.ellipse(x, y + wobble, size * 0.18, size * 0.055, -0.12, 0, Math.PI * 2);
      ctx.stroke();
      if (size > 18) {
        ctx.globalAlpha = alpha * 0.55;
        ctx.beginPath();
        ctx.ellipse(x + size * 0.12, y - size * 0.08, size * 0.1, size * 0.032, 0.08, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawTinyLeaf(ctx, x, y, size, seed, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = seed % 3 > 1 ? "#d7e58c" : "#9cd887";
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.08, size * 0.035, this.tileNoise(seed + 13, -0.8, 0.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = "rgba(226, 252, 235, 0.72)";
      ctx.lineWidth = Math.max(0.7, size * 0.018);
      ctx.beginPath();
      ctx.moveTo(x - size * 0.05, y);
      ctx.lineTo(x + size * 0.06, y);
      ctx.stroke();
      ctx.restore();
    }

    drawTinyBubbles(ctx, x, y, size, seed, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(225, 250, 255, 0.68)";
      ctx.lineWidth = Math.max(0.65, size * 0.018);
      for (let i = 0; i < 2; i += 1) {
        const ox = this.tileNoise(seed + i * 19, -0.1, 0.12) * size;
        const oy = this.tileNoise(seed + i * 23, -0.08, 0.1) * size;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, Math.max(1.2, size * (0.028 + i * 0.012)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawTerrainAccent(ctx, tile, x, y, size) {
      if (size < 10) return;
      const cx = x + size * this.tileNoise(tile.id + 25, 0.35, 0.68);
      const cy = y + size * this.tileNoise(tile.id + 31, 0.35, 0.68);
      ctx.save();
      if (tile.type === "lily") {
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = "#baf2ac";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.12, size * 0.065, -0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile.type === "reeds") {
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = "#dce88a";
        ctx.lineWidth = Math.max(1, size * 0.028);
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(cx + i * size * 0.05, cy + size * 0.16);
          ctx.quadraticCurveTo(cx + i * size * 0.03, cy, cx + i * size * 0.07, cy - size * 0.18);
          ctx.stroke();
        }
      } else if (tile.type === "mud" || tile.type === "nest") {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = tile.type === "nest" ? "#f4c16e" : "#c18b5f";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.15, size * 0.065, 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile.type === "rock") {
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = "#e7eff2";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.08, cy + size * 0.05);
        ctx.lineTo(cx, cy - size * 0.1);
        ctx.lineTo(cx + size * 0.11, cy + size * 0.04);
        ctx.closePath();
        ctx.fill();
      } else if (tile.type === "jungleIsland" || tile.type === "grassIsland") {
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = tile.type === "jungleIsland" ? "#6f9b51" : "#9abb68";
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(
            cx + this.tileNoise(tile.id + i * 31, -0.14, 0.14) * size,
            cy + this.tileNoise(tile.id + i * 37, -0.1, 0.1) * size,
            size * 0.055,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      } else if (tile.type === "riceField") {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "#e3e998";
        ctx.lineWidth = Math.max(0.8, size * 0.02);
        for (let i = 0; i < 2; i += 1) {
          const yy = cy + (i - 0.5) * size * 0.12;
          ctx.beginPath();
          ctx.moveTo(cx - size * 0.16, yy);
          ctx.lineTo(cx + size * 0.16, yy + this.tileNoise(tile.id + i, -0.02, 0.02) * size);
          ctx.stroke();
        }
      } else if (tile.type === "desert") {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "#f7df9f";
        ctx.lineWidth = Math.max(0.7, size * 0.018);
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.18, cy);
        ctx.quadraticCurveTo(cx, cy - size * 0.08, cx + size * 0.2, cy + size * 0.02);
        ctx.stroke();
      } else if (tile.type === "log" || tile.type === "bridge") {
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = tile.type === "bridge" ? "#d6ad72" : "#8f673d";
        ctx.lineWidth = Math.max(1.2, size * 0.05);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.18, cy + size * 0.04);
        ctx.lineTo(cx + size * 0.18, cy - size * 0.04);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawAnimalTrace(ctx, x, y, size, animal, color = "#edf8fb") {
      const alpha = animal === "snake" ? 0.18 : animal === "frog" ? 0.16 : 0.14;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.withAlpha(color, 0.82);
      ctx.fillStyle = this.withAlpha(color, 0.72);
      ctx.lineWidth = Math.max(0.8, size * 0.025);
      if (animal === "snake") {
        ctx.beginPath();
        ctx.moveTo(x - size * 0.14, y);
        ctx.quadraticCurveTo(x, y - size * 0.12, x + size * 0.15, y);
        ctx.stroke();
      } else if (animal === "frog") {
        ctx.beginPath();
        ctx.arc(x - size * 0.05, y, size * 0.028, 0, Math.PI * 2);
        ctx.arc(x + size * 0.08, y - size * 0.035, size * 0.028, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.08, size * 0.035, 0.28, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawTile(ctx, tile, options) {
      const type = this.state.config.tileTypes[tile.type];
      const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
      const size = this.baseTile * this.camera.zoom;
      if (p.x + size < -20 || p.y + size < -20 || p.x > this.canvas.clientWidth + 20 || p.y > this.canvas.clientHeight + 20) return;

      const owner = tile.owner ? this.playerMap.get(tile.owner) : null;
      if (!owner && tile.type === "water") return;
      const simpleTerrain = options.strategicView || options.visualQuality === "low" || size < 13;

      const transition = this.ownerTransitions.get(tile.id);
      let transitionAlpha = 0;
      if (transition) {
        transitionAlpha = Math.max(0, 1 - (performance.now() - transition.atMs) / 620);
        if (transitionAlpha <= 0) this.ownerTransitions.delete(tile.id);
      }

      const isSpecial = type.strategic || type.blocks;
      if (!owner && isSpecial && options.strategicView && this.camera.zoom < 0.78 && !type.blocks && options.selectedTileId !== tile.id) {
        return;
      }
      if (owner) {
        const alpha = tile.owner === this.state.humanId ? 0.84 : 0.78;
        const overlap = Math.max(0.35, size * 0.018);
        ctx.fillStyle = this.withAlpha(owner.color, alpha);
        ctx.fillRect(p.x - overlap, p.y - overlap, size + overlap * 2, size + overlap * 2);
        if (this.camera.zoom > 0.38) {
          const glowAlpha = tile.owner === this.state.humanId ? 0.13 : 0.08;
          const glow = ctx.createLinearGradient(p.x, p.y, p.x + size, p.y + size);
          glow.addColorStop(0, `rgba(255,255,255,${glowAlpha})`);
          glow.addColorStop(0.55, "rgba(255,255,255,0)");
          glow.addColorStop(1, "rgba(0,0,0,0.08)");
          ctx.fillStyle = glow;
          ctx.fillRect(p.x - overlap, p.y - overlap, size + overlap * 2, size + overlap * 2);
        }
        if (transitionAlpha > 0 && transition.oldColor) {
          ctx.fillStyle = this.withAlpha(transition.oldColor, transitionAlpha * 0.58);
          ctx.fillRect(p.x - overlap, p.y - overlap, size + overlap * 2, size + overlap * 2);
        }
        if (this.camera.zoom > 0.92) {
          const sheen = this.tileNoise(tile.id, 0.03, 0.075);
          ctx.fillStyle = `rgba(255,255,255,${sheen})`;
          ctx.fillRect(p.x + size * 0.08, p.y + size * 0.08, size * 0.18, size * 0.18);
        }
        if (!simpleTerrain && isSpecial && this.camera.zoom > 0.7) {
          this.drawSpecialWash(ctx, tile, p.x, p.y, size, true);
        }
      } else if (!isSpecial) {
        ctx.fillStyle = type.neutralColor;
        this.roundRect(ctx, p.x + 0.6, p.y + 0.6, size - 1.2, size - 1.2, Math.max(2, size * 0.12));
        ctx.fill();
      } else {
        ctx.fillStyle = type.blocks ? type.neutralColor || type.color || "#55636c" : type.neutralColor;
        const inset = Math.max(0.6, Math.min(3.2, size * 0.08));
        this.roundRect(ctx, p.x + inset, p.y + inset, size - inset * 2, size - inset * 2, Math.max(2, size * 0.18));
        ctx.fill();
        ctx.strokeStyle = type.blocks ? "rgba(236,247,249,0.22)" : "rgba(226, 244, 247, 0.14)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, p.x + inset + 1, p.y + inset + 1, size - inset * 2 - 2, size - inset * 2 - 2, Math.max(2, size * 0.12));
        ctx.stroke();
        if (type.blocks && size > 6) this.drawBlockedLandDetail(ctx, tile, p.x, p.y, size, simpleTerrain);
        if (!simpleTerrain) this.drawSpecialWash(ctx, tile, p.x, p.y, size, false);
      }

      const showIcon =
        !options.strategicView &&
        (options.showIcons || this.camera.zoom > 1.02 || options.selectedTileId === tile.id);
      if (showIcon && type.strategic) this.drawSpecial(ctx, tile, p.x, p.y, size);
      if (tile.building && (options.showIcons || this.camera.zoom > 0.82 || options.selectedTileId === tile.id)) {
        this.drawBuilding(ctx, tile, p.x, p.y, size);
      }
    }

    drawBlockedLandDetail(ctx, tile, x, y, size, simple = false) {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const alpha = simple ? 0.18 : 0.28;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (tile.type === "jungleIsland" || tile.type === "grassIsland") {
        ctx.fillStyle = tile.type === "jungleIsland" ? "#244f32" : "#496b3b";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.3, size * 0.2, this.tileNoise(tile.id, -0.28, 0.28), 0, Math.PI * 2);
        ctx.fill();
        if (!simple && size > 11) {
          ctx.fillStyle = tile.type === "jungleIsland" ? "#7fb05d" : "#b2d477";
          for (let i = 0; i < 3; i += 1) {
            ctx.beginPath();
            ctx.arc(cx + this.tileNoise(tile.id + i * 13, -0.17, 0.17) * size, cy + this.tileNoise(tile.id + i * 17, -0.12, 0.12) * size, size * 0.055, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (tile.type === "riceField") {
        ctx.strokeStyle = "#e1e38b";
        ctx.lineWidth = Math.max(0.7, size * 0.02);
        for (let i = 0; i < (simple ? 2 : 4); i += 1) {
          const yy = y + size * (0.26 + i * 0.14);
          ctx.beginPath();
          ctx.moveTo(x + size * 0.2, yy);
          ctx.lineTo(x + size * 0.8, yy + this.tileNoise(tile.id + i, -0.018, 0.018) * size);
          ctx.stroke();
        }
      } else if (tile.type === "desert") {
        ctx.strokeStyle = "#f4d790";
        ctx.lineWidth = Math.max(0.7, size * 0.02);
        for (let i = 0; i < (simple ? 1 : 2); i += 1) {
          const yy = cy + (i - 0.5) * size * 0.15;
          ctx.beginPath();
          ctx.moveTo(x + size * 0.18, yy);
          ctx.quadraticCurveTo(cx, yy - size * 0.08, x + size * 0.82, yy + size * 0.03);
          ctx.stroke();
        }
      } else if (tile.type === "village") {
        ctx.fillStyle = "#8a5732";
        ctx.fillRect(cx - size * 0.12, cy - size * 0.05, size * 0.1, size * 0.1);
        ctx.fillRect(cx + size * 0.05, cy - size * 0.08, size * 0.11, size * 0.12);
      } else if (tile.type === "log" || tile.type === "bridge") {
        ctx.strokeStyle = tile.type === "bridge" ? "#caa36a" : "#7b5734";
        ctx.lineWidth = Math.max(1.3, size * 0.08);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + size * 0.22, y + size * 0.58);
        ctx.lineTo(x + size * 0.78, y + size * 0.42);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSpecialWash(ctx, tile, x, y, size, owned) {
      const alpha = owned ? 0.11 : 0.22;
      ctx.save();
      ctx.globalAlpha = alpha;
      const cx = x + size / 2;
      const cy = y + size / 2;
      const now = performance.now();
      if (tile.type === "lily") {
        const glow = 0.35 + Math.sin(now * 0.003 + tile.id) * 0.18;
        ctx.globalAlpha = alpha * (1.05 + glow);
        ctx.fillStyle = "rgba(169, 255, 175, 0.26)";
        ctx.beginPath();
        ctx.arc(cx, cy, size * (0.32 + glow * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#a6e6a6";
        ctx.beginPath();
        ctx.ellipse(cx - size * 0.05, cy, size * 0.28, size * 0.16, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d9ffcf";
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + size * 0.18, cy - size * 0.04);
        ctx.stroke();
      } else if (tile.type === "reeds") {
        ctx.strokeStyle = "#d3df8c";
        ctx.lineWidth = Math.max(1, size * 0.05);
        for (let i = -2; i <= 2; i += 1) {
          const lean = (this.tileNoise(tile.id + i * 7, -0.08, 0.08) + Math.sin(now * 0.002 + tile.id + i) * 0.035) * size;
          ctx.beginPath();
          ctx.moveTo(cx + i * size * 0.08, y + size * 0.78);
          ctx.quadraticCurveTo(cx + i * size * 0.08 + lean, cy, cx + i * size * 0.09 + size * 0.05, y + size * 0.22);
          ctx.stroke();
        }
      } else if (tile.type === "mud" || tile.type === "nest") {
        ctx.fillStyle = tile.type === "nest" ? "#f0c16f" : "#b87d4a";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.28, size * 0.18, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tile.type === "nest" ? "rgba(255,238,172,0.22)" : "rgba(67,40,24,0.22)";
        ctx.beginPath();
        ctx.ellipse(cx + size * 0.04, cy - size * 0.02, size * 0.18, size * 0.08, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(3, 10, 15, 0.5)";
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.13, 0.2, Math.PI * 1.8);
        ctx.stroke();
      } else if (tile.type === "rock") {
        ctx.fillStyle = "#d6e0e5";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.26, cy + size * 0.16);
        ctx.lineTo(cx - size * 0.16, cy - size * 0.16);
        ctx.lineTo(cx + size * 0.08, cy - size * 0.26);
        ctx.lineTo(cx + size * 0.28, cy + size * 0.06);
        ctx.lineTo(cx + size * 0.08, cy + size * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.24)";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.12, cy - size * 0.12);
        ctx.lineTo(cx + size * 0.06, cy - size * 0.2);
        ctx.lineTo(cx + size * 0.18, cy + size * 0.02);
        ctx.closePath();
        ctx.fill();
      } else if (tile.type === "jungleIsland" || tile.type === "grassIsland") {
        ctx.globalAlpha = owned ? alpha * 1.3 : alpha;
        ctx.fillStyle = tile.type === "jungleIsland" ? "#315d39" : "#4d7040";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.34, size * 0.25, this.tileNoise(tile.id, -0.35, 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tile.type === "jungleIsland" ? "rgba(130,185,92,0.5)" : "rgba(185,218,126,0.45)";
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(cx + this.tileNoise(tile.id + i * 11, -0.2, 0.2) * size, cy + this.tileNoise(tile.id + i * 17, -0.16, 0.16) * size, size * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (tile.type === "riceField") {
        ctx.globalAlpha = owned ? alpha * 1.2 : alpha;
        ctx.fillStyle = "#9bbf63";
        ctx.fillRect(x + size * 0.15, y + size * 0.18, size * 0.7, size * 0.62);
        ctx.strokeStyle = "rgba(235,244,159,0.72)";
        ctx.lineWidth = Math.max(1, size * 0.025);
        for (let i = 0; i < 4; i += 1) {
          const yy = y + size * (0.26 + i * 0.13);
          ctx.beginPath();
          ctx.moveTo(x + size * 0.18, yy);
          ctx.lineTo(x + size * 0.82, yy + this.tileNoise(tile.id + i, -0.025, 0.025) * size);
          ctx.stroke();
        }
      } else if (tile.type === "desert") {
        ctx.globalAlpha = owned ? alpha : alpha * 0.9;
        ctx.fillStyle = "#c7ad73";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.36, size * 0.22, this.tileNoise(tile.id, -0.28, 0.28), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,238,169,0.55)";
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.moveTo(x + size * 0.18, cy);
        ctx.quadraticCurveTo(cx, cy - size * 0.13, x + size * 0.82, cy + size * 0.04);
        ctx.stroke();
      } else if (tile.type === "log") {
        ctx.globalAlpha = owned ? alpha * 1.25 : alpha;
        ctx.strokeStyle = "#8b633b";
        ctx.lineWidth = Math.max(2, size * 0.13);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + size * 0.2, y + size * 0.58);
        ctx.lineTo(x + size * 0.8, y + size * 0.42);
        ctx.stroke();
        ctx.strokeStyle = "rgba(236,207,142,0.55)";
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.moveTo(x + size * 0.26, y + size * 0.55);
        ctx.lineTo(x + size * 0.74, y + size * 0.43);
        ctx.stroke();
      } else if (tile.type === "bridge") {
        ctx.globalAlpha = owned ? alpha * 1.2 : alpha;
        ctx.strokeStyle = "#b8905b";
        ctx.lineWidth = Math.max(2, size * 0.13);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + size * 0.18, cy);
        ctx.lineTo(x + size * 0.82, cy);
        ctx.stroke();
        ctx.strokeStyle = "rgba(73,46,28,0.46)";
        ctx.lineWidth = Math.max(1, size * 0.03);
        for (let i = 0; i < 4; i += 1) {
          const xx = x + size * (0.28 + i * 0.14);
          ctx.beginPath();
          ctx.moveTo(xx, cy - size * 0.12);
          ctx.lineTo(xx, cy + size * 0.12);
          ctx.stroke();
        }
      } else if (tile.type === "village") {
        ctx.globalAlpha = owned ? alpha * 1.1 : alpha;
        ctx.fillStyle = "#caa36a";
        ctx.fillRect(x + size * 0.28, y + size * 0.42, size * 0.18, size * 0.2);
        ctx.fillRect(x + size * 0.54, y + size * 0.38, size * 0.18, size * 0.24);
        ctx.fillStyle = "#8a5732";
        ctx.beginPath();
        ctx.moveTo(x + size * 0.24, y + size * 0.42);
        ctx.lineTo(x + size * 0.37, y + size * 0.28);
        ctx.lineTo(x + size * 0.5, y + size * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + size * 0.5, y + size * 0.38);
        ctx.lineTo(x + size * 0.63, y + size * 0.24);
        ctx.lineTo(x + size * 0.76, y + size * 0.38);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawSpecial(ctx, tile, x, y, size) {
      const cx = x + size / 2;
      const cy = y + size / 2;
      ctx.save();
      ctx.globalAlpha = 0.92;
      if (tile.type === "rock") {
        ctx.fillStyle = "#b9c5cc";
        ctx.strokeStyle = "rgba(3, 10, 15, 0.42)";
        ctx.lineWidth = Math.max(1, size * 0.035);
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.24, cy + size * 0.18);
        ctx.lineTo(cx - size * 0.12, cy - size * 0.2);
        ctx.lineTo(cx + size * 0.1, cy - size * 0.25);
        ctx.lineTo(cx + size * 0.27, cy + size * 0.07);
        ctx.lineTo(cx + size * 0.05, cy + size * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (tile.type === "lily") {
        ctx.fillStyle = "#9ce39d";
        ctx.beginPath();
        ctx.ellipse(cx - size * 0.03, cy, size * 0.24, size * 0.15, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(7, 19, 29, 0.45)";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + size * 0.16, cy - size * 0.05);
        ctx.lineTo(cx + size * 0.09, cy + size * 0.04);
        ctx.closePath();
        ctx.fill();
      } else if (tile.type === "reeds") {
        ctx.strokeStyle = "#c6d778";
        ctx.lineWidth = Math.max(1, size * 0.045);
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.moveTo(cx + i * size * 0.07, cy + size * 0.25);
          ctx.quadraticCurveTo(cx + i * size * 0.08, cy, cx + i * size * 0.07 + size * 0.04, cy - size * 0.25);
          ctx.stroke();
        }
      } else if (tile.type === "mud" || tile.type === "nest") {
        ctx.fillStyle = tile.type === "nest" ? "#cfa35d" : "#9c7650";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.25, size * 0.16, 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tile.type === "nest" ? "#f2d87a" : "#c29a68";
        ctx.lineWidth = Math.max(1, size * 0.04);
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.14, 0.2, Math.PI * 1.85);
        ctx.stroke();
      } else if (tile.type === "jungleIsland" || tile.type === "grassIsland") {
        ctx.fillStyle = tile.type === "jungleIsland" ? "#315d39" : "#4d7040";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.27, size * 0.2, -0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tile.type === "jungleIsland" ? "#80b95c" : "#b7d77b";
        ctx.beginPath();
        ctx.arc(cx - size * 0.09, cy - size * 0.02, size * 0.07, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.07, cy - size * 0.05, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile.type === "riceField") {
        ctx.fillStyle = "#9bbf63";
        ctx.fillRect(cx - size * 0.22, cy - size * 0.18, size * 0.44, size * 0.36);
        ctx.strokeStyle = "#eef09c";
        ctx.lineWidth = Math.max(1, size * 0.035);
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(cx - size * 0.2, cy + i * size * 0.09);
          ctx.lineTo(cx + size * 0.2, cy + i * size * 0.09);
          ctx.stroke();
        }
      } else if (tile.type === "desert") {
        ctx.fillStyle = "#c7ad73";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.28, size * 0.18, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f0dc98";
        ctx.lineWidth = Math.max(1, size * 0.035);
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.2, cy);
        ctx.quadraticCurveTo(cx, cy - size * 0.1, cx + size * 0.22, cy + size * 0.03);
        ctx.stroke();
      } else if (tile.type === "log" || tile.type === "bridge") {
        ctx.strokeStyle = tile.type === "bridge" ? "#b8905b" : "#8b633b";
        ctx.lineWidth = Math.max(2, size * 0.16);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.23, cy + (tile.type === "log" ? size * 0.08 : 0));
        ctx.lineTo(cx + size * 0.23, cy - (tile.type === "log" ? size * 0.08 : 0));
        ctx.stroke();
      } else if (tile.type === "village") {
        ctx.fillStyle = "#caa36a";
        ctx.fillRect(cx - size * 0.18, cy - size * 0.02, size * 0.16, size * 0.18);
        ctx.fillRect(cx + size * 0.04, cy - size * 0.05, size * 0.16, size * 0.21);
        ctx.fillStyle = "#8a5732";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.22, cy - size * 0.02);
        ctx.lineTo(cx - size * 0.1, cy - size * 0.16);
        ctx.lineTo(cx + size * 0.02, cy - size * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.05);
        ctx.lineTo(cx + size * 0.12, cy - size * 0.19);
        ctx.lineTo(cx + size * 0.24, cy - size * 0.05);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawBuilding(ctx, tile, x, y, size) {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const serverTime = this.state?.serverTime || 0;
      const constructionLeft = Math.max(0, Math.ceil((tile.buildingActiveAt || 0) - serverTime));
      const underConstruction = constructionLeft > 0;
      const conversionLeft = Math.max(0, Math.ceil((tile.buildingConversionUntil || 0) - serverTime));
      const converting = conversionLeft > 0;
      const colors = {
        nest: "#f2d87a",
        lilyFarm: "#8ee6a2",
        reedGuard: "#cddf83",
        mudTunnel: "#c79662",
        jumpPad: "#87d7ea",
      };
      const color = colors[tile.building] || "#edf8fb";
      ctx.save();
      ctx.shadowColor = this.withAlpha(color, 0.38);
      ctx.shadowBlur = Math.max(3, size * 0.18);
      ctx.fillStyle = "rgba(5, 16, 25, 0.82)";
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(5, size * 0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.stroke();

      if (underConstruction) {
        const totalTime =
          tile.buildingPendingEvent === "upgrade"
            ? this.state?.config?.balance?.upgradeTimeSeconds || this.state?.config?.balance?.buildTimeSeconds || 8
            : this.state?.config?.balance?.buildTimeSeconds || 10;
        const progress = Math.max(0.02, Math.min(0.98, 1 - constructionLeft / Math.max(1, totalTime)));
        const ringRadius = Math.max(6, size * 0.25);
        const ringWidth = Math.max(1.3, size * 0.045);
        ctx.lineWidth = ringWidth;
        ctx.strokeStyle = "rgba(237, 248, 251, 0.22)";
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#fff1a8";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.lineCap = "butt";
      } else if (converting) {
        const totalTime = Math.max(1, (tile.buildingConversionUntil || 0) - (tile.buildingCapturedAt || serverTime));
        const progress = Math.max(0.04, Math.min(0.98, 1 - conversionLeft / totalTime));
        const ringRadius = Math.max(6, size * 0.25);
        const ringWidth = Math.max(1.3, size * 0.045);
        ctx.lineWidth = ringWidth;
        ctx.strokeStyle = "rgba(237, 248, 251, 0.2)";
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#83dced";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.lineCap = "butt";
      }

      this.drawBuildingGlyph(ctx, tile.building, cx, cy, Math.max(7, size * 0.42), color);
      if (tile.buildingLevel > 1 && size > 16) {
        ctx.fillStyle = "#edf8fb";
        ctx.font = `900 ${Math.max(6, size * 0.13)}px Inter, sans-serif`;
        ctx.fillText(String(tile.buildingLevel), cx + size * 0.18, cy - size * 0.16);
      }
      if ((underConstruction || converting) && size > 14) {
        const label = underConstruction ? `${constructionLeft}s` : `${conversionLeft}s`;
        const fontSize = Math.max(7, Math.min(12, size * 0.18));
        const labelY = cy + Math.max(8, size * 0.38);
        ctx.font = `950 ${fontSize}px Inter, sans-serif`;
        const width = Math.max(size * 0.42, ctx.measureText(label).width + 8);
        const height = fontSize + 6;
        ctx.fillStyle = "rgba(4, 13, 20, 0.9)";
        ctx.strokeStyle = "rgba(255, 241, 168, 0.62)";
        ctx.lineWidth = Math.max(1, size * 0.025);
        this.roundRect(ctx, cx - width / 2, labelY - height / 2, width, height, Math.max(4, height * 0.42));
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff1a8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx, labelY + 0.3);
      }
      ctx.restore();
    }

    drawBorders(ctx, tile) {
      if (!tile.owner) return;
      const player = this.playerMap.get(tile.owner);
      if (!player) return;
      const size = this.baseTile * this.camera.zoom;
      const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
      const color = tile.owner === this.state.humanId ? "#edf8fb" : this.withAlpha(player.color, 0.98);
      const width = Math.max(1, size * (tile.owner === this.state.humanId ? 0.044 : 0.036));
      this.neighbors(tile).forEach((neighbor, index) => {
        if (neighbor && neighbor.owner === tile.owner) return;
        const neighborPlayer = neighbor?.owner ? this.playerMap.get(neighbor.owner) : null;
        const friendlyTeam = Boolean(neighborPlayer?.teamId && player.teamId && neighborPlayer.teamId === player.teamId);
        const contested = Boolean(neighbor?.owner && neighbor.owner !== tile.owner && !friendlyTeam);
        const points =
          index === 0
            ? [p.x, p.y, p.x + size, p.y]
            : index === 1
              ? [p.x + size, p.y, p.x + size, p.y + size]
              : index === 2
                ? [p.x, p.y + size, p.x + size, p.y + size]
                : [p.x, p.y, p.x, p.y + size];
        this.strokeBorderEdge(ctx, points, friendlyTeam ? player.teamColor || color : color, friendlyTeam ? width * 0.72 : width, contested, friendlyTeam);
      });
    }

    strokeBorderEdge(ctx, points, color, width, contested = false, friendly = false) {
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.strokeStyle = friendly ? this.withAlpha(color, 0.18) : contested ? "rgba(2, 8, 13, 0.88)" : "rgba(3, 10, 15, 0.62)";
      ctx.lineWidth = width + (contested ? 2 : 1.25);
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      ctx.lineTo(points[2], points[3]);
      ctx.stroke();
      if (contested) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = width + 0.7;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        ctx.lineTo(points[2], points[3]);
        ctx.stroke();
      }
      ctx.strokeStyle = friendly ? this.withAlpha(color, 0.68) : color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      ctx.lineTo(points[2], points[3]);
      ctx.stroke();
    }

    drawLocalGlow(ctx, tiles = this.state.tiles) {
      if (this.camera.zoom < 0.42) return;
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      ctx.globalAlpha = 0.14 + Math.sin(performance.now() * 0.004) * 0.04;
      ctx.strokeStyle = "#edf8fb";
      ctx.lineWidth = Math.max(1, size * 0.026);
      tiles.forEach((tile) => {
        if (tile.owner !== this.state.humanId) return;
        if (!this.neighbors(tile).some((neighbor) => neighbor && neighbor.owner !== tile.owner)) return;
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        this.roundRect(ctx, p.x + size * 0.18, p.y + size * 0.18, size * 0.64, size * 0.64, Math.max(3, size * 0.16));
        ctx.stroke();
      });
      ctx.restore();
    }

    drawRegionNames(ctx) {
      if (!this.state.regions || this.camera.zoom < 0.34) return;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.state.regions.forEach((region) => {
        const p = this.worldToScreen((region.x + 0.5) * this.baseTile, (region.y + 0.5) * this.baseTile);
        if (p.x < -120 || p.y < -80 || p.x > this.canvas.clientWidth + 120 || p.y > this.canvas.clientHeight + 80) return;
        ctx.globalAlpha = Math.min(0.46, 0.2 + this.camera.zoom * 0.25);
        ctx.font = `900 ${Math.max(10, 15 * this.camera.zoom)}px Inter, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(4, 12, 18, 0.72)";
        ctx.fillStyle = region.tone || "#d9eef2";
        ctx.strokeText(region.name, p.x, p.y);
        ctx.fillText(region.name, p.x, p.y);
      });
      ctx.restore();
    }

    drawLegalHints(ctx, options) {
      const ids = options.legalTileIds || [];
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      ctx.strokeStyle = options.mode === "special" ? "#f2d87a" : options.mode === "attack" ? "#e9857c" : options.mode === "build" ? "#77d99e" : "#d8c66f";
      ctx.fillStyle =
        options.mode === "special"
          ? "rgba(242, 216, 122, 0.1)"
          : options.mode === "attack"
            ? "rgba(233, 133, 124, 0.08)"
            : options.mode === "build"
              ? "rgba(119, 217, 158, 0.08)"
              : "rgba(216, 198, 111, 0.08)";
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.globalAlpha = 0.72;
      ids.slice(0, 180).forEach((id) => {
        const tile = this.tileMap.get(id);
        if (!tile) return;
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        this.roundRect(ctx, p.x + size * 0.18, p.y + size * 0.18, size * 0.64, size * 0.64, Math.max(2, size * 0.16));
        ctx.fill();
        this.roundRect(ctx, p.x + size * 0.22, p.y + size * 0.22, size * 0.56, size * 0.56, Math.max(2, size * 0.14));
        ctx.stroke();
      });
      ctx.restore();
    }

    drawDefense(ctx, tiles = this.state.tiles) {
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      tiles.forEach((tile) => {
        if (!tile.owner || tile.defenseEnergy < 10) return;
        if (!this.neighbors(tile).some((neighbor) => neighbor && neighbor.owner !== tile.owner)) return;
        const defender = this.playerMap.get(tile.owner);
        const visual = this.animalVisual(defender?.animal);
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        const alpha = Math.max(0.18, Math.min(0.72, tile.defenseEnergy / 90));
        ctx.strokeStyle = this.withAlpha(visual.accent || defender?.color || "#edf8fb", alpha);
        ctx.lineWidth = Math.max(1, size * 0.045);
        this.roundRect(ctx, p.x + size * 0.18, p.y + size * 0.18, size * 0.64, size * 0.64, Math.max(3, size * 0.12));
        ctx.stroke();
        if (size > 10) this.drawAnimalDefenseMotif(ctx, tile, defender?.animal, p.x, p.y, size, alpha);
      });
      ctx.restore();
    }

    drawBorderStatus(ctx, tiles = this.state.tiles, options = {}) {
      if (!options.showBorderStatus || this.camera.zoom < 0.44) return;
      const humanId = this.state.humanId;
      const statusTools = root.PondBorderStatus;
      const legal = new Set(options.legalTileIds || []);
      const active = new Set();
      (this.state.activeAttacks || []).forEach((wave) => {
        if (wave.targetStartTile != null) active.add(wave.targetStartTile);
        (wave.frontierTiles || []).forEach((id) => active.add(id));
      });
      const relationById = new Map((this.state.relationships || []).map((relation) => [relation.playerId, relation]));
      const size = this.baseTile * this.camera.zoom;
      const colors = {
        weak: "#a4f0b5",
        enemy: "#f1c46f",
        war: "#e9857c",
        strong: "#f0a35f",
        reinforced: "#e46a6a",
        defended: "#87d7ea",
        underAttack: "#ffffff",
        allied: "#8ed6ff",
        truce: "#b7d8ce",
        invalid: "#9aa8ad",
      };

      ctx.save();
      tiles.forEach((tile) => {
        const touchesHuman = this.neighbors(tile).some((neighbor) => neighbor && neighbor.owner === humanId);
        const isHumanFront = tile.owner === humanId && this.neighbors(tile).some((neighbor) => neighbor && neighbor.owner !== humanId);
        const isFocus = tile.id === options.selectedTileId || tile.id === options.hoverTileId || legal.has(tile.id);
        if (!touchesHuman && !isHumanFront && !isFocus) return;
        if (!tile.owner && !legal.has(tile.id) && tile.id !== options.hoverTileId) return;

        const type = this.state.config.tileTypes[tile.type];
        const ownerIsHuman = tile.owner === humanId;
        const relation = tile.owner && tile.owner !== humanId ? relationById.get(tile.owner) : null;
        const status = statusTools?.statusFor?.({
          tile,
          tileType: type,
          relation,
          ownerIsHuman,
          canExpand: !tile.owner && legal.has(tile.id),
          canAttack: Boolean(tile.owner && tile.owner !== humanId && touchesHuman),
          underAttack: active.has(tile.id),
          estimatedCost: (tile.defenseEnergy || 0) + (type?.defenseBonus || 0),
        });
        if (!status) return;
        if (status.id === "open" && !isFocus && (tile.defenseEnergy || 0) < 10) return;

        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        const color = colors[status.id] || colors.enemy;
        const alpha = status.id === "reinforced" || status.id === "underAttack" ? 0.9 : isFocus ? 0.74 : 0.5;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.4, size * (status.id === "reinforced" || status.id === "underAttack" ? 0.055 : 0.038));
        this.roundRect(ctx, p.x + size * 0.13, p.y + size * 0.13, size * 0.74, size * 0.74, Math.max(3, size * 0.13));
        ctx.stroke();

        if ((tile.id === options.selectedTileId || tile.id === options.hoverTileId) && size > 17) {
          const text = status.label.replace(" Border", "");
          ctx.globalAlpha = 0.94;
          ctx.font = `800 ${Math.max(8, Math.min(11, size * 0.18))}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const center = this.tileCenter(tile);
          const width = Math.min(86, Math.max(38, ctx.measureText(text).width + 12));
          ctx.fillStyle = "rgba(4, 12, 18, 0.78)";
          this.roundRect(ctx, center.x - width / 2, center.y - size * 0.78, width, 17, 9);
          ctx.fill();
          ctx.fillStyle = color;
          ctx.fillText(text, center.x, center.y - size * 0.78 + 8.5);
        }
      });
      ctx.restore();
    }

    drawSpecialMarkers(ctx) {
      const markers = [];
      (this.state.objectives || []).forEach((objective) => {
        const tile = this.tileMap.get(objective.tileId);
        if (!tile) return;
        markers.push({
          tile,
          kind: "objective",
          type: objective.type,
          active: objective.active,
          owner: objective.owner,
          label: objective.definition?.short || "OB",
          color: objective.definition?.color || "#83dced",
          ring: true,
        });
      });
      (this.state.camps || []).forEach((camp) => {
        const tile = this.tileMap.get(camp.tileId);
        if (!tile) return;
        markers.push({
          tile,
          kind: "camp",
          type: camp.type,
          active: true,
          owner: camp.owner,
          label: camp.definition?.short || "CP",
          color: camp.definition?.color || "#d8ad48",
          ring: false,
        });
      });
      (this.state.players || []).forEach((player) => {
        const tile = player.coreTileId != null ? this.tileMap.get(player.coreTileId) : null;
        if (!tile?.isCore) return;
        const owner = this.playerMap.get(tile.coreOwnerId);
        markers.push({
          tile,
          kind: "core",
          type: "core",
          animal: owner?.animal,
          active: tile.owner === tile.coreOwnerId,
          owner: tile.owner,
          label: owner?.name || "Core",
          color: owner?.color || "#f0cc74",
          ring: true,
        });
      });
      if (!markers.length) return;
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      markers.forEach((marker) => {
        const p = this.tileCenter(marker.tile);
        const pulse = 0.5 + Math.sin(performance.now() * 0.006 + marker.tile.id) * 0.5;
        ctx.globalAlpha = marker.active ? 0.18 + pulse * 0.12 : 0.08;
        ctx.fillStyle = marker.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(10, size * (marker.ring ? 0.72 + pulse * 0.18 : 0.56 + pulse * 0.12)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = marker.active ? 0.42 : 0.18;
        ctx.strokeStyle = marker.color;
        ctx.lineWidth = Math.max(1, size * 0.03);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(10, size * (marker.ring ? 0.88 + pulse * 0.22 : 0.66 + pulse * 0.16)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = marker.active ? 0.9 : 0.35;
        ctx.fillStyle = "rgba(5, 16, 25, 0.82)";
        ctx.strokeStyle = marker.owner === this.state.humanId ? "#ffffff" : marker.color;
        ctx.lineWidth = Math.max(1.2, size * 0.055);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(7, size * (marker.ring ? 0.31 + pulse * 0.05 : 0.26)), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (marker.kind === "core") {
          this.drawAnimalBadge(ctx, marker.animal || "duck", p.x, p.y, Math.max(6, size * 0.24), marker.color, { compact: true });
        } else {
          this.drawObjectiveGlyph(ctx, marker.type, p.x, p.y, Math.max(6, size * 0.28), marker.color);
        }
      });
      ctx.restore();
    }

    drawPreview(ctx, options) {
      const preview = options.preview;
      if (!preview || !preview.tileIds?.length) return;
      const size = this.baseTile * this.camera.zoom;
      const colors = {
        attack: "#e9857c",
        expand: "#77d99e",
        defend: "#87d7ea",
        build: "#f2d87a",
        signal: "#d8ad48",
        special: "#f2d87a",
      };
      const color = colors[preview.mode] || "#edf8fb";
      const pulse = 0.55 + Math.sin(performance.now() * 0.01) * 0.25;

      ctx.save();
      preview.tileIds.slice(0, 120).forEach((id) => {
        const tile = this.tileMap.get(id);
        if (!tile) return;
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        ctx.globalAlpha = 0.14 + pulse * 0.16;
        ctx.fillStyle = color;
        this.roundRect(ctx, p.x + 2, p.y + 2, size - 4, size - 4, Math.max(3, size * 0.13));
        ctx.fill();
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size * 0.04);
        this.roundRect(ctx, p.x + 2, p.y + 2, size - 4, size - 4, Math.max(3, size * 0.13));
        ctx.stroke();
      });

      const from = preview.fromId != null ? this.tileMap.get(preview.fromId) : null;
      const to = preview.toId != null ? this.tileMap.get(preview.toId) : null;
      if (from && to) {
        const a = this.tileCenter(from);
        const b = this.tileCenter(to);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.globalAlpha = 0.86;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(2, size * 0.06);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(angle - 0.55) * 11, b.y - Math.sin(angle - 0.55) * 11);
        ctx.lineTo(b.x - Math.cos(angle + 0.55) * 11, b.y - Math.sin(angle + 0.55) * 11);
        ctx.closePath();
        ctx.fill();
      }

      const labelTile = to || this.tileMap.get(preview.tileIds[0]);
      if (preview.label && labelTile) {
        const p = this.tileCenter(labelTile);
        ctx.globalAlpha = 1;
        ctx.font = "900 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(4, 12, 18, 0.8)";
        ctx.fillStyle = "#edf8fb";
        ctx.strokeText(preview.label, p.x, p.y - size * 0.62);
        ctx.fillText(preview.label, p.x, p.y - size * 0.62);
      }
      ctx.restore();
    }

    drawSelection(ctx, options) {
      const size = this.baseTile * this.camera.zoom;
      const draw = (id, color, width = 0.075) => {
        const tile = this.tileMap.get(id);
        if (!tile) return;
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, size * width);
        this.roundRect(ctx, p.x + 2, p.y + 2, size - 4, size - 4, Math.max(3, size * 0.14));
        ctx.stroke();
      };
      ctx.save();
      (options.sourceIds || []).forEach((id) => draw(id, "#ffffff", 0.08));
      if (options.rallyTileId != null) draw(options.rallyTileId, "#f2d87a", 0.065);
      if (options.selectedTileId != null) draw(options.selectedTileId, "#f2d87a", 0.1);
      if (options.hoverTileId != null) draw(options.hoverTileId, "#9ee7f4", 0.065);
      ctx.restore();
    }

    drawActiveExpansions(ctx) {
      const expansions = this.state.activeExpansions || [];
      if (!expansions.length) return;
      const now = performance.now();
      const pulse = 0.5 + Math.sin(now * 0.011) * 0.5;
      const size = this.baseTile * this.camera.zoom;

      expansions.forEach((wave) => {
        const player = this.playerMap.get(wave.playerId);
        if (!player) return;
        const color = player.color || "#77d99e";
        const source = this.tileMap.get(wave.sourceTile);
        const target = this.tileMap.get(wave.targetStartTile || wave.startTileId);
        if (source && target) {
          const from = this.tileCenter(source);
          const to = this.tileCenter(target);
          const label =
            wave.status === "building"
              ? "Growing"
              : wave.status === "reinforced"
                ? "More"
                : `${Math.max(0, Math.round(wave.remainingBudget || 0))}`;
          this.drawStrategicFlow(ctx, from, to, color, now, 0.45 + pulse * 0.22, label);
        }

        (wave.capturedTiles || []).slice(-16).forEach((id, index) => {
          const tile = this.tileMap.get(id);
          if (!tile) return;
          const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
          ctx.save();
          ctx.globalAlpha = Math.max(0.04, 0.15 - index * 0.006);
          ctx.fillStyle = color;
          this.roundRect(ctx, p.x + 2, p.y + 2, size - 4, size - 4, Math.max(3, size * 0.12));
          ctx.fill();
          ctx.restore();
        });

        (wave.frontierTiles || []).slice(-22).forEach((id) => {
          const tile = this.tileMap.get(id);
          if (!tile) return;
          const center = this.tileCenter(tile);
          ctx.save();
          ctx.globalAlpha = 0.32 + pulse * 0.28;
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2, size * 0.055);
          ctx.beginPath();
          ctx.arc(center.x, center.y, size * (0.28 + pulse * 0.12), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.12 + pulse * 0.08;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(center.x, center.y, size * (0.18 + pulse * 0.08), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });
    }

    drawActiveAttacks(ctx) {
      const attacks = this.state.activeAttacks || [];
      if (!attacks.length) return;
      const now = performance.now();
      const pulse = 0.5 + Math.sin(now * 0.012) * 0.5;
      const size = this.baseTile * this.camera.zoom;

      attacks.forEach((wave) => {
        const attacker = this.playerMap.get(wave.attackerId);
        if (!attacker) return;
        if (wave.currentPush) {
          this.drawCurrentPush(ctx, wave, attacker, now, pulse);
          return;
        }
        const animalVisual = this.animalVisual(attacker.animal);
        const color = animalVisual.badge || attacker.color;
        const source = this.tileMap.get(wave.sourceTile);
        const target = this.tileMap.get(wave.targetStartTile);

        if (source && target) {
          const from = this.tileCenter(source);
          const to = this.tileCenter(target);
          const label = wave.routeAttack
            ? "Current"
            : wave.status === "contested"
              ? "Contested"
              : wave.status === "stalled"
                ? "Stalled"
                : `${Math.max(0, Math.round(wave.remainingBudget ?? wave.remainingPower ?? 0))}`;
          this.drawStrategicFlow(ctx, from, to, color, now, 0.75 + pulse * 0.35, label);
        }

        wave.capturedTiles.slice(-18).forEach((id, index) => {
          const tile = this.tileMap.get(id);
          if (!tile) return;
          const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
          ctx.save();
          ctx.globalAlpha = Math.max(0.05, 0.2 - index * 0.008);
          ctx.fillStyle = color;
          this.roundRect(ctx, p.x + 2, p.y + 2, size - 4, size - 4, Math.max(3, size * 0.12));
          ctx.fill();
          ctx.restore();
        });

        wave.frontierTiles.forEach((id) => {
          const tile = this.tileMap.get(id);
          if (!tile) return;
          const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
          ctx.save();
          ctx.globalAlpha = 0.45 + pulse * 0.35;
          ctx.strokeStyle = wave.status === "contested" ? "#f2d87a" : wave.status === "stalled" ? "#edf8fb" : color;
          ctx.lineWidth = Math.max(2, size * 0.07);
          ctx.beginPath();
          ctx.arc(p.x + size / 2, p.y + size / 2, size * (0.24 + pulse * 0.1), 0, Math.PI * 2);
          ctx.stroke();
          if (size > 9) this.drawAnimalAttackMotif(ctx, attacker.animal, p.x + size / 2, p.y + size / 2, size, color, pulse);
          ctx.restore();
        });
      });
    }

    drawSpecialOverlays(ctx) {
      const specials = this.state.specials || {};
      const pending = specials.pending || [];
      const zones = specials.zones || [];
      if (!pending.length && !zones.length) return;
      const size = this.baseTile * this.camera.zoom;
      const nowMs = performance.now();
      const pulse = 0.5 + Math.sin(nowMs * 0.01) * 0.5;
      const colors = {
        lilyBarrage: "#f2d87a",
        dragonflyGuard: "#87d7ea",
        reedShield: "#8ddf96",
      };

      ctx.save();
      zones.forEach((zone) => {
        const tile = this.tileMap.get(zone.tileId);
        if (!tile) return;
        const center = this.tileCenter(tile);
        const color = colors[zone.type] || "#edf8fb";
        const radius = Math.max(size * 0.8, (zone.radius || 3) * size);
        const left = Math.ceil(zone.remaining || 0);
        ctx.globalAlpha = 0.17;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.62 + pulse * 0.18;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, size * 0.055);
        ctx.setLineDash(zone.type === "dragonflyGuard" ? [Math.max(5, size * 0.18), Math.max(4, size * 0.14)] : []);
        ctx.lineDashOffset = -nowMs * 0.025;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (size > 9 && left > 0) this.drawPillText(ctx, zone.type === "reedShield" ? `Shield ${left}s` : `Guard ${left}s`, center.x, center.y - radius - 10, color);
      });

      pending.forEach((strike) => {
        const tile = this.tileMap.get(strike.tileId);
        if (!tile) return;
        const center = this.tileCenter(tile);
        const color = colors[strike.type] || colors.lilyBarrage;
        const radius = Math.max(size * 0.9, (strike.radius || 2) * size);
        const left = Math.ceil(strike.remaining || 0);
        ctx.globalAlpha = 0.16 + pulse * 0.08;
        ctx.fillStyle = "#f2d87a";
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2.2, size * 0.07);
        ctx.setLineDash([Math.max(5, size * 0.18), Math.max(4, size * 0.13)]);
        ctx.lineDashOffset = -nowMs * 0.04;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (size > 8) this.drawPillText(ctx, `Lily ${left}s`, center.x, center.y - radius - 12, color);
      });
      ctx.restore();
    }

    drawCurrentPush(ctx, wave, attacker, now, pulse) {
      const route = (wave.routeTiles || []).map((id) => this.tileMap.get(id)).filter(Boolean);
      const target = this.tileMap.get(wave.targetStartTile);
      if (!target || !route.length) return;
      const color = "#87d7ea";
      const targetCenter = this.tileCenter(target);
      const points = route.map((tile) => this.tileCenter(tile)).concat(targetCenter);
      const size = this.baseTile * this.camera.zoom;
      const progress = Math.max(0, Math.min(1, Number(wave.progress || 0)));
      const markerIndex = Math.min(points.length - 1, Math.floor(progress * Math.max(1, points.length - 1)));
      const marker = points[markerIndex] || points[0];
      const impactLeft = Math.max(0, Math.ceil((wave.impactTime || 0) - (this.state.serverTime || 0)));

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = this.withAlpha(color, 0.82);
      ctx.lineWidth = Math.max(3, size * 0.11);
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      ctx.globalAlpha = 0.88;
      ctx.strokeStyle = this.withAlpha(attacker.color, 0.9);
      ctx.lineWidth = Math.max(1.5, size * 0.035);
      ctx.setLineDash([Math.max(4, size * 0.22), Math.max(5, size * 0.18)]);
      ctx.lineDashOffset = -now * 0.025;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.shadowColor = this.withAlpha(color, 0.55);
      ctx.shadowBlur = Math.max(8, size * 0.34);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, Math.max(4, size * 0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#edf8fb";
      ctx.lineWidth = Math.max(1, size * 0.025);
      ctx.stroke();

      ctx.globalAlpha = 0.62 + pulse * 0.28;
      ctx.strokeStyle = "#fff1a8";
      ctx.lineWidth = Math.max(2, size * 0.06);
      ctx.beginPath();
      ctx.arc(targetCenter.x, targetCenter.y, size * (0.34 + pulse * 0.16), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (impactLeft > 0 && size > 8) {
        const label = `${impactLeft}s`;
        ctx.font = `950 ${Math.max(9, Math.min(13, size * 0.24))}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const width = ctx.measureText(label).width + 14;
        const height = Math.max(18, size * 0.42);
        this.roundRect(ctx, targetCenter.x - width / 2, targetCenter.y - size * 0.66 - height / 2, width, height, 999);
        ctx.fillStyle = "rgba(4, 13, 20, 0.88)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 241, 168, 0.62)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff1a8";
        ctx.fillText(label, targetCenter.x, targetCenter.y - size * 0.66 + 0.4);
      }
      ctx.restore();
    }

    drawStrategicFlow(ctx, from, to, color, now, strength = 1, label = "") {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normal = { x: -dy / distance, y: dx / distance };
      const lift = Math.min(34, distance * 0.18);
      const c1 = { x: from.x + dx * 0.34 + normal.x * lift, y: from.y + dy * 0.34 + normal.y * lift };
      const c2 = { x: from.x + dx * 0.66 + normal.x * lift, y: from.y + dy * 0.66 + normal.y * lift };
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      ctx.globalAlpha = Math.min(0.82, 0.32 * strength);
      ctx.strokeStyle = this.withAlpha(color, 0.88);
      ctx.lineWidth = Math.max(2, size * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
      ctx.stroke();

      ctx.globalAlpha = Math.min(1, 0.68 * strength);
      ctx.fillStyle = color;
      const dotCount = Math.max(2, Math.min(5, Math.floor(distance / Math.max(22, size * 1.2))));
      for (let i = 0; i < dotCount; i += 1) {
        const t = ((now * 0.0016 + i / dotCount) % 1);
        const p = this.cubicPoint(from, c1, c2, to, t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2.2, size * 0.075) * (1 - t * 0.22), 0, Math.PI * 2);
        ctx.fill();
      }

      const head = this.cubicPoint(from, c1, c2, to, 0.92);
      const angle = Math.atan2(to.y - head.y, to.x - head.x);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - Math.cos(angle - 0.52) * Math.max(8, size * 0.34), to.y - Math.sin(angle - 0.52) * Math.max(8, size * 0.34));
      ctx.lineTo(to.x - Math.cos(angle + 0.52) * Math.max(8, size * 0.34), to.y - Math.sin(angle + 0.52) * Math.max(8, size * 0.34));
      ctx.closePath();
      ctx.fill();
      if (label) {
        const mid = this.cubicPoint(from, c1, c2, to, 0.55);
        this.drawPillText(ctx, label, mid.x, mid.y - size * 0.28, color);
      }
      ctx.restore();
    }

    cubicPoint(a, b, c, d, t) {
      const mt = 1 - t;
      return {
        x: mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
        y: mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
      };
    }

    animalVisual(animalId) {
      return root.PondAnimalVisuals?.animals?.[animalId] || {
        id: animalId || "duck",
        label: this.state?.config?.animals?.[animalId]?.label || "Animal",
        short: this.state?.config?.animals?.[animalId]?.icon || "A",
        badge: this.state?.config?.animals?.[animalId]?.color || "#83dced",
        accent: "#edf8fb",
        dark: "#0b2634",
      };
    }

    playerAnchorTile(player) {
      if (!player) return null;
      const core = player.coreTileId != null ? this.tileMap.get(player.coreTileId) : null;
      if (core) return core;
      return this.state.tiles.find((tile) => tile.owner === player.id) || null;
    }

    drawAnimalPresence(ctx, options = {}) {
      if (!options.showAnimalIcons || !this.state?.players?.length) return;
      const size = this.baseTile * this.camera.zoom;
      const zoom = this.camera.zoom;
      const spriteAllowed = options.showAnimalSprites && !options.strategicView && zoom > 0.62;
      const limit = zoom > 0.72 ? 26 : zoom > 0.42 ? 18 : 12;
      const players = this.state.players
        .filter((player) => !player.defeated && player.ownedTiles > 0)
        .slice()
        .sort((a, b) => (b.id === this.state.humanId ? 1 : 0) - (a.id === this.state.humanId ? 1 : 0) || b.territory - a.territory)
        .slice(0, limit);
      ctx.save();
      players.forEach((player, index) => {
        const tile = this.playerAnchorTile(player);
        if (!tile) return;
        const p = this.tileCenter(tile);
        if (p.x < -30 || p.y < -30 || p.x > this.canvas.clientWidth + 30 || p.y > this.canvas.clientHeight + 30) return;
        const radius = Math.max(spriteAllowed ? 11 : 7, size * (spriteAllowed ? 0.48 : 0.31));
        const offsetX = size * (0.3 + this.tileNoise(tile.id + 41, -0.12, 0.12));
        const offsetY = -size * (0.35 + this.tileNoise(tile.id + 43, -0.08, 0.12));
        const x = p.x + offsetX;
        const y = p.y + offsetY;
        const animate = options.showAnimalAnimations && !options.effects?.reducedMotion;
        if (spriteAllowed) this.drawAnimalSprite(ctx, player.animal, x, y, radius, player.color, { animate, seed: tile.id + index * 17, player });
        else this.drawAnimalBadge(ctx, player.animal, x, y, radius, player.color, { compact: true });
      });
      ctx.restore();
    }

    drawAnimalBadge(ctx, animalId, x, y, radius, ownerColor = "#83dced", options = {}) {
      const visual = this.animalVisual(animalId);
      const fill = visual.badge || ownerColor;
      const accent = visual.accent || "#edf8fb";
      ctx.save();
      ctx.shadowColor = this.withAlpha(fill, options.compact ? 0.22 : 0.35);
      ctx.shadowBlur = Math.max(2, radius * 0.5);
      ctx.fillStyle = "rgba(4, 13, 20, 0.84)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.max(1, radius * 0.16);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = this.withAlpha(fill, 0.18);
      ctx.fill();
      this.drawAnimalGlyph(ctx, animalId, x, y, radius * 0.82, fill, accent, options);
      ctx.restore();
    }

    drawAnimalSprite(ctx, animalId, x, y, radius, ownerColor = "#83dced", options = {}) {
      const visual = this.animalVisual(animalId);
      const fill = visual.badge || ownerColor;
      const accent = visual.accent || "#edf8fb";
      const now = performance.now();
      const wobble = options.animate ? Math.sin(now * 0.003 + (options.seed || 0)) * radius * 0.12 : 0;
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = "rgba(210, 247, 250, 0.13)";
      ctx.beginPath();
      ctx.ellipse(x, y + radius * 0.65, radius * 1.15, radius * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      if (animalId === "frog") {
        ctx.fillStyle = "rgba(156, 227, 157, 0.34)";
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.35, radius * 1.15, radius * 0.52, -0.18, 0, Math.PI * 2);
        ctx.fill();
      } else if (animalId === "snake") {
        ctx.strokeStyle = this.withAlpha(fill, 0.38);
        ctx.lineWidth = Math.max(1, radius * 0.18);
        ctx.beginPath();
        ctx.moveTo(x - radius * 1.2, y + radius * 0.28);
        ctx.quadraticCurveTo(x - radius * 0.35, y - radius * 0.3 + wobble, x + radius * 0.45, y + radius * 0.18);
        ctx.quadraticCurveTo(x + radius * 0.9, y + radius * 0.45, x + radius * 1.28, y - radius * 0.1);
        ctx.stroke();
      } else if (animalId === "carp") {
        ctx.strokeStyle = this.withAlpha(accent, 0.34);
        ctx.lineWidth = Math.max(1, radius * 0.1);
        ctx.beginPath();
        ctx.moveTo(x - radius * 1.2, y + radius * 0.55);
        ctx.quadraticCurveTo(x, y + radius * 0.1 + wobble, x + radius * 1.25, y + radius * 0.48);
        ctx.stroke();
      }
      this.drawAnimalBadge(ctx, animalId, x, y + wobble, radius, ownerColor, { compact: false });
      ctx.restore();
    }

    drawAnimalGlyph(ctx, animalId, x, y, r, color = "#83dced", accent = "#edf8fb") {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = color;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, r * 0.12);
      if (animalId === "duck") {
        ctx.beginPath();
        ctx.ellipse(x - r * 0.08, y + r * 0.08, r * 0.48, r * 0.3, -0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + r * 0.28, y - r * 0.15, r * 0.23, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.45, y - r * 0.16);
        ctx.lineTo(x + r * 0.76, y - r * 0.06);
        ctx.lineTo(x + r * 0.46, y + r * 0.04);
        ctx.closePath();
        ctx.fill();
      } else if (animalId === "snake") {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, r * 0.22);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.62, y + r * 0.08);
        ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.42, x + r * 0.22, y - r * 0.02);
        ctx.quadraticCurveTo(x + r * 0.48, y + r * 0.24, x + r * 0.64, y - r * 0.2);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x + r * 0.66, y - r * 0.22, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      } else if (animalId === "frog") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y + r * 0.1, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x - r * 0.22, y - r * 0.23, r * 0.15, 0, Math.PI * 2);
        ctx.arc(x + r * 0.22, y - r * 0.23, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
      } else if (animalId === "turtle") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.04, r * 0.52, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1, r * 0.09);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.28, y - r * 0.06);
        ctx.lineTo(x + r * 0.28, y - r * 0.06);
        ctx.moveTo(x, y - r * 0.32);
        ctx.lineTo(x, y + r * 0.36);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x + r * 0.58, y, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      } else if (animalId === "carp") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.04, y, r * 0.5, r * 0.28, -0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.48, y);
        ctx.lineTo(x - r * 0.78, y - r * 0.25);
        ctx.lineTo(x - r * 0.74, y + r * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.arc(x + r * 0.08, y, r * 0.2, -0.8, 0.8);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawAnimalAttackMotif(ctx, animalId, x, y, size, color, pulse = 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.48 + pulse * 0.26;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.035);
      if (animalId === "duck") {
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x - size * 0.28, y + i * size * 0.08);
          ctx.lineTo(x + size * 0.24, y + i * size * 0.02);
          ctx.stroke();
        }
      } else if (animalId === "snake") {
        ctx.beginPath();
        ctx.moveTo(x - size * 0.28, y + size * 0.12);
        ctx.lineTo(x, y - size * 0.18);
        ctx.lineTo(x + size * 0.28, y + size * 0.12);
        ctx.stroke();
      } else if (animalId === "frog") {
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.28, size * 0.12, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (animalId === "turtle") {
        ctx.beginPath();
        ctx.arc(x, y, size * (0.18 + pulse * 0.05), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - size * 0.16, y);
        ctx.lineTo(x + size * 0.16, y);
        ctx.stroke();
      } else if (animalId === "carp") {
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(x - size * 0.18 + i * size * 0.16, y, size * 0.08, -1.1, 1.1);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawAnimalDefenseMotif(ctx, tile, animalId, x, y, size, alpha = 0.5) {
      const visual = this.animalVisual(animalId);
      const color = visual.accent || visual.badge || "#edf8fb";
      const cx = x + size / 2;
      const cy = y + size / 2;
      ctx.save();
      ctx.globalAlpha = Math.min(0.72, alpha);
      ctx.strokeStyle = color;
      ctx.fillStyle = this.withAlpha(color, 0.2);
      ctx.lineWidth = Math.max(1, size * 0.03);
      if (animalId === "snake") {
        ctx.setLineDash([Math.max(2, size * 0.12), Math.max(2, size * 0.08)]);
        this.roundRect(ctx, x + size * 0.22, y + size * 0.22, size * 0.56, size * 0.56, Math.max(3, size * 0.16));
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (animalId === "frog") {
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.22, size * 0.1, -0.25, 0, Math.PI * 2);
        ctx.stroke();
      } else if (animalId === "turtle") {
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.18, cy);
        ctx.lineTo(cx + size * 0.18, cy);
        ctx.moveTo(cx, cy - size * 0.18);
        ctx.lineTo(cx, cy + size * 0.18);
        ctx.stroke();
      } else if (animalId === "carp") {
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.arc(cx + i * size * 0.12, cy, size * 0.08, -1.1, 1.1);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.2, cy + size * 0.08);
        ctx.quadraticCurveTo(cx, cy - size * 0.13, cx + size * 0.2, cy + size * 0.08);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBuildingGlyph(ctx, building, x, y, r, color = "#83dced") {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.lineCap = "round";
      if (building === "nest") {
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.08, r * 0.48, r * 0.28, -0.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - r * 0.16, y - r * 0.05, r * 0.12, 0, Math.PI * 2);
        ctx.arc(x + r * 0.12, y - r * 0.02, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (building === "lilyFarm") {
        ctx.beginPath();
        ctx.ellipse(x - r * 0.12, y, r * 0.36, r * 0.18, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff1a8";
        ctx.beginPath();
        ctx.arc(x + r * 0.18, y - r * 0.08, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else if (building === "reedGuard") {
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x + i * r * 0.16, y + r * 0.42);
          ctx.quadraticCurveTo(x + i * r * 0.1, y, x + i * r * 0.16 + r * 0.08, y - r * 0.42);
          ctx.stroke();
        }
      } else if (building === "mudTunnel") {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.36, 0.2, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.18, Math.PI * 1.2, Math.PI * 2.4);
        ctx.stroke();
      } else if (building === "jumpPad") {
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.16, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.22, y - r * 0.02);
        ctx.quadraticCurveTo(x, y - r * 0.5, x + r * 0.24, y - r * 0.02);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawObjectiveGlyph(ctx, type, x, y, r, color = "#83dced") {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.lineCap = "round";
      if (type === "goldenLily") {
        ctx.beginPath();
        ctx.ellipse(x - r * 0.08, y, r * 0.38, r * 0.22, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff1a8";
        ctx.beginPath();
        ctx.arc(x + r * 0.25, y - r * 0.08, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "ancientReed") {
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x + i * r * 0.16, y + r * 0.42);
          ctx.quadraticCurveTo(x + i * r * 0.08, y, x + i * r * 0.16 + r * 0.08, y - r * 0.44);
          ctx.stroke();
        }
      } else if (type === "mudSpring") {
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.1, r * 0.42, r * 0.24, 0.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - r * 0.16, y - r * 0.2, r * 0.09, 0, Math.PI * 2);
        ctx.arc(x + r * 0.18, y - r * 0.28, r * 0.07, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "clearWaterShrine") {
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.48);
        ctx.lineTo(x + r * 0.38, y);
        ctx.lineTo(x, y + r * 0.48);
        ctx.lineTo(x - r * 0.38, y);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "deepCurrent") {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y + r * 0.08);
        ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.28, x + r * 0.12, y + r * 0.04);
        ctx.quadraticCurveTo(x + r * 0.3, y + r * 0.22, x + r * 0.52, y - r * 0.08);
        ctx.stroke();
      } else if (type === "turtleCamp") {
        this.drawAnimalGlyph(ctx, "turtle", x, y, r, color, "#edf8fb");
      } else if (type === "crabCamp") {
        ctx.beginPath();
        ctx.arc(x - r * 0.18, y, r * 0.18, Math.PI * 0.2, Math.PI * 1.65);
        ctx.arc(x + r * 0.18, y, r * 0.18, Math.PI * 1.35, Math.PI * 2.8);
        ctx.stroke();
      } else if (type === "otterCamp") {
        ctx.beginPath();
        ctx.arc(x, y + r * 0.12, r * 0.16, 0, Math.PI * 2);
        ctx.arc(x - r * 0.22, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
        ctx.arc(x, y - r * 0.18, r * 0.1, 0, Math.PI * 2);
        ctx.arc(x + r * 0.22, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "dragonflySwarm") {
        ctx.beginPath();
        ctx.ellipse(x - r * 0.18, y - r * 0.1, r * 0.2, r * 0.1, -0.5, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.18, y - r * 0.1, r * 0.2, r * 0.1, 0.5, 0, Math.PI * 2);
        ctx.ellipse(x - r * 0.12, y + r * 0.12, r * 0.16, r * 0.08, 0.5, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.12, y + r * 0.12, r * 0.16, r * 0.08, -0.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawMiniAnimalMarkers(ctx, cellW, cellH, options = {}) {
      if (!options.showAnimalIcons) return;
      ctx.save();
      this.state.players
        .filter((player) => !player.defeated && player.ownedTiles > 0)
        .forEach((player) => {
          const tile = this.playerAnchorTile(player);
          if (!tile) return;
          const visual = this.animalVisual(player.animal);
          const x = (tile.x + 0.5) * cellW;
          const y = (tile.y + 0.5) * cellH;
          const r = player.id === this.state.humanId ? 4.4 : 3.4;
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = "rgba(5, 16, 25, 0.86)";
          ctx.beginPath();
          ctx.arc(x, y, r + 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = visual.badge || player.color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = player.teamColor || "#edf8fb";
          ctx.lineWidth = player.id === this.state.humanId ? 1.3 : 0.8;
          ctx.stroke();
        });
      ctx.restore();
    }

    drawNames(ctx) {
      const labelLimit = this.camera.zoom > 0.72 ? 12 : this.camera.zoom > 0.48 ? 8 : 5;
      const leaders = this.state.players
        .filter((player) => !player.defeated)
        .slice()
        .sort((a, b) => b.territory - a.territory)
        .slice(0, labelLimit)
        .map((player) => player.id);
      if (!leaders.includes(this.state.humanId)) leaders.push(this.state.humanId);
      leaders.forEach((id) => {
        const tiles = this.state.tiles.filter((tile) => tile.owner === id);
        if (!tiles.length) return;
        const avg = tiles.reduce((sum, tile) => ({ x: sum.x + tile.x, y: sum.y + tile.y }), { x: 0, y: 0 });
        const x = (avg.x / tiles.length + 0.5) * this.baseTile;
        const y = (avg.y / tiles.length + 0.5) * this.baseTile;
        const p = this.worldToScreen(x, y);
        const player = this.playerMap.get(id);
        if (!player) return;
        const visual = this.animalVisual(player.animal);
        const fontSize = Math.max(10, 13 * this.camera.zoom);
        const small = this.camera.zoom < 0.58;
        const badgeR = Math.max(7, fontSize * (small ? 0.66 : 0.78));
        ctx.textBaseline = "middle";
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
        const firstName = (player.name || "Player").split(" ")[0];
        const name = `${player.teamBadge ? `${player.teamBadge} ` : ""}${firstName}`;
        const detail = small ? "" : `${visual.label || player.animal} L${player.level || 1}`;
        const nameW = ctx.measureText(name).width;
        ctx.font = `800 ${Math.max(8, fontSize * 0.68)}px Inter, sans-serif`;
        const detailW = detail ? ctx.measureText(detail).width : 0;
        const textW = Math.max(nameW, detailW);
        const plateW = Math.max(42, badgeR * 2 + textW + 22);
        const plateH = small ? Math.max(22, badgeR * 2 + 5) : Math.max(34, badgeR * 2 + 9);
        const left = p.x - plateW / 2;
        const top = p.y - plateH / 2;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(3, 12, 19, 0.58)";
        this.roundRect(ctx, left, top, plateW, plateH, 8);
        ctx.fill();
        ctx.strokeStyle = this.withAlpha(player.color, id === this.state.humanId ? 0.92 : 0.62);
        ctx.lineWidth = id === this.state.humanId ? 1.6 : 1;
        this.roundRect(ctx, left, top, plateW, plateH, 8);
        ctx.stroke();
        if (player.teamColor) {
          ctx.strokeStyle = this.withAlpha(player.teamColor, 0.72);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(left + 6, top + plateH - 3);
          ctx.lineTo(left + plateW - 6, top + plateH - 3);
          ctx.stroke();
        }
        this.drawAnimalBadge(ctx, player.animal, left + badgeR + 6, p.y, badgeR, player.color, { compact: true });
        ctx.restore();
        ctx.textAlign = "left";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(6,16,25,0.86)";
        ctx.fillStyle = "#edf8fb";
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
        const textX = left + badgeR * 2 + 12;
        const nameY = small ? p.y + 0.5 : p.y - fontSize * 0.23;
        ctx.strokeText(name, textX, nameY);
        ctx.fillText(name, textX, nameY);
        if (detail) {
          ctx.font = `800 ${Math.max(8, fontSize * 0.66)}px Inter, sans-serif`;
          ctx.fillStyle = this.withAlpha(visual.accent || "#bceaf0", 0.96);
          ctx.strokeText(detail, textX, p.y + fontSize * 0.56);
          ctx.fillText(detail, textX, p.y + fontSize * 0.56);
        }
      });
    }

    drawEvents(ctx, options = {}) {
      if (options.effects?.reducedMotion && this.camera.zoom < 0.58) return;
      const now = performance.now();
      this.eventAnims = this.eventAnims.filter((event) => now - event.atMs < (event.kind === "ping" || event.kind === "teamCommand" ? 6000 : 1800));
      this.eventAnims.forEach((event) => {
        const life = event.kind === "ping" || event.kind === "teamCommand" ? 6000 : event.kind === "attackWave" ? 1800 : 1450;
        const t = Math.min(1, (now - event.atMs) / life);
        const to = this.tileMap.get(event.to);
        if (!to) return;
        const toP = this.tileCenter(to);
        const player = event.playerId ? this.playerMap.get(event.playerId) : null;
        const color = event.teamColor || (event.kind === "waveResist" ? "#edf8fb" : player?.color || "#d8ad48");
        ctx.save();
        ctx.globalAlpha = 1 - t;
        if (event.kind === "ping" || event.kind === "teamCommand") {
          const label = event.label || root.PondInfo?.PING_LABELS?.[event.pingType] || "Ping";
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(toP.x, toP.y, 5 + t * 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = "900 12px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(4, 12, 18, 0.8)";
          ctx.fillStyle = "#edf8fb";
          ctx.strokeText(label, toP.x, toP.y - 18 - t * 18);
          ctx.fillText(label, toP.x, toP.y - 18 - t * 18);
          ctx.restore();
          return;
        }
        if (event.from != null) {
          const from = this.tileMap.get(event.from) || to;
          const fromP = this.tileCenter(from);
          const mid = { x: fromP.x + (toP.x - fromP.x) * t, y: fromP.y + (toP.y - fromP.y) * t };
          this.drawStrategicFlow(ctx, fromP, toP, color, now, 0.45 + (1 - t) * 0.45);
          if (event.amount) {
            const label =
              event.kind === "waveCapture"
                ? "Captured"
                : event.kind === "expandProgress"
                  ? `${event.progress}/${event.cost}`
                : event.kind === "waveResist"
                  ? "Blocked"
                : event.kind === "attackWave"
                  ? `-${event.amount}`
                  : String(event.amount);
            this.drawPillText(ctx, label, mid.x, mid.y - 12, color);
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(toP.x, toP.y, 6 + t * 22, 0, Math.PI * 2);
        ctx.stroke();
        if (event.kind === "waveCapture") {
          ctx.globalAlpha = Math.max(0, 0.28 * (1 - t));
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(toP.x, toP.y, 5 + t * 18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    drawMiniMap(options) {
      if (!this.state) return;
      const now = performance.now();
      const totalTiles = this.state.tiles.length;
      const interval = options.isMobile ? 700 : totalTiles > 14000 ? 650 : totalTiles > 9000 ? 480 : 240;
      const dirtyThrottle = totalTiles > 14000 ? 320 : totalTiles > 9000 ? 220 : 80;
      if (this.miniMapDirty && now - this.lastMiniMapDrawAt < dirtyThrottle) return;
      if (!this.miniMapDirty && now - this.lastMiniMapDrawAt < interval) return;
      this.lastMiniMapDrawAt = now;
      this.miniMapDirty = false;
      const ctx = this.miniCtx;
      const rect = this.miniMap.getBoundingClientRect();
      const cellW = rect.width / this.state.cols;
      const cellH = rect.height / this.state.rows;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const bg = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      bg.addColorStop(0, "#0f3345");
      bg.addColorStop(1, "#071d2b");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, rect.width, rect.height);
      const human = this.playerMap.get(this.state.humanId);
      let humanBounds = null;
      let teamBounds = null;
      const includeBounds = (bounds, tile) => {
        if (!bounds) return { minX: tile.x, minY: tile.y, maxX: tile.x, maxY: tile.y };
        bounds.minX = Math.min(bounds.minX, tile.x);
        bounds.minY = Math.min(bounds.minY, tile.y);
        bounds.maxX = Math.max(bounds.maxX, tile.x);
        bounds.maxY = Math.max(bounds.maxY, tile.y);
        return bounds;
      };
      this.state.tiles.forEach((tile) => {
        const type = this.state.config.tileTypes[tile.type];
        const owner = tile.owner ? this.playerMap.get(tile.owner) : null;
        ctx.fillStyle = owner ? owner.color : type.blocks ? type.neutralColor || type.color || "#66717a" : "#276072";
        ctx.globalAlpha = owner ? 0.94 : type.blocks ? 0.68 : type.strategic ? 0.32 : 0.18;
        ctx.fillRect(tile.x * cellW, tile.y * cellH, Math.ceil(cellW), Math.ceil(cellH));
        if (tile.owner === this.state.humanId) humanBounds = includeBounds(humanBounds, tile);
        if (human?.teamId && owner?.teamId === human.teamId) teamBounds = includeBounds(teamBounds, tile);
      });
      ctx.globalAlpha = 1;
      this.drawMiniObjectives(ctx, cellW, cellH);
      this.drawMiniLakeEvent(ctx, cellW, cellH, options);
      this.drawMiniAnimalMarkers(ctx, cellW, cellH, options);
      this.drawMiniPings(ctx, cellW, cellH);
      if (humanBounds) {
        const minX = humanBounds.minX * cellW;
        const minY = humanBounds.minY * cellH;
        const maxX = (humanBounds.maxX + 1) * cellW;
        const maxY = (humanBounds.maxY + 1) * cellH;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(minX, minY, Math.max(3, maxX - minX), Math.max(3, maxY - minY));
      }
      if (teamBounds) {
        const minX = teamBounds.minX * cellW;
        const minY = teamBounds.minY * cellH;
        const maxX = (teamBounds.maxX + 1) * cellW;
        const maxY = (teamBounds.maxY + 1) * cellH;
        ctx.strokeStyle = human.teamColor || "#83dced";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(minX, minY, Math.max(4, maxX - minX), Math.max(4, maxY - minY));
        ctx.setLineDash([]);
      }
      this.drawMiniAttacks(ctx, cellW, cellH, options);
      this.drawMiniCamera(ctx, rect, cellW, cellH);
      const shine = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      shine.addColorStop(0, "rgba(255,255,255,0.12)");
      shine.addColorStop(0.42, "rgba(255,255,255,0)");
      shine.addColorStop(1, "rgba(255,255,255,0.06)");
      ctx.fillStyle = shine;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "rgba(223,248,252,0.42)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, rect.width - 1, rect.height - 1);
    }

    drawMiniObjectives(ctx, cellW, cellH) {
      ctx.save();
      (this.state.objectives || []).forEach((objective) => {
        if (!objective.active) return;
        const tile = this.tileMap.get(objective.tileId);
        if (!tile) return;
        ctx.fillStyle = objective.definition?.color || "#83dced";
        ctx.strokeStyle = "#061019";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc((tile.x + 0.5) * cellW, (tile.y + 0.5) * cellH, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      (this.state.camps || []).forEach((camp) => {
        const tile = this.tileMap.get(camp.tileId);
        if (!tile) return;
        ctx.fillStyle = camp.definition?.color || "#d8ad48";
        ctx.fillRect((tile.x + 0.5) * cellW - 2, (tile.y + 0.5) * cellH - 2, 4, 4);
      });
      ctx.restore();
    }

    drawMiniLakeEvent(ctx, cellW, cellH, options = {}) {
      const active = this.state.lakeEvent?.active;
      const upcoming = !active ? this.state.lakeEvent?.upcoming : null;
      const event = active || upcoming;
      if (!event) return;
      const definition = this.state.config?.lakeEvents?.[event.type] || {};
      const color = event.color || definition.color || "#83dced";
      const visual = event.visual || definition.visual || event.type;
      const warning = Boolean(upcoming);
      const now = performance.now();
      const t = 0.5 + Math.sin(now * 0.006) * 0.5;
      const tileIds = new Set(event.area?.tileIds || []);
      const preferred = new Set(definition.tileTypes || []);
      const maxTiles = options.isMobile ? 70 : 120;
      const tiles = this.state.tiles.filter((tile) => this.lakeEventAffectsTile(tile, tileIds, preferred)).slice(0, maxTiles);
      if (!tiles.length) return;
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.globalAlpha = warning ? 0.26 + t * 0.14 : 0.34 + t * 0.16;
      tiles.forEach((tile) => {
        ctx.fillRect(tile.x * cellW, tile.y * cellH, Math.max(1, cellW), Math.max(1, cellH));
      });
      const focus = this.tileMap.get(event.area?.focusTile) || tiles[Math.floor(tiles.length / 2)];
      if (focus) {
        const x = (focus.x + 0.5) * cellW;
        const y = (focus.y + 0.5) * cellH;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = warning ? 1.8 : 1.35;
        if (warning) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(x, y, 5 + t * (warning ? 9 : 6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (visual === "flood" || visual === "current") {
          const dir = event.area?.direction || "east";
          const dx = dir === "west" ? -1 : dir === "east" ? 1 : 0;
          const dy = dir === "north" ? -1 : dir === "south" ? 1 : 0;
          ctx.beginPath();
          ctx.moveTo(x - dx * 10, y - dy * 10);
          ctx.lineTo(x + dx * 10, y + dy * 10);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + dx * 10, y + dy * 10, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawMiniAttacks(ctx, cellW, cellH, options) {
      if (!options.effects?.attackArrows) return;
      const attacks = this.state.activeAttacks || [];
      const expansions = (this.state.activeExpansions || []).map((wave) => ({
        sourceTile: wave.sourceTile,
        targetStartTile: wave.targetStartTile || wave.startTileId,
        attackerId: wave.playerId,
        expansion: true,
      }));
      const flows = attacks.concat(expansions);
      if (!flows.length) return;
      ctx.save();
      ctx.lineWidth = 1.4;
      flows.slice(-10).forEach((wave) => {
        const from = this.tileMap.get(wave.sourceTile);
        const to = this.tileMap.get(wave.targetStartTile);
        const player = this.playerMap.get(wave.attackerId);
        if (!from || !to || !player) return;
        ctx.strokeStyle = player.color;
        ctx.globalAlpha = wave.expansion ? 0.48 : 0.76;
        ctx.beginPath();
        ctx.moveTo((from.x + 0.5) * cellW, (from.y + 0.5) * cellH);
        ctx.lineTo((to.x + 0.5) * cellW, (to.y + 0.5) * cellH);
        ctx.stroke();
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc((to.x + 0.5) * cellW, (to.y + 0.5) * cellH, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    drawMiniPings(ctx, cellW, cellH) {
      const now = performance.now();
      const pings = this.eventAnims.filter((event) => (event.kind === "ping" || event.kind === "teamCommand") && now - event.atMs < 6000);
      if (!pings.length) return;
      ctx.save();
      pings.forEach((event) => {
        const tile = this.tileMap.get(event.to);
        const player = this.playerMap.get(event.playerId);
        if (!tile) return;
        const t = Math.min(1, (now - event.atMs) / 6000);
        const x = (tile.x + 0.5) * cellW;
        const y = (tile.y + 0.5) * cellH;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = event.teamColor || player?.color || "#f0cc74";
        ctx.fillStyle = event.teamColor || player?.color || "#f0cc74";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, 2.5 + t * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    drawMiniCamera(ctx, rect, cellW, cellH) {
      const main = this.canvas.getBoundingClientRect();
      const viewW = main.width / this.camera.zoom / this.baseTile;
      const viewH = main.height / this.camera.zoom / this.baseTile;
      const left = (this.camera.x / this.baseTile - viewW / 2) * cellW;
      const top = (this.camera.y / this.baseTile - viewH / 2) * cellH;
      ctx.save();
      ctx.strokeStyle = "rgba(237, 248, 251, 0.72)";
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top, Math.max(4, viewW * cellW), Math.max(4, viewH * cellH));
      ctx.restore();
    }

    drawPillText(ctx, label, x, y, color = "#87d7ea") {
      ctx.save();
      ctx.font = "950 12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const width = ctx.measureText(label).width + 18;
      const height = 20;
      ctx.fillStyle = "rgba(4, 13, 20, 0.82)";
      ctx.strokeStyle = this.withAlpha(color, 0.56);
      ctx.lineWidth = 1;
      this.roundRect(ctx, x - width / 2, y - height / 2, width, height, 999);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#edf8fb";
      ctx.fillText(label, x, y + 0.5);
      ctx.restore();
    }

    tileNoise(seed, min = 0, max = 1) {
      const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return min + (value - Math.floor(value)) * (max - min);
    }

    seedOffset(seed) {
      const value = Math.sin((this.state?.seed || 1) * 0.001 + seed * 18.731) * 100000;
      return Math.floor(Math.abs(value));
    }

    tileCenter(tile) {
      return this.worldToScreen((tile.x + 0.5) * this.baseTile, (tile.y + 0.5) * this.baseTile);
    }

    neighbors(tile) {
      const at = (x, y) => {
        if (x < 0 || y < 0 || x >= this.state.cols || y >= this.state.rows) return null;
        return this.tileMap.get(y * this.state.cols + x) || null;
      };
      return [at(tile.x, tile.y - 1), at(tile.x + 1, tile.y), at(tile.x, tile.y + 1), at(tile.x - 1, tile.y)];
    }

    withAlpha(hex, alpha) {
      const clean = hex.replace("#", "");
      const value = parseInt(clean, 16);
      return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
    }

    roundRect(ctx, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
  }

  root.PondRenderer = PondRenderer;
})(window);
