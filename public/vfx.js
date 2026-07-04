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
      this.shake = { power: 0, until: 0, started: 0 };
      this.settings = {
        level: "high",
        floatingText: true,
        attackArrows: true,
        screenShake: true,
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
        this.spawnAttackPowerEffect(event.from, event.to, color, event.amount || 0, event.abilityModifier);
      } else if (event.kind === "waveCapture") {
        this.spawnCaptureEffect(event.to, color, "Captured");
        this.spawnAttackArrow(event.from, event.to, color, "");
      } else if (event.kind === "waveResist") {
        this.spawnBlockedEffect(event.to, "Blocked");
      } else if (event.kind === "supportSent") {
        const target = state?.players?.find((candidate) => candidate.id === event.targetId);
        this.spawnAttackArrow(player?.coreTileId, target?.coreTileId, "#87d7ea", `+${event.received || event.amount || 0}`);
        this.spawnScreenNotice("Support Sent", "#87d7ea");
      } else if (event.kind === "continuousAttackStart") {
        this.spawnAttackArrow(event.from, event.to, color, "Push");
        this.spawnScreenNotice("Continuous Attack", color);
      } else if (event.kind === "continuousAttackStop") {
        this.spawnBlockedEffect(event.to, "Stopped");
      } else if (event.kind === "continuousAttackPulse") {
        this.spawnPulse(event.to, color, 0.86);
      } else if (event.kind === "waterRouteAttack") {
        (event.routeTiles || []).slice(0, 18).forEach((tileId) => this.spawnRipple(tileId, "#87d7ea", 0.62));
        this.spawnAttackArrow(event.from, event.to, color, `${event.travelTime || ""}s`.trim() || "Current");
        this.spawnScreenNotice("Current Push Launched", "#87d7ea");
      } else if (event.kind === "currentPushWarning") {
        (event.routeTiles || []).slice(-18).forEach((tileId) => this.spawnRipple(tileId, "#fff1a8", 0.5));
        this.spawnPulse(event.to, "#fff1a8", 1.45);
        this.spawnFloatingText(event.to, `${Math.ceil(event.impactIn || 0)}s`, "#fff1a8");
      } else if (event.kind === "currentPushImpact") {
        this.spawnRipple(event.to, event.captured > 0 ? color : "#edf8fb", event.captured > 0 ? 1.35 : 0.9);
        this.spawnScreenNotice(event.captured > 0 ? `Current Push: ${event.captured} tiles` : "Current Push Blocked", event.captured > 0 ? color : "#edf8fb");
      } else if (event.kind === "currentPushBlocked") {
        this.spawnBlockedEffect(event.to, "Current Blocked");
      } else if (event.kind === "coreUnderAttack") {
        this.spawnBlockedEffect(event.to, "Core Hit");
        this.spawnScreenNotice("Core Nest Under Attack", "#e9857c");
      } else if (event.kind === "coreCaptured") {
        this.spawnObjectiveEffect(event.to, color, "Core Captured!");
      } else if (event.kind === "surrender") {
        this.spawnScreenNotice(event.message || "Player Surrendered", "#f2d87a");
      } else if (event.kind === "eliminated") {
        this.spawnScreenNotice(event.message || "Eliminated", event.playerId === state?.humanId ? "#e9857c" : "#f2d87a");
      } else if (event.kind === "defend") {
        this.spawnDefendEffect([event.to]);
      } else if (event.kind === "ability") {
        this.spawnSkillEffect(event.playerId, event.skillType || player?.animal || event.ability, event.ability, player?.name);
        if ((event.skillType || player?.animal) === "turtle" && event.affectedTiles?.length) this.spawnDefendEffect(event.affectedTiles);
        if ((event.skillType || player?.animal) === "carp" && event.affectedTiles?.length) {
          event.affectedTiles.slice(0, 20).forEach((tileId) => this.spawnRipple(tileId, "#f0cc74", 0.9));
        }
        if (player?.isBot) this.spawnScreenNotice(`${player.name}: ${event.ability}`, color);
      } else if (event.kind === "abilityUsed") {
        this.spawnPulse(event.to, color, 1.35);
        this.spawnAttackArrow(event.from, event.to, color, "Ambush Used");
        this.spawnFloatingText(event.to, "Ambush Used", color);
      } else if (event.kind === "buildStarted") {
        this.spawnRipple(event.to, "#f2d87a", 0.72);
        this.spawnFloatingText(event.to, "Building", "#f2d87a");
      } else if (event.kind === "buildUpgradeStarted") {
        this.spawnRipple(event.to, "#f2d87a", 0.72);
        this.spawnFloatingText(event.to, `Upgrade L${event.level || ""}`.trim(), "#f2d87a");
      } else if (event.kind === "buildComplete") {
        this.spawnBuildEffect(event.to, event.buildingType);
      } else if (event.kind === "buildUpgrade") {
        this.spawnBuildEffect(event.to, event.buildingType, true);
      } else if (event.kind === "buildRemove") {
        this.spawnBlockedEffect(event.to, "Removed");
      } else if (event.kind === "objectiveAppeared") {
        this.spawnObjectiveEffect(event.to, "#f2d87a", "Objective!");
      } else if (event.kind === "objectiveCaptured") {
        this.spawnObjectiveEffect(event.to, color, "Objective Captured!");
      } else if (event.kind === "campCaptured") {
        this.spawnObjectiveEffect(event.to, color, "Camp Captured!");
      } else if (event.kind === "waveEnd" && (event.captured || 0) === 0) {
        this.spawnScreenNotice("Enemy Blocked!", "#edf8fb");
      } else if (event.kind === "ended") {
        this.spawnScreenNotice(event.message || "Match Over", event.winnerId === state?.humanId ? "#f2d87a" : "#e9857c");
      } else if (event.kind === "ping") {
        const label = root.PondInfo?.PING_LABELS?.[event.pingType] || "Ping";
        this.spawnPulse(event.to, color, 1.25);
        this.spawnFloatingText(event.to, label, color);
      } else if (event.kind === "diplomacy") {
        const label = event.subtype === "alliance" ? "Alliance Formed" : event.subtype === "broken" ? "Alliance Broken" : "Diplomacy Updated";
        this.spawnScreenNotice(label, event.subtype === "broken" ? "#d96b61" : "#87d7ea");
      }
    }

    spawnAttackPowerEffect(fromTile, toTile, color = "#d8ad48", amount = 0, modifier = "") {
      const label = amount >= 85 ? "Massive Wave!" : amount >= 45 ? "Big Push!" : amount >= 22 ? "Strong Push" : "";
      const size = amount >= 85 ? 1.85 : amount >= 45 ? 1.45 : amount >= 22 ? 1.12 : 0.9;
      if (this.settings.attackArrows) this.spawnAttackArrow(fromTile, toTile, color, modifier || (amount ? `-${amount}` : ""));
      this.spawnPulse(toTile, color, 1.1 * size);
      this.spawnRipple(toTile, color, 0.92 * size);
      const point = this.tileWorldPoint(toTile);
      if (point) {
        this.effects.push({ kind: "attackBurst", ...point, color, size, born: performance.now(), life: this.life(820 + amount * 3) });
        this.spawnParticles(point, color, this.count(amount >= 85 ? 26 : amount >= 45 ? 18 : 9), amount >= 85 ? 118 : 76, "attack");
      }
      if (label) {
        this.spawnFloatingText(toTile, label, amount >= 85 ? "#f2d87a" : "#edf8fb");
        this.spawnScreenNotice(label, amount >= 85 ? "#f2d87a" : color);
      }
      if (amount >= 45) this.screenShake(amount >= 85 ? 7 : 4, amount >= 85 ? 440 : 260);
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

    spawnBuildEffect(tileId, buildingType, upgraded = false) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      const meta = BUILDING_META[buildingType] || { label: "Built", color: "#87d7ea", particle: "#edf8fb" };
      this.effects.push({ kind: "build", ...point, buildingType, color: meta.color, upgraded, born: performance.now(), life: this.life(upgraded ? 1280 : 1050) });
      this.spawnRipple(tileId, meta.color, buildingType === "mudTunnel" ? 1.45 : upgraded ? 1.32 : 1.1);
      this.spawnPulse(tileId, meta.color, buildingType === "jumpPad" ? 1.45 : upgraded ? 1.25 : 1);
      this.spawnFloatingText(tileId, upgraded ? "Building Upgraded!" : meta.label, meta.color);
      if (upgraded) this.spawnFloatingText(tileId, "Level Up!", "#f2d87a");
      this.spawnParticles(point, meta.particle, this.count(upgraded ? 22 : 14), upgraded ? 74 : 54, buildingType);
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
      const isTurtle = normalized.includes("turtle") || normalized.includes("shell");
      const isCarp = normalized.includes("carp") || normalized.includes("current");
      const color = isSnake ? "#5fbf83" : isFrog ? "#48e08f" : isTurtle ? "#6fc5d8" : isCarp ? "#f0b44f" : "#f2d87a";
      const text = isSnake ? "Ambush Ready!" : isFrog ? "Big Leap!" : isTurtle ? "Shell Guard!" : isCarp ? "Golden Current!" : "Flock Rush!";
      const kind = isSnake ? "snakeSkill" : isFrog ? "frogSkill" : isTurtle ? "turtleSkill" : isCarp ? "carpSkill" : "duckSkill";
      this.effects.push({ kind, ...center, color, born: performance.now(), life: this.life(1250) });
      this.spawnFloatingText(center, playerName ? `${playerName}: ${abilityName || text}` : abilityName || text, color);
      this.spawnParticles(center, color, this.count(isFrog ? 18 : isTurtle ? 20 : isCarp ? 28 : 24), isFrog ? 88 : isCarp ? 96 : 72, kind);
      if (isFrog || isTurtle || isCarp) this.screenShake(isFrog ? 3 : isTurtle ? 2 : 2.5, 240);
    }

    spawnObjectiveEffect(tileId, color = "#f2d87a", text = "Objective!") {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "objectiveAura", ...point, color, born: performance.now(), life: this.life(1550) });
      this.spawnRipple(tileId, color, 1.8);
      this.spawnPulse(tileId, color, 1.55);
      this.spawnFloatingText(tileId, text, color);
      this.spawnScreenNotice(text, color);
      this.spawnParticles(point, color, this.count(28), 96, "objective");
      this.screenShake(3, 280);
    }

    screenShake(power = 3, duration = 260) {
      if (!this.settings.screenShake || this.settings.reducedMotion || this.settings.level === "low") return;
      const now = performance.now();
      this.shake = {
        power: Math.max(this.shake.power || 0, power),
        started: now,
        until: Math.max(this.shake.until || 0, now + duration),
      };
    }

    shakeOffset(now = performance.now()) {
      if (!this.settings.screenShake || now >= this.shake.until) return { x: 0, y: 0 };
      const t = Math.max(0, Math.min(1, (now - this.shake.started) / Math.max(1, this.shake.until - this.shake.started)));
      const power = this.shake.power * (1 - t);
      return {
        x: Math.sin(now * 0.07) * power + Math.sin(now * 0.021) * power * 0.45,
        y: Math.cos(now * 0.061) * power,
      };
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
      this.drawAmbient(ctx, now);
      this.drawNotices(ctx, now);
    }

    drawAmbient(ctx, now) {
      if (this.settings.reducedMotion || this.settings.level === "low" || !this.renderer.visibleTiles) return;
      const tiles = this.renderer
        .visibleTiles(0)
        .filter((tile) => tile.type === "reeds" || tile.type === "lily" || tile.objectiveId || tile.campId)
        .slice(0, this.settings.level === "high" ? 90 : 42);
      if (!tiles.length) return;
      const size = this.renderer.baseTile * this.renderer.camera.zoom;
      if (size < 7) return;
      ctx.save();
      tiles.forEach((tile) => {
        const p = this.renderer.tileCenter(tile);
        const seed = tile.id * 17.13;
        const pulse = 0.5 + Math.sin(now * 0.0028 + seed) * 0.5;
        if (tile.type === "lily") {
          ctx.globalAlpha = 0.08 + pulse * 0.08;
          ctx.fillStyle = "#a8ffae";
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(2, size * (0.28 + pulse * 0.08)), 0, Math.PI * 2);
          ctx.fill();
        }
        if (tile.type === "reeds") {
          ctx.globalAlpha = 0.18 + pulse * 0.22;
          ctx.fillStyle = pulse > 0.64 ? "#f2d87a" : "#9ee7f4";
          const ox = Math.sin(now * 0.0016 + seed) * size * 0.24;
          const oy = Math.cos(now * 0.0019 + seed) * size * 0.18;
          ctx.beginPath();
          ctx.arc(p.x + ox, p.y + oy, Math.max(1, size * 0.035), 0, Math.PI * 2);
          ctx.fill();
        }
        if (tile.objectiveId || tile.campId) {
          ctx.globalAlpha = 0.13 + pulse * 0.12;
          ctx.strokeStyle = tile.objectiveId ? "#f2d87a" : "#8ee6a2";
          ctx.lineWidth = Math.max(1, size * 0.025);
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * (0.5 + pulse * 0.22), 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.restore();
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
          ctx.globalAlpha = Math.min(0.38, alpha);
          ctx.lineWidth = Math.max(1, tileSize * 0.028);
          for (let i = 0; i < 4; i += 1) {
            const angle = i * (Math.PI / 2) + t * 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(angle) * tileSize * 0.22, p.y + Math.sin(angle) * tileSize * 0.22);
            ctx.lineTo(p.x + Math.cos(angle) * tileSize * 0.43, p.y + Math.sin(angle) * tileSize * 0.43);
            ctx.stroke();
          }
        } else if (effect.kind === "attackBurst") {
          const r = tileSize * effect.size * (0.18 + t * 0.72);
          ctx.lineWidth = Math.max(2, tileSize * 0.06 * effect.size);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = Math.max(0, alpha * 0.24);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r * 1.35, r * 0.58, Math.sin(t * Math.PI) * 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (effect.kind === "objectiveAura") {
          const r = tileSize * (0.55 + t * 1.4);
          ctx.lineWidth = Math.max(2, tileSize * 0.055);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = Math.max(0, alpha * 0.36);
          for (let i = 0; i < 8; i += 1) {
            const angle = i * (Math.PI / 4) + t * 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(angle) * r * 0.45, p.y + Math.sin(angle) * r * 0.45);
            ctx.lineTo(p.x + Math.cos(angle) * r * 0.95, p.y + Math.sin(angle) * r * 0.95);
            ctx.stroke();
          }
        } else if (effect.kind === "duckSkill" || effect.kind === "snakeSkill" || effect.kind === "frogSkill" || effect.kind === "turtleSkill" || effect.kind === "carpSkill") {
          const radius = tileSize * (0.8 + t * (effect.kind === "frogSkill" ? 2.3 : 1.5));
          ctx.lineWidth = Math.max(2, tileSize * 0.07);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = Math.max(0, alpha * 0.52);
          if (effect.kind === "duckSkill") {
            ctx.lineWidth = Math.max(1, tileSize * 0.035);
            for (let i = -2; i <= 2; i += 1) {
              const y = p.y + i * tileSize * 0.18;
              ctx.beginPath();
              ctx.moveTo(p.x - radius * 0.55 + t * radius * 0.18, y);
              ctx.quadraticCurveTo(p.x, y - tileSize * 0.18, p.x + radius * 0.6, y + tileSize * 0.08);
              ctx.stroke();
            }
          }
          if (effect.kind === "snakeSkill") {
            ctx.setLineDash([tileSize * 0.18, tileSize * 0.16]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius * 0.62, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(p.x - radius * 0.46, p.y);
            ctx.quadraticCurveTo(p.x - radius * 0.12, p.y - radius * 0.22, p.x + radius * 0.22, p.y);
            ctx.quadraticCurveTo(p.x + radius * 0.5, p.y + radius * 0.18, p.x + radius * 0.68, p.y - radius * 0.03);
            ctx.stroke();
          }
          if (effect.kind === "frogSkill") {
            ctx.lineWidth = Math.max(1, tileSize * 0.04);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + tileSize * 0.12, radius * 0.42, radius * 0.16, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p.x, p.y - radius * 0.25, Math.max(3, tileSize * 0.11), Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
          }
          if (effect.kind === "turtleSkill") {
            ctx.lineWidth = Math.max(1, tileSize * 0.04);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, radius * 0.58, radius * 0.38, 0, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = -1; i <= 1; i += 1) {
              ctx.beginPath();
              ctx.moveTo(p.x - radius * 0.36, p.y + i * radius * 0.14);
              ctx.lineTo(p.x + radius * 0.36, p.y + i * radius * 0.14);
              ctx.stroke();
            }
          }
          if (effect.kind === "carpSkill") {
            ctx.lineWidth = Math.max(1, tileSize * 0.035);
            for (let i = -2; i <= 2; i += 1) {
              const y = p.y + i * tileSize * 0.15;
              ctx.beginPath();
              ctx.moveTo(p.x - radius * 0.6, y);
              ctx.bezierCurveTo(p.x - radius * 0.15, y - tileSize * 0.2, p.x + radius * 0.16, y + tileSize * 0.2, p.x + radius * 0.62, y);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      });
    }

    drawArrow(ctx, effect, t, alpha) {
      const from = this.worldToScreen(effect.from.wx, effect.from.wy);
      const to = this.worldToScreen(effect.to.wx, effect.to.wy);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normal = { x: -dy / distance, y: dx / distance };
      const bend = Math.min(34, distance * 0.16);
      const c1 = { x: from.x + dx * 0.35 + normal.x * bend, y: from.y + dy * 0.35 + normal.y * bend };
      const c2 = { x: from.x + dx * 0.68 + normal.x * bend, y: from.y + dy * 0.68 + normal.y * bend };
      const current = this.cubicPoint(from, c1, c2, to, t);
      const ahead = this.cubicPoint(from, c1, c2, to, Math.min(1, t + 0.04));
      const angle = Math.atan2(ahead.y - current.y, ahead.x - current.x);
      ctx.save();
      ctx.globalAlpha = Math.min(0.88, alpha);
      ctx.strokeStyle = this.withAlpha(effect.color, 0.9);
      ctx.fillStyle = effect.color;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, current.x, current.y);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const dotT = Math.max(0, t - i * 0.13);
        const dot = this.cubicPoint(from, c1, c2, to, dotT);
        ctx.globalAlpha = Math.max(0, alpha * (0.58 - i * 0.12));
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 4 - i * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = Math.min(0.94, alpha);
      ctx.beginPath();
      ctx.moveTo(current.x, current.y);
      ctx.lineTo(current.x - Math.cos(angle - 0.55) * 10, current.y - Math.sin(angle - 0.55) * 10);
      ctx.lineTo(current.x - Math.cos(angle + 0.55) * 10, current.y - Math.sin(angle + 0.55) * 10);
      ctx.closePath();
      ctx.fill();
      if (effect.text && this.settings.floatingText) {
        this.drawPillText(ctx, effect.text, current.x, current.y - 16, effect.color);
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
        } else if (particle.style === "mudTunnel" || particle.style === "snakeSkill") {
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x - particle.size * 2.2, p.y + particle.size * 0.5);
          ctx.quadraticCurveTo(p.x, p.y - particle.size, p.x + particle.size * 2.2, p.y + particle.size * 0.2);
          ctx.stroke();
        } else if (particle.style === "reedGuard") {
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + particle.size * 2);
          ctx.lineTo(p.x + particle.size * 0.8, p.y - particle.size * 2.2);
          ctx.stroke();
        } else if (particle.style === "lilyFarm" || particle.style === "frogSkill") {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 2.2, particle.size, 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (particle.style === "jumpPad") {
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, particle.size * 2.1, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        } else if (particle.style === "turtleSkill") {
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 2.4, particle.size * 1.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (particle.style === "carpSkill") {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 2.1, particle.size * 1.05, -0.35, 0, Math.PI * 2);
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

    drawPillText(ctx, text, x, y, color = "#87d7ea") {
      ctx.save();
      ctx.font = "950 12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const width = ctx.measureText(text).width + 16;
      const height = 20;
      ctx.fillStyle = "rgba(4, 13, 20, 0.84)";
      ctx.strokeStyle = this.withAlpha(color, 0.62);
      ctx.lineWidth = 1;
      this.roundRect(ctx, x - width / 2, y - height / 2, width, height, 999);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#edf8fb";
      ctx.fillText(text, x, y + 0.5);
      ctx.restore();
    }

    cubicPoint(a, b, c, d, t) {
      const mt = 1 - t;
      return {
        x: mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
        y: mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
      };
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
