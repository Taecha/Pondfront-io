(function initPondSpecialConfig(root, factory) {
  const config = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.PondSpecials = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function makePondSpecialConfig() {
  return {
    lilyBarrage: {
      id: "lilyBarrage",
      label: "Lily Barrage",
      short: "Barrage",
      role: "Long-range strike",
      target: "Enemy territory",
      cost: 120,
      cooldown: 60,
      warningSeconds: 4,
      radius: 2,
      range: 24,
      maxCaptures: 4,
      basePressure: 42,
      corePressureMultiplier: 0.35,
      defendedMultiplier: 0.58,
      turtleShellMultiplier: 0.68,
      description: "Launch magical lily seeds at enemy territory. After a warning, nearby weak tiles are heavily weakened and a few undefended tiles can be captured.",
      counterplay: "Dragonfly Guard, Reinforce, Turtle Shell Guard, Reed Guard, and spread-out borders reduce it.",
    },
    dragonflyGuard: {
      id: "dragonflyGuard",
      label: "Dragonfly Guard",
      short: "Guard",
      role: "Anti-strike defense",
      target: "Own or allied territory",
      cost: 90,
      cooldown: 50,
      duration: 20,
      radius: 4,
      range: 18,
      damageReduction: 0.5,
      currentPushMultiplier: 0.62,
      description: "Call a dragonfly swarm to protect an area from Lily Barrage and reduce Current Push impact.",
      counterplay: "Wait it out, pressure another border, or force the defender to spend energy elsewhere.",
    },
    reedShield: {
      id: "reedShield",
      label: "Reed Shield",
      short: "Shield",
      role: "Area border defense",
      target: "Own border",
      cost: 70,
      cooldown: 35,
      duration: 18,
      radius: 3,
      range: 12,
      waveCostMultiplier: 1.25,
      strikeMultiplier: 0.82,
      description: "Raise reeds around a border. Normal attack waves capture slower and Lily Barrage is slightly reduced.",
      counterplay: "Attack a different front, wait it out, or use a larger committed wave.",
    },
  };
});
