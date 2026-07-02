(function initPondInfo(root) {
  const TIPS = {
    energy:
      "Animal Energy is used to expand, attack, defend, build, and use abilities. Bigger territory gives more max energy and income.",
    territory: "Your controlled lake area. More territory increases income and max Animal Energy.",
    income: "How much Animal Energy you gain per second.",
    attack: "Send energy from your border into enemy land. Stronger attacks can push deeper through the front line.",
    expand: "Capture neutral pond tiles from your connected border. Ducks are especially efficient on open water.",
    defend: "Reinforces your border and makes enemy attacks cost more energy.",
    build: "Build compact economy or defense upgrades on your territory. Buildings stay clean and only show clearly when useful.",
    ability: "Use your animal ability when it is ready. Each animal has a different timing window and role.",
    diplomacy: "Alliances prevent friendly attacks. Allies can signal each other and can be broken later.",
    wave: "Attacks move as a wave from connected borders. Defense, terrain, and enemy energy can stop the wave.",
    alliances: "Allied players cannot attack each other and can share useful map signals.",
    bots: "Bot animals expand, build, ally, and attack based on their difficulty and nearby threats.",
    win: "Control 70% of the playable lake to win. If time runs out, highest territory wins.",
    water: "Open Water is normal terrain. Ducks expand through it faster.",
    lily: "Lily Pad gives bonus income, especially useful for Frogs.",
    reeds: "Reeds are defensive terrain. Snakes get stronger here.",
    mud: "Mud Island is slower to capture but strong for holding borders.",
    rock: "Rock blocks movement and cannot be captured.",
    nestZone: "Nest Zone is a strong place to build energy-focused structures.",
    nest: "Nest increases your maximum Animal Energy.",
    lilyFarm: "Lily Farm adds a clear income boost, usually +2 Animal Energy per second or more on lily pads.",
    reedGuard: "Reed Guard strengthens nearby border defense.",
    mudTunnel: "Mud Tunnel is Snake-only and improves reed/mud mobility.",
    jumpPad: "Jump Pad is Frog-only and improves jump expansion range.",
    duckAbility: "Flock Rush: For 10s, open-water expansion costs 35% less.",
    snakeAbility: "Ambush: Your next attack from reeds or mud has +40% attack power and cuts enemy border cost by 20%.",
    frogAbility: "Big Leap: Capture up to 5 nearby neutral tiles by jumping over small obstacles.",
  };

  const TERRAIN_TIPS = {
    water: TIPS.water,
    lily: TIPS.lily,
    reeds: TIPS.reeds,
    mud: TIPS.mud,
    rock: TIPS.rock,
    nest: TIPS.nestZone,
  };

  const BUILDING_TIPS = {
    nest: TIPS.nest,
    lilyFarm: TIPS.lilyFarm,
    reedGuard: TIPS.reedGuard,
    mudTunnel: TIPS.mudTunnel,
    jumpPad: TIPS.jumpPad,
  };

  const PING_LABELS = {
    attack: "Attack Here",
    defend: "Defend Here",
    weak: "Enemy Weak",
    danger: "Danger",
    help: "Help",
    peace: "Peace",
    good: "Good Job",
    warning: "Warning",
  };

  function tileSummary(state, tile, context = {}) {
    if (!tile) {
      return {
        title: "No tile selected",
        detail: "Click a glowing border or right-click a tile for quick actions.",
        ownerText: "Neutral",
        defenseText: "Def 0",
        facts: [],
        warning: "",
      };
    }

    const type = state.config.tileTypes[tile.type];
    const owner = state.players.find((player) => player.id === tile.owner);
    const human = state.players.find((player) => player.id === state.humanId);
    const ownerText = owner ? (owner.id === state.humanId ? "Your territory" : owner.name) : type.blocks ? "Blocked" : "Neutral";
    const defenseTotal = Math.round((tile.defenseEnergy || 0) + (type.defenseBonus || 0));
    const facts = [
      { label: "Terrain", value: type.label },
      { label: "Owner", value: ownerText },
      { label: "Defense", value: defenseLabel(defenseTotal, type.blocks) },
      { label: "Income", value: `+${Number(type.incomeBonus || 0).toFixed(2)}/s` },
    ];

    if (tile.building) {
      const building = state.config.buildings[tile.building];
      const level = tile.buildingLevel || 1;
      facts.push({ label: "Building", value: `${building?.label || tile.building} L${level}` });
      const activeLeft = Math.max(0, Math.ceil((tile.buildingActiveAt || 0) - state.serverTime));
      if (activeLeft > 0) facts.push({ label: "Active In", value: `${activeLeft}s` });
    }

    if (!tile.owner && !type.blocks && human) {
      const cost =
        context.expansionCost ||
        root.PondConfig?.getNeutralTileExpansionCost?.(tile.type, human.animal, {
          jumped: Boolean(context.jumped),
          flockRush: Boolean(context.flockRush),
        }) ||
        type.captureCost;
      const progress = Number(tile.captureProgress?.[human.id] || 0);
      facts.push({ label: "Capture", value: `${Math.round(progress)}/${cost}` });
      if (progress > 0) facts.push({ label: "Remaining", value: `${Math.max(0, Math.round(cost - progress))}` });
    }

    if (context.canExpand) facts.push({ label: "Action", value: "Expandable border" });
    if (context.canAttack) facts.push({ label: "Action", value: "Attackable border" });
    if (context.canDefend) facts.push({ label: "Action", value: "Defendable border" });
    if (context.estimateText) facts.push({ label: "Estimate", value: context.estimateText });

    let title = type.label;
    let detail = TERRAIN_TIPS[tile.type] || "Pond terrain.";
    let warning = context.warning || "";

    if (context.kind === "attackBorder") {
      title = "Attackable Border";
      detail = `Send ${context.percent}% energy. Estimated capture: ${context.tiles} tiles.`;
    } else if (context.kind === "blockedAttack") {
      title = owner ? "Enemy Territory" : type.label;
      detail = context.reason || detail;
      warning = context.reason || warning;
    } else if (context.canExpand) {
      title = "Expansion Target";
      const progressText =
        context.expansionProgress > 0 ? ` Progress ${Math.round(context.expansionProgress)}/${context.expansionCost}.` : "";
      detail = `Use Animal Energy to capture this ${type.label.toLowerCase()} from your border.${progressText}`;
    } else if (type.blocks) {
      title = "Blocked Terrain";
      detail = TIPS.rock;
      warning = "Blocked by terrain";
    }

    if (owner?.id === state.humanId && human?.incomeBreakdown) {
      facts.push(...incomeFacts(human).slice(0, 5));
    }

    return {
      title,
      detail,
      ownerText,
      defenseText: type.blocks ? "Blocked" : `Def ${defenseTotal}`,
      facts,
      warning,
    };
  }

  function playerSummary(state, playerId) {
    const player = state.players.find((candidate) => candidate.id === playerId);
    const human = state.players.find((candidate) => candidate.id === state.humanId);
    if (!player || player.id === state.humanId || !human) return null;

    const animal = state.config.animals[player.animal];
    const relation = human.allies.includes(player.id) ? "Alliance" : human.enemies.includes(player.id) ? "Marked enemy" : "Neutral";
    const strength = strengthLabel(player.energy, player.maxEnergy);
    const suggested = human.allies.includes(player.id)
      ? "Coordinate with signals"
      : player.energy < human.energy * 0.72
        ? "Attack if connected"
        : player.energy > human.energy * 1.25
          ? "Defend before attacking"
          : "Scout the border first";

    return {
      title: `${animal.icon} ${player.name}`,
      meta: `${animal.label} | ${Math.round(player.territoryPct * 100)}% territory | ${player.energy} energy | ${relation}`,
      facts: [
        { label: "Animal", value: animal.label },
        { label: "Ability", value: animal.ability },
        { label: "Strength", value: strength },
        { label: "Income", value: `+${player.income}/s` },
        { label: "Alliance", value: relation },
        { label: "Suggested", value: suggested },
      ],
    };
  }

  function incomeFacts(player) {
    const breakdown = player?.incomeBreakdown;
    if (!breakdown) return [];
    return [
      { label: "Base", value: `+${breakdown.base || 0}` },
      { label: "Territory", value: `+${breakdown.territory || 0}` },
      { label: "Terrain", value: `+${breakdown.terrain || 0}` },
      { label: "Buildings", value: `+${breakdown.buildings || 0}` },
      { label: "Animal", value: `+${breakdown.animal || 0}` },
      { label: "Recovery", value: `+${breakdown.recovery || 0}` },
      { label: "Total", value: `+${breakdown.total || player.income}/s` },
    ];
  }

  function terrainText(tileType) {
    return TERRAIN_TIPS[tileType] || "Pond terrain.";
  }

  function buildingText(buildingType) {
    return BUILDING_TIPS[buildingType] || "Building improves your pond strategy.";
  }

  function abilityTip(animalId) {
    if (animalId === "snake") return TIPS.snakeAbility;
    if (animalId === "frog") return TIPS.frogAbility;
    return TIPS.duckAbility;
  }

  function defenseLabel(value, blocked) {
    if (blocked) return "Blocked";
    if (value >= 24) return "Very high";
    if (value >= 12) return "High";
    if (value >= 5) return "Medium";
    return "Low";
  }

  function strengthLabel(energy, maxEnergy) {
    const ratio = maxEnergy ? energy / maxEnergy : 0;
    if (ratio >= 0.78) return "Very strong";
    if (ratio >= 0.52) return "Strong";
    if (ratio >= 0.28) return "Medium";
    return "Weak";
  }

  root.PondInfo = {
    TIPS,
    PING_LABELS,
    tileSummary,
    playerSummary,
    incomeFacts,
    terrainText,
    buildingText,
    abilityTip,
    defenseLabel,
    strengthLabel,
  };
})(window);
