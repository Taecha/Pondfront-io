(function initPondSandboxPanel(root) {
  class PondSandboxPanel {
    constructor(options = {}) {
      this.onStart = options.onStart || (() => {});
      this.onAction = options.onAction || (() => {});
      this.getState = options.getState || (() => null);
      this.getSelectedTile = options.getSelectedTile || (() => null);
      this.getSelectedPlayerId = options.getSelectedPlayerId || (() => null);
      this.nodes = {
        startCard: document.querySelector(".start-card"),
        startScreen: document.querySelector("#startScreen"),
        gameScreen: document.querySelector("#gameScreen"),
        sandboxButton: document.querySelector("#sandboxButton"),
        setupPanel: document.querySelector("#sandboxSetupPanel"),
        setupBack: document.querySelector("#sandboxSetupBack"),
        setupBackSecondary: document.querySelector("#sandboxSetupBackSecondary"),
        setupStart: document.querySelector("#sandboxStartButton"),
        preset: document.querySelector("#sandboxPreset"),
        mapSize: document.querySelector("#sandboxMapSize"),
        animal: document.querySelector("#sandboxAnimal"),
        botCount: document.querySelector("#sandboxBotCount"),
        botDifficulty: document.querySelector("#sandboxBotDifficulty"),
        rules: [...document.querySelectorAll("[data-sandbox-rule]")],
        openButton: document.querySelector("#sandboxOpenButton"),
        mobileButton: document.querySelector("#mobileSandboxButton"),
        badge: document.querySelector("#sandboxBadge"),
        panel: document.querySelector("#sandboxPanel"),
        close: document.querySelector("#sandboxCloseButton"),
        title: document.querySelector("#sandboxPanelTitle"),
        status: document.querySelector("#sandboxStatus"),
        debug: document.querySelector("#sandboxDebug"),
        commandForm: document.querySelector("#sandboxCommandForm"),
        commandInput: document.querySelector("#sandboxCommandInput"),
        animalSelect: document.querySelector("#sandboxToolAnimal"),
        maxEnergy: document.querySelector("#sandboxMaxEnergy"),
        botAnimal: document.querySelector("#sandboxBotAnimal"),
        botDifficultyTool: document.querySelector("#sandboxToolBotDifficulty"),
        botPersonality: document.querySelector("#sandboxBotPersonality"),
        botName: document.querySelector("#sandboxBotName"),
        gameSpeed: document.querySelector("#sandboxGameSpeed"),
        buttons: [...document.querySelectorAll("[data-sandbox-tool]")],
      };
      this.state = null;
      this.bind();
      this.applyPreset("empty", false);
    }

    bind() {
      this.nodes.sandboxButton?.addEventListener("click", () => this.openSetup());
      this.nodes.setupBack?.addEventListener("click", () => this.closeSetup());
      this.nodes.setupBackSecondary?.addEventListener("click", () => this.closeSetup());
      this.nodes.setupStart?.addEventListener("click", () => this.startSandbox());
      this.nodes.preset?.addEventListener("change", () => this.applyPreset(this.nodes.preset.value));
      this.nodes.openButton?.addEventListener("click", () => this.openPanel());
      this.nodes.mobileButton?.addEventListener("click", () => this.openPanel());
      this.nodes.close?.addEventListener("click", () => this.closePanel());
      this.nodes.panel?.addEventListener("click", (event) => {
        if (event.target === this.nodes.panel) this.closePanel();
      });
      this.nodes.commandForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        const command = this.nodes.commandInput?.value || "";
        if (!command.trim()) return;
        this.send("command", { command });
        this.nodes.commandInput.value = "";
      });
      this.nodes.buttons.forEach((button) => {
        button.addEventListener("click", () => {
          this.send(button.dataset.sandboxTool, {
            buildingType: button.dataset.buildingType,
            percent: Number(button.dataset.percent || 0),
            value: button.dataset.value,
          });
        });
      });
      this.nodes.gameSpeed?.addEventListener("change", () => this.send("setGameSpeed", { value: this.nodes.gameSpeed.value }));
    }

    openSetup() {
      this.nodes.startCard?.classList.add("hidden");
      this.nodes.setupPanel?.classList.remove("hidden");
      this.nodes.setupStart?.focus();
    }

    closeSetup() {
      this.nodes.setupPanel?.classList.add("hidden");
      this.nodes.startCard?.classList.remove("hidden");
    }

    applyPreset(id, showToast = true) {
      const preset = root.PondSandboxConfig?.presets?.[id];
      if (!preset) return;
      if (this.nodes.mapSize) this.nodes.mapSize.value = preset.mapSize || "medium";
      if (this.nodes.botCount) this.nodes.botCount.value = String(preset.botCount ?? 0);
      if (this.nodes.botDifficulty) this.nodes.botDifficulty.value = preset.botDifficulty || "normal";
      this.nodes.rules.forEach((rule) => {
        const key = rule.dataset.sandboxRule;
        rule.checked = preset.rules?.[key] ?? root.PondSandboxConfig?.defaultRules?.[key] ?? false;
      });
      if (showToast) this.toast(`Sandbox preset loaded: ${preset.label}.`);
    }

    startSandbox() {
      const playerName = (document.querySelector("#playerName")?.value || "Player").trim().slice(0, 18) || "Player";
      const rules = {};
      this.nodes.rules.forEach((rule) => {
        rules[rule.dataset.sandboxRule] = Boolean(rule.checked);
      });
      this.onStart({
        sandbox: true,
        gameMode: "sandbox",
        playerName,
        animal: this.nodes.animal?.value || "duck",
        mapSize: this.nodes.mapSize?.value || "medium",
        botCount: Number(this.nodes.botCount?.value || 0),
        difficulty: this.nodes.botDifficulty?.value || "normal",
        sandboxRules: rules,
        sandboxBotDifficulty: this.nodes.botDifficulty?.value || "normal",
        beginnerCombat: false,
        matchLength: "long",
        allowBots: true,
      });
    }

    setState(state, context = {}) {
      this.state = state;
      const active = Boolean(state?.matchSettings?.sandbox?.enabled || state?.sandbox?.enabled);
      this.nodes.openButton?.classList.toggle("hidden", !active);
      this.nodes.mobileButton?.classList.toggle("hidden", !active);
      this.nodes.badge?.classList.toggle("hidden", !active);
      document.body.classList.toggle("sandbox-active", active);
      if (!active) this.nodes.panel?.classList.add("hidden");
      if (active && !this.nodes.panel?.classList.contains("hidden")) this.render(context);
    }

    openPanel() {
      if (!this.state?.sandbox?.enabled && !this.state?.matchSettings?.sandbox?.enabled) {
        this.toast("Sandbox panel only opens in Sandbox Mode.", true);
        return;
      }
      this.nodes.panel?.classList.remove("hidden");
      this.render({});
    }

    closePanel() {
      this.nodes.panel?.classList.add("hidden");
    }

    closeAll() {
      this.closePanel();
      this.nodes.setupPanel?.classList.add("hidden");
    }

    send(action, extra = {}) {
      const state = this.getState();
      if (!state?.sandbox?.enabled && !state?.matchSettings?.sandbox?.enabled) {
        this.toast("Sandbox tools only work in Sandbox Mode.", true);
        return;
      }
      const tile = this.getSelectedTile();
      const selectedOwner = tile?.owner || null;
      const payload = {
        type: "sandbox",
        action,
        tileId: tile?.id,
        targetId: this.getSelectedPlayerId() || (selectedOwner && selectedOwner !== state.humanId ? selectedOwner : null),
        ...extra,
      };
      if (action === "changeAnimal") payload.animal = this.nodes.animalSelect?.value || "duck";
      if (action === "setMaxEnergy") payload.value = Number(this.nodes.maxEnergy?.value || 500);
      if (action === "spawnBot" || action === "setBotDifficulty") {
        payload.animal = this.nodes.botAnimal?.value || "duck";
        payload.difficulty = this.nodes.botDifficultyTool?.value || "normal";
        payload.personality = this.nodes.botPersonality?.value || "";
        payload.name = this.nodes.botName?.value || "";
      }
      this.onAction(payload);
    }

    render() {
      const state = this.getState() || this.state;
      if (!state) return;
      const human = state.players.find((player) => player.id === state.humanId);
      const tile = this.getSelectedTile();
      const sandbox = state.sandbox || {};
      if (this.nodes.gameSpeed) this.nodes.gameSpeed.value = String(sandbox.speed || 1);
      if (this.nodes.title) this.nodes.title.textContent = sandbox.simulationPaused ? "Sandbox Paused" : "Sandbox Controls";
      if (this.nodes.status) {
        this.nodes.status.innerHTML = `
          <div><span>Rules</span><strong>${this.ruleChips(sandbox.rules || {})}</strong></div>
          <div><span>Player</span><strong>${this.escape(human?.animal || "-")} | ${Math.round(human?.energy || 0)} / ${Math.round(human?.maxEnergy || 0)}</strong></div>
          <div><span>Bots</span><strong>${sandbox.botCount || 0} | ${sandbox.botsPaused ? "paused" : sandbox.rules?.botsFight === false ? "non-combat" : "active"}</strong></div>
          <div><span>Speed</span><strong>${sandbox.speed || 1}x</strong></div>
        `;
      }
      if (this.nodes.debug) this.nodes.debug.innerHTML = this.debugHtml(state, human, tile, sandbox);
    }

    ruleChips(rules) {
      const active = Object.entries(rules)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key.replace(/([A-Z])/g, " $1"))
        .slice(0, 4);
      return this.escape(active.join(", ") || "standard");
    }

    debugHtml(state, human, tile, sandbox) {
      const owner = tile?.owner ? state.players.find((player) => player.id === tile.owner) : null;
      const type = tile ? state.config.tileTypes?.[tile.type] : null;
      const income = human?.incomeBreakdown || {};
      const ability = human?.abilityStatus || {};
      const combatLines = tile
        ? [
            { label: "Tile", value: `${type?.label || tile.type} #${tile.id}` },
            { label: "Owner", value: owner?.name || (type?.blocks ? "Blocked" : "Neutral") },
            { label: "Defense", value: Math.round((tile.defenseEnergy || 0) + (type?.defenseBonus || 0)) },
            { label: "Building", value: tile.building ? `${tile.building} L${tile.buildingLevel || 1}` : "None" },
          ]
        : [{ label: "Tile", value: "Select a tile for debug info." }];
      if (sandbox.debug?.combat && tile) {
        combatLines.push(
          { label: "Capture Cost", value: type?.blocks ? "Blocked" : type?.captureCost || "?" },
          { label: "Terrain Bonus", value: type?.defenseBonus || 0 },
          { label: "Selected Send", value: Math.round((human?.energy || 0) * 0.25) },
          { label: "Active Attacks", value: state.activeAttacks?.length || 0 },
        );
      }
      const economyLines = sandbox.debug?.economy
        ? [
            { label: "Income", value: `+${human?.income || 0}/s` },
            { label: "Territory", value: Number(income.territory || 0).toFixed(1) },
            { label: "Terrain", value: Number(income.terrain || 0).toFixed(1) },
            { label: "Buildings", value: Number(income.buildings || 0).toFixed(1) },
            { label: "Animal", value: Number(income.animal || 0).toFixed(1) },
          ]
        : [];
      const abilityLines = sandbox.debug?.ability
        ? [
            { label: "Ability", value: ability.abilityName || state.config.animals?.[human?.animal]?.ability || "-" },
            { label: "Cooldown", value: `${Math.ceil(ability.cooldownLeft || 0)}s` },
            { label: "Active", value: `${Math.ceil(ability.activeLeft || 0)}s` },
            { label: "Effect", value: ability.activeEffect || "Ready/idle" },
          ]
        : [];
      return [...combatLines, ...economyLines, ...abilityLines]
        .map((row) => `<div><span>${this.escape(row.label)}</span><strong>${this.escape(row.value)}</strong></div>`)
        .join("");
    }

    toast(message, bad = false) {
      const toast = document.querySelector("#toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.toggle("bad", bad);
      toast.classList.remove("hidden");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
    }

    escape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  }

  root.PondSandboxPanel = PondSandboxPanel;
})(window);
