(function initUI(root) {
  const LOBBY_ANIMALS = {
    duck: {
      name: "Duck",
      icon: "D",
      className: "duck",
      summary: "Duck is best for fast early expansion. Use Flock Rush to claim open water quickly before enemies reach your border.",
      ability: "Flock Rush",
      terrain: "Open Water",
      weakness: "Reed fights",
      strategy: "Beginner friendly expansion",
    },
    snake: {
      name: "Snake",
      icon: "S",
      className: "snake",
      summary: "Snake controls tense borders. Use Ambush from reeds or mud when an enemy front is exposed.",
      ability: "Ambush",
      terrain: "Reeds and Mud",
      weakness: "Open water speed",
      strategy: "Defensive ambush control",
    },
    frog: {
      name: "Frog",
      icon: "F",
      className: "frog",
      summary: "Frog wins with mobility. Use Big Leap to grab lily pads, objectives, and awkward neutral pockets.",
      ability: "Big Leap",
      terrain: "Lily Pads",
      weakness: "Open water defense",
      strategy: "Objective tactics",
    },
  };

  class PondUI {
    constructor() {
      this.selectedAnimal = "duck";
      this.percent = 0.25;
      this.callbacks = {};
      this.nodes = {
        startScreen: document.querySelector("#startScreen"),
        gameScreen: document.querySelector("#gameScreen"),
        startButton: document.querySelector("#startButton"),
        practiceButton: document.querySelector("#practiceButton"),
        lobbyHelpButton: document.querySelector("#lobbyHelpButton"),
        playerName: document.querySelector("#playerName"),
        mapSize: document.querySelector("#mapSize"),
        botCount: document.querySelector("#botCount"),
        matchLength: document.querySelector("#matchLength"),
        lobbyGuide: document.querySelector("#lobbyGuide"),
        closeLobbyGuide: document.querySelector("#closeLobbyGuide"),
        selectedAnimalIcon: document.querySelector("#selectedAnimalIcon"),
        selectedAnimalName: document.querySelector("#selectedAnimalName"),
        selectedAnimalSummary: document.querySelector("#selectedAnimalSummary"),
        selectedAnimalStats: document.querySelector("#selectedAnimalStats"),
        helpButton: document.querySelector("#helpButton"),
        difficulty: document.querySelector("#difficulty"),
        animalChoices: [...document.querySelectorAll(".animal-choice")],
        energyStat: document.querySelector("#energyStat"),
        incomeStat: document.querySelector("#incomeStat"),
        territoryStat: document.querySelector("#territoryStat"),
        animalStat: document.querySelector("#animalStat"),
        timerStat: document.querySelector("#timerStat"),
        controlMeter: document.querySelector("#controlMeter"),
        lakeEventBanner: document.querySelector("#lakeEventBanner"),
        lakeEventTitle: document.querySelector("#lakeEventTitle"),
        lakeEventDetails: document.querySelector("#lakeEventDetails"),
        lakeEventTimer: document.querySelector("#lakeEventTimer"),
        zoomInButton: document.querySelector("#zoomInButton"),
        zoomOutButton: document.querySelector("#zoomOutButton"),
        centerMapButton: document.querySelector("#centerMapButton"),
        collapseUiButton: document.querySelector("#collapseUiButton"),
        openLeaderboardButton: document.querySelector("#openLeaderboardButton"),
        tileTitle: document.querySelector("#tileTitle"),
        tileDetails: document.querySelector("#tileDetails"),
        tileOwner: document.querySelector("#tileOwner"),
        tileDefense: document.querySelector("#tileDefense"),
        tileFacts: document.querySelector("#tileFacts"),
        tileWarning: document.querySelector("#tileWarning"),
        playerPanel: document.querySelector("#playerPanel"),
        selectedPlayer: document.querySelector("#selectedPlayer"),
        selectedPlayerMeta: document.querySelector("#selectedPlayerMeta"),
        selectedPlayerFacts: document.querySelector("#selectedPlayerFacts"),
        abilityName: document.querySelector("#abilityName"),
        abilityPerk: document.querySelector("#abilityPerk"),
        cooldownBar: document.querySelector("#cooldownBar"),
        cooldownText: document.querySelector("#cooldownText"),
        levelTitle: document.querySelector("#levelTitle"),
        levelDetails: document.querySelector("#levelDetails"),
        xpBar: document.querySelector("#xpBar"),
        objectiveList: document.querySelector("#objectiveList"),
        missionList: document.querySelector("#missionList"),
        leaderboard: document.querySelector("#leaderboard"),
        toast: document.querySelector("#toast"),
        percentButtons: [...document.querySelectorAll("[data-percent]")],
        expandButton: document.querySelector("#expandButton"),
        attackButton: document.querySelector("#attackButton"),
        defendButton: document.querySelector("#defendButton"),
        buildButton: document.querySelector("#buildButton"),
        abilityButton: document.querySelector("#abilityButton"),
        buildSelect: document.querySelector("#buildSelect"),
        diplomacyButtons: [...document.querySelectorAll("[data-diplomacy]")],
        strategicView: document.querySelector("#strategicView"),
        showIcons: document.querySelector("#showIcons"),
        effectsLevel: document.querySelector("#effectsLevel"),
        floatingText: document.querySelector("#floatingText"),
        attackArrows: document.querySelector("#attackArrows"),
        reducedMotion: document.querySelector("#reducedMotion"),
        tutorial: document.querySelector("#tutorial"),
        closeTutorial: document.querySelector("#closeTutorial"),
        resultScreen: document.querySelector("#resultScreen"),
        resultTitle: document.querySelector("#resultTitle"),
        resultSummary: document.querySelector("#resultSummary"),
        resultStats: document.querySelector("#resultStats"),
        playAgain: document.querySelector("#playAgain"),
      };
      this.nodes.strategicView.checked = true;
      this.nodes.showIcons.checked = false;
      this.tooltips = root.PondTooltips ? new root.PondTooltips() : null;
      this.helpMenu = root.PondHelpMenu ? new root.PondHelpMenu(this.nodes.helpButton) : null;
      this.bind();
      this.updateLobbyAnimal();
      this.syncBotOptions(true);
      this.setPercent(this.percent);
    }

    on(name, callback) {
      this.callbacks[name] = callback;
    }

    emit(name, payload) {
      this.callbacks[name]?.(payload);
    }

    bind() {
      this.nodes.animalChoices.forEach((button) => {
        button.addEventListener("click", () => {
          this.selectedAnimal = button.dataset.animal;
          this.nodes.animalChoices.forEach((candidate) => candidate.classList.toggle("selected", candidate === button));
          this.updateLobbyAnimal();
        });
      });

      this.nodes.startButton.addEventListener("click", () => {
        this.emit("start", this.startPayload());
      });
      this.nodes.practiceButton?.addEventListener("click", () => {
        this.emit("start", this.startPayload({ difficulty: "easy", mapSize: "small", botCount: 4, matchLength: "quick", practice: true }));
      });
      this.nodes.mapSize?.addEventListener("change", () => this.syncBotOptions());
      this.nodes.lobbyHelpButton?.addEventListener("click", () => this.nodes.lobbyGuide?.classList.remove("hidden"));
      this.nodes.closeLobbyGuide?.addEventListener("click", () => this.nodes.lobbyGuide?.classList.add("hidden"));
      this.nodes.lobbyGuide?.addEventListener("click", (event) => {
        if (event.target === this.nodes.lobbyGuide) this.nodes.lobbyGuide.classList.add("hidden");
      });

      this.nodes.percentButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setPercent(Number(button.dataset.percent));
        });
      });

      this.nodes.expandButton.addEventListener("click", () => this.emit("action", { type: "expand" }));
      this.nodes.attackButton.addEventListener("click", () => this.emit("action", { type: "attack" }));
      this.nodes.defendButton.addEventListener("click", () => this.emit("action", { type: "defend" }));
      this.nodes.buildButton.addEventListener("click", () => this.emit("action", { type: "build", buildingType: this.nodes.buildSelect.value }));
      this.nodes.abilityButton.addEventListener("click", () => this.emit("action", { type: "ability" }));
      this.nodes.diplomacyButtons.forEach((button) => {
        button.addEventListener("click", () => this.emit("diplomacy", button.dataset.diplomacy));
      });
      this.nodes.closeTutorial.addEventListener("click", () => {
        this.nodes.tutorial.classList.add("hidden");
        localStorage.setItem("pondfront:tutorial", "done");
      });
      this.nodes.playAgain.addEventListener("click", () => this.emit("start", { animal: this.selectedAnimal, difficulty: this.nodes.difficulty.value }));
      this.nodes.strategicView.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showIcons.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.effectsLevel.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.floatingText.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.attackArrows.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.reducedMotion.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.zoomInButton?.addEventListener("click", () => this.emit("camera", { type: "zoomIn" }));
      this.nodes.zoomOutButton?.addEventListener("click", () => this.emit("camera", { type: "zoomOut" }));
      this.nodes.centerMapButton?.addEventListener("click", () => this.emit("camera", { type: "center" }));
      this.nodes.collapseUiButton?.addEventListener("click", () => {
        document.body.classList.toggle("ui-collapsed");
        this.nodes.collapseUiButton.classList.toggle("active", document.body.classList.contains("ui-collapsed"));
      });
      this.nodes.openLeaderboardButton?.addEventListener("click", () => {
        document.body.classList.toggle("leaderboard-open");
        this.nodes.openLeaderboardButton.classList.toggle("active", document.body.classList.contains("leaderboard-open"));
      });
    }

    startPayload(overrides = {}) {
      const playerName = (this.nodes.playerName?.value || "Player").trim().slice(0, 18) || "Player";
      return {
        animal: this.selectedAnimal,
        playerName,
        difficulty: this.nodes.difficulty.value,
        mapSize: this.nodes.mapSize?.value || "large",
        botCount: Number(this.nodes.botCount?.value || 12),
        matchLength: this.nodes.matchLength?.value || "standard",
        ...overrides,
      };
    }

    syncBotOptions(initial = false) {
      const mapSize = this.nodes.mapSize?.value || "medium";
      const map = root.PondMapConfig?.[mapSize] || root.PondMapConfig?.medium;
      if (!map || !this.nodes.botCount) return;
      const current = Number(this.nodes.botCount.value || map.defaultBots);
      const values = [];
      for (let count = map.minBots; count <= map.maxBots; count += 1) values.push(count);
      this.nodes.botCount.innerHTML = values
        .map((count) => `<option value="${count}">${count}</option>`)
        .join("");
      const next = initial || current < map.minBots || current > map.maxBots ? map.defaultBots : current;
      this.nodes.botCount.value = String(next);
    }

    updateLobbyAnimal() {
      const info = LOBBY_ANIMALS[this.selectedAnimal] || LOBBY_ANIMALS.duck;
      if (this.nodes.startButton) this.nodes.startButton.textContent = `Start as ${info.name}`;
      if (this.nodes.selectedAnimalIcon) {
        this.nodes.selectedAnimalIcon.className = `animal-disc ${info.className}`;
        this.nodes.selectedAnimalIcon.textContent = info.icon;
      }
      if (this.nodes.selectedAnimalName) this.nodes.selectedAnimalName.textContent = info.name;
      if (this.nodes.selectedAnimalSummary) this.nodes.selectedAnimalSummary.textContent = info.summary;
      if (this.nodes.selectedAnimalStats) {
        this.nodes.selectedAnimalStats.innerHTML = `
          <dt>Ability</dt><dd>${this.escape(info.ability)}</dd>
          <dt>Best Terrain</dt><dd>${this.escape(info.terrain)}</dd>
          <dt>Weakness</dt><dd>${this.escape(info.weakness)}</dd>
          <dt>Playstyle</dt><dd>${this.escape(info.strategy)}</dd>
        `;
      }
    }

    setPercent(value) {
      const next = Math.max(0.1, Math.min(1, Number(value) || 0.25));
      this.percent = next;
      this.nodes.percentButtons.forEach((candidate) => {
        const candidatePercent = Number(candidate.dataset.percent);
        const active = Math.abs(candidatePercent - next) < 0.001;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      this.updateActionLabels(this.lastHuman);
    }

    showGame() {
      this.nodes.startScreen.classList.add("hidden");
      this.nodes.gameScreen.classList.remove("hidden");
      this.nodes.resultScreen.classList.add("hidden");
      this.nodes.lobbyGuide?.classList.add("hidden");
      if (localStorage.getItem("pondfront:tutorial") === "done") this.nodes.tutorial.classList.add("hidden");
      else this.nodes.tutorial.classList.remove("hidden");
    }

    update(state, selectedTile, selectedPlayerId, context = {}) {
      const human = state.players.find((player) => player.id === state.humanId);
      if (!human) return;
      const animal = state.config.animals[human.animal];
      this.lastHuman = human;
      this.nodes.energyStat.textContent = `${human.energy} / ${human.maxEnergy}`;
      this.nodes.incomeStat.textContent = `+${human.income}/s`;
      this.nodes.territoryStat.textContent = `${Math.round(human.territoryPct * 100)}%`;
      this.nodes.animalStat.textContent = `${animal.label} L${human.level || 1}`;
      this.nodes.timerStat.textContent = this.formatTime(state.timeLeft);
      this.nodes.controlMeter.style.transform = `scaleX(${Math.max(0, Math.min(1, human.territoryPct / state.winControl))})`;

      const abilityStatus = human.abilityStatus || {};
      this.nodes.abilityName.textContent = animal.ability;
      const cooldownLeft = Math.max(0, abilityStatus.cooldownLeft ?? human.abilityReadyAt - state.serverTime);
      const activeLeft = Math.max(0, abilityStatus.activeLeft ?? human.abilityActiveUntil - state.serverTime);
      const realModifier = abilityStatus.realModifier || root.PondInfo?.abilityTip(human.animal) || animal.perk;
      this.nodes.abilityPerk.textContent = abilityStatus.activeEffect
        ? `${abilityStatus.activeEffect}: ${realModifier}`
        : realModifier;
      this.nodes.cooldownText.textContent =
        activeLeft > 0
          ? `${abilityStatus.activeEffect || "Active"}: ${Math.ceil(activeLeft)}s`
          : cooldownLeft > 0
            ? `Cooldown: ${Math.ceil(cooldownLeft)}s`
            : "Ready";
      const cooldownTotal = abilityStatus.cooldown || animal.cooldown;
      this.nodes.cooldownBar.style.transform = `scaleX(${cooldownLeft > 0 ? Math.max(0, 1 - cooldownLeft / cooldownTotal) : 1})`;
      this.nodes.abilityButton.disabled = human.defeated || state.ended;
      const progress = cooldownLeft > 0 ? Math.max(0, 1 - cooldownLeft / cooldownTotal) : 1;
      this.nodes.abilityButton.style.setProperty("--cooldown-angle", `${Math.round(progress * 360)}deg`);
      this.nodes.abilityButton.classList.toggle("cooldown", cooldownLeft > 0);
      this.nodes.abilityButton.classList.toggle("ready", cooldownLeft <= 0 && activeLeft <= 0);
      this.nodes.abilityButton.classList.toggle("active", activeLeft > 0);
      this.nodes.abilityButton.dataset.tip =
        cooldownLeft > 0 && activeLeft <= 0
          ? `${animal.ability} cooldown: ${Math.ceil(cooldownLeft)}s. ${realModifier}`
          : `${animal.ability}: ${realModifier}`;

      this.updateSelectedTile(state, selectedTile, context);
      this.updatePlayerPanel(state, selectedPlayerId);
      this.updateProgression(human);
      this.updateObjectives(state);
      this.updateMissions(state);
      this.updateLakeEvent(state);
      this.updateLeaderboard(state);
      this.updateActionLabels(human);
      if (state.ended) this.showResult(state, human);
    }

    updateSelectedTile(state, tile, context = {}) {
      if (!tile) {
        const human = state.players.find((player) => player.id === state.humanId);
        this.nodes.tileTitle.textContent = "No tile selected";
        this.nodes.tileDetails.textContent = human?.incomeBreakdown
          ? `Income: +${human.income}/s. Select a tile for capture or building details.`
          : "Click a glowing border or right-click any tile for quick actions.";
        this.nodes.tileOwner.textContent = "Neutral";
        this.nodes.tileDefense.textContent = "Def 0";
        this.nodes.tileFacts.innerHTML = (root.PondInfo?.incomeFacts(human) || [])
          .map((fact) => `<div><span>${this.escape(fact.label)}</span><strong>${this.escape(fact.value)}</strong></div>`)
          .join("");
        this.nodes.tileWarning.classList.add("hidden");
        return;
      }
      const summary = root.PondInfo?.tileSummary(state, tile, context);
      if (!summary) return;
      this.nodes.tileTitle.textContent = summary.title;
      this.nodes.tileDetails.textContent = summary.detail;
      this.nodes.tileOwner.textContent = summary.ownerText;
      this.nodes.tileDefense.textContent = context.kind === "attackBorder" ? `Wave cost ~${context.nextCost}` : summary.defenseText;
      this.nodes.tileFacts.innerHTML = summary.facts
        .map((fact) => `<div><span>${this.escape(fact.label)}</span><strong>${this.escape(fact.value)}</strong></div>`)
        .join("");
      this.nodes.tileWarning.textContent = summary.warning || "";
      this.nodes.tileWarning.classList.toggle("hidden", !summary.warning);
    }

    updatePlayerPanel(state, selectedPlayerId) {
      const summary = root.PondInfo?.playerSummary(state, selectedPlayerId);
      if (!summary) {
        this.nodes.playerPanel.classList.add("hidden");
        this.nodes.selectedPlayerFacts.innerHTML = "";
        return;
      }
      this.nodes.playerPanel.classList.remove("hidden");
      this.nodes.selectedPlayer.textContent = summary.title;
      this.nodes.selectedPlayerMeta.textContent = summary.meta;
      this.nodes.selectedPlayerFacts.innerHTML = summary.facts
        .map((fact) => `<div><span>${this.escape(fact.label)}</span><strong>${this.escape(fact.value)}</strong></div>`)
        .join("");
    }

    updateLeaderboard(state) {
      const rows = state.players
        .filter((player) => !player.defeated)
        .slice()
        .sort((a, b) => b.territoryPct - a.territoryPct)
        .slice(0, 8);
      this.nodes.leaderboard.innerHTML = rows
        .map((player, index) => {
          const animal = state.config.animals[player.animal];
          const ally = player.allies.includes(state.humanId);
          const name = player.id === state.humanId ? player.name || "You" : player.name;
          return `<li class="${player.id === state.humanId ? "local" : ""}">
            <span class="leader-rank">#${index + 1}</span>
            <span class="leader-animal animal-${this.escape(player.animal)}" title="${this.escape(animal.label)}">${this.escape(animal.icon)}</span>
            <span class="leader-name"><b>${this.escape(name)}</b><small>${this.escape(animal.label)} L${player.level || 1}${ally ? " | Ally" : ""}</small></span>
            <span class="leader-territory">${Math.round(player.territoryPct * 100)}%</span>
            <span class="leader-energy">${player.energy}</span>
          </li>`;
        })
        .join("");
    }

    updateProgression(human) {
      const progress = human.progression || { level: human.level || 1, xp: human.xp || 0, ratio: 0, title: "Starter", next: 30 };
      this.nodes.levelTitle.textContent = `Level ${progress.level} ${progress.title || "Starter"}`;
      this.nodes.levelDetails.textContent =
        progress.level >= 5 ? "Evolution unlocked. Your animal passive is fully upgraded." : `${Math.round(progress.xp)} XP / ${progress.next} XP`;
      this.nodes.xpBar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress.ratio || 0))})`;
    }

    updateObjectives(state) {
      const objectives = state.objectives || [];
      const camps = state.camps || [];
      const playerName = (id) => state.players.find((player) => player.id === id)?.name || "Neutral";
      const objectiveRows = objectives
        .map((objective) => {
          const def = objective.definition || state.config.objectives?.LAKE_OBJECTIVES?.[objective.type] || {};
          const owner = objective.owner ? playerName(objective.owner) : objective.active ? "Open" : `Appears ${Math.ceil(Math.max(0, objective.activeAt - state.serverTime))}s`;
          return `<div class="compact-row ${objective.owner === state.humanId ? "owned" : ""}">
            <i style="--item-color:${this.escape(def.color || "#83dced")}">${this.escape(def.short || "OB")}</i>
            <span><b>${this.escape(def.label || objective.type)}</b><small>${this.escape(owner)}</small></span>
          </div>`;
        })
        .join("");
      const campRows = camps
        .slice(0, 4)
        .map((camp) => {
          const def = camp.definition || state.config.objectives?.CRITTER_CAMPS?.[camp.type] || {};
          const owner = camp.owner ? playerName(camp.owner) : "Neutral";
          return `<div class="compact-row camp ${camp.owner === state.humanId ? "owned" : ""}">
            <i style="--item-color:${this.escape(def.color || "#d8ad48")}">${this.escape(def.short || "CP")}</i>
            <span><b>${this.escape(def.label || camp.type)}</b><small>${this.escape(owner)}</small></span>
          </div>`;
        })
        .join("");
      this.nodes.objectiveList.innerHTML = objectiveRows + campRows || `<p class="empty-list">Objectives appear soon.</p>`;
    }

    updateMissions(state) {
      const missions = (state.missions || []).slice(0, 4);
      this.nodes.missionList.innerHTML =
        missions
          .map((mission) => {
            const ratio = mission.target ? Math.max(0, Math.min(1, mission.progress / mission.target)) : mission.done ? 1 : 0;
            const value = mission.id === "reach10" ? `${Math.round(mission.progress * 100)}%` : `${Math.floor(mission.progress)}/${mission.target}`;
            return `<div class="mission-row ${mission.done ? "done" : ""}">
              <span><b>${this.escape(mission.label)}</b><small>${mission.done ? "Reward claimed" : this.escape(value)}</small></span>
              <i><b style="transform:scaleX(${ratio})"></b></i>
            </div>`;
          })
          .join("") || `<p class="empty-list">Missions loading.</p>`;
    }

    updateLakeEvent(state) {
      const active = state.lakeEvent?.active;
      this.nodes.lakeEventBanner.classList.toggle("hidden", !active);
      if (!active) return;
      this.nodes.lakeEventBanner.style.setProperty("--event-color", active.color || "#83dced");
      this.nodes.lakeEventTitle.textContent = active.label;
      this.nodes.lakeEventDetails.textContent = active.description;
      this.nodes.lakeEventTimer.textContent = `${Math.ceil(active.remaining || 0)}s`;
    }

    updateActionLabels(human) {
      if (human) this.lastHuman = human;
      const energy = human ? Math.round(human.energy * this.percent) : 0;
      this.nodes.expandButton.textContent = `Expand ${energy}`;
      this.nodes.attackButton.textContent = `Attack ${energy}`;
      this.nodes.defendButton.textContent = `Defend ${Math.round(energy * 0.75)}`;
    }

    toast(message, bad = false) {
      clearTimeout(this.toastTimer);
      this.nodes.toast.textContent = message;
      this.nodes.toast.classList.toggle("bad", bad);
      this.nodes.toast.classList.remove("hidden");
      this.toastTimer = setTimeout(() => this.nodes.toast.classList.add("hidden"), 2200);
    }

    flashEnergy() {
      const stat = this.nodes.energyStat.closest(".stat");
      stat.classList.remove("warning");
      void stat.offsetWidth;
      stat.classList.add("warning");
    }

    pulseAbility(bad = false) {
      const button = this.nodes.abilityButton;
      button.classList.remove("pulse", "bad-pulse");
      void button.offsetWidth;
      button.classList.add(bad ? "bad-pulse" : "pulse");
      setTimeout(() => button.classList.remove("pulse", "bad-pulse"), 460);
    }

    viewOptions() {
      return {
        strategicView: this.nodes.strategicView.checked,
        showIcons: this.nodes.showIcons.checked,
        effects: {
          level: this.nodes.effectsLevel.value,
          floatingText: this.nodes.floatingText.checked,
          attackArrows: this.nodes.attackArrows.checked,
          reducedMotion: this.nodes.reducedMotion.checked,
        },
      };
    }

    showResult(state, human) {
      const winner = state.players.find((player) => player.id === state.winnerId);
      this.nodes.resultScreen.classList.remove("hidden");
      this.nodes.resultTitle.textContent = winner?.id === state.humanId ? "Victory" : "Defeat";
      this.nodes.resultSummary.textContent = winner ? `${winner.name} controls the lake.` : "The match ended.";
      const rank =
        state.players
          .slice()
          .sort((a, b) => b.territoryPct - a.territoryPct)
          .findIndex((player) => player.id === state.humanId) + 1;
      const title = this.playstyleTitle(human);
      this.nodes.resultStats.innerHTML = `
        <dt>Title</dt><dd>${this.escape(title)}</dd>
        <dt>Final Rank</dt><dd>#${rank}</dd>
        <dt>Territory</dt><dd>${Math.round(human.territoryPct * 100)}%</dd>
        <dt>Level</dt><dd>${human.level || 1} ${this.escape(human.progression?.title || "")}</dd>
        <dt>Energy Used</dt><dd>${Math.round(human.stats.energyUsed)}</dd>
        <dt>Captured</dt><dd>${human.stats.tilesCaptured}</dd>
        <dt>Objectives</dt><dd>${human.stats.objectivesCaptured || 0}</dd>
        <dt>Camps</dt><dd>${human.stats.campsCaptured || 0}</dd>
        <dt>Abilities</dt><dd>${human.stats.abilitiesUsed || 0}</dd>
        <dt>Biggest Wave</dt><dd>${human.stats.bestAttackWave || 0}</dd>
        <dt>Buildings</dt><dd>${human.stats.buildingsBuilt || 0}</dd>
        <dt>Defeated</dt><dd>${human.stats.playersDefeated}</dd>
        <dt>Animal</dt><dd>${state.config.animals[human.animal].label}</dd>
      `;
    }

    playstyleTitle(human) {
      if ((human.stats.objectivesCaptured || 0) >= 2) return "Objective Master";
      if ((human.stats.bestAttackWave || 0) >= 12 || (human.stats.damageDealt || 0) > 180) return "War King";
      if ((human.stats.defenses || 0) >= 5) return "Defender";
      if ((human.flags?.lastNestProtection || false) && human.territoryPct > 0.04) return "Comeback Player";
      if ((human.stats.tilesCaptured || 0) >= 70) return "Fast Expander";
      return "Pond Commander";
    }

    formatTime(seconds) {
      const safe = Math.max(0, Math.floor(seconds));
      const mins = Math.floor(safe / 60);
      const secs = String(safe % 60).padStart(2, "0");
      return `${mins}:${secs}`;
    }

    escape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  }

  root.PondUI = PondUI;
})(window);
