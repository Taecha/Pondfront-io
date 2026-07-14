(function initPondReleaseConfig(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondRelease = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReleaseConfig() {
  const CURRENT = Object.freeze({
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
    HISTORY: Object.freeze([CURRENT]),
    TIPS,
    CREDITS,
    VIEWED_STORAGE_KEY: "pondfront:latest-update-viewed",
    updateLabel,
  });
});
