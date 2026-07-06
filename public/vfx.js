(function initPondVFX(root) {
  const BUILDING_META = {
    nest: { label: "Nest Built", color: "#f2d87a", particle: "#fff0b8" },
    lilyFarm: { label: "Lily Farm Built", color: "#77d99e", particle: "#a7e7ad" },
    reedGuard: { label: "Reed Guard Built", color: "#a7c774", particle: "#d7e49b" },
    mudTunnel: { label: "Mud Tunnel Built", color: "#9b7750", particle: "#6d5038" },
    jumpPad: { label: "Jump Pad Built", color: "#7ed6df", particle: "#cdf7ff" },
  };

  const QUALITY = {
    low: { effects: 82, particles: 70, scale: 0.42, ambient: 22 },
    medium: { effects: 150, particles: 165, scale: 0.68, ambient: 52 },
    high: { effects: 240, particles: 340, scale: 1, ambient: 92 },
    ultra: { effects: 360, particles: 540, scale: 1.35, ambient: 140 },
  };

  const ATTACK_STYLE = [
    { min: 90, label: "Max Wave", notice: "Max Wave!", scale: 1.75, color: "#f2d87a" },
    { min: 65, label: "Full Wave", notice: "Full Wave!", scale: 1.42, color: "#edf8fb" },
    { min: 36, label: "Strong Push", notice: "Strong Push", scale: 1.18, color: "#edf8fb" },
    { min: 0, label: "Quick Bite", notice: "Quick Bite", scale: 0.86, color: "#edf8fb" },
  ];

  const EVENT_STYLE = {
    mud: { color: "#c39a62", particles: "eventMud", shake: 4.2 },
    flood: { color: "#8bdfff", particles: "eventFoam", shake: 3.2 },
    lily: { color: "#86d68d", particles: "eventBloom", shake: 1.4 },
    reed: { color: "#8ddf96", particles: "eventReed", shake: 1.8 },
    storm: { color: "#83dced", particles: "eventRain", shake: 2.1 },
    current: { color: "#4fd4cf", particles: "eventFoam", shake: 2.2 },
    rock: { color: "#b8a69a", particles: "eventRock", shake: 3.8 },
    fog: { color: "#b3c6cc", particles: "eventMist", shake: 0.8 },
    migration: { color: "#d8ad48", particles: "eventBloom", shake: 1.6 },
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
        particles: "high",
        abilityEffects: true,
        mapDecorations: true,
        visualQuality: "high",
        isMobile: false,
      };
      this.maxEffects = 180;
      this.maxParticles = 260;
    }

    configure(settings = {}) {
      const level = QUALITY[settings.level] ? settings.level : this.settings.level;
      const particles = QUALITY[settings.particles] ? settings.particles : this.settings.particles || level;
      this.settings = { ...this.settings, ...settings, level, particles };
      const effectQuality = QUALITY[this.settings.level] || QUALITY.high;
      const particleQuality = QUALITY[this.settings.particles] || effectQuality;
      const mobileScale = this.settings.isMobile ? 0.58 : 1;
      const motionScale = this.settings.reducedMotion ? 0.35 : 1;
      this.maxEffects = Math.round(effectQuality.effects * mobileScale * motionScale);
      this.maxParticles = Math.round(particleQuality.particles * mobileScale * motionScale);
    }

    addEvents(events, state) {
      if (!events.length) return;
      events.forEach((event) => this.handleEvent(event, state));
      this.trim();
    }

    handleEvent(event, state) {
      const player = state?.players?.find((candidate) => candidate.id === event.playerId);
      const visual = root.PondAnimalVisuals?.animals?.[player?.animal];
      const color = visual?.badge || player?.color || "#d8ad48";

      if (event.kind === "expand") {
        this.spawnCaptureBurst(event.to, color, event.amount > 1 ? `+${event.amount} Tiles` : "Expanded");
      } else if (event.kind === "expansionWaveStart") {
        this.spawnPulse(event.to, color, 1);
        this.spawnRipple(event.to, color, 0.86);
        this.spawnAttackArrow(event.from, event.to, color, `${event.amount || ""}`.trim());
        this.spawnFloatingText(event.to, event.merged ? "Expansion +Energy" : "Expansion Wave", color);
      } else if (event.kind === "expansionWaveCapture") {
        this.spawnCaptureBurst(event.to, color, "Expanded");
        this.spawnRipple(event.to, color, 0.68);
        this.spawnAttackArrow(event.from, event.to, color, "");
      } else if (event.kind === "expansionWaveEnd") {
        this.spawnPulse(event.to, color, 0.72);
        this.spawnFloatingText(event.to, event.captured > 0 ? `Expanded +${event.captured}` : "Wave Spent", color);
      } else if (event.kind === "expandProgress") {
        this.spawnPulse(event.to, color, 0.82);
        this.spawnRipple(event.to, color, 0.72);
        const point = this.tileWorldPoint(event.to);
        if (point) this.effects.push({ kind: "progressRing", ...point, color, progress: event.progress || 0, cost: event.cost || 1, born: performance.now(), life: this.life(880) });
        this.spawnFloatingText(event.to, `${event.progress}/${event.cost}`, "#edf8fb");
      } else if (event.kind === "attackWave") {
        this.spawnAttackPowerEffect(event.from, event.to, color, event.amount || 0, event.abilityModifier);
        this.spawnWaveTrail(event.from, event.to, color, event.amount || 0);
        this.spawnBorderPulse([event.from, event.to].filter((id) => id != null), color);
        this.spawnFloatingText(event.to, `${this.attackStyle(event.amount || 0).label} ${event.amount || ""}`.trim(), color);
        this.spawnScreenNotice(event.merged ? "Wave Reinforced" : "Wave Committed", color);
      } else if (event.kind === "waveCapture") {
        this.spawnCaptureBurst(event.to, color, "Captured");
        this.spawnAttackArrow(event.from, event.to, color, "");
      } else if (event.kind === "waveResist") {
        this.spawnWeakenEffect(event.to, event.progress, event.cost);
        this.spawnWaveTrail(event.from, event.to, color, event.amount || 0);
        this.spawnFloatingText(event.to, event.progress ? `Weakened ${event.progress}/${event.cost}` : "Weakened", "#f2d87a");
        this.spawnScreenNotice("Border Weakened", "#f2d87a");
      } else if (event.kind === "borderWeakened") {
        this.spawnWeakenEffect(event.to, event.progress, event.cost);
        this.spawnAttackArrow(event.from, event.to, color, `-${event.amount || 0}`);
        this.spawnFloatingText(event.to, `${event.progress}/${event.cost}`, "#f2d87a");
      } else if (event.kind === "waveContested") {
        this.spawnPulse(event.to, "#f2d87a", 1.2);
        this.spawnRipple(event.to, "#f2d87a", 0.84);
        this.spawnFloatingText(event.to, "Contested", "#f2d87a");
        this.spawnScreenNotice("Border Contested", "#f2d87a");
      } else if (event.kind === "supportSent") {
        const target = state?.players?.find((candidate) => candidate.id === event.targetId);
        this.spawnAttackArrow(player?.coreTileId, target?.coreTileId, "#87d7ea", `+${event.received || event.amount || 0}`);
        this.spawnWaveTrail(player?.coreTileId, target?.coreTileId, "#87d7ea", event.received || event.amount || 20, "support");
        this.spawnPulse(target?.coreTileId, "#87d7ea", 1.25);
        this.spawnScreenNotice("Support Sent", "#87d7ea");
      } else if (event.kind === "continuousAttackStart") {
        this.spawnAttackArrow(event.from, event.to, color, "Wave");
        this.spawnScreenNotice("Wave Committed", color);
      } else if (event.kind === "continuousAttackStop") {
        this.spawnBlockedEffect(event.to, "Wave Spent");
      } else if (event.kind === "continuousAttackPulse") {
        this.spawnPulse(event.to, color, 0.86);
      } else if (event.kind === "waterRouteAttack") {
        this.spawnAttackStream(event.routeTiles || [event.from, event.to], "#87d7ea", `${event.travelTime || ""}s`.trim() || "Current");
        (event.routeTiles || []).slice(0, this.settings.level === "ultra" ? 34 : 22).forEach((tileId) => this.spawnRipple(tileId, "#87d7ea", 0.54));
        this.spawnScreenNotice("Current Push Launched", "#87d7ea");
      } else if (event.kind === "currentPushWarning") {
        this.spawnAttackStream((event.routeTiles || []).slice(-24), "#fff1a8", `Impact ${Math.ceil(event.impactIn || 0)}s`);
        (event.routeTiles || []).slice(-18).forEach((tileId) => this.spawnRipple(tileId, "#fff1a8", 0.5));
        const point = this.tileWorldPoint(event.to);
        if (point) this.effects.push({ kind: "countdown", ...point, color: "#fff1a8", text: `${Math.ceil(event.impactIn || 0)}s`, born: performance.now(), life: this.life(1250) });
        this.spawnPulse(event.to, "#fff1a8", 1.45);
        this.spawnFloatingText(event.to, "Incoming Current Push", "#fff1a8");
      } else if (event.kind === "currentPushImpact") {
        this.spawnShockwave(event.to, event.captured > 0 ? color : "#edf8fb", event.captured > 0 ? 2 : 1.32);
        if (event.captured > 0) this.spawnCaptureBurst(event.to, color, `Current +${event.captured}`);
        else this.spawnBlockedShield(event.to, "Current Blocked");
        this.spawnScreenNotice(event.captured > 0 ? `Current Push: ${event.captured} tiles` : "Current Push Blocked", event.captured > 0 ? color : "#edf8fb");
      } else if (event.kind === "currentPushBlocked") {
        this.spawnBlockedShield(event.to, "Current Blocked");
      } else if (event.kind === "specialLaunch") {
        this.spawnSpecialLaunch(event);
      } else if (event.kind === "specialDefense") {
        this.spawnSpecialDefense(event);
      } else if (event.kind === "specialImpact") {
        this.spawnSpecialImpact(event, color);
      } else if (event.kind === "coreUnderAttack") {
        this.spawnBlockedEffect(event.to, "Core Hit");
        this.spawnScreenNotice("Core Nest Under Attack", "#e9857c");
      } else if (event.kind === "lastStand") {
        this.spawnDefendEffect([event.to].filter((id) => id != null), player?.animal);
        this.spawnPulse(event.to, "#f2d87a", 1.5);
        this.spawnFloatingText(event.to, "Last Stand!", "#f2d87a");
        this.spawnScreenNotice(event.message || "Last Stand", "#f2d87a");
      } else if (event.kind === "coreCaptured") {
        this.spawnObjectiveEffect(event.to, color, "Core Captured!");
      } else if (event.kind === "surrender") {
        this.spawnScreenNotice(event.message || "Player Surrendered", "#f2d87a");
      } else if (event.kind === "eliminated") {
        this.spawnEliminationEffect(event.playerId, state);
        this.spawnScreenNotice(event.message || "Eliminated", event.playerId === state?.humanId ? "#e9857c" : "#f2d87a");
      } else if (event.kind === "defend") {
        this.spawnDefendEffect([event.to], player?.animal);
      } else if (event.kind === "ability") {
        this.spawnAbilityEffect(event.playerId, event.skillType || player?.animal || event.ability, event.ability, player?.name);
        if ((event.skillType || player?.animal) === "turtle" && event.affectedTiles?.length) this.spawnDefendEffect(event.affectedTiles, "turtle");
        if ((event.skillType || player?.animal) === "carp" && event.affectedTiles?.length) {
          event.affectedTiles.slice(0, 20).forEach((tileId) => this.spawnRipple(tileId, "#f0cc74", 0.9));
        }
        if (player?.isBot) this.spawnScreenNotice(`${player.name}: ${event.ability}`, color);
      } else if (event.kind === "abilityUsed") {
        this.spawnPulse(event.to, color, 1.35);
        this.spawnAttackArrow(event.from, event.to, color, "Ambush Used");
        this.spawnWaveTrail(event.from, event.to, "#5fbf83", 48, "ambush");
        this.spawnFloatingText(event.to, "Ambush Used", color);
      } else if (event.kind === "buildStarted") {
        this.spawnConstructionEffect(event.to, event.buildingType, event.finishesAt, event.at);
      } else if (event.kind === "buildUpgradeStarted") {
        this.spawnConstructionEffect(event.to, event.buildingType, event.finishesAt, event.at, event.level);
      } else if (event.kind === "buildComplete") {
        this.spawnBuildEffect(event.to, event.buildingType);
      } else if (event.kind === "buildUpgrade") {
        this.spawnUpgradeEffect(event.to, event.level || 2, event.buildingType);
      } else if (event.kind === "buildRemove") {
        this.spawnBlockedEffect(event.to, "Removed");
      } else if (event.kind === "lakeEventWarning") {
        this.playEventWarning(event.eventType, event.area, event);
      } else if (event.kind === "lakeEventStarted") {
        this.playEventStart(event.eventType, event.area, event);
      } else if (event.kind === "lakeEventEnded") {
        this.playEventEnd(event.eventType, event.area, event);
      } else if (event.kind === "objectiveAppeared") {
        this.spawnObjectiveEffect(event.to, "#f2d87a", event.message || "Objective!");
      } else if (event.kind === "objectiveCaptured") {
        this.spawnObjectiveEffect(event.to, color, "Objective Captured!");
      } else if (event.kind === "campCaptured") {
        this.spawnObjectiveEffect(event.to, color, "Camp Captured!");
      } else if (event.kind === "waveEnd" && (event.captured || 0) === 0) {
        const weakened = String(event.message || "").toLowerCase().includes("weakened");
        this.spawnBlockedShield(event.to, weakened ? "Weakened" : "Stalled");
        this.spawnScreenNotice(weakened ? "Border Weakened" : String(event.message || "").toLowerCase().includes("spent") ? "Wave Spent" : "Enemy Blocked!", weakened ? "#f2d87a" : "#edf8fb");
      } else if (event.kind === "waveEnd" && (event.captured || 0) > 0) {
        this.spawnScreenNotice(`Captured ${event.captured} tiles`, color);
      } else if (event.kind === "ended") {
        this.spawnVictoryEffect(event.winnerId, state);
        this.spawnScreenNotice(event.message || "Match Over", event.winnerId === state?.humanId ? "#f2d87a" : "#e9857c");
      } else if (event.kind === "ping") {
        const label = root.PondInfo?.PING_LABELS?.[event.pingType] || "Ping";
        this.spawnPulse(event.to, color, 1.25);
        this.spawnFloatingText(event.to, label, color);
      } else if (event.kind === "diplomacy") {
        const label = ["alliance", "allianceAccepted"].includes(event.subtype)
          ? "Alliance Formed"
          : event.subtype === "broken"
            ? "Alliance Broken"
            : event.subtype === "enemy" || event.subtype === "war"
              ? "Enemy Marked"
              : "Diplomacy Updated";
        const target = state?.players?.find((candidate) => candidate.id === event.targetId);
        if (player?.coreTileId != null && target?.coreTileId != null) this.spawnWaveTrail(player.coreTileId, target.coreTileId, event.subtype === "broken" ? "#d96b61" : "#87d7ea", 36, "diplomacy");
        this.spawnScreenNotice(label, event.subtype === "broken" ? "#d96b61" : "#87d7ea");
      }
    }

    spawnAttackPowerEffect(fromTile, toTile, color = "#d8ad48", amount = 0, modifier = "") {
      const style = this.attackStyle(amount);
      const label = amount >= 22 ? style.notice : "";
      const size = style.scale;
      if (this.settings.attackArrows) this.spawnAttackArrow(fromTile, toTile, color, modifier || (amount ? `-${amount}` : ""));
      this.spawnPulse(toTile, color, 1.1 * size);
      this.spawnRipple(toTile, color, 0.92 * size);
      if (amount >= 65) this.spawnShockwave(toTile, color, amount >= 90 ? 1.82 : 1.36);
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

    spawnWaveTrail(fromTile, toTile, color = "#d8ad48", amount = 30, mode = "attack") {
      const from = this.tileWorldPoint(fromTile);
      const to = this.tileWorldPoint(toTile);
      if (!from || !to) return;
      const style = this.attackStyle(amount);
      this.effects.push({
        kind: "stream",
        from,
        to,
        color,
        mode,
        size: mode === "support" ? 0.9 : style.scale,
        born: performance.now(),
        life: this.life(mode === "support" ? 1050 : 980),
      });
    }

    spawnCaptureBurst(tileId, color = "#d8ad48", text = "Captured") {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.spawnCaptureEffect(tileId, color, text);
      this.effects.push({ kind: "shockwave", ...point, color, size: 1.05, born: performance.now(), life: this.life(720) });
      this.effects.push({ kind: "bubble", ...point, color: "#dffaff", size: 1, born: performance.now(), life: this.life(900) });
      this.spawnParticles(point, color, this.count(8), 58, "bubble");
    }

    spawnBorderPulse(tileIds = [], color = "#f2d87a") {
      tileIds.slice(0, this.settings.isMobile ? 14 : 34).forEach((tileId) => {
        const point = this.tileWorldPoint(tileId);
        if (!point) return;
        this.effects.push({ kind: "borderPulse", ...point, color, born: performance.now(), life: this.life(820) });
      });
    }

    spawnAttackStream(pathTiles = [], color = "#87d7ea", text = "") {
      const ids = pathTiles.filter((id) => id != null);
      if (ids.length < 2) return;
      const points = ids.map((id) => this.tileWorldPoint(id)).filter(Boolean);
      if (points.length < 2) return;
      this.effects.push({ kind: "routeStream", points, color, text, born: performance.now(), life: this.life(1500) });
      const step = Math.max(1, Math.floor(points.length / (this.settings.level === "ultra" ? 12 : 8)));
      ids.filter((_, index) => index % step === 0).slice(0, this.settings.isMobile ? 8 : 16).forEach((tileId) => this.spawnPulse(tileId, color, 0.55));
    }

    spawnBlockedShield(tileId, text = "Blocked") {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.spawnBlockedEffect(tileId, text);
      this.effects.push({ kind: "shockwave", ...point, color: "#edf8fb", size: 0.9, born: performance.now(), life: this.life(640) });
      this.spawnParticles(point, "#edf8fb", this.count(10), 42, "shield");
    }

    spawnWeakenEffect(tileId, progress = 0, cost = 1) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "weaken", ...point, color: "#f2d87a", progress, cost, born: performance.now(), life: this.life(980) });
      this.spawnPulse(tileId, "#f2d87a", 0.96);
      this.spawnRipple(tileId, "#f2d87a", 0.74);
      this.spawnParticles(point, "#f2d87a", this.count(8), 34, "pressure");
    }

    spawnRipple(tileId, color = "#9ee7f4", size = 1) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      if (!this.canSpawnAt(point, 90)) return;
      this.effects.push({ kind: "ripple", ...point, color, size, born: performance.now(), life: this.life(760) });
      this.trim();
    }

    spawnPulse(tileId, color = "#f2d87a", size = 1) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      if (!this.canSpawnAt(point, 90)) return;
      this.effects.push({ kind: "pulse", ...point, color, size, born: performance.now(), life: this.life(680) });
      this.trim();
    }

    spawnFloatingText(target, text, color = "#edf8fb") {
      if (!this.settings.floatingText || !text) return;
      const point = typeof target === "number" ? this.tileWorldPoint(target) : target;
      if (!point) return;
      if (!this.canSpawnAt(point, 120)) return;
      const maxText = this.settings.isMobile ? 12 : this.settings.level === "low" ? 14 : 24;
      const textCount = this.effects.reduce((sum, effect) => sum + (effect.kind === "text" ? 1 : 0), 0);
      if (textCount >= maxText) return;
      this.effects.push({ kind: "text", ...point, text, color, born: performance.now(), life: this.life(1050) });
      this.trim();
    }

    spawnPendingAction(tileId, type = "expand", color = "#77d99e", text = "Sending") {
      const point = this.tileWorldPoint(tileId);
      if (!point || !this.canSpawnAt(point, 110)) return;
      const size = type === "attack" ? 1.05 : type === "defend" ? 0.92 : 0.82;
      this.spawnRipple(tileId, color, size);
      this.spawnPulse(tileId, color, size * 0.92);
      if (this.settings.level !== "low") this.spawnFloatingText(tileId, text, color);
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

    spawnConstructionEffect(tileId, buildingType, finishesAt = 0, startedAt = 0, level = 0) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      const meta = BUILDING_META[buildingType] || { label: "Building", color: "#f2d87a", particle: "#edf8fb" };
      const duration = Math.max(1.2, Number(finishesAt || 0) - Number(startedAt || 0));
      this.effects.push({
        kind: "construction",
        ...point,
        color: meta.color,
        buildingType,
        level,
        duration,
        born: performance.now(),
        life: this.life(Math.min(2400, Math.max(1100, duration * 1000))),
      });
      this.spawnRipple(tileId, meta.color, 0.86);
      this.spawnFloatingText(tileId, level ? `Upgrade L${level}` : "Building", meta.color);
      this.spawnParticles(point, meta.particle, this.count(10), 44, buildingType);
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

    spawnUpgradeEffect(tileId, level = 2, buildingType = "") {
      this.spawnBuildEffect(tileId, buildingType, true);
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "upgrade", ...point, color: "#f2d87a", level, born: performance.now(), life: this.life(1250) });
      this.spawnFloatingText(tileId, `Level ${level}!`, "#f2d87a");
    }

    spawnDefendEffect(tileIds = [], animal = "") {
      tileIds.slice(0, 24).forEach((tileId) => {
        const point = this.tileWorldPoint(tileId);
        if (!point) return;
        this.effects.push({ kind: "shield", ...point, color: animal === "turtle" ? "#70d5c9" : "#87d7ea", animal, born: performance.now(), life: this.life(900) });
        if (animal === "turtle") this.effects.push({ kind: "shell", ...point, color: "#70d5c9", born: performance.now(), life: this.life(960) });
      });
      if (tileIds[0] != null) this.spawnFloatingText(tileIds[0], "Border Reinforced", "#aee7f4");
    }

    spawnSpecialLaunch(event) {
      const point = this.tileWorldPoint(event.to);
      if (!point) return;
      const color = "#f2d87a";
      this.effects.push({ kind: "objectiveAura", ...point, color, born: performance.now(), life: this.life(1600) });
      this.spawnPulse(event.to, color, 1.7);
      this.spawnRipple(event.to, color, 1.4);
      this.spawnFloatingText(event.to, "Lily Barrage!", color);
      this.spawnScreenNotice("Lily Barrage Incoming", color);
      this.spawnParticles(point, color, this.count(this.settings.isMobile ? 12 : 22), 86, "lilyBarrage");
    }

    spawnSpecialDefense(event) {
      const type = event.specialType;
      const color = type === "reedShield" ? "#8ddf96" : "#87d7ea";
      const text = type === "reedShield" ? "Reed Shield!" : "Dragonfly Guard!";
      const point = this.tileWorldPoint(event.to);
      if (!point) return;
      this.effects.push({ kind: "shield", ...point, color, born: performance.now(), life: this.life(1150) });
      this.spawnPulse(event.to, color, type === "reedShield" ? 1.25 : 1.48);
      this.spawnRipple(event.to, color, type === "reedShield" ? 1.1 : 1.55);
      this.spawnFloatingText(event.to, text, color);
      this.spawnScreenNotice(text, color);
      this.spawnParticles(point, color, this.count(this.settings.isMobile ? 8 : 16), type === "reedShield" ? 56 : 74, type);
    }

    spawnSpecialImpact(event, attackerColor = "#f2d87a") {
      const point = this.tileWorldPoint(event.to);
      if (!point) return;
      const color = event.captured > 0 ? attackerColor : "#f2d87a";
      this.spawnShockwave(event.to, color, event.captured > 0 ? 1.9 : 1.35);
      this.spawnRipple(event.to, color, 1.75);
      this.spawnFloatingText(event.to, event.captured > 0 ? `Barrage +${event.captured}` : event.reduced > 0 ? "Guarded!" : "Weakened", color);
      (event.capturedTiles || []).slice(0, 8).forEach((tileId) => this.spawnCaptureBurst(tileId, attackerColor, "Captured"));
      (event.weakenedTiles || []).slice(0, 10).forEach((tileId) => this.spawnWeakenEffect(tileId, 1, 2));
      this.spawnScreenNotice(event.captured > 0 ? `Lily Barrage captured ${event.captured}` : event.reduced > 0 ? "Lily Barrage Guarded" : "Lily Barrage Weakened", color);
      this.spawnParticles(point, color, this.count(this.settings.isMobile ? 14 : 28), 96, "lilyImpact");
      this.screenShake(event.captured > 0 ? 3.4 : 2, 260);
    }

    playEventWarning(eventType, area = {}, event = {}) {
      const definition = this.eventDefinition(eventType);
      const visual = event.visual || definition.visual || eventType;
      const style = this.eventStyle(visual, event.color || definition.color);
      const tiles = this.eventTiles(area, definition, this.settings.isMobile ? 10 : 18);
      const focus = this.eventFocus(area, tiles);
      tiles.forEach((tileId) => {
        this.spawnPulse(tileId, style.color, 0.92);
        if (visual === "mud" || visual === "rock") this.spawnRipple(tileId, style.color, 0.62);
      });
      if (focus) {
        this.effects.push({
          kind: "eventField",
          ...focus,
          visual,
          phase: "warning",
          color: style.color,
          radius: Math.max(2.2, area?.radius || 4),
          born: performance.now(),
          life: this.life(1500),
        });
        this.effects.push({
          kind: "countdown",
          ...focus,
          color: style.color,
          text: `${Math.max(1, Math.ceil(event.startsIn || definition.warningLead || 8))}s`,
          born: performance.now(),
          life: this.life(1450),
        });
        this.spawnFloatingText(focus, definition.warningText || `${definition.label || "Event"} Incoming`, style.color);
        this.spawnParticles(focus, style.color, this.count(this.settings.isMobile ? 6 : 12), visual === "rock" ? 62 : 42, style.particles);
      }
      this.spawnScreenNotice(definition.warningText || event.message || "Lake Event Incoming", style.color);
    }

    playEventStart(eventType, area = {}, event = {}) {
      const definition = this.eventDefinition(eventType);
      const visual = event.visual || definition.visual || eventType;
      const style = this.eventStyle(visual, event.color || definition.color);
      const tiles = this.eventTiles(area, definition, this.settings.isMobile ? 14 : 28);
      const focus = this.eventFocus(area, tiles);
      tiles.forEach((tileId, index) => {
        if (index % (this.settings.isMobile ? 2 : 1) !== 0) return;
        this.spawnPulse(tileId, style.color, visual === "flood" || visual === "current" ? 0.8 : 0.66);
        if (visual === "flood" || visual === "current" || visual === "storm") this.spawnRipple(tileId, style.color, 0.82);
      });
      if (focus) {
        this.effects.push({
          kind: "eventField",
          ...focus,
          visual,
          phase: "start",
          color: style.color,
          direction: area?.direction || null,
          radius: Math.max(2.8, area?.radius || 5),
          born: performance.now(),
          life: this.life(1900),
        });
        this.spawnParticles(focus, style.color, this.count(this.settings.isMobile ? 14 : 28), this.eventParticleSpread(visual), style.particles);
      }
      const routeTiles = this.eventRouteTiles(tiles, area, this.settings.isMobile ? 14 : 26);
      if ((visual === "flood" || visual === "current") && routeTiles.length > 2) {
        this.spawnAttackStream(routeTiles, style.color, area?.direction ? area.direction.toUpperCase() : definition.label || "Current");
      }
      if (visual === "mud" || visual === "flood" || visual === "rock") this.screenShake(style.shake, visual === "mud" ? 520 : 360);
      this.spawnScreenNotice(definition.startText || event.message || definition.label || "Lake Event", style.color);
    }

    playEventLoop(eventType, area = {}) {
      const definition = this.eventDefinition(eventType);
      const visual = definition.visual || eventType;
      const style = this.eventStyle(visual, definition.color);
      this.eventTiles(area, definition, this.settings.isMobile ? 4 : 8).forEach((tileId) => this.spawnPulse(tileId, style.color, 0.48));
    }

    playEventEnd(eventType, area = {}, event = {}) {
      const definition = this.eventDefinition(eventType);
      const visual = event.visual || definition.visual || eventType;
      const style = this.eventStyle(visual, event.color || definition.color);
      const tiles = this.eventTiles(area, definition, this.settings.isMobile ? 8 : 16);
      const focus = this.eventFocus(area, tiles);
      if (focus) {
        this.effects.push({
          kind: "eventField",
          ...focus,
          visual,
          phase: "end",
          color: style.color,
          radius: Math.max(2, area?.radius || 4),
          born: performance.now(),
          life: this.life(1750),
        });
        if (visual === "mud") {
          this.effects.push({
            kind: "eventStain",
            ...focus,
            color: style.color,
            radius: Math.max(2.4, area?.radius || 5),
            born: performance.now(),
            life: this.life(3600),
          });
        }
        this.spawnParticles(focus, style.color, this.count(this.settings.isMobile ? 5 : 11), 34, style.particles);
      }
      tiles.slice(0, this.settings.isMobile ? 6 : 12).forEach((tileId) => this.spawnRipple(tileId, style.color, 0.52));
      this.spawnScreenNotice(definition.endText || event.message || `${definition.label || "Event"} Ended`, style.color);
    }

    clearEventEffects(eventId) {
      if (!eventId) return;
      this.effects = this.effects.filter((effect) => effect.eventId !== eventId);
      this.particles = this.particles.filter((particle) => particle.eventId !== eventId);
    }

    eventDefinition(eventType) {
      return root.PondLakeEvents?.[eventType] || { label: "Lake Event", color: "#83dced", visual: eventType, tileTypes: ["water"] };
    }

    eventStyle(visual, fallbackColor = "#83dced") {
      const style = EVENT_STYLE[visual] || EVENT_STYLE.migration;
      return { ...style, color: fallbackColor || style.color };
    }

    eventTiles(area = {}, definition = {}, limit = 18) {
      const ids = Array.isArray(area?.tileIds) ? area.tileIds.filter((id) => id != null) : [];
      if (ids.length) return ids.slice(0, limit);
      const preferred = new Set(definition.tileTypes || ["water"]);
      return [...(this.renderer.tileMap?.values() || [])]
        .filter((tile) => preferred.has(tile.type))
        .slice(0, limit)
        .map((tile) => tile.id);
    }

    eventFocus(area = {}, tileIds = []) {
      const focusId = area?.focusTile ?? tileIds[0];
      return this.tileWorldPoint(focusId) || this.regionCenter(tileIds.map((id) => this.renderer.tileMap?.get(id)).filter(Boolean));
    }

    eventRouteTiles(tileIds = [], area = {}, limit = 22) {
      if (!tileIds.length) return [];
      const tiles = tileIds.map((id) => this.renderer.tileMap?.get(id)).filter(Boolean);
      const direction = area?.direction || "east";
      tiles.sort((a, b) => {
        if (direction === "west") return b.x - a.x || a.y - b.y;
        if (direction === "north") return a.y - b.y || a.x - b.x;
        if (direction === "south") return b.y - a.y || a.x - b.x;
        return a.x - b.x || a.y - b.y;
      });
      return tiles.slice(0, limit).map((tile) => tile.id);
    }

    eventParticleSpread(visual) {
      if (visual === "flood") return 118;
      if (visual === "rock") return 82;
      if (visual === "mud") return 92;
      if (visual === "storm") return 74;
      if (visual === "fog") return 58;
      return 68;
    }

    spawnAbilityEffect(playerId, skillType, abilityName = "", playerName = "") {
      if (!this.settings.abilityEffects) {
        this.spawnScreenNotice(abilityName || "Ability Used", "#f2d87a");
        return;
      }
      this.spawnSkillEffect(playerId, skillType, abilityName, playerName);
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
      this.effects.push({ kind: "shockwave", ...center, color, size: isFrog ? 1.4 : isTurtle ? 1.25 : 1.05, born: performance.now(), life: this.life(980) });
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

    spawnEliminationEffect(playerId, state) {
      const player = state?.players?.find((candidate) => candidate.id === playerId);
      const tiles = this.ownedTiles(playerId);
      const center = this.regionCenter(tiles) || this.tileWorldPoint(player?.coreTileId);
      if (!center) return;
      this.effects.push({ kind: "elimination", ...center, color: player?.color || "#e9857c", born: performance.now(), life: this.life(1500) });
      this.spawnParticles(center, player?.color || "#e9857c", this.count(28), 88, "elimination");
      this.screenShake(4, 320);
    }

    spawnVictoryEffect(winnerId, state) {
      const winner = state?.players?.find((candidate) => candidate.id === winnerId);
      const center = this.tileWorldPoint(winner?.coreTileId) || this.regionCenter(this.ownedTiles(winnerId));
      if (!center) return;
      const color = winner?.color || "#f2d87a";
      this.effects.push({ kind: "victory", ...center, color, born: performance.now(), life: this.life(2200) });
      this.spawnParticles(center, color, this.count(46), 130, "victory");
      this.screenShake(5, 480);
    }

    spawnShockwave(tileId, color = "#edf8fb", size = 1) {
      const point = this.tileWorldPoint(tileId);
      if (!point) return;
      this.effects.push({ kind: "shockwave", ...point, color, size, born: performance.now(), life: this.life(780) });
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
      if (this.particles.length > this.maxParticles) this.particles.splice(0, this.particles.length - this.maxParticles);
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
      if (this.settings.reducedMotion || this.settings.level === "low" || this.settings.mapDecorations === false || !this.renderer.visibleTiles) return;
      const quality = QUALITY[this.settings.level] || QUALITY.high;
      const tiles = this.renderer
        .visibleTiles(0)
        .filter((tile) => tile.type === "reeds" || tile.type === "lily" || tile.objectiveId || tile.campId)
        .slice(0, this.settings.isMobile ? Math.min(quality.ambient, 52) : quality.ambient);
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
        if (effect.kind === "stream") {
          this.drawStream(ctx, effect, t, alpha);
          return;
        }
        if (effect.kind === "routeStream") {
          this.drawRouteStream(ctx, effect, t, alpha);
          return;
        }
        if (effect.kind === "text") {
          const p = this.worldToScreen(effect.wx, effect.wy);
          if (this.offscreen(p, 80)) return;
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
        if (this.offscreen(p, tileSize * 5)) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.fillStyle = this.withAlpha(effect.color, Math.max(0, 0.18 * alpha));

        if (effect.kind === "progressRing") {
          const fill = Math.max(0, Math.min(1, Number(effect.progress || 0) / Math.max(1, Number(effect.cost || 1))));
          ctx.lineWidth = Math.max(2, tileSize * 0.06);
          ctx.globalAlpha = Math.min(0.9, alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.28 + Math.sin(t * Math.PI) * 0.12), 0, Math.PI * 2);
          ctx.fill();
        } else if (effect.kind === "countdown") {
          ctx.lineWidth = Math.max(2, tileSize * 0.075);
          ctx.globalAlpha = alpha * 0.92;
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.45 + Math.sin(t * Math.PI) * 0.12), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t));
          ctx.stroke();
          if (this.settings.floatingText) this.drawPillText(ctx, effect.text || "Soon", p.x, p.y - tileSize * 0.62, effect.color);
        } else if (effect.kind === "capture") {
          const r = tileSize * (0.18 + t * 0.52);
          ctx.lineWidth = Math.max(1, tileSize * 0.055);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (effect.kind === "shockwave") {
          const r = tileSize * (effect.size || 1) * (0.26 + t * 1.18);
          ctx.lineWidth = Math.max(2, tileSize * 0.08 * (1 - t * 0.45));
          ctx.globalAlpha = alpha * 0.72;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.14;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.78, 0, Math.PI * 2);
          ctx.fill();
        } else if (effect.kind === "eventField") {
          const r = tileSize * (effect.radius || 4) * (0.42 + t * (effect.phase === "warning" ? 0.22 : 0.42));
          const pulse = 0.5 + Math.sin(now * 0.008) * 0.5;
          ctx.lineWidth = Math.max(2, tileSize * 0.07);
          ctx.globalAlpha = alpha * (effect.phase === "warning" ? 0.84 : 0.62);
          if (effect.phase === "warning") ctx.setLineDash([Math.max(5, tileSize * 0.22), Math.max(4, tileSize * 0.16)]);
          ctx.lineDashOffset = -now * 0.03;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r * 1.22, r * 0.76, 0.08, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = alpha * (0.12 + pulse * 0.08);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r, r * 0.58, 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.58;
          if (effect.visual === "mud") {
            for (let i = -2; i <= 2; i += 1) {
              ctx.beginPath();
              ctx.moveTo(p.x - r * 0.7, p.y + i * tileSize * 0.18);
              ctx.quadraticCurveTo(p.x - r * 0.1, p.y + i * tileSize * 0.18 + Math.sin(t * 8 + i) * tileSize * 0.28, p.x + r * 0.72, p.y + i * tileSize * 0.12);
              ctx.stroke();
            }
          } else if (effect.visual === "flood" || effect.visual === "current") {
            ctx.lineWidth = Math.max(1.4, tileSize * 0.045);
            const angle = effect.direction === "north" ? -Math.PI / 2 : effect.direction === "south" ? Math.PI / 2 : effect.direction === "west" ? Math.PI : 0;
            for (let i = -2; i <= 2; i += 1) {
              const offset = i * tileSize * 0.28;
              const sx = p.x - Math.cos(angle) * r * 0.66 - Math.sin(angle) * offset;
              const sy = p.y - Math.sin(angle) * r * 0.66 + Math.cos(angle) * offset;
              const ex = p.x + Math.cos(angle) * r * 0.66 - Math.sin(angle) * offset;
              const ey = p.y + Math.sin(angle) * r * 0.66 + Math.cos(angle) * offset;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ex, ey);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(ex, ey, Math.max(2, tileSize * 0.06), 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (effect.visual === "lily") {
            for (let i = 0; i < 8; i += 1) {
              const angle = i * (Math.PI / 4) + t * 0.8;
              ctx.beginPath();
              ctx.ellipse(p.x + Math.cos(angle) * r * 0.38, p.y + Math.sin(angle) * r * 0.25, tileSize * 0.22, tileSize * 0.08, angle, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (effect.visual === "reed") {
            for (let i = -3; i <= 3; i += 1) {
              const x = p.x + i * tileSize * 0.22;
              ctx.beginPath();
              ctx.moveTo(x, p.y + r * 0.35);
              ctx.quadraticCurveTo(x + Math.sin(now * 0.006 + i) * tileSize * 0.22, p.y, x + tileSize * 0.12, p.y - r * 0.36);
              ctx.stroke();
            }
          } else if (effect.visual === "rock") {
            for (let i = 0; i < 7; i += 1) {
              const angle = i * 0.9 + t;
              ctx.strokeRect(p.x + Math.cos(angle) * r * 0.35, p.y + Math.sin(angle) * r * 0.22, tileSize * 0.16, tileSize * 0.12);
            }
          } else if (effect.visual === "fog") {
            ctx.globalAlpha = alpha * 0.25;
            for (let i = -2; i <= 2; i += 1) {
              ctx.beginPath();
              ctx.ellipse(p.x + Math.sin(now * 0.0018 + i) * tileSize * 0.7, p.y + i * tileSize * 0.28, r * 0.58, tileSize * 0.2, 0.05, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (effect.kind === "eventStain") {
          const r = tileSize * (effect.radius || 4) * (0.48 + t * 0.08);
          ctx.globalAlpha = alpha * 0.14;
          ctx.fillStyle = this.withAlpha(effect.color, 0.38);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r * 1.2, r * 0.62, 0.08, 0, Math.PI * 2);
          ctx.fill();
        } else if (effect.kind === "bubble") {
          ctx.globalAlpha = alpha * 0.5;
          ctx.strokeStyle = "rgba(222,250,255,0.9)";
          for (let i = 0; i < 5; i += 1) {
            const angle = i * 1.25 + t * 1.8;
            const r = tileSize * (0.16 + t * 0.38 + i * 0.018);
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r - t * tileSize * 0.28, Math.max(1.5, tileSize * 0.045), 0, Math.PI * 2);
            ctx.stroke();
          }
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
        } else if (effect.kind === "borderPulse") {
          ctx.lineWidth = Math.max(1.5, tileSize * 0.055);
          ctx.globalAlpha = Math.min(0.86, alpha);
          const inset = tileSize * (0.12 + t * 0.05);
          this.roundRect(ctx, p.x - tileSize * 0.5 + inset, p.y - tileSize * 0.5 + inset, tileSize - inset * 2, tileSize - inset * 2, tileSize * 0.1);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.12;
          ctx.fill();
        } else if (effect.kind === "weaken") {
          const fill = Math.max(0.05, Math.min(1, Number(effect.progress || 0) / Math.max(1, Number(effect.cost || 1))));
          ctx.lineWidth = Math.max(1.4, tileSize * 0.05);
          ctx.globalAlpha = alpha * 0.88;
          for (let i = 0; i < 3; i += 1) {
            const y = p.y - tileSize * 0.18 + i * tileSize * 0.18;
            ctx.beginPath();
            ctx.moveTo(p.x - tileSize * 0.34, y);
            ctx.quadraticCurveTo(p.x - tileSize * 0.06, y + Math.sin(t * 8 + i) * tileSize * 0.12, p.x + tileSize * (fill * 0.34), y);
            ctx.stroke();
          }
        } else if (effect.kind === "shield") {
          ctx.lineWidth = Math.max(2, tileSize * 0.055);
          this.roundRect(ctx, p.x - tileSize * 0.34, p.y - tileSize * 0.34, tileSize * 0.68, tileSize * 0.68, tileSize * 0.16);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.24 + t * 0.32), 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.kind === "shell") {
          ctx.lineWidth = Math.max(1.2, tileSize * 0.04);
          ctx.globalAlpha = alpha * 0.75;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, tileSize * (0.38 + t * 0.1), tileSize * (0.28 + t * 0.08), 0, 0, Math.PI * 2);
          ctx.stroke();
          [-0.16, 0, 0.16].forEach((offset) => {
            ctx.beginPath();
            ctx.moveTo(p.x - tileSize * 0.3, p.y + tileSize * offset);
            ctx.lineTo(p.x + tileSize * 0.3, p.y + tileSize * offset);
            ctx.stroke();
          });
        } else if (effect.kind === "construction") {
          const pulse = Math.sin(t * Math.PI);
          const r = tileSize * (0.28 + pulse * 0.12);
          ctx.lineWidth = Math.max(2, tileSize * 0.055);
          ctx.globalAlpha = alpha * 0.86;
          ctx.beginPath();
          ctx.arc(p.x, p.y, tileSize * (0.42 + t * 0.22), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.1, t));
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.58;
          for (let i = 0; i < 5; i += 1) {
            const angle = i * 1.26 + t * 2;
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(angle) * tileSize * 0.36, p.y + Math.sin(angle) * tileSize * 0.36, Math.max(1.4, tileSize * 0.032), 0, Math.PI * 2);
            ctx.fill();
          }
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
        } else if (effect.kind === "upgrade") {
          const r = tileSize * (0.32 + Math.sin(t * Math.PI) * 0.26);
          ctx.lineWidth = Math.max(2, tileSize * 0.06);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          if (this.settings.floatingText) this.drawPillText(ctx, `L${effect.level || 2}`, p.x, p.y - tileSize * 0.55, effect.color);
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
        } else if (effect.kind === "elimination") {
          const r = tileSize * (0.7 + t * 1.8);
          ctx.lineWidth = Math.max(2, tileSize * 0.07);
          ctx.strokeStyle = this.withAlpha("#e9857c", 0.86);
          ctx.fillStyle = "rgba(40, 8, 16, 0.16)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (effect.kind === "victory") {
          const r = tileSize * (0.6 + t * 2.6);
          ctx.lineWidth = Math.max(2, tileSize * 0.07);
          ctx.strokeStyle = this.withAlpha(effect.color, 0.9);
          for (let i = 0; i < 3; i += 1) {
            ctx.globalAlpha = alpha * (0.58 - i * 0.12);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * (0.62 + i * 0.24), 0, Math.PI * 2);
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
      if (this.offscreen(from, 120) && this.offscreen(to, 120)) return;
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

    drawStream(ctx, effect, t, alpha) {
      const from = this.worldToScreen(effect.from.wx, effect.from.wy);
      const to = this.worldToScreen(effect.to.wx, effect.to.wy);
      if (this.offscreen(from, 120) && this.offscreen(to, 120)) return;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normal = { x: -dy / distance, y: dx / distance };
      const bend = Math.min(42, distance * 0.18) * (effect.mode === "ambush" ? -0.75 : 1);
      const c1 = { x: from.x + dx * 0.3 + normal.x * bend, y: from.y + dy * 0.3 + normal.y * bend };
      const c2 = { x: from.x + dx * 0.72 + normal.x * bend, y: from.y + dy * 0.72 + normal.y * bend };
      ctx.save();
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha * 0.26;
      ctx.strokeStyle = this.withAlpha(effect.color, 0.72);
      ctx.lineWidth = Math.max(5, 5.5 * (effect.size || 1));
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineWidth = Math.max(1.5, 2.2 * (effect.size || 1));
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      const current = this.cubicPoint(from, c1, c2, to, Math.max(0.08, t));
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, current.x, current.y);
      ctx.stroke();
      ctx.fillStyle = effect.color;
      for (let i = 0; i < 5; i += 1) {
        const dotT = (t + i * 0.18) % 1;
        const dot = this.cubicPoint(from, c1, c2, to, dotT);
        ctx.globalAlpha = alpha * (0.72 - i * 0.08);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, Math.max(2, 4.4 - i * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawRouteStream(ctx, effect, t, alpha) {
      const points = (effect.points || []).map((point) => this.worldToScreen(point.wx, point.wy));
      if (points.length < 2) return;
      const visible = points.some((point) => !this.offscreen(point, 80));
      if (!visible) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = alpha * 0.28;
      ctx.strokeStyle = this.withAlpha(effect.color, 0.72);
      ctx.lineWidth = 6;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.88;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const markerIndex = Math.min(points.length - 1, Math.max(0, Math.floor(t * points.length)));
      const marker = points[markerIndex];
      ctx.fillStyle = effect.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (effect.text && this.settings.floatingText) this.drawPillText(ctx, effect.text, marker.x, marker.y - 18, effect.color);
      ctx.restore();
    }

    drawParticles(ctx, now) {
      this.particles.forEach((particle) => {
        const t = Math.min(1, (now - particle.born) / particle.life);
        const ease = this.settings.reducedMotion ? 0.25 : t;
        const p = this.worldToScreen(particle.wx + particle.vx * ease * 0.45, particle.wy + particle.vy * ease * 0.45);
        if (this.offscreen(p, 70)) return;
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
        } else if (particle.style === "pressure") {
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x - particle.size * 2.2, p.y);
          ctx.lineTo(p.x + particle.size * 2.2, p.y + Math.sin(t * 8) * particle.size);
          ctx.stroke();
        } else if (particle.style === "eventMud") {
          ctx.globalAlpha = (1 - t) * 0.82;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 2.5, particle.size * 1.35, Math.sin(t * 3), 0, Math.PI * 2);
          ctx.fill();
        } else if (particle.style === "eventFoam") {
          ctx.strokeStyle = "rgba(225,250,255,0.88)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, particle.size * (1.7 + t * 2.2), 0, Math.PI * 2);
          ctx.stroke();
        } else if (particle.style === "eventBloom") {
          ctx.globalAlpha = (1 - t) * 0.86;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 2.4, particle.size * 0.95, Math.sin(t * 5), 0, Math.PI * 2);
          ctx.fill();
        } else if (particle.style === "eventReed") {
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + particle.size * 2);
          ctx.quadraticCurveTo(p.x + Math.sin(t * 7) * particle.size, p.y, p.x + particle.size * 0.7, p.y - particle.size * 2.4);
          ctx.stroke();
        } else if (particle.style === "eventRain") {
          ctx.strokeStyle = "rgba(210,245,255,0.72)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x - particle.size * 0.6, p.y - particle.size * 2.8);
          ctx.lineTo(p.x + particle.size * 0.8, p.y + particle.size * 2.4);
          ctx.stroke();
        } else if (particle.style === "eventRock") {
          ctx.globalAlpha = (1 - t) * 0.84;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - particle.size * 2);
          ctx.lineTo(p.x + particle.size * 1.8, p.y + particle.size * 0.4);
          ctx.lineTo(p.x - particle.size * 1.4, p.y + particle.size * 1.7);
          ctx.closePath();
          ctx.fill();
        } else if (particle.style === "eventMist") {
          ctx.globalAlpha = (1 - t) * 0.26;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, particle.size * 5, particle.size * 1.7, 0.15, 0, Math.PI * 2);
          ctx.fill();
        } else if (particle.style === "bubble") {
          ctx.strokeStyle = "rgba(222,250,255,0.88)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(p.x, p.y - t * particle.size * 8, particle.size * 1.4, 0, Math.PI * 2);
          ctx.stroke();
        } else if (particle.style === "victory") {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - particle.size * 2);
          ctx.lineTo(p.x + particle.size * 1.5, p.y);
          ctx.lineTo(p.x, p.y + particle.size * 2);
          ctx.lineTo(p.x - particle.size * 1.5, p.y);
          ctx.closePath();
          ctx.fill();
        } else if (particle.style === "elimination") {
          ctx.globalAlpha = (1 - t) * 0.7;
          ctx.beginPath();
          ctx.arc(p.x, p.y, particle.size * (1.8 + t), 0, Math.PI * 2);
          ctx.stroke();
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

    canSpawnAt(point, margin = 80) {
      return !this.offscreen(this.worldToScreen(point.wx, point.wy), margin);
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
      if (this.settings.level === "low") return value * 0.72;
      if (this.settings.level === "ultra") return value * 1.12;
      return value;
    }

    count(value) {
      if (this.settings.reducedMotion) return Math.max(2, Math.round(value * 0.25));
      const level = this.settings.particles || this.settings.level;
      const mobile = this.settings.isMobile ? 0.68 : 1;
      if (level === "ultra") return Math.max(2, Math.round(value * 1.38 * mobile));
      if (level === "high") return Math.max(2, Math.round(value * mobile));
      if (level === "medium") return Math.max(2, Math.round(value * 0.6 * mobile));
      return Math.max(1, Math.round(value * 0.32 * mobile));
    }

    attackStyle(amount = 0) {
      const value = Number(amount) || 0;
      return ATTACK_STYLE.find((style) => value >= style.min) || ATTACK_STYLE.at(-1);
    }

    offscreen(point, margin = 60) {
      if (!point) return true;
      const canvas = this.renderer.canvas;
      const width = canvas.clientWidth || canvas.width || 0;
      const height = canvas.clientHeight || canvas.height || 0;
      return point.x < -margin || point.y < -margin || point.x > width + margin || point.y > height + margin;
    }

    withAlpha(hex, alpha) {
      if (!hex || typeof hex !== "string") return `rgba(237,248,251,${alpha})`;
      if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
      const clean = hex.replace("#", "");
      if (!/^[0-9a-f]{6}$/i.test(clean)) return `rgba(237,248,251,${alpha})`;
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
