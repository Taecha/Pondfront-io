(function initPondAnimals(root, factory) {
  const animals = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = animals;
  else root.PondAnimals = animals;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeAnimals() {
  return {
    duck: {
      label: "Duck",
      icon: "D",
      color: "#d8ad48",
      dark: "#9a6f27",
      ability: "Flock Rush",
      cooldown: 45,
      duration: 10,
      perk: "For 10s, open-water expansion costs 35% less.",
    },
    snake: {
      label: "Snake",
      icon: "S",
      color: "#5fbf83",
      dark: "#2e7254",
      ability: "Ambush",
      cooldown: 50,
      duration: 15,
      perk: "Your next reed or mud attack has +40% attack power and cuts defense cost.",
    },
    frog: {
      label: "Frog",
      icon: "F",
      color: "#bc6ca2",
      dark: "#764871",
      ability: "Big Leap",
      cooldown: 55,
      duration: 0,
      perk: "Capture a nearby neutral cluster by jumping over small obstacles.",
    },
    turtle: {
      label: "Turtle",
      icon: "T",
      color: "#6fc5d8",
      dark: "#2f7280",
      ability: "Shell Guard",
      cooldown: 55,
      duration: 12,
      perk: "Borders are tougher, but neutral expansion is slightly slower.",
    },
    carp: {
      label: "Carp",
      icon: "C",
      color: "#e0bd64",
      dark: "#9b732b",
      ability: "Golden Current",
      cooldown: 50,
      duration: 10,
      perk: "Stronger water and lily income with a short economy surge.",
    },
  };
});
