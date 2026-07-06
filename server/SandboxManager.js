const config = require("../shared/gameConfig");
const animals = require("../shared/animals");
const objectives = require("../shared/objectives");
const sandboxConfig = require("../shared/sandboxConfig");

class SandboxManager {
  constructor(game, settings = {}) {
    this.game = game;
    this.enabled = Boolean(settings.enabled);
    this.rules = this.normalizeRules(settings.rules || settings.sandboxRules || {});
    this.defaultBotDifficulty = this.normalizeDifficulty(settings.botDifficulty || settings.difficulty || "normal");
    this.defaultBotPersonality = this.normalizePersonality(
      settings.botPersonality || sandboxConfig.botDifficulties[this.defaultBotDifficulty]?.personality || "fighter",
    );
    this.speed = this.normalizeSpeed(settings.speed || 1);
    this.botsPaused = false;
    this.simulationPaused = false;
    this.debug = {
      combat: false,
      economy: false,
      ability: false,
    };
    this.nextBotId = 1;
  }

  normalizeRules(rules = {}) {
    return Object.fromEntries(
      Object.entries(sandboxConfig.defaultRules).map(([key, fallback]) => [key, typeof rules[key] === "boolean" ? rules[key] : fallback]),
    );
  }

  normalizeDifficulty(value) {
    const key = String(value || "normal").toLowerCase();
    if (key === "hard") return "smart";
    return sandboxConfig.botDifficulties[key] ? key : "normal";
  }

  serverDifficulty(value = this.defaultBotDifficulty) {
    return sandboxConfig.botDifficulties[this.normalizeDifficulty(value)]?.serverDifficulty || "normal";
  }

  normalizePersonality(value) {
    const key = String(value || "fighter");
    return sandboxConfig.personalities[key] ? key : "fighter";
  }

  normalizeSpeed(value) {
    const speed = Number(value);
    return sandboxConfig.speeds.includes(speed) ? speed : 1;
  }

  afterReset(game) {
    if (!this.enabled) return;
    this.game = game;
    if (!this.rules.objectives) this.clearObjectives(game);
    if (this.rules.infiniteEnergy) {
      game.players.filter((player) => !player.isBot).forEach((player) => this.fillEnergy(player));
    }
    if (this.rules.noCooldowns) {
      game.players.forEach((player) => this.resetCooldowns(player, game.now()));
    }
    game.players
      .filter((player) => player.isBot)
      .forEach((bot) => {
        bot.flags = bot.flags || {};
        bot.flags.sandboxPersonality = this.defaultBotPersonality;
        if (this.defaultBotPersonality === "passive") bot.personality = "passive";
      });
    game.pushEvent({
      kind: "notice",
      message: this.rules.elimination
        ? "Sandbox Mode active with elimination enabled. Stats, XP, coins, achievements, and match history are disabled."
        : "Sandbox Mode - match ending disabled. Stats, XP, coins, achievements, and match history are disabled.",
      at: game.now(),
    });
  }

  tickDelta(dt) {
    if (!this.enabled || this.simulationPaused) return this.enabled ? 0 : dt;
    return Math.max(0, dt) * this.speed;
  }

  beforeAction(game, player, body) {
    if (!this.enabled) return { ok: true };
    if (body.type === "waterRoute" && this.rules.currentPush === false) {
      return { ok: false, message: "Sandbox rule blocks Current Push. Turn Current Push on in the Sandbox panel." };
    }
    if (this.rules.noCooldowns) this.resetCooldowns(player, game.now());
    if (this.rules.infiniteEnergy) this.fillEnergy(player);
    return { ok: true };
  }

  afterAction(game, player) {
    if (!this.enabled || !player) return;
    if (this.rules.noCooldowns) this.resetCooldowns(player, game.now());
    if (this.rules.infiniteEnergy) this.fillEnergy(player);
  }

  shouldSkipAccountRewards() {
    return this.enabled;
  }

