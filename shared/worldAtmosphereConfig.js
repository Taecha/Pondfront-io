(function initPondWorldAtmosphere(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondWorldAtmosphere = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeWorldAtmosphereConfig() {
  const CYCLE_SECONDS = 300;
  const WEATHER_SECONDS = 84;
  const QUALITY = {
    low: { entities: 10, wildlife: 3, spawnMs: 900, rain: 12, identity: 8, buildings: 8 },
    medium: { entities: 28, wildlife: 8, spawnMs: 520, rain: 24, identity: 18, buildings: 14 },
    high: { entities: 48, wildlife: 14, spawnMs: 340, rain: 38, identity: 30, buildings: 22 },
    ultra: { entities: 70, wildlife: 20, spawnMs: 250, rain: 52, identity: 42, buildings: 30 },
  };

  const PHASES = [
    { id: "morning", label: "Morning Mist", start: 0, end: 0.16, tint: "#d8eef2", alpha: 0.055, light: 0.82 },
    { id: "day", label: "Bright Day", start: 0.16, end: 0.56, tint: "#b7edf2", alpha: 0.018, light: 1 },
    { id: "sunset", label: "Golden Sunset", start: 0.56, end: 0.73, tint: "#efaa6a", alpha: 0.075, light: 0.82 },
    { id: "night", label: "Moonlit Night", start: 0.73, end: 1, tint: "#17375d", alpha: 0.13, light: 0.66 },
  ];

  const WEATHER_SEQUENCE = [
    { id: "clear", label: "Clear Water", visual: "clear", intensity: 0 },
    { id: "wind", label: "Gentle Wind", visual: "wind", intensity: 0.45 },
    { id: "clear", label: "Clear Water", visual: "clear", intensity: 0 },
    { id: "lightRain", label: "Light Rain", visual: "rain", intensity: 0.45 },
    { id: "mist", label: "River Mist", visual: "fog", intensity: 0.32 },
  ];

  function normalizedCycle(elapsed = 0) {
    return ((Number(elapsed || 0) % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS;
  }

  function phaseAt(elapsed = 0) {
    const progress = normalizedCycle(elapsed);
    const phase = PHASES.find((entry) => progress >= entry.start && progress < entry.end) || PHASES[0];
    const phaseProgress = Math.max(0, Math.min(1, (progress - phase.start) / Math.max(0.001, phase.end - phase.start)));
    return { ...phase, progress, phaseProgress, cycleSeconds: CYCLE_SECONDS };
  }

  function ambientWeatherAt(elapsed = 0, seed = 0) {
    const slot = Math.floor(Math.max(0, Number(elapsed || 0)) / WEATHER_SECONDS);
    const offset = Math.abs(Number(seed || 0)) % WEATHER_SEQUENCE.length;
    const weather = WEATHER_SEQUENCE[(slot + offset) % WEATHER_SEQUENCE.length];
    const remaining = WEATHER_SECONDS - (Math.max(0, Number(elapsed || 0)) % WEATHER_SECONDS);
    return { ...weather, remaining, source: "ambient" };
  }

  function eventWeather(event = null) {
    if (!event) return null;
    const key = event.visual || event.type || "";
    if (key === "storm" || event.type === "rainstorm") return { id: "thunderstorm", label: "Pond Thunderstorm", visual: "storm", intensity: 0.85, source: "lakeEvent" };
    if (key === "fog" || event.type === "foggyMarsh") return { id: "fog", label: "Wetland Fog", visual: "fog", intensity: 0.72, source: "lakeEvent" };
    if (key === "flood" || key === "current" || event.type === "floodWave" || event.type === "currentShift") return { id: "wind", label: "Strong Current Wind", visual: "wind", intensity: 0.68, source: "lakeEvent" };
    return null;
  }

  function atmosphereFor(state = {}) {
    const elapsed = Number(state.elapsed || 0);
    const seed = Number(state.matchSettings?.map?.seed || state.cols * 17 + state.rows * 31 || 0);
    const active = state.lakeEvent?.active || null;
    return {
      phase: phaseAt(elapsed),
      weather: eventWeather(active) || ambientWeatherAt(elapsed, seed),
    };
  }

  return {
    CYCLE_SECONDS,
    WEATHER_SECONDS,
    QUALITY,
    PHASES,
    WEATHER_SEQUENCE,
    normalizedCycle,
    phaseAt,
    ambientWeatherAt,
    eventWeather,
    atmosphereFor,
  };
});
