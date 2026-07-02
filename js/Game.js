import {
  ANIMALS,
  BOT_NAMES,
  GRID_COLS,
  GRID_ROWS,
  MATCH_SECONDS,
  PLAYER_COLORS,
  TILE_TYPES,
  WIN_CONTROL,
} from "./config.js";
import { AnimalManager } from "./AnimalManager.js";
import { BotManager } from "./BotManager.js";
import { CombatManager } from "./CombatManager.js";
import { EconomyManager } from "./EconomyManager.js";
import { TileManager } from "./TileManager.js";
import { UIManager } from "./UIManager.js";

class PondFrontGame {
  constructor() {
    this.canvas = document.querySelector("#gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.miniMap = document.querySelector("#miniMap");
    this.miniCtx = this.miniMap.getContext("2d");
    this.tileManager = new TileManager(GRID_COLS, GRID_ROWS);
    this.animalManager = new AnimalManager();
    this.economyManager = new EconomyManager(this.tileManager, this.animalManager);
    this.combatManager = new CombatManager(this.tileManager, this.animalManager);
    this.botManager = new BotManager(this);
    this.ui = new UIManager(this);

    this.players = [];
    this.humanId = "p0";
    this.sendPercent = 0.25;
    this.mode = "expand";
    this.selectedBuilding = "lilyFarm";
    this.selectedTiles = [];
    this.diplomacyTarget = null;
    this.dragRect = null;
    this.hoverTile = null;
    this.lastActionTile = null;
    this.running = false;
    this.frame = 0;
    this.time = 0;
    this.lastTime = 0;
    this.lastUiUpdate = 0;
    this.lastWinCheck = 0;
    this.layout = {
      width: 0,
      height: 0,
      tileSize: 20,
      offsetX: 0,
      offsetY: 0,
      dpr: 1,
    };

    this.ui.bind();
  }

  start(options) {
    this.stop();
    this.time = 0;
    this.mode = "expand";
    this.selectedTiles = [];
    this.diplomacyTarget = null;
    this.dragRect = null;
    this.hoverTile = null;
    this.lastActionTile = null;
    this.selectedBuilding = options.animal === "duck" ? "duckNest" : options.animal === "snake" ? "mudTunnel" : "jumpPad";
    this.tileManager.generate((Date.now() % 10000) + Math.floor(Math.random() * 500));
    this.botManager.reset();
    this.createPlayers(options);
    this.economyManager.recalculate(this.players);
    this.resize();
    this.running = true;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame((now) => this.loop(now));
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.running = false;
    this.frame = 0;
  }

  createPlayers(options) {
    this.players = [];
    const human = this.makePlayer({
      id: this.humanId,
      name: "You",
      animal: options.animal,
      color: ANIMALS[options.animal].color,
      isBot: false,
      difficulty: "human",
    });
    this.players.push(human);

    const botCount = options.practice ? 9 : 12;
    const animals = ["duck", "snake", "frog"];

    for (let index = 0; index < botCount; index += 1) {
      const animal = animals[(index + (options.animal === "duck" ? 1 : 0)) % animals.length];
      const botDifficulty = this.getBotDifficulty(options.difficulty, index);
      const color = PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length];
      this.players.push(
        this.makePlayer({
          id: `b${index}`,
          name: BOT_NAMES[index % BOT_NAMES.length],
          animal,
          color,
          isBot: true,
          difficulty: botDifficulty,
        }),
      );
    }

    this.tileManager.resetOwnership();
    this.players.forEach((player, index) => {
      this.tileManager.claimStartingArea(player, index);
      player.energy = player.isBot ? 48 : 62;
    });
  }

  makePlayer({ id, name, animal, color, isBot, difficulty }) {
    return {
      id,
      name,
      animal,
      color,
      isBot,
      difficulty,
      energy: 55,
      maxEnergy: 78,
      income: 1,
      territory: 0,
      defeated: false,
      alliances: new Set(),
      abilityReadyAt: 0,
      activeAbility: null,
      activeAbilityUntil: 0,
      buildings: {},
      flags: {},
    };
  }