  handle(game, player, body = {}) {
    if (!this.enabled) return { ok: false, message: "Sandbox tools only work in Sandbox Mode." };
    if (!player || player.isBot) return { ok: false, message: "Only a human sandbox player can use sandbox tools." };
    const action = String(body.action || "").trim();
    const now = game.now();
    const tile = game.tileManager.getById(Number(body.tileId));

    if (action === "command") return this.handleCommand(game, player, String(body.command || ""), tile);
    if (action === "addEnergy") return this.addEnergy(player, Number(body.amount || 100));
    if (action === "fillEnergy") return this.fillEnergy(player);
    if (action === "setMaxEnergy") return this.setMaxEnergy(player, Number(body.value || body.maxEnergy || 500));
    if (action === "changeAnimal") return this.changeAnimal(game, player, body.animal);
    if (action === "resetAbilityCooldown") return this.resetCooldowns(player, now, "Ability cooldown reset.");
    if (action === "toggleInfiniteEnergy") return this.toggleRule(game, "infiniteEnergy");
    if (action === "toggleNoCooldowns") return this.toggleRule(game, "noCooldowns");
    if (action === "toggleInstantBuild") return this.toggleRule(game, "instantBuild");
    if (action === "setGameSpeed") return this.setSpeed(body.value || body.speed);
    if (action === "pauseSimulation") return this.setPaused(true);
    if (action === "resumeSimulation") return this.setPaused(false);
    if (action === "pauseBots") return this.setBotsPaused(true);
    if (action === "resumeBots") return this.setBotsPaused(false);
    if (action === "revealMap") return this.setReveal(true);
    if (action === "hideMap") return this.setReveal(false);
    if (action === "toggleCombatDebug") return this.toggleDebug("combat");
    if (action === "toggleEconomyDebug") return this.toggleDebug("economy");
    if (action === "toggleAbilityDebug") return this.toggleDebug("ability");
    if (action === "placeBuilding") return this.placeBuilding(game, player, tile, body.buildingType, now);
    if (action === "upgradeSelectedBuilding") return this.upgradeBuilding(game, player, tile, now);
    if (action === "removeSelectedBuilding") return this.removeBuilding(game, player, tile, now);
    if (action === "spawnBot") return this.spawnBot(game, tile, body);
    if (action === "removeSelectedBot") return this.removeSelectedBot(game, tile, body.targetId);
    if (action === "setBotDifficulty") return this.setBotDifficulty(game, tile, body);
    if (action === "makeBotsPassive") return this.setAllBotPersonalities(game, "passive");
    if (action === "makeBotsAggressive") return this.setAllBotPersonalities(game, "fighter");
    if (action === "forceBotWar") return this.forceBotWar(game);
    if (action === "toggleSurrender") return this.toggleSurrender(game);
    if (action === "testBorderAttack") return this.testBorderAttack(game, player, tile, body.percent || 0.5);
    if (action === "testCurrentPush") return this.testCurrentPush(game, player, tile, body.percent || 0.5);
    if (action === "clearActiveAttacks") return this.clearActiveAttacks(game);
    if (action === "reinforceSelectedBorder") return this.reinforce(tile, 40);
    if (action === "removeReinforcement") return this.reinforce(tile, 0, true);
    if (action === "spawnObjective") return this.spawnObjective(game, tile, body.objectiveType || "goldenLily");
    if (action === "removeObjective") return this.removeObjective(game, tile);
    if (action === "clearPings") return this.clearPings(game);
    if (action === "resetMap") return this.resetMap(game, player);
    if (action === "useAbility") return game.combat.activateAbility(game, player, { targetTileId: tile?.id });
    if (action === "resetEconomy") return this.resetEconomy(game, player);
    return { ok: false, message: "Sandbox command failed: unknown action." };
  }

