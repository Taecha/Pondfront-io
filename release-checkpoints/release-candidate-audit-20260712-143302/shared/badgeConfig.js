(function initPondBadgeConfig(root, factory) {
  const badges = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = badges;
  else root.PondBadgeConfig = badges;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeBadgeConfig() {
  return [
    { id: "rookie", label: "Pond Rookie Badge", icon: "R", source: "Create an account or play your first match." },
    { id: "first_win", label: "First Win Badge", icon: "W", source: "Win your first match." },
    { id: "duck", label: "Duck Badge", icon: "D", source: "Win as Duck." },
    { id: "snake", label: "Snake Badge", icon: "S", source: "Win as Snake." },
    { id: "frog", label: "Frog Badge", icon: "F", source: "Win as Frog." },
    { id: "turtle", label: "Turtle Badge", icon: "T", source: "Win as Turtle." },
    { id: "carp", label: "Carp Badge", icon: "C", source: "Win as Carp." },
    { id: "builder", label: "Builder Badge", icon: "B", source: "Build 10 buildings." },
    { id: "warrior", label: "Warrior Badge", icon: "A", source: "Capture a big attack wave." },
    { id: "defender", label: "Defender Badge", icon: "G", source: "Hold strong defended borders." },
    { id: "objective", label: "Objective Badge", icon: "O", source: "Capture lake objectives." },
    { id: "emperor", label: "Lake Emperor Badge", icon: "E", source: "Win 10 matches." },
  ];
});
