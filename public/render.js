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
      if (this.state) this.fit(false);
    }

    setState(state) {
      const oldOwners = this.state ? new Map(this.state.tiles.map((tile) => [tile.id, tile.owner])) : null;
      const oldPlayers = this.playerMap || new Map();
      this.state = state;
      this.tileMap = new Map(state.tiles.map((tile) => [tile.id, tile]));
      this.playerMap = new Map(state.players.map((player) => [player.id, player]));
      if (!this.fitted) this.fit(true);
      if (oldOwners) {
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
            "expand",
            "expandProgress",
            "defend",
            "ability",
            "abilityUsed",
            "objectiveAppeared",
            "objectiveCaptured",
            "campCaptured",
            "campMoved",
            "ping",
            "buildComplete",
            "buildUpgrade",
            "buildRemove",
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
      this.vfx?.configure(drawOptions.effects || {});
      const rect = this.canvas.getBoundingClientRect();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, rect.width, rect.height);
      this.drawWater(ctx, rect);
      if (!this.state) return;
      this.drawMap(ctx, drawOptions);
      this.drawEvents(ctx, drawOptions);
      this.drawMiniMap(drawOptions);
    }

    effectiveOptions(options = {}) {
      const effects = { ...(options.effects || {}) };
      const mobile = Boolean(options.isMobile);
      const autoStrategic = Boolean(options.autoStrategicView) && this.camera.zoom < (mobile ? 0.78 : 0.48);
      const lowPower = Boolean(effects.autoLowPerformance) && (mobile || this.camera.zoom < 0.5);
      const next = {
        ...options,
        strategicView: Boolean(options.strategicView || autoStrategic),
        showIcons: autoStrategic ? false : options.showIcons,
        effects,
      };
      if (lowPower) {
        if (effects.level === "high") effects.level = mobile || this.camera.zoom < 0.5 ? "low" : "medium";
        if (mobile && this.camera.zoom < 0.72) effects.floatingText = false;
      }
      if (effects.reducedMotion) {
        effects.floatingText = false;
      }
      return next;
    }

    drawWater(ctx, rect) {
      const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      gradient.addColorStop(0, "#061724");
      gradient.addColorStop(0.42, "#123f52");
      gradient.addColorStop(0.78, "#0c2a3b");
      gradient.addColorStop(1, "#05121d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
      const now = performance.now();
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "#b8edf5";
      ctx.lineWidth = 1;
      for (let y = -24; y < rect.height + 42; y += 34) {
        ctx.beginPath();
        for (let x = -34; x <= rect.width + 34; x += 22) {
          const drift = now * 0.018 + y * 0.7;
          ctx.lineTo(x, y + Math.sin((x + drift) * 0.026) * 2.2);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = "#5ec9dc";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 16; i += 1) {
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
      const event = this.state?.lakeEvent?.active;
      if (!event) return;
      ctx.save();
      const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.5;
      ctx.globalAlpha = 0.05 + pulse * 0.025;
      ctx.fillStyle = event.color || "#83dced";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.restore();
    }

    drawMap(ctx, options) {
      const s = this.baseTile * this.camera.zoom;
      const topLeft = this.worldToScreen(0, 0);
      const mapW = this.state.cols * s;
      const mapH = this.state.rows * s;
      const radius = Math.max(8, Math.min(20, 12 * this.camera.zoom));
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.32)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
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
      this.drawRegionUnderlays(ctx);
      const visibleTiles = this.visibleTiles(1);
      visibleTiles.forEach((tile) => this.drawTile(ctx, tile, options));
      visibleTiles.forEach((tile) => this.drawBorders(ctx, tile));
      this.drawLocalGlow(ctx);
      this.drawRegionNames(ctx);
      this.drawDefense(ctx, visibleTiles);
      this.drawSpecialMarkers(ctx);
      this.drawLegalHints(ctx, options);
      this.drawPreview(ctx, options);
      this.drawSelection(ctx, options);
      this.drawActiveAttacks(ctx);
      this.vfx?.draw(ctx);
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
      return tiles;
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

    drawTile(ctx, tile, options) {
      const type = this.state.config.tileTypes[tile.type];
      const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
      const size = this.baseTile * this.camera.zoom;
      if (p.x + size < -20 || p.y + size < -20 || p.x > this.canvas.clientWidth + 20 || p.y > this.canvas.clientHeight + 20) return;

      const owner = tile.owner ? this.playerMap.get(tile.owner) : null;
      if (!owner && tile.type === "water") return;

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
        if (transitionAlpha > 0 && transition.oldColor) {
          ctx.fillStyle = this.withAlpha(transition.oldColor, transitionAlpha * 0.58);
          ctx.fillRect(p.x - overlap, p.y - overlap, size + overlap * 2, size + overlap * 2);
        }
        if (this.camera.zoom > 0.92) {
          const sheen = this.tileNoise(tile.id, 0.03, 0.075);
          ctx.fillStyle = `rgba(255,255,255,${sheen})`;
          ctx.fillRect(p.x + size * 0.08, p.y + size * 0.08, size * 0.18, size * 0.18);
        }
        if (isSpecial && this.camera.zoom > 0.7) {
          this.drawSpecialWash(ctx, tile, p.x, p.y, size, true);
        }
      } else if (!isSpecial) {
        ctx.fillStyle = type.neutralColor;
        this.roundRect(ctx, p.x + 0.6, p.y + 0.6, size - 1.2, size - 1.2, Math.max(2, size * 0.12));
        ctx.fill();
      } else {
        ctx.fillStyle = type.blocks ? "#55636c" : type.neutralColor;
        const inset = Math.max(0.6, Math.min(3.2, size * 0.08));
        this.roundRect(ctx, p.x + inset, p.y + inset, size - inset * 2, size - inset * 2, Math.max(2, size * 0.18));
        ctx.fill();
        ctx.strokeStyle = type.blocks ? "rgba(236,247,249,0.22)" : "rgba(226, 244, 247, 0.14)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, p.x + inset + 1, p.y + inset + 1, size - inset * 2 - 2, size - inset * 2 - 2, Math.max(2, size * 0.12));
        ctx.stroke();
        this.drawSpecialWash(ctx, tile, p.x, p.y, size, false);
      }

      const showIcon =
        !options.strategicView &&
        (options.showIcons || this.camera.zoom > 1.02 || options.selectedTileId === tile.id);
      if (showIcon && type.strategic) this.drawSpecial(ctx, tile, p.x, p.y, size);
      if (tile.building && (options.showIcons || this.camera.zoom > 0.82 || options.selectedTileId === tile.id)) {
        this.drawBuilding(ctx, tile, p.x, p.y, size);
      }
    }

    drawSpecialWash(ctx, tile, x, y, size, owned) {
      const alpha = owned ? 0.11 : 0.22;
      ctx.save();
      ctx.globalAlpha = alpha;
      const cx = x + size / 2;
      const cy = y + size / 2;
      if (tile.type === "lily") {
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
          const lean = (this.tileNoise(tile.id + i * 7, -0.08, 0.08) || 0) * size;
          ctx.beginPath();
          ctx.moveTo(cx + i * size * 0.08, y + size * 0.78);
          ctx.quadraticCurveTo(cx + i * size * 0.08 + lean, cy, cx + i * size * 0.09 + size * 0.05, y + size * 0.22);
          ctx.stroke();
        }
      } else if (tile.type === "mud" || tile.type === "nest") {
        ctx.fillStyle = tile.type === "nest" ? "#f0c16f" : "#c79662";
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.28, size * 0.18, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(3, 10, 15, 0.5)";
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.13, 0.2, Math.PI * 1.8);
        ctx.stroke();
      } else if (tile.type === "rock") {
        ctx.fillStyle = "#d2dbe0";
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.26, cy + size * 0.16);
        ctx.lineTo(cx - size * 0.16, cy - size * 0.16);
        ctx.lineTo(cx + size * 0.08, cy - size * 0.26);
        ctx.lineTo(cx + size * 0.28, cy + size * 0.06);
        ctx.lineTo(cx + size * 0.08, cy + size * 0.24);
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
      }
      ctx.restore();
    }

    drawBuilding(ctx, tile, x, y, size) {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const icon = {
        nest: "N",
        lilyFarm: "L",
        reedGuard: "G",
        mudTunnel: "M",
        jumpPad: "J",
      }[tile.building] || tile.building[0].toUpperCase();
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
      ctx.fillStyle = color;
      ctx.font = `950 ${Math.max(8, size * 0.22)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, cx, cy + 0.5);
      if (tile.buildingLevel > 1 && size > 16) {
        ctx.fillStyle = "#edf8fb";
        ctx.font = `900 ${Math.max(6, size * 0.13)}px Inter, sans-serif`;
        ctx.fillText(String(tile.buildingLevel), cx + size * 0.18, cy - size * 0.16);
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
      const width = Math.max(1.05, size * (tile.owner === this.state.humanId ? 0.052 : 0.044));
      this.neighbors(tile).forEach((neighbor, index) => {
        if (neighbor && neighbor.owner === tile.owner) return;
        const contested = Boolean(neighbor?.owner && neighbor.owner !== tile.owner);
        const points =
          index === 0
            ? [p.x, p.y, p.x + size, p.y]
            : index === 1
              ? [p.x + size, p.y, p.x + size, p.y + size]
              : index === 2
                ? [p.x, p.y + size, p.x + size, p.y + size]
                : [p.x, p.y, p.x, p.y + size];
        this.strokeBorderEdge(ctx, points, color, width, contested);
      });
    }

    strokeBorderEdge(ctx, points, color, width, contested = false) {
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.strokeStyle = contested ? "rgba(2, 8, 13, 0.88)" : "rgba(3, 10, 15, 0.62)";
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
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      ctx.lineTo(points[2], points[3]);
      ctx.stroke();
    }

    drawLocalGlow(ctx) {
      if (this.camera.zoom < 0.42) return;
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      ctx.globalAlpha = 0.14 + Math.sin(performance.now() * 0.004) * 0.04;
      ctx.strokeStyle = "#edf8fb";
      ctx.lineWidth = Math.max(1, size * 0.026);
      this.state.tiles.forEach((tile) => {
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
      ctx.strokeStyle = options.mode === "attack" ? "#e9857c" : options.mode === "build" ? "#77d99e" : "#d8c66f";
      ctx.fillStyle = options.mode === "attack" ? "rgba(233, 133, 124, 0.08)" : options.mode === "build" ? "rgba(119, 217, 158, 0.08)" : "rgba(216, 198, 111, 0.08)";
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
        const p = this.worldToScreen(tile.x * this.baseTile, tile.y * this.baseTile);
        const alpha = Math.max(0.18, Math.min(0.72, tile.defenseEnergy / 90));
        ctx.strokeStyle = `rgba(226, 244, 247, ${alpha})`;
        ctx.lineWidth = Math.max(1, size * 0.045);
        this.roundRect(ctx, p.x + size * 0.18, p.y + size * 0.18, size * 0.64, size * 0.64, Math.max(3, size * 0.12));
        ctx.stroke();
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
          active: true,
          owner: camp.owner,
          label: camp.definition?.short || "CP",
          color: camp.definition?.color || "#d8ad48",
          ring: false,
        });
      });
      if (!markers.length) return;
      const size = this.baseTile * this.camera.zoom;
      ctx.save();
      markers.forEach((marker) => {
        const p = this.tileCenter(marker.tile);
        const pulse = 0.5 + Math.sin(performance.now() * 0.006 + marker.tile.id) * 0.5;
        ctx.globalAlpha = marker.active ? 0.9 : 0.35;
        ctx.fillStyle = "rgba(5, 16, 25, 0.82)";
        ctx.strokeStyle = marker.owner === this.state.humanId ? "#ffffff" : marker.color;
        ctx.lineWidth = Math.max(1.2, size * 0.055);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(7, size * (marker.ring ? 0.31 + pulse * 0.05 : 0.26)), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = marker.color;
        ctx.font = `900 ${Math.max(8, size * 0.23)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(marker.label, p.x, p.y + 0.5);
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

    drawActiveAttacks(ctx) {
      const attacks = this.state.activeAttacks || [];
      if (!attacks.length) return;
      const now = performance.now();
      const pulse = 0.5 + Math.sin(now * 0.012) * 0.5;
      const size = this.baseTile * this.camera.zoom;

      attacks.forEach((wave) => {
        const attacker = this.playerMap.get(wave.attackerId);
        if (!attacker) return;
        const color = attacker.color;
        const source = this.tileMap.get(wave.sourceTile);
        const target = this.tileMap.get(wave.targetStartTile);

        if (source && target) {
          const from = this.tileCenter(source);
          const to = this.tileCenter(target);
          this.drawStrategicFlow(ctx, from, to, color, now, 0.75 + pulse * 0.35);
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
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2, size * 0.07);
          ctx.beginPath();
          ctx.arc(p.x + size / 2, p.y + size / 2, size * (0.24 + pulse * 0.1), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });
      });
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
        const fontSize = Math.max(10, 13 * this.camera.zoom);
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const animal = this.state.config.animals[player.animal];
        const firstName = (player.name || "Player").split(" ")[0];
        const name = `${animal.icon} ${firstName}`;
        const textW = ctx.measureText(name).width;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(3, 12, 19, 0.58)";
        this.roundRect(ctx, p.x - textW / 2 - 8, p.y - fontSize / 2 - 4, textW + 16, fontSize + 8, 8);
        ctx.fill();
        ctx.strokeStyle = this.withAlpha(player.color, id === this.state.humanId ? 0.92 : 0.62);
        ctx.lineWidth = id === this.state.humanId ? 1.6 : 1;
        this.roundRect(ctx, p.x - textW / 2 - 8, p.y - fontSize / 2 - 4, textW + 16, fontSize + 8, 8);
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "rgba(6,16,25,0.82)";
        ctx.fillStyle = "#edf8fb";
        ctx.strokeText(name, p.x, p.y);
        ctx.fillText(name, p.x, p.y);
      });
    }

    drawEvents(ctx, options = {}) {
      if (options.effects?.reducedMotion && this.camera.zoom < 0.58) return;
      const now = performance.now();
      this.eventAnims = this.eventAnims.filter((event) => now - event.atMs < (event.kind === "ping" ? 6000 : 1800));
      this.eventAnims.forEach((event) => {
        const life = event.kind === "ping" ? 6000 : event.kind === "attackWave" ? 1800 : 1450;
        const t = Math.min(1, (now - event.atMs) / life);
        const to = this.tileMap.get(event.to);
        if (!to) return;
        const toP = this.tileCenter(to);
        const player = event.playerId ? this.playerMap.get(event.playerId) : null;
        const color = event.kind === "waveResist" ? "#edf8fb" : player?.color || "#d8ad48";
        ctx.save();
        ctx.globalAlpha = 1 - t;
        if (event.kind === "ping") {
          const label = root.PondInfo?.PING_LABELS?.[event.pingType] || "Ping";
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
      this.state.tiles.forEach((tile) => {
        const type = this.state.config.tileTypes[tile.type];
        const owner = tile.owner ? this.playerMap.get(tile.owner) : null;
        ctx.fillStyle = owner ? owner.color : type.blocks ? "#66717a" : "#276072";
        ctx.globalAlpha = owner ? 0.94 : type.blocks ? 0.68 : type.strategic ? 0.32 : 0.18;
        ctx.fillRect(tile.x * cellW, tile.y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      });
      ctx.globalAlpha = 1;
      this.drawMiniObjectives(ctx, cellW, cellH);
      this.drawMiniPings(ctx, cellW, cellH);
      const humanTiles = this.state.tiles.filter((tile) => tile.owner === this.state.humanId);
      if (humanTiles.length) {
        const minX = Math.min(...humanTiles.map((tile) => tile.x)) * cellW;
        const minY = Math.min(...humanTiles.map((tile) => tile.y)) * cellH;
        const maxX = (Math.max(...humanTiles.map((tile) => tile.x)) + 1) * cellW;
        const maxY = (Math.max(...humanTiles.map((tile) => tile.y)) + 1) * cellH;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(minX, minY, Math.max(3, maxX - minX), Math.max(3, maxY - minY));
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

    drawMiniAttacks(ctx, cellW, cellH, options) {
      if (!options.effects?.attackArrows) return;
      const attacks = this.state.activeAttacks || [];
      if (!attacks.length) return;
      ctx.save();
      ctx.lineWidth = 1.4;
      attacks.slice(-8).forEach((wave) => {
        const from = this.tileMap.get(wave.sourceTile);
        const to = this.tileMap.get(wave.targetStartTile);
        const player = this.playerMap.get(wave.attackerId);
        if (!from || !to || !player) return;
        ctx.strokeStyle = player.color;
        ctx.globalAlpha = 0.76;
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
      const pings = this.eventAnims.filter((event) => event.kind === "ping" && now - event.atMs < 6000);
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
        ctx.strokeStyle = player?.color || "#f0cc74";
        ctx.fillStyle = player?.color || "#f0cc74";
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