  handleCommand(game, player, command, selectedTile) {
    const parts = command.trim().split(/\s+/).filter(Boolean);
    const name = (parts.shift() || "").toLowerCase();
    if (!name) return { ok: false, message: "Sandbox command failed: enter a command." };
    const clean = name.startsWith("/") ? name.slice(1) : name;
    if (clean === "energy") return this.addEnergy(player, Number(parts[0] || 500));
    if (clean === "fillenergy") return this.fillEnergy(player);
    if (clean === "animal") return this.changeAnimal(game, player, parts[0]);
    if (clean === "spawnbot") {
      return this.spawnBot(game, selectedTile, {
        animal: parts[0] || "duck",
        difficulty: parts[1] || this.defaultBotDifficulty,
        personality: parts[2] || "",
      });
    }
    if (clean === "clearbots") return this.clearBots(game);
    if (clean === "objective") return this.spawnObjective(game, selectedTile, parts[0] || "goldenLily");
    if (clean === "nocooldowns") return this.setRule(game, "noCooldowns", parts[0] !== "off");
    if (clean === "instantbuild") return this.setRule(game, "instantBuild", parts[0] !== "off");
    if (clean === "surrender") return this.setSurrenderMode(game, parts[0] || "off");
    if (clean === "speed") return this.setSpeed(parts[0] || 1);
    if (clean === "reveal") return this.setReveal(true);
    if (clean === "reset") return this.resetMap(game, player);
    return { ok: false, message: "Sandbox command failed: unknown command." };
  }

  addEnergy(player, amount = 100) {
    const add = Math.max(1, Math.min(10000, Number(amount) || 100));
    player.energy = Math.min(10000, (player.energy || 0) + add);
    player.flags = player.flags || {};
    player.flags.sandboxMaxEnergyOverride = Math.max(player.flags.sandboxMaxEnergyOverride || 0, player.energy);
    player.maxEnergy = Math.max(player.maxEnergy || 0, player.energy);
    return { ok: true, message: `Sandbox: added ${Math.round(add)} Animal Energy.` };
  }

  fillEnergy(player) {
    player.energy = Math.max(player.energy || 0, player.maxEnergy || 0);
    return { ok: true, message: "Sandbox: energy filled." };
  }

  setMaxEnergy(player, value) {
    const max = Math.max(80, Math.min(10000, Number(value) || 500));
    player.flags = player.flags || {};
    player.flags.sandboxMaxEnergyOverride = max;
    player.maxEnergy = max;
    player.energy = Math.min(Math.max(player.energy, Math.round(max * 0.65)), max);
    return { ok: true, message: `Sandbox: max energy set to ${Math.round(max)}.` };
  }

  changeAnimal(game, player, animal) {
    const next = String(animal || "").toLowerCase();
    if (!animals[next]) return { ok: false, message: "Sandbox command failed: unknown animal." };
    player.animal = next;
    player.abilityActiveUntil = 0;
    player.abilityReadyAt = 0;
    player.flags.ambushReady = false;
    game.economy.recalculate(game.players, game.now(), game);
    return { ok: true, message: `Sandbox: changed animal to ${animals[next].label}.` };
  }

  resetCooldowns(player, now = Date.now() / 1000, message = "Cooldowns reset.") {
    player.abilityReadyAt = 0;
    player.attackCooldownUntil = 0;
    player.currentPushCooldownUntil = 0;
    player.supportReadyAt = 0;
    player.aiAttackCooldownUntil = 0;
    player.aiCurrentPushCooldownUntil = 0;
    return { ok: true, message: `Sandbox: ${message}` };
  }

  toggleRule(game, key) {
    return this.setRule(game, key, !this.rules[key]);
  }

  setRule(game, key, value) {
    if (!(key in this.rules)) return { ok: false, message: "Sandbox command failed: unknown rule." };
    this.rules[key] = Boolean(value);
    if (key === "objectives" && !this.rules.objectives) this.clearObjectives(game);
    if (key === "noCooldowns" && this.rules.noCooldowns) game.players.forEach((player) => this.resetCooldowns(player, game.now()));
    if (key === "infiniteEnergy" && this.rules.infiniteEnergy) game.players.filter((entry) => !entry.isBot).forEach((entry) => this.fillEnergy(entry));
    return { ok: true, message: `Sandbox: ${this.ruleLabel(key)} ${this.rules[key] ? "on" : "off"}.` };
  }

  setReveal(value) {
    this.rules.revealMap = Boolean(value);
    return { ok: true, message: `Sandbox: reveal map ${this.rules.revealMap ? "on" : "off"}.` };
  }

  setSpeed(value) {
    this.speed = this.normalizeSpeed(value);
    return { ok: true, message: `Sandbox: game speed ${this.speed}x.` };
  }

