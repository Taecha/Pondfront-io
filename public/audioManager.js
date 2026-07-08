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
  };

  class PondAudioManager {
    constructor() {
      this.settings = this.loadSettings();
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.musicNodes = [];
      this.unlocked = false;
      this.lastPlayed = new Map();
    }

    loadSettings() {
      try {
        return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}) };
      } catch {
        return { ...DEFAULTS };
      }
    }

    snapshot() {
      return { ...this.settings, unlocked: this.unlocked };
    }

    setSettings(next = {}) {
      this.settings = {
        ...this.settings,
        ...next,
        masterVolume: this.clamp01(next.masterVolume ?? this.settings.masterVolume),
        sfxVolume: this.clamp01(next.sfxVolume ?? this.settings.sfxVolume),
        musicVolume: this.clamp01(next.musicVolume ?? this.settings.musicVolume),
        ambientVolume: this.clamp01(next.ambientVolume ?? this.settings.ambientVolume ?? 1),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.applyVolumes();
      if (!this.settings.musicEnabled || this.settings.muted || !this.settings.soundEnabled) this.stopMusic();
      else if (this.unlocked) this.startMusic();
    }

    async unlock() {
      if (!this.settings.soundEnabled || this.unlocked) return;
      this.ensureContext();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
      this.unlocked = true;
      this.applyVolumes();
      if (this.settings.musicEnabled && !this.settings.muted) this.startMusic();
    }

    ensureContext() {
      if (this.ctx) return;
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes(true);
    }

    applyVolumes(immediate = false) {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const master = this.settings.muted || !this.settings.soundEnabled ? 0 : this.settings.masterVolume;
      const sfx = this.settings.sfxVolume;
      const music = this.settings.musicEnabled ? this.settings.musicVolume * (this.settings.ambientVolume ?? 1) : 0;
      const set = (node, value) => {
        if (immediate) node.gain.value = value;
        else node.gain.setTargetAtTime(value, now, 0.035);
      };
      set(this.masterGain, master);
      set(this.sfxGain, sfx);
      set(this.musicGain, music);
    }

    play(name, options = {}) {
      if (!this.canPlay(name, options)) return;
      this.ensureContext();
      if (!this.ctx || this.ctx.state === "suspended") return;
      const nowMs = performance.now();
      const cooldown = options.cooldown ?? 32;
      if (nowMs - (this.lastPlayed.get(name) || 0) < cooldown) return;
      this.lastPlayed.set(name, nowMs);

      const intensity = Math.max(0.35, Math.min(1.8, Number(options.intensity) || 1));
      const pan = Math.max(-1, Math.min(1, Number(options.pan) || 0));
      const out = this.sfxOutput(pan, options.volume ?? 1);
      if (!out) return;

      const map = {
        hover: () => this.tone(520, 0.045, "sine", 0.045, out),
        click: () => this.tone(780, 0.065, "triangle", 0.07, out, 0.82),
        start: () => this.chime([392, 523, 659], 0.095, out, 0.16),
        expand: () => this.chime([440, 560], 0.08, out, 0.13 * intensity),
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

    addEvents(events = [], state = {}) {
      events.forEach((event) => {
        if (event.kind === "expand") this.play("expand", { intensity: 1.05 });
        if (event.kind === "expandProgress") this.play("expandProgress", { cooldown: 80 });
        if (event.kind === "expansionWaveStart") this.play("expandProgress", { cooldown: 100, intensity: 1.08 });
        if (event.kind === "expansionWaveCapture") this.play("expand", { cooldown: 80, intensity: 1.02 });
        if (event.kind === "attackWave") {
          const amount = event.amount || 0;
          this.duckMusicForCombat();
          this.play(amount >= 85 ? "maxAttack" : "attack", { intensity: amount >= 85 ? 1.65 : amount >= 45 ? 1.24 : 0.9, cooldown: 90 });
        }
        if (event.kind === "waveCapture") this.play("capture", { cooldown: 55 });
        if (event.kind === "borderWeakened") this.play("expandProgress", { cooldown: 90, intensity: 0.9 });
        if (event.kind === "waveContested") this.play("warning", { cooldown: 180, intensity: 0.75 });
        if (event.kind === "waveResist" || (event.kind === "waveEnd" && (event.captured || 0) === 0)) this.play("blocked", { cooldown: 110 });
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
      });
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
      filter.connect(this.musicGain);
      low.connect(lowGain);
      lowGain.connect(this.musicGain);
      water.start();
      low.start();
      this.musicNodes = [water, low, filter, lowGain];
    }

    stopMusic() {
      this.musicNodes.forEach((node) => {
        try {
          node.stop?.();
        } catch {}
        node.disconnect?.();
      });
      this.musicNodes = [];
    }

    duckMusicForCombat() {
      if (!this.ctx || !this.musicGain || !this.settings.musicEnabled) return;
      const target = Math.max(0.05, this.settings.musicVolume * (this.settings.ambientVolume ?? 1) * 0.52);
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      clearTimeout(this.combatMusicTimer);
      this.combatMusicTimer = setTimeout(() => this.applyVolumes(), 2400);
    }

    canPlay(name, options = {}) {
      if (!this.settings.soundEnabled || this.settings.muted) return false;
      if (!this.unlocked && !options.allowBeforeUnlock) return false;
      if (options.ui && !this.settings.uiSounds) return false;
      return true;
    }

    sfxOutput(pan = 0, volume = 1) {
      if (!this.ctx || !this.sfxGain) return null;
      const gain = this.ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1.8, volume));
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(this.sfxGain);
        return { gain, end: panner };
      }
      gain.connect(this.sfxGain);
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
