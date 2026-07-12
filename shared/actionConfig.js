(function initPondActions(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PondActions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPondActions() {
  const PERCENTS = [
    { value: 0.1, small: "Small", attack: "Bite" },
    { value: 0.25, small: "Medium", attack: "Push" },
    { value: 0.5, small: "Large", attack: "Wave" },
    { value: 1, small: "Max", attack: "Max Attack" },
  ];

  function action(id, label, payload = {}, options = {}) {
    const available = options.available !== false;
    return {
      id,
      label,
      icon: options.icon || "i",
      available,
      disabledReason: available ? "" : options.disabledReason || "Unavailable.",
      hint: available ? options.hint || "" : options.disabledReason || options.hint || "Unavailable.",
      cost: Number.isFinite(Number(options.cost)) ? Number(options.cost) : null,
      cooldownRemaining: Math.max(0, Number(options.cooldownRemaining || 0)),
      targetType: options.targetType || "tile",
      danger: Boolean(options.danger),
      payload: { action: id, ...payload },
      submenu: options.submenu || null,
    };
  }

  function separator() {
    return { separator: true };
  }

  function getAvailableTileActions(input = {}) {
    const { state, player, tile, context = {}, helpers = {} } = input;
    const now = Number(input.serverNow ?? state?.serverTime ?? 0);
    const teamActive = Boolean(state?.teamState?.active && player?.teamId);
    const actions = [];
    const add = (...args) => actions.push(action(...args));
    const addSeparator = () => {
      if (actions.length && !actions[actions.length - 1].separator) actions.push(separator());
    };
    const addTeamPing = (pingType, label) => {
      add("ping", label, { pingType, tileId: tile?.id }, {
        icon: "P",
        available: teamActive && Boolean(tile),
        disabledReason: teamActive ? "Select a pond tile." : "Team pings require Co-op or Team Battle.",
        targetType: "team",
      });
    };

    if (state?.phase === "SPAWN_SELECTION" || state?.phase === "COUNTDOWN") {
      const reservation = state.spawn?.ownReservation;
      const selecting = state.phase === "SPAWN_SELECTION";
      if (tile) add("spawnReserve", "Select Spawn", { tileId: tile.id, snapNearby: true }, { icon: "S", available: selecting, disabledReason: "Spawn locations are locked." });
      add("spawnConfirm", "Confirm Spawn", {}, { icon: "C", available: selecting && Boolean(reservation) && !reservation?.confirmed, disabledReason: reservation?.confirmed ? "Spawn already confirmed." : "Select a spawn first." });
      add("spawnRelease", "Change Spawn", {}, { icon: "R", available: selecting && Boolean(reservation) && !(reservation?.confirmed && state.spawn?.lockOnConfirm), disabledReason: state.spawn?.lockOnConfirm ? "Confirmed spawns are locked in this lobby." : "No spawn is reserved." });
      add("spawnRandom", "Random Spawn", {}, { icon: "?", available: selecting, disabledReason: "Spawn locations are locked." });
      add("spawnFind", "Find Available Spawn", {}, { icon: "F", available: selecting, disabledReason: "Spawn locations are locked." });
      return { title: "Spawn Selection", subtitle: state.spawn?.label || "Choose your starting Nest", actions };
    }

    if (!tile) {
      add("viewArea", "Inspect Area", {}, { icon: "i", targetType: "area" });
      addTeamPing("help", "Team Ping");
      add("cancelSelection", "Cancel Selection", {}, { icon: "X", targetType: "general" });
      return { title: "Pond Actions", subtitle: "General location", actions };
    }

    const blocked = Boolean(helpers.isBlocked?.(tile) ?? context.blocked);
    const own = tile.owner === player?.id;
    const relationship = tile.owner && !own ? helpers.relationship?.(tile.owner) || context.relationship : null;
    const ally = Boolean(relationship?.allied || relationship?.teammate);
    const objective = Boolean(tile.objectiveId || tile.campId);
    const core = Boolean(tile.isCore);
    const tileLabel = helpers.tileLabel?.(tile) || tile.type || "Pond tile";

    if (blocked) {
      add("viewTerrain", "Inspect Blocked Terrain", { tileId: tile.id }, { icon: "i", hint: helpers.terrainText?.(tile.type) || "This terrain blocks movement." });
      return { title: tileLabel, subtitle: "Blocked land", actions };
    }

    if (!tile.owner) {
      const canExpand = Boolean(context.canExpand);
      PERCENTS.forEach(({ value, small }) => {
        const send = Math.round((player?.energy || 0) * value);
        add("expand", `Expand ${small}`, { tileId: tile.id, percent: value }, {
          icon: `${Math.round(value * 100)}`,
          available: canExpand && send >= 4,
          disabledReason: !canExpand ? "This tile is not connected to your border." : "Need at least 4 Animal Energy to expand.",
          cost: send,
        });
      });
      add("viewTerrain", "Inspect Terrain", { tileId: tile.id }, { icon: "i", hint: helpers.terrainText?.(tile.type) || tileLabel });
      addTeamPing(objective ? "objective" : "attack", objective ? "Team Objective Ping" : "Team Ping");
    } else if (own) {
      const canDefend = Boolean(context.canDefend);
      const defendLeft = Math.max(0, (player?.defendCooldownUntil || 0) - now);
      if (tile.building) {
        const building = state?.config?.buildings?.[tile.building] || {};
        add("viewBuilding", "Inspect Building", { tileId: tile.id }, { icon: "i", hint: helpers.buildingText?.(tile.building) || building.label || tile.building });
        add("upgradeBuilding", core ? "Upgrade Nest" : "Upgrade Building", { tileId: tile.id }, {
          icon: "+",
          available: Boolean(context.canUpgradeBuilding),
          disabledReason: (tile.buildingLevel || 1) >= 3 ? "Building is already at maximum level." : "This building cannot be upgraded now.",
        });
      } else {
        const submenu = Object.entries(state?.config?.buildings || {}).map(([buildingType, building]) => {
          const preview = helpers.buildPreview?.(buildingType, tile, player) || { cost: building.cost || 0, canBuild: false, reason: "Build preview unavailable." };
          return action("build", building.label || buildingType, { tileId: tile.id, buildingType }, {
            icon: "B",
            available: Boolean(preview.canBuild),
            disabledReason: preview.reason || "Cannot build here.",
            hint: `${building.effect || building.description || "Pond building"} ${preview.buildTime ? `Build time ${preview.buildTime}s.` : ""}`.trim(),
            cost: preview.cost,
            cooldownRemaining: preview.cooldownRemaining || 0,
          });
        });
        add("buildMenu", "Build", { tileId: tile.id }, { icon: "B", available: Boolean(submenu.length), disabledReason: "No buildings are available.", submenu });
      }
      add("defend", core ? "Defend Nest" : tile.building ? "Defend Building" : "Defend", { tileId: tile.id, percent: 0.25 }, {
        icon: "D",
        available: canDefend && defendLeft <= 0,
        disabledReason: defendLeft > 0 ? `Reinforce cooldown ${Math.ceil(defendLeft)}s.` : "Choose an owned border or building tile.",
        cooldownRemaining: defendLeft,
      });
      add("defend", "Reinforce", { tileId: tile.id, percent: 0.5 }, {
        icon: "R",
        available: canDefend && defendLeft <= 0,
        disabledReason: defendLeft > 0 ? `Reinforce cooldown ${Math.ceil(defendLeft)}s.` : "This tile cannot be reinforced.",
        cooldownRemaining: defendLeft,
      });
      if (core) {
        add("viewTile", "Inspect Nest", { tileId: tile.id }, { icon: "N" });
        add("repairNest", "Repair Nest", { tileId: tile.id }, { icon: "+", available: false, disabledReason: "Nest repair is only available in supported survival rules." });
      }
      addAbility(actions, state, player, tile, now, helpers);
      addSpecial(actions, state, player, tile, "reedShield", now, helpers, "Place Reed Shield");
      if (tile.building) add("removeBuilding", "Demolish Building", { tileId: tile.id }, { icon: "-", danger: true, available: !core, disabledReason: "Core Nests cannot be demolished." });
      addTeamPing(core ? "help" : "defend", core ? "Team Help Ping" : "Team Defend Ping");
      add("viewTile", core ? "Inspect Nest" : "Inspect Tile", { tileId: tile.id }, { icon: "i" });
    } else if (ally) {
      add("viewPlayer", "Inspect Ally", { tileId: tile.id, targetId: tile.owner }, { icon: "i" });
      const supportLeft = Math.max(0, (player?.supportReadyAt || 0) - now);
      add("support", "Send Support Energy", { targetId: tile.owner, percent: 0.25 }, {
        icon: "S",
        available: supportLeft <= 0 && (player?.energy || 0) >= 8,
        disabledReason: supportLeft > 0 ? `Support cooldown ${Math.ceil(supportLeft)}s.` : "Need at least 8 Animal Energy.",
        cooldownRemaining: supportLeft,
      });
      addTeamPing("help", "Team Help Ping");
      add("defendAlly", "Defend Ally", { tileId: tile.id }, { icon: "D", available: false, disabledReason: "Direct ally defense is not enabled in this match." });
      addSpecial(actions, state, player, tile, "dragonflyGuard", now, helpers, "Dragonfly Guard");
    } else {
      const canAttack = Boolean(context.canAttack);
      const canDiplomacyAttack = relationship?.canAttack !== false;
      PERCENTS.forEach(({ value, attack }) => {
        const send = Math.round((player?.energy || 0) * value);
        add("attack", attack, { tileId: tile.id, targetId: tile.owner, percent: value }, {
          icon: "A",
          danger: value >= 0.5,
          available: canAttack && canDiplomacyAttack && send >= 5,
          disabledReason: !canDiplomacyAttack ? relationship?.blockReason || "Diplomacy blocks this attack." : !canAttack ? "Attack from a connected border tile." : "Need at least 5 Animal Energy.",
          cost: send,
        });
      });
      const pushLeft = Math.max(0, (player?.currentPushCooldownUntil || 0) - now);
      const currentValid = Boolean(context.currentPushPreview?.valid || canAttack);
      add("waterRoute", "Current Push", { tileId: tile.id, targetId: tile.owner, percent: 0.5 }, {
        icon: "~",
        available: canDiplomacyAttack && currentValid && pushLeft <= 0 && (player?.energy || 0) * 0.5 >= 10,
        disabledReason: pushLeft > 0 ? `Current Push cooldown ${Math.ceil(pushLeft)}s.` : !currentValid ? "No open-water route reaches this target." : "Need at least 20 Animal Energy for a 50% Current Push.",
        cooldownRemaining: pushLeft,
      });
      addSpecial(actions, state, player, tile, "lilyBarrage", now, helpers, "Lily Barrage");
      add("viewPlayer", "Inspect Enemy", { tileId: tile.id, targetId: tile.owner }, { icon: "i" });
      add("diplomacy", "Mark Enemy", { targetId: tile.owner, command: "markEnemy" }, { icon: "M", danger: true });
      addTeamPing("attack", "Team Attack Ping");
    }

    if (objective) {
      addSeparator();
      add("viewTile", "Inspect Objective", { tileId: tile.id }, { icon: "O", hint: "View capture, contest, and bonus information." });
      add("viewTile", "Capture / Contest Information", { tileId: tile.id }, { icon: "i" });
      addTeamPing("objective", "Team Objective Ping");
      add("defend", "Defend Objective", { tileId: tile.id, percent: 0.25 }, { icon: "D", available: own && Boolean(context.canDefend), disabledReason: own ? "Choose an objective border tile." : "Capture this objective before defending it." });
    }

    return {
      title: core ? "Core Nest" : objective ? "Pond Objective" : own ? "Your Territory" : ally ? "Ally Territory" : tile.owner ? "Enemy Territory" : tileLabel,
      subtitle: tileLabel,
      actions,
    };
  }

  function addAbility(actions, state, player, tile, now, helpers) {
    const status = player?.abilityStatus || {};
    const cooldownLeft = Math.max(0, Number(status.cooldownEndsAt || player?.abilityCooldownEndsAt || player?.abilityReadyAt || 0) - now);
    const targetValid = player?.animal !== "frog" || Boolean(helpers.validAbilityTarget?.(tile));
    actions.push(action("ability", "Use Ability", { tileId: tile.id }, {
      icon: "A",
      available: !player?.defeated && !state?.ended && cooldownLeft <= 0 && targetValid,
      disabledReason: cooldownLeft > 0 ? `Ability cooldown ${Math.ceil(cooldownLeft)}s.` : !targetValid ? "Big Leap targets a nearby neutral tile." : player?.defeated ? "Eliminated animals cannot use abilities." : "Ability unavailable.",
      cooldownRemaining: cooldownLeft,
    }));
  }

  function addSpecial(actions, state, player, tile, specialType, now, helpers, label) {
    const special = state?.config?.specials?.[specialType] || {};
    const status = player?.specialStatus?.[specialType] || {};
    const cooldownEndsAt = Number(status.cooldownEndsAt || player?.specialCooldowns?.[specialType] || 0);
    const cooldownLeft = cooldownEndsAt > 0
      ? Math.max(0, cooldownEndsAt - now)
      : Math.max(0, Number(status.cooldownLeft || 0));
    const cost = Number(status.cost ?? special.cost ?? 0);
    const targetValid = Boolean(helpers.validSpecialTarget?.(tile, specialType));
    actions.push(action("special", label || special.label || specialType, { tileId: tile.id, specialType }, {
      icon: specialType === "lilyBarrage" ? "L" : specialType === "dragonflyGuard" ? "G" : "R",
      available: targetValid && cooldownLeft <= 0 && (player?.energy || 0) >= cost,
      disabledReason: cooldownLeft > 0 ? `${label} cooldown ${Math.ceil(cooldownLeft)}s.` : (player?.energy || 0) < cost ? `Need ${Math.ceil(cost - (player?.energy || 0))} more Animal Energy.` : "This is not a valid target.",
      cost,
      cooldownRemaining: cooldownLeft,
    }));
  }

  return Object.freeze({ PERCENTS, getAvailableTileActions });
});
