(function initPondAudio(root) {
  const STORAGE_KEY = "pondfront:audio-settings";
  const DEFAULTS = {
    soundEnabled: true,
    musicEnabled: true,
    uiSounds: true,
    muted: false,
    masterVolume: 0.72,
    sfxVolume: 0.78,
    musicVolume: 0.28,
    ambientVolume: 1,
    environmentVolume: 1,
    combatVolume: 0.85,
    animalVolume: 0.8,
    buildingVolume: 0.8,
    uiVolume: 0.75,
    backgroundAudio: false,
    reducedSound: false,
    audioQuality: "standard",
    ambientWorldSounds: true,
  };

  class PondAudioManager {
    constructor() {
      this.settings = this.loadSettings();
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.environmentGain = null;
      this.categoryGains = {};
      this.musicNodes = [];
      this.musicMood = "lobby";
      this.lowOscillator = null;
      this.lowGain = null;
      this.unlocked = false;
      this.lastPlayed = new Map();
      this.currentEventSpatial = null;
      this.lastState = {};
      this.activeVoices = 0;
      this.ambientTimer = null;
      this.lastAmbient = "";
      this.visibilityHandler = () => this.handleVisibility();
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    loadSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
        const settings = { ...DEFAULTS, ...saved };
        if (saved.environmentVolume == null && saved.ambientVolume != null) settings.environmentVolume = saved.ambientVolume;
        return settings;
      } catch {
        return { ...DEFAULTS };
      }
    }

    snapshot() {
      return { ...this.settings, unlocked: this.unlocked };
    }

    setSettings(next = {}, options = {}) {
      this.settings = {
        ...this.settings,
        ...next,
        masterVolume: this.clamp01(next.masterVolume ?? this.settings.masterVolume),
        sfxVolume: this.clamp01(next.sfxVolume ?? this.settings.sfxVolume),
        musicVolume: this.clamp01(next.musicVolume ?? this.settings.musicVolume),
        ambientVolume: this.clamp01(next.ambientVolume ?? this.settings.ambientVolume ?? 1),
        environmentVolume: this.clamp01(next.environmentVolume ?? next.ambientVolume ?? this.settings.environmentVolume ?? this.settings.ambientVolume ?? 1),
        combatVolume: this.clamp01(next.combatVolume ?? this.settings.combatVolume ?? 0.85),
        animalVolume: this.clamp01(next.animalVolume ?? this.settings.animalVolume ?? 0.8),
        buildingVolume: this.clamp01(next.buildingVolume ?? this.settings.buildingVolume ?? 0.8),
        uiVolume: this.clamp01(next.uiVolume ?? this.settings.uiVolume ?? 0.75),
        backgroundAudio: Boolean(next.backgroundAudio ?? this.settings.backgroundAudio),
        reducedSound: Boolean(next.reducedSound ?? this.settings.reducedSound),
        audioQuality: ["low", "standard", "high"].includes(next.audioQuality) ? next.audioQuality : (this.settings.audioQuality || "standard"),
        ambientWorldSounds: Boolean(next.ambientWorldSounds ?? this.settings.ambientWorldSounds),
      };
      if (options.persist !== false) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.applyVolumes();
      if (!this.settings.musicEnabled || this.settings.muted || !this.settings.soundEnabled) this.stopMusic();
      else if (this.unlocked) this.startMusic();
      if (!this.settings.soundEnabled || this.settings.muted) this.stopAmbientLife();
      else if (this.unlocked) this.startAmbientLife();
    }

    async unlock() {
      if (!this.settings.soundEnabled || this.unlocked) return;
      this.ensureContext();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
      this.unlocked = true;
      this.applyVolumes();
      if (this.settings.musicEnabled && !this.settings.muted) this.startMusic();
      this.startAmbientLife();
    }

    ensureContext() {
      if (this.ctx) return;
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.environmentGain = this.ctx.createGain();
      this.categoryGains = {
        sfx: this.ctx.createGain(),
        ui: this.ctx.createGain(),
        combat: this.ctx.createGain(),
        animal: this.ctx.createGain(),
        building: this.ctx.createGain(),
      };
      Object.values(this.categoryGains).forEach((gain) => gain.connect(this.sfxGain));
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.environmentGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes(true);
    }

    applyVolumes(immediate = false) {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const master = this.settings.muted || !this.settings.soundEnabled ? 0 : this.settings.masterVolume;
      const sfx = this.settings.sfxVolume;
      const music = this.settings.musicEnabled ? this.settings.musicVolume : 0;
      const environment = this.settings.environmentVolume ?? this.settings.ambientVolume ?? 1;
      const set = (node, value) => {
        if (immediate) node.gain.value = value;
        else node.gain.setTargetAtTime(value, now, 0.035);
      };
      set(this.masterGain, master);
      set(this.sfxGain, sfx);
      set(this.musicGain, music);
      set(this.environmentGain, environment);
      set(this.categoryGains.sfx, 1);
      set(this.categoryGains.ui, this.settings.uiVolume ?? 0.75);
      set(this.categoryGains.combat, this.settings.combatVolume ?? 0.85);
      set(this.categoryGains.animal, this.settings.animalVolume ?? 0.8);
      set(this.categoryGains.building, this.settings.buildingVolume ?? 0.8);
    }

    play(name, options = {}) {
      if (!this.canPlay(name, options)) return;
      this.ensureContext();
      if (!this.ctx || this.ctx.state === "suspended") return;
      const nowMs = performance.now();
      const cooldown = options.cooldown ?? 32;
      if (nowMs - (this.lastPlayed.get(name) || 0) < cooldown) return;
      const maxVoices = this.settings.batterySaver ? 4 : this.settings.reducedSound ? 5 : this.settings.audioQuality === "high" ? 12 : this.settings.audioQuality === "low" ? 6 : 9;
      if (this.activeVoices >= maxVoices && !options.priority) return;
      this.lastPlayed.set(name, nowMs);
      this.activeVoices += 1;
      setTimeout(() => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }, Math.max(300, Number(options.voiceMs || 900)));

      const intensity = Math.max(0.35, Math.min(1.8, Number(options.intensity) || 1));
      const spatial = this.currentEventSpatial || {};
      const pan = Math.max(-1, Math.min(1, Number(options.pan ?? spatial.pan) || 0));
      const category = this.soundCategory(name, options);
      const variation = options.fixed ? 1 : 0.94 + Math.random() * 0.12;
      const out = this.sfxOutput(pan, (options.volume ?? 1) * (spatial.volume ?? 1) * variation, category);
      if (!out) return;

      const map = {
        hover: () => this.tone(520, 0.045, "sine", 0.045, out),
        click: () => this.tone(780, 0.065, "triangle", 0.07, out, 0.82),
        confirm: () => this.chime([520, 700, 920], 0.065, out, 0.08),
        error: () => this.sweep(330, 150, 0.12, "triangle", 0.07, out),
        notify: () => this.chime([620, 820], 0.07, out, 0.07),
        ready: () => this.chime([420, 620, 840], 0.07, out, 0.1),
        countdown: () => this.tone(440, 0.1, "sine", 0.08, out, 1.18),
        start: () => this.chime([392, 523, 659], 0.095, out, 0.16),
        expand: () => {
          this.noise(0.09, 0.055 * intensity, out, 940);
          this.chime([440, 560], 0.08, out, 0.1 * intensity);
        },
        expandLarge: () => {
          this.noise(0.2, 0.09 * intensity, out, 720);
          this.sweep(170, 460, 0.26, "triangle", 0.1 * intensity, out);
        },
        expandProgress: () => this.tone(330, 0.07, "triangle", 0.06, out, 1.16),
        attack: () => this.sweep(180, 720, 0.22, "sawtooth", 0.14 * intensity, out),
        maxAttack: () => {
          this.noise(0.18, 0.16 * intensity, out, 520);
          this.sweep(120, 780, 0.32, "sawtooth", 0.18 * intensity, out);
          setTimeout(() => this.tone(92, 0.16, "triangle", 0.09, out, 0.72), 95);
        },
        currentPush: () => {
          this.sweep(220, 660, 0.2, "triangle", 0.12 * intensity, out);
          setTimeout(() => this.noise(0.13, 0.065, out, 1180), 60);
        },
        currentImpact: () => {
          this.noise(0.2, 0.16 * intensity, out, 420);
          this.sweep(520, 160, 0.22, "triangle", 0.13 * intensity, out);
        },
        specialLaunch: () => {
          this.chime([520, 740, 980], 0.09, out, 0.13 * intensity);
          setTimeout(() => this.noise(0.12, 0.06, out, 1200), 80);
        },
        specialImpact: () => {
          this.noise(0.18, 0.14 * intensity, out, 560);
          this.chime([240, 420, 660], 0.08, out, 0.12 * intensity);
        },
        specialDefense: () => this.chime([360, 520, 700, 920], 0.075, out, 0.11 * intensity),
        capture: () => this.chime([520, 720, 880], 0.075, out, 0.14 * intensity),
        blocked: () => {
          this.noise(0.12, 0.17, out, 520);
          this.tone(120, 0.16, "square", 0.07, out, 0.72);
        },
        retreat: () => {
          this.noise(0.13, 0.06, out, 680);
          this.sweep(410, 135, 0.2, "sine", 0.075, out);
        },
        defend: () => this.chime([240, 360, 480], 0.09, out, 0.12),
        build: () => this.chime([360, 520, 680], 0.08, out, 0.12),
        buildComplete: () => this.chime([420, 560, 760, 960], 0.075, out, 0.13),
        buildingCaptured: () => {
          this.chime([360, 540, 760], 0.075, out, 0.12 * intensity);
          setTimeout(() => this.sweep(700, 260, 0.16, "triangle", 0.08 * intensity, out), 70);
        },
        upgrade: () => this.chime([480, 640, 840, 1080], 0.075, out, 0.14),
        upgradeComplete: () => this.chime([520, 740, 980, 1280], 0.07, out, 0.16),
        abilityDuck: () => this.flutter(out, "#duck"),
        abilitySnake: () => {
          this.noise(0.18, 0.08, out, 850);
          this.sweep(220, 760, 0.11, "triangle", 0.12, out);
        },
        abilityFrog: () => {
          this.sweep(260, 920, 0.13, "sine", 0.13, out);
          this.noise(0.08, 0.07, out, 980);
        },
        abilityTurtle: () => this.chime([150, 220, 330], 0.13, out, 0.16),
        abilityCarp: () => this.chime([560, 840, 1120, 1400], 0.08, out, 0.12),
        selectDuck: () => {
          this.sweep(430, 610, 0.08, "square", 0.045, out);
          setTimeout(() => this.sweep(390, 540, 0.07, "square", 0.03, out), 78);
          this.noise(0.1, 0.025, out, 1450);
        },
        selectSnake: () => {
          this.noise(0.2, 0.045, out, 1700);
          this.sweep(210, 340, 0.16, "triangle", 0.04, out);
        },
        selectFrog: () => {
          this.sweep(145, 225, 0.12, "sine", 0.075, out);
          setTimeout(() => this.sweep(125, 205, 0.1, "sine", 0.05, out), 105);
        },
        selectTurtle: () => {
          this.tone(150, 0.12, "triangle", 0.07, out, 0.8);
          this.noise(0.08, 0.035, out, 320);
        },
        selectCarp: () => {
          this.sweep(420, 880, 0.16, "sine", 0.055, out);
          [0, 55, 105].forEach((delay, index) => setTimeout(() => this.tone(760 + index * 120, 0.04, "sine", 0.025, out), delay));
        },
        ambientWater: () => this.noise(0.42, 0.018, out, 760),
        ambientReeds: () => this.noise(0.32, 0.015, out, 1600),
        ambientBird: () => this.chime([1180, 1420, 1260], 0.09, out, 0.018),
        ambientFrog: () => this.sweep(110, 176, 0.22, "sine", 0.025, out),
        ambientInsects: () => this.tone(1760, 0.18, "sine", 0.012, out, 1.08),
        ambientCrickets: () => {
          [0, 70, 145].forEach((delay) => setTimeout(() => this.tone(2320, 0.035, "sine", 0.012, out, 0.96), delay));
        },
        ambientBubbles: () => {
          [0, 80, 155].forEach((delay, index) => setTimeout(() => this.sweep(540 + index * 70, 790 + index * 85, 0.055, "sine", 0.016, out), delay));
        },
        ambientSplash: () => {
          this.noise(0.12, 0.028, out, 820);
          this.sweep(300, 160, 0.14, "sine", 0.02, out);
        },
        ambientRain: () => this.noise(0.5, 0.022, out, 1900),
        ambientThunder: () => {
          this.noise(0.5, 0.035, out, 260);
          this.tone(58, 0.45, "triangle", 0.022, out, 0.7);
        },
        objective: () => this.chime([392, 659, 988], 0.14, out, 0.14),
        objectiveSpawn: () => this.chime([330, 494, 740, 988], 0.12, out, 0.12),
        objectiveCapture: () => this.chime([494, 659, 880, 1174], 0.1, out, 0.15),
        alliance: () => this.chime([420, 540, 700], 0.1, out, 0.1),
        allianceBreak: () => {
          this.sweep(520, 190, 0.16, "triangle", 0.11, out);
          setTimeout(() => this.noise(0.1, 0.09, out, 680), 75);
        },
        support: () => this.chime([500, 620, 820], 0.08, out, 0.1),
        lakeMud: () => {
          this.noise(0.22, 0.12 * intensity, out, 260);
          this.sweep(105, 62, 0.32, "triangle", 0.1 * intensity, out);
        },
        lakeFlood: () => {
          this.noise(0.24, 0.13 * intensity, out, 980);
          this.sweep(180, 520, 0.26, "triangle", 0.1 * intensity, out);
        },
        lakeBloom: () => this.chime([520, 740, 980, 1280], 0.11, out, 0.12 * intensity),
        lakeReed: () => {
          this.noise(0.16, 0.075 * intensity, out, 1600);
          this.chime([330, 440, 590], 0.07, out, 0.07 * intensity);
        },
        lakeStorm: () => {
          this.noise(0.22, 0.1 * intensity, out, 720);
          this.tone(88, 0.22, "triangle", 0.06 * intensity, out, 0.64);
        },
        lakeRock: () => {
          this.noise(0.18, 0.15 * intensity, out, 340);
          this.tone(132, 0.12, "square", 0.07 * intensity, out, 0.5);
        },
        lakeFog: () => this.sweep(260, 180, 0.32, "sine", 0.055 * intensity, out),
        elimination: () => {
          this.noise(0.2, 0.12, out, 360);
          this.chime([260, 196, 146], 0.12, out, 0.1);
        },
        warning: () => this.sweep(340, 160, 0.16, "square", 0.09, out),
        victory: () => this.chime([392, 523, 659, 784, 1046], 0.13, out, 0.16),
        defeat: () => this.chime([330, 260, 196], 0.17, out, 0.12),
      };
      (map[name] || map.click)();
    }

    addEvents(events = [], state = {}, view = {}) {
      this.lastState = state || {};
      this.updateMusicMood(state);
      events.forEach((event) => {
        this.currentEventSpatial = this.spatialOptions(event, state, view);
        if (event.kind === "expand") this.play("expand", { intensity: 1.05 });
        if (event.kind === "expandProgress") this.play("expandProgress", { cooldown: 80 });
        if (event.kind === "expansionWaveStart") this.play(Number(event.amount || 0) >= 60 ? "expandLarge" : "expandProgress", { cooldown: 100, intensity: 1.08 });
        if (event.kind === "expansionWaveCapture") this.play("expand", { cooldown: 80, intensity: 1.02 });
        if (event.kind === "attackWave") {
          const amount = event.amount || 0;
          this.duckMusicForCombat();
          this.play(amount >= 85 ? "maxAttack" : "attack", { intensity: amount >= 85 ? 1.65 : amount >= 45 ? 1.24 : 0.9, cooldown: 90 });
        }
        if (event.kind === "waveCapture") this.play("capture", { cooldown: 55 });
        if (event.kind === "borderWeakened") this.play("expandProgress", { cooldown: 90, intensity: 0.9 });
        if (event.kind === "waveContested") this.play("warning", { cooldown: 180, intensity: 0.75 });
        if (event.kind === "waveResist") this.play("blocked", { cooldown: 110 });
        if (event.kind === "waveEnd" && (event.captured || 0) === 0) this.play("retreat", { cooldown: 160 });
        if (event.kind === "continuousAttackStart") this.play("attack", { intensity: 0.95, cooldown: 140 });
        if (event.kind === "waterRouteAttack") this.play("currentPush", { intensity: 1.05, cooldown: 140 });
        if (event.kind === "currentPushWarning") this.play("warning", { cooldown: 420, intensity: 0.82 });
        if (event.kind === "currentPushImpact") this.play("currentImpact", { intensity: event.captured > 0 ? 1.25 : 0.92, cooldown: 280 });
        if (event.kind === "currentPushBlocked") this.play("blocked", { cooldown: 180 });
        if (event.kind === "lastStand") this.play("warning", { cooldown: 360, intensity: 0.95 });
        if (event.kind === "specialLaunch") this.play("specialLaunch", { cooldown: 260, intensity: 1.05 });
        if (event.kind === "specialDefense") this.play("specialDefense", { cooldown: 220, intensity: event.specialType === "dragonflyGuard" ? 1.08 : 0.92 });
        if (event.kind === "specialImpact") this.play("specialImpact", { cooldown: 260, intensity: event.captured > 0 ? 1.24 : 0.9 });
        if (event.kind === "supportSent") this.play("support", { cooldown: 180 });
        if (event.kind === "coreUnderAttack") this.play("warning", { cooldown: 260 });
        if (event.kind === "coreCaptured" || event.kind === "surrender") this.play("objectiveCapture", { cooldown: 260 });
        if (event.kind === "eliminated") this.play("elimination", { cooldown: 260 });
        if (event.kind === "defend") this.play("defend", { cooldown: 100 });
        if (event.kind === "buildStarted") this.play("build", { cooldown: 120, intensity: 0.72 });
        if (event.kind === "buildComplete") this.play("buildComplete", { cooldown: 120 });
        if (event.kind === "buildUpgradeStarted") this.play("upgrade", { cooldown: 140, intensity: 0.72 });
        if (event.kind === "buildUpgrade") this.play("upgradeComplete", { cooldown: 120 });
        if (event.kind === "buildingCaptured") this.play("buildingCaptured", { cooldown: 140, intensity: 0.92 });
        if (event.kind === "objectiveAppeared") this.play("objectiveSpawn", { cooldown: 220 });
        if (event.kind === "objectiveCaptured" || event.kind === "campCaptured") this.play("objectiveCapture", { cooldown: 220 });
        if (event.kind === "lakeEventWarning") this.play("warning", { cooldown: 420, intensity: 0.78 });
        if (event.kind === "lakeEventStarted") {
          const sound = this.lakeEventSound(event.eventType, event.visual);
          this.play(sound, { cooldown: 520, intensity: 1.05 });
        }
        if (event.kind === "lakeEventEnded") {
          const sound = event.visual === "lily" ? "lakeBloom" : event.visual === "fog" ? "lakeFog" : "expandProgress";
          this.play(sound, { cooldown: 520, intensity: 0.72 });
        }
        if (event.kind === "worldPhase") this.play("objectiveSpawn", { cooldown: 800, intensity: 0.58 });
        if (event.kind === "diplomacy" && ["alliance", "allianceAccepted"].includes(event.subtype)) this.play("alliance", { cooldown: 180 });
        if (event.kind === "diplomacy" && ["broken", "war", "enemy"].includes(event.subtype)) this.play("allianceBreak", { cooldown: 180 });
        if (event.kind === "notice" && event.ok === false) this.play("warning", { cooldown: 140 });
        if (event.kind === "ability") {
          const player = state.players?.find((candidate) => candidate.id === event.playerId);
          const key = player?.animal ? `ability${player.animal.charAt(0).toUpperCase()}${player.animal.slice(1)}` : "click";
          this.play(key, { cooldown: 160 });
        }
        if (event.kind === "ended") {
          const humanWon = event.winnerId && event.winnerId === state.humanId;
          this.play(humanWon ? "victory" : "defeat", { cooldown: 800 });
        }
        this.currentEventSpatial = null;
      });
    }

    spatialOptions(event = {}, state = {}, view = {}) {
      const tileId = Number(event.to ?? event.tileId ?? event.targetTileId);
      const tile = Number.isInteger(tileId) ? state.tiles?.[tileId] : null;
      const camera = view.camera;
      const width = Math.max(1, Number(view.width || 0));
      const height = Math.max(1, Number(view.height || 0));
      const baseTile = Math.max(1, Number(view.baseTile || 1));
      const zoom = Math.max(0.1, Number(camera?.zoom || 1));
      if (!tile || !camera || width <= 1 || height <= 1) return null;
      const screenX = ((tile.x + 0.5) * baseTile - camera.x) * zoom + width / 2;
      const screenY = ((tile.y + 0.5) * baseTile - camera.y) * zoom + height / 2;
      const normalizedX = (screenX - width / 2) / Math.max(1, width * 0.5);
      const normalizedY = (screenY - height / 2) / Math.max(1, height * 0.5);
      const distance = Math.hypot(normalizedX, normalizedY);
      const zoomGain = Math.max(0.72, Math.min(1, 0.72 + zoom * 0.18));
      const batteryScale = this.settings.batterySaver ? Math.max(0.58, 1 - distance * 0.22) : 1;
      return {
        pan: Math.max(-0.82, Math.min(0.82, normalizedX * 0.76)),
        volume: Math.max(0.22, Math.min(1, (1 - Math.max(0, distance - 0.35) * 0.32) * zoomGain * batteryScale)),
      };
    }

    lakeEventSound(eventType = "", visual = "") {
      const key = visual || eventType;
      if (key === "mud" || eventType === "mudslide") return "lakeMud";
      if (key === "flood" || eventType === "floodWave" || key === "current" || eventType === "currentShift") return "lakeFlood";
      if (key === "lily" || eventType === "lilyBloom") return "lakeBloom";
      if (key === "reed" || eventType === "reedSurge") return "lakeReed";
      if (key === "storm" || eventType === "rainstorm") return "lakeStorm";
      if (key === "rock" || eventType === "rockfall") return "lakeRock";
      if (key === "fog" || eventType === "foggyMarsh") return "lakeFog";
      return "objectiveSpawn";
    }

    startMusic() {
      if (!this.ctx || this.musicNodes.length || !this.settings.musicEnabled || this.settings.muted || !this.settings.soundEnabled) return;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i += 1) {
        last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
        data[i] = last;
      }
      const water = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const low = this.ctx.createOscillator();
      const lowGain = this.ctx.createGain();
      water.buffer = buffer;
      water.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 760;
      filter.Q.value = 0.8;
      low.type = "sine";
      low.frequency.value = 92;
      lowGain.gain.value = 0.018;
      water.connect(filter);
      filter.connect(this.environmentGain || this.musicGain);
      low.connect(lowGain);
      lowGain.connect(this.musicGain);
      water.start();
      low.start();
      this.musicNodes = [water, low, filter, lowGain];
      this.lowOscillator = low;
      this.lowGain = lowGain;
      this.applyMusicMood();
    }

    stopMusic() {
      this.musicNodes.forEach((node) => {
        try {
          node.stop?.();
        } catch {}
        node.disconnect?.();
      });
      this.musicNodes = [];
      this.lowOscillator = null;
      this.lowGain = null;
    }

    duckMusicForCombat() {
      if (!this.ctx || !this.musicGain || !this.settings.musicEnabled) return;
      const target = Math.max(0.04, this.settings.musicVolume * 0.52);
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      clearTimeout(this.combatMusicTimer);
      this.combatMusicTimer = setTimeout(() => this.applyVolumes(), 2400);
    }

    soundCategory(name, options = {}) {
      if (options.category) return options.category;
      if (options.ui) return "ui";
      if (String(name).startsWith("ability") || String(name).startsWith("select")) return "animal";
      if (["attack", "maxAttack", "currentPush", "currentImpact", "specialLaunch", "specialImpact", "specialDefense", "capture", "blocked", "retreat", "defend", "elimination", "warning"].includes(name)) return "combat";
      if (["build", "buildComplete", "buildingCaptured", "upgrade", "upgradeComplete"].includes(name)) return "building";
      if (String(name).startsWith("lake") || String(name).startsWith("ambient")) return "environment";
      return "sfx";
    }

    categoryVolume(category = "sfx") {
      if (category === "ui") return this.settings.uiVolume ?? 0.75;
      if (category === "combat") return this.settings.combatVolume ?? 0.85;
      if (category === "animal") return this.settings.animalVolume ?? 0.8;
      if (category === "building") return this.settings.buildingVolume ?? 0.8;
      if (category === "environment") return this.settings.environmentVolume ?? this.settings.ambientVolume ?? 1;
      return 1;
    }

    updateMusicMood(state = {}) {
      let next = "lobby";
      if (state.ended) next = state.winnerId === state.humanId ? "victory" : "defeat";
      else if ((state.animalsLeft || 0) > 0 && (state.animalsLeft || 0) <= 2) next = "final";
      else if ((state.activeAttacks || []).length >= 3) next = "war";
      else if ((state.elapsed || 0) >= 150) next = "mid";
      else if (state.phase === "PLAYING") next = "early";
      if (next === this.musicMood) return;
      this.musicMood = next;
      this.applyMusicMood();
    }

    applyMusicMood() {
      if (!this.ctx || !this.lowOscillator || !this.lowGain) return;
      const moods = {
        lobby: { frequency: 82, gain: 0.012 },
        early: { frequency: 92, gain: 0.018 },
        mid: { frequency: 102, gain: 0.022 },
        war: { frequency: 116, gain: 0.032 },
        final: { frequency: 124, gain: 0.038 },
        victory: { frequency: 132, gain: 0.02 },
        defeat: { frequency: 72, gain: 0.014 },
      };
      const mood = moods[this.musicMood] || moods.early;
      this.lowOscillator.frequency.setTargetAtTime(mood.frequency, this.ctx.currentTime, 1.2);
      this.lowGain.gain.setTargetAtTime(mood.gain, this.ctx.currentTime, 1.4);
    }

    startAmbientLife() {
      if (this.ambientTimer || !this.unlocked || !this.settings.soundEnabled || this.settings.muted) return;
      const schedule = () => {
        this.ambientTimer = null;
        if (!this.unlocked || !this.settings.soundEnabled || this.settings.muted) return;
        if (!document.hidden || this.settings.backgroundAudio) this.playAmbientMoment();
        const base = this.settings.batterySaver ? 12500 : this.settings.reducedSound ? 10500 : this.settings.audioQuality === "high" ? 4300 : this.settings.audioQuality === "low" ? 8200 : 6200;
        const spread = this.settings.reducedSound ? 7000 : 5200;
        this.ambientTimer = setTimeout(schedule, base + Math.random() * spread);
      };
      this.ambientTimer = setTimeout(schedule, 1400 + Math.random() * 1800);
    }

    stopAmbientLife() {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }

    playAmbientMoment() {
      if (this.settings.ambientWorldSounds === false) return;
      const atmosphere = root.PondWorldAtmosphere?.atmosphereFor?.(this.lastState || {}) || {};
      const phase = atmosphere.phase?.id || "day";
      const season = atmosphere.season?.id || "spring";
      const weather = atmosphere.weather?.visual || "clear";
      let choices = phase === "night"
        ? ["ambientWater", "ambientCrickets", "ambientFrog", "ambientBubbles"]
        : ["ambientWater", "ambientReeds", "ambientBird", "ambientInsects", "ambientBubbles", "ambientSplash"];
      if (weather === "rain") choices = ["ambientRain", "ambientWater", "ambientReeds"];
      if (weather === "storm") choices = ["ambientRain", "ambientThunder", "ambientWater"];
      if (weather === "wind") choices = ["ambientReeds", "ambientWater", "ambientBird"];
      if (season === "spring" && weather === "clear") choices.push("ambientBird", "ambientInsects");
      if (season === "summer" && weather === "clear") choices.push("ambientFrog", "ambientInsects");
      if (season === "autumn" && weather === "clear") choices.push("ambientReeds");
      if (season === "winter" && weather === "clear") choices = choices.filter((name) => !["ambientInsects", "ambientFrog"].includes(name));
      if (this.settings.reducedSound) choices = choices.filter((name) => ["ambientWater", "ambientReeds", "ambientRain", "ambientCrickets"].includes(name));
      if (!choices.length) return;
      let name = choices[Math.floor(Math.random() * choices.length)];
      if (choices.length > 1 && name === this.lastAmbient) name = choices[(choices.indexOf(name) + 1) % choices.length];
      this.lastAmbient = name;
      this.play(name, { category: "environment", cooldown: 1200, volume: 0.72, pan: Math.random() * 1.4 - 0.7, voiceMs: 700 });
    }

    async handleVisibility() {
      if (!this.ctx) return;
      if (document.hidden && !this.settings.backgroundAudio) {
        this.stopAmbientLife();
        await this.ctx.suspend?.().catch(() => {});
        return;
      }
      if (!document.hidden && this.unlocked) {
        await this.ctx.resume?.().catch(() => {});
        if (this.settings.musicEnabled && !this.settings.muted) this.startMusic();
        this.startAmbientLife();
      }
    }

    canPlay(name, options = {}) {
      if (!this.settings.soundEnabled || this.settings.muted) return false;
      if (!this.unlocked && !options.allowBeforeUnlock) return false;
      if (options.ui && !this.settings.uiSounds) return false;
      if (document.hidden && !this.settings.backgroundAudio) return false;
      if (this.settings.reducedSound && name === "hover") return false;
      return true;
    }

    sfxOutput(pan = 0, volume = 1, category = "sfx") {
      if (!this.ctx || !this.sfxGain) return null;
      const gain = this.ctx.createGain();
      const destination = category === "environment" ? this.environmentGain : this.categoryGains[category] || this.categoryGains.sfx || this.sfxGain;
      gain.gain.value = Math.max(0, Math.min(1.8, volume));
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(destination);
        return { gain, end: panner };
      }
      gain.connect(destination);
      return { gain, end: gain };
    }

    tone(freq, duration, type, volume, out, bend = 1) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(out.gain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
      setTimeout(() => gain.disconnect(), (duration + 0.08) * 1000);
    }

    sweep(from, to, duration, type, volume, out) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(out.gain);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    chime(notes, step, out, volume) {
      notes.forEach((freq, index) => {
        setTimeout(() => this.tone(freq, step * 1.5, "sine", volume * (1 - index * 0.09), out, 1.03), index * step * 1000);
      });
    }

    flutter(out) {
      [720, 880, 660, 940].forEach((freq, index) => {
        setTimeout(() => this.tone(freq, 0.045, "triangle", 0.07, out, 0.92), index * 34);
      });
      this.noise(0.08, 0.045, out, 1500);
    }

    noise(duration, volume, out, cutoff = 1000) {
      const now = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * duration)), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.9;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(out.gain);
      source.start(now);
    }

    clamp01(value) {
      return Math.max(0, Math.min(1, Number(value)));
    }
  }

  root.PondAudioManager = PondAudioManager;
})(window);
