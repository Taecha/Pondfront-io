(function initPondSettingsConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondSettingsConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeSettingsConfig() {
  const VERSION = 2;
  const STORAGE_KEY = "pondfront:settings:v2";
  const REVISION = "settings-graphics-fix";
  const CATEGORIES = ["gameplay", "controls", "graphics", "effects", "audio", "camera", "accessibility", "world", "performance", "account"];

  const DEFAULTS = Object.freeze({
    strategicView: false,
    autoStrategicView: true,
    showCoachHints: true,
    showDebugStats: false,
    showTileHitboxes: false,
    mobileDockSide: "center",
    mobileButtonSize: "normal",
    mobileTapSensitivity: "normal",
    mobileLongPress: "540",
    mobileDoubleTap: "actions",
    mobileVibration: true,
    visualPreset: "medium",
    uiScale: "compact",
    colorVisionMode: "standard",
    visualQuality: "medium",
    waterQuality: "medium",
    shadowQuality: "low",
    showIcons: false,
    showAnimalIcons: true,
    showAnimalSprites: true,
    showAnimalAnimations: true,
    showBorderStatus: true,
    mapDecorations: true,
    livingWorld: true,
    cameraEffects: true,
    effectsLevel: "medium",
    particlesLevel: "medium",
    borderEffects: true,
    floatingText: true,
    attackArrows: true,
    abilityEffects: true,
    screenShake: true,
    reducedMotion: false,
    soundEnabled: true,
    musicEnabled: true,
    uiSounds: true,
    muteAll: false,
    masterVolume: 0.72,
    sfxVolume: 0.78,
    musicVolume: 0.28,
    ambientVolume: 1,
    combatVolume: 0.85,
    animalVolume: 0.8,
    buildingVolume: 0.8,
    uiVolume: 0.75,
    backgroundAudio: false,
    reducedSound: false,
    audioQuality: "standard",
    cameraSensitivity: 1,
    dayNightVisuals: true,
    timeTransitionQuality: "smooth",
    seasonalDecorations: true,
    weatherEffects: true,
    fireflies: true,
    fogEffects: true,
    fogQuality: "medium",
    waterReflections: true,
    decorativeAnimals: true,
    ambientWorldSounds: true,
    worldStatusHud: true,
    showWorldModifiers: true,
    reducedWorldAnimation: false,
    worldAnimationQuality: "medium",
    adaptiveQuality: false,
    batterySaver: false,
    fpsLimit: "60",
    mobileMinimapSize: "medium",
  });

  const OPTIONS = Object.freeze({
    mobileDockSide: ["right", "left", "center"],
    mobileButtonSize: ["compact", "normal", "large"],
    mobileTapSensitivity: ["precise", "normal", "relaxed"],
    mobileLongPress: ["420", "540", "680"],
    mobileDoubleTap: ["actions", "info", "none"],
    visualPreset: ["low", "medium", "high", "ultra", "custom"],
    uiScale: ["tiny", "compact", "normal", "large"],
    colorVisionMode: ["standard", "deuteranopia", "protanopia", "tritanopia"],
    visualQuality: ["low", "medium", "high", "ultra"],
    waterQuality: ["low", "medium", "high", "ultra"],
    shadowQuality: ["off", "low", "medium", "high"],
    effectsLevel: ["off", "low", "medium", "high", "ultra"],
    particlesLevel: ["off", "low", "medium", "high", "ultra"],
    audioQuality: ["low", "standard", "high"],
    timeTransitionQuality: ["instant", "smooth", "cinematic"],
    fogQuality: ["off", "low", "medium", "high", "ultra"],
    worldAnimationQuality: ["low", "medium", "high", "ultra"],
    fpsLimit: ["0", "30", "45", "60", "90", "120"],
    mobileMinimapSize: ["small", "medium", "large"],
  });

  const PRESETS = Object.freeze({
    low: Object.freeze({
      strategicView: false, visualQuality: "low", effectsLevel: "low", particlesLevel: "low", waterQuality: "low", shadowQuality: "off", fogQuality: "low", worldAnimationQuality: "low",
      mapDecorations: false, livingWorld: false, decorativeAnimals: false, fireflies: false, waterReflections: false, seasonalDecorations: false, showAnimalAnimations: false, cameraEffects: false, screenShake: false, borderEffects: false, floatingText: false,
    }),
    medium: Object.freeze({
      strategicView: false, visualQuality: "medium", effectsLevel: "medium", particlesLevel: "medium", waterQuality: "medium", shadowQuality: "low", fogQuality: "medium", worldAnimationQuality: "medium",
      mapDecorations: true, livingWorld: true, decorativeAnimals: true, fireflies: true, waterReflections: true, seasonalDecorations: true, showAnimalAnimations: true, cameraEffects: true, screenShake: true, borderEffects: true, floatingText: true,
    }),
    high: Object.freeze({
      strategicView: false, visualQuality: "high", effectsLevel: "high", particlesLevel: "high", waterQuality: "high", shadowQuality: "medium", fogQuality: "high", worldAnimationQuality: "high",
      mapDecorations: true, livingWorld: true, decorativeAnimals: true, fireflies: true, waterReflections: true, seasonalDecorations: true, showAnimalAnimations: true, cameraEffects: true, screenShake: true, borderEffects: true, floatingText: true,
    }),
    ultra: Object.freeze({
      strategicView: false, visualQuality: "ultra", effectsLevel: "ultra", particlesLevel: "ultra", waterQuality: "ultra", shadowQuality: "high", fogQuality: "ultra", worldAnimationQuality: "ultra",
      mapDecorations: true, livingWorld: true, decorativeAnimals: true, fireflies: true, waterReflections: true, seasonalDecorations: true, showAnimalAnimations: true, cameraEffects: true, screenShake: true, borderEffects: true, floatingText: true,
    }),
  });

  const PRESET_KEYS = Object.freeze([...new Set(Object.values(PRESETS).flatMap((preset) => Object.keys(preset)))]);
  const CATEGORY_KEYS = Object.freeze({
    gameplay: ["strategicView", "autoStrategicView", "showCoachHints", "showDebugStats", "showTileHitboxes"],
    controls: ["mobileDockSide", "mobileButtonSize", "mobileTapSensitivity", "mobileLongPress", "mobileDoubleTap", "mobileVibration"],
    graphics: ["visualPreset", "visualQuality", "waterQuality", "shadowQuality", "showIcons", "showAnimalIcons", "showAnimalSprites", "showAnimalAnimations", "showBorderStatus", "mapDecorations", "livingWorld"],
    effects: ["effectsLevel", "particlesLevel", "borderEffects", "floatingText", "attackArrows", "abilityEffects", "screenShake"],
    audio: ["soundEnabled", "musicEnabled", "uiSounds", "muteAll", "masterVolume", "sfxVolume", "musicVolume", "ambientVolume", "combatVolume", "animalVolume", "buildingVolume", "uiVolume", "backgroundAudio", "reducedSound", "audioQuality"],
    camera: ["cameraEffects", "cameraSensitivity", "mobileMinimapSize"],
    accessibility: ["uiScale", "colorVisionMode", "reducedMotion"],
    world: ["dayNightVisuals", "timeTransitionQuality", "seasonalDecorations", "weatherEffects", "fireflies", "fogEffects", "fogQuality", "waterReflections", "decorativeAnimals", "ambientWorldSounds", "worldStatusHud", "showWorldModifiers", "reducedWorldAnimation", "worldAnimationQuality"],
    performance: ["adaptiveQuality", "batterySaver", "fpsLimit"],
    account: [],
  });

  const LEGACY_KEYS = Object.freeze({
    visualPreset: "pondfront:visual-preset",
    uiScale: "pondfront:ui-scale",
    colorVisionMode: "pondfront:color-vision",
    mobileDockSide: "pondfront:mobile-dock-side",
    mobileButtonSize: "pondfront:mobile-button-size",
    mobileTapSensitivity: "pondfront:mobile-tap-sensitivity",
    mobileLongPress: "pondfront:mobile-long-press",
    mobileDoubleTap: "pondfront:mobile-double-tap",
    fpsLimit: "pondfront:fps-limit",
    mobileMinimapSize: "pondfront:mobile-minimap-size",
  });

  const VALUE_ALIASES = Object.freeze({
    visualPreset: { simple: "low", balanced: "medium", normal: "medium" },
    effectsLevel: { none: "off", disabled: "off", normal: "medium" },
    particlesLevel: { none: "off", disabled: "off", normal: "medium" },
    visualQuality: { normal: "medium" },
    waterQuality: { normal: "medium" },
    shadowQuality: { none: "off", normal: "medium" },
    fogQuality: { none: "off", normal: "medium" },
    worldAnimationQuality: { normal: "medium" },
    fpsLimit: { unlimited: "0", "unlimited fps": "0", "30 fps": "30", "45 fps": "45", "60 fps": "60", "90 fps": "90", "120 fps": "120" },
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeString(key, value) {
    const raw = String(value ?? DEFAULTS[key]).trim().toLowerCase();
    return VALUE_ALIASES[key]?.[raw] || raw;
  }

  function sanitizeValue(key, value) {
    const fallback = DEFAULTS[key];
    if (!(key in DEFAULTS)) return undefined;
    if (typeof fallback === "boolean") {
      if (typeof value === "boolean") return value;
      if (["true", "1", "on", "yes"].includes(String(value).toLowerCase())) return true;
      if (["false", "0", "off", "no"].includes(String(value).toLowerCase())) return false;
      return fallback;
    }
    if (typeof fallback === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      if (key.endsWith("Volume")) return Math.max(0, Math.min(1, number));
      if (key === "cameraSensitivity") return Math.max(0.5, Math.min(1.5, number));
      return number;
    }
    const string = normalizeString(key, value);
    return OPTIONS[key] && !OPTIONS[key].includes(string) ? fallback : string;
  }

  function sanitize(values = {}) {
    const clean = {};
    Object.keys(DEFAULTS).forEach((key) => {
      clean[key] = sanitizeValue(key, values[key] ?? DEFAULTS[key]);
    });
    return clean;
  }

  function documentFor(values = {}) {
    return { version: VERSION, revision: REVISION, values: sanitize(values) };
  }

  function parseDocument(raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object") return documentFor();
      const source = parsed.values || parsed.settings || parsed;
      let values = sanitize(source);
      const rawPreset = normalizeString("visualPreset", source.visualPreset);
      if (parsed.revision !== REVISION && PRESETS[rawPreset]) {
        const explicit = values;
        values = valuesForPreset(rawPreset, values);
        PRESET_KEYS.forEach((key) => {
          if (key !== "strategicView" && Object.prototype.hasOwnProperty.call(source, key)) values[key] = explicit[key];
        });
      }
      return documentFor(values);
    } catch {
      return documentFor();
    }
  }

  function valuesForPreset(preset, base = DEFAULTS) {
    const id = normalizeString("visualPreset", preset);
    if (!PRESETS[id]) return sanitize({ ...base, visualPreset: "custom" });
    return sanitize({ ...base, ...PRESETS[id], visualPreset: id });
  }

  function matchingPreset(values = {}) {
    const clean = sanitize(values);
    return Object.keys(PRESETS).find((id) => PRESET_KEYS.every((key) => clean[key] === PRESETS[id][key])) || "custom";
  }

  return {
    VERSION,
    REVISION,
    STORAGE_KEY,
    CATEGORIES,
    DEFAULTS,
    OPTIONS,
    PRESETS,
    PRESET_KEYS,
    CATEGORY_KEYS,
    LEGACY_KEYS,
    clone,
    sanitize,
    sanitizeValue,
    documentFor,
    parseDocument,
    valuesForPreset,
    matchingPreset,
  };
});
