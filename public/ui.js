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
    turtle: {
      name: "Turtle",
      icon: "T",
      className: "turtle",
      summary: "Turtle is a defensive tank. Build strong fronts, hold objectives, and use Shell Guard when enemies pressure your border.",
      ability: "Shell Guard",
      terrain: "Mud and defended borders",
      weakness: "Slow early expansion",
      strategy: "Defensive control",
    },
    carp: {
      name: "Carp",
      icon: "C",
      className: "carp",
      summary: "Carp scales through economy. Claim water and lily pads, build Lily Farms, and use Golden Current before big growth pushes.",
      ability: "Golden Current",
      terrain: "Open Water and Lily Pads",
      weakness: "Weak if rushed early",
      strategy: "Economy growth",
    },
  };

  class PondUI {
    constructor() {
      this.selectedAnimal = "duck";
      this.percent = 0.25;
      this.callbacks = {};
      this.audio = root.PondAudioManager ? new root.PondAudioManager() : null;
      this.nodes = {
        startScreen: document.querySelector("#startScreen"),
        gameScreen: document.querySelector("#gameScreen"),
        startButton: document.querySelector("#startButton"),
        createLobbyButton: document.querySelector("#createLobbyButton"),
        joinLobbyButton: document.querySelector("#joinLobbyButton"),
        practiceButton: document.querySelector("#practiceButton"),
        lobbyHelpButton: document.querySelector("#lobbyHelpButton"),
        startCard: document.querySelector(".start-card"),
        createLobbyPanel: document.querySelector("#createLobbyPanel"),
        joinLobbyPanel: document.querySelector("#joinLobbyPanel"),
        waitingRoom: document.querySelector("#waitingRoom"),
        createNameInput: document.querySelector("#createNameInput"),
        createAnimalSelect: document.querySelector("#createAnimalSelect"),
        createGameMode: document.querySelector("#createGameMode"),
        createMapSize: document.querySelector("#createMapSize"),
        createBotDifficulty: document.querySelector("#createBotDifficulty"),
        createBotCount: document.querySelector("#createBotCount"),
        createTeamCount: document.querySelector("#createTeamCount"),
        createBotsPerTeam: document.querySelector("#createBotsPerTeam"),
        createAllowBots: document.querySelector("#createAllowBots"),
        createLobbySubmit: document.querySelector("#createLobbySubmit"),
        createLobbyBack: document.querySelector("#createLobbyBack"),
        createLobbyCancel: document.querySelector("#createLobbyCancel"),
        createLobbyError: document.querySelector("#createLobbyError"),
        joinRoomCode: document.querySelector("#joinRoomCode"),
        joinPlayerName: document.querySelector("#joinPlayerName"),
        joinAnimalSelect: document.querySelector("#joinAnimalSelect"),
        joinLobbySubmit: document.querySelector("#joinLobbySubmit"),
        joinLobbyBack: document.querySelector("#joinLobbyBack"),
        joinLobbyCancel: document.querySelector("#joinLobbyCancel"),
        joinLobbyError: document.querySelector("#joinLobbyError"),
        waitingRoomTitle: document.querySelector("#waitingRoomTitle"),
        lobbyRoomCode: document.querySelector("#lobbyRoomCode"),
        copyRoomCodeButton: document.querySelector("#copyRoomCodeButton"),
        lobbyStatusText: document.querySelector("#lobbyStatusText"),
        lobbyPlayerList: document.querySelector("#lobbyPlayerList"),
        lobbyError: document.querySelector("#lobbyError"),
        lobbyPlayerName: document.querySelector("#lobbyPlayerName"),
        lobbyAnimalSelect: document.querySelector("#lobbyAnimalSelect"),
        lobbyTeamSelect: document.querySelector("#lobbyTeamSelect"),
        lobbyReadyButton: document.querySelector("#lobbyReadyButton"),
        lobbyHostControls: document.querySelector("#lobbyHostControls"),
        lobbyGameMode: document.querySelector("#lobbyGameMode"),
        lobbyMapSize: document.querySelector("#lobbyMapSize"),
        lobbyBotCount: document.querySelector("#lobbyBotCount"),
        lobbyBotDifficulty: document.querySelector("#lobbyBotDifficulty"),
        lobbyTeamCount: document.querySelector("#lobbyTeamCount"),
        lobbyBotsPerTeam: document.querySelector("#lobbyBotsPerTeam"),
        lobbyAllowBots: document.querySelector("#lobbyAllowBots"),
        lobbyForceStart: document.querySelector("#lobbyForceStart"),
        lobbyStartMatch: document.querySelector("#lobbyStartMatch"),
        leaveLobbyButton: document.querySelector("#leaveLobbyButton"),
        playerName: document.querySelector("#playerName"),
        gameMode: document.querySelector("#gameMode"),
        beginnerCombat: document.querySelector("#beginnerCombat"),
        mapSize: document.querySelector("#mapSize"),
        botCount: document.querySelector("#botCount"),
        matchLength: document.querySelector("#matchLength"),
        coopTeammates: document.querySelector("#coopTeammates"),
        teamBotDifficulty: document.querySelector("#teamBotDifficulty"),
        teamCount: document.querySelector("#teamCount"),
        botsPerTeam: document.querySelector("#botsPerTeam"),
        coopOptions: [...document.querySelectorAll(".coop-option")],
        battleOptions: [...document.querySelectorAll(".battle-option")],
        lobbyGuide: document.querySelector("#lobbyGuide"),
        closeLobbyGuide: document.querySelector("#closeLobbyGuide"),
        selectedAnimalIcon: document.querySelector("#selectedAnimalIcon"),
        selectedAnimalName: document.querySelector("#selectedAnimalName"),
        selectedAnimalSummary: document.querySelector("#selectedAnimalSummary"),
        selectedAnimalStats: document.querySelector("#selectedAnimalStats"),
        helpButton: document.querySelector("#helpButton"),
        settingsButton: document.querySelector("#settingsButton"),
        settingsPanel: document.querySelector("#settingsPanel"),
        settingsCloseButton: document.querySelector("#settingsCloseButton"),
        togglePanelsButton: document.querySelector("#togglePanelsButton"),
        difficulty: document.querySelector("#difficulty"),
        animalChoices: [...document.querySelectorAll(".animal-choice")],
        energyStat: document.querySelector("#energyStat"),
        incomeStat: document.querySelector("#incomeStat"),
        territoryStat: document.querySelector("#territoryStat"),
        animalStat: document.querySelector("#animalStat"),
        teamStat: document.querySelector("#teamStat"),
        timerStat: document.querySelector("#timerStat"),
        winDebugPanel: document.querySelector("#winDebugPanel"),
        controlMeter: document.querySelector("#controlMeter"),
        lakeEventBanner: document.querySelector("#lakeEventBanner"),
        lakeEventTitle: document.querySelector("#lakeEventTitle"),
        lakeEventDetails: document.querySelector("#lakeEventDetails"),
        lakeEventTimer: document.querySelector("#lakeEventTimer"),
        zoomInButton: document.querySelector("#zoomInButton"),
        zoomOutButton: document.querySelector("#zoomOutButton"),
        centerMapButton: document.querySelector("#centerMapButton"),
        resetZoomButton: document.querySelector("#resetZoomButton"),
        mobileStrategicButton: document.querySelector("#mobileStrategicButton"),
        collapseUiButton: document.querySelector("#collapseUiButton"),
        openLeaderboardButton: document.querySelector("#openLeaderboardButton"),
        mobileTeamButton: document.querySelector("#mobileTeamButton"),
        mobileMuteButton: document.querySelector("#mobileMuteButton"),
        mobileActionCard: document.querySelector("#mobileActionCard"),
        mobileActionTitle: document.querySelector("#mobileActionTitle"),
        mobileActionMeta: document.querySelector("#mobileActionMeta"),
        mobileActionDetail: document.querySelector("#mobileActionDetail"),
        mobileAttackActions: document.querySelector("#mobileAttackActions"),
        mobileAttackButtons: [...document.querySelectorAll("[data-mobile-attack]")],
        mobileMainAction: document.querySelector("#mobileMainAction"),
        mobileInfoAction: document.querySelector("#mobileInfoAction"),
        mobileCancelAction: document.querySelector("#mobileCancelAction"),
        tileTitle: document.querySelector("#tileTitle"),
        tileDetails: document.querySelector("#tileDetails"),
        tileOwner: document.querySelector("#tileOwner"),
        tileDefense: document.querySelector("#tileDefense"),
        tileFacts: document.querySelector("#tileFacts"),
        tileWarning: document.querySelector("#tileWarning"),
        leftPanel: document.querySelector(".left-panel"),
        rightPanel: document.querySelector(".right-panel"),
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
        objectiveCount: document.querySelector("#objectiveCount"),
        missionList: document.querySelector("#missionList"),
        missionCount: document.querySelector("#missionCount"),
        leaderboard: document.querySelector("#leaderboard"),
        leaderboardToggle: document.querySelector("#leaderboardToggle"),
        leaderboardExpandButton: document.querySelector("#leaderboardExpandButton"),
        rightPanelTabs: [...document.querySelectorAll("[data-right-panel-tab]")],
        rightTabPanels: [...document.querySelectorAll("[data-right-panel]")],
        toast: document.querySelector("#toast"),
        toastStack: document.querySelector("#toastStack"),
        percentRow: document.querySelector(".percent-row"),
        attackStyleRow: document.querySelector(".attack-style-row"),
        actionRow: document.querySelector(".action-row"),
        percentButtons: [...document.querySelectorAll(".percent-row [data-percent]")],
        attackStyleButtons: [...document.querySelectorAll("[data-attack-style]")],
        expandButton: document.querySelector("#expandButton"),
        attackButton: document.querySelector("#attackButton"),
        currentPushButton: document.querySelector("#currentPushButton"),
        defendButton: document.querySelector("#defendButton"),
        buildButton: document.querySelector("#buildButton"),
        teamButton: document.querySelector("#teamButton"),
        abilityButton: document.querySelector("#abilityButton"),
        specialButton: document.querySelector("#specialButton"),
        buildSelect: document.querySelector("#buildSelect"),
        diplomacyButtons: [...document.querySelectorAll("[data-diplomacy]")],
        strategicView: document.querySelector("#strategicView"),
        autoStrategicView: document.querySelector("#autoStrategicView"),
        showIcons: document.querySelector("#showIcons"),
        showAnimalIcons: document.querySelector("#showAnimalIcons"),
        showAnimalSprites: document.querySelector("#showAnimalSprites"),
        showAnimalAnimations: document.querySelector("#showAnimalAnimations"),
        showBorderStatus: document.querySelector("#showBorderStatus"),
        uiScale: document.querySelector("#uiScale"),
        effectsLevel: document.querySelector("#effectsLevel"),
        visualQuality: document.querySelector("#visualQuality"),
        particlesLevel: document.querySelector("#particlesLevel"),
        mapDecorations: document.querySelector("#mapDecorations"),
        floatingText: document.querySelector("#floatingText"),
        attackArrows: document.querySelector("#attackArrows"),
        abilityEffects: document.querySelector("#abilityEffects"),
        screenShake: document.querySelector("#screenShake"),
        reducedMotion: document.querySelector("#reducedMotion"),
        autoLowPerformance: document.querySelector("#autoLowPerformance"),
        soundEnabled: document.querySelector("#soundEnabled"),
        musicEnabled: document.querySelector("#musicEnabled"),
        uiSounds: document.querySelector("#uiSounds"),
        muteAll: document.querySelector("#muteAll"),
        masterVolume: document.querySelector("#masterVolume"),
        sfxVolume: document.querySelector("#sfxVolume"),
        musicVolume: document.querySelector("#musicVolume"),
        ambientVolume: document.querySelector("#ambientVolume"),
        tutorial: document.querySelector("#tutorial"),
        closeTutorial: document.querySelector("#closeTutorial"),
        resultScreen: document.querySelector("#resultScreen"),
        resultTitle: document.querySelector("#resultTitle"),
        resultSummary: document.querySelector("#resultSummary"),
        resultStats: document.querySelector("#resultStats"),
        resultRewards: document.querySelector("#resultRewards"),
        playAgain: document.querySelector("#playAgain"),
        viewProfileFromResult: document.querySelector("#viewProfileFromResult"),
        backToLobbyFromResult: document.querySelector("#backToLobbyFromResult"),
        mobileSheet: document.querySelector("#mobileSheet"),
        mobileSheetLabel: document.querySelector("#mobileSheetLabel"),
        mobileSheetTitle: document.querySelector("#mobileSheetTitle"),
        mobileSheetBody: document.querySelector("#mobileSheetBody"),
        closeMobileSheet: document.querySelector("#closeMobileSheet"),
        buildSheet: document.querySelector("#buildSheet"),
        buildSheetList: document.querySelector("#buildSheetList"),
        closeBuildSheet: document.querySelector("#closeBuildSheet"),
        specialSheet: document.querySelector("#specialSheet"),
        specialSheetList: document.querySelector("#specialSheetList"),
        closeSpecialSheet: document.querySelector("#closeSpecialSheet"),
        teamSheet: document.querySelector("#teamSheet"),
        teamSheetTitle: document.querySelector("#teamSheetTitle"),
        teamSheetBody: document.querySelector("#teamSheetBody"),
        closeTeamSheet: document.querySelector("#closeTeamSheet"),
      };
      this.leaderboardMode = "players";
      this.leaderboardExpanded = false;
      this.rightPanelTab = "leaderboard";
      this.debugMode = new URLSearchParams(window.location.search).has("debug") || localStorage.getItem("pondfront:debug") === "1";
      document.body.classList.toggle("debug-open", this.debugMode);
      this.nodes.strategicView.checked = true;
      this.nodes.showIcons.checked = false;
      if (this.nodes.showAnimalIcons) this.nodes.showAnimalIcons.checked = true;
      if (this.nodes.showAnimalSprites) this.nodes.showAnimalSprites.checked = true;
      if (this.nodes.showAnimalAnimations) this.nodes.showAnimalAnimations.checked = true;
      if (this.nodes.showBorderStatus) this.nodes.showBorderStatus.checked = true;
      if (this.isMobile()) {
        if (this.nodes.effectsLevel) this.nodes.effectsLevel.value = "medium";
        if (this.nodes.visualQuality) this.nodes.visualQuality.value = "medium";
        if (this.nodes.particlesLevel) this.nodes.particlesLevel.value = "medium";
        if (this.nodes.screenShake) this.nodes.screenShake.checked = false;
        if (this.nodes.showAnimalAnimations) this.nodes.showAnimalAnimations.checked = false;
      }
      this.setUiScale(localStorage.getItem("pondfront:ui-scale") || "compact");
      this.syncAudioControls();
      this.tooltips = root.PondTooltips ? new root.PondTooltips() : null;
      this.helpMenu = root.PondHelpMenu ? new root.PondHelpMenu(this.nodes.helpButton) : null;
      this.bind();
      this.setRightPanelTab("leaderboard");
      this.updateLobbyAnimal();
      this.updateLobbyMode();
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
          this.audio?.unlock();
          this.audio?.play("click", { ui: true });
          this.selectedAnimal = button.dataset.animal;
          this.nodes.animalChoices.forEach((candidate) => candidate.classList.toggle("selected", candidate === button));
          this.updateLobbyAnimal();
        });
      });

      this.nodes.startButton.addEventListener("click", () => {
        this.audio?.unlock();
        this.audio?.play("start");
        this.emit("start", this.startPayload());
      });
      this.nodes.createLobbyButton?.addEventListener("click", () => this.showCreateLobby());
      this.nodes.joinLobbyButton?.addEventListener("click", () => this.showJoinLobby());
      this.nodes.createLobbyBack?.addEventListener("click", () => this.showHome());
      this.nodes.createLobbyCancel?.addEventListener("click", () => this.showHome());
      this.nodes.joinLobbyBack?.addEventListener("click", () => this.showHome());
      this.nodes.joinLobbyCancel?.addEventListener("click", () => this.showHome());
      this.nodes.createLobbySubmit?.addEventListener("click", () => {
        this.audio?.unlock();
        this.audio?.play("start");
        this.emit("createLobby", this.createLobbyPayload());
      });
      this.nodes.joinLobbySubmit?.addEventListener("click", () => {
        this.audio?.unlock();
        this.audio?.play("start");
        this.emit("joinLobby", this.joinLobbyPayload());
      });
      this.nodes.joinRoomCode?.addEventListener("input", () => {
        this.nodes.joinRoomCode.value = this.normalizeRoomCode(this.nodes.joinRoomCode.value);
      });
      this.nodes.copyRoomCodeButton?.addEventListener("click", async () => {
        const code = this.nodes.lobbyRoomCode?.textContent || "";
        try {
          await navigator.clipboard?.writeText(code);
          this.toast("Room code copied.");
        } catch {
          this.toast(`Room code: ${code}`);
        }
      });
      this.nodes.lobbyReadyButton?.addEventListener("click", () => {
        const ready = !this.currentLobbyPlayer?.ready;
        this.emit("lobbyReady", { ready });
      });
      this.nodes.lobbyStartMatch?.addEventListener("click", () => this.emit("lobbyStart"));
      this.nodes.leaveLobbyButton?.addEventListener("click", () => this.emit("lobbyLeave"));
      [this.nodes.lobbyPlayerName, this.nodes.lobbyAnimalSelect, this.nodes.lobbyTeamSelect].forEach((node) =>
        node?.addEventListener("change", () => this.emit("lobbyUpdatePlayer", this.lobbyPlayerPayload())),
      );
      [
        this.nodes.lobbyGameMode,
        this.nodes.lobbyMapSize,
        this.nodes.lobbyBotCount,
        this.nodes.lobbyBotDifficulty,
        this.nodes.lobbyTeamCount,
        this.nodes.lobbyBotsPerTeam,
        this.nodes.lobbyAllowBots,
        this.nodes.lobbyForceStart,
      ].forEach((node) =>
        node?.addEventListener("change", () => {
          this.emit("lobbyUpdateSettings", this.lobbySettingsPayload());
        }),
      );
      this.nodes.practiceButton?.addEventListener("click", () => {
        this.audio?.unlock();
        this.audio?.play("start");
        this.emit("start", this.startPayload({ difficulty: "easy", mapSize: "small", botCount: 4, matchLength: "quick", practice: true }));
      });
      this.nodes.gameMode?.addEventListener("change", () => {
        this.updateLobbyMode();
        this.syncBotOptions();
      });
      this.nodes.difficulty?.addEventListener("change", () => {
        if (this.nodes.beginnerCombat && this.nodes.difficulty.value === "easy") this.nodes.beginnerCombat.checked = true;
      });
      this.nodes.teamCount?.addEventListener("change", () => this.syncBotOptions());
      this.nodes.botsPerTeam?.addEventListener("change", () => this.syncBotOptions());
      this.nodes.mapSize?.addEventListener("change", () => this.syncBotOptions());
      this.nodes.lobbyHelpButton?.addEventListener("click", () => this.nodes.lobbyGuide?.classList.remove("hidden"));
      this.nodes.closeLobbyGuide?.addEventListener("click", () => this.nodes.lobbyGuide?.classList.add("hidden"));
      this.nodes.lobbyGuide?.addEventListener("click", (event) => {
        if (event.target === this.nodes.lobbyGuide) this.nodes.lobbyGuide.classList.add("hidden");
      });
      this.nodes.settingsButton?.addEventListener("click", () => this.openSettings());
      this.nodes.settingsCloseButton?.addEventListener("click", () => this.closeSettings());
      this.nodes.settingsPanel?.addEventListener("click", (event) => {
        if (event.target === this.nodes.settingsPanel) this.closeSettings();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !this.nodes.settingsPanel?.classList.contains("hidden")) this.closeSettings();
      });
      this.nodes.togglePanelsButton?.addEventListener("click", () => {
        document.body.classList.toggle("side-panels-collapsed");
        const collapsed = document.body.classList.contains("side-panels-collapsed");
        this.nodes.togglePanelsButton.classList.toggle("active", collapsed);
        this.nodes.togglePanelsButton.textContent = collapsed ? "Show" : "Panels";
      });
      this.nodes.rightPanelTabs?.forEach((button) => {
        button.addEventListener("click", () => {
          this.setRightPanelTab(button.dataset.rightPanelTab || "leaderboard");
          if (this.isMobile()) {
            document.body.classList.add("leaderboard-open");
            this.nodes.openLeaderboardButton?.classList.add("active");
          }
        });
      });
      this.nodes.leaderboardExpandButton?.addEventListener("click", () => {
        this.leaderboardExpanded = !this.leaderboardExpanded;
        this.nodes.rightPanel?.classList.toggle("leaderboard-expanded", this.leaderboardExpanded);
        this.updateLeaderboard(this.lastState);
      });
      this.nodes.lakeEventBanner?.addEventListener("click", () => {
        const tileId = Number(this.nodes.lakeEventBanner.dataset.focusTileId);
        if (Number.isFinite(tileId)) this.emit("camera", { type: "focusTile", tileId });
      });

      this.nodes.percentButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setPercent(Number(button.dataset.percent));
        });
      });
      this.nodes.attackStyleButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const percent = Number(button.dataset.percent || 0.25);
          this.setPercent(percent);
          this.emit("action", { type: "attack", percent, style: button.dataset.attackStyle });
        });
      });

      this.nodes.expandButton.addEventListener("click", () => this.emit("action", { type: "expand" }));
      this.nodes.attackButton.addEventListener("click", () => this.emit("action", { type: "attack" }));
      this.nodes.currentPushButton?.addEventListener("click", () => this.emit("action", { type: "waterRoute" }));
      this.nodes.defendButton.addEventListener("click", () => this.emit("action", { type: "defend" }));
      this.nodes.buildButton.addEventListener("click", () => {
        if (this.isMobile()) this.openBuildSheet();
        else this.emit("action", { type: "build", buildingType: this.nodes.buildSelect.value });
      });
      this.nodes.teamButton?.addEventListener("click", () => this.openTeamSheet());
      this.nodes.mobileTeamButton?.addEventListener("click", () => this.openTeamSheet());
      this.nodes.abilityButton.addEventListener("click", () => this.emit("action", { type: "ability" }));
      this.nodes.specialButton?.addEventListener("click", () => this.openSpecialSheet());
      this.nodes.diplomacyButtons.forEach((button) => {
        button.addEventListener("click", () => this.emit("diplomacy", button.dataset.command || button.dataset.diplomacy));
      });
      this.nodes.closeTutorial.addEventListener("click", () => {
        this.nodes.tutorial.classList.add("hidden");
        localStorage.setItem("pondfront:tutorial", "done");
      });
      this.nodes.playAgain.addEventListener("click", () => this.emit("start", this.startPayload()));
      this.nodes.viewProfileFromResult?.addEventListener("click", () => this.emit("openProfile"));
      this.nodes.backToLobbyFromResult?.addEventListener("click", () => this.emit("home"));
      this.nodes.strategicView.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.autoStrategicView.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showIcons.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showAnimalIcons?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showAnimalSprites?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showAnimalAnimations?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showBorderStatus?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.uiScale?.addEventListener("change", () => this.setUiScale(this.nodes.uiScale.value));
      this.nodes.effectsLevel.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.visualQuality?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.particlesLevel?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.mapDecorations?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.floatingText.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.attackArrows.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.abilityEffects?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.screenShake?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.reducedMotion.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.autoLowPerformance.addEventListener("change", () => this.emit("viewChanged"));
      [
        this.nodes.soundEnabled,
        this.nodes.musicEnabled,
        this.nodes.uiSounds,
        this.nodes.muteAll,
        this.nodes.masterVolume,
        this.nodes.sfxVolume,
        this.nodes.musicVolume,
        this.nodes.ambientVolume,
      ].forEach((node) => node?.addEventListener("input", () => this.updateAudioSettings()));
      this.nodes.mobileMuteButton?.addEventListener("click", () => {
        this.audio?.unlock();
        const muted = !this.audio?.settings?.muted;
        if (this.nodes.muteAll) this.nodes.muteAll.checked = muted;
        this.updateAudioSettings();
        this.audio?.play(muted ? "warning" : "click", { ui: true, cooldown: 0 });
      });
      document.addEventListener("pointerover", (event) => {
        if (!event.target.closest?.("button, select, input[type='range']")) return;
        this.audio?.play("hover", { ui: true, cooldown: 85, volume: 0.55 });
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest?.("button, select, input, label")) return;
        this.audio?.unlock();
        this.audio?.play("click", { ui: true, cooldown: 55, volume: 0.7 });
      });
      this.nodes.zoomInButton?.addEventListener("click", () => this.emit("camera", { type: "zoomIn" }));
      this.nodes.zoomOutButton?.addEventListener("click", () => this.emit("camera", { type: "zoomOut" }));
      this.nodes.centerMapButton?.addEventListener("click", () => this.emit("camera", { type: "center" }));
      this.nodes.resetZoomButton?.addEventListener("click", () => this.emit("camera", { type: "reset" }));
      this.nodes.mobileStrategicButton?.addEventListener("click", () => {
        this.nodes.strategicView.checked = !this.nodes.strategicView.checked;
        this.nodes.mobileStrategicButton.classList.toggle("active", this.nodes.strategicView.checked);
        this.emit("viewChanged");
      });
      this.nodes.collapseUiButton?.addEventListener("click", () => {
        document.body.classList.toggle("ui-collapsed");
        this.nodes.collapseUiButton.classList.toggle("active", document.body.classList.contains("ui-collapsed"));
      });
      this.nodes.openLeaderboardButton?.addEventListener("click", () => {
        const open = this.rightPanelTab !== "leaderboard" || !document.body.classList.contains("leaderboard-open");
        document.body.classList.toggle("leaderboard-open", open);
        this.setRightPanelTab("leaderboard");
        this.nodes.openLeaderboardButton.classList.toggle("active", open);
      });
      this.nodes.leaderboardToggle?.addEventListener("click", () => {
        this.leaderboardMode = this.leaderboardMode === "teams" ? "players" : "teams";
        this.updateLeaderboard(this.lastState);
      });
      this.nodes.mobileMainAction?.addEventListener("click", () => {
        const type = this.nodes.mobileMainAction.dataset.actionType;
        const percent = Number(this.nodes.mobileMainAction.dataset.percent || this.percent);
        if (!type) return;
        if (type === "build") this.openBuildSheet();
        else this.emit("action", { type, percent, specialType: this.nodes.mobileMainAction.dataset.specialType || "" });
      });
      this.nodes.mobileAttackButtons?.forEach((button) => {
        button.addEventListener("click", () => {
          const percent = Number(button.dataset.mobileAttack || 0.25);
          this.setPercent(percent);
          this.emit("action", { type: "attack", percent, style: this.attackStyleName(percent) });
        });
      });
      this.nodes.mobileInfoAction?.addEventListener("click", () => this.openMobileInfoSheet());
      this.nodes.mobileCancelAction?.addEventListener("click", () => {
        this.nodes.mobileActionCard.classList.add("hidden");
        this.emit("camera", { type: "cancel" });
      });
      this.nodes.closeMobileSheet?.addEventListener("click", () => this.nodes.mobileSheet.classList.add("hidden"));
      this.nodes.mobileSheet?.addEventListener("click", (event) => {
        if (event.target === this.nodes.mobileSheet) this.nodes.mobileSheet.classList.add("hidden");
      });
      this.nodes.closeBuildSheet?.addEventListener("click", () => this.nodes.buildSheet.classList.add("hidden"));
      this.nodes.buildSheet?.addEventListener("click", (event) => {
        if (event.target === this.nodes.buildSheet) this.nodes.buildSheet.classList.add("hidden");
        const button = event.target.closest("[data-build-choice]");
        if (button) {
          this.nodes.buildSelect.value = button.dataset.buildChoice;
          this.nodes.buildSheet.classList.add("hidden");
          this.emit("action", { type: "build", buildingType: button.dataset.buildChoice });
          return;
        }
        const buildingButton = event.target.closest("[data-building-action]");
        if (buildingButton) {
          this.nodes.buildSheet.classList.add("hidden");
          this.emit("action", { type: buildingButton.dataset.buildingAction });
        }
      });
      this.nodes.closeSpecialSheet?.addEventListener("click", () => this.nodes.specialSheet.classList.add("hidden"));
      this.nodes.specialSheet?.addEventListener("click", (event) => {
        if (event.target === this.nodes.specialSheet) this.nodes.specialSheet.classList.add("hidden");
        const button = event.target.closest("[data-special-choice]");
        if (!button) return;
        this.nodes.specialSheet.classList.add("hidden");
        this.emit("action", { type: "special", specialType: button.dataset.specialChoice });
      });
      this.nodes.closeTeamSheet?.addEventListener("click", () => this.nodes.teamSheet.classList.add("hidden"));
      this.nodes.teamSheet?.addEventListener("click", (event) => {
        if (event.target === this.nodes.teamSheet) this.nodes.teamSheet.classList.add("hidden");
        const button = event.target.closest("[data-team-command]");
        if (!button) return;
        this.nodes.teamSheet.classList.add("hidden");
        this.emit("teamCommand", button.dataset.teamCommand);
      });
    }

    openSettings() {
      this.nodes.settingsPanel?.classList.remove("hidden");
      this.nodes.settingsButton?.setAttribute("aria-expanded", "true");
      document.body.classList.add("settings-open");
    }

    closeSettings() {
      this.nodes.settingsPanel?.classList.add("hidden");
      this.nodes.settingsButton?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("settings-open");
    }

    setRightPanelTab(tab = "leaderboard") {
      const allowed = ["leaderboard", "objectives", "missions"];
      this.rightPanelTab = allowed.includes(tab) ? tab : "leaderboard";
      this.nodes.rightPanelTabs?.forEach((button) => button.classList.toggle("active", button.dataset.rightPanelTab === this.rightPanelTab));
      this.nodes.rightTabPanels?.forEach((panel) => panel.classList.toggle("active", panel.dataset.rightPanel === this.rightPanelTab));
      document.body.dataset.rightPanelTab = this.rightPanelTab;
    }

    setUiScale(scale = "compact") {
      const next = ["tiny", "compact", "normal", "large"].includes(scale) ? scale : "compact";
      if (this.nodes.uiScale) this.nodes.uiScale.value = next;
      document.body.classList.toggle("ui-tiny", next === "tiny");
      document.body.classList.toggle("ui-compact", next === "compact");
      document.body.classList.toggle("ui-large", next === "large");
      localStorage.setItem("pondfront:ui-scale", next);
      this.emit("viewChanged");
    }

    syncAudioControls() {
      if (!this.audio) return;
      const settings = this.audio.settings;
      if (this.nodes.soundEnabled) this.nodes.soundEnabled.checked = settings.soundEnabled;
      if (this.nodes.musicEnabled) this.nodes.musicEnabled.checked = settings.musicEnabled;
      if (this.nodes.uiSounds) this.nodes.uiSounds.checked = settings.uiSounds;
      if (this.nodes.muteAll) this.nodes.muteAll.checked = settings.muted;
      if (this.nodes.masterVolume) this.nodes.masterVolume.value = settings.masterVolume;
      if (this.nodes.sfxVolume) this.nodes.sfxVolume.value = settings.sfxVolume;
      if (this.nodes.musicVolume) this.nodes.musicVolume.value = settings.musicVolume;
      if (this.nodes.ambientVolume) this.nodes.ambientVolume.value = settings.ambientVolume ?? 1;
      this.updateMuteButton();
    }

    updateAudioSettings() {
      if (!this.audio) return;
      this.audio.setSettings({
        soundEnabled: this.nodes.soundEnabled?.checked !== false,
        musicEnabled: this.nodes.musicEnabled?.checked !== false,
        uiSounds: this.nodes.uiSounds?.checked !== false,
        muted: Boolean(this.nodes.muteAll?.checked),
        masterVolume: Number(this.nodes.masterVolume?.value ?? 0.72),
        sfxVolume: Number(this.nodes.sfxVolume?.value ?? 0.78),
        musicVolume: Number(this.nodes.musicVolume?.value ?? 0.28),
        ambientVolume: Number(this.nodes.ambientVolume?.value ?? 1),
      });
      this.updateMuteButton();
    }

    updateMuteButton() {
      const button = this.nodes.mobileMuteButton;
      if (!button || !this.audio) return;
      const muted = this.audio.settings.muted || !this.audio.settings.soundEnabled;
      button.textContent = muted ? "Mute" : "Sound";
      button.classList.toggle("muted", muted);
      button.title = muted ? "Turn sound on" : "Mute sound";
    }

    startPayload(overrides = {}) {
      const playerName = (this.nodes.playerName?.value || "Player").trim().slice(0, 18) || "Player";
      return {
        animal: this.selectedAnimal,
        playerName,
        difficulty: this.nodes.difficulty.value,
        beginnerCombat: this.nodes.beginnerCombat?.checked || this.nodes.difficulty.value === "easy",
        gameMode: this.nodes.gameMode?.value || "solo",
        mapSize: this.nodes.mapSize?.value || "large",
        botCount: Number(this.nodes.botCount?.value || 12),
        matchLength: this.nodes.matchLength?.value || "standard",
        coopTeammates: Number(this.nodes.coopTeammates?.value || 2),
        teamBotDifficulty: this.nodes.teamBotDifficulty?.value || "normal",
        teamCount: Number(this.nodes.teamCount?.value || 2),
        botsPerTeam: Number(this.nodes.botsPerTeam?.value || 4),
        ...overrides,
      };
    }

    createLobbyPayload() {
      const fallback = this.startPayload();
      return {
        playerName: (this.nodes.createNameInput?.value || fallback.playerName).trim().slice(0, 18) || "Player",
        animal: this.nodes.createAnimalSelect?.value || fallback.animal,
        gameMode: this.nodes.createGameMode?.value || fallback.gameMode,
        mapSize: this.nodes.createMapSize?.value || fallback.mapSize,
        botDifficulty: this.nodes.createBotDifficulty?.value || fallback.difficulty,
        difficulty: this.nodes.createBotDifficulty?.value || fallback.difficulty,
        botCount: Number(this.nodes.createBotCount?.value ?? fallback.botCount),
        teamCount: Number(this.nodes.createTeamCount?.value || fallback.teamCount),
        botsPerTeam: Number(this.nodes.createBotsPerTeam?.value || fallback.botsPerTeam),
        allowBots: this.nodes.createAllowBots?.checked !== false,
        matchLength: fallback.matchLength,
        coopTeammates: fallback.coopTeammates,
        teamBotDifficulty: fallback.teamBotDifficulty,
      };
    }

    joinLobbyPayload() {
      return {
        roomCode: this.normalizeRoomCode(this.nodes.joinRoomCode?.value || ""),
        playerName: (this.nodes.joinPlayerName?.value || this.nodes.playerName?.value || "Player").trim().slice(0, 18) || "Player",
        animal: this.nodes.joinAnimalSelect?.value || this.selectedAnimal,
      };
    }

    lobbyPlayerPayload() {
      return {
        playerName: (this.nodes.lobbyPlayerName?.value || "Player").trim().slice(0, 18) || "Player",
        animal: this.nodes.lobbyAnimalSelect?.value || this.currentLobbyPlayer?.animal || this.selectedAnimal,
        teamId: this.nodes.lobbyTeamSelect?.value || this.currentLobbyPlayer?.teamId || null,
      };
    }

    lobbySettingsPayload() {
      return {
        gameMode: this.nodes.lobbyGameMode?.value || "solo",
        mapSize: this.nodes.lobbyMapSize?.value || "medium",
        botCount: Number(this.nodes.lobbyBotCount?.value || 0),
        botDifficulty: this.nodes.lobbyBotDifficulty?.value || "normal",
        difficulty: this.nodes.lobbyBotDifficulty?.value || "normal",
        teamCount: Number(this.nodes.lobbyTeamCount?.value || 2),
        botsPerTeam: Number(this.nodes.lobbyBotsPerTeam?.value || 0),
        allowBots: this.nodes.lobbyAllowBots?.checked !== false,
        forceStart: Boolean(this.nodes.lobbyForceStart?.checked),
      };
    }

    showHome() {
      this.nodes.startCard?.classList.remove("hidden");
      this.nodes.createLobbyPanel?.classList.add("hidden");
      this.nodes.joinLobbyPanel?.classList.add("hidden");
      this.nodes.waitingRoom?.classList.add("hidden");
      this.setLobbyError("");
    }

    showCreateLobby() {
      const payload = this.startPayload();
      if (this.nodes.createNameInput) this.nodes.createNameInput.value = payload.playerName;
      this.setSelectValue(this.nodes.createAnimalSelect, payload.animal);
      this.setSelectValue(this.nodes.createGameMode, payload.gameMode === "solo" ? "solo" : payload.gameMode);
      this.setSelectValue(this.nodes.createMapSize, payload.mapSize === "large" ? "medium" : payload.mapSize);
      this.setSelectValue(this.nodes.createBotDifficulty, payload.difficulty);
      this.setSelectValue(this.nodes.createBotCount, String(Math.min(10, payload.botCount || 8)));
      this.setSelectValue(this.nodes.createTeamCount, String(payload.teamCount || 2));
      this.setSelectValue(this.nodes.createBotsPerTeam, String(payload.botsPerTeam || 4));
      if (this.nodes.createAllowBots) this.nodes.createAllowBots.checked = true;
      this.nodes.startCard?.classList.add("hidden");
      this.nodes.createLobbyPanel?.classList.remove("hidden");
      this.nodes.joinLobbyPanel?.classList.add("hidden");
      this.nodes.waitingRoom?.classList.add("hidden");
      this.setLobbyError("");
    }

    showJoinLobby() {
      if (this.nodes.joinPlayerName) this.nodes.joinPlayerName.value = this.nodes.playerName?.value || "Player";
      this.setSelectValue(this.nodes.joinAnimalSelect, this.selectedAnimal);
      this.nodes.startCard?.classList.add("hidden");
      this.nodes.createLobbyPanel?.classList.add("hidden");
      this.nodes.joinLobbyPanel?.classList.remove("hidden");
      this.nodes.waitingRoom?.classList.add("hidden");
      this.nodes.joinRoomCode?.focus();
      this.setLobbyError("");
    }

    showWaitingRoom(lobby, session) {
      this.nodes.startCard?.classList.add("hidden");
      this.nodes.createLobbyPanel?.classList.add("hidden");
      this.nodes.joinLobbyPanel?.classList.add("hidden");
      this.nodes.waitingRoom?.classList.remove("hidden");
      this.updateLobbyState(lobby, session);
    }

    updateLobbyState(lobby, session = this.currentLobbySession) {
      if (!lobby) return;
      this.currentLobby = lobby;
      this.currentLobbySession = session || this.currentLobbySession;
      const viewerId = this.currentLobbySession?.playerId;
      const viewer = lobby.players.find((player) => player.id === viewerId) || lobby.players.find((player) => player.isViewer);
      this.currentLobbyPlayer = viewer || null;
      const isHost = Boolean(viewer?.isHost || this.currentLobbySession?.isHost);
      if (this.nodes.waitingRoomTitle) this.nodes.waitingRoomTitle.textContent = `${lobby.settings.gameMode === "teamBattle" ? "Team Battle" : lobby.settings.gameMode === "coop" ? "Co-Op Team" : "Free-for-all"} Lobby`;
      if (this.nodes.lobbyRoomCode) this.nodes.lobbyRoomCode.textContent = lobby.roomCode;
      if (this.nodes.lobbyStatusText) {
        const ready = lobby.players.filter((player) => player.ready || player.isHost).length;
        this.nodes.lobbyStatusText.textContent = `${ready}/${lobby.players.length} ready`;
      }
      this.renderLobbyPlayers(lobby);
      this.syncLobbyTeamSelect(lobby, viewer);
      if (viewer) {
        if (this.nodes.lobbyPlayerName && document.activeElement !== this.nodes.lobbyPlayerName) this.nodes.lobbyPlayerName.value = viewer.name;
        this.setSelectValue(this.nodes.lobbyAnimalSelect, viewer.animal);
        this.setSelectValue(this.nodes.lobbyTeamSelect, viewer.teamId || "");
      }
      if (this.nodes.lobbyReadyButton) {
        this.nodes.lobbyReadyButton.disabled = isHost;
        this.nodes.lobbyReadyButton.textContent = isHost ? "Host" : viewer?.ready ? "Ready - Tap to Unready" : "Ready Up";
        this.nodes.lobbyReadyButton.classList.toggle("ready", Boolean(viewer?.ready));
      }
      if (this.nodes.lobbyHostControls) this.nodes.lobbyHostControls.classList.toggle("hidden", !isHost);
      if (this.nodes.lobbyStartMatch) this.nodes.lobbyStartMatch.classList.toggle("hidden", !isHost);
      this.syncHostControls(lobby);
    }

    renderLobbyPlayers(lobby) {
      if (!this.nodes.lobbyPlayerList) return;
      const teams = new Map((lobby.teams || []).map((team) => [`team-${team.id}`, team]));
      this.nodes.lobbyPlayerList.innerHTML = lobby.players
        .map((player) => {
          const animal = LOBBY_ANIMALS[player.animal] || LOBBY_ANIMALS.duck;
          const visual = this.visualFor(player.animal);
          const animalColor = visual.badge || root.PondAnimals?.[player.animal]?.color || "#83dced";
          const team = teams.get(player.teamId);
          const ready = player.isHost ? "Host" : player.ready ? "Ready" : "Not ready";
          const badge = (root.PondBadgeConfig || []).find((entry) => entry.id === player.selectedBadge);
          const accountLine = player.accountUserId ? `L${player.accountLevel || 1} | ${this.escape(badge?.label || "Badge")}` : "Guest";
          return `<div class="lobby-player-row ${player.isViewer ? "viewer" : ""} ${player.connected ? "" : "disconnected"}" style="--team-color:${this.escape(team?.color || animalColor)}">
            ${this.animalDisc(player.animal, `${visual.label} ${visual.role}`)}
            <span class="lobby-player-main"><b>${this.escape(player.name)} ${player.isHost ? "<em>HOST</em>" : ""}</b><small>${this.escape(animal.name)} | ${this.escape(visual.role || "Pond role")}${team ? ` | ${this.escape(team.name)}` : " | Free-for-all"} | ${accountLine}</small></span>
            <strong>${this.escape(ready)}</strong>
          </div>`;
        })
        .join("");
    }

    syncLobbyTeamSelect(lobby, viewer) {
      const select = this.nodes.lobbyTeamSelect;
      if (!select) return;
      const mode = lobby.settings.gameMode;
      if (mode === "solo") {
        select.innerHTML = `<option value="">Free-for-all</option>`;
        select.disabled = true;
        return;
      }
      if (mode === "coop") {
        select.innerHTML = `<option value="team-blue">Blue Team</option>`;
        select.disabled = true;
        return;
      }
      select.disabled = false;
      select.innerHTML = (lobby.teams || root.PondTeams?.teams || [])
        .map((team) => `<option value="team-${this.escape(team.id)}">${this.escape(team.name)}</option>`)
        .join("");
      this.setSelectValue(select, viewer?.teamId || select.options[0]?.value || "");
    }

    syncHostControls(lobby) {
      const settings = lobby.settings || {};
      this.setSelectValue(this.nodes.lobbyGameMode, settings.gameMode || "solo");
      this.setSelectValue(this.nodes.lobbyMapSize, settings.mapSize || "medium");
      this.setSelectValue(this.nodes.lobbyBotCount, String(settings.botCount ?? 8));
      this.setSelectValue(this.nodes.lobbyBotDifficulty, settings.botDifficulty || settings.difficulty || "normal");
      this.setSelectValue(this.nodes.lobbyTeamCount, String(settings.teamCount || 2));
      this.setSelectValue(this.nodes.lobbyBotsPerTeam, String(settings.botsPerTeam ?? 4));
      if (this.nodes.lobbyAllowBots) this.nodes.lobbyAllowBots.checked = settings.allowBots !== false;
      if (this.nodes.lobbyForceStart) this.nodes.lobbyForceStart.checked = Boolean(settings.forceStart);
    }

    setLobbyError(message = "", panel = "all") {
      const nodes = panel === "create" ? [this.nodes.createLobbyError] : panel === "join" ? [this.nodes.joinLobbyError] : [this.nodes.createLobbyError, this.nodes.joinLobbyError, this.nodes.lobbyError];
      nodes.forEach((node) => {
        if (!node) return;
        node.textContent = message;
        node.classList.toggle("hidden", !message);
      });
    }

    setLobbyLoading(kind, loading) {
      const node =
        kind === "create"
          ? this.nodes.createLobbySubmit
          : kind === "join"
            ? this.nodes.joinLobbySubmit
            : kind === "start"
              ? this.nodes.lobbyStartMatch
              : this.nodes.lobbyReadyButton;
      if (!node) return;
      node.disabled = Boolean(loading);
      node.classList.toggle("loading", Boolean(loading));
    }

    normalizeRoomCode(value) {
      const raw = String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (raw.startsWith("POND") && raw.length > 4) return `POND-${raw.slice(4, 10)}`;
      return raw.slice(0, 8);
    }

    setSelectValue(select, value) {
      if (!select) return;
      const stringValue = String(value ?? "");
      if (![...select.options].some((option) => option.value === stringValue)) return;
      select.value = stringValue;
    }

    visualFor(animalId) {
      return root.PondAnimalVisuals?.animals?.[animalId] || {
        id: animalId || "duck",
        label: root.PondAnimals?.[animalId]?.label || "Animal",
        short: root.PondAnimals?.[animalId]?.icon || "A",
        badge: root.PondAnimals?.[animalId]?.color || "#83dced",
        accent: "#edf8fb",
        role: "Pond Strategy",
        terrain: "Mixed pond",
        weakness: "None",
        ability: root.PondAnimals?.[animalId]?.ability || "Ability",
        difficulty: "Medium",
        victoryTitle: "Pond Commander",
        tooltip: root.PondAnimals?.[animalId]?.perk || "Animal ability.",
      };
    }

    animalDisc(animalId, title = "", className = "") {
      const visual = this.visualFor(animalId);
      const label = title || visual.label;
      return `<span class="animal-disc animal-visual-disc ${this.escape(visual.id)} ${this.escape(className)}" style="--animal-color:${this.escape(visual.badge)};--animal-accent:${this.escape(visual.accent)}" title="${this.escape(label)}">${this.escape(visual.short)}</span>`;
    }

    animalInline(animalId, text = "") {
      const visual = this.visualFor(animalId);
      const label = text || visual.label;
      return `<span class="animal-inline">${this.animalDisc(animalId, visual.label, "mini")}<span>${this.escape(label)}</span></span>`;
    }

    abilityInline(animalId, abilityName = "") {
      const visual = this.visualFor(animalId);
      return `<span class="ability-inline ability-${this.escape(visual.id)}"><i class="ability-icon ${this.escape(visual.abilityIcon || visual.id)}"></i><span>${this.escape(abilityName || visual.ability)}</span></span>`;
    }

    buildingVisual(id) {
      return root.PondAnimalVisuals?.buildings?.[id] || { icon: id, label: id, synergy: "Useful building", role: "Upgrade", color: "#83dced" };
    }

    buildingIcon(id) {
      const visual = this.buildingVisual(id);
      return `<i class="building-icon building-${this.escape(id)}" style="--building-color:${this.escape(visual.color || "#83dced")}" title="${this.escape(visual.label || id)}"></i>`;
    }

    objectiveVisual(id, def = {}) {
      return root.PondAnimalVisuals?.objectives?.[id] || { icon: id, label: def.label || id, best: "All animals", color: def.color || "#83dced" };
    }

    objectiveIcon(id, def = {}) {
      const visual = this.objectiveVisual(id, def);
      return `<i class="objective-icon objective-${this.escape(id)}" style="--objective-color:${this.escape(visual.color || def.color || "#83dced")}" title="${this.escape(visual.label || def.label || id)}"></i>`;
    }

    teamCommandIcon(id) {
      const kind = {
        attack: "splash",
        push: "splash",
        defend: "shell",
        protect: "shell",
        help: "lily",
        objective: "lily",
        retreat: "current",
      }[id] || "splash";
      return `<i class="team-command-icon ${this.escape(kind)}" aria-hidden="true"></i>`;
    }

    syncBotOptions(initial = false) {
      const mapSize = this.nodes.mapSize?.value || "medium";
      const map = root.PondMapConfig?.[mapSize] || root.PondMapConfig?.medium;
      if (!map || !this.nodes.botCount) return;
      const mode = this.nodes.gameMode?.value || "solo";
      if (mode === "teamBattle") {
        const teams = Number(this.nodes.teamCount?.value || 2);
        const botsPerTeam = Number(this.nodes.botsPerTeam?.value || 4);
        const totalBots = Math.max(map.minBots, Math.min(map.maxBots, teams * botsPerTeam - 1));
        this.nodes.botCount.innerHTML = `<option value="${totalBots}">${totalBots}</option>`;
        this.nodes.botCount.value = String(totalBots);
        return;
      }
      const current = Number(this.nodes.botCount.value || map.defaultBots);
      const values = [];
      for (let count = map.minBots; count <= map.maxBots; count += 1) values.push(count);
      this.nodes.botCount.innerHTML = values
        .map((count) => `<option value="${count}">${count}</option>`)
        .join("");
      const next = initial || current < map.minBots || current > map.maxBots ? map.defaultBots : current;
      this.nodes.botCount.value = String(next);
    }

    updateLobbyMode() {
      const mode = this.nodes.gameMode?.value || "solo";
      const coop = mode === "coop";
      const battle = mode === "teamBattle";
      this.nodes.coopOptions?.forEach((node) => node.classList.toggle("hidden", !coop));
      this.nodes.battleOptions?.forEach((node) => node.classList.toggle("hidden", !battle));
      if (this.nodes.botCount) this.nodes.botCount.disabled = battle;
    }

    updateLobbyAnimal() {
      const info = LOBBY_ANIMALS[this.selectedAnimal] || LOBBY_ANIMALS.duck;
      const visual = this.visualFor(this.selectedAnimal);
      if (this.nodes.startButton) this.nodes.startButton.textContent = `Solo Match: ${info.name}`;
      this.setSelectValue(this.nodes.createAnimalSelect, this.selectedAnimal);
      this.setSelectValue(this.nodes.joinAnimalSelect, this.selectedAnimal);
      if (this.nodes.selectedAnimalIcon) {
        this.nodes.selectedAnimalIcon.className = `animal-disc animal-visual-disc ${info.className}`;
        this.nodes.selectedAnimalIcon.textContent = visual.short || info.icon;
        this.nodes.selectedAnimalIcon.style.setProperty("--animal-color", visual.badge || root.PondAnimals?.[this.selectedAnimal]?.color || "#83dced");
        this.nodes.selectedAnimalIcon.style.setProperty("--animal-accent", visual.accent || "#edf8fb");
      }
      this.nodes.animalChoices?.forEach((button) => {
        const choiceVisual = this.visualFor(button.dataset.animal);
        button.style.setProperty("--animal", choiceVisual.badge || "#83dced");
        button.style.setProperty("--animal-accent", choiceVisual.accent || "#edf8fb");
        button.dataset.role = choiceVisual.role || "";
        const disc = button.querySelector(".animal-disc");
        if (disc) {
          disc.classList.add("animal-visual-disc");
          disc.textContent = choiceVisual.short || disc.textContent;
          disc.style.setProperty("--animal-color", choiceVisual.badge || "#83dced");
          disc.style.setProperty("--animal-accent", choiceVisual.accent || "#edf8fb");
          disc.title = `${choiceVisual.label}: ${choiceVisual.mapPose || choiceVisual.role}`;
        }
      });
      if (this.nodes.selectedAnimalName) this.nodes.selectedAnimalName.textContent = `${info.name} - ${visual.role || info.strategy}`;
      if (this.nodes.selectedAnimalSummary) this.nodes.selectedAnimalSummary.textContent = `${info.summary} Visual identity: ${visual.mapPose || "pond animal marker"} with ${visual.attackMotif || "themed attacks"}.`;
      if (this.nodes.selectedAnimalStats) {
        this.nodes.selectedAnimalStats.innerHTML = `
          <dt>Ability</dt><dd>${this.escape(visual.ability || info.ability)}</dd>
          <dt>Best Terrain</dt><dd>${this.escape(visual.terrain || info.terrain)}</dd>
          <dt>Weakness</dt><dd>${this.escape(visual.weakness || info.weakness)}</dd>
          <dt>Role</dt><dd>${this.escape(visual.role || info.strategy)}</dd>
          <dt>Counterplay</dt><dd>${this.escape(visual.counterplay || "Play around its favorite terrain.")}</dd>
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
      this.nodes.attackStyleButtons?.forEach((candidate) => {
        const candidatePercent = Number(candidate.dataset.percent);
        const active = Math.abs(candidatePercent - next) < 0.001;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      this.nodes.mobileAttackButtons?.forEach((candidate) => {
        const candidatePercent = Number(candidate.dataset.mobileAttack);
        const active = Math.abs(candidatePercent - next) < 0.001;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      this.updateActionLabels(this.lastHuman);
    }

    attackStyleName(percent = this.percent) {
      const value = Number(percent);
      if (value >= 0.99) return "max";
      if (value >= 0.74) return "wave";
      if (value >= 0.49) return "push";
      return "bite";
    }

    attackStyleLabel(percent = this.percent) {
      const style = this.attackStyleName(percent);
      if (style === "max") return "Max Wave";
      if (style === "wave") return "Full Wave";
      if (style === "push") return "Strong Push";
      return "Quick Bite";
    }

    attackStyleShort(percent = this.percent) {
      const style = this.attackStyleName(percent);
      if (style === "max") return "Max";
      if (style === "wave") return "Wave";
      if (style === "push") return "Push";
      return "Bite";
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
      const animalVisual = this.visualFor(human.animal);
      this.lastState = state;
      this.lastTile = selectedTile;
      this.lastContext = context;
      this.lastHuman = human;
      document.body.dataset.animal = human.animal;
      this.nodes.energyStat.textContent = `${human.energy} / ${human.maxEnergy}`;
      this.nodes.incomeStat.textContent = `+${human.income}/s`;
      this.nodes.territoryStat.textContent = `${Math.round(human.territoryPct * 100)}%`;
      this.nodes.animalStat.innerHTML = this.animalInline(human.animal, `${animal.label} L${human.level || 1}`);
      const humanTeam = human.teamId ? state.teamState?.teams?.find((team) => team.id === human.teamId) : null;
      if (this.nodes.teamStat) {
        this.nodes.teamStat.textContent = humanTeam ? `${humanTeam.name.replace(" Team", "")} ${Math.round(humanTeam.territoryPct * 100)}%` : "Solo";
        this.nodes.teamStat.style.color = humanTeam?.color || "";
      }
      this.nodes.timerStat.textContent = `${this.formatTime(state.elapsed || 0)} | ${state.teamState?.active ? `${state.teamsLeft || 0} teams` : `${state.animalsLeft || 0} left`}`;
      this.nodes.controlMeter.style.transform = `scaleX(${Math.max(0, Math.min(1, human.territoryPct))})`;
      this.updateWinDebug(state);
      this.nodes.teamButton?.classList.toggle("active", Boolean(state.teamState?.active));
      if (this.nodes.teamButton) this.nodes.teamButton.disabled = !state.teamState?.active;
      if (this.nodes.mobileTeamButton) {
        this.nodes.mobileTeamButton.disabled = !state.teamState?.active;
        this.nodes.mobileTeamButton.classList.toggle("active", Boolean(state.teamState?.active));
      }

      const abilityStatus = human.abilityStatus || {};
      this.nodes.abilityName.innerHTML = this.abilityInline(human.animal, animal.ability);
      const cooldownLeft = Math.max(0, abilityStatus.cooldownLeft ?? human.abilityReadyAt - state.serverTime);
      const activeLeft = Math.max(0, abilityStatus.activeLeft ?? human.abilityActiveUntil - state.serverTime);
      const realModifier = abilityStatus.realModifier || root.PondInfo?.abilityTip(human.animal) || animalVisual.tooltip || animal.perk;
      this.nodes.abilityPerk.textContent = abilityStatus.activeEffect
        ? `${abilityStatus.activeEffect}: ${realModifier}`
        : `${realModifier} Visual: ${animalVisual.attackMotif || "pond effect"}.`;
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
          : `${animal.ability}: ${realModifier} ${animalVisual.defenseMotif ? `Defense look: ${animalVisual.defenseMotif}.` : ""}`;
      this.nodes.mobileStrategicButton?.classList.toggle("active", this.nodes.strategicView.checked);

      this.updateSelectedTile(state, selectedTile, context);
      this.updatePlayerPanel(state, selectedPlayerId);
      this.updateProgression(human);
      this.updateObjectives(state);
      this.updateMissions(state);
      this.updateLakeEvent(state);
      this.updateCurrentPushWarning(state, human);
      this.updateLeaderboard(state);
      this.updateActionLabels(human);
      this.updateActionVisibility(state, selectedTile, context);
      this.updateMobileActionCard(state, selectedTile, context);
      if (!this.nodes.specialSheet?.classList.contains("hidden")) this.openSpecialSheet();
      if (!this.nodes.teamSheet?.classList.contains("hidden")) this.renderTeamSheet();
      if (state.ended) this.showResult(state, human);
    }

    updateWinDebug(state) {
      if (!this.nodes.winDebugPanel) return;
      const debug = state.winDebug;
      if (!debug || !this.debugMode) {
        this.nodes.winDebugPanel.classList.add("hidden");
        return;
      }
      this.nodes.winDebugPanel.classList.remove("hidden");
      const teamText = debug.aliveTeams == null ? "N/A" : debug.aliveTeams;
      const blocked = debug.blockedReason ? ` | Blocked: ${debug.blockedReason}` : "";
      this.nodes.winDebugPanel.textContent = `Win Check: ${debug.mode} | Alive animals: ${debug.alivePlayers} | Alive teams: ${teamText} | Bots: ${debug.aliveBots} | Out: ${debug.eliminated} | End: ${debug.canEnd ? "checking" : "disabled"} | ${debug.reason}${blocked}`;
    }

    updateMobileActionCard(state, tile, context = {}) {
      if (!this.nodes.mobileActionCard) return;
      if (!tile || !this.isMobile()) {
        this.nodes.mobileActionCard.classList.add("hidden");
        this.nodes.mobileAttackActions?.classList.add("hidden");
        return;
      }
      const summary = root.PondInfo?.tileSummary(state, tile, context);
      if (!summary) return;
      const action = this.bestMobileAction(state, tile, context);
      this.nodes.mobileActionTitle.textContent = summary.title;
      this.nodes.mobileActionMeta.textContent = summary.ownerText;
      this.nodes.mobileActionDetail.textContent = action.detail || summary.detail;
      this.nodes.mobileMainAction.textContent = action.label;
      this.nodes.mobileMainAction.dataset.actionType = action.type || "";
      this.nodes.mobileMainAction.dataset.percent = action.percent || "";
      this.nodes.mobileMainAction.dataset.specialType = action.specialType || "";
      this.nodes.mobileMainAction.disabled = !action.type;
      this.nodes.mobileAttackActions?.classList.toggle("hidden", !context.canAttack);
      this.nodes.mobileActionCard.classList.remove("hidden");
    }

    bestMobileAction(state, tile, context = {}) {
      const human = state.players.find((player) => player.id === state.humanId);
      const percent = Math.round(this.percent * 100);
      if (!tile || !human) return { label: "Info", type: "", detail: "Select a tile." };
      if (context.pendingAbility) {
        return context.validAbilityTarget
          ? { label: "Leap Here", type: "ability", detail: "Confirm Big Leap on this neutral cluster." }
          : { label: "Select Leap", type: "", detail: "Tap a glowing neutral tile for Big Leap." };
      }
      if (context.pendingBuildType) {
        const building = state.config.buildings?.[context.pendingBuildType];
        return context.validBuildTarget
          ? { label: `Build ${building?.label || "Here"}`, type: "build", detail: `Place ${building?.label || "building"} on this tile.` }
          : { label: "Choose Tile", type: "", detail: `Tap a glowing owned tile for ${building?.label || "this building"}.` };
      }
      if (context.pendingSpecialType) {
        const special = state.config.specials?.[context.pendingSpecialType] || {};
        return context.validSpecialTarget
          ? { label: special.short || special.label || "Special", type: "special", specialType: context.pendingSpecialType, detail: `Confirm ${special.label || "special"} here.` }
          : { label: "Choose Target", type: "", detail: `Tap a glowing tile for ${special.label || "this special"}.` };
      }
      if (context.canExpand) {
        return { label: `Expand ${percent}%`, type: "expand", detail: context.estimateText || "Capture neutral water." };
      }
      if (context.canAttack) {
        const attackLabel = this.attackStyleLabel(this.percent);
        const energy = Math.round(human.energy * this.percent);
        return {
          label: `${this.attackStyleShort(this.percent)} ${energy}`,
          type: "attack",
          percent: this.percent,
          detail: context.estimateText || `${attackLabel} sends ${energy} energy now. Border attacks have no cooldown.`,
        };
      }
      if (tile.owner === human.id && tile.building) {
        return {
          label: "Building",
          type: "build",
          detail: context.canUpgradeBuilding ? "Upgrade, defend, or remove this building." : "Defend or manage this max-level building.",
        };
      }
      if (context.canDefend) {
        return { label: `Defend ${percent}%`, type: "defend", detail: "Store energy in this border." };
      }
      if (context.canBuild) {
        return { label: "Build", type: "build", detail: "Open building choices." };
      }
      if (tile.owner === human.id) {
        return { label: "Ability", type: "ability", detail: "Use your animal ability here." };
      }
      return { label: "Info", type: "", detail: "No direct action available." };
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
        this.nodes.tileFacts.innerHTML = this.renderFactRows(root.PondInfo?.incomeFacts(human) || [], 4);
        this.nodes.tileWarning.classList.add("hidden");
        return;
      }
      const summary = root.PondInfo?.tileSummary(state, tile, context);
      if (!summary) return;
      const coreText = tile.isCore ? ` Core Nest: ${Math.round(tile.coreHealth || 0)}/${Math.round(tile.coreMaxHealth || 0)}.` : "";
      const facts = summary.facts.slice();
      if (tile.isCore) facts.unshift({ label: "Core Nest", value: `${Math.round(tile.coreHealth || 0)}/${Math.round(tile.coreMaxHealth || 0)}` });
      this.nodes.tileTitle.textContent = summary.title;
      this.nodes.tileDetails.textContent = `${summary.detail}${coreText}`;
      this.nodes.tileOwner.textContent = summary.ownerText;
      this.nodes.tileDefense.textContent = context.kind === "attackBorder" ? `Wave cost ~${context.nextCost}` : summary.defenseText;
      this.nodes.tileFacts.innerHTML = this.renderFactRows(facts, 4);
      this.nodes.tileWarning.textContent = summary.warning || "";
      this.nodes.tileWarning.classList.toggle("hidden", !summary.warning);
    }

    renderFactRows(facts = [], visibleCount = 4) {
      const row = (fact) => `<div><span>${this.escape(fact.label)}</span><strong>${this.escape(fact.value)}</strong></div>`;
      const visible = facts.slice(0, visibleCount).map(row).join("");
      const hidden = facts.slice(visibleCount).map(row).join("");
      if (!hidden) return visible;
      return `${visible}<details class="more-details"><summary>More Details</summary>${hidden}</details>`;
    }

    updatePlayerPanel(state, selectedPlayerId) {
      const summary = root.PondInfo?.playerSummary(state, selectedPlayerId);
      if (!summary) {
        this.nodes.playerPanel.classList.add("hidden");
        this.nodes.selectedPlayerFacts.innerHTML = "";
        this.updateDiplomacyButtons(state, null);
        return;
      }
      this.nodes.playerPanel.classList.remove("hidden");
      const selected = state.players.find((player) => player.id === selectedPlayerId);
      const visual = this.visualFor(selected?.animal);
      this.nodes.selectedPlayer.innerHTML = selected ? this.animalInline(selected.animal, selected.name || summary.title) : this.escape(summary.title);
      this.nodes.selectedPlayerMeta.textContent = selected ? `${visual.label} L${selected.level || 1} | ${visual.role || "Pond role"} | ${summary.meta}` : summary.meta;
      this.nodes.selectedPlayerFacts.innerHTML = this.renderFactRows(summary.facts, 4);
      this.updateDiplomacyButtons(state, selectedPlayerId);
    }

    updateDiplomacyButtons(state, selectedPlayerId) {
      const relation = this.relationshipFor(state, selectedPlayerId);
      this.nodes.diplomacyButtons.forEach((button) => {
        if (!relation) {
          button.disabled = true;
          button.dataset.relationState = "none";
          delete button.dataset.command;
          return;
        }
        const action = button.dataset.diplomacy;
        delete button.dataset.command;
        let enabled = true;
        if (relation.teammate) enabled = ["pingAlly", "requestHelp", "sendSupport", "sendWarning"].includes(action);
        if (action === "requestAlliance") enabled = !relation.allied && relation.state !== "requested" && relation.state !== "truce" && relation.betrayalLeft <= 0;
        if (action === "acceptAlliance") enabled = relation.pendingForViewer && relation.requestType === "alliance";
        if (action === "acceptAlliance" && relation.pendingForViewer && relation.requestType === "truce") {
          enabled = true;
          button.dataset.command = "acceptTruce";
        }
        if (action === "rejectAlliance") enabled = relation.pendingForViewer;
        if (action === "offerTruce") enabled = !relation.allied && relation.state !== "truce";
        if (action === "declareWar") enabled = !relation.betrayalByViewer || relation.betrayalLeft <= 0;
        if (action === "breakAlliance") enabled = relation.allied;
        if (action === "markEnemy") enabled = !relation.allied;
        if (action === "pingAlly" || action === "requestHelp" || action === "sendSupport") enabled = relation.allied || relation.teammate;
        if (action === "sendWarning") enabled = true;
        if (relation.teammate && !["pingAlly", "requestHelp", "sendSupport", "sendWarning"].includes(action)) enabled = false;
        button.disabled = !enabled;
        button.dataset.relationState = relation.state;
        button.title = this.diplomacyTitle(action, relation);
      });
    }

    relationshipFor(state, playerId) {
      if (!playerId) return null;
      return state.relationships?.find((entry) => entry.playerId === playerId) || null;
    }

    diplomacyTitle(action, relation) {
      const timer = relation.betrayalLeft > 0 ? ` Betrayal cooldown ${relation.betrayalLeft}s.` : relation.truceLeft > 0 ? ` Truce ${relation.truceLeft}s.` : "";
      return (
        {
          requestAlliance: "Request an alliance.",
          acceptAlliance: "Accept a pending alliance request.",
          rejectAlliance: "Reject the pending request.",
          offerTruce: "Offer a short truce that blocks attacks.",
          declareWar: "Declare war and clear peace states.",
          breakAlliance: "Break the alliance and trigger betrayal cooldown.",
          markEnemy: "Mark this player as an enemy.",
          pingAlly: "Send an ally ping.",
          requestHelp: "Ask an ally for help.",
          sendSupport: "Send Animal Energy to this ally.",
          sendWarning: "Send a public warning.",
        }[action] || "Diplomacy action."
      ) + timer;
    }

    updateLeaderboard(state) {
      if (!state) return;
      const teamModeAvailable = Boolean(state.teamState?.active && state.teamState?.teams?.length);
      const limit = this.leaderboardExpanded ? 12 : 5;
      if (!teamModeAvailable && this.leaderboardMode === "teams") this.leaderboardMode = "players";
      if (this.nodes.leaderboardToggle) {
        this.nodes.leaderboardToggle.textContent = this.leaderboardMode === "teams" ? "Teams" : "Players";
        this.nodes.leaderboardToggle.disabled = !teamModeAvailable;
      }
      if (this.nodes.leaderboardExpandButton) {
        this.nodes.leaderboardExpandButton.textContent = this.leaderboardExpanded ? "Compact" : "More";
        this.nodes.leaderboardExpandButton.title = this.leaderboardExpanded ? "Show top 5 only" : "Show more leaderboard rows";
      }
      if (this.leaderboardMode === "teams" && teamModeAvailable) {
        this.nodes.leaderboard.innerHTML = state.teamState.teams
          .slice(0, limit)
          .map((team, index) => {
            const local = state.players.find((player) => player.id === state.humanId)?.teamId === team.id;
            return `<li class="team-row ${local ? "local" : ""}" style="--team-color:${this.escape(team.color)}">
              <span class="leader-rank">#${index + 1}</span>
              <span class="team-badge">${this.escape(team.badge || "T")}</span>
              <span class="leader-name"><b>${this.escape(team.name)}</b><small>${team.members} members | +${team.income}/s</small></span>
              <span class="leader-territory">${Math.round(team.territoryPct * 100)}%</span>
              <span class="leader-energy">${team.energy}</span>
            </li>`;
          })
          .join("");
        return;
      }
      const rows = state.players
        .filter((player) => !player.defeated)
        .slice()
        .sort((a, b) => b.territoryPct - a.territoryPct)
        .slice(0, limit);
      this.nodes.leaderboard.innerHTML = rows
        .map((player, index) => {
          const animal = state.config.animals[player.animal];
          const visual = this.visualFor(player.animal);
          const relation = this.relationshipFor(state, player.id);
          const relationBadge =
            player.id !== state.humanId && relation && relation.state !== "neutral"
              ? `<i class="relation-badge state-${this.escape(relation.state)}" title="${this.escape(relation.label)}">${this.escape(relation.icon)}</i>`
              : "";
          const teamBadge = player.teamId
            ? `<i class="team-mini-badge" style="--team-color:${this.escape(player.teamColor || "#83dced")}" title="${this.escape(player.teamName || "Team")}">${this.escape(player.teamBadge || "T")}</i>`
            : "";
          const profileBadge = player.accountUserId
            ? `<i class="team-mini-badge" title="Profile badge">${this.escape((root.PondBadgeConfig || []).find((badge) => badge.id === player.profileBadge)?.icon || "R")}</i>`
            : "";
          const profileTitle = (root.PondProgressionConfig?.titles || []).find((title) => title.id === player.profileTitle)?.label;
          const name = player.id === state.humanId ? player.name || "You" : player.name;
          return `<li class="${player.id === state.humanId ? "local" : ""}">
            <span class="leader-rank">#${index + 1}</span>
            <span class="leader-animal animal-visual-disc animal-${this.escape(player.animal)} ${this.escape(player.animal)}" style="--animal-color:${this.escape(visual.badge || animal.color)};--animal-accent:${this.escape(visual.accent || "#edf8fb")}" title="${this.escape(`${animal.label}: ${visual.role || ""}`)}">${this.escape(visual.short || animal.icon)}</span>
            <span class="leader-name"><b>${teamBadge}${profileBadge}${this.escape(name)} ${relationBadge}</b><small>${this.escape(animal.label)} L${player.level || 1} | ${this.escape(visual.role || "Pond role")}${profileTitle ? ` | ${this.escape(profileTitle)}` : player.teamName ? ` | ${this.escape(player.teamName)}` : relation ? ` | ${this.escape(relation.label)}` : ""}</small></span>
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
      if (this.nodes.objectiveCount) this.nodes.objectiveCount.textContent = `${objectives.length + camps.length} active`;
      const playerName = (id) => state.players.find((player) => player.id === id)?.name || "Neutral";
      const objectiveRows = objectives
        .map((objective) => {
          const def = objective.definition || state.config.objectives?.LAKE_OBJECTIVES?.[objective.type] || {};
          const visual = this.objectiveVisual(objective.type, def);
          const owner = objective.owner ? playerName(objective.owner) : objective.active ? "Open" : `Appears ${Math.ceil(Math.max(0, objective.activeAt - state.serverTime))}s`;
          return `<div class="compact-row ${objective.owner === state.humanId ? "owned" : ""}">
            ${this.objectiveIcon(objective.type, def)}
            <span><b>${this.escape(def.label || objective.type)}</b><small>${this.escape(owner)} | Best: ${this.escape(visual.best || "All animals")}</small></span>
          </div>`;
        })
        .join("");
      const campRows = camps
        .slice(0, 4)
        .map((camp) => {
          const def = camp.definition || state.config.objectives?.CRITTER_CAMPS?.[camp.type] || {};
          const visual = this.objectiveVisual(camp.type, def);
          const owner = camp.owner ? playerName(camp.owner) : "Neutral";
          return `<div class="compact-row camp ${camp.owner === state.humanId ? "owned" : ""}">
            ${this.objectiveIcon(camp.type, def)}
            <span><b>${this.escape(def.label || camp.type)}</b><small>${this.escape(owner)} | ${this.escape(visual.best || def.effect || "Bonus")}</small></span>
          </div>`;
        })
        .join("");
      this.nodes.objectiveList.innerHTML = objectiveRows + campRows || `<p class="empty-list">Objectives appear soon.</p>`;
    }

    updateMissions(state) {
      const missions = (state.missions || []).slice(0, 4);
      if (this.nodes.missionCount) this.nodes.missionCount.textContent = `${missions.filter((mission) => !mission.done).length} open`;
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
      this.nodes.lakeEventBanner.classList.remove("danger");
      this.nodes.lakeEventBanner.dataset.focusTileId = "";
      if (!active) return;
      this.nodes.lakeEventBanner.style.setProperty("--event-color", active.color || "#83dced");
      this.nodes.lakeEventTitle.textContent = active.label;
      this.nodes.lakeEventDetails.textContent = active.description;
      this.nodes.lakeEventTimer.textContent = `${Math.ceil(active.remaining || 0)}s`;
    }

    updateCurrentPushWarning(state, human) {
      if (!this.nodes.lakeEventBanner || !human) return;
      const incoming = (state.activeAttacks || [])
        .filter((wave) => wave.currentPush && wave.defenderId === human.id && wave.impactTime > state.serverTime)
        .sort((a, b) => a.impactTime - b.impactTime)[0];
      if (!incoming) return;
      const attacker = state.players.find((player) => player.id === incoming.attackerId);
      const left = Math.max(0, Math.ceil(incoming.impactTime - state.serverTime));
      this.nodes.lakeEventBanner.classList.remove("hidden");
      this.nodes.lakeEventBanner.classList.add("danger");
      this.nodes.lakeEventBanner.style.setProperty("--event-color", "#fff1a8");
      this.nodes.lakeEventTitle.textContent = "Incoming Current Push";
      this.nodes.lakeEventDetails.textContent = `${attacker?.name || "Enemy"} route attack. Reinforce the target border.`;
      this.nodes.lakeEventTimer.textContent = `${left}s`;
      this.nodes.lakeEventBanner.dataset.focusTileId = String(incoming.targetStartTile || "");
    }

    updateActionLabels(human) {
      if (human) this.lastHuman = human;
      const energy = human ? Math.round(human.energy * this.percent) : 0;
      const combat = this.lastState?.config?.combat || {};
      const minAttackEnergy = combat.minimumAttackEnergy || 5;
      const maxWaves = combat.maxActiveAttacksPerPlayer || 3;
      const activeWaves = this.lastState?.activeAttacks?.filter((wave) => !wave.currentPush && wave.attackerId === human?.id) || [];
      const activeWaveCount = activeWaves.length;
      const selectedId = this.lastTile?.id;
      const mergingSelected =
        selectedId != null &&
        activeWaves.some((wave) => wave.targetStartTile === selectedId || (wave.frontierTiles || []).includes(selectedId));
      const construction = this.constructionLeft(this.lastTile, this.lastState);
      const currentPushLeft = Math.max(0, Math.ceil((human?.currentPushCooldownUntil || 0) - (this.lastState?.serverTime || 0)));
      const specials = this.lastState?.config?.specials || {};
      const specialStatus = human?.specialStatus || {};
      const nextSpecialReady = Object.keys(specials).some((id) => {
        const status = specialStatus[id] || {};
        const cost = status.cost ?? specials[id]?.cost ?? 0;
        return human && !human.defeated && human.energy >= cost && Math.ceil(status.cooldownLeft || 0) <= 0;
      });
      const shortestSpecialLeft = Object.keys(specials).reduce((best, id) => {
        const left = Math.ceil(specialStatus[id]?.cooldownLeft || 0);
        return left > 0 ? Math.min(best, left) : best;
      }, Infinity);
      this.nodes.expandButton.textContent = `Expand ${energy}`;
      this.nodes.attackButton.textContent = `${this.attackStyleShort(this.percent)} ${energy}`;
      this.nodes.attackButton.disabled = !human || human.defeated || energy < minAttackEnergy || (activeWaveCount >= maxWaves && !mergingSelected);
      this.nodes.attackButton.classList.toggle("active", activeWaveCount > 0);
      this.nodes.attackButton.dataset.tip =
        energy < minAttackEnergy
          ? `Need at least ${minAttackEnergy} Animal Energy to attack.`
          : activeWaveCount >= maxWaves && !mergingSelected
            ? `Too many active waves (${activeWaveCount}/${maxWaves}). Attack the same front to merge energy, or wait for one to finish.`
            : `Border Attack: no cooldown. Sends ${energy} Animal Energy immediately. Active waves ${activeWaveCount}/${maxWaves}.`;
      this.nodes.attackStyleButtons?.forEach((button) => {
        const percent = Number(button.dataset.percent || 0.25);
        const send = human ? Math.round(human.energy * percent) : 0;
        const short = this.attackStyleShort(percent);
        const label = `${short} ${Math.round(percent * 100)}% - Send ${send}`;
        button.textContent = label;
        button.disabled = !human || human.defeated || send < minAttackEnergy || (activeWaveCount >= maxWaves && !mergingSelected);
        button.title =
          send < minAttackEnergy
            ? `Need at least ${minAttackEnergy} Animal Energy.`
            : `${this.attackStyleLabel(percent)}: no cooldown. Sends ${send} energy now. Active waves ${activeWaveCount}/${maxWaves}.`;
      });
      this.nodes.mobileAttackButtons?.forEach((button) => {
        const percent = Number(button.dataset.mobileAttack || 0.25);
        const send = human ? Math.round(human.energy * percent) : 0;
        button.textContent = `${this.attackStyleShort(percent)} ${send}`;
        button.disabled = !human || human.defeated || send < minAttackEnergy || (activeWaveCount >= maxWaves && !mergingSelected);
        button.title = send < minAttackEnergy ? "Need more energy" : `Send ${send} Animal Energy`;
      });
      if (this.nodes.currentPushButton) {
        this.nodes.currentPushButton.textContent = currentPushLeft > 0 ? `Current ${currentPushLeft}s` : `Current ${energy}`;
        this.nodes.currentPushButton.disabled = currentPushLeft > 0 || !human || human.defeated || energy < 10;
        this.nodes.currentPushButton.dataset.tip =
          currentPushLeft > 0
            ? `Current Push cooldown: ${currentPushLeft}s.`
            : "Current Push: special delayed long-range water route attack with cooldown. Border attacks have no cooldown and only cost energy.";
      }
      this.nodes.defendButton.textContent = `Defend ${Math.round(energy * 0.75)}`;
      this.nodes.buildButton.textContent = construction > 0 ? `Building ${construction}s` : "Build";
      this.nodes.buildButton.classList.toggle("cooldown", construction > 0);
      this.nodes.buildButton.classList.toggle("ready", construction <= 0 && Boolean(human));
      if (this.nodes.abilityButton && human) {
        this.nodes.abilityButton.dataset.animal = human.animal;
        this.nodes.abilityButton.innerHTML = `${this.abilityInline(human.animal, "Ability")}`;
      }
      if (this.nodes.specialButton) {
        this.nodes.specialButton.textContent = nextSpecialReady ? "Special Ready" : Number.isFinite(shortestSpecialLeft) ? `Special ${shortestSpecialLeft}s` : "Special";
        this.nodes.specialButton.disabled = !human || human.defeated || this.lastState?.ended;
        this.nodes.specialButton.classList.toggle("ready", nextSpecialReady);
        this.nodes.specialButton.classList.toggle("cooldown", !nextSpecialReady && Number.isFinite(shortestSpecialLeft));
        this.nodes.specialButton.dataset.tip = nextSpecialReady
          ? "Choose Lily Barrage, Dragonfly Guard, or Reed Shield."
          : "Pond specials cost a lot of Animal Energy and have cooldowns.";
      }
    }

    updateActionVisibility(state, tile, context = {}) {
      const human = state?.players?.find((player) => player.id === state.humanId);
      const ownsTile = Boolean(tile && human && tile.owner === human.id);
      const enemyTile = Boolean(tile?.owner && tile.owner !== human?.id);
      const neutralTile = Boolean(tile && !tile.owner);
      const contextName = !tile ? "none" : enemyTile ? "enemy" : ownsTile ? "own" : neutralTile ? "neutral" : "blocked";
      document.body.dataset.actionContext = contextName;

      const teamActive = Boolean(state?.teamState?.active);
      const showAttack = enemyTile;
      const showExpand = neutralTile && (context.canExpand || !tile.type?.blocks);
      const showDefend = ownsTile;
      const showBuild = ownsTile || Boolean(neutralTile && context.canBuild);
      const showPercent = showExpand || showDefend;
      const showAttackStyle = showAttack;

      this.nodes.percentRow?.classList.toggle("hidden-action", !showPercent);
      this.nodes.attackStyleRow?.classList.toggle("hidden-action", !showAttackStyle);
      this.setActionVisible(this.nodes.expandButton, showExpand);
      this.setActionVisible(this.nodes.attackButton, showAttack);
      this.setActionVisible(this.nodes.currentPushButton, showAttack);
      this.setActionVisible(this.nodes.defendButton, showDefend);
      this.setActionVisible(this.nodes.buildButton, showBuild);
      this.setActionVisible(this.nodes.teamButton, teamActive);
      this.setActionVisible(this.nodes.abilityButton, true);
      this.setActionVisible(this.nodes.specialButton, true);
      this.nodes.buildSelect?.classList.toggle("hidden-action", !showBuild);

      if (this.nodes.expandButton) this.nodes.expandButton.disabled = !human || human.defeated || !context.canExpand;
      if (this.nodes.defendButton) this.nodes.defendButton.disabled = !human || human.defeated || !context.canDefend;
      if (this.nodes.buildButton) {
        const construction = this.constructionLeft(tile, state);
        const canManageBuilding = ownsTile && Boolean(tile?.building);
        const canBuildHere = Boolean(context.canBuild || context.canUpgradeBuilding || canManageBuilding);
        this.nodes.buildButton.disabled = !human || human.defeated || !canBuildHere;
        if (canManageBuilding && construction <= 0) this.nodes.buildButton.textContent = context.canUpgradeBuilding ? "Upgrade" : "Building";
      }
      if (this.nodes.attackButton) this.nodes.attackButton.disabled = this.nodes.attackButton.disabled || !context.canAttack;
      if (this.nodes.currentPushButton) this.nodes.currentPushButton.disabled = this.nodes.currentPushButton.disabled || !context.canAttack;
    }

    setActionVisible(button, visible) {
      if (!button) return;
      button.classList.toggle("hidden-action", !visible);
    }

    toast(message, bad = false) {
      this.stackToast(message, bad);
      clearTimeout(this.toastTimer);
      this.nodes.toast.textContent = message;
      this.nodes.toast.classList.toggle("bad", bad);
      this.nodes.toast.classList.remove("hidden");
      this.toastTimer = setTimeout(() => this.nodes.toast.classList.add("hidden"), 2200);
    }

    stackToast(message, bad = false) {
      if (!this.nodes.toastStack) return;
      const item = document.createElement("div");
      item.className = `stack-toast${bad ? " bad" : ""}`;
      item.textContent = message;
      this.nodes.toastStack.appendChild(item);
      while (this.nodes.toastStack.children.length > 4) this.nodes.toastStack.firstElementChild?.remove();
      setTimeout(() => item.classList.add("leaving"), 2600);
      setTimeout(() => item.remove(), 3200);
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
        autoStrategicView: this.nodes.autoStrategicView.checked,
        showIcons: this.nodes.showIcons.checked,
        showAnimalIcons: this.nodes.showAnimalIcons?.checked !== false,
        showAnimalSprites: this.nodes.showAnimalSprites?.checked !== false,
        showAnimalAnimations: this.nodes.showAnimalAnimations?.checked !== false,
        showBorderStatus: this.nodes.showBorderStatus?.checked !== false,
        visualQuality: this.nodes.visualQuality?.value || "high",
        mapDecorations: this.nodes.mapDecorations?.checked !== false,
        isMobile: this.isMobile(),
        effects: {
          level: this.nodes.effectsLevel.value,
          particles: this.nodes.particlesLevel?.value || this.nodes.effectsLevel.value,
          floatingText: this.nodes.floatingText.checked,
          attackArrows: this.nodes.attackArrows.checked,
          abilityEffects: this.nodes.abilityEffects?.checked !== false,
          screenShake: this.nodes.screenShake?.checked !== false,
          reducedMotion: this.nodes.reducedMotion.checked,
          autoLowPerformance: this.nodes.autoLowPerformance.checked,
        },
      };
    }

    openTeamSheet() {
      if (!this.lastState?.teamState?.active) {
        this.toast("Team mode is not active in this match.", true);
        return;
      }
      this.renderTeamSheet();
      this.nodes.teamSheet?.classList.remove("hidden");
    }

    renderTeamSheet() {
      const state = this.lastState;
      const human = this.lastHuman;
      if (!state || !human || !this.nodes.teamSheetBody) return;
      const team = state.teamState?.teams?.find((entry) => entry.id === human.teamId);
      const commands = root.PondTeams?.commands || {};
      const teammates = state.players
        .filter((player) => player.teamId && player.teamId === human.teamId && player.id !== human.id)
        .slice(0, 6);
      const recent = (state.teamState?.commands || [])
        .filter((command) => command.teamId === human.teamId)
        .slice(-4)
        .reverse();
      this.nodes.teamSheetTitle.textContent = team ? `${team.name} ${Math.round(team.territoryPct * 100)}%` : "Team Commands";
      const commandButtons = Object.entries(commands)
        .map(
          ([id, command]) => `<button data-team-command="${this.escape(id)}" style="--team-command:${this.escape(command.tone || team?.color || "#83dced")}">
            <strong>${this.teamCommandIcon(id)} ${this.escape(command.short || command.label)}</strong>
            <span>${this.escape(command.label)}</span>
          </button>`,
        )
        .join("");
      const teammateRows =
        teammates
          .map((player) => {
            const animal = state.config.animals[player.animal] || {};
            const visual = this.visualFor(player.animal);
            return `<div class="team-member-row">
              ${this.animalDisc(player.animal, visual.label, "team-mini")}
              <span><b>${this.escape(player.name)}</b><small>${player.defeated ? "Out | " : ""}${this.escape(animal.label || player.animal)} | ${this.escape(this.roleLabel(player.role))} | ${Math.round(player.territoryPct * 100)}%</small></span>
              <strong>${player.energy}</strong>
            </div>`;
          })
          .join("") || `<p class="empty-list">No teammates in this mode.</p>`;
      const pingRows =
        recent
          .map((command) => `<div class="team-ping-row">
            <span>${this.escape(command.label)}</span>
            <small>${command.expiresIn}s</small>
          </div>`)
          .join("") || `<p class="empty-list">No active team pings.</p>`;
      this.nodes.teamSheetBody.innerHTML = `
        <div class="team-status-card" style="--team-color:${this.escape(team?.color || "#83dced")}">
          <strong>${this.escape(team?.name || "Team")}</strong>
          <span>${team ? `${Math.round(team.territoryPct * 100)}% lake control | ${team.members} members | ${team.energy} energy` : "Team status unavailable"}</span>
        </div>
        <div class="team-command-grid">${commandButtons}</div>
        <span class="sheet-subtitle">Teammates</span>
        <div class="team-member-list">${teammateRows}</div>
        <span class="sheet-subtitle">Recent Pings</span>
        <div class="team-ping-list">${pingRows}</div>
      `;
    }

    roleLabel(role) {
      return root.PondTeams?.roles?.[role]?.label || role || "Teammate";
    }

    openMobileInfoSheet() {
      const state = this.lastState;
      const tile = this.lastTile;
      if (!state || !tile) return;
      const summary = root.PondInfo?.tileSummary(state, tile, this.lastContext || {});
      if (!summary) return;
      this.nodes.mobileSheetLabel.textContent = "Tile Info";
      this.nodes.mobileSheetTitle.textContent = summary.title;
      this.nodes.mobileSheetBody.innerHTML = `
        <p>${this.escape(summary.detail)}</p>
        <div class="sheet-facts">
          ${summary.facts.map((fact) => `<div><span>${this.escape(fact.label)}</span><strong>${this.escape(fact.value)}</strong></div>`).join("")}
        </div>
      `;
      this.nodes.mobileSheet.classList.remove("hidden");
    }

    openSpecialSheet() {
      const state = this.lastState;
      const human = this.lastHuman;
      if (!state || !human || !this.nodes.specialSheetList) return;
      const specials = state.config.specials || root.PondSpecials || {};
      const status = human.specialStatus || {};
      this.nodes.specialSheetList.innerHTML = Object.entries(specials)
        .map(([id, special]) => {
          const cooldownLeft = Math.ceil(status[id]?.cooldownLeft || 0);
          const cost = status[id]?.cost ?? special.cost ?? 0;
          const energyLocked = human.energy < cost;
          const disabled = cooldownLeft > 0 || energyLocked || human.defeated || state.ended;
          const reason = cooldownLeft > 0 ? `Cooldown ${cooldownLeft}s` : energyLocked ? `Need ${cost} energy` : "Select a target on the map";
          return `<button class="special-card special-${this.escape(id)}" data-special-choice="${this.escape(id)}" ${disabled ? "disabled" : ""}>
            <strong>${this.escape(special.label || id)} <em>${this.escape(special.role || "")}</em></strong>
            <span>Cost ${cost} | ${this.escape(special.target || "Map target")}</span>
            <small>${this.escape(special.description || "")}</small>
            <small><b>Counterplay:</b> ${this.escape(special.counterplay || "Defend, spread out, or wait it out.")}</small>
            <i>${this.escape(reason)}</i>
          </button>`;
        })
        .join("");
      this.nodes.specialSheet?.classList.remove("hidden");
    }

    openBuildSheet() {
      const state = this.lastState;
      const human = this.lastHuman;
      const tile = this.lastTile;
      if (!state || !human) return;
      if (tile?.owner === human.id && tile.building) {
        const building = state.config.buildings[tile.building] || {};
        const buildingVisual = this.buildingVisual(tile.building);
        const level = tile.buildingLevel || 1;
        const upgradeCost = this.upgradeCost(tile.building, level, human, state);
        const construction = this.constructionLeft(tile, state);
        const canUpgrade = level < 3 && human.energy >= upgradeCost && construction <= 0;
        const defendEnergy = Math.round(human.energy * this.percent * 0.75);
        this.nodes.buildSheetList.innerHTML = `
          <div class="building-sheet-card">
            <strong>${this.buildingIcon(tile.building)} ${this.escape(building.label || tile.building)} L${level}</strong>
            <span>${this.escape(this.buildingEffect(tile.building))}</span>
            <small>${this.escape(buildingVisual.synergy || "Useful for all animals")} | ${this.escape(buildingVisual.role || "Pond upgrade")}</small>
            <small>Defense ${Math.round(tile.defenseEnergy || 0)} | ${construction > 0 ? `Under construction ${construction}s` : level >= 3 ? "Max level" : `Upgrade cost ${upgradeCost}`}</small>
          </div>
          <button data-building-action="upgradeBuilding" ${canUpgrade ? "" : "disabled"}>
            <strong>Upgrade Building</strong>
            <span>Level ${Math.min(3, level + 1)} improves this building and adds border defense.</span>
            <small>${level >= 3 ? "Already max level" : construction > 0 ? `Finish construction first: ${construction}s` : human.energy < upgradeCost ? `Need ${upgradeCost} energy` : `Cost ${upgradeCost}`}</small>
          </button>
          <button data-building-action="defend" ${defendEnergy >= 3 ? "" : "disabled"}>
            <strong>Defend Building</strong>
            <span>Store ${defendEnergy} defense energy on this tile.</span>
            <small>Uses your selected ${Math.round(this.percent * 100)}% send amount</small>
          </button>
          <button data-building-action="removeBuilding">
            <strong>Remove Building</strong>
            <span>Clear this tile so you can place another structure later.</span>
            <small>No refund</small>
          </button>
        `;
        this.nodes.buildSheet.classList.remove("hidden");
        return;
      }
      this.nodes.buildSheetList.innerHTML = Object.entries(state.config.buildings)
        .map(([id, building]) => {
          const buildingVisual = this.buildingVisual(id);
          const cost = this.buildingCost(id, human, state);
          const animalLocked = building.animal && building.animal !== human.animal;
          const occupiedLocked = Boolean(tile?.building);
          const terrainLocked = tile && !building.validTiles.includes(tile.type);
          const energyLocked = human.energy < cost;
          const disabled = animalLocked || occupiedLocked || terrainLocked || energyLocked;
          const reason = animalLocked
            ? `${building.animal} only`
            : occupiedLocked
              ? "Tile already has a building"
            : terrainLocked
              ? `Needs ${building.validTiles.join(", ")}`
                  : energyLocked
                    ? `Need ${cost} energy`
                    : `Ready. Takes ${state.config.balance?.buildTimeSeconds || 10}s to finish.`;
          return `<button data-build-choice="${this.escape(id)}" ${disabled ? "disabled" : ""}>
            <strong>${this.buildingIcon(id)} ${this.escape(building.label)}</strong>
            <span>Cost ${cost} | ${this.escape(this.buildingEffect(id))}</span>
            <small>${this.escape(buildingVisual.synergy || "Useful building")} | ${this.escape(reason)}</small>
          </button>`;
        })
        .join("");
      this.nodes.buildSheet.classList.remove("hidden");
    }

    buildingCost(id, human, state) {
      const configured = state.config.buildingCosts?.[id];
      if (configured != null) return configured;
      return state.config.buildings?.[id]?.cost || 0;
    }

    buildingEffect(id) {
      return {
        nest: "Warm pond nest that raises max Animal Energy.",
        lilyFarm: "Lily pads and flowers that increase income per second.",
        reedGuard: "Reed wall that strengthens nearby animal borders.",
        mudTunnel: "Hidden mud swirl that helps Snake control reeds and mud.",
        jumpPad: "Lily bounce pad that improves Frog leap mobility.",
      }[id] || "Upgrade";
    }

    upgradeCost(id, level, human, state) {
      const building = state.config.buildings?.[id] || {};
      const balance = state.config.balance || root.PondBalance || {};
      const ownedCount = human?.buildings?.[id] || 0;
      return Math.round((building.cost || 40) * (0.78 + level * (balance.upgradeCostGrowth || 0.82)) * (1 + Math.max(0, ownedCount - 1) * 0.08));
    }

    constructionLeft(tile, state = this.lastState) {
      if (!tile?.building) return 0;
      return Math.max(0, Math.ceil((tile.buildingActiveAt || 0) - (state?.serverTime || 0)));
    }

    isMobile() {
      return window.matchMedia?.("(max-width: 900px), (pointer: coarse)")?.matches || false;
    }

    showResult(state, human) {
      const winner = state.players.find((player) => player.id === state.winnerId);
      const winningTeam = state.winnerTeamId ? state.teamState?.teams?.find((team) => team.id === state.winnerTeamId) : null;
      const humanTeam = human.teamId ? state.teamState?.teams?.find((team) => team.id === human.teamId) : null;
      const humanVisual = this.visualFor(human.animal);
      const winnerVisual = this.visualFor(winner?.animal || human.animal);
      const sandbox = Boolean(state.sandbox?.enabled || state.matchSettings?.sandbox?.enabled);
      const bestTeammate = state.players
        .filter((player) => player.teamId && player.teamId === human.teamId && player.id !== human.id)
        .sort(
          (a, b) =>
            (b.stats?.tilesCaptured || 0) +
            (b.stats?.objectivesCaptured || 0) * 6 +
            (b.stats?.bestAttackWave || 0) -
            ((a.stats?.tilesCaptured || 0) + (a.stats?.objectivesCaptured || 0) * 6 + (a.stats?.bestAttackWave || 0)),
        )[0];
      this.nodes.resultScreen.classList.remove("hidden");
      const teamVictory = winningTeam && humanTeam && winningTeam.id === humanTeam.id;
      this.nodes.resultTitle.textContent = sandbox ? "Sandbox Ended" : winningTeam ? (teamVictory ? "Team Victory" : "Team Defeat") : winner?.id === state.humanId ? "Victory" : "Defeat";
      this.nodes.resultSummary.innerHTML = sandbox
        ? `${this.animalInline(human.animal, `${humanVisual.label} sandbox test`)} Sandbox ended. No stats, XP, coins, achievements, or ranked progress were saved.`
        : winningTeam
          ? `${winningTeam.name} is the last team in the pond.`
          : winner
            ? `${this.animalInline(winner.animal, `${winner.name} - ${winnerVisual.victoryTitle || "Pond Victor"}`)} is the last animal standing.`
            : "The match ended.";
      const rank =
        winningTeam && humanTeam
          ? state.teamState.teams.findIndex((team) => team.id === humanTeam.id) + 1
          : state.players
              .slice()
              .sort((a, b) => b.territoryPct - a.territoryPct)
              .findIndex((player) => player.id === state.humanId) + 1;
      const title = humanVisual.victoryTitle || this.playstyleTitle(human);
      this.nodes.resultStats.innerHTML = `
        <dt>Title</dt><dd>${this.escape(title)}</dd>
        <dt>${winningTeam ? "Team Rank" : "Final Rank"}</dt><dd>#${rank}</dd>
        ${winningTeam ? `<dt>Winning Team</dt><dd>${this.escape(winningTeam.name)}</dd>` : ""}
        ${humanTeam ? `<dt>Your Team</dt><dd>${this.escape(humanTeam.name)} | ${Math.round(humanTeam.territoryPct * 100)}%</dd>` : ""}
        ${bestTeammate ? `<dt>Best Teammate</dt><dd>${this.escape(bestTeammate.name)}</dd>` : ""}
        <dt>Time Survived</dt><dd>${this.escape(this.formatTime(state.elapsed || 0))}</dd>
        <dt>Territory</dt><dd>${Math.round(human.territoryPct * 100)}%</dd>
        <dt>Level</dt><dd>${human.level || 1} ${this.escape(human.progression?.title || "")}</dd>
        <dt>Energy Used</dt><dd>${Math.round(human.stats.energyUsed)}</dd>
        <dt>Captured</dt><dd>${human.stats.tilesCaptured}</dd>
        <dt>Objectives</dt><dd>${human.stats.objectivesCaptured || 0}</dd>
        <dt>Camps</dt><dd>${human.stats.campsCaptured || 0}</dd>
        <dt>Abilities</dt><dd>${human.stats.abilitiesUsed || 0}</dd>
        <dt>Biggest Wave</dt><dd>${human.stats.bestAttackWave || 0}</dd>
        <dt>Buildings</dt><dd>${human.stats.buildingsBuilt || 0}</dd>
        <dt>Peak Income</dt><dd>+${Number(human.stats.incomePeak || human.income || 0).toFixed(1)}/s</dd>
        <dt>Defeated</dt><dd>${human.stats.playersDefeated}</dd>
        <dt>Animal</dt><dd>${this.animalInline(human.animal, state.config.animals[human.animal].label)}</dd>
      `;
      if (sandbox) this.renderSandboxRewards();
      else this.renderRewards(human.matchRewards);
    }

    renderSandboxRewards() {
      if (!this.nodes.resultRewards) return;
      this.nodes.resultRewards.classList.remove("hidden");
      this.nodes.resultRewards.innerHTML = `
        <strong>Sandbox Test</strong>
        <p>No profile stats were saved from this run.</p>
      `;
    }

    renderRewards(rewards) {
      if (!this.nodes.resultRewards) return;
      if (!rewards) {
        this.nodes.resultRewards.classList.remove("hidden");
        this.nodes.resultRewards.innerHTML = `
          <strong>Guest Match</strong>
          <p>Create an account or login before playing to save XP, coins, achievements, and history.</p>
        `;
        return;
      }
      const leveled = Number(rewards.levelAfter || 1) > Number(rewards.levelBefore || 1);
      const achievements = rewards.achievements || [];
      this.nodes.resultRewards.classList.remove("hidden");
      this.nodes.resultRewards.innerHTML = `
        <strong>${leveled ? `Level Up! ${rewards.levelBefore} -> ${rewards.levelAfter}` : "Rewards Saved"}</strong>
        <p>+${Math.round(rewards.xpGained || 0)} XP | +${Math.round(rewards.coinsGained || 0)} coins</p>
        ${
          achievements.length
            ? `<div class="reward-achievements">${achievements
                .map((achievement) => `<span><b>${this.escape(achievement.badgeIcon || "A")}</b>${this.escape(achievement.name)}</span>`)
                .join("")}</div>`
            : `<small>No new achievements this match.</small>`
        }
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
