(function initPondGame(root) {
  class PondGameClient {
    constructor() {
      this.canvas = document.querySelector("#mapCanvas");
      this.miniMap = document.querySelector("#miniMap");
      this.ui = new root.PondUI();
      this.renderer = new root.PondRenderer(this.canvas, this.miniMap);
      this.contextMenu = root.PondContextMenu ? new root.PondContextMenu() : null;
      this.state = null;
      this.tileMap = new Map();
      this.selectedTileId = null;
      this.selectedPlayerId = null;
      this.hoverTileId = null;
      this.sourceIds = [];
      this.preview = null;
      this.rallyTileId = null;
      this.mode = "expand";
      this.pointer = null;
      this.longPressTimer = null;
      this.pollTimer = null;
      this.fetching = false;
      this.seenEventIds = new Set();
      this.bind();
      this.loop();
    }

    bind() {
      this.ui.on("start", (payload) => this.start(payload));
      this.ui.on("action", (payload) => this.handleAction(payload));
      this.ui.on("diplomacy", (command) => this.handleDiplomacy(command));
      this.ui.on("viewChanged", () => this.updateUi());
      this.contextMenu?.on("action", (payload) => this.handleContextAction(payload));
      this.contextMenu?.on("preview", (payload) => this.setActionPreview(payload));
      this.contextMenu?.on("close", () => {
        this.preview = null;
      });

      window.addEventListener("resize", () => this.renderer.resize());
      window.addEventListener("keydown", (event) => this.handleKey(event));
      this.canvas.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
      this.canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
      this.canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
      this.canvas.addEventListener("pointerup", (event) => this.handlePointerUp(event));
      this.canvas.addEventListener("pointercancel", () => {
        this.clearLongPress();
        this.pointer = null;
      });
      this.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (!this.state) return;
        const tile = this.renderer.screenToTile(event.clientX, event.clientY);
        this.openContextMenu(tile, event.clientX, event.clientY);
      });
    }

    async start(payload) {
      this.ui.nodes.startButton.disabled = true;
      try {
        const animal = root.PondAnimals?.[payload.animal] ? payload.animal : "duck";
        const difficulty = ["easy", "normal", "smart", "chaos"].includes(payload.difficulty) ? payload.difficulty : "normal";
        const state = await this.request("/api/start", {
          method: "POST",
          body: JSON.stringify({
            animal,
            difficulty,
            playerName: payload.playerName,
            botCount: payload.botCount,
            mapSize: payload.mapSize,
            matchLength: payload.matchLength,
            practice: Boolean(payload.practice),
          }),
        });
        this.resetSelection();
        this.seenEventIds.clear();
        this.setState(state, { silent: true });
        this.ui.showGame();
        this.ui.toast("Match started. Click a glowing border target, then send energy.");
        this.startPolling();
        requestAnimationFrame(() => this.renderer.resize());
      } catch (error) {
        this.ui.toast(error.message || "Could not start match.", true);
      } finally {
        this.ui.nodes.startButton.disabled = false;
      }
    }

    startPolling() {
      clearInterval(this.pollTimer);
      this.pollTimer = setInterval(() => this.fetchState(), 450);
      this.fetchState();
    }

    async fetchState() {
      if (this.fetching) return;
      this.fetching = true;
      try {
        const state = await this.request("/api/state");
        this.setState(state);
      } catch (error) {
        this.ui.toast("Server connection paused.", true);
      } finally {
        this.fetching = false;
      }
    }

    async request(path, options = {}) {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.message || "Request failed.");
        error.data = data;
        throw error;
      }
      return data;
    }

    setState(state, options = {}) {
      this.state = state;
      this.tileMap = new Map(state.tiles.map((tile) => [tile.id, tile]));
      this.renderer.setState(state);
      const newEvents = state.events.filter((event) => !this.seenEventIds.has(event.id));
      state.events.forEach((event) => this.seenEventIds.add(event.id));
      this.renderer.addEvents(newEvents);
      this.pruneSelection();
      if (!options.silent) this.showEventToasts(newEvents);
      this.updateBuildOptions();
      this.updateUi();
    }

    showEventToasts(events) {
      events.forEach((event) => {
        if (event.kind === "notice" && event.message) {
          this.ui.toast(event.message, event.ok === false);
        }
        if (event.kind === "ended") {
          this.ui.toast(event.message || "Match over.");
        }
        if (event.kind === "diplomacy" && this.involvesHuman(event)) {
          const actor = this.player(event.playerId);
          const target = this.player(event.targetId);
          const names = `${actor?.name || "Player"} and ${target?.name || "Player"}`;
          const message =
            event.subtype === "alliance"
              ? `Alliance formed: ${names}.`
              : event.subtype === "broken"
                ? `Alliance broken: ${names}.`
                : event.subtype === "enemy"
                  ? `${actor?.name || "Player"} marked ${target?.name || "Player"} as enemy.`
                  : `${target?.name || "Player"} declined for now.`;
          this.ui.toast(message, event.subtype === "declined");
        }
        if (event.kind === "signal" && this.involvesHuman(event)) {
          const actor = this.player(event.playerId);
          this.ui.toast(`${actor?.name || "Player"} sent a pond signal.`);
        }
        if (event.kind === "ping" && this.involvesHuman(event)) {
          const actor = this.player(event.playerId);
          const label = root.PondInfo?.PING_LABELS?.[event.pingType] || "Signal";
          this.ui.toast(`${actor?.name || "Player"}: ${label}.`);
        }
        if (event.kind === "waveEnd" && this.involvesHuman(event)) {
          const captured = event.captured || 0;
          this.ui.toast(captured > 0 ? `Frontline wave captured ${captured} tiles.` : event.message || "Attack wave stopped.", captured === 0);
        }
      });
    }

    involvesHuman(event) {
      return Boolean(
        this.state &&
          (event.playerId === this.state.humanId || event.targetId === this.state.humanId || event.targetOwner === this.state.humanId),
      );
    }

    updateUi() {
      if (!this.state) return;
      const tile = this.selectedTile() || this.hoverTile();
      this.ui.update(this.state, tile, this.selectedPlayerId, this.tileContext(tile));
    }

    updateBuildOptions() {
      const human = this.human();
      if (!human) return;
      const select = this.ui.nodes.buildSelect;
      [...select.options].forEach((option) => {
        const building = this.state.config.buildings[option.value];
        option.disabled = Boolean(building?.animal && building.animal !== human.animal);
      });
      if (select.selectedOptions[0]?.disabled) {
        const next = [...select.options].find((option) => !option.disabled);
        if (next) select.value = next.value;
      }
    }

    async handleAction(payload) {
      if (!this.state || this.state.ended) return;
      const type = payload.type;
      if (type === "ability") {
        await this.postAction({ type, tileId: this.selectedTile()?.id });
        return;
      }

      const tile = this.selectedTile();
      const human = this.human();
      if (!tile || !human) {
        this.ui.toast("Choose a target tile first.", true);
        this.renderer.vfx?.spawnScreenNotice("Invalid Target", "#d96b61");
        return;
      }

      const blocked = this.isBlocked(tile);
      if (type === "expand" && (blocked || tile.owner)) {
        this.ui.toast("Expand needs a neutral border tile.", true);
        this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
        return;
      }
      if (type === "attack" && (!tile.owner || tile.owner === human.id || this.isAllied(tile.owner))) {
        this.ui.toast("Attack needs a connected enemy border.", true);
        this.renderer.vfx?.spawnBlockedEffect(tile.id, this.isAllied(tile.owner) ? "Ally" : "Invalid");
        return;
      }
      if (type === "defend" && tile.owner !== human.id) {
        this.ui.toast("Choose your territory to defend.", true);
        this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
        return;
      }
      if (type === "build" && tile.owner !== human.id) {
        this.ui.toast("Choose your territory to build.", true);
        this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
        return;
      }

      const spend = human.energy * this.ui.percent;
      if ((type === "expand" || type === "attack") && spend < 4) {
        this.ui.toast("Not enough Animal Energy to send.", true);
        this.ui.flashEnergy();
        return;
      }
      if (type === "defend" && spend * 0.75 < 3) {
        this.ui.toast("Not enough Animal Energy to defend.", true);
        this.ui.flashEnergy();
        return;
      }

      this.mode = type;
      const action = {
        type,
        tileId: tile.id,
        percent: this.ui.percent,
        buildingType: payload.buildingType,
      };
      if (type === "expand" || type === "attack") action.sourceIds = this.validSourceTiles().map((source) => source.id);
      await this.postAction(action);
    }

    async handleDiplomacy(command) {
      if (!this.state || !this.selectedPlayerId) {
        this.ui.toast("Select another player first.", true);
        return;
      }
      await this.postAction({
        type: "diplomacy",
        targetId: this.selectedPlayerId,
        command,
      });
    }

    async postAction(body) {
      try {
        const response = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (data.state) this.setState(data.state, { silent: true });
        if (!response.ok) this.feedbackFailedAction(body, data.message || "Command failed.");
        else if (body.type === "ability") this.ui.pulseAbility(false);
        this.ui.toast(data.message || (response.ok ? "Command sent." : "Command failed."), !response.ok);
      } catch (error) {
        this.ui.toast("Server did not receive the command.", true);
      }
    }

    feedbackFailedAction(body, message) {
      if (message.includes("Energy")) this.ui.flashEnergy();
      if (body.type === "ability") {
        this.ui.pulseAbility(true);
        this.renderer.vfx?.spawnScreenNotice(message.includes("cool") ? "Cooldown" : "Ability Blocked", "#d96b61");
        return;
      }
      if (body.tileId != null) {
        const label = message.includes("defense") ? "Defended" : message.includes("ally") ? "Ally" : "Invalid";
        this.renderer.vfx?.spawnBlockedEffect(body.tileId, label);
      } else {
        this.renderer.vfx?.spawnScreenNotice(message, "#d96b61");
      }
    }

    handleWheel(event) {
      if (!this.state) return;
      event.preventDefault();
      this.renderer.zoomAt(event.clientX, event.clientY, event.deltaY);
    }

    handlePointerDown(event) {
      if (!this.state) return;
      const tile = this.renderer.screenToTile(event.clientX, event.clientY);

      if (event.button === 2) {
        event.preventDefault();
        this.openContextMenu(tile, event.clientX, event.clientY);
        return;
      }

      this.canvas.setPointerCapture?.(event.pointerId);
      this.contextMenu?.close();
      this.pointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        panning: event.button === 1 || event.altKey,
        selecting: false,
      };
      if (event.pointerType === "touch" && event.button === 0) {
        this.longPressTimer = setTimeout(() => {
          this.pointer = null;
          this.openContextMenu(tile, event.clientX, event.clientY);
        }, 560);
      }

      if (event.button !== 0) return;
      const humanId = this.state.humanId;
      if (tile?.owner === humanId && this.isBorder(tile, humanId)) {
        this.pointer.selecting = true;
        this.addSource(tile, event.shiftKey || event.ctrlKey || event.metaKey);
        this.selectTile(tile, { preserveSources: true });
      }
    }

    handlePointerMove(event) {
      if (!this.state) return;
      const tile = this.renderer.screenToTile(event.clientX, event.clientY);
      const nextHover = tile?.id ?? null;
      if (nextHover !== this.hoverTileId) {
        this.hoverTileId = nextHover;
        if (this.selectedTileId == null) this.updateUi();
      }

      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const dx = event.clientX - this.pointer.lastX;
      const dy = event.clientY - this.pointer.lastY;
      const total = Math.hypot(event.clientX - this.pointer.startX, event.clientY - this.pointer.startY);
      if (total > 5) {
        this.pointer.moved = true;
        this.clearLongPress();
      }

      if (this.pointer.panning || (this.pointer.moved && !this.pointer.selecting)) {
        this.pointer.panning = true;
        this.renderer.pan(dx, dy);
      } else if (this.pointer.selecting && tile?.owner === this.state.humanId && this.isBorder(tile, this.state.humanId)) {
        this.addSource(tile, true);
      }

      this.pointer.lastX = event.clientX;
      this.pointer.lastY = event.clientY;
    }

    handlePointerUp(event) {
      if (!this.state || !this.pointer || this.pointer.id !== event.pointerId) {
        this.pointer = null;
        return;
      }
      const tile = this.renderer.screenToTile(event.clientX, event.clientY);
      const wasClick = !this.pointer.moved && !this.pointer.panning && !this.pointer.selecting;
      const wasSourceDrag = this.pointer.selecting;
      this.pointer = null;
      this.clearLongPress();

      if (wasClick) this.selectTile(tile);
      if (wasSourceDrag) this.updateUi();
    }

    handleKey(event) {
      if (!this.state) return;
      if (event.key === "Escape") {
        this.contextMenu?.close();
        this.preview = null;
        this.resetSelection();
        this.updateUi();
      }
      if (event.key.toLowerCase() === "f") this.renderer.fit(true);
    }

    clearLongPress() {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    openContextMenu(tile, x, y) {
      if (!this.contextMenu || !this.state || !tile) return;
      this.selectTile(tile, { preserveSources: true });
      this.renderer.vfx?.spawnPulse(tile.id, "#87d7ea", 0.92);
      const menu = this.buildContextMenu(tile);
      this.contextMenu.open({ x, y, ...menu });
    }

    buildContextMenu(tile) {
      const human = this.human();
      const type = this.state.config.tileTypes[tile.type];
      const owner = tile.owner ? this.player(tile.owner) : null;
      const ownerText = owner ? (owner.id === human.id ? "Your territory" : owner.name) : type.blocks ? "Blocked" : "Neutral";
      const items = [];
      const add = (label, payload, options = {}) => items.push({ label, payload: { tileId: tile.id, ...payload }, preview: { tileId: tile.id, ...payload }, ...options });
      const sep = () => {
        if (items.length && !items[items.length - 1].separator) items.push({ separator: true });
      };

      if (this.isBlocked(tile)) {
        add("Blocked Terrain", { action: "viewTerrain" }, { icon: "X", disabled: true, hint: "Rock blocks movement" });
        add("View Info", { action: "viewTerrain" }, { icon: "i", hint: root.PondInfo?.terrainText(tile.type) });
        return { title: type.label, subtitle: ownerText, items };
      }

      if (!tile.owner) {
        const canExpand = Boolean(this.closestSource(tile));
        const cost = this.neutralExpansionCost(tile);
        const progress = Math.round(tile.captureProgress?.[human.id] || 0);
        add("Expand Here", { action: "expand", percent: this.ui.percent }, { icon: "E", disabled: !canExpand, hint: canExpand ? "Use selected send percent" : "Too far from your border" });
        [0.25, 0.5].forEach((percent) =>
          add(`Expand ${Math.round(percent * 100)}%`, { action: "expand", percent }, { icon: `${Math.round(percent * 100)}`, disabled: !canExpand, hint: "Quick neutral capture" }),
        );
        add("Preview Expansion Cost", { action: "previewCost" }, { icon: "$", hint: `Progress ${progress}/${cost}` });
        add("View Terrain Info", { action: "viewTerrain" }, { icon: "i", hint: root.PondInfo?.terrainText(tile.type) });
        return { title: type.label, subtitle: "Neutral pond tile", items };
      }

      if (tile.owner === human.id) {
        if (tile.building) {
          const building = this.state.config.buildings[tile.building];
          add("View Building Info", { action: "viewBuilding" }, { icon: "i", hint: root.PondInfo?.buildingText(tile.building) });
          add("Upgrade Building", { action: "upgradeBuilding" }, { icon: "+", hint: `${building?.label || "Building"} level ${tile.buildingLevel || 1}` });
          add("Remove Building", { action: "removeBuilding" }, { icon: "-", danger: true, hint: "Clear this building slot" });
          add("Defend Building", { action: "defend", percent: 0.5 }, { icon: "D", hint: "Reinforce this tile" });
          sep();
        }

        if (this.isBorder(tile, human.id)) {
          [0.25, 0.5, 1].forEach((percent) =>
            add(`Defend ${Math.round(percent * 100)}%`, { action: "defend", percent }, { icon: "D", hint: "Store energy in this border" }),
          );
        } else {
          add("Defend Border", { action: "defend", percent: 0.25 }, { icon: "D", disabled: true, hint: "Choose an outer border tile" });
        }

        if (!tile.building) {
          sep();
          this.buildingMenuItems(human, tile).forEach((item) => items.push(item));
        }

        sep();
        add("Set Rally Point", { action: "rally" }, { icon: "R", hint: "Mark this as your focus point" });
        add("Use Ability Here", { action: "ability" }, { icon: "A", hint: root.PondInfo?.abilityTip(human.animal) });
        add("View Tile Info", { action: "viewTile" }, { icon: "i", hint: "Show tile details in the panel" });
        add("Ping Defend Here", { action: "ping", pingType: "defend" }, { icon: "P", hint: "Signal a defensive focus" });
        return { title: "Your Territory", subtitle: type.label, items };
      }

      if (this.isAllied(tile.owner)) {
        add("Send Signal", { action: "ping", pingType: "good", targetId: tile.owner }, { icon: "P", hint: "Ally-visible signal" });
        add("Request Help", { action: "ping", pingType: "help", targetId: tile.owner }, { icon: "H", hint: "Ask ally to support this area" });
        add("Ping Danger", { action: "ping", pingType: "danger", targetId: tile.owner }, { icon: "!", hint: "Warn your ally" });
        add("View Ally Info", { action: "viewPlayer", targetId: tile.owner }, { icon: "i", hint: "Open player details" });
        add("Break Alliance", { action: "diplomacy", command: "breakAlliance", targetId: tile.owner }, { icon: "B", danger: true, hint: "End friendly status" });
        return { title: owner?.name || "Ally", subtitle: `${type.label} | Alliance`, items };
      }

      const attackable = this.isAttackableBorder(tile);
      if (attackable) {
        [0.1, 0.25, 0.5, 0.75, 1].forEach((percent) =>
          add(`Attack ${Math.round(percent * 100)}%`, { action: "attack", percent, targetId: tile.owner }, { icon: "A", danger: percent >= 0.75, hint: "Launch frontline wave" }),
        );
      } else {
        add("Too Far To Attack", { action: "viewPlayer", targetId: tile.owner }, { icon: "X", disabled: true, hint: "Need a connected enemy border" });
      }

      sep();
      add("Request Alliance", { action: "diplomacy", command: "requestAlliance", targetId: tile.owner }, { icon: "A", hint: "Ask for friendly borders" });
      add("Send Peace", { action: "diplomacy", command: "sendPeace", targetId: tile.owner }, { icon: "P", hint: "Lower tension" });
      add("Mark Enemy", { action: "diplomacy", command: "markEnemy", targetId: tile.owner }, { icon: "M", danger: true, hint: "Track this rival" });
      add("View Enemy Info", { action: "viewPlayer", targetId: tile.owner }, { icon: "i", hint: "Show strength and relation" });
      add("Send Warning", { action: "ping", pingType: "warning", targetId: tile.owner }, { icon: "!", danger: true, hint: "Public warning signal" });
      return { title: owner?.name || "Enemy", subtitle: attackable ? "Enemy border" : "Enemy interior", items };
    }

    buildingMenuItems(human, tile) {
      return Object.entries(this.state.config.buildings).map(([buildingType, building]) => {
        const wrongAnimal = building.animal && building.animal !== human.animal;
        const badTerrain = !building.validTiles.includes(tile.type);
        const cost = this.buildingCost(buildingType, human);
        const noEnergy = human.energy < cost;
        const farmLimit = buildingType === "lilyFarm" && human.buildings?.lilyFarm >= this.maxLilyFarms(human);
        const farmSupport = buildingType !== "lilyFarm" || this.hasLilyFarmSupport(tile);
        const disabled = wrongAnimal || badTerrain || noEnergy || farmLimit || !farmSupport;
        const reason = wrongAnimal
          ? "Wrong animal"
          : badTerrain
            ? "Invalid terrain"
            : farmLimit
              ? "Farm limit"
              : !farmSupport
                ? "Needs lily or nest nearby"
            : noEnergy
              ? "Not enough energy"
              : `${cost} energy`;
        return {
          label: `Build ${building.label}`,
          icon: "B",
          disabled,
          hint: reason,
          payload: { action: "build", tileId: tile.id, buildingType },
          preview: { action: "build", tileId: tile.id, buildingType },
        };
      });
    }

    async handleContextAction(payload) {
      if (!this.state || this.state.ended || !payload?.action) return;
      const tile = this.tileMap.get(payload.tileId);
      if (tile) this.selectTile(tile, { preserveSources: true });
      if (payload.percent) this.ui.setPercent(payload.percent);

      if (payload.action === "viewTile" || payload.action === "viewTerrain" || payload.action === "previewCost") {
        this.showTileInfo(tile, payload.action);
        return;
      }
      if (payload.action === "viewBuilding") {
        this.ui.toast(root.PondInfo?.buildingText(tile?.building) || "Building info.");
        return;
      }
      if (payload.action === "viewPlayer") {
        this.selectedPlayerId = payload.targetId || tile?.owner || null;
        this.updateUi();
        const summary = root.PondInfo?.playerSummary(this.state, this.selectedPlayerId);
        this.ui.toast(summary?.meta || "Player info opened.");
        return;
      }
      if (payload.action === "rally") {
        this.rallyTileId = tile?.id ?? null;
        if (tile) this.renderer.vfx?.spawnPulse(tile.id, "#f2d87a", 1.25);
        this.ui.toast("Rally point set.");
        return;
      }
      if (payload.action === "ping") {
        await this.postAction({ type: "ping", tileId: tile?.id, pingType: payload.pingType, targetId: payload.targetId });
        return;
      }
      if (payload.action === "diplomacy") {
        this.selectedPlayerId = payload.targetId || tile?.owner || null;
        await this.postAction({ type: "diplomacy", targetId: this.selectedPlayerId, command: payload.command });
        return;
      }
      if (payload.action === "ability") {
        await this.postAction({ type: "ability", tileId: tile?.id });
        return;
      }
      if (payload.action === "upgradeBuilding" || payload.action === "removeBuilding") {
        await this.postAction({ type: payload.action, tileId: tile?.id });
        return;
      }
      if (payload.action === "build") {
        await this.postAction({ type: "build", tileId: tile?.id, buildingType: payload.buildingType || this.ui.nodes.buildSelect.value });
        return;
      }
      if (["expand", "attack", "defend"].includes(payload.action)) {
        const action = { type: payload.action, tileId: tile?.id, percent: this.ui.percent };
        if (payload.action === "expand") action.sourceIds = this.validSourceTiles().map((source) => source.id);
        if (payload.action === "attack") action.sourceIds = this.validSourceTiles().map((source) => source.id);
        await this.postAction(action);
      }
    }

    showTileInfo(tile, action) {
      if (!tile) return;
      this.updateUi();
      const type = this.state.config.tileTypes[tile.type];
      if (action === "previewCost") {
        const spend = Math.round((this.human()?.energy || 0) * this.ui.percent);
        const cost = this.neutralExpansionCost(tile);
        const progress = Math.round(tile.captureProgress?.[this.state.humanId] || 0);
        const remaining = Math.max(0, cost - progress);
        const estimate = tile.owner ? this.estimateWave(tile, spend) : { tiles: spend >= remaining ? 1 : 0, nextCost: remaining };
        this.ui.toast(`Cost preview: ${progress}/${cost}. Send ${Math.min(spend, remaining)} of ${remaining} remaining.`);
        return;
      }
      this.ui.toast(root.PondInfo?.terrainText(tile.type) || `${type.label} info.`);
    }

    setActionPreview(payload) {
      if (!payload || !this.state) {
        this.preview = null;
        return;
      }
      const tile = this.tileMap.get(payload.tileId);
      const human = this.human();
      if (!tile || !human) {
        this.preview = null;
        return;
      }

      if (payload.action === "attack" && this.isAttackableBorder(tile)) {
        const percent = payload.percent || this.ui.percent;
        const energy = Math.round(human.energy * percent);
        const source = this.closestSource(tile);
        const estimate = this.estimateWaveTiles(tile, energy);
        this.preview = {
          mode: "attack",
          tileIds: estimate.ids,
          fromId: source?.id,
          toId: tile.id,
          label: `${Math.round(percent * 100)}% | ${estimate.ids.length} tiles`,
        };
        return;
      }

      if (payload.action === "expand") {
        const source = this.closestSource(tile);
        const progress = Math.round(tile.captureProgress?.[human.id] || 0);
        const cost = this.neutralExpansionCost(tile, source && !this.neighbors(source).some((neighbor) => neighbor.id === tile.id));
        const remaining = Math.max(0, cost - progress);
        this.preview = source
          ? {
              mode: "expand",
              tileIds: [tile.id],
              fromId: source.id,
              toId: tile.id,
              label: `${Math.round((payload.percent || this.ui.percent) * 100)}% | ${remaining} left`,
            }
          : null;
        return;
      }

      if (payload.action === "defend") {
        this.preview = {
          mode: "defend",
          tileIds: tile.owner === human.id ? [tile.id] : this.humanBorders().map((candidate) => candidate.id).slice(0, 80),
          label: `Defend ${Math.round((payload.percent || this.ui.percent) * 100)}%`,
        };
        return;
      }

      if (payload.action === "build") {
        const valid = this.canBuildHere(human, tile, payload.buildingType);
        this.preview = {
          mode: "build",
          tileIds: valid ? [tile.id] : this.state.tiles.filter((candidate) => this.canBuildHere(human, candidate, payload.buildingType)).map((candidate) => candidate.id),
          label: this.state.config.buildings[payload.buildingType]?.label || "Build",
        };
        return;
      }

      if (payload.action === "ping" || payload.action === "rally") {
        this.preview = { mode: "signal", tileIds: [tile.id], label: root.PondInfo?.PING_LABELS?.[payload.pingType] || "Signal" };
        return;
      }

      this.preview = null;
    }

    isAttackableBorder(tile) {
      if (!tile?.owner || tile.owner === this.state.humanId || this.isAllied(tile.owner)) return false;
      const source = this.closestSource(tile);
      return Boolean(source && this.neighbors(source).some((neighbor) => neighbor.id === tile.id));
    }

    selectTile(tile, options = {}) {
      if (!tile) {
        this.selectedTileId = null;
        this.selectedPlayerId = null;
        this.mode = "expand";
        this.updateUi();
        return;
      }

      const humanId = this.state.humanId;
      this.selectedTileId = tile.id;
      this.selectedPlayerId = tile.owner && tile.owner !== humanId ? tile.owner : null;

      if (tile.owner === humanId) {
        this.mode = this.isBorder(tile, humanId) ? "defend" : "build";
        if (this.isBorder(tile, humanId) && !options.preserveSources) this.sourceIds = [tile.id];
      } else if (tile.owner) {
        this.mode = this.isAllied(tile.owner) ? "diplomacy" : "attack";
        if (!options.preserveSources) this.ensureSourceFor(tile);
      } else if (this.isBlocked(tile)) {
        this.mode = "blocked";
      } else {
        this.mode = "expand";
        if (!options.preserveSources) this.ensureSourceFor(tile);
      }
      this.updateUi();
    }

    addSource(tile, append) {
      if (!append) this.sourceIds = [];
      if (!this.sourceIds.includes(tile.id)) this.sourceIds.push(tile.id);
      this.sourceIds = this.validSourceTiles().map((source) => source.id);
    }

    ensureSourceFor(target) {
      const validCurrent = this.validSourceTiles();
      if (validCurrent.some((source) => this.sourceCanReach(source, target))) return;
      const source = this.closestSource(target);
      this.sourceIds = source ? [source.id] : [];
    }

    closestSource(target) {
      return this.humanBorders()
        .filter((source) => this.sourceCanReach(source, target))
        .sort((a, b) => this.distance(a, target) - this.distance(b, target))[0];
    }

    validSourceTiles() {
      return this.sourceIds
        .map((id) => this.tileMap.get(id))
        .filter((tile) => tile?.owner === this.state?.humanId && this.isBorder(tile, this.state.humanId));
    }

    legalTileIds() {
      if (!this.state) return [];
      const human = this.human();
      if (!human) return [];
      const buildingType = this.ui.nodes.buildSelect.value;

      if (this.mode === "build") {
        return this.state.tiles
          .filter((tile) => this.canBuildHere(human, tile, buildingType))
          .map((tile) => tile.id);
      }

      if (this.mode === "defend") {
        return this.state.tiles
          .filter((tile) => tile.owner === human.id && this.isBorder(tile, human.id))
          .map((tile) => tile.id);
      }

      const mode = this.mode === "attack" || this.mode === "diplomacy" ? "attack" : "expand";
      const sources = this.validSourceTiles().length ? this.validSourceTiles() : this.humanBorders();
      const ids = new Set();
      sources.forEach((source) => {
        this.neighbors(source).forEach((target) => this.addLegalTarget(ids, target, mode));
        if (human.animal === "frog" && mode === "expand") {
          const range = human.buildings?.jumpPad ? 3 : 2;
          for (let y = source.y - range; y <= source.y + range; y += 1) {
            for (let x = source.x - range; x <= source.x + range; x += 1) {
              const target = this.tileAt(x, y);
              const d = Math.abs(source.x - x) + Math.abs(source.y - y);
              if (d > 1 && d <= range) this.addLegalTarget(ids, target, mode);
            }
          }
        }
      });
      return [...ids];
    }

    addLegalTarget(ids, tile, mode) {
      if (!tile || this.isBlocked(tile) || tile.owner === this.state.humanId) return;
      if (tile.owner && this.isAllied(tile.owner)) return;
      if (mode === "attack" && !tile.owner) return;
      if (mode === "expand" && tile.owner) return;
      ids.add(tile.id);
    }

    canBuildHere(human, tile, buildingType) {
      const building = this.state.config.buildings[buildingType];
      if (!building || tile.owner !== human.id || tile.building) return false;
      if (building.animal && building.animal !== human.animal) return false;
      return building.validTiles.includes(tile.type);
    }

    pruneSelection() {
      const tile = this.selectedTile();
      const humanId = this.state?.humanId;
      if (this.selectedTileId != null && !tile) this.selectedTileId = null;
      this.sourceIds = this.validSourceTiles().map((source) => source.id);
      if (this.selectedPlayerId) {
        const player = this.player(this.selectedPlayerId);
        if (!player || player.defeated || this.selectedPlayerId === humanId) this.selectedPlayerId = null;
      }
      if (tile?.owner && tile.owner !== humanId) this.selectedPlayerId = tile.owner;
      if (!tile?.owner || tile.owner === humanId) this.selectedPlayerId = null;
    }

    resetSelection() {
      this.selectedTileId = null;
      this.selectedPlayerId = null;
      this.hoverTileId = null;
      this.sourceIds = [];
      this.preview = null;
      this.mode = "expand";
    }

    loop() {
      const draw = () => {
        const view = this.ui.viewOptions();
        this.renderer.draw({
          ...view,
          selectedTileId: this.selectedTileId,
          hoverTileId: this.hoverTileId,
          sourceIds: this.sourceIds,
          legalTileIds: this.legalTileIds(),
          preview: this.preview,
          rallyTileId: this.rallyTileId,
          mode: this.mode,
        });
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }

    selectedTile() {
      return this.selectedTileId == null ? null : this.tileMap.get(this.selectedTileId) || null;
    }

    hoverTile() {
      return this.hoverTileId == null ? null : this.tileMap.get(this.hoverTileId) || null;
    }

    human() {
      return this.state?.players.find((player) => player.id === this.state.humanId) || null;
    }

    player(id) {
      return this.state?.players.find((candidate) => candidate.id === id) || null;
    }

    isAllied(playerId) {
      return Boolean(this.human()?.allies.includes(playerId));
    }

    isBlocked(tile) {
      return Boolean(tile && this.state.config.tileTypes[tile.type]?.blocks);
    }

    neutralExpansionCost(tile, jumped = false) {
      const human = this.human();
      const type = this.state?.config.tileTypes[tile?.type];
      if (!tile || !type) return 0;
      const core = human?.coreTileId != null ? this.tileMap.get(human.coreTileId) : null;
      const distanceFromCore = core ? this.distance(core, tile) : 0;
      const nearbyEnemyBorders = this.neighbors(tile).filter((neighbor) => neighbor.owner && neighbor.owner !== human?.id).length;
      return (
        root.PondConfig?.getNeutralTileExpansionCost?.(tile.type, human?.animal, {
          jumped,
          flockRush: human?.animal === "duck" && this.state.serverTime < human.abilityActiveUntil,
          mudTunnel: Boolean(human?.flags?.mudTunnel),
          jumpPad: Boolean(human?.flags?.jumpPad),
          territory: human?.territory || 0,
          distanceFromCore,
          nearbyEnemyBorders,
        }) || type.captureCost
      );
    }

    buildingCost(buildingType, human = this.human()) {
      const configured = this.state?.config?.buildingCosts?.[buildingType];
      if (configured != null) return configured;
      const building = this.state?.config?.buildings?.[buildingType];
      if (!building) return Infinity;
      if (buildingType !== "lilyFarm") return building.cost;
      const balance = this.state.config.balance || root.PondBalance || {};
      const farms = human?.buildings?.lilyFarm || 0;
      return Math.round((balance.farmBaseCost || building.cost) * Math.pow(1 + (balance.farmCostGrowth || 0.2), farms));
    }

    maxLilyFarms(human = this.human()) {
      const balance = this.state?.config?.balance || root.PondBalance || {};
      return Math.max(1, Math.floor((human?.territory || 0) / (balance.farmTerritoryPerFarm || 18)) + 1);
    }

    hasLilyFarmSupport(tile) {
      return Boolean(tile && (tile.type === "lily" || tile.type === "nest" || this.neighbors(tile).some((neighbor) => neighbor.type === "lily" || neighbor.type === "nest")));
    }

    tileAt(x, y) {
      if (!this.state || x < 0 || y < 0 || x >= this.state.cols || y >= this.state.rows) return null;
      return this.tileMap.get(y * this.state.cols + x) || null;
    }

    neighbors(tile) {
      return [
        this.tileAt(tile.x, tile.y - 1),
        this.tileAt(tile.x + 1, tile.y),
        this.tileAt(tile.x, tile.y + 1),
        this.tileAt(tile.x - 1, tile.y),
      ].filter(Boolean);
    }

    isBorder(tile, playerId) {
      return Boolean(
        tile &&
          tile.owner === playerId &&
          this.neighbors(tile).some((neighbor) => neighbor.owner !== playerId && !this.isBlocked(neighbor)),
      );
    }

    humanBorders() {
      const humanId = this.state?.humanId;
      return this.state?.tiles.filter((tile) => this.isBorder(tile, humanId)) || [];
    }

    sourceCanReach(source, target) {
      if (!source || !target || this.isBlocked(target) || target.owner === this.state.humanId) return false;
      if (this.neighbors(source).some((neighbor) => neighbor.id === target.id)) return true;
      if (target.owner) return false;
      const human = this.human();
      if (human?.animal !== "frog") return false;
      const range = human.buildings?.jumpPad ? 3 : 2;
      const d = this.distance(source, target);
      return d > 1 && d <= range;
    }

    tileContext(tile) {
      const human = this.human();
      if (!this.state || !human || !tile) return {};
      const context = {
        canExpand: !tile.owner && !this.isBlocked(tile) && Boolean(this.closestSource(tile)),
        canDefend: tile.owner === human.id && this.isBorder(tile, human.id),
        canBuild: tile.owner === human.id && !tile.building,
      };
      if (!tile.owner && !this.isBlocked(tile)) {
        const source = this.closestSource(tile);
        const jumped = Boolean(source && !this.neighbors(source).some((neighbor) => neighbor.id === tile.id));
        const expansionCost = this.neutralExpansionCost(tile, jumped);
        const expansionProgress = Number(tile.captureProgress?.[human.id] || 0);
        return {
          ...context,
          jumped,
          flockRush: human.animal === "duck" && this.state.serverTime < human.abilityActiveUntil,
          expansionCost,
          expansionProgress,
          estimateText: `${Math.round(expansionProgress)}/${expansionCost} capture`,
        };
      }
      if (!tile.owner || tile.owner === human.id) return context;
      if (this.isAllied(tile.owner)) return { kind: "blockedAttack", reason: "Cannot attack ally" };
      const source = this.closestSource(tile);
      const connected = Boolean(source && this.neighbors(source).some((neighbor) => neighbor.id === tile.id));
      if (!connected) return { kind: "blockedAttack", reason: "Too far from border" };

      const energy = Math.round(human.energy * this.ui.percent);
      const estimate = this.estimateWave(tile, energy);
      return {
        ...context,
        kind: "attackBorder",
        canAttack: true,
        percent: Math.round(this.ui.percent * 100),
        strength: energy,
        tiles: estimate.tiles,
        nextCost: estimate.nextCost,
        estimateText: `${estimate.tiles} tiles with ${Math.round(this.ui.percent * 100)}%`,
      };
    }

    estimateWave(startTile, budget) {
      const human = this.human();
      const defender = this.player(startTile.owner);
      if (!human || !defender || budget <= 0) return { tiles: 0, nextCost: 0 };

      let remaining = budget;
      let captured = 0;
      let nextCost = 0;
      const seen = new Set([startTile.id]);
      const queue = [{ tile: startTile, distance: 0 }];

      while (queue.length && captured < 38) {
        queue.sort((a, b) => a.distance - b.distance || this.estimateTileCost(a.tile, a.distance, defender) - this.estimateTileCost(b.tile, b.distance, defender));
        const current = queue.shift();
        const cost = this.estimateTileCost(current.tile, current.distance, defender);
        if (!nextCost) nextCost = Math.round(cost);
        if (cost > remaining) break;
        remaining -= cost;
        captured += 1;
        this.neighbors(current.tile).forEach((neighbor) => {
          if (seen.has(neighbor.id) || neighbor.owner !== defender.id || this.isBlocked(neighbor)) return;
          seen.add(neighbor.id);
          queue.push({ tile: neighbor, distance: current.distance + 1 });
        });
      }

      return { tiles: captured, nextCost };
    }

    estimateWaveTiles(startTile, budget) {
      const human = this.human();
      const defender = this.player(startTile.owner);
      if (!human || !defender || budget <= 0) return { ids: [], nextCost: 0 };

      let remaining = budget;
      let nextCost = 0;
      const ids = [];
      const seen = new Set([startTile.id]);
      const queue = [{ tile: startTile, distance: 0 }];

      while (queue.length && ids.length < 38) {
        queue.sort((a, b) => a.distance - b.distance || this.estimateTileCost(a.tile, a.distance, defender) - this.estimateTileCost(b.tile, b.distance, defender));
        const current = queue.shift();
        const cost = this.estimateTileCost(current.tile, current.distance, defender);
        if (!nextCost) nextCost = Math.round(cost);
        if (cost > remaining) break;
        remaining -= cost;
        ids.push(current.tile.id);
        this.neighbors(current.tile).forEach((neighbor) => {
          if (seen.has(neighbor.id) || neighbor.owner !== defender.id || this.isBlocked(neighbor)) return;
          seen.add(neighbor.id);
          queue.push({ tile: neighbor, distance: current.distance + 1 });
        });
      }

      return { ids, nextCost };
    }

    estimateTileCost(tile, distance, defender) {
      const type = this.state.config.tileTypes[tile.type];
      const base = tile.building ? 18 : tile.type === "water" ? 6 : tile.type === "lily" ? 8 : tile.type === "reeds" ? 12 : tile.type === "mud" ? 14 : 16;
      const energyRatio = defender.energy / Math.max(1, defender.maxEnergy);
      return Math.max(4, (base + type.defenseBonus * 1.25 + tile.defenseEnergy * 0.8 + distance * 1.1 + Math.min(18, defender.energy * 0.035)) * (0.86 + energyRatio * 0.45));
    }

    distance(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
  }

  root.addEventListener("DOMContentLoaded", () => {
    root.pondFrontGame = new PondGameClient();
  });
})(window);