  setPaused(paused) {
    this.simulationPaused = Boolean(paused);
    return { ok: true, message: `Sandbox: simulation ${this.simulationPaused ? "paused" : "resumed"}.` };
  }

  setBotsPaused(paused) {
    this.botsPaused = Boolean(paused);
    return { ok: true, message: `Sandbox: bots ${this.botsPaused ? "paused" : "resumed"}.` };
  }

  toggleSurrender(game) {
    const order = ["off", "bots", "everyone"];
    const current = game.matchSettings?.surrenderMode || "off";
    const next = order[(order.indexOf(current) + 1) % order.length] || "off";
    return this.setSurrenderMode(game, next);
  }

  setSurrenderMode(game, value) {
    const next = game.normalizeSurrenderMode ? game.normalizeSurrenderMode(value) : "off";
    game.matchSettings.surrenderMode = next;
    return { ok: true, message: `Sandbox: surrender ${next === "off" ? "off" : next === "bots" ? "bots only" : "everyone"}.` };
  }

  toggleDebug(key) {
    if (!(key in this.debug)) return { ok: false, message: "Sandbox command failed: unknown debug view." };
    this.debug[key] = !this.debug[key];
    return { ok: true, message: `Sandbox: ${key} debug ${this.debug[key] ? "shown" : "hidden"}.` };
  }

  placeBuilding(game, player, tile, buildingType, now) {
    const type = String(buildingType || "nest");
    const building = config.BUILDINGS[type];
    if (!building) return { ok: false, message: "Sandbox command failed: unknown building." };
    if (!tile || tile.owner !== player.id || config.TILE_TYPES[tile.type]?.blocks) {
      return { ok: false, message: "Sandbox: select one of your playable tiles first." };
    }
    tile.building = type;
    tile.buildingLevel = Math.max(1, tile.buildingLevel || 1);
    tile.buildingActiveAt = this.rules.instantBuild ? now : now + (config.BALANCE.buildTimeSeconds || 10);
    tile.buildingCompleteNotified = false;
    tile.buildingPendingEvent = "build";
    tile.lastChanged = now;
    player.stats.buildingsBuilt = (player.stats.buildingsBuilt || 0) + 1;
    game.pushEvent({
      kind: "buildStarted",
      playerId: player.id,
      to: tile.id,
      buildingType: type,
      finishesAt: tile.buildingActiveAt,
      at: now,
    });
    return { ok: true, message: `Sandbox: placed ${building.label}${this.rules.instantBuild ? " instantly" : ""}.` };
  }

  upgradeBuilding(game, player, tile, now) {
    if (!tile || tile.owner !== player.id || !tile.building) return { ok: false, message: "Sandbox: select one of your buildings." };
    tile.buildingLevel = Math.min(3, (tile.buildingLevel || 1) + 1);
    tile.buildingActiveAt = this.rules.instantBuild ? now : now + (config.BALANCE.upgradeTimeSeconds || 8);
    tile.buildingCompleteNotified = false;
    tile.buildingPendingEvent = "upgrade";
    tile.defenseEnergy = Math.min(120, (tile.defenseEnergy || 0) + 14);
    tile.lastChanged = now;
    player.stats.buildingUpgrades = (player.stats.buildingUpgrades || 0) + 1;
    return { ok: true, message: `Sandbox: upgraded building to level ${tile.buildingLevel}.` };
  }

  removeBuilding(game, player, tile, now) {
    if (!tile || tile.owner !== player.id || !tile.building) return { ok: false, message: "Sandbox: select one of your buildings." };
    const label = config.BUILDINGS[tile.building]?.label || "Building";
    tile.building = null;
    tile.buildingLevel = 0;
    tile.buildingActiveAt = 0;
    tile.buildingCompleteNotified = false;
    delete tile.buildingPendingEvent;
    tile.lastChanged = now;
    return { ok: true, message: `Sandbox: removed ${label}.` };
  }

