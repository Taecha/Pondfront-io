(function initPondInfo(root) {
  const TIPS = {
    energy:
      "Animal Energy is used to expand, attack, defend, build, and use abilities. Bigger territory gives more max energy and income.",
    territory: "Your controlled lake area. More territory increases income and max Animal Energy.",
    income: "How much Animal Energy you gain per second.",
    attack:
      "Border Attack has no cooldown. It spends Animal Energy immediately, then the wave pushes until the sent energy is spent.",
    currentPush: "Current Push is a special long-range water route attack with cooldown. It travels over time, warns the defender, and can be reinforced against.",
    expand: "Capture neutral pond tiles from your connected border. Ducks are especially efficient on open water.",
    defend: "Reinforces your border and makes enemy attacks cost more energy.",
    build: "Build compact economy or defense upgrades on your territory. Construction takes time on the tile, and repeated building types cost more.",
    ability: "Use your animal ability when it is ready. Each animal has a different timing window and role.",
    special:
      "Open pond specials. Lily Barrage weakens enemy clusters after a warning, Dragonfly Guard protects an area, and Reed Shield strengthens your border.",
    diplomacy: "Alliances prevent friendly attacks. Truces block combat temporarily, and breaking alliances creates betrayal cooldown.",
    wave:
      "Attacks are committed waves from connected borders. They capture connected tiles over time, weaken what they cannot capture, then stop automatically when spent.",
    alliances: "Allied players cannot attack each other and can share useful map signals.",
    bots: "Bot animals expand, build, ally, and attack based on their difficulty and nearby threats.",
    win: "The timer shows elapsed time. Normal matches end by elimination: keep your Core Nest and territory alive until only one animal or team remains.",
    water: "Open Water is normal terrain. Ducks expand through it faster.",
    lily: "Lily Pad gives bonus income, especially useful for Frogs.",
    reeds: "Reeds are defensive terrain. Snakes get stronger here.",
    mud: "Mud Island is slower to capture but strong for holding borders.",
    rock: "Rock blocks movement and cannot be captured.",
    nestZone: "Nest Zone is a strong place to build energy-focused structures.",
    nest: "Nest increases your maximum Animal Energy.",
    lilyFarm: "Lily Farm increases income per second. Each extra Lily Farm costs more, and too many farms become less efficient.",
    reedGuard: "Reed Guard strengthens nearby border defense.",
    mudTunnel: "Mud Tunnel is Snake-only and improves reed/mud mobility.",
    jumpPad: "Jump Pad is Frog-only and improves jump expansion range.",
    duckAbility: "Flock Rush: For 10s, open-water expansion costs 35% less.",
    snakeAbility: "Ambush: Your next attack from reeds or mud hits much harder and cuts enemy border cost, great against reinforced fronts.",
    frogAbility: "Big Leap: Capture up to 5 nearby neutral tiles by jumping over small obstacles.",
    turtleAbility: "Shell Guard: Turtle borders become harder for enemy waves to capture for 12s, but repeated attacks still build pressure.",
    carpAbility: "Golden Current: Carp gains bonus income and cheaper water/lily expansion for 10s.",
    turtleAnimal:
      "Turtle is a defensive animal. It expands slower, but its borders are harder to capture. Shell Guard temporarily makes enemy attacks much weaker.",
    carpAnimal:
      "Carp is an economy animal. It gains stronger income from water and lily pads. Golden Current boosts income and water expansion for a short time.",
    objectives: "Lake objectives turn on after the early game and give powerful map-wide bonuses while controlled.",
    critterCamp: "Neutral critter camps are optional fights that give temporary defense, attack, income, or scouting bonuses.",
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
    help: "Help Me",
    peace: "Peace",
    strong: "Enemy Strong",
    objective: "Capture Objective",
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
    const borderTools = root.PondBorderStatus;
    const status = context.status || null;
    const objective = state.objectives?.find((entry) => entry.tileId === tile.id);
    const camp = state.camps?.find((entry) => entry.tileId === tile.id);
    const ownerText = owner ? (owner.id === state.humanId ? "Your territory" : owner.name) : type.blocks ? "Blocked" : "Neutral";
    const defenseTotal = Math.round((tile.defenseEnergy || 0) + (type.defenseBonus || 0));
    const facts = [
      { label: "Terrain", value: type.label },
      { label: "Owner", value: ownerText },
      { label: "Defense", value: borderTools?.defenseLevel?.(defenseTotal) || defenseLabel(defenseTotal, type.blocks) },
      { label: "Income", value: `+${Number(type.incomeBonus || 0).toFixed(2)}/s` },
    ];

    if (status?.label) facts.push({ label: "Border", value: status.label });

    if (tile.building) {
      const building = state.config.buildings[tile.building];
      const level = tile.buildingLevel || 1;
      facts.push({ label: "Building", value: `${building?.label || tile.building} L${level}` });
      const activeLeft = Math.max(0, Math.ceil((tile.buildingActiveAt || 0) - state.serverTime));
      if (activeLeft > 0) facts.push({ label: "Construction", value: `${activeLeft}s` });
    }

    if (objective) {
      const def = objective.definition || state.config.objectives?.LAKE_OBJECTIVES?.[objective.type] || {};
      facts.push({ label: "Objective", value: def.label || objective.type });
      facts.push({ label: "Status", value: objective.active ? "Active" : `Appears ${Math.ceil(Math.max(0, objective.activeAt - state.serverTime))}s` });
    }

    if (camp) {
      const def = camp.definition || state.config.objectives?.CRITTER_CAMPS?.[camp.type] || {};
      facts.push({ label: "Camp", value: def.label || camp.type });
      facts.push({ label: "Reward", value: def.effect || "bonus" });
    }

    if (!tile.owner && !type.blocks && human) {
      const cost =
        context.expansionCost ||
        root.PondConfig?.getNeutralTileExpansionCost?.(tile.type, human.animal, {
          jumped: Boolean(context.jumped),
          flockRush: Boolean(context.flockRush),
          goldenCurrent: Boolean(context.goldenCurrent),
        }) ||
        type.captureCost;
      const progress = Number(tile.captureProgress?.[human.id] || 0);
      facts.push({ label: "Capture", value: `${Math.round(progress)}/${cost}` });
      if (progress > 0) facts.push({ label: "Remaining", value: `${Math.max(0, Math.round(cost - progress))}` });
      if (context.sendEnergy != null) facts.push({ label: "Send", value: String(context.sendEnergy) });
      if (context.resultText) facts.push({ label: "Result", value: context.resultText });
    }

    if (context.canExpand) facts.push({ label: "Action", value: "Expandable border" });
    if (context.canAttack) facts.push({ label: "Action", value: "Attackable border" });
    if (context.canDefend) facts.push({ label: "Action", value: "Defendable border" });
    if (context.canUpgradeBuilding) facts.push({ label: "Upgrade", value: "Available" });
    if (context.estimateText) facts.push({ label: "Estimate", value: context.estimateText });
    if (context.kind === "attackBorder") {
      if (context.recommendedAction) facts.push({ label: "Recommended", value: context.recommendedAction });
      if (context.recommendedReason) facts.push({ label: "Reason", value: context.recommendedReason });
      facts.push({ label: "Send", value: String(context.sendEnergy || context.strength || 0) });
      facts.push({ label: "First Cost", value: context.nextCost == null ? "?" : `~${context.nextCost}` });
      if (context.attackProgress > 0) facts.push({ label: "Pressure", value: `${Math.round(context.attackProgress)}/${context.rawNextCost || context.nextCost}` });
      if (context.attackRemaining != null) facts.push({ label: "Left", value: String(context.attackRemaining) });
      if (context.defenseReasons?.length) facts.push({ label: "Why Hard", value: context.defenseReasons.join(", ") });
      facts.push({ label: "Risk", value: context.risk || "Unknown" });
      facts.push({ label: "Reinforced", value: `+${context.reinforcedBonus || 0}` });
      if (context.currentPushPreview?.valid) {
        facts.push({ label: "Current Route", value: `${context.currentPushPreview.distance} tiles` });
        facts.push({ label: "Impact", value: `${context.currentPushPreview.travelTime}s` });
        facts.push({ label: "Push Power", value: String(context.currentPushPreview.impactPower) });
      }
    }

    let title = type.label;
    let detail = TERRAIN_TIPS[tile.type] || "Pond terrain.";
    let warning = context.warning || "";

    if (context.kind === "attackBorder") {
      title = "Attackable Border";
      if (!context.canAttack && context.currentPushPreview?.valid) {
        detail = `Current Push Preview: route ${context.currentPushPreview.distance} tiles, impact in ${context.currentPushPreview.travelTime}s, estimated capture ${context.currentPushPreview.estimatedCapture} tiles.`;
      } else {
        detail =
          status?.detail ||
          `${context.recommendedAction || "Border Attack"}: commit ${context.percent}% energy. Estimated capture: ${context.tiles} tiles over time. First border costs about ${context.nextCost}. Failed hits weaken the border for your next wave.`;
      }
    } else if (context.kind === "blockedAttack") {
      title = owner ? "Enemy Territory" : type.label;
      detail = context.reason || detail;
      warning = context.reason || warning;
    } else if (context.canExpand) {
      title = "Expansion Target";
      const progressText =
        context.expansionProgress > 0 ? ` Progress ${Math.round(context.expansionProgress)}/${context.expansionCost}.` : "";
      detail = context.willCapture
        ? `Ready to capture this ${type.label.toLowerCase()} with your selected send amount.`
        : `Use Animal Energy to capture this ${type.label.toLowerCase()} from your border.${progressText}`;
    } else if (type.blocks) {
      title = "Blocked Terrain";
      detail = TIPS.rock;
      warning = "Blocked by terrain";
    }

    if (objective) {
      const def = objective.definition || {};
      title = objective.active ? def.label || "Lake Objective" : "Dormant Objective";
      detail = objective.active ? def.description || TIPS.objectives : "This objective will activate after the early game.";
    } else if (camp) {
      const def = camp.definition || {};
      title = def.label || "Critter Camp";
      detail = def.description || TIPS.critterCamp;
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
    const visual = root.PondAnimalVisuals?.animals?.[player.animal] || {};
    const relation = relationshipFor(state, player.id);
    const relationText =
      relation?.label ||
      (player.teamId && player.teamId === human.teamId ? "Teammate" : human.allies.includes(player.id) ? "Alliance" : human.enemies.includes(player.id) ? "Marked enemy" : "Neutral");
    const roleLabel = state.config.teams?.roles?.[player.role]?.label || player.role || (player.isBot ? "Bot" : "Player");
    const war = state.wars?.find((entry) => entry.players.includes(player.id) && entry.players.includes(state.humanId));
    const warText = relationText || (war?.atWar ? "At War" : war?.peacePossible ? "Peace Possible" : relationText);
    const strength = strengthLabel(player.energy, player.maxEnergy);
    const strengthEstimate = relativeStrengthLabel(player, human);
    const difficultyLabel = player.isBot ? botDifficultyLabel(state, player) : "Human";
    const personalityLabel = player.isBot ? botPersonalityLabel(player) : "Player";
    const coreText = player.coreLost
      ? "Lost"
      : player.coreMaxHealth
        ? `${Math.round(player.coreHealth || 0)}/${Math.round(player.coreMaxHealth)}`
        : "Stable";
    const supportLeft = Math.max(0, Math.ceil((player.supportReadyAt || 0) - (state.serverTime || 0)));
    const suggested = relation && !relation.canAttack
      ? relation.blockReason || "Protected by diplomacy"
      : relation?.allied
      ? "Coordinate with signals"
      : player.energy < human.energy * 0.72
        ? "Attack if connected"
        : player.energy > human.energy * 1.25
          ? "Defend before attacking"
          : "Scout the border first";

    return {
      title: `${player.name}`,
      meta: `${animal.label} L${player.level || 1} | ${player.isBot ? `${difficultyLabel} ${personalityLabel}` : visual.role || roleLabel} | ${Math.round(player.territoryPct * 100)}% territory | ${player.energy} energy | ${warText}`,
      facts: [
        { label: "Animal", value: animal.label },
        ...(player.isBot
          ? [
              { label: "Difficulty", value: difficultyLabel },
              { label: "Personality", value: personalityLabel },
              { label: "Strength Estimate", value: strengthEstimate },
            ]
          : []),
        { label: "Best Terrain", value: visual.terrain || "Mixed pond" },
        { label: "Counterplay", value: visual.counterplay || "Watch its strongest border." },
        { label: "Team", value: player.teamName || "Solo" },
        { label: "Relationship", value: relationText },
        { label: "Role", value: roleLabel },
        { label: "Level", value: player.progression?.levelText || `Level ${player.level || 1}` },
        { label: "Ability", value: animal.ability },
        { label: "Strength", value: strength },
        { label: "Income", value: `+${player.income}/s` },
        { label: "Core Nest", value: coreText },
        { label: "Support", value: supportLeft > 0 ? `${supportLeft}s cooldown` : "Ready" },
        { label: "Status", value: warText },
        { label: "Can Attack", value: relation?.canAttack ? "Yes" : relation?.blockReason || "No" },
        { label: "War Tiles", value: String(relation?.tilesCaptured ?? war?.tilesCaptured ?? 0) },
        { label: "Recent Hits", value: String(relation?.attacks ?? war?.attacks ?? 0) },
        { label: "Damage", value: String(relation?.damage ?? war?.damage ?? 0) },
        { label: "Last Attack", value: relation?.lastAttackAgo == null ? "None" : `${relation.lastAttackAgo}s ago` },
        { label: "Timer", value: relationTimer(relation) },
        { label: "Suggested", value: suggested },
      ],
    };
  }

  function relationshipFor(state, playerId) {
    return state.relationships?.find((entry) => entry.playerId === playerId) || null;
  }

  function relationTimer(relation) {
    if (!relation) return "-";
    if (relation.truceLeft > 0) return `Truce ${relation.truceLeft}s`;
    if (relation.betrayalLeft > 0) return `Cooldown ${relation.betrayalLeft}s`;
    if (relation.requestExpiresIn > 0) return `Request ${relation.requestExpiresIn}s`;
    if (relation.warLeft > 0) return `War ${relation.warLeft}s`;
    return "-";
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
      { label: "Objectives", value: `+${breakdown.objectives || 0}` },
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
    if (animalId === "turtle") return TIPS.turtleAbility;
    if (animalId === "carp") return TIPS.carpAbility;
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

  function botDifficultyLabel(state, player) {
    const profile = state.config?.botDifficulty?.[player.botDifficulty || player.difficulty] || {};
    return profile.label || titleCase(player.botDifficulty || player.difficulty || "normal");
  }

  function botPersonalityLabel(player) {
    if (player.botPersonality) return player.botPersonality;
    const labels = {
      aggressive: "Fighter",
      defensive: "Defender",
      defender: "Defender",
      expander: "Expander",
      objectiveHunter: "Objective Hunter",
      leaderHunter: "Leader Hunter",
      supporter: "Supporter",
      loyalAlly: "Supporter",
      peaceful: "Supporter",
      farmer: "Expander",
      opportunist: "Fighter",
      betrayer: "Fighter",
      passive: "Passive",
    };
    return labels[player.personality] || titleCase(player.personality || "fighter");
  }

  function relativeStrengthLabel(player, human) {
    const playerScore = player.energy + player.territory * 1.5 + (player.defenseEnergy || 0);
    const humanScore = human.energy + human.territory * 1.5 + (human.defenseEnergy || 0);
    if (playerScore > humanScore * 1.35) return "Dangerous";
    if (playerScore > humanScore * 1.05) return "Slightly ahead";
    if (playerScore < humanScore * 0.7) return "Vulnerable";
    return "Even fight";
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^\w/, (match) => match.toUpperCase());
  }

  root.PondInfo = {
    TIPS,
    PING_LABELS,
    tileSummary,
    playerSummary,
    relationshipFor,
    incomeFacts,
    terrainText,
    buildingText,
    abilityTip,
    defenseLabel,
    strengthLabel,
  };
})(window);
