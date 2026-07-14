(function initPondWorldAtmosphere(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondWorldAtmosphere = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeWorldAtmosphereConfig() {
  const DEFAULT_CYCLE_SECONDS = 20 * 60;
  const MIN_CYCLE_SECONDS = 16 * 60;
  const MAX_CYCLE_SECONDS = 24 * 60;
  const WEATHER_SECONDS = 108;
  const CAPS = Object.freeze({ income: 0.15, defense: 0.15, expansionDiscount: 0.1, construction: 0.15, cooldown: 0.1 });
  const QUALITY = {
    low: { entities: 8, wildlife: 2, spawnMs: 1050, rain: 8, identity: 7, buildings: 7 },
    medium: { entities: 24, wildlife: 7, spawnMs: 600, rain: 20, identity: 16, buildings: 13 },
    high: { entities: 42, wildlife: 12, spawnMs: 390, rain: 32, identity: 27, buildings: 20 },
    ultra: { entities: 62, wildlife: 18, spawnMs: 280, rain: 44, identity: 38, buildings: 27 },
  };

  const PHASES = [
    { id: "sunrise", label: "Sunrise", start: 0, end: 0.18, tint: "#d7eef0", alpha: 0.055, light: 0.84, icon: "SR", message: "Morning light reaches the pond." },
    { id: "day", label: "Day", start: 0.18, end: 0.57, tint: "#b7edf2", alpha: 0.018, light: 1, icon: "D", message: "The pond is bright and productive." },
    { id: "sunset", label: "Sunset", start: 0.57, end: 0.75, tint: "#eead72", alpha: 0.072, light: 0.83, icon: "SS", message: "Golden light settles over the lake." },
    { id: "night", label: "Night", start: 0.75, end: 1, tint: "#17375d", alpha: 0.13, light: 0.67, icon: "N", message: "Moonlight strengthens sheltered borders." },
  ];

  const SEASONS = Object.freeze({
    spring: { id: "spring", label: "Spring", icon: "SP", tint: "#b9e7c2", message: "New lilies and reeds are flourishing." },
    summer: { id: "summer", label: "Summer", icon: "SU", tint: "#dbe99a", message: "Warm currents restore Animal Energy." },
    autumn: { id: "autumn", label: "Autumn", icon: "AU", tint: "#e4ba7a", message: "Falling leaves guide quick expansion." },
    winter: { id: "winter", label: "Winter", icon: "WI", tint: "#c9e3ea", message: "Cool water favors careful defense." },
  });

  const WEATHER_SEQUENCE = [
    { id: "clear", label: "Clear Water", visual: "clear", intensity: 0 },
    { id: "wind", label: "Gentle Wind", visual: "wind", intensity: 0.42 },
    { id: "clear", label: "Clear Water", visual: "clear", intensity: 0 },
    { id: "lightRain", label: "Light Rain", visual: "rain", intensity: 0.42 },
    { id: "mist", label: "River Mist", visual: "fog", intensity: 0.3 },
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function hashSeed(value) {
    const string = String(value || "pond");
    let hash = 2166136261;
    for (let index = 0; index < string.length; index += 1) hash = Math.imul(hash ^ string.charCodeAt(index), 16777619);
    return Math.abs(hash >>> 0);
  }

  function sanitizeWorldSettings(input = {}, context = {}) {
    const customAllowed = Boolean(context.privateMatch || context.customMatch || context.sandbox);
    const phaseMode = customAllowed && ["cycle", "sunrise", "day", "sunset", "night"].includes(input.phaseMode) ? input.phaseMode : "cycle";
    const seasonMode = customAllowed && ["random", ...Object.keys(SEASONS)].includes(input.seasonMode) ? input.seasonMode : "random";
    const requestedCycle = Number(input.cycleSeconds || DEFAULT_CYCLE_SECONDS);
    return {
      cycleSeconds: customAllowed ? Math.round(clamp(requestedCycle, MIN_CYCLE_SECONDS, MAX_CYCLE_SECONDS)) : DEFAULT_CYCLE_SECONDS,
      phaseMode,
      seasonMode,
      gameplayImpacts: input.gameplayImpacts !== false,
      weatherFrequency: customAllowed && ["off", "low", "normal", "high"].includes(input.weatherFrequency) ? input.weatherFrequency : "normal",
    };
  }

  function createMatchWorld(settings = {}, seed = 0) {
    const clean = sanitizeWorldSettings(settings, { privateMatch: true, customMatch: true, sandbox: true });
    const hash = hashSeed(seed);
    const seasons = Object.keys(SEASONS);
    return {
      ...clean,
      seed: hash,
      seasonId: clean.seasonMode === "random" ? seasons[hash % seasons.length] : clean.seasonMode,
      startOffset: clean.phaseMode === "cycle" ? hash % Math.max(1, clean.cycleSeconds) : 0,
    };
  }

  function normalizedCycle(elapsed = 0, world = {}) {
    const seconds = clamp(world.cycleSeconds || DEFAULT_CYCLE_SECONDS, MIN_CYCLE_SECONDS, MAX_CYCLE_SECONDS);
    const offset = Number(world.startOffset || 0);
    return (((Number(elapsed || 0) + offset) % seconds) + seconds) % seconds / seconds;
  }

  function phaseAt(elapsed = 0, world = {}) {
    const seconds = clamp(world.cycleSeconds || DEFAULT_CYCLE_SECONDS, MIN_CYCLE_SECONDS, MAX_CYCLE_SECONDS);
    const fixed = PHASES.find((entry) => entry.id === world.phaseMode);
    if (fixed) return { ...fixed, progress: fixed.start, phaseProgress: 0.5, cycleSeconds: seconds, remaining: Infinity, nextId: fixed.id, nextLabel: fixed.label };
    const progress = normalizedCycle(elapsed, world);
    const index = Math.max(0, PHASES.findIndex((entry) => progress >= entry.start && progress < entry.end));
    const phase = PHASES[index] || PHASES[0];
    const next = PHASES[(index + 1) % PHASES.length];
    const phaseProgress = clamp((progress - phase.start) / Math.max(0.001, phase.end - phase.start), 0, 1);
    return { ...phase, progress, phaseProgress, cycleSeconds: seconds, remaining: Math.max(0, (phase.end - progress) * seconds), nextId: next.id, nextLabel: next.label };
  }

  function weatherSlotSeconds(world = {}) {
    const multipliers = { off: Infinity, low: 1.6, normal: 1, high: 0.68 };
    return WEATHER_SECONDS * (multipliers[world.weatherFrequency] || 1);
  }

  function ambientWeatherAt(elapsed = 0, seed = 0, world = {}) {
    const seconds = weatherSlotSeconds(world);
    if (!Number.isFinite(seconds)) return { ...WEATHER_SEQUENCE[0], remaining: Infinity, source: "ambient" };
    const slot = Math.floor(Math.max(0, Number(elapsed || 0)) / seconds);
    const offset = hashSeed(seed) % WEATHER_SEQUENCE.length;
    const weather = WEATHER_SEQUENCE[(slot + offset) % WEATHER_SEQUENCE.length];
    return { ...weather, remaining: seconds - (Math.max(0, Number(elapsed || 0)) % seconds), source: "ambient" };
  }

  function eventWeather(event = null) {
    if (!event) return null;
    const key = event.visual || event.type || "";
    if (key === "storm" || event.type === "rainstorm") return { id: "thunderstorm", label: "Pond Thunderstorm", visual: "storm", intensity: 0.85, source: "lakeEvent" };
    if (key === "fog" || event.type === "foggyMarsh") return { id: "fog", label: "Wetland Fog", visual: "fog", intensity: 0.72, source: "lakeEvent" };
    if (key === "flood" || key === "current" || event.type === "floodWave" || event.type === "currentShift") return { id: "wind", label: "Strong Current Wind", visual: "wind", intensity: 0.68, source: "lakeEvent" };
    return null;
  }

  function modifiersFor(phaseId, seasonId, enabled = true) {
    const raw = {
      baseEnergyRegen: 0,
      farmIncome: 0,
      economyBuildingIncome: 0,
      constructionSpeed: 0,
      upgradeSpeed: 0,
      abilityRecovery: 0,
      abilityCostDiscount: 0,
      territoryDefense: 0,
      reedGuardDefense: 0,
      expansionDiscount: 0,
      expansionSpeed: 0,
    };
    const breakdown = [];
    if (!enabled) return { ...raw, breakdown, enabled: false };
    if (phaseId === "sunrise") { raw.constructionSpeed += 0.04; raw.upgradeSpeed += 0.04; breakdown.push({ source: "Sunrise", label: "Construction and upgrades", value: 0.04 }); }
    if (phaseId === "day") { raw.farmIncome += 0.04; raw.economyBuildingIncome += 0.02; breakdown.push({ source: "Day", label: "Lily Farm income", value: 0.04 }, { source: "Day", label: "Economy building income", value: 0.02 }); }
    if (phaseId === "sunset") { raw.abilityRecovery += 0.04; breakdown.push({ source: "Sunset", label: "Ability recovery", value: 0.04 }); }
    if (phaseId === "night") { raw.territoryDefense += 0.04; raw.reedGuardDefense += 0.02; breakdown.push({ source: "Night", label: "Territory defense", value: 0.04 }, { source: "Night", label: "Reed Guard defense", value: 0.02 }); }
    if (seasonId === "spring") { raw.farmIncome += 0.05; raw.constructionSpeed += 0.03; raw.upgradeSpeed += 0.03; breakdown.push({ source: "Spring", label: "Lily Farm income", value: 0.05 }, { source: "Spring", label: "Construction speed", value: 0.03 }); }
    if (seasonId === "summer") { raw.baseEnergyRegen += 0.05; raw.abilityCostDiscount += 0.02; breakdown.push({ source: "Summer", label: "Base energy regeneration", value: 0.05 }, { source: "Summer", label: "Ability energy cost", value: -0.02 }); }
    if (seasonId === "autumn") { raw.expansionDiscount += 0.04; raw.expansionSpeed += 0.02; breakdown.push({ source: "Autumn", label: "Expansion cost", value: -0.04 }, { source: "Autumn", label: "Expansion speed", value: 0.02 }); }
    if (seasonId === "winter") { raw.territoryDefense += 0.05; raw.farmIncome -= 0.03; breakdown.push({ source: "Winter", label: "Territory defense", value: 0.05 }, { source: "Winter", label: "Lily Farm income", value: -0.03 }); }
    raw.baseEnergyRegen = clamp(raw.baseEnergyRegen, -CAPS.income, CAPS.income);
    raw.farmIncome = clamp(raw.farmIncome, -CAPS.income, CAPS.income);
    raw.economyBuildingIncome = clamp(raw.economyBuildingIncome, -CAPS.income, CAPS.income);
    raw.territoryDefense = clamp(raw.territoryDefense, 0, CAPS.defense);
    raw.reedGuardDefense = clamp(raw.reedGuardDefense, 0, CAPS.defense);
    raw.expansionDiscount = clamp(raw.expansionDiscount, 0, CAPS.expansionDiscount);
    raw.constructionSpeed = clamp(raw.constructionSpeed, 0, CAPS.construction);
    raw.upgradeSpeed = clamp(raw.upgradeSpeed, 0, CAPS.construction);
    raw.abilityRecovery = clamp(raw.abilityRecovery, 0, CAPS.cooldown);
    raw.abilityCostDiscount = clamp(raw.abilityCostDiscount, 0, CAPS.cooldown);
    return { ...raw, breakdown, enabled: true };
  }

  function snapshotFor({ elapsed = 0, serverTime = 0, world = {}, lakeEvent = null } = {}) {
    const phase = phaseAt(elapsed, world);
    const season = SEASONS[world.seasonId] || SEASONS.spring;
    return {
      serverTime,
      elapsed,
      cycleSeconds: world.cycleSeconds || DEFAULT_CYCLE_SECONDS,
      phase,
      season,
      weather: eventWeather(lakeEvent?.active || lakeEvent) || ambientWeatherAt(elapsed, world.seed || 0, world),
      modifiers: modifiersFor(phase.id, season.id, world.gameplayImpacts !== false),
      config: { phaseMode: world.phaseMode || "cycle", seasonMode: world.seasonMode || "random", gameplayImpacts: world.gameplayImpacts !== false, weatherFrequency: world.weatherFrequency || "normal" },
    };
  }

  function atmosphereFor(state = {}) {
    const synced = state.worldState;
    if (synced?.phase && synced?.season) {
      const estimatedNow = Number(state.estimatedServerTime || state.serverTime || synced.serverTime || 0);
      const elapsed = Number(synced.elapsed || 0) + Math.max(0, estimatedNow - Number(synced.serverTime || estimatedNow));
      const phase = synced.config?.phaseMode && synced.config.phaseMode !== "cycle" ? synced.phase : phaseAt(elapsed, { ...synced.config, cycleSeconds: synced.cycleSeconds, startOffset: synced.phase.progress * synced.cycleSeconds - synced.elapsed });
      return { phase, season: synced.season, weather: eventWeather(state.lakeEvent?.active) || synced.weather, modifiers: synced.modifiers };
    }
    const elapsed = Number(state.elapsed || 0);
    const seed = Number(state.matchSettings?.map?.seed || state.cols * 17 + state.rows * 31 || 0);
    const world = createMatchWorld(state.matchSettings?.world || {}, seed);
    return snapshotFor({ elapsed, serverTime: state.serverTime || 0, world, lakeEvent: state.lakeEvent });
  }

  return {
    CYCLE_SECONDS: DEFAULT_CYCLE_SECONDS,
    DEFAULT_CYCLE_SECONDS,
    MIN_CYCLE_SECONDS,
    MAX_CYCLE_SECONDS,
    WEATHER_SECONDS,
    CAPS,
    QUALITY,
    PHASES,
    SEASONS,
    WEATHER_SEQUENCE,
    sanitizeWorldSettings,
    createMatchWorld,
    normalizedCycle,
    phaseAt,
    ambientWeatherAt,
    eventWeather,
    modifiersFor,
    snapshotFor,
    atmosphereFor,
  };
});