  getBotDifficulty(selected, index) {
    if (selected === "easy" || selected === "smart") return selected;
    if (index % 5 === 0) return "smart";
    if (index % 4 === 0) return "easy";
    return "normal";
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    this.frame = requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.time += dt;

    this.players.forEach((player) => {
      if (player.activeAbility && this.time >= player.activeAbilityUntil) {
        player.activeAbility = null;
      }
    });

    this.tileManager.forEach((tile) => {
      tile.captureFlash = Math.max(0, tile.captureFlash - dt * 1.8);
      tile.reinforcement = Math.max(0, tile.reinforcement - dt * 0.24);
    });

    this.economyManager.update(this.players, dt);
    this.botManager.update(dt);

    if (this.time - this.lastUiUpdate > 0.12) {
      this.ui.update();
      this.lastUiUpdate = this.time;
    }

    if (this.time - this.lastWinCheck > 0.4) {
      this.checkWinCondition();
      this.lastWinCheck = this.time;
    }
  }

  resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(320, this.canvas.clientWidth);
    const height = Math.max(240, this.canvas.clientHeight);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.miniMap.width = Math.floor(this.miniMap.clientWidth * dpr);
    this.miniMap.height = Math.floor(this.miniMap.clientHeight * dpr);
    this.miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tileSize = Math.floor(Math.min(width / this.tileManager.cols, height / this.tileManager.rows));
    const boardWidth = tileSize * this.tileManager.cols;
    const boardHeight = tileSize * this.tileManager.rows;
    this.layout = {
      width,
      height,
      tileSize,
      offsetX: Math.floor((width - boardWidth) / 2),
      offsetY: Math.floor((height - boardHeight) / 2),
      dpr,
    };
    this.updateTileScreens();
    this.draw();
  }

  updateTileScreens() {
    const { tileSize, offsetX, offsetY } = this.layout;
    this.tileManager.forEach((tile) => {
      tile.screenX = offsetX + tile.x * tileSize;
      tile.screenY = offsetY + tile.y * tileSize;
      tile.size = tileSize;
    });
  }

  tileFromCanvas(x, y) {
    const { tileSize, offsetX, offsetY } = this.layout;
    const tx = Math.floor((x - offsetX) / tileSize);
    const ty = Math.floor((y - offsetY) / tileSize);
    return this.tileManager.get(tx, ty);
  }

  handleTileClick(tile) {
    this.lastActionTile = tile;
    const player = this.getHuman();
    if (!player || player.defeated) return { ok: false, reason: "You are out of territory" };

    if (this.mode === "build") {
      const built = this.economyManager.build(player, tile, this.selectedBuilding);
      return built ? { ok: true, reason: "Built" } : { ok: false, reason: "Cannot build there" };
    }

    if (this.mode === "defend") {
      if (tile.owner !== player.id) return { ok: false, reason: "Choose your border" };
      return this.combatManager.reinforce(player, tile, this.sendPercent);
    }

    const result = this.combatManager.expandOrAttack(
      this,
      player,
      tile,
      this.sendPercent,
      this.selectedTiles,
    );
    if (result.ok && result.captured) this.selectedTiles = [];
    return result;
  }

  getTileActionKind(tile, player = this.getHuman()) {
    if (!tile || !player || TILE_TYPES[tile.type].blocks) return "blocked";

    if (this.mode === "build") {
      return this.economyManager.canBuild(player, tile, this.selectedBuilding) ? "build" : "none";
    }

    if (this.mode === "defend") {
      return tile.owner === player.id ? "defend" : "none";
    }

    if (tile.owner === player.id) return "defend";
    const owner = this.getPlayer(tile.owner);
    if (owner && this.areAllied(player.id, owner.id)) return "ally";
    const reach = this.tileManager.getReachInfo(player, tile, this.selectedTiles);
    if (!reach.reachable) return "none";
    return tile.owner ? "attack" : "expand";
  }

  toggleDefendMode() {
    this.mode = this.mode === "defend" ? "expand" : "defend";
  }

  toggleBuildMode() {
    this.mode = this.mode === "build" ? "expand" : "build";
  }

  useAbility() {
    const player = this.getHuman();
    if (!player) return { ok: false, reason: "No animal selected" };
    return this.combatManager.activateAbility(this, player);
  }

  selectBordersInRect(rect) {
    const player = this.getHuman();
    if (!player) return;
    this.selectedTiles = this.tileManager
      .getTilesInRect(rect)
      .filter((tile) => this.tileManager.isBorderTile(tile, player.id))
      .map((tile) => tile.id);
  }

  handleDiplomacy(action) {
    const player = this.getHuman();
    const target = this.getPlayer(this.diplomacyTarget);
    if (!player || !target) return;

    if (action === "ally") {
      player.alliances.add(target.id);
      target.alliances.add(player.id);
      this.ui.toast(`Alliance formed with ${target.name}`);
    }

    if (action === "attack") {
      player.alliances.delete(target.id);
      target.alliances.delete(player.id);
      this.ui.toast(`${target.name} marked for attack`);
    }

    if (action === "warn") {
      target.warnedAt = this.time;
      this.ui.toast(`Warning sent to ${target.name}`);
    }

    if (action === "break") {
      player.alliances.delete(target.id);
      target.alliances.delete(player.id);
      this.ui.toast(`Alliance broken with ${target.name}`);
    }
  }

  areAllied(a, b) {
    if (!a || !b || a === b) return false;
    const player = this.getPlayer(a);
    return Boolean(player?.alliances.has(b));
  }

  getHuman() {
    return this.getPlayer(this.humanId);
  }

  getPlayer(id) {
    if (!id) return null;
    return this.players.find((player) => player.id === id) ?? null;
  }

  getTerritoryPercent(player) {
    const playable = this.tileManager.countPlayableTiles();
    return playable ? player.territory / playable : 0;
  }

  checkWinCondition() {
    if (!this.running) return;
    const active = this.players.filter((player) => !player.defeated);
    const winner = active.find((player) => this.getTerritoryPercent(player) >= WIN_CONTROL);
    if (winner) {
      this.running = false;
      this.ui.showResult(winner, false);
      return;
    }

    if (this.time >= MATCH_SECONDS) {
      const leader = active.slice().sort((a, b) => b.territory - a.territory)[0];
      this.running = false;
      this.ui.showResult(leader, true);
    }
  }

  draw() {
    const { width, height } = this.layout;
    this.ctx.clearRect(0, 0, width, height);
    this.drawWaterBackdrop();
    this.drawLakeFrame();
    this.drawTiles();
    this.drawLegalHints();
    this.drawSelection();
    this.drawActors();
    this.drawMatchClock();
    this.drawMiniMap();
  }

  drawWaterBackdrop() {
    const ctx = this.ctx;
    const { width, height } = this.layout;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#b7f4ef");
    gradient.addColorStop(0.45, "#61cce6");
    gradient.addColorStop(1, "#b7edcd");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#f4f0bb";
    ctx.beginPath();
    ctx.ellipse(-60, height * 0.12, 220, 110, -0.3, 0, Math.PI * 2);
    ctx.ellipse(width + 60, height * 0.82, 240, 140, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#f7ffff";
    ctx.lineWidth = 1.2;
    for (let y = 28; y < height; y += 48) {
      ctx.beginPath();
      for (let x = -20; x < width + 20; x += 24) {
        const ripple = Math.sin((x + this.time * 32 + y * 2) * 0.022) * 4;
        ctx.lineTo(x, y + ripple);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 26; i += 1) {
      const x = (i * 97 + this.time * 13) % (width + 80) - 40;
      const y = (i * 53) % Math.max(1, height);
      const radius = 1.4 + (i % 4) * 0.7;
      ctx.globalAlpha = 0.12 + (i % 3) * 0.04;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLakeFrame() {
    const ctx = this.ctx;
    const { offsetX, offsetY, tileSize } = this.layout;
    const width = this.tileManager.cols * tileSize;
    const height = this.tileManager.rows * tileSize;
    const pad = Math.max(12, tileSize * 0.65);
    const x = offsetX - pad;
    const y = offsetY - pad;
    const w = width + pad * 2;
    const h = height + pad * 2;
    const radius = Math.max(22, tileSize * 1.4);

    ctx.save();
    ctx.shadowColor = "rgba(18, 76, 98, 0.25)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    const pond = ctx.createLinearGradient(x, y, x + w, y + h);
    pond.addColorStop(0, "rgba(122, 226, 232, 0.82)");
    pond.addColorStop(0.55, "rgba(55, 176, 213, 0.74)");
    pond.addColorStop(1, "rgba(145, 229, 198, 0.82)");
    ctx.fillStyle = pond;
    this.roundedRect(ctx, x, y, w, h, radius);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(3, tileSize * 0.14);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.44)";
    this.roundedRect(ctx, x + 2, y + 2, w - 4, h - 4, radius);
    ctx.stroke();

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#267c78";
    ctx.lineWidth = Math.max(2, tileSize * 0.08);
    for (let i = 0; i < 9; i += 1) {
      const px = x + 24 + i * (w - 48) / 8;
      ctx.beginPath();
      ctx.moveTo(px, y + 8);
      ctx.lineTo(px + Math.sin(i) * 12, y + 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, y + h - 8);
      ctx.lineTo(px - Math.cos(i) * 12, y + h - 26);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTiles() {
    const ctx = this.ctx;
    const gap = Math.max(0.75, this.layout.tileSize * 0.045);
    ctx.save();

    this.tileManager.forEach((tile) => {
      const x = tile.screenX + gap / 2;
      const y = tile.screenY + gap / 2;
      const size = tile.size - gap;
      const type = TILE_TYPES[tile.type];
      const radius = Math.max(4, size * 0.2);

      ctx.shadowColor = tile.type === "water" ? "transparent" : "rgba(19, 74, 83, 0.16)";
      ctx.shadowBlur = tile.type === "water" ? 0 : Math.max(2, size * 0.14);
      ctx.shadowOffsetY = tile.type === "water" ? 0 : Math.max(1, size * 0.05);
      ctx.fillStyle = this.getTerrainPaint(ctx, tile, x, y, size);
      ctx.globalAlpha = tile.type === "water" ? 0.72 : 0.98;
      this.roundedRect(ctx, x, y, size, size, radius);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.globalAlpha = 1;

      this.drawTerrainDetail(tile, x, y, size);
      this.drawOwnerOverlay(tile, x, y, size);
      this.drawBuilding(tile, x, y, size);
      if (tile.captureFlash > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${tile.captureFlash * 0.76})`;
        ctx.lineWidth = Math.max(2, size * 0.1);
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * (0.18 + tile.captureFlash * 0.34), 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    this.tileManager.forEach((tile) => this.drawTileBorder(tile));
    ctx.restore();
  }

  getTerrainPaint(ctx, tile, x, y, size) {
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    const colors = {
      water: ["#7ee3eb", "#51c5df"],
      lily: ["#a2e77f", "#5cad5d"],
      reeds: ["#92c96a", "#567f3e"],
      mud: ["#cfaa67", "#9b6a3f"],
      rock: ["#b0bac3", "#6f7f8c"],
      nest: ["#f0c98e", "#c9894e"],
      critter: ["#edd979", "#b49a45"],
    };
    const [start, end] = colors[tile.type] ?? [TILE_TYPES[tile.type].color, TILE_TYPES[tile.type].color];
    gradient.addColorStop(0, start);
    gradient.addColorStop(1, end);
    return gradient;
  }

  drawTerrainDetail(tile, x, y, size) {
    const ctx = this.ctx;
    const cx = x + size / 2;
    const cy = y + size / 2;

    if (tile.type === "water") {
      if (tile.id % 5 !== Math.floor(this.time) % 5) return;
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy + Math.sin(this.time + tile.id) * size * 0.03, size * 0.24, Math.PI * 0.1, Math.PI * 0.88);
      ctx.stroke();
    }

    if (tile.type === "lily") {
      ctx.fillStyle = "#3f9c55";
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.03, cy, size * 0.35, size * 0.24, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.1, cy - size * 0.04, size * 0.16, size * 0.07, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6d7df";
      ctx.beginPath();
      ctx.arc(cx + size * 0.13, cy - size * 0.07, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffeef4";
      ctx.beginPath();
      ctx.arc(cx + size * 0.18, cy - size * 0.02, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.type === "reeds") {
      ctx.strokeStyle = "#365f32";
      ctx.lineWidth = Math.max(1, size * 0.068);
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i += 1) {
        const ox = (i - 1.5) * size * 0.14;
        const sway = Math.sin(this.time * 2 + tile.id + i) * size * 0.04;
        ctx.beginPath();
        ctx.moveTo(cx + ox, y + size * 0.82);
        ctx.quadraticCurveTo(cx + ox + sway, y + size * 0.45, cx + ox + size * 0.08 + sway, y + size * 0.17);
        ctx.stroke();
      }
    }

    if (tile.type === "mud") {
      ctx.fillStyle = "rgba(86, 62, 39, 0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.34, size * 0.22, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(cx - size * 0.12, cy - size * 0.04, size * 0.045, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.11, cy + size * 0.07, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.type === "rock") {
      ctx.fillStyle = "#eef6f7";
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.03, cy + size * 0.23, size * 0.32, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6f7f8c";
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.28, cy + size * 0.22);
      ctx.lineTo(cx - size * 0.14, cy - size * 0.25);
      ctx.lineTo(cx + size * 0.24, cy - size * 0.16);
      ctx.lineTo(cx + size * 0.32, cy + size * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.08, cy - size * 0.2);
      ctx.lineTo(cx + size * 0.2, cy - size * 0.13);
      ctx.lineTo(cx + size * 0.04, cy - size * 0.02);
      ctx.closePath();
      ctx.fill();
    }

    if (tile.type === "nest") {
      ctx.strokeStyle = "#8d602c";
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.14, Math.PI * 0.18, Math.PI * 1.35);
      ctx.stroke();
    }

    if (tile.type === "critter") {
      ctx.fillStyle = "#fff1a8";
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#725e2c";
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#725e2c";
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.2, cy);
      ctx.lineTo(cx + size * 0.2, cy);
      ctx.stroke();
    }
  }

  drawOwnerOverlay(tile, x, y, size) {
    const player = this.getPlayer(tile.owner);
    if (!player) return;
    const hidden = tile.borderHiddenUntil > this.time && player.id !== this.humanId;
    const ctx = this.ctx;
    const rgb = this.hexToRgb(player.color);
    const radius = Math.max(4, size * 0.2);
    const overlay = ctx.createRadialGradient(
      x + size * 0.34,
      y + size * 0.28,
      size * 0.05,
      x + size * 0.5,
      y + size * 0.5,
      size * 0.72,
    );
    overlay.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${hidden ? 0.18 : 0.62})`);
    overlay.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},${hidden ? 0.1 : 0.4})`);
    ctx.fillStyle = overlay;
    this.roundedRect(ctx, x + size * 0.06, y + size * 0.06, size * 0.88, size * 0.88, radius);
    ctx.fill();

    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${hidden ? 0.14 : 0.38})`;
    ctx.lineWidth = Math.max(1, size * 0.035);
    this.roundedRect(ctx, x + size * 0.12, y + size * 0.12, size * 0.76, size * 0.76, radius * 0.7);
    ctx.stroke();

    if (tile.reinforcement > 2) {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      this.roundedRect(ctx, x + size * 0.2, y + size * 0.74, size * 0.6, Math.max(2, size * 0.09), size * 0.05);
      ctx.fill();
    }
  }

  drawTileBorder(tile) {
    const player = this.getPlayer(tile.owner);
    if (!player) return;
    if (tile.borderHiddenUntil > this.time && player.id !== this.humanId) return;
    const ctx = this.ctx;
    const { tileSize } = this.layout;
    const x = tile.screenX;
    const y = tile.screenY;
    ctx.strokeStyle = player.color;
    ctx.lineWidth = Math.max(2.5, tileSize * 0.12);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = player.color;
    ctx.shadowBlur = Math.max(3, tileSize * 0.18);

    tile.neighbors.forEach((neighbor) => {
      if (neighbor.owner === tile.owner) return;
      ctx.beginPath();
      if (neighbor.x < tile.x) {
        ctx.moveTo(x + 1, y + 2);
        ctx.lineTo(x + 1, y + tileSize - 2);
      } else if (neighbor.x > tile.x) {
        ctx.moveTo(x + tileSize - 1, y + 2);
        ctx.lineTo(x + tileSize - 1, y + tileSize - 2);
      } else if (neighbor.y < tile.y) {
        ctx.moveTo(x + 2, y + 1);
        ctx.lineTo(x + tileSize - 2, y + 1);
      } else if (neighbor.y > tile.y) {
        ctx.moveTo(x + 2, y + tileSize - 1);
        ctx.lineTo(x + tileSize - 2, y + tileSize - 1);
      }
      ctx.stroke();
    });
    ctx.shadowColor = "transparent";
  }

  drawBuilding(tile, x, y, size) {
    if (!tile.building) return;
    const ctx = this.ctx;
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = "rgba(19, 55, 64, 0.22)";
    ctx.shadowBlur = Math.max(2, size * 0.16);
    ctx.shadowOffsetY = Math.max(1, size * 0.08);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "rgba(23,50,74,0.56)";
    ctx.lineWidth = Math.max(1, size * 0.045);

    if (tile.building === "duckNest") {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f0b63f";
      ctx.beginPath();
      ctx.arc(size * 0.07, -size * 0.02, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.building === "reedGuard") {
      ctx.fillStyle = "#f7fff0";
      this.roundedRect(ctx, -size * 0.2, -size * 0.26, size * 0.4, size * 0.52, size * 0.06);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4f8f52";
      ctx.fillRect(-size * 0.04, -size * 0.34, size * 0.08, size * 0.68);
    }

    if (tile.building === "lilyFarm") {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.24, size * 0.16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6abf69";
      ctx.beginPath();
      ctx.arc(size * 0.16, -size * 0.08, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.building === "mudTunnel") {
      ctx.fillStyle = "#7d5a3b";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, Math.PI, Math.PI * 2);
      ctx.lineTo(size * 0.22, size * 0.18);
      ctx.lineTo(-size * 0.22, size * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(0, size * 0.08, size * 0.13, size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tile.building === "jumpPad") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.beginPath();
      ctx.arc(0, size * 0.05, size * 0.22, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = "#cc5f9b";
      ctx.beginPath();
      ctx.arc(0, -size * 0.02, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSelection() {
    const ctx = this.ctx;
    const { tileSize } = this.layout;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2.5, tileSize * 0.1);
    ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
    ctx.shadowBlur = Math.max(4, tileSize * 0.22);
    this.selectedTiles.forEach((id) => {
      const tile = this.tileManager.getById(id);
      if (!tile) return;
      this.roundedRect(ctx, tile.screenX + 3, tile.screenY + 3, tileSize - 6, tileSize - 6, tileSize * 0.2);
      ctx.stroke();
    });

    if (this.dragRect) {
      const x = Math.min(this.dragRect.x1, this.dragRect.x2);
      const y = Math.min(this.dragRect.y1, this.dragRect.y2);
      const width = Math.abs(this.dragRect.x2 - this.dragRect.x1);
      const height = Math.abs(this.dragRect.y2 - this.dragRect.y1);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      this.roundedRect(ctx, x, y, width, height, 8);
      ctx.fill();
      ctx.stroke();
    }

    if (this.hoverTile && !TILE_TYPES[this.hoverTile.type].blocks) {
      const tile = this.hoverTile;
      const player = this.getHuman();
      const owned = tile.owner === this.humanId;
      const allied = player && tile.owner && this.areAllied(player.id, tile.owner);
      const color = this.mode === "build" || owned ? "#ffffff" : allied ? "#55d6a7" : "#ffef9a";
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.max(5, tileSize * 0.28);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, tileSize * 0.1);
      this.roundedRect(ctx, tile.screenX + 2, tile.screenY + 2, tileSize - 4, tileSize - 4, tileSize * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLegalHints() {
    const player = this.getHuman();
    if (!player || player.defeated || !this.running) return;

    let tiles = [];
    let color = "#ffe985";
    if (this.mode === "build") {
      tiles = this.tileManager
        .getOwnedTiles(player.id)
        .filter((tile) => this.economyManager.canBuild(player, tile, this.selectedBuilding));
      color = "#73e6a6";
    } else if (this.mode === "defend") {
      tiles = this.tileManager.getBorderTiles(player.id);
      color = "#ffffff";
    } else {
      tiles = this.tileManager
        .getCapturableNeighbors(player.id)
        .filter((tile) => {
          const owner = this.getPlayer(tile.owner);
          return !owner || !this.areAllied(player.id, owner.id);
        });
      color = "#ffed8a";
    }

    const ctx = this.ctx;
    const pulse = 0.65 + Math.sin(this.time * 5) * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.max(5, this.layout.tileSize * 0.22);

    tiles.slice(0, 120).forEach((tile) => {
      if (TILE_TYPES[tile.type].blocks) return;
      const size = tile.size;
      const x = tile.screenX + size / 2;
      const y = tile.screenY + size / 2;
      const enemy = tile.owner && tile.owner !== player.id;
      const radius = size * (enemy ? 0.22 : 0.16) * pulse;
      ctx.lineWidth = Math.max(1.5, size * 0.055);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = enemy ? 0.7 : 0.45;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, size * 0.055), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.82;
    });

    ctx.restore();
  }

  drawActors() {
    const ctx = this.ctx;
    const labelIds = new Set(
      this.players
        .filter((player) => !player.defeated)
        .slice()
        .sort((a, b) => b.territory - a.territory)
        .slice(0, 4)
        .map((player) => player.id),
    );
    labelIds.add(this.humanId);

    this.players.forEach((player) => {
      if (player.defeated || player.territory <= 0) return;
      const owned = this.tileManager.getOwnedTiles(player.id);
      if (!owned.length) return;
      const sample = owned[Math.floor((this.time * 2 + owned.length) % owned.length)];
      const bob = Math.sin(this.time * 3 + player.id.length) * 2;
      const x = sample.screenX + sample.size / 2;
      const y = sample.screenY + sample.size / 2 + bob;
      const size = Math.max(11, sample.size * 0.72);

      ctx.save();
      if (player.activeAbility) {
        const rgb = this.hexToRgb(player.color);
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.62)`;
        ctx.lineWidth = Math.max(2, size * 0.08);
        ctx.beginPath();
        ctx.arc(x, y, size * (0.58 + Math.sin(this.time * 8) * 0.05), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (player.animal === "duck") this.drawDuck(ctx, x, y, size, player);
      if (player.animal === "snake") this.drawSnake(ctx, x, y, size, player);
      if (player.animal === "frog") this.drawFrog(ctx, x, y, size, player);
      ctx.restore();

      if (sample.size > 17 && labelIds.has(player.id)) {
        ctx.font = `900 ${Math.max(9, sample.size * 0.33)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.86)";
        ctx.fillStyle = "rgba(19,48,68,0.82)";
        ctx.strokeText(player.id === this.humanId ? "You" : player.name.split(" ")[0], x, y + size * 0.48);
        ctx.fillText(player.id === this.humanId ? "You" : player.name.split(" ")[0], x, y + size * 0.48);
      }
    });
  }

  drawDuck(ctx, x, y, size, player) {
    this.drawSpriteShadow(ctx, x, y, size);
    ctx.strokeStyle = "rgba(121, 83, 35, 0.36)";
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.34, size * 0.22, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size * 0.2, y - size * 0.17, size * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.beginPath();
    ctx.ellipse(x - size * 0.08, y - size * 0.05, size * 0.16, size * 0.08, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e87835";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.35, y - size * 0.16);
    ctx.lineTo(x + size * 0.52, y - size * 0.1);
    ctx.lineTo(x + size * 0.35, y - size * 0.05);
    ctx.closePath();
    ctx.fill();
    this.drawEye(ctx, x + size * 0.24, y - size * 0.2, size);
  }

  drawSnake(ctx, x, y, size, player) {
    this.drawSpriteShadow(ctx, x, y + size * 0.05, size);
    ctx.strokeStyle = player.color;
    ctx.lineWidth = size * 0.2;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(21, 76, 56, 0.24)";
    ctx.shadowBlur = size * 0.14;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.35, y + size * 0.1);
    ctx.bezierCurveTo(x - size * 0.12, y - size * 0.28, x + size * 0.08, y + size * 0.28, x + size * 0.34, y - size * 0.05);
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = size * 0.055;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.28, y + size * 0.05);
    ctx.bezierCurveTo(x - size * 0.08, y - size * 0.18, x + size * 0.1, y + size * 0.15, x + size * 0.28, y - size * 0.07);
    ctx.stroke();
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x + size * 0.34, y - size * 0.05, size * 0.17, 0, Math.PI * 2);
    ctx.fill();
    this.drawEye(ctx, x + size * 0.39, y - size * 0.09, size);
  }

  drawFrog(ctx, x, y, size, player) {
    this.drawSpriteShadow(ctx, x, y + size * 0.03, size);
    ctx.strokeStyle = "rgba(101, 43, 91, 0.34)";
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - size * 0.16, y - size * 0.23, size * 0.12, 0, Math.PI * 2);
    ctx.arc(x + size * 0.16, y - size * 0.23, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.ellipse(x - size * 0.08, y - size * 0.03, size * 0.09, size * 0.05, -0.2, 0, Math.PI * 2);
    ctx.fill();
    this.drawEye(ctx, x - size * 0.16, y - size * 0.25, size);
    this.drawEye(ctx, x + size * 0.16, y - size * 0.25, size);
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.arc(x, y + size * 0.02, size * 0.15, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  drawEye(ctx, x, y, size) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17324a";
    ctx.beginPath();
    ctx.arc(x + size * 0.012, y, size * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSpriteShadow(ctx, x, y, size) {
    ctx.fillStyle = "rgba(13, 54, 68, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.28, size * 0.38, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMatchClock() {
    const ctx = this.ctx;
    const left = Math.max(0, MATCH_SECONDS - this.time);
    const minutes = Math.floor(left / 60);
    const seconds = Math.floor(left % 60)
      .toString()
      .padStart(2, "0");
    ctx.font = "900 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = `${minutes}:${seconds}`;
    const x = this.layout.width / 2;
    const y = 24;
    ctx.save();
    ctx.shadowColor = "rgba(24, 73, 91, 0.18)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    this.roundedRect(ctx, x - 38, y - 16, 76, 32, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#17324a";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawMiniMap() {
    const ctx = this.miniCtx;
    const width = this.miniMap.clientWidth;
    const height = this.miniMap.clientHeight;
    const cellW = width / this.tileManager.cols;
    const cellH = height / this.tileManager.rows;
    ctx.clearRect(0, 0, width, height);
    const miniGradient = ctx.createLinearGradient(0, 0, width, height);
    miniGradient.addColorStop(0, "#9feaf0");
    miniGradient.addColorStop(1, "#52bdd8");
    ctx.fillStyle = miniGradient;
    this.roundedRect(ctx, 0, 0, width, height, 8);
    ctx.fill();

    this.tileManager.forEach((tile) => {
      if (TILE_TYPES[tile.type].blocks) ctx.fillStyle = "#71808a";
      else if (tile.owner) ctx.fillStyle = this.getPlayer(tile.owner)?.color ?? "#d9c56a";
      else ctx.fillStyle = TILE_TYPES[tile.type].color;
      ctx.globalAlpha = tile.owner ? 0.88 : tile.type === "water" ? 0.18 : 0.62;
      ctx.fillRect(tile.x * cellW, tile.y * cellH, Math.ceil(cellW), Math.ceil(cellH));
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 2;
    this.roundedRect(ctx, 1, 1, width - 2, height - 2, 8);
    ctx.stroke();
  }

  roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }
}

const game = new PondFrontGame();
window.pondFrontGame = game;
