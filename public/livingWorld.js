(function initPondLivingWorld(root) {
  class PondLivingWorld {
    constructor(renderer) {
      this.renderer = renderer;
      this.state = null;
      this.entities = [];
      this.pool = [];
      this.spawnCounter = 1;
      this.lastSpawnAt = 0;
      this.lastElapsed = 0;
      this.options = {};
      this.debugPreview = null;
      this.profile = this.qualityProfile("medium");
      this.status = { phase: { id: "day", label: "Bright Day" }, weather: { id: "clear", label: "Clear Water" } };
    }

    qualityProfile(level = "medium") {
      const profiles = root.PondWorldAtmosphere?.QUALITY || {};
      return profiles[level] || profiles.medium || { entities: 24, wildlife: 8, spawnMs: 520, rain: 24, identity: 16, buildings: 12 };
    }

    configure(options = {}) {
      this.options = options;
      const quality = options.visualQuality || options.effects?.level || "medium";
      const base = this.qualityProfile(quality);
      const mobileScale = options.isMobile ? 0.58 : 1;
      const performanceScale = options.performanceLevel >= 2 ? 0.3 : options.performanceLevel >= 1 ? 0.62 : 1;
      const animationScale = { low: 0.42, medium: 0.7, high: 0.9, ultra: 1.1 }[options.world?.animationQuality || "medium"] || 0.7;
      const particleScale = { off: 0, low: 0.35, medium: 0.65, high: 0.9, ultra: 1.15 }[options.effects?.particles || "medium"] ?? 0.65;
      const worldMotionScale = options.world?.reducedAnimation ? 0.3 : animationScale;
      this.profile = {
        ...base,
        entities: Math.max(4, Math.round(base.entities * mobileScale * performanceScale * worldMotionScale)),
        wildlife: Math.max(1, Math.round(base.wildlife * mobileScale * performanceScale * worldMotionScale)),
        identity: Math.max(4, Math.round(base.identity * mobileScale * performanceScale)),
        buildings: Math.max(4, Math.round(base.buildings * mobileScale * performanceScale)),
        rain: Math.max(0, Math.round(base.rain * mobileScale * performanceScale * particleScale)),
        spawnMs: Math.round(base.spawnMs / Math.max(0.45, mobileScale * performanceScale)),
      };
      if (options.effects?.reducedMotion || options.batterySaver || options.strategicView || options.mapDecorations === false || options.livingWorld === false) this.trim(0);
      else this.trim(this.profile.entities);
    }

    setState(state) {
      if (!state) return;
      const elapsed = Number(state.elapsed || 0);
      if (elapsed + 2 < this.lastElapsed) this.reset();
      this.lastElapsed = elapsed;
      this.state = state;
      this.status = root.PondWorldAtmosphere?.atmosphereFor?.(state) || this.status;
    }

    setDebugPreview(type) {
      const now = performance.now();
      const preview = { until: now + 12000 };
      if (type === "rain") preview.weather = { id: "rain", label: "Debug Rain", visual: "rain", intensity: 1 };
      if (type === "night") preview.phase = { id: "night", label: "Debug Night", tint: "#07152d", alpha: 0.13 };
      if (type === "season") preview.season = { id: "autumn", label: "Debug Autumn", tint: "#d5a35b" };
      this.debugPreview = preview;
    }

    reset() {
      while (this.entities.length) this.release(this.entities.pop());
      this.lastSpawnAt = 0;
      this.spawnCounter = 1;
    }

    trim(limit = this.profile.entities) {
      while (this.entities.length > limit) this.release(this.entities.shift());
      if (this.pool.length > 90) this.pool.length = 90;
    }

    acquire() {
      return this.pool.pop() || {};
    }

    release(entity) {
      Object.keys(entity || {}).forEach((key) => delete entity[key]);
      if (this.pool.length < 90) this.pool.push(entity);
    }

    hash(value) {
      let x = Number(value || 0) | 0;
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
    }

    drawGround(ctx, visibleTiles = [], options = {}) {
      if (!this.state) return;
      this.configure(options);
      this.status = root.PondWorldAtmosphere?.atmosphereFor?.(this.state) || this.status;
      if (options.strategicView || options.mapDecorations === false || options.livingWorld === false || options.effects?.reducedMotion || this.renderer.camera.zoom < 0.48) return;
      this.drawTerritoryIdentity(ctx, visibleTiles);
      this.drawBuildingActivity(ctx, visibleTiles);
    }

    drawLighting(ctx, rect, options = {}) {
      if (!this.state || options.strategicView || options.livingWorld === false || options.visualQuality === "low") return;
      if (this.debugPreview?.until < performance.now()) this.debugPreview = null;
      const phase = this.debugPreview?.phase || this.status.phase || {};
      const season = this.debugPreview?.season || this.status.season || {};
      const weather = this.debugPreview?.weather || this.status.weather || {};
      ctx.save();
      if (options.world?.dayNightVisuals !== false) {
        ctx.fillStyle = phase.tint || "#b7edf2";
        ctx.globalAlpha = Math.min(0.14, Number(phase.alpha || 0));
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      if (options.world?.seasonalDecorations !== false && season.tint) {
        ctx.fillStyle = season.tint;
        ctx.globalAlpha = 0.018;
        ctx.fillRect(0, 0, rect.width, rect.height);
      }

      if (phase.id === "night" && options.world?.dayNightVisuals !== false) {
        const now = performance.now();
        const x = rect.width * (0.25 + Math.sin(now * 0.00008) * 0.05);
        const shine = ctx.createLinearGradient(x - 90, 0, x + 90, rect.height);
        shine.addColorStop(0, "rgba(180,224,242,0)");
        shine.addColorStop(0.5, "rgba(180,224,242,0.12)");
        shine.addColorStop(1, "rgba(180,224,242,0)");
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = shine;
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      if (options.world?.waterReflections !== false && options.waterQuality !== "low" && phase.id !== "night") this.drawReflections(ctx, rect);
      if (options.world?.fogEffects !== false && options.world?.fogQuality !== "off" && (phase.id === "sunrise" || (options.world?.weatherEffects !== false && weather.visual === "fog"))) this.drawFog(ctx, rect, weather.visual === "fog" ? weather.intensity || 0.5 : 0.22);
      if (options.world?.weatherEffects !== false && (weather.visual === "rain" || weather.visual === "storm")) this.drawRain(ctx, rect, weather.visual === "storm" ? 1 : weather.intensity || 0.45);
      if (options.world?.weatherEffects !== false && weather.visual === "wind") this.drawWind(ctx, rect, weather.intensity || 0.45);
      ctx.restore();
    }

    drawForeground(ctx, visibleTiles = [], options = {}) {
      if (!this.state || options.strategicView || options.mapDecorations === false || options.livingWorld === false || options.effects?.reducedMotion || this.renderer.camera.zoom < 0.5) return;
      const now = performance.now();
      this.updateEntities(now, visibleTiles);
      let wildlife = 0;
      for (const entity of this.entities) {
        if (wildlife >= this.profile.wildlife && ["duck", "frog", "animal", "bird"].includes(entity.kind)) continue;
        if (this.drawEntity(ctx, entity, now)) {
          if (["duck", "frog", "animal", "bird"].includes(entity.kind)) wildlife += 1;
        }
      }
    }

    updateEntities(now, visibleTiles) {
      for (let i = this.entities.length - 1; i >= 0; i -= 1) {
        const entity = this.entities[i];
        if (now - entity.born > entity.duration) {
          this.entities.splice(i, 1);
          this.release(entity);
        }
      }
      if (!visibleTiles.length || this.entities.length >= this.profile.entities || now - this.lastSpawnAt < this.profile.spawnMs) return;
      this.lastSpawnAt = now;
      const attempts = Math.min(14, visibleTiles.length);
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const seed = this.spawnCounter * 97 + attempt * 43 + Math.round(this.lastElapsed * 3);
        const tile = visibleTiles[Math.floor(this.hash(seed) * visibleTiles.length)];
        const kind = this.kindForTile(tile, seed);
        if (!kind) continue;
        this.spawn(tile, kind, now, seed);
        this.spawnCounter += 1;
        break;
      }
    }

    kindForTile(tile, seed) {
      if (!tile) return null;
      const phase = this.status.phase?.id;
      const season = this.status.season?.id;
      const roll = this.hash(seed + tile.id * 19);
      const particlesOff = this.options.effects?.particles === "off";
      if (!particlesOff && phase === "night" && this.options.world?.fireflies !== false && ["reeds", "lily", "grassIsland", "jungleIsland"].includes(tile.type) && roll < 0.68) return "firefly";
      if (particlesOff && ["reeds", "mud"].includes(tile.type)) return this.options.world?.decorativeAnimals === false ? null : roll < 0.2 ? "animal" : null;
      if (this.options.world?.decorativeAnimals === false && ["water", "lily"].includes(tile.type)) return roll < 0.62 ? "bubble" : this.options.world?.seasonalDecorations !== false ? "leaf" : null;
      if (season === "autumn" && this.options.world?.seasonalDecorations !== false && roll < 0.42) return "leaf";
      if (tile.owner && roll < 0.3) return "animal";
      if (tile.type === "lily") return roll < 0.38 ? "frog" : roll < 0.7 ? "dragonfly" : "bubble";
      if (tile.type === "reeds" || tile.type === "grassIsland" || tile.type === "jungleIsland") return roll < 0.42 ? "insect" : "leaf";
      if (tile.type === "mud") return roll < 0.5 ? "mud" : "insect";
      if (tile.type === "water" && !tile.owner && roll < 0.16) return "duck";
      if (tile.type === "water") return particlesOff ? (roll < 0.42 ? "fish" : roll > 0.9 ? "bird" : null) : roll < 0.5 ? "fish" : roll < 0.76 ? "bubble" : roll < 0.93 ? "leaf" : "bird";
      return null;
    }

    spawn(tile, kind, now, seed) {
      const size = this.renderer.baseTile;
      const entity = this.acquire();
      entity.kind = kind;
      entity.tileId = tile.id;
      entity.ownerId = tile.owner || null;
      entity.animal = tile.owner ? this.renderer.playerMap?.get(tile.owner)?.animal : null;
      entity.color = tile.owner ? this.renderer.playerColor(this.renderer.playerMap?.get(tile.owner)) : null;
      entity.seed = seed;
      entity.born = now;
      entity.duration = (5 + this.hash(seed + 5) * 8) * 1000;
      entity.x = (tile.x + 0.15 + this.hash(seed + 7) * 0.7) * size;
      entity.y = (tile.y + 0.15 + this.hash(seed + 11) * 0.7) * size;
      entity.vx = (this.hash(seed + 13) - 0.5) * (kind === "bird" ? 18 : kind === "duck" || kind === "fish" ? 5 : 1.8);
      entity.vy = (this.hash(seed + 17) - 0.5) * (kind === "bird" ? 5 : 1.8);
      this.entities.push(entity);
    }

    drawEntity(ctx, entity, now) {
      const age = (now - entity.born) / 1000;
      const life = Math.max(0, Math.min(1, (now - entity.born) / entity.duration));
      const point = this.renderer.worldToScreen(entity.x + entity.vx * age, entity.y + entity.vy * age);
      const width = this.renderer.canvas.clientWidth;
      const height = this.renderer.canvas.clientHeight;
      if (point.x < -32 || point.y < -32 || point.x > width + 32 || point.y > height + 32) return false;
      const size = Math.max(3, this.renderer.baseTile * this.renderer.camera.zoom * 0.22);
      const fade = Math.min(1, life * 5, (1 - life) * 5);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.globalAlpha = fade * (entity.kind === "fish" ? 0.34 : 0.62);
      if (entity.vx < 0) ctx.scale(-1, 1);
      const wobble = Math.sin(age * 3 + entity.seed) * size * 0.25;

      if (entity.kind === "fish") this.drawFish(ctx, size, wobble, entity.color);
      else if (entity.kind === "duck") this.drawDuck(ctx, size, wobble);
      else if (entity.kind === "frog") this.drawFrog(ctx, size, age);
      else if (entity.kind === "dragonfly") this.drawDragonfly(ctx, size, age);
      else if (entity.kind === "firefly") this.drawFirefly(ctx, size, age);
      else if (entity.kind === "bird") this.drawBird(ctx, size * 1.35, age);
      else if (entity.kind === "leaf") this.drawLeaf(ctx, size, age);
      else if (entity.kind === "bubble") this.drawBubble(ctx, size, age);
      else if (entity.kind === "mud") this.drawMud(ctx, size, age);
      else if (entity.kind === "insect") this.drawInsect(ctx, size, age);
      else if (entity.kind === "animal" && entity.animal) this.renderer.drawAnimalGlyph(ctx, entity.animal, 0, wobble, size * 1.3, entity.color || "#83dced", "#edf8fb");
      ctx.restore();
      return true;
    }

    drawFish(ctx, r, wobble, color = "#b8edf5") {
      ctx.fillStyle = color || "#b8edf5";
      ctx.beginPath();
      ctx.ellipse(0, wobble, r * 1.15, r * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r, wobble);
      ctx.lineTo(-r * 1.65, wobble - r * 0.65);
      ctx.lineTo(-r * 1.65, wobble + r * 0.65);
      ctx.closePath();
      ctx.fill();
    }

    drawDuck(ctx, r, wobble) {
      ctx.strokeStyle = "rgba(210,247,250,0.55)";
      ctx.lineWidth = Math.max(1, r * 0.18);
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, r * 0.75, r * 1.7, r * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f1d36a";
      ctx.beginPath();
      ctx.ellipse(0, wobble, r * 1.2, r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.72, wobble - r * 0.55, r * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e99755";
      ctx.fillRect(r * 1.08, wobble - r * 0.58, r * 0.55, r * 0.18);
    }

    drawFrog(ctx, r, age) {
      const jump = Math.max(0, Math.sin(age * 2.3)) * r * 0.9;
      ctx.fillStyle = "rgba(129,200,116,0.42)";
      ctx.beginPath();
      ctx.ellipse(0, r * 0.55, r * 1.4, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#82d889";
      ctx.beginPath();
      ctx.arc(0, -jump, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    drawDragonfly(ctx, r, age) {
      ctx.rotate(Math.sin(age * 2) * 0.3);
      ctx.strokeStyle = "#d8f6f3";
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.8, -r * 0.85);
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.8, r * 0.85);
      ctx.stroke();
    }

    drawFirefly(ctx, r, age) {
      const pulse = 0.45 + Math.sin(age * 5) * 0.35;
      ctx.shadowColor = "#fff1a8";
      ctx.shadowBlur = r * 2.4;
      ctx.globalAlpha *= pulse;
      ctx.fillStyle = "#fff1a8";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBird(ctx, r, age) {
      const wing = Math.sin(age * 7) * r * 0.55;
      ctx.strokeStyle = "rgba(225,245,247,0.72)";
      ctx.lineWidth = Math.max(1, r * 0.13);
      ctx.beginPath();
      ctx.moveTo(-r, wing);
      ctx.quadraticCurveTo(-r * 0.45, 0, 0, r * 0.15);
      ctx.quadraticCurveTo(r * 0.45, 0, r, wing);
      ctx.stroke();
    }

    drawLeaf(ctx, r, age) {
      ctx.rotate(age * 0.7);
      ctx.fillStyle = "#9ccf76";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.82, r * 0.38, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBubble(ctx, r, age) {
      ctx.strokeStyle = "rgba(205,245,248,0.8)";
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.arc(0, -age * r * 0.35, r * (0.34 + age * 0.05), 0, Math.PI * 2);
      ctx.stroke();
    }

    drawMud(ctx, r, age) {
      ctx.fillStyle = "rgba(139,103,70,0.72)";
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc((i - 1) * r * 0.6, -Math.abs(Math.sin(age * 3 + i)) * r, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawInsect(ctx, r, age) {
      ctx.rotate(Math.sin(age * 5) * 0.7);
      ctx.fillStyle = "#d6e49b";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(230,246,220,0.7)";
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.3);
      ctx.lineTo(r * 0.7, r * 0.3);
      ctx.moveTo(-r * 0.7, r * 0.3);
      ctx.lineTo(r * 0.7, -r * 0.3);
      ctx.stroke();
    }

    drawTerritoryIdentity(ctx, visibleTiles) {
      if (this.renderer.camera.zoom < 0.64) return;
      const tileSize = this.renderer.baseTile * this.renderer.camera.zoom;
      let drawn = 0;
      for (const tile of visibleTiles) {
        if (drawn >= this.profile.identity || !tile.owner || this.hash(tile.id * 71 + 23) > 0.045) continue;
        const player = this.renderer.playerMap?.get(tile.owner);
        if (!player) continue;
        const p = this.renderer.tileCenter(tile);
        this.drawFactionMotif(ctx, player.animal, p.x, p.y, tileSize * 0.16, this.renderer.playerColor(player), tile.id);
        drawn += 1;
      }
    }

    drawFactionMotif(ctx, animal, x, y, r, color, seed) {
      const pulse = 0.72 + Math.sin(performance.now() * 0.0015 + seed) * 0.18;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.26 * pulse;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, r * 0.17);
      if (animal === "duck") {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.25, r * 0.42, -0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, r * 0.2);
        ctx.lineTo(r * 0.8, -r * 0.2);
        ctx.stroke();
      } else if (animal === "frog") {
        ctx.beginPath();
        ctx.arc(-r * 0.5, 0, r * 0.34, 0, Math.PI * 2);
        ctx.arc(r * 0.45, -r * 0.3, r * 0.22, 0, Math.PI * 2);
        ctx.stroke();
      } else if (animal === "turtle") {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
      } else if (animal === "snake") {
        ctx.beginPath();
        ctx.moveTo(-r, r * 0.45);
        ctx.bezierCurveTo(-r * 0.35, -r, r * 0.35, r, r, -r * 0.42);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(-r * 0.4, 0, r * 0.48, -0.8, 0.8);
        ctx.arc(r * 0.25, 0, r * 0.48, -0.8, 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBuildingActivity(ctx, visibleTiles) {
      if (this.renderer.camera.zoom < 0.72) return;
      const serverTime = Number(this.state.serverTime || 0);
      const threatened = new Set();
      (this.state.activeAttacks || []).forEach((wave) => {
        if (wave.targetStartTile != null) threatened.add(wave.targetStartTile);
        (wave.frontierTiles || []).forEach((id) => threatened.add(id));
      });
      let drawn = 0;
      for (const tile of visibleTiles) {
        if (drawn >= this.profile.buildings || !tile.building || (tile.buildingActiveAt || 0) > serverTime) continue;
        const p = this.renderer.tileCenter(tile);
        const size = this.renderer.baseTile * this.renderer.camera.zoom;
        this.drawActiveBuilding(ctx, tile, p.x, p.y, size, threatened.has(tile.id));
        drawn += 1;
      }
    }

    drawActiveBuilding(ctx, tile, x, y, size, threatened) {
      const now = performance.now();
      const pulse = 0.5 + Math.sin(now * 0.003 + tile.id) * 0.5;
      const player = this.renderer.playerMap?.get(tile.owner);
      const ownerColor = player ? this.renderer.playerColor(player) : "#83dced";
      ctx.save();
      ctx.globalAlpha = 0.3 + pulse * 0.18;
      ctx.strokeStyle = threatened ? "#f08b78" : ownerColor;
      ctx.lineWidth = Math.max(1, size * 0.025);
      if (tile.building === "nest") {
        ctx.shadowColor = this.status.phase?.id === "night" ? "#fff1a8" : ownerColor;
        ctx.shadowBlur = this.options.shadowQuality === "off" ? 0 : size * (this.options.shadowQuality === "high" ? 0.5 : this.options.shadowQuality === "medium" ? 0.3 : 0.14);
        ctx.beginPath();
        ctx.arc(x, y, size * (0.23 + pulse * 0.03), 0, Math.PI * 2);
        ctx.stroke();
      } else if (tile.building === "lilyFarm") {
        for (let i = 0; i < 3; i += 1) {
          const angle = now * 0.00045 + i * 2.1 + tile.id;
          ctx.fillStyle = "#a7e7ad";
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * size * 0.24, y + Math.sin(angle) * size * 0.17 - pulse * size * 0.08, size * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (tile.building === "reedGuard") {
        ctx.strokeStyle = threatened ? "#fff1a8" : "#d7e49b";
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x + i * size * 0.12, y + size * 0.24);
          ctx.quadraticCurveTo(x + i * size * 0.12 + Math.sin(now * 0.002 + i) * size * 0.08, y, x + i * size * 0.1, y - size * 0.26);
          ctx.stroke();
        }
      } else if (tile.building === "mudTunnel") {
        ctx.fillStyle = "rgba(157,112,71,0.72)";
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(now * 0.002 + tile.id) * size * 0.18, y + size * 0.2, size * 0.16, size * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile.building === "jumpPad") {
        ctx.beginPath();
        ctx.arc(x, y, size * (0.24 + pulse * 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFog(ctx, rect, intensity) {
      const now = performance.now();
      ctx.fillStyle = "rgba(218,240,245,0.48)";
      ctx.globalAlpha = Math.min(0.16, intensity * 0.16);
      const rank = { low: 1, medium: 2, high: 3, ultra: 4 }[this.options.world?.fogQuality || "medium"] || 2;
      const count = Math.max(2, (this.options.isMobile ? 1 : 2) + rank);
      for (let i = 0; i < count; i += 1) {
        const x = ((i * 263 + now * 0.009) % (rect.width + 300)) - 150;
        const y = rect.height * (0.2 + i * 0.14);
        ctx.beginPath();
        ctx.ellipse(x, y, 180, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawRain(ctx, rect, intensity) {
      const now = performance.now();
      ctx.globalAlpha = Math.min(0.24, 0.1 + intensity * 0.12);
      ctx.strokeStyle = "rgba(205,241,248,0.72)";
      ctx.lineWidth = 1;
      const count = Math.round(this.profile.rain * intensity);
      for (let i = 0; i < count; i += 1) {
        const x = (i * 83 + now * 0.08) % (rect.width + 80) - 40;
        const y = (i * 47 + now * 0.17) % (rect.height + 80) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 7, y + 18);
        ctx.stroke();
        if (i % 4 === 0) {
          ctx.beginPath();
          ctx.ellipse(x + 7, y + 20, 5 + intensity * 3, 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    drawWind(ctx, rect, intensity) {
      const now = performance.now();
      ctx.globalAlpha = 0.08 + intensity * 0.08;
      ctx.strokeStyle = "rgba(211,244,245,0.66)";
      ctx.lineWidth = 1;
      const count = this.options.isMobile ? 4 : 8;
      for (let i = 0; i < count; i += 1) {
        const x = (i * 181 + now * 0.025) % (rect.width + 180) - 90;
        const y = rect.height * (0.15 + (i % 6) * 0.13);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 32, y - 6, x + 70, y + 2);
        ctx.stroke();
      }
    }

    drawReflections(ctx, rect) {
      const now = performance.now();
      ctx.strokeStyle = "rgba(205,244,245,0.32)";
      ctx.globalAlpha = this.options.world?.reducedAnimation ? 0.05 : 0.09;
      ctx.lineWidth = 1;
      const rank = { low: 0, medium: 1, high: 2, ultra: 3 }[this.options.waterQuality || "medium"] ?? 1;
      const count = (this.options.isMobile ? 3 : 5) + rank * (this.options.isMobile ? 1 : 3);
      for (let index = 0; index < count; index += 1) {
        const y = rect.height * (0.12 + index * 0.095);
        const x = ((index * 137 + now * 0.008) % (rect.width + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 36, y);
        ctx.stroke();
      }
    }
  }

  root.PondLivingWorld = PondLivingWorld;
})(window);
