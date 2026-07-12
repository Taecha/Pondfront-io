(function initPondMobileControls(root) {
  class PondMobileControls {
    constructor(options = {}) {
      this.onAction = options.onAction || (() => {});
      this.onMore = options.onMore || (() => {});
      this.onInfo = options.onInfo || (() => {});
      this.onTeam = options.onTeam || (() => {});
      this.onLeaderboard = options.onLeaderboard || (() => {});
      this.root = document.querySelector("#mobileTouchDock");
      this.title = document.querySelector("#mobileDockTitle");
      this.meta = document.querySelector("#mobileDockMeta");
      this.detail = document.querySelector("#mobileDockDetail");
      this.actions = document.querySelector("#mobileDockActions");
      this.handle = document.querySelector("#mobileDockHandle");
      this.rank = document.querySelector("#mobileRankChip");
      this.minimap = document.querySelector("#mobileMiniMapButton");
      this.cancel = document.querySelector("#mobileTargetCancel");
      this.expanded = false;
      this.sheetLevel = 0;
      this.actionMap = new Map();
      this.lastViewport = "";
      this.handleSwipe = null;
      this.suppressHandleClick = false;
      this.bind();
      this.detectLayout();
    }

    bind() {
      this.actions?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-mobile-dock-action]");
        if (!button || button.disabled) return;
        const key = button.dataset.mobileDockAction;
        if (key === "more") return this.onMore();
        if (key === "info") return this.onInfo();
        if (key === "team") return this.onTeam();
        if (key === "minimap") return this.toggleMinimap();
        if (key === "ability") return this.onAction({ action: "ability" });
        const action = this.actionMap.get(key);
        if (action) this.onAction(action.payload || { action: action.id });
        this.vibrate(12);
      });
      this.handle?.addEventListener("click", () => {
        if (this.suppressHandleClick) {
          this.suppressHandleClick = false;
          return;
        }
        this.sheetLevel = (this.sheetLevel + 1) % 3;
        if (this.sheetLevel === 2) {
          this.onInfo();
          this.sheetLevel = 0;
        }
        this.expanded = this.sheetLevel === 1;
        this.root?.classList.toggle("expanded", this.expanded);
        this.handle?.setAttribute("aria-expanded", String(this.expanded));
      });
      this.handle?.addEventListener("pointerdown", (event) => {
        this.handleSwipe = { id: event.pointerId, y: event.clientY };
        this.handle.setPointerCapture?.(event.pointerId);
      });
      this.handle?.addEventListener("pointerup", (event) => {
        if (!this.handleSwipe || this.handleSwipe.id !== event.pointerId) return;
        const dy = event.clientY - this.handleSwipe.y;
        this.handleSwipe = null;
        if (Math.abs(dy) < 36) return;
        this.suppressHandleClick = true;
        this.expanded = dy < 0;
        this.sheetLevel = this.expanded ? 1 : 0;
        this.root?.classList.toggle("expanded", this.expanded);
        this.handle?.setAttribute("aria-expanded", String(this.expanded));
      });
      this.handle?.addEventListener("pointercancel", () => { this.handleSwipe = null; });
      this.rank?.addEventListener("click", () => this.onLeaderboard());
      this.minimap?.addEventListener("click", () => this.toggleMinimap());
      this.cancel?.addEventListener("click", () => this.onAction({ action: "cancelSelection" }));
      window.addEventListener("resize", () => this.detectLayout());
      window.addEventListener("orientationchange", () => this.detectLayout());
      window.visualViewport?.addEventListener("resize", () => this.detectLayout());
    }

    detectLayout() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.lastViewport = `${width}x${height}`;
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
      const mode = width < 600
        ? height < 500 || width > height ? "phone-landscape" : "phone-portrait"
        : width <= 1024 || coarse
          ? width > height && height < 700 ? "tablet-landscape" : "tablet"
          : "desktop";
      document.body.dataset.layout = mode;
      document.body.classList.toggle("touch-layout", Boolean(coarse || width <= 1024));
      document.body.style.setProperty("--mobile-vh", `${height}px`);
    }

    update({ state, tile, context = {}, human }) {
      if (!this.root || !state || !human) return;
      if (this.lastViewport !== `${window.innerWidth}x${window.innerHeight}`) this.detectLayout();
      const mobile = document.body.classList.contains("touch-layout");
      this.root.classList.toggle("hidden", !mobile || state.phase === "SPAWN_SELECTION" || state.phase === "COUNTDOWN");
      this.cancel?.classList.toggle("hidden", !mobile || !(context.pendingAbility || context.pendingBuildType || context.pendingSpecialType || context.pendingCommand));
      const actions = (context.availableActions || []).filter((item) => !item.separator);
      const dock = this.pickActions(state, tile, context, human, actions).slice(0, 4);
      this.actionMap.clear();
      this.actions.innerHTML = dock.map((item, index) => this.renderAction(item, index)).join("");
      dock.forEach((item, index) => {
        if (item.source) this.actionMap.set(String(index), item.source);
      });
      this.title.textContent = tile ? this.tileTitle(state, tile, human) : "Pond Actions";
      this.meta.textContent = tile ? this.tileMeta(state, tile, human) : "No tile selected";
      this.detail.textContent = context.warning || dock.find((item) => item.source?.hint)?.source?.hint || "Tap and hold a tile for every action.";
      this.updateRank(state, human);
      this.applyPreferences();
    }

    pickActions(state, tile, context, human, actions) {
      const byId = (id) => actions.filter((item) => item.id === id);
      const item = (source, label = source?.label, icon = source?.icon) => source ? { source, label, icon, disabled: source.available === false, reason: source.disabledReason } : null;
      const synthetic = (id, label, icon, options = {}) => ({ key: id, label, icon, ...options });
      const abilityEndsAt = Number(human.abilityStatus?.cooldownEndsAt || human.abilityCooldownEndsAt || human.abilityReadyAt || 0);
      const abilityActiveEndsAt = Number(human.abilityStatus?.activeEndsAt || human.abilityActiveUntil || 0);
      const abilityLeft = Math.max(0, abilityEndsAt - Number(state.serverTime || 0));
      const activeLeft = Math.max(0, abilityActiveEndsAt - Number(state.serverTime || 0));
      const abilityDuration = Math.max(1, Number(state.config.animals?.[human.animal]?.cooldown || 45));
      const ability = synthetic("ability", activeLeft > 0 ? `${Math.ceil(activeLeft)}s` : abilityLeft > 0 ? `${Math.ceil(abilityLeft)}s` : "Ability", "A", {
        disabled: human.defeated || state.ended || abilityLeft > 0 || activeLeft > 0,
        meta: activeLeft > 0 ? "Active" : abilityLeft > 0 ? `${Math.ceil(abilityLeft)}s` : "Ready",
        cooldownProgress: abilityLeft > 0 ? Math.min(1, abilityLeft / abilityDuration) : 0,
        active: activeLeft > 0,
        reason: activeLeft > 0 ? `Ability active for ${Math.ceil(activeLeft)}s.` : abilityLeft > 0 ? `Ability cooldown ${Math.ceil(abilityLeft)}s.` : "Animal ability ready.",
      });
      let result = [];
      if (!tile) result = [ability, synthetic("team", "Team", "T", { disabled: !state.teamState?.active, reason: "Team commands require a team mode." }), synthetic("minimap", "Map", "M")];
      else if (tile.objectiveId || tile.campId) result = [synthetic("info", "Inspect", "i"), item(byId("defend")[0], "Defend", "D"), item(byId("ping")[0], "Ping", "P")];
      else if (!tile.owner) result = [
        item(byId("expand").find((entry) => entry.payload?.percent === 0.25) || byId("expand")[0], "Expand", "E"),
        item(byId("expand").find((entry) => entry.payload?.percent === 0.5), "Send 50%", "50"),
        ability,
      ];
      else if (tile.owner === human.id) {
        if (tile.building) result = [item(byId("upgradeBuilding")[0], "Upgrade", "+"), item(byId("defend")[0], "Defend", "D"), item(byId("ability")[0], "Ability", "A")];
        else result = [item(byId("buildMenu")[0], "Build", "B"), item(byId("defend")[0], "Defend", "D"), item(byId("ability")[0], "Ability", "A")];
      } else if (context.relationship?.allied || context.relationship?.teammate) {
        result = [item(byId("support")[0], "Support", "S"), item(byId("ping")[0], "Ping", "P"), item(byId("special")[0], "Guard", "G")];
      } else {
        const attacks = byId("attack");
        result = [item(attacks.find((entry) => entry.payload?.percent === 0.25), "Bite", "B"), item(attacks.find((entry) => entry.payload?.percent === 0.5), "Push", "P"), item(attacks.find((entry) => entry.payload?.percent === 1), "Wave", "W")];
      }
      return [...result.filter(Boolean), synthetic("more", "More", "...")];
    }

    renderAction(item, index) {
      const key = item.key || String(index);
      const source = item.source;
      const cooldown = Math.ceil(source?.cooldownRemaining || 0);
      const meta = item.meta || (cooldown > 0 ? `${cooldown}s` : source?.cost != null ? `${Math.ceil(source.cost)}` : "");
      const disabled = item.disabled ? "disabled" : "";
      const statusClass = item.cooldownProgress > 0 ? "cooling" : item.active ? "active" : "";
      const statusStyle = item.cooldownProgress > 0 ? `style="--cooldown-progress:${item.cooldownProgress.toFixed(3)}"` : "";
      const title = item.reason || source?.hint || item.label;
      return `<button class="${statusClass}" data-mobile-dock-action="${escapeHtml(key)}" ${statusStyle} ${disabled} title="${escapeHtml(title)}"><b>${escapeHtml(item.icon || "i")}</b><span>${escapeHtml(item.label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</button>`;
    }

    tileTitle(state, tile, human) {
      if (tile.isCore) return "Core Nest";
      if (tile.objectiveId || tile.campId) return "Pond Objective";
      if (!tile.owner) return state.config.tileTypes?.[tile.type]?.label || "Neutral Water";
      if (tile.owner === human.id) return tile.building ? state.config.buildings?.[tile.building]?.label || "Your Building" : "Your Territory";
      return state.players.find((player) => player.id === tile.owner)?.name || "Rival Territory";
    }

    tileMeta(state, tile, human) {
      const terrain = state.config.tileTypes?.[tile.type]?.label || tile.type;
      const defense = Math.round(tile.defenseEnergy || 0);
      const owner = !tile.owner ? "Neutral" : tile.owner === human.id ? "Yours" : "Occupied";
      return `${owner} | ${terrain} | Def ${defense}`;
    }

    updateRank(state, human) {
      const sorted = state.players.filter((player) => !player.removed).slice().sort((a, b) => (b.territoryPct || 0) - (a.territoryPct || 0));
      const rank = Math.max(1, sorted.findIndex((player) => player.id === human.id) + 1);
      const score = state.gameModeState?.scores?.find((entry) => entry.playerId === human.id)?.score;
      this.rank.textContent = score != null ? `#${rank} | ${score} pts` : `#${rank} | ${Math.round((human.territoryPct || 0) * 100)}%`;
    }

    toggleMinimap() {
      document.body.classList.toggle("minimap-active");
      this.minimap?.classList.toggle("active", document.body.classList.contains("minimap-active"));
    }

    applyPreferences() {
      document.body.dataset.dockSide = localStorage.getItem("pondfront:mobile-dock-side") || "center";
      document.body.dataset.mobileButtons = localStorage.getItem("pondfront:mobile-button-size") || "normal";
      document.body.dataset.minimapSize = localStorage.getItem("pondfront:mobile-minimap-size") || "medium";
    }

    vibrate(duration = 10) {
      if (localStorage.getItem("pondfront:mobile-vibration") === "off") return;
      navigator.vibrate?.(duration);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  root.PondMobileControls = PondMobileControls;
})(window);
