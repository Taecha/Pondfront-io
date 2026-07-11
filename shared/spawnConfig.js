(function initSpawnConfig(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondSpawnConfig = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSpawnConfig() {
  const PHASES = Object.freeze({
    LOBBY: "LOBBY",
    SPAWN_SELECTION: "SPAWN_SELECTION",
    COUNTDOWN: "COUNTDOWN",
    PLAYING: "PLAYING",
    ENDED: "ENDED",
  });

  const TIMER_OPTIONS = Object.freeze([10, 20, 30, 45, 60, 90, 0]);
  const TEAM_SPAWN_STYLES = Object.freeze(["together", "nearby", "spread", "free"]);
  const ENEMY_SPAWN_VISIBILITY = Object.freeze(["visible", "teamOnly", "hidden"]);

  function sanitizeSeconds(value, fallback = 30, allowUnlimited = false) {
    const seconds = Number(value);
    if (seconds === 0 && allowUnlimited) return 0;
    return TIMER_OPTIONS.includes(seconds) && seconds > 0 ? seconds : fallback;
  }

  function defaultSeconds(settings = {}) {
    if (["amazon", "mekong", "everglades", "nile", "huge"].includes(settings.mapSize)) return 45;
    if (settings.teamMode === "coop" || settings.teamMode === "teamBattle" || settings.gameMode === "coop" || settings.gameMode === "teamBattle") return 30;
    return 20;
  }

  function phaseLabel(phase) {
    if (phase === PHASES.SPAWN_SELECTION) return "Choose Your Starting Nest";
    if (phase === PHASES.COUNTDOWN) return "The Pond Opens Soon";
    if (phase === PHASES.PLAYING) return "Match In Progress";
    if (phase === PHASES.ENDED) return "Match Ended";
    return "Waiting in the Lobby";
  }

  function sanitizeVisibility(value, fallback = "visible") {
    const normalized = String(value || "").trim();
    return ENEMY_SPAWN_VISIBILITY.includes(normalized) ? normalized : fallback;
  }

  return Object.freeze({
    PHASES,
    TIMER_OPTIONS,
    TEAM_SPAWN_STYLES,
    ENEMY_SPAWN_VISIBILITY,
    START_RADIUS: 2,
    EXTRA_TERRITORY_RADIUS: 3,
    FINAL_COUNTDOWN_SECONDS: 5,
    MIN_NEARBY_TILES: 16,
    MIN_EXPANSION_DIRECTIONS: 2,
    RECONNECT_RESERVATION_SECONDS: 18,
    sanitizeSeconds,
    defaultSeconds,
    phaseLabel,
    sanitizeVisibility,
  });
});
