(function initPondSettingsConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondSettingsConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeSettingsConfig() {
  const VERSION = 2;
  const STORAGE_KEY = "pondfront:settings:v2";
  const CATEGORIES = ["gameplay", "controls", "graphics", "effects", "audio", "camera", "accessibility", "world", "performance", "account"];

  const DEFAULTS = Object.freeze({
    strategicView: true,
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
    visualPreset: "balanced",
    uiScale: "compact",
    colorVisionMode: "standard",
    visualQuality: "medium",
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
    waterReflections: true,
    decorativeAnimals: true,
    ambientWorldSounds: true,
    worldStatusHud: true,
    showWorldModifiers: true,
    reducedWorldAnimation: false,
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
    visualPreset: ["simple", "balanced", "high", "ultra"],
    uiScale: ["tiny", "compact", "normal", "large"],
    colorVisionMode: ["standard", "deuteranopia", "protanopia", "tritanopia"],
    visualQuality: ["low", "medium", "high", "ultra"],
    effectsLevel: ["low", "medium", "high", "ultra"],
    particlesLevel: ["low", "medium", "high", "ultra"],
    audioQuality: ["low", "standard", "high"],
    timeTransitionQuality: ["instant", "smooth", "cinematic"],
    fpsLimit: ["30", "60", "120"],
    mobileMinimapSize: ["small", "medium", "large"],
  });

  const PRESETS = Object.freeze({
    simple: { visualQuality: "low", effectsLevel: "low", particlesLevel: "low", mapDecorations: false, livingWorld: false, cameraEffects: false, floatingText: false, showAnimalAnimations: false, screenShake: false, waterReflections: false, fogEffects: false, seasonalDecorations: false },
    balanced: { visualQuality: "medium", effectsLevel: "medium", particlesLevel: "medium", mapDecorations: true, livingWorld: true, cameraEffects: true, floatingText: true, showAnimalAnimations: true, screenShake: true, waterReflections: true, fogEffects: true, seasonalDecorations: true },
    high: { visualQuality: "high", effectsLevel: "high", particlesLevel: "high", mapDecorations: true, livingWorld: true, cameraEffects: true, floatingText: true, showAnimalAnimations: true, screenShake: true, waterReflections: true, fogEffects: true, seasonalDecorations: true },
    ultra: { visualQuality: "ultra", effectsLevel: "ultra", particlesLevel: "ultra", mapDecorations: true, livingWorld: true, cameraEffects: true, floatingText: true, showAnimalAnimations: true, screenShake: true, waterReflections: true, fogEffects: true, seasonalDecorations: true },
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeValue(key, value) {
    const fallback = DEFAULTS[key];
    if (!(key in DEFAULTS)) return undefined;
    if (typeof fallback === "boolean") return typeof value === "boolean" ? value : fallback;
    if (typeof fallback === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      if (key.endsWith("Volume")) return Math.max(0, Math.min(1, number));
      if (key === "cameraSensitivity") return Math.max(0.5, Math.min(1.5, number));
      return number;
    }
    const string = String(value ?? fallback);
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
    return { version: VERSION, values: sanitize(values) };
  }

  function parseDocument(raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object") return documentFor();
      return documentFor(parsed.values || parsed);
    } catch {
      return documentFor();
    }
  }

  return {
    VERSION,
    STORAGE_KEY,
    CATEGORIES,
    DEFAULTS,
    OPTIONS,
    PRESETS,
    LEGACY_KEYS,
    clone,
    sanitize,
    sanitizeValue,
    documentFor,
    parseDocument,
  };
});
