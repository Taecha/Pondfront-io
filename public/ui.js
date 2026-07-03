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
        difficulty: document.querySelector("#difficulty"),
        animalChoices: [...document.querySelectorAll(".animal-choice")],
        energyStat: document.querySelector("#energyStat"),
        incomeStat: document.querySelector("#incomeStat"),
        territoryStat: document.querySelector("#territoryStat"),
        animalStat: document.querySelector("#animalStat"),
        teamStat: document.querySelector("#teamStat"),
        timerStat: document.querySelector("#timerStat"),
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
        mobileMainAction: document.querySelector("#mobileMainAction"),
        mobileInfoAction: document.querySelector("#mobileInfoAction"),
        mobileCancelAction: document.querySelector("#mobileCancelAction"),
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
        leaderboardToggle: document.querySelector("#leaderboardToggle"),
        toast: document.querySelector("#toast"),
        toastStack: document.querySelector("#toastStack"),
        percentButtons: [...document.querySelectorAll("[data-percent]")],
        expandButton: document.querySelector("#expandButton"),
        attackButton: document.querySelector("#attackButton"),
        defendButton: document.querySelector("#defendButton"),
        buildButton: document.querySelector("#buildButton"),
        teamButton: document.querySelector("#teamButton"),
        abilityButton: document.querySelector("#abilityButton"),
        buildSelect: document.querySelector("#buildSelect"),
        diplomacyButtons: [...document.querySelectorAll("[data-diplomacy]")],
        strategicView: document.querySelector("#strategicView"),
        autoStrategicView: document.querySelector("#autoStrategicView"),
        showIcons: document.querySelector("#showIcons"),
        showBorderStatus: document.querySelector("#showBorderStatus"),
        uiScale: document.querySelector("#uiScale"),
        effectsLevel: document.querySelector("#effectsLevel"),
        floatingText: document.querySelector("#floatingText"),
        attackArrows: document.querySelector("#attackArrows"),
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
        tutorial: document.querySelector("#tutorial"),
        closeTutorial: document.querySelector("#closeTutorial"),
        resultScreen: document.querySelector("#resultScreen"),
        resultTitle: document.querySelector("#resultTitle"),
        resultSummary: document.querySelector("#resultSummary"),
        resultStats: document.querySelector("#resultStats"),
        playAgain: document.querySelector("#playAgain"),
        mobileSheet: document.querySelector("#mobileSheet"),
        mobileSheetLabel: document.querySelector("#mobileSheetLabel"),
        mobileSheetTitle: document.querySelector("#mobileSheetTitle"),
        mobileSheetBody: document.querySelector("#mobileSheetBody"),
        closeMobileSheet: document.querySelector("#closeMobileSheet"),
        buildSheet: document.querySelector("#buildSheet"),
        buildSheetList: document.querySelector("#buildSheetList"),
        closeBuildSheet: document.querySelector("#closeBuildSheet"),
        teamSheet: document.querySelector("#teamSheet"),
        teamSheetTitle: document.querySelector("#teamSheetTitle"),
        teamSheetBody: document.querySelector("#teamSheetBody"),
        closeTeamSheet: document.querySelector("#closeTeamSheet"),
      };
      this.leaderboardMode = "players";
      this.nodes.strategicView.checked = true;
      this.nodes.showIcons.checked = false;
      if (this.nodes.showBorderStatus) this.nodes.showBorderStatus.checked = true;
      if (this.isMobile()) {
        if (this.nodes.effectsLevel) this.nodes.effectsLevel.value = "medium";
        if (this.nodes.screenShake) this.nodes.screenShake.checked = false;
      }
      this.setUiScale(localStorage.getItem("pondfront:ui-scale") || "compact");
      this.syncAudioControls();
      this.tooltips = root.PondTooltips ? new root.PondTooltips() : null;
      this.helpMenu = root.PondHelpMenu ? new root.PondHelpMenu(this.nodes.helpButton) : null;
      this.bind();
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
      this.nodes.teamCount?.addEventListener("change", () => this.syncBotOptions());
      this.nodes.botsPerTeam?.addEventListener("change", () => this.syncBotOptions());
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
      this.nodes.buildButton.addEventListener("click", () => {
        if (this.isMobile()) this.openBuildSheet();
        else this.emit("action", { type: "build", buildingType: this.nodes.buildSelect.value });
      });
      this.nodes.teamButton?.addEventListener("click", () => this.openTeamSheet());
      this.nodes.mobileTeamButton?.addEventListener("click", () => this.openTeamSheet());
      this.nodes.abilityButton.addEventListener("click", () => this.emit("action", { type: "ability" }));
      this.nodes.diplomacyButtons.forEach((button) => {
        button.addEventListener("click", () => this.emit("diplomacy", button.dataset.command || button.dataset.diplomacy));
      });
      this.nodes.closeTutorial.addEventListener("click", () => {
        this.nodes.tutorial.classList.add("hidden");
        localStorage.setItem("pondfront:tutorial", "done");
      });
      this.nodes.playAgain.addEventListener("click", () => this.emit("start", this.startPayload()));
      this.nodes.strategicView.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.autoStrategicView.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showIcons.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.showBorderStatus?.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.uiScale?.addEventListener("change", () => this.setUiScale(this.nodes.uiScale.value));
      this.nodes.effectsLevel.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.floatingText.addEventListener("change", () => this.emit("viewChanged"));
      this.nodes.attackArrows.addEventListener("change", () => this.emit("viewChanged"));
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
        document.body.classList.toggle("leaderboard-open");
        this.nodes.openLeaderboardButton.classList.toggle("active", document.body.classList.contains("leaderboard-open"));
      });
      this.nodes.leaderboardToggle?.addEventListener("click", () => {
        this.leaderboardMode = this.leaderboardMode === "teams" ? "players" : "teams";
        this.updateLeaderboard(this.lastState);
      });
      this.nodes.mobileMainAction?.addEventListener("click", () => {
        const type = this.nodes.mobileMainAction.dataset.actionType;
        if (!type) return;
        if (type === "build") this.openBuildSheet();
        else this.emit("action", { type });
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
      this.nodes.closeTeamSheet?.addEventListener("click", () => this.nodes.teamSheet.classList.add("hidden"));
      this.nodes.teamSheet?.addEventListener("click", (event) => {
        if (event.target === this.nodes.teamSheet) this.nodes.teamSheet.classList.add("hidden");
        const button = event.target.closest("[data-team-command]");
        if (!button) return;
        this.nodes.teamSheet.classList.add("hidden");
        this.emit("teamCommand", button.dataset.teamCommand);
      });
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
          const animalColor = root.PondAnimals?.[player.animal]?.color || "#83dced";
          const team = teams.get(player.teamId);
          const ready = player.isHost ? "Host" : player.ready ? "Ready" : "Not ready";
          return `<div class="lobby-player-row ${player.isViewer ? "viewer" : ""} ${player.connected ? "" : "disconnected"}" style="--team-color:${this.escape(team?.color || animalColor)}">
            <span class="animal-disc ${this.escape(animal.className)}">${this.escape(animal.icon)}</span>
            <span class="lobby-player-main"><b>${this.escape(player.name)} ${player.isHost ? "<em>HOST</em>" : ""}</b><small>${this.escape(animal.name)}${team ? ` | ${this.escape(team.name)}` : " | Free-for-all"}</small></span>
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
      if (this.nodes.startButton) this.nodes.startButton.textContent = `Solo Match: ${info.name}`;
      this.setSelectValue(this.nodes.createAnimalSelect, this.selectedAnimal);
      this.setSelectValue(this.nodes.joinAnimalSelect, this.selectedAnimal);
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
      this.lastState = state;
      this.lastTile = selectedTile;
      this.lastContext = context;
      this.lastHuman = human;
      document.body.dataset.animal = human.animal;
      this.nodes.energyStat.textContent = `${human.energy} / ${human.maxEnergy}`;
      this.nodes.incomeStat.textContent = `+${human.income}/s`;
      this.nodes.territoryStat.textContent = `${Math.round(human.territoryPct * 100)}%`;
      this.nodes.animalStat.textContent = `${animal.label} L${human.level || 1}`;
      const humanTeam = human.teamId ? state.teamState?.teams?.find((team) => team.id === human.teamId) : null;
      if (this.nodes.teamStat) {
        this.nodes.teamStat.textContent = humanTeam ? `${humanTeam.name.replace(" Team", "")} ${Math.round(humanTeam.territoryPct * 100)}%` : "Solo";
        this.nodes.teamStat.style.color = humanTeam?.color || "";
      }
      this.nodes.timerStat.textContent = this.formatTime(state.timeLeft);
      this.nodes.controlMeter.style.transform = `scaleX(${Math.max(0, Math.min(1, human.territoryPct / state.winControl))})`;
      this.nodes.teamButton?.classList.toggle("active", Boolean(state.teamState?.active));
      if (this.nodes.teamButton) this.nodes.teamButton.disabled = !state.teamState?.active;
      if (this.nodes.mobileTeamButton) {
        this.nodes.mobileTeamButton.disabled = !state.teamState?.active;
        this.nodes.mobileTeamButton.classList.toggle("active", Boolean(state.teamState?.active));
      }

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
      this.nodes.mobileStrategicButton?.classList.toggle("active", this.nodes.strategicView.checked);

      this.updateSelectedTile(state, selectedTile, context);
      this.updatePlayerPanel(state, selectedPlayerId);
      this.updateProgression(human);
      this.updateObjectives(state);
      this.updateMissions(state);
      this.updateLakeEvent(state);
      this.updateLeaderboard(state);
      this.updateActionLabels(human);
      this.updateMobileActionCard(state, selectedTile, context);
      if (!this.nodes.teamSheet?.classList.contains("hidden")) this.renderTeamSheet();
      if (state.ended) this.showResult(state, human);
    }

    updateMobileActionCard(state, tile, context = {}) {
      if (!this.nodes.mobileActionCard) return;
      if (!tile || !this.isMobile()) {
        this.nodes.mobileActionCard.classList.add("hidden");
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
      this.nodes.mobileMainAction.disabled = !action.type;
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
      if (context.canExpand) {
        return { label: `Expand ${percent}%`, type: "expand", detail: context.estimateText || "Capture neutral water." };
      }
      if (context.canAttack) {
        return { label: `Attack ${percent}%`, type: "attack", detail: context.estimateText || "Launch a border wave." };
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
        this.updateDiplomacyButtons(state, null);
        return;
      }
      this.nodes.playerPanel.classList.remove("hidden");
      this.nodes.selectedPlayer.textContent = summary.title;
      this.nodes.selectedPlayerMeta.textContent = summary.meta;
      this.nodes.selectedPlayerFacts.innerHTML = summary.facts
        .map((fact) => `<div><span>${this.escape(fact.label)}</span><strong>${this.escape(fact.value)}</strong></div>`)
        .join("");
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
        if (relation.teammate) enabled = ["pingAlly", "requestHelp", "sendWarning"].includes(action);
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
        if (action === "pingAlly" || action === "requestHelp") enabled = relation.allied;
        if (action === "sendWarning") enabled = true;
        if (relation.teammate && !["pingAlly", "requestHelp", "sendWarning"].includes(action)) enabled = false;
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
          sendWarning: "Send a public warning.",
        }[action] || "Diplomacy action."
      ) + timer;
    }

    updateLeaderboard(state) {
      if (!state) return;
      const teamModeAvailable = Boolean(state.teamState?.active && state.teamState?.teams?.length);
      if (!teamModeAvailable && this.leaderboardMode === "teams") this.leaderboardMode = "players";
      if (this.nodes.leaderboardToggle) {
        this.nodes.leaderboardToggle.textContent = this.leaderboardMode === "teams" ? "Teams" : "Players";
        this.nodes.leaderboardToggle.disabled = !teamModeAvailable;
      }
      if (this.leaderboardMode === "teams" && teamModeAvailable) {
        this.nodes.leaderboard.innerHTML = state.teamState.teams
          .slice(0, 8)
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
        .slice(0, 8);
      this.nodes.leaderboard.innerHTML = rows
        .map((player, index) => {
          const animal = state.config.animals[player.animal];
          const relation = this.relationshipFor(state, player.id);
          const relationBadge =
            player.id !== state.humanId && relation && relation.state !== "neutral"
              ? `<i class="relation-badge state-${this.escape(relation.state)}" title="${this.escape(relation.label)}">${this.escape(relation.icon)}</i>`
              : "";
          const teamBadge = player.teamId
            ? `<i class="team-mini-badge" style="--team-color:${this.escape(player.teamColor || "#83dced")}" title="${this.escape(player.teamName || "Team")}">${this.escape(player.teamBadge || "T")}</i>`
            : "";
          const name = player.id === state.humanId ? player.name || "You" : player.name;
          return `<li class="${player.id === state.humanId ? "local" : ""}">
            <span class="leader-rank">#${index + 1}</span>
            <span class="leader-animal animal-${this.escape(player.animal)}" title="${this.escape(animal.label)}">${this.escape(animal.icon)}</span>
            <span class="leader-name"><b>${teamBadge}${this.escape(name)} ${relationBadge}</b><small>${this.escape(animal.label)} L${player.level || 1}${player.teamName ? ` | ${this.escape(player.teamName)}` : relation ? ` | ${this.escape(relation.label)}` : ""}</small></span>
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
        showBorderStatus: this.nodes.showBorderStatus?.checked !== false,
        isMobile: this.isMobile(),
        effects: {
          level: this.nodes.effectsLevel.value,
          floatingText: this.nodes.floatingText.checked,
          attackArrows: this.nodes.attackArrows.checked,
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
            <strong>${this.escape(command.short || command.label)}</strong>
            <span>${this.escape(command.label)}</span>
          </button>`,
        )
        .join("");
      const teammateRows =
        teammates
          .map((player) => {
            const animal = state.config.animals[player.animal] || {};
            return `<div class="team-member-row">
              <i style="--team-color:${this.escape(player.teamColor || team?.color || "#83dced")}">${this.escape(player.teamBadge || "T")}</i>
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

    openBuildSheet() {
      const state = this.lastState;
      const human = this.lastHuman;
      const tile = this.lastTile;
      if (!state || !human) return;
      if (tile?.owner === human.id && tile.building) {
        const building = state.config.buildings[tile.building] || {};
        const level = tile.buildingLevel || 1;
        const upgradeCost = Math.round((building.cost || 40) * (0.72 + level * 0.55));
        const canUpgrade = level < 3 && human.energy >= upgradeCost;
        const defendEnergy = Math.round(human.energy * this.percent * 0.75);
        this.nodes.buildSheetList.innerHTML = `
          <div class="building-sheet-card">
            <strong>${this.escape(building.label || tile.building)} L${level}</strong>
            <span>${this.escape(this.buildingEffect(tile.building))}</span>
            <small>Defense ${Math.round(tile.defenseEnergy || 0)} | ${canUpgrade ? `Upgrade cost ${upgradeCost}` : level >= 3 ? "Max level" : `Need ${upgradeCost} energy`}</small>
          </div>
          <button data-building-action="upgradeBuilding" ${canUpgrade ? "" : "disabled"}>
            <strong>Upgrade Building</strong>
            <span>Level ${Math.min(3, level + 1)} improves this building and adds border defense.</span>
            <small>${level >= 3 ? "Already max level" : `Cost ${upgradeCost}`}</small>
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
          const cost = this.buildingCost(id, human, state);
          const animalLocked = building.animal && building.animal !== human.animal;
          const occupiedLocked = Boolean(tile?.building);
          const terrainLocked = tile && !building.validTiles.includes(tile.type);
          const farmLimitLocked = id === "lilyFarm" && (human.buildings?.lilyFarm || 0) >= this.maxLilyFarms(human, state);
          const farmSupportLocked = id === "lilyFarm" && tile && !this.hasLilyFarmSupport(state, tile);
          const energyLocked = human.energy < cost;
          const disabled = animalLocked || occupiedLocked || terrainLocked || farmLimitLocked || farmSupportLocked || energyLocked;
          const reason = animalLocked
            ? `${building.animal} only`
            : occupiedLocked
              ? "Tile already has a building"
            : terrainLocked
              ? `Needs ${building.validTiles.join(", ")}`
              : farmLimitLocked
                ? "Farm limit reached"
                : farmSupportLocked
                  ? "Needs lily or nest nearby"
                  : energyLocked
                    ? `Need ${cost} energy`
                    : "Ready";
          return `<button data-build-choice="${this.escape(id)}" ${disabled ? "disabled" : ""}>
            <strong>${this.escape(building.label)}</strong>
            <span>Cost ${cost} | ${this.escape(this.buildingEffect(id))}</span>
            <small>${this.escape(reason)}</small>
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
        nest: "Max energy",
        lilyFarm: "Income",
        reedGuard: "Border defense",
        mudTunnel: "Snake mobility",
        jumpPad: "Frog jump range",
      }[id] || "Upgrade";
    }

    maxLilyFarms(human, state) {
      const balance = state?.config?.balance || root.PondBalance || {};
      return Math.max(1, Math.floor((human?.territory || 0) / (balance.farmTerritoryPerFarm || 18)) + 1);
    }

    hasLilyFarmSupport(state, tile) {
      if (!tile) return false;
      if (tile.type === "lily" || tile.type === "nest") return true;
      return (state?.tiles || []).some(
        (candidate) =>
          (candidate.type === "lily" || candidate.type === "nest") &&
          Math.abs(candidate.x - tile.x) + Math.abs(candidate.y - tile.y) === 1,
      );
    }

    isMobile() {
      return window.matchMedia?.("(max-width: 900px), (pointer: coarse)")?.matches || false;
    }

    showResult(state, human) {
      const winner = state.players.find((player) => player.id === state.winnerId);
      const winningTeam = state.winnerTeamId ? state.teamState?.teams?.find((team) => team.id === state.winnerTeamId) : null;
      const humanTeam = human.teamId ? state.teamState?.teams?.find((team) => team.id === human.teamId) : null;
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
      this.nodes.resultTitle.textContent = winningTeam ? (teamVictory ? "Team Victory" : "Team Defeat") : winner?.id === state.humanId ? "Victory" : "Defeat";
      this.nodes.resultSummary.textContent = winningTeam ? `${winningTeam.name} controls the lake together.` : winner ? `${winner.name} controls the lake.` : "The match ended.";
      const rank =
        winningTeam && humanTeam
          ? state.teamState.teams.findIndex((team) => team.id === humanTeam.id) + 1
          : state.players
              .slice()
              .sort((a, b) => b.territoryPct - a.territoryPct)
              .findIndex((player) => player.id === state.humanId) + 1;
      const title = this.playstyleTitle(human);
      this.nodes.resultStats.innerHTML = `
        <dt>Title</dt><dd>${this.escape(title)}</dd>
        <dt>${winningTeam ? "Team Rank" : "Final Rank"}</dt><dd>#${rank}</dd>
        ${winningTeam ? `<dt>Winning Team</dt><dd>${this.escape(winningTeam.name)}</dd>` : ""}
        ${humanTeam ? `<dt>Your Team</dt><dd>${this.escape(humanTeam.name)} | ${Math.round(humanTeam.territoryPct * 100)}%</dd>` : ""}
        ${bestTeammate ? `<dt>Best Teammate</dt><dd>${this.escape(bestTeammate.name)}</dd>` : ""}
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
