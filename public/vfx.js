(function initPondVFX(root) {
  const BUILDING_META = {
    nest: { label: "Nest Built", color: "#f2d87a", particle: "#fff0b8" },
    lilyFarm: { label: "Lily Farm Built", color: "#77d99e", particle: "#a7e7ad" },
    reedGuard: { label: "Reed Guard Built", color: "#a7c774", particle: "#d7e49b" },
    mudTunnel: { label: "Mud Tunnel Built", color: "#9b7750", particle: "#6d5038" },
    jumpPad: { label: "Jump Pad Built", color: "#7ed6df", particle: "#cdf7ff" },
  };

  class PondVFX {
    constructor(renderer) {
      this.renderer = renderer;
      this.effects = [];
      this.particles = [];
      this.notices = [];
      this.settings = {
        level: "high",
        floatingText: true,
        attackArrows: true,
        reducedMotion: false,
      };
      this.maxEffects = 180;
      this.maxParticles = 260;
    }

    configure(settings = {}) {
      this.settings = { ...this.settings, ...settings };
      this.maxEffects = this.settings.level === "high" ? 220 : this.settings.level === "medium" ? 140 : 70;
      this.maxParticles = this.settings.level === "high" ? 320 : this.settings.level === "medium" ? 180 : 80;
    }

    addEvents(events, state) {
      if (!events.length) return;
      events.forEach((event) => this.handleEvent(event, state));
      this.trim();
    }

    handleEvent(event, state) {
      const player = state?.players?.find((candidate) => candidate.id === event.playerId);
      const color = player?.color || "#d8ad48";

      if (event.kind === "expand") {
        this.spawnCaptureEffect(event.to, color, "Expanded");
      } else if (event.kind === "expandProgress") {
        this.spawnPulse(event.to, color, 0.82);
        this.spawnRipple(event.to, color, 0.72);
        this.spawnFloatingText(event.to, `${event.progress}/${event.cost}`, "#edf8fb");
      } else if (event.kind === "attackWave") {
        if (this.settings.attackArrows) this.spawnAttackArrow(event.from, event.to, color, event.amount ? `-${event.amount} Energy` : "");
        this.spawnPulse(event.to, color, 1.25);
      } else if (event.kind === "waveCapture") {
        this.spawnCaptureEffect(event.to, color, "Captured");
        this.spawnAttackArrow(event.from, event.to, color, "");
      } else if (event.kind === "waveResist") {
        this.spawnBlockedEffect(event.to, "Blocked");
      } else if (event.kind === "defend") {
        this.spawnDefendEffect([event.to]);
      } else if (event.kind === "ability") {
        this.spawnSkillEffect(event.playerId, event.skillType || player?.animal || event.ability, event.ability, player?.name);
        if (player?.isBot) this.spawnScreenNotice(`${player.name}: ${event.ability}`, color);
      } else if (event.kind === "abilityUsed") {
        this.spawnPulse(event.to, color, 1.35);
        this.spawnAttackArrow(event.from, event.to, color, "Ambush Used");
        this.spawnFloatingText(event.to, "Ambush Used", color);
      } else if (event.kind === "buildComplete") {
        this.spawnBuildEffect(event.to, event.buildingType);
      } else if (event.kind === "buildUpgrade") {
        this.spawnBuildEffect(event.to, event.buildingType);
        this.spawnFloatingText(event.to, "Building Upgraded", "#f2d87a");
      } else if (event.kind === "buildRemove") {
        this.spawnBlockedEffect(event.to, "Removed");
      } else if (event.kind === "ping") {
        const label = root.PondInfo?.PING_LABELS?.[event.pingType] || "Ping";
        this.spawnPulse(event.to, color, 1.25);
        this.spawnFloatingText(event.to, label, color);
      } else if (event.kind === "diplomacy") {
        const label = event.subtype === "alliance" ? "Alliance Formed" : event.subtype === "broken" ? "Alliance Broken" : "Diplomacy Updated";
        this.spawnScreenNotice(label, event.subtype === "broken" ? "#d96b61" : "#87d7ea");
      }
    }

    spawnRipple(tileId, color = "#9ee7f4", size = 1) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "ripple", ...point, color, size, born: performance.now(), life: this.life(760) });
    }

    spawnPulse(tileId, color = "#f2d87a", size = 1) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "pulse", ...point, color, size, born: performance.now(), life: this.life(680) });
    }

    spawnFloatingText(target, text, color = "#edf8fb") {
      if (!this.settings.floatingText || !text) return;
      const point = typeof target === "number" ? this.tileWorldPoint(target) : target;
      if (!point) return;
      this.effects.push({ kind: "text", ...point, text, color, born: performance.now(), life: this.life(1050) });
    }

    spawnAttackArrow(fromTile, toTile, color = "#d8ad48", text = "") {
      if (!this.settings.attackArrows) return;
      const from = this.tileWorldPoint(fromTile);
      const to = this.tileWorldPoint(toTile);
      if (!from || !to) return;
      this.effects.push({ kind: "arrow", from, to, color, text, born: performance.now(), life: this.life(850) });
    }

    spawnCaptureEffect(tileId, color = "#d8ad48", text = "Captured") {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "capture", ...point, color, born: performance.now(), life: this.life(680) });
      this.spawnRipple(tileId, color, 1.15);
      this.spawnFloatingText(tileId, text, "#edf8fb");
      this.spawnParticles(point, color, this.count(7), 46, "splash");
    }

    spawnBlockedEffect(tileId, text = "Defended") {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "shield", ...point, color: "#dceff4", born: performance.now(), life: this.life(820) });
      this.spawnFloatingText(tileId, text, "#edf8fb");
    }

    spawnBuildEffect(tileId, buildingType) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      const meta = BUILDING_META[buildingType] || { label: "Built", color: "#87d7ea", particle: "#edf8fb" };
      this.effects.push({ kind: "build", ...point, buildingType, color: meta.color, born: performance.now(), life: this.life(1050) });
      this.spawnRipple(tileId, meta.color, buildingType === "mudTunnel" ? 1.35 : 1.1);
      this.spawnPulse(tileId, meta.color, buildingType === "jumpPad" ? 1.35 : 1);
      this.spawnFloatingText(tileId, meta.label, meta.color);
      this.spawnParticles(point, meta.particle, this.count(14), 54, buildingType);
    }

    spawnDefendEffect(tileIds = []) {
      tileIds.slice(0, 24).forEach((tileId) => {
        const point = this.tileWorldPoint(tileId);
        if (!point) return;
        this.effects.push({ kind: "shield", ...point, color: "#87d7ea", born: performance.now(), life: this.life(900) });
      });
      if (tileIds[0] != null) this.spawnFloatingText(tileIds[0], "Border Reinforced", "#aee7f4");
    }

    spawnSkillEffect(playerId, skillType, abilityName = "", playerName = "") {
      const tiles = this.ownedTiles(playerId);
      const center = this.regionCenter(tiles);
      if (!center) return;
      const normalized = String(skillType || "").toLowerCase();
      const isSnake = normalized.includes("snake") || normalized.includes("ambush");
      const isFrog = normalized.includes("frog") || normalized.includes("leap");
      const color = isSnake ? "#5fbf83" : isFrog ? "#bc6ca2" : "#f2d87a";
      const text = isSnake ? "Ambush Ready!" : isFrog ? "Big Leap!" : "Flock Rush!";
      const kind = isSnake ? "snakeSkill" : isFrog ? "frogSkill" : "duckSkill";
      this.effects.push({ kind, ...center, color, born: performance.now(), life: this.life(1250) });
      this.spawnFloatingText(center, playerName ? `${playerName}: ${abilityName || text}` : abilityName || text, color);
      this.spawnParticles(center, color, this.count(isFrog ? 18 : 24), isFrog ? 88 : 72, kind);
    }

    spawnScreenNotice(text, color = "#87d7ea") {
      if (!this.settings.floatingText || !text) return;
      this.notices.push({ text, color, born: performance.now(), life: this.life(1600) });
      this.notices = this.notices.slice(-4);
    }

    spawnParticles(point, color, count, spread, style) {
      if (this.settings.level === "low" && style !== "shield") count = Math.min(count, 4);
      if (this.settings.reducedMotion) count = Math.min(count, 5);
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.25 + Math.random() * 0.75) * spread;
        this.particles.push({
          wx: point.wx,
          wy: point.wy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          style,
          born: performance.now(),
          life: this.life(620 + Math.random() * 360),
          size: 1 + Math.random() * 2.6,
        });
      }
    }

    draw(ctx) {
      const now = performance.now();
      this.effects = this.effects.filter((effect) => now - effect.born < effect.life);
      this.particles = this.particles.filter((particle) => now - particle.born < particle.life);
      this.notices = this.notices.filter((notice) => now - notice.born < notice.life);

      this.drawEffects(ctx, now);
      this.drawParticles(ctx, now);
      this.drawNotices(ctx, now);
    }

    drawEffects(ctx, now) {
      const tileSize = this.renderer.baseTile * this.renderer.camera.zoom;
      this.effects.forEach((effect) => {
        const t = Math.min(1, (now - effect.born) / effect.life);
        const alpha = 1 - t;

        if (effect.kind === "arrow") {
          this.drawArrow(ctx, effect, t, alpha);
          return;
        }
        if (effect.kind === "text") {
          const p = this.worldToScreen(effect.wx, effect.wy);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = "900 12px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(4, 12, 18, 0.78)";
          ctx.fillStyle = effect.color;
          ctx.strokeText(effect.text, p.x, p.y - 16 - t * 22);
          ctx.fillText(effect.text, p.x, p.y - 16 - t * 22);
          ctx.restore();
          return;
        }

        const p = this.worldToScreen(effect.wx, effect.wy);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.fillStyle = this.withAlpha(effect.color, Math.max(0, 0.18 * alpha));

        if (effect.kind === "capture") {
          const r = tileSize * (0.18 + t * 0.52);
          ctx.lineWidth = Math.max(1, tileSize * 0.055);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (effect.kind === "ripple") {
          ctx.lineWidth = Math.max(1, tileSize * 0.04);
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * effect.size * (0.18 + t * 0.78), 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.kind === "pulse") {
          ctx.lineWidth = Math.max(1, tileSize * 0.065);
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * effect.size * (0.28 + Math.sin(t * Math.PI) * 0.18), 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.kind === "shield") {
          ctx.lineWidth = Math.max(2, tileSize * 0.055);
          this.roundRect(ctx, p.x - tileSize * 0.34, p.y - tileSize * 0.34, tileSize * 0.68, tileSize * 0.68, tileSize * 0.16);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.24 + t * 0.32), 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.kind === "build") {
          const pop = Math.sin(Math.min(1, t * 1.4) * Math.PI);
          ctx.lineWidth = Math.max(2, tileSize * 0.05);
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.28 + t * 0.42), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = Math.min(0.55, alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.16 + pop * 0.08), 0, Math.PI * 2);
          ctx.fill();
        } else if (effect.kind === "duckSkill" || effect.kind === "snakeSkill" || effect.kind === "frogSkill") {
          const radius = tileSize * (0.8 + t * (effect.kind === "frogSkill" ? 2.3 : 1.5));
          ctx.lineWidth = Math.max(2, tileSize * 0.07);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          if (effect.kind === "snakeSkill") {
            ctx.setLineDash([tileSize * 0.18, tileSize * 0.16]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius * 0.62, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      });
    }

    drawArrow(ctx, effect, t, alpha) {
      const from = this.worldToScreen(effect.from.wx, effect.from.wy);
      const to = this.worldToScreen(effect.to.wx, effect.to.wy);
      const mx = from.x + (to.x - from.x) * t;
      const my = from.y + (to.y - from.y) * t;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = effect.color;
      ctx.fillStyle = effect.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - Math.cos(angle - 0.55) * 10, my - Math.sin(angle - 0.55) * 10);
      ctx.lineTo(mx - Math.cos(angle + 0.55) * 10, my - Math.sin(angle + 0.55) * 10);
      ctx.closePath();
      ctx.fill();
      if (effect.text && this.settings.floatingText) {
        ctx.font = "900 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(4, 12, 18, 0.75)";
        ctx.fillStyle = "#edf8fb";
        ctx.strokeText(effect.text, mx, my - 14);
        ctx.fillText(effect.text, mx, my - 14);
      }
      ctx.restore();
    }

    drawParticles(ctx, now) {
      this.particles.forEach((particle) => {
        const t = Math.min(1, (now - particle.born) / particle.life);
        const ease = this.settings.reducedMotion ? 0.25 : t;
        const p = this.worldToScreen(particle.wx + particle.vx * ease * 0.45, particle.wy + particle.vy * ease * 0.45);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = particle.color;
        ctx.strokeStyle = particle.color;
        if (particle.style === "nest" || particle.style === "duckSkill") {
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x - particle.size * 2, p.y);
          ctx.lineTo(p.x + particle.size * 2, p.y + particle.size);
          ctx.stroke();
        } else if (particle.style === "lilyFarm" || particle.style === "frogSkill") {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 2.2, particle.size, 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    drawNotices(ctx, now) {
      if (!this.notices.length) return;
      const rect = this.renderer.canvas.getBoundingClientRect();
      this.notices.forEach((notice, index) => {
        const t = Math.min(1, (now - notice.born) / notice.life);
        ctx.save();
        ctx.globalAlpha = Math.min(1, 1 - t);
        ctx.font = "900 13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(4, 12, 18, 0.82)";
        ctx.fillStyle = notice.color;
        const y = 86 + index * 20 - t * 12;
        ctx.strokeText(notice.text, rect.width / 2, y);
        ctx.fillText(notice.text, rect.width / 2, y);
        ctx.restore();
      });
    }

    trim() {
      if (this.effects.length > this.maxEffects) this.effects.splice(0, this.effects.length - this.maxEffects);
      if (this.particles.length > this.maxParticles) this.particles.splice(0, this.particles.length - this.maxParticles);
    }

    ownedTiles(playerId) {
      return [...(this.renderer.tileMap?.values() || [])].filter((tile) => tile.owner === playerId);
    }

    regionCenter(tiles) {
      if (!tiles.length) return null;
      const total = tiles.reduce((sum, tile) => ({ x: sum.x + tile.x + 0.5, y: sum.y + tile.y + 0.5 }), { x: 0, y: 0 });
      return {
        wx: (total.x / tiles.length) * this.renderer.baseTile,
        wy: (total.y / tiles.length) * this.renderer.baseTile,
      };
    }

    tileWorldPoint(tileId) {
      const tile = this.renderer.tileMap?.get(tileId);
      if (!tile) return null;
      return {
        wx: (tile.x + 0.5) * this.renderer.baseTile,
        wy: (tile.y + 0.5) * this.renderer.baseTile,
      };
    }

    worldToScreen(wx, wy) {
      return this.renderer.worldToScreen(wx, wy);
    }

    life(value) {
      if (this.settings.reducedMotion) return Math.min(value, 520);
      return this.settings.level === "low" ? value * 0.72 : value;
    }

    count(value) {
      if (this.settings.reducedMotion) return Math.max(2, Math.round(value * 0.25));
      if (this.settings.level === "medium") return Math.max(2, Math.round(value * 0.6));
      if (this.settings.level === "low") return Math.max(1, Math.round(value * 0.32));
      return value;
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

  root.PondVFX = PondVFX;
})(window);
