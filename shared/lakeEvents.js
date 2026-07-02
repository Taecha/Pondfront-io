(function initPondLakeEvents(root, factory) {
  const events = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = events;
  else root.PondLakeEvents = events;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeLakeEvents() {
  return {
    rainstorm: {
      label: "Rainstorm",
      color: "#83dced",
      duration: 30,
      description: "Open-water neutral expansion is cheaper.",
    },
    foggyMarsh: {
      label: "Foggy Marsh",
      color: "#b3c6cc",
      duration: 30,
      description: "Enemy strength estimates are hidden.",
    },
    lilyBloom: {
      label: "Lily Bloom",
      color: "#86d68d",
      duration: 45,
      description: "Lily pads give extra income.",
    },
    mudslide: {
      label: "Mudslide",
      color: "#c39a62",
      duration: 30,
      description: "Mud tiles become stronger defensive ground.",
    },
    migration: {
      label: "Migration",
      color: "#d8ad48",
      duration: 35,
      description: "Neutral critter camps refresh around the lake.",
    },
  };
});