  spawnBot(game, selectedTile, body = {}) {
    const animal = animals[String(body.animal || "duck").toLowerCase()] ? String(body.animal || "duck").toLowerCase() : "duck";
    const difficulty = this.normalizeDifficulty(body.difficulty || this.defaultBotDifficulty);
    const personality = this.normalizePersonality(body.personality || sandboxConfig.botDifficulties[difficulty]?.personality || this.defaultBotPersonality);
    const tile = this.spawnTile(game, selectedTile);
    if (!tile) return { ok: false, message: "Sandbox: no playable spawn tile found." };
    const id = `sb${Date.now().toString(36)}${this.nextBotId++}`;
    const name = this.cleanBotName(body.name) || `${animals[animal].label} Test ${this.nextBotId}`;
    const color = config.PLAYER_COLORS[game.players.length % config.PLAYER_COLORS.length];
    const bot = game.makePlayer(id, name, animal, color, true, this.serverDifficulty(difficulty));
    bot.personality = personality === "chaos" ? "aggressive" : personality;
    bot.flags = bot.flags || {};
    bot.flags.sandboxPersonality = personality;
    bot.energy = 60;
    bot.maxEnergy = 90;
    game.players.push(bot);
    game.diplomacy.attach(game.players);
    game.teamManager.players = game.players;
    this.claimCluster(game, bot, tile, 2);
    game.economy.recalculate(game.players, game.now(), game);
    game.pushEvent({ kind: "notice", message: `Sandbox spawned ${name}.`, at: game.now() });
    return { ok: true, message: `Sandbox: spawned ${name}.` };
  }

