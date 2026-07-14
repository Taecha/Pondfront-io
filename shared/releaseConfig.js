(function initPondReleaseConfig(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondRelease = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReleaseConfig() {
  const UPDATE_1 = Object.freeze({
    id: "update-1",
    label: "Update 1",
    displayName: "PondFront.io — Update 1",
    version: "1.0.0",
    title: "Full Public Release",
    date: "2026-07-14",
    new: Object.freeze([
      "Full public release presentation and Update 1 identity",
      "Permanent in-game update notes and viewed-state badge",
      "Layered pond ambience with time, weather, and map-aware variation",
      "Distinct animal selection and ability sound identities",
      "Replayable first-match introduction and guided coach hints",
      "Release loading screen with server status and rotating tips",
    ]),
    improved: Object.freeze([
      "Lobby navigation, animal comparison, and connection feedback",
      "Territory expansion, combat, building, and result audio feedback",
      "Separate audio controls for environment, animals, combat, buildings, and UI",
      "Mobile settings, update notes, tutorial access, and responsive layout",
      "Large-map rendering, bot scheduling, and world-effect performance",
      "README, local setup guidance, architecture notes, and bug-report instructions",
    ]),
    balance: Object.freeze([
      "No gameplay balance values were changed for Update 1; verified rules remain shared and server-authoritative.",
    ]),
    fixed: Object.freeze([
      "Corrected stale package and interface version metadata that still identified the game as 0.1.0.",
      "Made the Settings dialog available from the lobby as well as during matches.",
      "Added a visible tutorial replay/reset path instead of requiring storage to be cleared.",
      "Separated building audio from environment volume so the mixer label matches actual playback.",
      "Limited simultaneous and rapidly repeated sounds to prevent loud effect stacking.",
      "Exposed release version and update identity through the server health response.",
    ]),
    knownIssues: Object.freeze([
      "Google and Discord sign-in stay disabled until their server credentials and callback URLs are configured.",
      "The bundled audio is generated with Web Audio; projects wanting recorded wildlife samples must supply licensed assets.",
      "Local SQLite data persists on disk, but hosts with an ephemeral filesystem require a persistent disk or external database.",
      "Node.js 22 currently prints its standard ExperimentalWarning for the built-in SQLite API; persistence tests still pass.",
    ]),
  });

  const CURRENT = Object.freeze({
    id: "update-1-01",
    label: "Update 1.01",
    displayName: "PondFront.io - Update 1.01",
    version: "1.0.1",
    title: "Living World & Settings Rework",
    date: "2026-07-14",
    new: Object.freeze([
      "Server-authoritative sunrise, day, sunset, and night cycle",
      "One server-selected season per match: Spring, Summer, Autumn, or Winter",
      "World Status HUD with weather, next phase, and global modifier breakdowns",
      "Private and Sandbox match controls for time, season, weather, and equal world effects",
      "Settings search, category navigation, category reset, and JSON import/export",
    ]),
    improved: Object.freeze([
      "Settings now use one responsive scroller with a sticky header and action footer",
      "Desktop settings use focused category pages while mobile uses a full-screen one-column layout",
      "Settings are edited as a draft and are saved only after Apply",
      "Adaptive Quality is opt-in, temporary, and never overwrites saved visual choices",
      "Seasonal wildlife, light, weather, reflections, and ambient audio respect performance limits",
    ]),
    balance: Object.freeze([
      "Sunrise: construction and upgrade speed +4%",
      "Day: Lily Farm income +4% and economy building income +2%",
      "Sunset: animal ability recovery +4%",
      "Night: territory defense +4% and Reed Guard defense +2%",
      "Season bonuses use global caps for income, defense, expansion, construction, and cooldowns",
    ]),
    fixed: Object.freeze([
      "Fixed Settings content becoming unreachable at the bottom on short and mobile screens",
      "Removed nested Settings scrolling and footer overlap",
      "Fixed Cancel and close actions accidentally retaining uncommitted visual or audio changes",
      "Migrated scattered legacy preference keys into one versioned settings document",
      "Changed automatic low-performance mode into disabled-by-default Adaptive Quality with explicit opt-in",
      "Synchronized world phase, season, weather, and gameplay calculations from server time",
    ]),
    knownIssues: Object.freeze([
      "Google and Discord sign-in still require host-provided credentials and callback URLs.",
      "World gameplay settings are intentionally restricted to private, custom, and Sandbox matches.",
      "The generated Web Audio ambience uses synthesized pond sounds rather than licensed recordings.",
    ]),
  });

  const TIPS = Object.freeze([
    "Large attacks consume more Animal Energy.",
    "Buildings remain on a tile when that territory is captured.",
    "Each animal rewards a different terrain and playstyle.",
    "Allies cannot be attacked until the alliance ends.",
    "Save energy before starting a major border attack.",
    "Listen for animal ability sounds during battles.",
    "Reinforce a border before a committed enemy wave arrives.",
    "Lily Farms trade early energy for stronger long-term income.",
  ]);

  const CREDITS = Object.freeze([
    "Game design, code, and pond world: PondFront.io project contributors",
    "Gameplay inspiration: the broad real-time territory strategy genre, including OpenFront.io",
    "Runtime: Node.js, Canvas 2D, Web Audio, and SQLite",
    "All names, visuals, sounds, rules, and animal factions in PondFront.io are original to this project",
  ]);

  function updateLabel(major = 1, patch = 0) {
    const safeMajor = Math.max(1, Math.floor(Number(major) || 1));
    const safePatch = Math.max(0, Math.floor(Number(patch) || 0));
    return safePatch > 0 ? `Update ${safeMajor}.${String(safePatch).padStart(2, "0")}` : `Update ${safeMajor}`;
  }

  return Object.freeze({
    CURRENT,
    HISTORY: Object.freeze([CURRENT, UPDATE_1]),
    TIPS,
    CREDITS,
    VIEWED_STORAGE_KEY: "pondfront:latest-update-viewed",
    updateLabel,
  });
});