  cleanBotName(value) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 18);
  }

  spawnTile(game, selectedTile) {
    if (selectedTile && !selectedTile.owner && !config.TILE_TYPES[selectedTile.type]?.blocks) return selectedTile;
    const human = game.players.find((player) => !player.isBot);
    const center = human?.coreTileId != null ? game.tileManager.getById(human.coreTileId) : null;
    const candidates = game.tileManager
      .playable()
      .filter((tile) => !tile.owner)
      .sort((a, b) => {
        if (!center) return Math.random() - 0.5;
        const ad = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
        const bd = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
        return bd - ad;
      });
    return candidates[0] || game.tileManager.playable()[0] || null;
  }

  claimCluster(game, player, centerTile, radius = 2) {
    player.coreTileId = centerTile.id;
    for (let y = centerTile.y - radius; y <= centerTile.y + radius; y += 1) {
      for (let x = centerTile.x - radius; x <= centerTile.x + radius; x += 1) {
        const tile = game.tileManager.get(x, y);
        if (!tile || config.TILE_TYPES[tile.type]?.blocks) continue;
        if (tile.owner && tile.owner !== player.id) continue;
        if (Math.abs(tile.x - centerTile.x) + Math.abs(tile.y - centerTile.y) > radius) continue;
        tile.owner = player.id;
        tile.captureProgress = {};
        tile.building = null;
        tile.buildingLevel = 0;
        tile.defenseEnergy = tile.id === centerTile.id ? 8 : 2;
        tile.lastChanged = game.now();
      }
    }
  }

  removeSelectedBot(game, tile, targetId) {
    const target = this.selectedBot(game, tile, targetId);
    if (!target) return { ok: false, message: "Sandbox: select a bot territory first." };
    this.removeBot(game, target);
    return { ok: true, message: `Sandbox: removed ${target.name}.` };
  }

  selectedBot(game, tile, targetId) {
    if (targetId) {
      const target = game.getPlayer(targetId);
      if (target?.isBot) return target;
    }
    if (tile?.owner) {
      const target = game.getPlayer(tile.owner);
      if (target?.isBot) return target;
    }
    return null;
  }

  removeBot(game, bot) {
    game.tileManager.tiles.forEach((tile) => {
      if (tile.owner !== bot.id) return;
      tile.owner = null;
      tile.captureProgress = {};
      tile.building = null;
      tile.buildingLevel = 0;
      tile.buildingActiveAt = 0;
      tile.defenseEnergy = Math.max(0, (tile.defenseEnergy || 0) * 0.25);
      tile.lastChanged = game.now();
    });
    game.combat.activeAttacks = game.combat.activeAttacks.filter((wave) => wave.attackerId !== bot.id && wave.defenderId !== bot.id);
    game.combat.activeExpansions = game.combat.activeExpansions.filter((wave) => wave.playerId !== bot.id);
    game.combat.continuousAttacks = game.combat.continuousAttacks.filter((order) => order.attackerId !== bot.id && order.defenderId !== bot.id);
    game.combat.currentPushes = game.combat.currentPushes.filter((push) => push.attackerId !== bot.id && push.defenderId !== bot.id);
    game.players = game.players.filter((player) => player.id !== bot.id);
    game.diplomacy.attach(game.players);
    game.teamManager.players = game.players;
    game.economy.recalculate(game.players, game.now(), game);
  }

  clearBots(game) {
    game.players.filter((player) => player.isBot).forEach((bot) => this.removeBot(game, bot));
    return { ok: true, message: "Sandbox: cleared all bots." };
  }

  setBotDifficulty(game, tile, body = {}) {
    const selected = this.selectedBot(game, tile, body.targetId);
    const difficulty = this.normalizeDifficulty(body.difficulty || this.defaultBotDifficulty);
    const personality = this.normalizePersonality(body.personality || sandboxConfig.botDifficulties[difficulty]?.personality || this.defaultBotPersonality);
    const bots = selected ? [selected] : game.players.filter((player) => player.isBot);
    bots.forEach((bot) => {
      bot.difficulty = this.serverDifficulty(difficulty);
      bot.personality = personality === "chaos" ? "aggressive" : personality;
      bot.flags = bot.flags || {};
      bot.flags.sandboxPersonality = personality;
    });
    this.defaultBotDifficulty = difficulty;
    this.defaultBotPersonality = personality;
    return { ok: true, message: `Sandbox: bot behavior set to ${sandboxConfig.personalities[personality]}.` };
  }

  setAllBotPersonalities(game, personality) {
    game.players.filter((player) => player.isBot).forEach((bot) => {
      bot.flags = bot.flags || {};
      bot.flags.sandboxPersonality = personality;
      bot.personality = personality === "fighter" ? "aggressive" : personality;
    });
    this.rules.botsFight = personality !== "passive";
    return { ok: true, message: `Sandbox: bots set to ${sandboxConfig.personalities[personality] || personality}.` };
  }

  forceBotWar(game) {
    this.rules.botsFight = true;
    game.players.filter((player) => player.isBot).forEach((bot) => {
      bot.flags = bot.flags || {};
      bot.flags.sandboxPersonality = "fighter";
      bot.personality = "aggressive";
      bot.energy = Math.max(bot.energy, bot.maxEnergy * 0.75);
    });
    return { ok: true, message: "Sandbox: bot war forced." };
  }

  testBorderAttack(game, player, tile, percent) {
    if (!tile || !tile.owner || tile.owner === player.id) return { ok: false, message: "Sandbox: select an enemy border tile." };
    return game.combat.startWaveAttack(game, player, game.getPlayer(tile.owner), tile, Number(percent) || 0.5, [], { ignoreCooldown: this.rules.noCooldowns });
  }

  testCurrentPush(game, player, tile, percent) {
    if (this.rules.currentPush === false) return { ok: false, message: "Sandbox: Current Push rule is off." };
    if (!tile || !tile.owner || tile.owner === player.id) return { ok: false, message: "Sandbox: select an enemy coastal tile." };
    if (this.rules.noCooldowns) player.currentPushCooldownUntil = 0;
    return game.combat.startWaterRouteAttack(game, player, tile.id, Number(percent) || 0.5, []);
  }

  clearActiveAttacks(game) {
    game.combat.activeAttacks = [];
    game.combat.activeExpansions = [];
    game.combat.continuousAttacks = [];
    game.combat.currentPushes = [];
    return { ok: true, message: "Sandbox: cleared active attacks." };
  }

  reinforce(tile, amount, clear = false) {
    if (!tile || config.TILE_TYPES[tile.type]?.blocks) return { ok: false, message: "Sandbox: select a playable border tile." };
    tile.defenseEnergy = clear ? 0 : Math.min(120, (tile.defenseEnergy || 0) + Number(amount || 40));
    tile.lastChanged = this.game.now();
    return { ok: true, message: clear ? "Sandbox: reinforcement removed." : "Sandbox: border reinforced." };
  }

  spawnObjective(game, selectedTile, requestedType) {
    const type = this.objectiveType(requestedType);
    const definition = objectives.LAKE_OBJECTIVES[type];
    if (!definition) return { ok: false, message: "Sandbox command failed: unknown objective." };
    const tile = selectedTile && !config.TILE_TYPES[selectedTile.type]?.blocks ? selectedTile : game.tileManager.playable().find((entry) => !entry.objectiveId && !entry.campId);
    if (!tile) return { ok: false, message: "Sandbox: no objective tile available." };
    if (tile.objectiveId) this.removeObjective(game, tile);
    const id = `sandbox-${type}-${Date.now().toString(36)}`;
    tile.objectiveId = id;
    tile.objectiveType = type;
    tile.specialActive = true;
    tile.defenseEnergy = Math.max(tile.defenseEnergy || 0, 16);
    game.objectives.objectives.push({ id, type, tileId: tile.id, active: true, appeared: true, activeAt: game.now(), owner: tile.owner || null });
    return { ok: true, message: `Sandbox: spawned ${definition.label}.` };
  }

  objectiveType(value) {
    const clean = String(value || "goldenLily").replace(/[^a-z]/gi, "").toLowerCase();
    return Object.keys(objectives.LAKE_OBJECTIVES).find((key) => key.toLowerCase() === clean) || "goldenLily";
  }

  removeObjective(game, tile) {
    if (!tile?.objectiveId) return { ok: false, message: "Sandbox: selected tile has no objective." };
    const id = tile.objectiveId;
    game.objectives.objectives = game.objectives.objectives.filter((objective) => objective.id !== id);
    game.objectives.objectiveOwner.delete(id);
    tile.objectiveId = null;
    tile.objectiveType = null;
    tile.specialActive = Boolean(tile.campId);
    return { ok: true, message: "Sandbox: objective removed." };
  }

  clearObjectives(game) {
    game.objectives.objectives = [];
    game.objectives.objectiveOwner.clear();
    game.tileManager.tiles.forEach((tile) => {
      tile.objectiveId = null;
      tile.objectiveType = null;
      tile.specialActive = Boolean(tile.campId);
    });
  }

  clearPings(game) {
    game.events = game.events.filter((event) => event.kind !== "ping" && event.kind !== "signal" && event.kind !== "teamCommand");
    return { ok: true, message: "Sandbox: pings cleared." };
  }

  resetMap(game, player) {
    const settings = game.matchSettings;
    game.reset(player.animal, settings.difficulty, {
      ...settings,
      accountUser: settings.accountUser || null,
      sandbox: true,
      sandboxRules: this.rules,
      sandboxSpeed: this.speed,
      botCount: settings.botCount,
      difficulty: this.defaultBotDifficulty,
      mapSize: settings.mapSize,
      playerName: player.name,
      allowBots: true,
    });
    game.pushEvent({ kind: "notice", message: "Sandbox map reset.", at: game.now() });
    return { ok: true, message: "Sandbox: map reset.", resetPerformed: true };
  }

  resetEconomy(game, player) {
    player.energy = Math.min(player.maxEnergy, 64);
    player.flags.warExhaustion = 0;
    game.economy.recalculate(game.players, game.now(), game);
    return { ok: true, message: "Sandbox: economy reset." };
  }

  ruleLabel(key) {
    return String(key).replace(/([A-Z])/g, " $1").toLowerCase();
  }

  botTurnMode(bot) {
    if (!this.enabled || !bot?.isBot) return "";
    return bot.flags?.sandboxPersonality || this.defaultBotPersonality || bot.personality;
  }

  snapshot(game) {
    if (!this.enabled) return null;
    return {
      enabled: true,
      rules: { ...this.rules },
      speed: this.speed,
      simulationPaused: this.simulationPaused,
      botsPaused: this.botsPaused,
      debug: { ...this.debug },
      defaultBotDifficulty: this.defaultBotDifficulty,
      defaultBotPersonality: this.defaultBotPersonality,
      botCount: game.players.filter((player) => player.isBot && !player.defeated).length,
      statsDisabled: true,
    };
  }
}

module.exports = SandboxManager;
