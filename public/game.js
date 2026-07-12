(function initPondGame(root) {
  class PondGameClient {
    constructor() {
      this.canvas = document.querySelector("#mapCanvas");
      this.miniMap = document.querySelector("#miniMap");
      this.ui = new root.PondUI();
      this.profileView = root.PondProfileView ? new root.PondProfileView() : null;
      this.auth = root.PondAuthController ? new root.PondAuthController({ profile: this.profileView }) : null;
      root.PondAuth = this.auth;
      root.PondProfile = this.profileView;
      this.audio = this.ui.audio || null;
      this.renderer = new root.PondRenderer(this.canvas, this.miniMap);
      this.contextMenu = root.PondContextMenu ? new root.PondContextMenu() : null;
      this.sandboxPanel = root.PondSandboxPanel
        ? new root.PondSandboxPanel({
            onStart: (payload) => this.start(payload),
            onAction: (payload) => this.postAction(payload),
            getState: () => this.state,
            getSelectedTile: () => this.selectedTile() || this.hoverTile(),
            getSelectedPlayerId: () => this.selectedPlayerId,
          })
        : null;
      this.state = null;
      this.tileMap = new Map();
      this.selectedTileId = null;
      this.selectedPlayerId = null;
      this.hoverTileId = null;
      this.spawnCandidateIds = new Set();
      this.spawnUnavailableCandidateIds = new Set();
      this.spawnCandidateZones = new Map();
      this.spawnInspection = null;
      this.sourceIds = [];
      this.preview = null;
      this.rallyTileId = null;
      this.mode = "expand";
      this.pendingAbilityTarget = false;
      this.pendingBuildType = null;
      this.pendingSpecialType = null;
      this.pendingTargetConfirmation = null;
      this.pendingCurrentPush = false;
      this.pointer = null;
      this.activePointers = new Map();
      this.pinch = null;
      this.lastTap = { tileId: null, at: 0 };
      this.panVelocity = { x: 0, y: 0 };
      this.inertiaFrame = null;
      this.longPressTimer = null;
      this.resizeFrame = null;
      this.resizeObserver = null;
      this.minimapPointerId = null;
      this.minimapShrinkTimer = null;
      this.pollTimer = null;
      this.lobbyPollTimer = null;
      this.lobbySession = null;
      this.fetching = false;
      this.fetchingLobby = false;
      this.pendingActionSeq = 1;
      this.pendingActions = new Map();
      this.pendingActionKeys = new Set();
      this.performanceStats = {
        fps: 0,
        frameMs: 0,
        lowestFps: 60,
        worstFrameMs: 0,
        serverPingMs: 0,
        expansionLatencyMs: 0,
        serverProcessMs: 0,
        expandServerProcessMs: 0,
        actionLatencyMs: 0,
        messagesPerSecond: 0,
      };
      this.frameSample = { frames: 0, totalMs: 0, worstMs: 0, since: performance.now(), lastAt: 0 };
      this.messageSample = { count: 0, since: performance.now() };
      this.lastPerfUiAt = 0;
      this.lastCooldownUiAt = 0;
      this.serverClock = { time: 0, receivedAt: performance.now() };
      this.performanceLowSince = 0;
      this.performanceAutoLow = false;
      this.runtimeVisualState = {
        temporaryPerformanceLevel: 0,
        autoReducedEffects: false,
        autoStrategicActive: false,
        fpsLowReason: "",
        lastAutoChangeTime: 0,
        stableFpsSince: 0,
        lastNoticeAt: 0,
        renderCacheVersion: 0,
      };
      this.stateVersion = 0;
      this.legalCache = { key: "", ids: [] };
      this.humanBordersCache = { key: "", borders: [] };
      this.seenEventIds = new Set();
      this.bind();
      this.loop();
      queueMicrotask(() => this.restoreLobbySession());
    }

    bind() {
      this.ui.on("start", (payload) => this.start(payload));
      this.ui.on("createLobby", (payload) => this.createLobby(payload));
      this.ui.on("joinLobby", (payload) => this.joinLobby(payload));
      this.ui.on("lobbyUpdatePlayer", (payload) => this.updateLobbyPlayer(payload));
      this.ui.on("lobbyUpdateSettings", (payload) => this.updateLobbySettings(payload));
      this.ui.on("lobbyReady", (payload) => this.setLobbyReady(payload.ready));
      this.ui.on("lobbyStart", () => this.startLobbyMatch());
      this.ui.on("lobbyLeave", () => this.leaveLobby());
      this.ui.on("spawnAction", (payload) => this.handleSpawnAction(payload));
      this.ui.on("openProfile", () => this.profileView?.open("overview"));
      this.ui.on("home", () => this.returnHome());
      this.ui.on("action", (payload) => this.handleAction(payload));
      this.ui.on("contextAction", (payload) => this.handleContextAction(payload));
      this.ui.on("openContextActions", () => this.openSelectedContextActions());
      this.ui.on("camera", (payload) => this.handleCamera(payload));
      this.ui.on("diplomacy", (command) => this.handleDiplomacy(command));
      this.ui.on("teamCommand", (command) => this.handleTeamCommand(command));
      this.ui.on("viewChanged", () => this.handleViewChanged());
      this.ui.on("restoreVisuals", (payload) => this.restoreVisuals(payload));
      this.contextMenu?.on("action", (payload) => this.handleContextAction(payload));
      this.contextMenu?.on("preview", (payload) => this.setActionPreview(payload));
      this.contextMenu?.on("close", () => {
        this.preview = null;
        this.contextMenuTileId = null;
      });

      window.addEventListener("resize", () => this.scheduleRendererResize());
      window.addEventListener("orientationchange", () => this.scheduleRendererResize());
      window.visualViewport?.addEventListener("resize", () => this.scheduleRendererResize());
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.scheduleRendererResize());
        this.resizeObserver.observe(this.canvas);
        if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
      }
      window.addEventListener("keydown", (event) => this.handleKey(event));
      this.canvas.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
      this.canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
      this.canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
      this.canvas.addEventListener("pointerup", (event) => this.handlePointerUp(event));
      this.canvas.addEventListener("pointercancel", (event) => {
        this.clearLongPress();
        this.canvas.releasePointerCapture?.(event.pointerId);
        this.pointer = null;
        document.body.classList.remove("map-panning");
        this.activePointers.clear();
        this.pinch = null;
        this.stopInertia();
      });
      this.miniMap.addEventListener("pointerdown", (event) => this.handleMiniMapPointer(event));
      this.miniMap.addEventListener("pointermove", (event) => this.handleMiniMapPointer(event));
      this.miniMap.addEventListener("pointerup", (event) => this.handleMiniMapPointer(event));
      this.miniMap.addEventListener("pointercancel", (event) => this.handleMiniMapPointer(event));
      this.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (!this.state) return;
        const tile = this.renderer.screenToTile(event.clientX, event.clientY);
        this.openContextMenu(tile, event.clientX, event.clientY);
      });
    }

    scheduleRendererResize() {
      if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = null;
        this.renderer.resize({ preserveCamera: true });
      });
    }

    async start(payload) {
      this.ui.nodes.startButton.disabled = true;
      try {
        this.clearLobbyPolling();
        this.lobbySession = null;
        this.saveLobbySession();
        this.audio?.unlock?.().catch(() => {});
        this.audio?.play("start");
        const animal = root.PondAnimals?.[payload.animal] ? payload.animal : "duck";
        const difficulty = ["passive", "easy", "normal", "smart", "chaos"].includes(payload.difficulty) ? payload.difficulty : "normal";
        const state = await this.request("/api/start", {
          method: "POST",
          body: JSON.stringify({
            animal,
            difficulty,
            playerName: payload.playerName,
            botCount: payload.botCount,
            mapSize: payload.mapSize,
            matchLength: payload.matchLength,
            surrenderMode: payload.surrenderMode,
            practice: Boolean(payload.practice),
            beginnerCombat: Boolean(payload.beginnerCombat),
            gameMode: payload.gameMode,
            ruleMode: payload.ruleMode,
            goldenLilyScoreTarget: payload.goldenLilyScoreTarget,
            floodWaveCount: payload.floodWaveCount,
            lastNestProtectionSeconds: payload.lastNestProtectionSeconds,
            spawnSelectionSeconds: payload.spawnSelectionSeconds,
            coopTeammates: payload.coopTeammates,
            teamBotDifficulty: payload.teamBotDifficulty,
            teamCount: payload.teamCount,
            botsPerTeam: payload.botsPerTeam,
            allowBots: payload.allowBots,
            sandbox: Boolean(payload.sandbox),
            sandboxRules: payload.sandboxRules,
            sandboxBotDifficulty: payload.sandboxBotDifficulty || payload.difficulty,
            sandboxBotPersonality: payload.sandboxBotPersonality,
            sandboxSpeed: payload.sandboxSpeed,
          }),
        });
        this.resetSelection();
        this.seenEventIds.clear();
        this.ui.showGame();
        this.sandboxPanel?.closeAll();
        this.setState(state, { silent: true });
        this.ui.toast(payload.sandbox ? "Sandbox map ready. Choose a starting nest." : "Map ready. Choose your starting nest.");
        this.startPolling();
        requestAnimationFrame(() => this.renderer.resize());
      } catch (error) {
        this.ui.toast(error.message || "Could not start match.", true);
      } finally {
        this.ui.nodes.startButton.disabled = false;
      }
    }

    async createLobby(payload) {
      this.ui.setLobbyLoading("create", true);
      this.ui.setLobbyError("");
      try {
        const data = await this.request("/api/lobby/create", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        this.lobbySession = { ...data.session, inGame: false };
        this.saveLobbySession();
        this.ui.showWaitingRoom(data.lobby, this.lobbySession);
        this.ui.toast(`Lobby created: ${data.lobby.roomCode}`);
        this.startLobbyPolling();
      } catch (error) {
        this.ui.setLobbyError(error.message || "Connection failed.", "create");
        this.ui.toast(error.message || "Connection failed.", true);
      } finally {
        this.ui.setLobbyLoading("create", false);
      }
    }

    async joinLobby(payload) {
      if (!payload.roomCode) {
        this.ui.setLobbyError("Invalid room code.", "join");
        return;
      }
      this.ui.setLobbyLoading("join", true);
      this.ui.setLobbyError("");
      try {
        const data = await this.request("/api/lobby/join", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        this.lobbySession = { ...data.session, inGame: false };
        this.saveLobbySession();
        this.ui.showWaitingRoom(data.lobby, this.lobbySession);
        this.ui.toast(`Joined ${data.lobby.roomCode}.`);
        this.startLobbyPolling();
      } catch (error) {
        this.ui.setLobbyError(error.message || "Connection failed.", "join");
        this.ui.toast(error.message || "Connection failed.", true);
      } finally {
        this.ui.setLobbyLoading("join", false);
      }
    }

    startLobbyPolling() {
      this.clearLobbyPolling();
      this.lobbyPollTimer = setInterval(() => this.fetchLobbyState(), 900);
      this.fetchLobbyState();
    }

    clearLobbyPolling() {
      clearInterval(this.lobbyPollTimer);
      this.lobbyPollTimer = null;
    }

    async fetchLobbyState() {
      if (!this.lobbySession || this.fetchingLobby || this.lobbySession.inGame) return;
      this.fetchingLobby = true;
      try {
        const data = await this.request(`/api/lobby/state?${this.lobbyQuery()}`);
        this.lobbySession = { ...this.lobbySession, ...data.session, inGame: data.lobby?.status === "inGame" };
        this.saveLobbySession();
        if (data.matchState) {
          this.enterLobbyMatch(data);
          return;
        }
        this.ui.updateLobbyState(data.lobby, this.lobbySession);
      } catch (error) {
        this.ui.setLobbyError(error.message || "Connection failed.");
      } finally {
        this.fetchingLobby = false;
      }
    }

    async updateLobbyPlayer(payload) {
      if (!this.lobbySession) return;
      try {
        const data = await this.request("/api/lobby/update", {
          method: "POST",
          body: JSON.stringify({ ...this.lobbyAuth(), ...payload }),
        });
        this.lobbySession = { ...this.lobbySession, ...data.session };
        this.ui.updateLobbyState(data.lobby, this.lobbySession);
      } catch (error) {
        this.ui.setLobbyError(error.message || "Could not update lobby.");
      }
    }

    async updateLobbySettings(settings) {
      if (!this.lobbySession) return;
      try {
        const data = await this.request("/api/lobby/update", {
          method: "POST",
          body: JSON.stringify({ ...this.lobbyAuth(), settings }),
        });
        this.lobbySession = { ...this.lobbySession, ...data.session };
        this.ui.updateLobbyState(data.lobby, this.lobbySession);
      } catch (error) {
        this.ui.setLobbyError(error.message || "Only the host can change settings.");
      }
    }

    async setLobbyReady(ready) {
      if (!this.lobbySession) return;
      this.ui.setLobbyLoading("ready", true);
      try {
        const data = await this.request("/api/lobby/update", {
          method: "POST",
          body: JSON.stringify({ ...this.lobbyAuth(), ready }),
        });
        this.lobbySession = { ...this.lobbySession, ...data.session };
        this.ui.updateLobbyState(data.lobby, this.lobbySession);
      } catch (error) {
        this.ui.setLobbyError(error.message || "Could not change ready state.");
      } finally {
        this.ui.setLobbyLoading("ready", false);
      }
    }

    async startLobbyMatch() {
      if (!this.lobbySession) return;
      this.ui.setLobbyLoading("start", true);
      try {
        const data = await this.request("/api/lobby/start", {
          method: "POST",
          body: JSON.stringify(this.lobbyAuth()),
        });
        this.enterLobbyMatch(data);
      } catch (error) {
        this.ui.setLobbyError(error.message || "Could not start match.");
        this.ui.toast(error.message || "Could not start match.", true);
      } finally {
        this.ui.setLobbyLoading("start", false);
      }
    }

    async leaveLobby() {
      if (!this.lobbySession) {
        this.ui.showHome();
        return;
      }
      try {
        await this.request("/api/lobby/leave", {
          method: "POST",
          body: JSON.stringify(this.lobbyAuth()),
        });
      } catch {
        // Leaving should always return the player to the menu, even if the lobby vanished.
      }
      this.clearLobbyPolling();
      this.lobbySession = null;
      this.saveLobbySession();
      this.ui.showHome();
      this.ui.toast("Left lobby.");
    }

    enterLobbyMatch(data) {
      this.clearLobbyPolling();
      this.lobbySession = { ...this.lobbySession, ...data.session, inGame: true };
      this.saveLobbySession();
      this.resetSelection();
      this.seenEventIds.clear();
      this.ui.showGame();
      this.sandboxPanel?.closeAll();
      this.setState(data.matchState, { silent: true });
      this.ui.toast("Map ready. Choose and confirm your starting nest.");
      this.startPolling();
      requestAnimationFrame(() => this.renderer.resize());
    }

    lobbyAuth() {
      return {
        roomCode: this.lobbySession?.roomCode,
        playerId: this.lobbySession?.playerId,
        playerToken: this.lobbySession?.playerToken,
      };
    }

    lobbyQuery() {
      const auth = this.lobbyAuth();
      return new URLSearchParams(auth).toString();
    }

    saveLobbySession() {
      try {
        if (this.lobbySession?.roomCode && this.lobbySession?.playerId && this.lobbySession?.playerToken) {
          sessionStorage.setItem("pondfront:lobby-session", JSON.stringify(this.lobbySession));
        } else {
          sessionStorage.removeItem("pondfront:lobby-session");
        }
      } catch {
        // Private browsing may disable storage; the live in-memory session still works.
      }
    }

    async restoreLobbySession() {
      if (this.lobbySession || this.state) return;
      let saved = null;
      try {
        saved = JSON.parse(sessionStorage.getItem("pondfront:lobby-session") || "null");
      } catch {
        sessionStorage.removeItem("pondfront:lobby-session");
      }
      if (!saved?.roomCode || !saved?.playerId || !saved?.playerToken) return;
      this.lobbySession = saved;
      try {
        const data = await this.request(`/api/lobby/state?${this.lobbyQuery()}`);
        this.lobbySession = { ...saved, ...data.session, inGame: data.lobby?.status === "inGame" };
        this.saveLobbySession();
        if (data.matchState || this.lobbySession.inGame) {
          if (!data.matchState) throw new Error("Match state is unavailable.");
          this.enterLobbyMatch({ ...data, matchState: data.matchState });
          this.ui.toast("Match reconnected.");
        } else {
          this.ui.showWaitingRoom(data.lobby, this.lobbySession);
          this.startLobbyPolling();
          this.ui.toast("Lobby reconnected.");
        }
      } catch {
        this.lobbySession = null;
        this.saveLobbySession();
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
      const started = performance.now();
      try {
        const statePath = this.state?.serverTime ? this.stateDeltaPath() : this.lobbySession?.inGame ? `/api/state?${this.lobbyQuery()}` : "/api/state";
        const state = await this.request(statePath);
        this.performanceStats.serverPingMs = Math.round(performance.now() - started);
        if (state.delta) this.applyActionDelta(state.delta);
        else this.setState(state);
      } catch (error) {
        this.ui.toast("Server connection paused.", true);
      } finally {
        this.fetching = false;
      }
    }

    stateDeltaPath() {
      const params = new URLSearchParams(this.lobbySession?.inGame ? this.lobbyAuth() : {});
      params.set("mode", "delta");
      params.set("since", String(this.state?.serverTime || 0));
      params.set("afterEventId", String(this.lastSeenEventId()));
      return `/api/state?${params.toString()}`;
    }

    lastSeenEventId() {
      let max = -1;
      this.seenEventIds.forEach((id) => {
        const value = Number(id);
        if (Number.isFinite(value)) max = Math.max(max, value);
      });
      return max;
    }

    async request(path, options = {}) {
      const response = await fetch(path, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const data = await response.json().catch(() => ({}));
      this.recordMessage();
      if (!response.ok) {
        const error = new Error(data.message || "Request failed.");
        error.data = data;
        throw error;
      }
      return data;
    }

    setState(state, options = {}) {
      const previousPhase = this.state?.phase;
      const currentSpawnVersion = Number(this.state?.spawn?.version ?? -1);
      const incomingSpawnVersion = Number(state?.spawn?.version ?? -1);
      if (options.delta && currentSpawnVersion > incomingSpawnVersion) state = { ...state, spawn: this.state.spawn };
      this.state = state;
      this.serverClock = { time: Number(state.serverTime || 0), receivedAt: performance.now() };
      this.spawnCandidateIds = new Set(state.spawn?.candidateIds || this.spawnCandidateIds || []);
      this.spawnUnavailableCandidateIds = new Set(state.spawn?.unavailableCandidateIds || []);
      if (state.spawn?.candidateZones) this.spawnCandidateZones = new Map(state.spawn.candidateZones.map((candidate) => [candidate.tileId, candidate]));
      this.stateVersion += 1;
      this.legalCache.key = "";
      this.humanBordersCache.key = "";
      if (!options.delta || !this.tileMap.size) {
        this.tileMap = new Map(state.tiles.map((tile) => [tile.id, tile]));
      }
      this.renderer.setState(state, {
        delta: Boolean(options.delta),
        changedTiles: options.changedTiles || [],
      });
      if (state.phase === "SPAWN_SELECTION" && previousPhase !== "SPAWN_SELECTION") this.renderer.fit(true);
      if (state.phase !== "SPAWN_SELECTION" && state.phase !== "COUNTDOWN") this.spawnInspection = null;
      const newEvents = state.events.filter((event) => !this.seenEventIds.has(event.id));
      state.events.forEach((event) => this.seenEventIds.add(event.id));
      this.audio?.addEvents(newEvents, state);
      this.renderer.addEvents(newEvents);
      this.pruneSelection();
      if (!options.silent) this.showEventToasts(newEvents);
      this.updateBuildOptions();
      this.updateUi();
      this.sandboxPanel?.setState(state);
    }

    handleViewChanged() {
      this.clearRuntimeVisualReduction("settings changed", { silent: true });
      this.renderer.invalidateVisualCaches?.("settings changed");
      this.updateUi();
    }

    restoreVisuals(payload = {}) {
      if (payload?.preset === "balanced") this.ui.applyVisualPreset?.("balanced");
      this.clearRuntimeVisualReduction(payload?.preset === "balanced" ? "balanced preset restored" : "visual reset");
      this.renderer.invalidateVisualCaches?.("visual reset");
      this.updateUi();
      this.ui.toast(payload?.preset === "balanced" ? "Balanced visuals restored." : "Visuals reset.");
    }

    clearRuntimeVisualReduction(reason = "manual reset", options = {}) {
      this.performanceLowSince = 0;
      this.performanceAutoLow = false;
      this.runtimeVisualState.temporaryPerformanceLevel = 0;
      this.runtimeVisualState.autoReducedEffects = false;
      this.runtimeVisualState.autoStrategicActive = false;
      this.runtimeVisualState.fpsLowReason = "";
      this.runtimeVisualState.stableFpsSince = 0;
      this.runtimeVisualState.renderCacheVersion += 1;
      if (!options.silent) this.runtimeVisualState.lastAutoChangeTime = performance.now();
      this.renderer.invalidateVisualCaches?.(reason);
    }

    showEventToasts(events) {
      events.forEach((event) => {
        if (event.kind === "notice" && event.message) {
          this.ui.toast(event.message, event.ok === false);
        }
        if (event.kind === "ended") {
          this.ui.toast(event.message || "Match over.");
        }
        if (event.kind === "profileRewards" && this.involvesHuman(event)) {
          this.ui.toast(event.message || `Saved rewards: +${event.xpGained || 0} XP.`);
          this.auth?.refresh();
        }
        if (event.kind === "achievementUnlocked" && this.involvesHuman(event)) {
          this.ui.toast(`Achievement unlocked: ${event.name}.`);
          this.auth?.refresh();
        }
        if (event.kind === "diplomacy" && this.involvesHuman(event)) {
          const actor = this.player(event.playerId);
          const target = this.player(event.targetId);
          const names = `${actor?.name || "Player"} and ${target?.name || "Player"}`;
          const message = {
            alliance: `Alliance formed: ${names}.`,
            allianceAccepted: `Alliance accepted: ${names}.`,
            requested: `${actor?.name || "Player"} sent an alliance request.`,
            rejected: `${target?.name || "Player"} rejected the request.`,
            broken: `Alliance broken: ${names}.`,
            truce: `Truce active: ${names}.`,
            truceRequested: `${actor?.name || "Player"} offered a truce.`,
            truceRejected: `${target?.name || "Player"} refused the truce.`,
            war: `${actor?.name || "Player"} declared war on ${target?.name || "Player"}.`,
            enemy: `${actor?.name || "Player"} marked ${target?.name || "Player"} as enemy.`,
          }[event.subtype] || "Diplomacy updated.";
          this.ui.toast(message, ["rejected", "truceRejected", "broken", "war"].includes(event.subtype));
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
        if (event.kind === "teamCommand" && this.involvesHumanTeam(event)) {
          const actor = this.player(event.playerId);
          this.ui.toast(`Team command sent: ${event.label || "Command"}${actor ? ` by ${actor.name}` : ""}.`);
        }
        if (event.kind === "teamResponse" && this.involvesHumanTeam(event)) {
          const actor = this.player(event.playerId);
          this.ui.toast(`${actor?.name || "Teammate"} is responding.`);
        }
        if (event.kind === "supportSent" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Support sent.");
        }
        if (event.kind === "attackWave" && this.involvesHuman(event)) {
          this.ui.toast(event.message || `Frontline wave committed ${Math.round(event.amount || 0)} energy.`);
        }
        if (event.kind === "waveContested" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Contested border: waves are fighting.", true);
        }
        if (event.kind === "continuousAttackStart" && this.involvesHuman(event)) {
          this.ui.toast(`Legacy attack converted into a committed wave.`);
        }
        if (event.kind === "continuousAttackStop" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Committed waves stop automatically.", true);
        }
        if (event.kind === "waterRouteAttack" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Current Push launched. Watch the water route.");
        }
        if (event.kind === "currentPushWarning" && this.involvesHuman(event)) {
          const attacker = this.player(event.playerId);
          this.ui.toast(`Incoming Current Push from ${attacker?.name || "enemy"}. Impact in ${Math.ceil(event.impactIn || 0)}s. Reinforce now.`, true);
        }
        if (event.kind === "currentPushBlocked" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Current Push blocked by defense.", event.targetOwner === this.state.humanId);
        }
        if (event.kind === "currentPushImpact" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Current Push impacted.", event.targetOwner === this.state.humanId && (event.captured || 0) > 0);
        }
        if (event.kind === "coreUnderAttack" && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Core Nest under attack.", true);
        }
        if ((event.kind === "coreCaptured" || event.kind === "surrender") && this.involvesHuman(event)) {
          this.ui.toast(event.message || "Core battle resolved.", event.targetOwner === this.state.humanId || event.playerId === this.state.humanId);
        }
        if (event.kind === "eliminated") {
          this.ui.toast(event.message || "An animal was eliminated.", event.playerId === this.state.humanId);
        }
        if ((event.kind === "buildComplete" || event.kind === "buildUpgrade") && this.involvesHuman(event)) {
          this.ui.toast(event.message || (event.kind === "buildUpgrade" ? "Upgrade finished." : "Building finished."));
        }
        if (event.kind === "buildingCaptured" && this.involvesHuman(event)) {
          const label = this.state.config?.buildings?.[event.buildingType]?.label || "Building";
          if (event.newOwnerId === this.state.humanId) this.ui.toast(`You captured ${label}!`);
          else if (event.oldOwnerId === this.state.humanId) this.ui.toast(`Your ${label} was captured!`, true);
          else this.ui.toast(event.message || `${label} captured.`);
        }
        if (event.kind === "waveEnd" && this.involvesHuman(event)) {
          const captured = event.captured || 0;
          this.ui.toast(captured > 0 ? `Frontline wave captured ${captured} tiles.` : event.message || "Attack wave stopped.", captured === 0);
        }
        if (
          [
            "objectiveAppeared",
            "objectiveCaptured",
            "campCaptured",
            "campMoved",
            "lakeEventWarning",
            "lakeEventStarted",
            "lakeEventEnded",
            "levelUp",
            "missionComplete",
          ].includes(event.kind) &&
          (event.kind === "objectiveAppeared" ||
            event.kind === "campMoved" ||
            event.kind === "lakeEventWarning" ||
            event.kind === "lakeEventStarted" ||
            event.kind === "lakeEventEnded" ||
            this.involvesHuman(event))
        ) {
          this.ui.toast(event.message || "Pond event updated.");
        }
      });
    }

    returnHome() {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.clearLobbyPolling();
      this.lobbySession = null;
      this.saveLobbySession();
      this.state = null;
      this.ui.nodes.gameScreen.classList.add("hidden");
      this.ui.nodes.startScreen.classList.remove("hidden");
      this.ui.nodes.resultScreen.classList.add("hidden");
      this.ui.showHome();
      this.sandboxPanel?.closeAll();
      requestAnimationFrame(() => this.renderer.resize());
    }

    involvesHuman(event) {
      return Boolean(
        this.state &&
          (event.playerId === this.state.humanId ||
            event.targetId === this.state.humanId ||
            event.targetOwner === this.state.humanId ||
            event.attackerId === this.state.humanId ||
            event.newOwnerId === this.state.humanId ||
            event.oldOwnerId === this.state.humanId),
      );
    }

    involvesHumanTeam(event) {
      const human = this.human();
      return Boolean(human?.teamId && event.teamId === human.teamId);
    }

    updateUi() {
      if (!this.state) return;
      const tile = this.selectedTile() || this.hoverTile();
      const context = { ...this.tileContext(tile), spawnInspection: this.spawnInspection };
      context.availableActions = this.availableTileActions(tile, context).actions;
      this.ui.update(this.state, tile, this.selectedPlayerId, context);
      if (this.contextMenu?.visible && this.contextMenuTileId != null) {
        const contextTile = this.tileMap.get(this.contextMenuTileId) || null;
        this.contextMenu.refresh(this.buildContextMenu(contextTile));
      }
      this.sandboxPanel?.setState(this.state, { selectedTile: tile, selectedPlayerId: this.selectedPlayerId });
    }

    updateBuildOptions() {
      const human = this.human();
      if (!human) return;
      const select = this.ui.nodes.buildSelect;
      [...select.options].forEach((option) => {
        const building = this.state.config.buildings[option.value];
        option.disabled = Boolean(building?.animal && building.animal !== human.animal);
        const preview = this.buildPreview(option.value, this.selectedTile(), human);
        const label = building?.label || option.value;
        option.textContent = Number.isFinite(preview.cost) ? `${label} (${preview.cost})` : label;
        option.title = preview.reason || `${label}: ${preview.cost} Animal Energy`;
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
        await this.handleAbilityAction(payload);
        return;
      }
      if (type === "special") {
        await this.handleSpecialAction(payload);
        return;
      }
      const tile = this.selectedTile();
      const human = this.human();
      if (type === "teamRevive") {
        if (!tile || tile.owner !== human?.id || !this.isBorder(tile, human.id)) {
          this.ui.toast("Select one of your safe border tiles for the revive.", true);
          return;
        }
        await this.postAction({ type: "teamRevive", targetId: payload.targetId, tileId: tile.id });
        return;
      }
      if (type === "build" && this.shouldWaitForBuildTarget(payload.buildingType, tile, human)) {
        this.pendingBuildType = payload.buildingType || this.ui.nodes.buildSelect.value;
        this.pendingAbilityTarget = false;
        this.pendingSpecialType = null;
        this.mode = "build";
        this.preview = {
          mode: "build",
          tileIds: this.state.tiles.filter((candidate) => this.canBuildHere(human, candidate, this.pendingBuildType)).map((candidate) => candidate.id),
          label: this.state.config.buildings[this.pendingBuildType]?.label || "Build",
        };
        this.ui.toast("Choose a glowing owned tile to build.");
        this.updateUi();
        return;
      }
      if (!tile || !human) {
        this.ui.toast("Choose a target tile first.", true);
        this.renderer.vfx?.spawnScreenNotice("Invalid Target", "#d96b61");
        return;
      }

      if (type === "upgradeBuilding" || type === "removeBuilding") {
        if (tile.owner !== human.id || !tile.building) {
          this.ui.toast("Choose one of your buildings.", true);
          this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
          return;
        }
        await this.postAction({ type, tileId: tile.id });
        return;
      }

      const blocked = this.isBlocked(tile);
      if (type === "expand" && (blocked || tile.owner)) {
        this.ui.toast("Expand needs a neutral border tile.", true);
        this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
        return;
      }
      if (type === "attack" || type === "waterRoute") {
        const relation = tile?.owner ? this.relationship(tile.owner) : null;
        if (!tile.owner || tile.owner === human.id || (relation && !relation.canAttack)) {
          this.ui.toast(relation?.blockReason || (type === "waterRoute" ? "Current Push needs an enemy coastal border." : "Attack needs a connected enemy border."), true);
          this.renderer.vfx?.spawnBlockedEffect(tile.id, relation?.state === "allied" ? "Ally" : relation?.state === "truce" ? "Truce" : "Invalid");
          return;
        }
      }
      if (type === "attack" && (!tile.owner || tile.owner === human.id)) {
        this.ui.toast("Attack needs a connected enemy border.", true);
        this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
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

      const sendPercent = Math.max(0.1, Math.min(1, Number(payload.percent || this.ui.percent) || this.ui.percent));
      if (payload.percent) this.ui.setPercent(sendPercent);
      const spend = human.energy * sendPercent;
      if ((type === "expand" || type === "attack" || type === "waterRoute") && spend < (type === "waterRoute" ? 10 : 4)) {
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
        percent: sendPercent,
        buildingType: payload.buildingType,
      };
      const pendingAction = this.beginPendingAction(action, tile, human);
      if (pendingAction === false) return;
      if (type === "expand" || type === "attack" || type === "waterRoute") action.sourceIds = this.fastSourceIds(tile);
      await this.postAction(action, { pendingAction });
    }

    async handleAbilityAction(payload = {}) {
      const human = this.human();
      if (!human) return;
      const selected = payload.tileId != null ? this.tileMap.get(payload.tileId) : this.selectedTile();
      const status = human.abilityStatus || {};
      const cooldownEndsAt = Number(status.cooldownEndsAt || human.abilityCooldownEndsAt || human.abilityReadyAt || 0);
      if (this.state.serverTime < cooldownEndsAt) {
        const left = Math.ceil(cooldownEndsAt - this.state.serverTime);
        this.ui.toast(`Ability cooldown ${left}s.`, true);
        this.ui.pulseAbility(true);
        return;
      }

      if (human.animal === "frog" && !this.isLeapTarget(selected)) {
        this.pendingAbilityTarget = true;
        this.pendingBuildType = null;
        this.pendingSpecialType = null;
        this.mode = "ability";
        this.preview = {
          mode: "expand",
          tileIds: this.leapTargetIds(),
          label: "Big Leap target",
        };
        this.ui.toast("Big Leap ready. Tap a glowing neutral tile.");
        this.updateUi();
        return;
      }

      this.pendingAbilityTarget = false;
      this.preview = null;
      this.mode = "expand";
      await this.postAction({ type: "ability", tileId: selected?.id });
    }

    async handleSpecialAction(payload = {}) {
      const human = this.human();
      if (!human) return;
      const specialType = payload.specialType || this.pendingSpecialType || "lilyBarrage";
      const special = this.state.config.specials?.[specialType] || root.PondSpecials?.[specialType];
      if (!special) {
        this.ui.toast("Unknown pond special.", true);
        return;
      }
      const status = human.specialStatus?.[specialType] || {};
      const cooldownLeft = Math.ceil(status.cooldownLeft || 0);
      const cost = status.cost ?? special.cost ?? 0;
      if (cooldownLeft > 0) {
        this.ui.toast(`${special.label} cooldown ${cooldownLeft}s.`, true);
        return;
      }
      if (human.energy < cost) {
        this.ui.toast(`${special.label} needs ${cost} Animal Energy.`, true);
        this.ui.flashEnergy();
        return;
      }

      const selected = payload.tileId != null ? this.tileMap.get(payload.tileId) : this.selectedTile();
      if (!this.isValidSpecialTarget(selected, specialType)) {
        this.pendingSpecialType = specialType;
        this.pendingAbilityTarget = false;
        this.pendingBuildType = null;
        this.mode = "special";
        this.preview = {
          mode: specialType === "lilyBarrage" ? "attack" : "defend",
          tileIds: this.specialTargetIds(specialType),
          label: `${special.label} target`,
        };
        this.ui.toast(`${special.label}: tap a glowing ${special.target?.toLowerCase() || "target tile"}.`);
        this.updateUi();
        return;
      }

      this.pendingSpecialType = null;
      this.pendingTargetConfirmation = null;
      this.preview = null;
      this.mode = specialType === "lilyBarrage" ? "attack" : "defend";
      if (this.isTouchLayout() && !this.confirmMobileTarget("special", specialType, selected, special.label || "Special")) {
        this.pendingSpecialType = specialType;
        this.preview = { mode: specialType === "lilyBarrage" ? "attack" : "defend", tileIds: this.specialTargetIds(specialType), label: `${special.label} target` };
        this.updateUi();
        return;
      }
      await this.postAction({ type: "special", specialType, tileId: selected.id });
    }

    shouldWaitForBuildTarget(buildingType, tile, human) {
      if (!human || !this.isTouchLayout()) return false;
      const type = buildingType || this.ui.nodes.buildSelect.value;
      return !tile || !this.canBuildHere(human, tile, type);
    }

    async handleDiplomacy(command) {
      if (!this.state || !this.selectedPlayerId) {
        this.ui.toast("Select another player first.", true);
        return;
      }
      if (command === "sendSupport") {
        await this.postAction({
          type: "support",
          targetId: this.selectedPlayerId,
          percent: this.ui.percent,
        });
        return;
      }
      await this.postAction({
        type: "diplomacy",
        targetId: this.selectedPlayerId,
        command,
      });
    }

    async handleTeamCommand(command) {
      if (!this.state || this.state.ended) return;
      const human = this.human();
      if (!human?.teamId) {
        this.ui.toast("Start Co-Op Team or Team Battle to use team commands.", true);
        return;
      }
      const tile = this.selectedTile() || this.hoverTile() || this.tileMap.get(human.coreTileId);
      if (!tile) {
        this.ui.toast("Select a tile for the team command.", true);
        return;
      }
      await this.postAction({
        type: "teamCommand",
        command,
        tileId: tile.id,
        targetId: this.selectedPlayerId || tile.owner || null,
      });
    }

    isSpawnPhase() {
      return this.state?.phase === "SPAWN_SELECTION" || this.state?.phase === "COUNTDOWN";
    }

    async handleSpawnAction(payload = {}) {
      if (!this.isSpawnPhase()) return;
      const body = { type: payload.type || "spawnConfirm" };
      if (payload.tileId != null) body.tileId = payload.tileId;
      if (payload.snapNearby != null) body.snapNearby = Boolean(payload.snapNearby);
      if (body.type === "spawnRelease" || body.type === "spawnRandom") this.spawnInspection = null;
      const result = await this.postAction(body);
      if (result?.ok && result.reservation?.tileId != null && body.type === "spawnFind") this.renderer.centerOnTile(result.reservation.tileId);
      if (result?.adjusted) {
        this.spawnInspection = { adjusted: true, tileId: result.reservation?.tileId };
        this.updateUi();
      }
      return result;
    }

    spawnReservationAt(tile) {
      if (!tile || !this.state?.spawn) return null;
      let nearest = null;
      let nearestDistance = Infinity;
      (this.state.spawn.reservations || []).forEach((reservation) => {
        const centerTile = reservation.tileId != null ? this.tileMap.get(reservation.tileId) : null;
        const x = centerTile?.x ?? reservation.x;
        const y = centerTile?.y ?? reservation.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const distance = Math.hypot(tile.x - x, tile.y - y);
        const radius = Math.max(2, Number(reservation.reservationRadius || this.state.spawn.startRadius || 2) + 1.2);
        if (distance <= radius && distance < nearestDistance) {
          nearest = reservation;
          nearestDistance = distance;
        }
      });
      return nearest;
    }

    async handleSpawnTap(tile) {
      if (!tile || this.state?.phase !== "SPAWN_SELECTION") return;
      this.selectTile(tile);
      const claimed = this.spawnReservationAt(tile);
      if (claimed) {
        this.spawnInspection = claimed;
        this.updateUi();
        return;
      }
      this.spawnInspection = null;
      const result = await this.handleSpawnAction({ type: "spawnReserve", tileId: tile.id, snapNearby: true });
      if (!result?.ok) {
        this.spawnInspection = { invalid: true, reason: result?.message || "That location is unavailable.", tileId: tile.id };
        this.updateUi();
        this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid Spawn");
      }
    }

    async postAction(body, options = {}) {
      const started = options.pendingAction?.startedAt || performance.now();
      const clientActionId = options.pendingAction?.id || `action-${Date.now()}-${this.pendingActionSeq++}`;
      const fullSyncActions = new Set(["restartTutorial"]);
      const wantsDelta = !fullSyncActions.has(body.type);
      try {
        const basePayload = {
          ...body,
          clientActionId,
          clientSendTime: started,
          responseMode: wantsDelta ? "delta" : "full",
          latencyDebug: this.latencyDebugEnabled(),
        };
        const payload = this.lobbySession?.inGame ? { ...basePayload, ...this.lobbyAuth() } : basePayload;
        const response = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        const serverAck = performance.now();
        const latency = Math.round(serverAck - started);
        const serverProcessMs = Math.round(data.delta?.serverProcessMs ?? data.serverProcessMs ?? 0);
        this.recordActionLatency(payload.type, latency, serverProcessMs);
        this.recordMessage();
        if (data.delta) this.applyActionDelta(data.delta);
        else if (data.state) this.setState(data.state, { silent: true });
        this.logActionLatency(payload, data, started, serverAck, latency, serverProcessMs);
        if (!response.ok) this.feedbackFailedAction(payload, data.message || "Command failed.");
        else if (payload.type === "ability") this.ui.pulseAbility(false);
        if (!response.ok || !wantsDelta) this.ui.toast(data.message || (response.ok ? "Command sent." : "Command failed."), !response.ok);
        this.finishPendingAction(options.pendingAction, response.ok, data.message || "");
        return data;
      } catch (error) {
        this.recordActionLatency(body.type, Math.round(performance.now() - started), 0);
        this.finishPendingAction(options.pendingAction, false, "Server did not receive the command.");
        this.ui.toast("Server did not receive the command.", true);
        return null;
      }
    }

    applyActionDelta(delta = {}) {
      if (!this.state || !delta) return;
      const changedTiles = delta.changedTiles || [];
      let nextTiles = this.state.tiles;
      if (changedTiles.length) {
        nextTiles = this.state.tiles.slice();
        changedTiles.forEach((update) => {
          const oldTile = this.tileMap.get(update.id) || nextTiles[update.id] || { id: update.id };
          const nextTile = { ...oldTile, ...update };
          nextTiles[update.id] = nextTile;
          this.tileMap.set(nextTile.id, nextTile);
        });
      }
      const playerUpdates = new Map((delta.players || []).map((player) => [player.id, player]));
      const nextPlayers = playerUpdates.size
        ? this.state.players.map((player) => (playerUpdates.has(player.id) ? { ...player, ...playerUpdates.get(player.id) } : player))
        : this.state.players;
      const currentEvents = this.state.events || [];
      const eventIds = new Set(currentEvents.map((event) => event.id));
      const mergedEvents = currentEvents.concat((delta.events || []).filter((event) => !eventIds.has(event.id))).slice(-((this.state.config?.maxEvents || 80) + 20));
      const nextConfig = delta.buildingCosts ? { ...this.state.config, buildingCosts: delta.buildingCosts } : this.state.config;
      const nextState = {
        ...this.state,
        serverTime: delta.serverTime ?? this.state.serverTime,
        phase: delta.phase ?? this.state.phase,
        spawn: delta.spawn && Number(delta.spawn.version ?? 0) >= Number(this.state.spawn?.version ?? 0)
          ? { ...(this.state.spawn || {}), ...delta.spawn, candidateIds: delta.spawn.candidateIds || this.state.spawn?.candidateIds }
          : this.state.spawn,
        gameModeState: delta.gameModeState || this.state.gameModeState,
        modifiers: delta.modifiers || this.state.modifiers,
        timeLeft: delta.timeLeft ?? this.state.timeLeft,
        elapsed: delta.elapsed ?? this.state.elapsed,
        animalsLeft: delta.animalsLeft ?? this.state.animalsLeft,
        teamsLeft: delta.teamsLeft ?? this.state.teamsLeft,
        winDebug: delta.winDebug ?? this.state.winDebug,
        tiles: nextTiles,
        players: nextPlayers,
        objectives: delta.objectives || this.state.objectives,
        camps: delta.camps || this.state.camps,
        lakeEvent: delta.lakeEvent || this.state.lakeEvent,
        finalTide: delta.finalTide || this.state.finalTide,
        missions: delta.missions || this.state.missions,
        relationships: delta.relationships || this.state.relationships,
        matchSettings: delta.matchSettings || this.state.matchSettings,
        sandbox: delta.sandbox || this.state.sandbox,
        teamState: delta.teamState || this.state.teamState,
        ended: delta.ended ?? this.state.ended,
        winnerId: delta.winnerId ?? this.state.winnerId,
        winnerTeamId: delta.winnerTeamId ?? this.state.winnerTeamId,
        endReason: delta.endReason ?? this.state.endReason,
        endMessage: delta.endMessage ?? this.state.endMessage,
        activeAttacks: delta.activeAttacks || this.state.activeAttacks,
        activeExpansions: delta.activeExpansions || this.state.activeExpansions,
        specials: delta.specials || this.state.specials,
        metrics: { ...(this.state.metrics || {}), ...(delta.metrics || {}) },
        events: mergedEvents,
        config: nextConfig,
      };
      this.setState(nextState, { silent: true, delta: true, changedTiles });
    }

    latencyDebugEnabled() {
      return new URLSearchParams(window.location.search).has("latency") || localStorage.getItem("pondfront:latency-debug") === "1";
    }

    logActionLatency(payload, data, clientSend, serverAck, roundTripMs, serverProcessMs) {
      if (payload.type !== "expand" && !this.latencyDebugEnabled()) return;
      if (!this.latencyDebugEnabled() && payload.type !== "expand") return;
      const delta = data.delta || {};
      console.debug("[EXPAND LATENCY]", {
        actionId: payload.clientActionId,
        clientSend: Math.round(clientSend),
        serverAck: Math.round(serverAck),
        roundTripMs,
        serverProcessMs,
        changedTiles: delta.changedTiles?.length || 0,
      });
    }

    beginPendingAction(action, tile, human) {
      if (!["expand", "attack", "defend", "waterRoute"].includes(action.type) || !tile || !human) return null;
      const key = `${action.type}:${tile.id}`;
      if (this.pendingActionKeys.has(key)) {
        this.ui.toast("Already sending that command.", true);
        return false;
      }
      const visual = root.PondAnimalVisuals?.animals?.[human.animal] || {};
      const color =
        action.type === "attack" || action.type === "waterRoute"
          ? visual.badge || human.color || "#f2d87a"
          : action.type === "defend"
            ? "#87d7ea"
            : "#77d99e";
      const sourceIds = action.type === "expand" || action.type === "attack" || action.type === "waterRoute" ? action.sourceIds?.length ? action.sourceIds : this.fastSourceIds(tile) : [];
      if (sourceIds.length && !action.sourceIds?.length) action.sourceIds = sourceIds;
      const pendingAction = {
        id: `pending-${this.pendingActionSeq}`,
        key,
        type: action.type,
        state: action.type === "attack" || action.type === "waterRoute" ? "pendingAttack" : action.type === "defend" ? "pendingDefend" : "pendingExpand",
        tileId: tile.id,
        sourceTileId: sourceIds[0] || null,
        startedAt: performance.now(),
        color,
      };
      this.pendingActionSeq += 1;
      this.pendingActions.set(pendingAction.id, pendingAction);
      this.pendingActionKeys.add(key);
      this.renderer.setPendingAction(pendingAction);
      const label = action.type === "attack" ? "Sending Wave" : action.type === "defend" ? "Reinforcing" : action.type === "waterRoute" ? "Current Sent" : "Expanding...";
      if (action.type === "attack") {
        const source = this.closestSource(tile);
        if (source) this.renderer.vfx?.spawnWaveTrail(source.id, tile.id, color, Math.round((human.energy || 0) * (action.percent || 0.25)), "attack");
      } else {
        this.renderer.vfx?.spawnPendingAction(tile.id, action.type, color, label);
      }
      return pendingAction;
    }

    finishPendingAction(pendingAction, ok, message = "") {
      if (!pendingAction) return;
      this.pendingActions.delete(pendingAction.id);
      this.pendingActionKeys.delete(pendingAction.key);
      this.renderer.clearPendingAction(pendingAction.id);
      if (!ok && pendingAction.tileId != null) this.renderer.vfx?.spawnBlockedEffect(pendingAction.tileId, message ? "Rejected" : "Invalid");
    }

    recordActionLatency(type, latency, serverProcessMs = 0) {
      this.performanceStats.actionLatencyMs = latency;
      this.performanceStats.serverProcessMs = serverProcessMs;
      if (type === "expand") {
        this.performanceStats.expansionLatencyMs = latency;
        this.performanceStats.expandServerProcessMs = serverProcessMs;
      }
    }

    recordMessage() {
      const now = performance.now();
      this.messageSample.count += 1;
      const elapsed = now - this.messageSample.since;
      if (elapsed >= 1000) {
        this.performanceStats.messagesPerSecond = Number((this.messageSample.count / (elapsed / 1000)).toFixed(1));
        this.messageSample = { count: 0, since: now };
      }
    }

    feedbackFailedAction(body, message) {
      this.audio?.play("warning", { cooldown: 120 });
      if (message.includes("Energy")) this.ui.flashEnergy();
      if (body.type === "ability") {
        this.ui.pulseAbility(true);
        this.renderer.vfx?.spawnScreenNotice(message.includes("cool") ? "Cooldown" : "Ability Blocked", "#d96b61");
        return;
      }
      if (body.tileId != null) {
        const lower = message.toLowerCase();
        const label = lower.includes("reinforced") || lower.includes("defense")
          ? "Reinforced"
          : lower.includes("ally")
            ? "Ally"
            : lower.includes("truce")
              ? "Truce"
              : lower.includes("far") || lower.includes("border")
                ? "Border"
                : "Invalid";
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

    handleCamera(payload) {
      if (!this.state) return;
      if (payload.type === "zoomIn") this.renderer.zoomBy(1.18);
      if (payload.type === "zoomOut") this.renderer.zoomBy(0.84);
      if (payload.type === "center") this.renderer.centerOnTile(this.human()?.coreTileId);
      if (payload.type === "focusTile") this.renderer.centerOnTile(payload.tileId);
      if (payload.type === "reset") this.renderer.fit(true);
      if (payload.type === "cancel") this.cancelSelection();
    }

    handleMiniMapPointer(event) {
      if (!this.state) return;
      event.preventDefault();
      if (event.type === "pointerdown") {
        this.minimapPointerId = event.pointerId;
        this.miniMap.setPointerCapture?.(event.pointerId);
        clearTimeout(this.minimapShrinkTimer);
        document.body.classList.add("minimap-active");
      }
      if (this.minimapPointerId !== event.pointerId) return;
      this.renderer.centerOnMiniMap(event.clientX, event.clientY);
      if (event.type === "pointerup" || event.type === "pointercancel") {
        this.minimapPointerId = null;
        clearTimeout(this.minimapShrinkTimer);
        this.minimapShrinkTimer = setTimeout(() => document.body.classList.remove("minimap-active"), 5000);
      }
    }

    handlePointerDown(event) {
      if (!this.state) return;
      if (event.pointerType === "touch") event.preventDefault();
      if (event.pointerType === "touch") this.stopInertia();
      const tile = this.renderer.screenToTile(event.clientX, event.clientY);
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });

      if (event.pointerType === "touch" && this.activePointers.size >= 2) {
        this.clearLongPress();
        this.contextMenu?.close();
        this.pointer = null;
        this.pinch = this.pinchState();
        return;
      }

      if (event.button === 2) {
        event.preventDefault();
        this.openContextMenu(tile, event.clientX, event.clientY);
        return;
      }

      this.canvas.setPointerCapture?.(event.pointerId);
      this.contextMenu?.close();
      const wantsSourceSelect = event.pointerType !== "touch" && event.button === 0 && (event.shiftKey || event.ctrlKey || event.metaKey);
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
        const preferences = this.ui.mobilePreferences?.() || {};
        this.longPressTimer = setTimeout(() => {
          const point = this.activePointers.get(event.pointerId);
          const finalTile = point ? this.renderer.screenToTile(point.x, point.y) : null;
          this.pointer = null;
          if (finalTile && point) this.openContextMenu(finalTile, point.x, point.y);
        }, preferences.longPressMs || 540);
      }

      if (event.button !== 0) return;
      const humanId = this.state.humanId;
      if (wantsSourceSelect && tile?.owner === humanId && this.isBorder(tile, humanId)) {
        this.pointer.selecting = true;
        this.addSource(tile, event.shiftKey || event.ctrlKey || event.metaKey);
        this.selectTile(tile, { preserveSources: true });
      }
    }

    handlePointerMove(event) {
      if (!this.state) return;
      if (event.pointerType === "touch") event.preventDefault();
      if (this.activePointers.has(event.pointerId)) {
        const point = this.activePointers.get(event.pointerId);
        point.x = event.clientX;
        point.y = event.clientY;
      }
      if (event.pointerType === "touch" && this.activePointers.size >= 2 && this.pinch) {
        this.handlePinchMove();
        return;
      }
      const tile = this.renderer.screenToTile(event.clientX, event.clientY, { previousTileId: this.hoverTileId, hysteresisPx: 1.1 });
      const nextHover = tile?.id ?? null;
      if (nextHover !== this.hoverTileId) {
        this.hoverTileId = nextHover;
        if (this.selectedTileId == null) this.updateUi();
      }

      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const dx = event.clientX - this.pointer.lastX;
      const dy = event.clientY - this.pointer.lastY;
      const total = Math.hypot(event.clientX - this.pointer.startX, event.clientY - this.pointer.startY);
      const tapThreshold = event.pointerType === "touch" ? this.ui.mobilePreferences?.().tapThreshold || 9 : 5;
      if (total > tapThreshold) {
        this.pointer.moved = true;
        this.clearLongPress();
      }

      if ((event.pointerType === "touch" && this.pointer.moved) || this.pointer.panning || (this.pointer.moved && !this.pointer.selecting)) {
        this.pointer.panning = true;
        document.body.classList.add("map-panning");
        this.renderer.pan(dx, dy);
        this.panVelocity = { x: dx, y: dy };
      } else if (this.pointer.selecting && tile?.owner === this.state.humanId && this.isBorder(tile, this.state.humanId)) {
        this.addSource(tile, true);
      }

      this.pointer.lastX = event.clientX;
      this.pointer.lastY = event.clientY;
    }

    async handlePointerUp(event) {
      const activeBeforeDelete = this.activePointers.size;
      if (event.pointerType === "touch") event.preventDefault();
      this.activePointers.delete(event.pointerId);
      this.canvas.releasePointerCapture?.(event.pointerId);
      if (this.pinch) {
        const wasTapCancel = !this.pinch.moved && performance.now() - this.pinch.startedAt < 320 && activeBeforeDelete >= 2;
        if (this.activePointers.size < 2) {
          this.pinch = null;
          if (wasTapCancel) this.cancelSelection();
        } else {
          this.pinch = this.pinchState();
        }
        return;
      }
      if (!this.state || !this.pointer || this.pointer.id !== event.pointerId) {
        this.pointer = null;
        return;
      }
      const tile = this.renderer.screenToTile(event.clientX, event.clientY);
      const wasClick = !this.pointer.moved && !this.pointer.panning && !this.pointer.selecting;
      const wasSourceDrag = this.pointer.selecting;
      this.pointer = null;
      document.body.classList.remove("map-panning");
      this.clearLongPress();

      if (wasClick) {
        if (this.isSpawnPhase()) {
          await this.handleSpawnTap(tile);
          return;
        }
        this.selectTile(tile);
        if (await this.handlePendingTap(tile)) return;
        await this.handleTap(tile, event);
        if (!tile) this.closeMobileOverlays();
      }
      if (wasSourceDrag) this.updateUi();
      if (event.pointerType === "touch" && !wasClick && this.panVelocity && Math.hypot(this.panVelocity.x, this.panVelocity.y) > 1.8) {
        this.startInertia(this.panVelocity.x, this.panVelocity.y);
      }
    }

    pinchState() {
      const points = [...this.activePointers.values()].slice(0, 2);
      if (points.length < 2) return null;
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
      return {
        distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        center,
        moved: false,
        startedAt: performance.now(),
      };
    }

    handlePinchMove() {
      const next = this.pinchState();
      if (!next || !this.pinch) return;
      const factor = Math.max(0.82, Math.min(1.22, next.distance / this.pinch.distance));
      if (Math.abs(next.distance - this.pinch.distance) > 2) this.pinch.moved = true;
      this.renderer.zoomAtFactor(next.center.x, next.center.y, factor);
      this.pinch = { ...next, moved: this.pinch.moved };
    }

    async handleTap(tile, event = null) {
      if (!tile) return;
      const now = performance.now();
      const doubleTap = this.lastTap.tileId === tile.id && now - this.lastTap.at < 360;
      this.lastTap = { tileId: tile.id, at: now };
      if (doubleTap) await this.quickAction(tile, event);
    }

    async quickAction(tile, event = null) {
      if (!tile || !this.state || this.state.ended) return;
      this.selectTile(tile);
      if (event?.pointerType !== "touch") {
        const context = this.tileContext(tile);
        if (!tile.owner && context.canExpand) {
          await this.handleAction({ type: "expand", percent: this.ui.percent });
          return;
        }
        if (tile.owner === this.state.humanId && context.canDefend) {
          await this.handleAction({ type: "defend", percent: this.ui.percent });
          return;
        }
      }
      const preference = this.ui.mobilePreferences?.().doubleTap || "actions";
      if (preference === "none") return;
      if (preference === "info") return this.ui.openMobileInfoSheet?.();
      this.openContextMenu(tile, event?.clientX || window.innerWidth / 2, event?.clientY || window.innerHeight - 120);
    }

    openSelectedContextActions() {
      const tile = this.selectedTile() || this.hoverTile();
      const rect = this.canvas.getBoundingClientRect();
      this.openContextMenu(tile, rect.left + rect.width / 2, rect.bottom - 90);
    }

    closeMobileOverlays() {
      this.contextMenu?.close();
      document.body.classList.remove("leaderboard-open", "minimap-active", "mobile-info-expanded");
      [this.ui.nodes.mobileSheet, this.ui.nodes.buildSheet, this.ui.nodes.specialSheet, this.ui.nodes.teamSheet].forEach((sheet) => sheet?.classList.add("hidden"));
    }

    cancelSelection() {
      this.contextMenu?.close();
      this.preview = null;
      this.pendingAbilityTarget = false;
      this.pendingBuildType = null;
      this.pendingSpecialType = null;
      this.pendingCurrentPush = false;
      this.pendingTargetConfirmation = null;
      this.resetSelection();
      this.updateUi();
      this.ui.toast("Selection cleared.");
    }

    async handlePendingTap(tile) {
      if (!tile || !this.state || this.state.ended) return false;
      if (this.pendingCurrentPush) {
        const target = this.nearbyValidTarget(tile, (candidate) => Boolean(candidate.owner && candidate.owner !== this.state.humanId && this.estimateCurrentPush(candidate, this.human()).valid));
        if (!target) {
          this.ui.toast("Tap a glowing enemy coast connected by open water.", true);
          this.renderer.vfx?.spawnBlockedEffect(tile.id, "No Route");
          return true;
        }
        if (!this.confirmMobileTarget("currentPush", "waterRoute", target, "Current Push")) return true;
        this.pendingCurrentPush = false;
        this.preview = null;
        const action = { type: "waterRoute", tileId: target.id, percent: this.ui.percent, sourceIds: this.fastSourceIds(target) };
        const pendingAction = this.beginPendingAction(action, target, this.human());
        if (pendingAction !== false) await this.postAction(action, { pendingAction });
        return true;
      }
      if (this.pendingAbilityTarget) {
        const target = this.nearbyValidTarget(tile, (candidate) => this.isLeapTarget(candidate));
        if (!target) {
          this.ui.toast("Tap a glowing neutral leap target.", true);
          this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
          return true;
        }
        if (!this.confirmMobileTarget("ability", "frog", target, "Big Leap")) return true;
        this.pendingAbilityTarget = false;
        this.preview = null;
        this.mode = "expand";
        await this.postAction({ type: "ability", tileId: target.id });
        return true;
      }
      if (this.pendingBuildType) {
        const buildingType = this.pendingBuildType;
        if (!this.canBuildHere(this.human(), tile, buildingType)) {
          this.ui.toast("That tile cannot hold this building.", true);
          this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
          return true;
        }
        this.pendingBuildType = null;
        this.preview = null;
        this.mode = "build";
        await this.postAction({ type: "build", tileId: tile.id, buildingType });
        return true;
      }
      if (this.pendingSpecialType) {
        const specialType = this.pendingSpecialType;
        const special = this.state.config.specials?.[specialType] || root.PondSpecials?.[specialType] || {};
        const target = this.nearbyValidTarget(tile, (candidate) => this.isValidSpecialTarget(candidate, specialType));
        if (!target) {
          this.ui.toast(`${special.label || "Special"} cannot target that tile.`, true);
          this.renderer.vfx?.spawnBlockedEffect(tile.id, "Invalid");
          return true;
        }
        if (!this.confirmMobileTarget("special", specialType, target, special.label || "Special")) return true;
        this.pendingSpecialType = null;
        this.preview = null;
        this.mode = specialType === "lilyBarrage" ? "attack" : "defend";
        await this.postAction({ type: "special", specialType, tileId: target.id });
        return true;
      }
      return false;
    }

    nearbyValidTarget(tile, predicate, radius = 1) {
      if (!tile) return null;
      if (predicate(tile)) return tile;
      if (!this.isTouchLayout()) return null;
      const candidates = [];
      for (let y = tile.y - radius; y <= tile.y + radius; y += 1) {
        for (let x = tile.x - radius; x <= tile.x + radius; x += 1) {
          const candidate = this.tileAt(x, y);
          const distance = Math.abs(tile.x - x) + Math.abs(tile.y - y);
          if (candidate && distance > 0 && distance <= radius && predicate(candidate)) candidates.push({ candidate, distance });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance || a.candidate.id - b.candidate.id);
      return candidates[0]?.candidate || null;
    }

    confirmMobileTarget(kind, actionType, tile, label) {
      if (!this.isTouchLayout()) return true;
      const now = performance.now();
      const pending = this.pendingTargetConfirmation;
      if (pending && pending.kind === kind && pending.actionType === actionType && pending.tileId === tile.id && now - pending.at < 4500) {
        this.pendingTargetConfirmation = null;
        return true;
      }
      this.pendingTargetConfirmation = { kind, actionType, tileId: tile.id, at: now };
      this.selectTile(tile, { preserveSources: true });
      this.renderer.vfx?.spawnPulse(tile.id, "#f2d87a", 1.1);
      this.ui.toast(`Target adjusted. Tap the highlighted tile again to confirm ${label}.`);
      return false;
    }

    startInertia(vx, vy) {
      this.stopInertia();
      const step = () => {
        vx *= 0.88;
        vy *= 0.88;
        if (Math.hypot(vx, vy) < 0.25) {
          this.inertiaFrame = null;
          return;
        }
        this.renderer.pan(vx, vy);
        this.inertiaFrame = requestAnimationFrame(step);
      };
      this.inertiaFrame = requestAnimationFrame(step);
    }

    stopInertia() {
      if (this.inertiaFrame) cancelAnimationFrame(this.inertiaFrame);
      this.inertiaFrame = null;
    }

    handleKey(event) {
      if (!this.state) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (["input", "select", "textarea"].includes(tag)) return;
      if (event.key === "Escape") {
        this.contextMenu?.close();
        this.preview = null;
        this.resetSelection();
        this.updateUi();
      }
      if (event.key.toLowerCase() === "f") this.renderer.fit(true);
      const speed = event.shiftKey ? 92 : 54;
      const key = event.key.toLowerCase();
      const moves = {
        arrowup: [0, speed],
        w: [0, speed],
        arrowdown: [0, -speed],
        s: [0, -speed],
        arrowleft: [speed, 0],
        a: [speed, 0],
        arrowright: [-speed, 0],
        d: [-speed, 0],
      };
      if (moves[key]) {
        event.preventDefault();
        this.renderer.pan(moves[key][0], moves[key][1]);
      }
    }

    clearLongPress() {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    openContextMenu(tile, x, y) {
      if (!this.contextMenu || !this.state) return;
      if (tile) {
        this.selectTile(tile, { preserveSources: true });
        this.renderer.vfx?.spawnPulse(tile.id, "#87d7ea", 0.92);
      }
      this.contextMenuTileId = tile?.id ?? null;
      const menu = this.buildContextMenu(tile);
      this.contextMenu.open({ x, y, mobile: this.isTouchLayout(), ...menu });
    }

    buildContextMenu(tile) {
      const resolved = this.availableTileActions(tile);
      return { title: resolved.title, subtitle: resolved.subtitle, items: resolved.actions };
    }

    availableTileActions(tile, existingContext = null) {
      if (!root.PondActions?.getAvailableTileActions || !this.state) return { title: "Pond Actions", subtitle: "", actions: [] };
      const context = existingContext || this.tileContext(tile);
      return root.PondActions.getAvailableTileActions({
        state: this.state,
        player: this.human(),
        tile,
        context,
        serverNow: this.state.serverTime,
        helpers: {
          isBlocked: (candidate) => this.isBlocked(candidate),
          relationship: (playerId) => this.relationship(playerId),
          buildPreview: (buildingType, candidate, player) => this.buildPreview(buildingType, candidate, player),
          validAbilityTarget: (candidate) => this.isLeapTarget(candidate),
          validSpecialTarget: (candidate, specialType) => this.isValidSpecialTarget(candidate, specialType),
          terrainText: (tileType) => root.PondInfo?.terrainText(tileType),
          buildingText: (buildingType) => root.PondInfo?.buildingText(buildingType),
          tileLabel: (candidate) => this.state.config.tileTypes?.[candidate?.type]?.label || candidate?.type || "Pond tile",
        },
      });
    }

    legacyBuildContextMenu(tile) {
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
        this.teamCommandMenuItems(tile, ["objective", "attack"]).forEach((item) => items.push(item));
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
          add("Reed Shield", { action: "special", specialType: "reedShield" }, { icon: "R", disabled: !this.isValidSpecialTarget(tile, "reedShield"), hint: "Raise reeds to strengthen this border" });
        } else {
          add("Defend Border", { action: "defend", percent: 0.25 }, { icon: "D", disabled: true, hint: "Choose an outer border tile" });
        }

        if (!tile.building) {
          sep();
          this.buildingMenuItems(human, tile).forEach((item) => items.push(item));
        }

        sep();
        add("Set Rally Point", { action: "rally" }, { icon: "R", hint: "Mark this as your focus point" });
        add("Dragonfly Guard", { action: "special", specialType: "dragonflyGuard" }, { icon: "G", disabled: !this.isValidSpecialTarget(tile, "dragonflyGuard"), hint: "Protect this area from pond specials" });
        add("Use Ability Here", { action: "ability" }, { icon: "A", hint: root.PondInfo?.abilityTip(human.animal) });
        add("View Tile Info", { action: "viewTile" }, { icon: "i", hint: "Show tile details in the panel" });
        this.teamCommandMenuItems(tile, ["help", "defend", "protect"]).forEach((item) => items.push(item));
        add("Ping Defend Here", { action: "ping", pingType: "defend" }, { icon: "P", hint: "Signal a defensive focus" });
        return { title: "Your Territory", subtitle: type.label, items };
      }

      const relation = this.relationship(tile.owner);
      if (relation?.allied || relation?.teammate) {
        add("Ping Good Job", { action: "ping", pingType: "good", targetId: tile.owner }, { icon: "P", hint: "Ally-visible signal" });
        add("Request Help", { action: "ping", pingType: "help", targetId: tile.owner }, { icon: "H", hint: "Ask ally to support this area" });
        [0.25, 0.5, 0.75].forEach((percent) =>
          add(`Send Support ${Math.round(percent * 100)}%`, { action: "support", percent, targetId: tile.owner }, { icon: "S", hint: "Transfer Animal Energy with 75% efficiency" }),
        );
        add("Ping Defend Here", { action: "ping", pingType: "defend", targetId: tile.owner }, { icon: "D", hint: "Ask ally to defend here" });
        add("Dragonfly Guard", { action: "special", specialType: "dragonflyGuard" }, { icon: "G", disabled: !this.isValidSpecialTarget(tile, "dragonflyGuard"), hint: "Protect allied territory from pond specials" });
        add("Ping Attack Here", { action: "ping", pingType: "attack", targetId: tile.owner }, { icon: "A", hint: "Coordinate an ally attack" });
        this.teamCommandMenuItems(tile, ["help", "defend", "objective"]).forEach((item) => items.push(item));
        add("Ping Danger", { action: "ping", pingType: "danger", targetId: tile.owner }, { icon: "!", hint: "Warn your ally" });
        add("View Ally Info", { action: "viewPlayer", targetId: tile.owner }, { icon: "i", hint: "Open player details" });
        if (!relation?.teammate) add("Break Alliance", { action: "diplomacy", command: "breakAlliance", targetId: tile.owner }, { icon: "B", danger: true, hint: "End friendly status" });
        return { title: owner?.name || "Ally", subtitle: `${type.label} | ${relation?.teammate ? "Team" : "Alliance"}`, items };
      }

      const attackable = this.isAttackableBorder(tile);
      if (attackable) {
        const styleLabels = { 0.1: "Probe", 0.25: "Quick Bite", 0.5: "Strong Push", 0.75: "Full Wave", 1: "Max Wave" };
        [0.1, 0.25, 0.5, 0.75, 1].forEach((percent) =>
          add(`${styleLabels[percent] || "Attack"} ${Math.round(percent * 100)}%`, { action: "attack", percent, targetId: tile.owner }, { icon: "A", danger: percent >= 0.75, hint: "Start a continuous frontline attack" }),
        );
      } else {
        add(relation && !relation.canAttack ? relation.blockReason : "Too Far To Attack", { action: "viewPlayer", targetId: tile.owner }, { icon: "X", disabled: true, hint: relation?.blockReason || "Need a connected enemy border" });
      }

      sep();
      if (relation?.canAttack) {
        add("Current Push 50%", { action: "waterRoute", percent: 0.5, targetId: tile.owner }, { icon: "~", hint: "Try a slower attack through open water routes" });
        add("Lily Barrage", { action: "special", specialType: "lilyBarrage", targetId: tile.owner }, { icon: "L", disabled: !this.isValidSpecialTarget(tile, "lilyBarrage"), hint: "Long-range pond-energy strike with warning" });
      }
      this.teamCommandMenuItems(tile, ["attack", "push", "objective", "retreat"]).forEach((item) => items.push(item));
      if (items.length && !items[items.length - 1].separator) sep();
      if (relation?.pendingForViewer) {
        add("Accept Alliance", { action: "diplomacy", command: "acceptAlliance", targetId: tile.owner }, { icon: "A", hint: "Accept pending request" });
        add("Reject Request", { action: "diplomacy", command: "rejectAlliance", targetId: tile.owner }, { icon: "R", danger: true, hint: "Decline pending request" });
      } else {
        add("Request Alliance", { action: "diplomacy", command: "requestAlliance", targetId: tile.owner }, { icon: "A", disabled: relation?.state === "requested" || relation?.state === "truce" || relation?.betrayalLeft > 0, hint: relation?.state === "requested" ? "Request pending" : "Ask for friendly borders" });
      }
      add("Offer Truce", { action: "diplomacy", command: "offerTruce", targetId: tile.owner }, { icon: "T", disabled: relation?.state === "truce", hint: relation?.truceLeft > 0 ? `${relation.truceLeft}s left` : "Temporarily block attacks" });
      add("Declare War", { action: "diplomacy", command: "declareWar", targetId: tile.owner }, { icon: "W", danger: true, disabled: relation?.betrayalByViewer && relation?.betrayalLeft > 0, hint: relation?.betrayalLeft > 0 ? "Betrayal cooldown active" : "Clear peace and mark war" });
      add("Mark Enemy", { action: "diplomacy", command: "markEnemy", targetId: tile.owner }, { icon: "M", danger: true, hint: "Track this rival" });
      add("View Enemy Info", { action: "viewPlayer", targetId: tile.owner }, { icon: "i", hint: "Show strength and relation" });
      add("Send Warning", { action: "ping", pingType: "warning", targetId: tile.owner }, { icon: "!", danger: true, hint: "Public warning signal" });
      return { title: owner?.name || "Enemy", subtitle: attackable ? "Enemy border" : "Enemy interior", items };
    }

    teamCommandMenuItems(tile, commandIds = []) {
      if (!this.state?.teamState?.active || !this.human()?.teamId) return [];
      const commands = root.PondTeams?.commands || {};
      return commandIds
        .filter((id) => commands[id])
        .map((id) => ({
          label: `Team: ${commands[id].label}`,
          icon: "T",
          hint: "Send a co-op command to teammate bots",
          payload: { action: "teamCommand", command: id, tileId: tile.id, targetId: tile.owner || null },
          preview: { action: "teamCommand", command: id, tileId: tile.id, targetId: tile.owner || null },
        }));
    }

    buildingMenuItems(human, tile) {
      return Object.entries(this.state.config.buildings).map(([buildingType, building]) => {
        const preview = this.buildPreview(buildingType, tile, human);
        const cost = preview.cost;
        const disabled = !preview.canBuild;
        const reason = preview.canBuild
          ? `${cost} energy. Finishes in ${preview.buildTime || 0}s.`
          : preview.reason || "Cannot build here.";
        return {
          label: `Build ${building.label} - ${cost} Energy`,
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

      if (["spawnReserve", "spawnConfirm", "spawnRelease", "spawnRandom", "spawnFind"].includes(payload.action)) {
        await this.handleSpawnAction({ type: payload.action, tileId: payload.tileId, snapNearby: payload.snapNearby });
        return;
      }
      if (payload.action === "cancelSelection") {
        this.cancelSelection();
        return;
      }

      if (["viewTile", "viewTerrain", "viewArea", "previewCost"].includes(payload.action)) {
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
      if (payload.action === "teamCommand") {
        await this.postAction({ type: "teamCommand", tileId: tile?.id, command: payload.command, targetId: payload.targetId || tile?.owner || null });
        return;
      }
      if (payload.action === "diplomacy") {
        this.selectedPlayerId = payload.targetId || tile?.owner || null;
        await this.postAction({ type: "diplomacy", targetId: this.selectedPlayerId, command: payload.command });
        return;
      }
      if (payload.action === "ability") {
        await this.handleAbilityAction({ tileId: tile?.id });
        return;
      }
      if (payload.action === "special") {
        await this.handleSpecialAction({ tileId: tile?.id, specialType: payload.specialType });
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
      if (payload.action === "support") {
        await this.postAction({ type: "support", targetId: payload.targetId || tile?.owner, percent: this.ui.percent });
        return;
      }
      if (payload.action === "waterRoute") {
        if (this.isTouchLayout() && !this.pendingCurrentPush) {
          this.pendingCurrentPush = true;
          this.pendingAbilityTarget = false;
          this.pendingBuildType = null;
          this.pendingSpecialType = null;
          this.pendingTargetConfirmation = null;
          this.mode = "special";
          this.preview = { mode: "attack", tileIds: this.state.tiles.filter((candidate) => candidate.owner && candidate.owner !== this.state.humanId && this.estimateCurrentPush(candidate, this.human()).valid).map((candidate) => candidate.id), label: "Current Push target" };
          this.ui.toast("Current Push: tap a glowing enemy coast, then tap again to confirm.");
          this.updateUi();
          return;
        }
        const human = this.human();
        const action = {
          type: "waterRoute",
          tileId: tile?.id,
          percent: this.ui.percent,
        };
        const pendingAction = this.beginPendingAction(action, tile, human);
        if (pendingAction === false) return;
        action.sourceIds = this.fastSourceIds(tile);
        await this.postAction(action, { pendingAction });
        return;
      }
      if (["expand", "attack", "defend"].includes(payload.action)) {
        const human = this.human();
        const action = { type: payload.action, tileId: tile?.id, percent: this.ui.percent };
        const pendingAction = this.beginPendingAction(action, tile, human);
        if (pendingAction === false) return;
        if (payload.action === "expand" || payload.action === "attack") action.sourceIds = this.fastSourceIds(tile);
        await this.postAction(action, { pendingAction });
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

      if (payload.action === "waterRoute") {
        const estimate = this.estimateCurrentPush(tile, human);
        this.preview = {
          mode: "attack",
          tileIds: [tile.id],
          toId: tile.id,
          label: estimate.valid ? `Current | ${estimate.travelTime}s | ${estimate.impactPower} power` : "Current route blocked",
        };
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

      if (payload.action === "special") {
        const special = this.state.config.specials?.[payload.specialType] || root.PondSpecials?.[payload.specialType] || {};
        this.preview = {
          mode: payload.specialType === "lilyBarrage" ? "attack" : "defend",
          tileIds: this.isValidSpecialTarget(tile, payload.specialType) ? [tile.id] : this.specialTargetIds(payload.specialType),
          toId: tile.id,
          label: special.label || "Special",
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
      if (!tile?.owner || tile.owner === this.state.humanId) return false;
      const relation = this.relationship(tile.owner);
      if (relation && !relation.canAttack) return false;
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
        const relation = this.relationship(tile.owner);
        this.mode = relation && !relation.canAttack ? "diplomacy" : "attack";
        if (!options.preserveSources) this.ensureSourceFor(tile);
      } else if (this.isBlocked(tile)) {
        this.mode = "blocked";
      } else {
        this.mode = "expand";
        if (!options.preserveSources) this.ensureSourceFor(tile);
      }
      if (this.pendingAbilityTarget) this.mode = "ability";
      if (this.pendingBuildType) {
        this.mode = "build";
        this.ui.nodes.buildSelect.value = this.pendingBuildType;
      }
      if (this.pendingSpecialType) this.mode = "special";
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

    fastSourceIds(target) {
      if (!target) return [];
      const selected = this.validSourceTiles().filter((source) => this.sourceCanReach(source, target));
      if (selected.length) return selected.map((source) => source.id);
      const source = this.closestSource(target);
      return source ? [source.id] : [];
    }

    legalTileIds() {
      if (!this.state) return [];
      const human = this.human();
      if (!human) return [];
      const buildingType = this.pendingBuildType || this.ui.nodes.buildSelect.value;
      const key = [
        this.stateVersion,
        this.mode,
        human.id,
        human.animal,
        Math.round(human.energy || 0),
        human.buildings?.jumpPad || 0,
        buildingType || "",
        this.pendingSpecialType || "",
        this.pendingCurrentPush ? "currentPush" : "",
        this.sourceIds.join("."),
      ].join("|");
      if (this.legalCache.key === key) return this.legalCache.ids;

      let ids = [];

      if (this.pendingCurrentPush) {
        ids = this.state.tiles
          .filter((tile) => tile.owner && tile.owner !== human.id && this.estimateCurrentPush(tile, human).valid)
          .map((tile) => tile.id);
      } else if (this.mode === "ability" && human.animal === "frog") {
        ids = this.leapTargetIds();
      } else if (this.mode === "special") {
        ids = this.specialTargetIds(this.pendingSpecialType || "lilyBarrage");
      } else if (this.mode === "build") {
        ids = this.state.tiles
          .filter((tile) => this.canBuildHere(human, tile, buildingType))
          .map((tile) => tile.id);
      } else if (this.mode === "defend") {
        ids = this.state.tiles
          .filter((tile) => tile.owner === human.id && this.isBorder(tile, human.id))
          .map((tile) => tile.id);
      } else {
        const mode = this.mode === "attack" || this.mode === "diplomacy" ? "attack" : "expand";
        const validSources = this.validSourceTiles();
        const sources = validSources.length ? validSources : this.humanBorders();
        const targetIds = new Set();
        sources.forEach((source) => {
          this.neighbors(source).forEach((target) => this.addLegalTarget(targetIds, target, mode));
          if (human.animal === "frog" && mode === "expand") {
            const range = human.buildings?.jumpPad ? 3 : 2;
            for (let y = source.y - range; y <= source.y + range; y += 1) {
              for (let x = source.x - range; x <= source.x + range; x += 1) {
                const target = this.tileAt(x, y);
                const d = Math.abs(source.x - x) + Math.abs(source.y - y);
                if (d > 1 && d <= range) this.addLegalTarget(targetIds, target, mode);
              }
            }
          }
        });
        ids = [...targetIds];
      }
      this.legalCache = { key, ids };
      return ids;
    }

    addLegalTarget(ids, tile, mode) {
      if (!tile || this.isBlocked(tile) || tile.owner === this.state.humanId) return;
      if (tile.owner && this.isAllied(tile.owner)) return;
      if (mode === "attack" && !tile.owner) return;
      if (mode === "expand" && tile.owner) return;
      ids.add(tile.id);
    }

    canBuildHere(human, tile, buildingType) {
      return Boolean(this.buildPreview(buildingType, tile, human).canBuild);
    }

    specialTargetIds(specialType) {
      if (!this.state) return [];
      const human = this.human();
      const ownedTiles = this.state.tiles.filter((tile) => tile.owner === human?.id);
      return this.state.tiles.filter((tile) => this.isValidSpecialTarget(tile, specialType, ownedTiles)).map((tile) => tile.id);
    }

    isValidSpecialTarget(tile, specialType, ownedTiles = null) {
      const human = this.human();
      const special = this.state?.config?.specials?.[specialType] || root.PondSpecials?.[specialType];
      if (!human || !tile || !special || this.isBlocked(tile)) return false;
      const owned = ownedTiles || this.state.tiles.filter((candidate) => candidate.owner === human.id);
      const inRange = owned.some((candidate) => this.distance(candidate, tile) <= (special.range || 18));
      if (!inRange) return false;
      if (specialType === "lilyBarrage") {
        if (!tile.owner || tile.owner === human.id) return false;
        const relation = this.relationship(tile.owner);
        if (relation && !relation.canAttack) return false;
        if (tile.isCore && !this.neighbors(tile).some((neighbor) => neighbor.owner && neighbor.owner !== tile.owner)) return false;
        return true;
      }
      if (specialType === "dragonflyGuard") {
        if (!tile.owner) return false;
        const owner = this.player(tile.owner);
        return tile.owner === human.id || this.isAllied(tile.owner) || (human.teamId && owner?.teamId === human.teamId);
      }
      if (specialType === "reedShield") {
        return tile.owner === human.id && this.isBorder(tile, human.id);
      }
      return false;
    }

    leapTargetIds() {
      if (!this.state) return [];
      const borders = this.humanBorders();
      return this.state.tiles.filter((tile) => this.isLeapTarget(tile, borders)).map((tile) => tile.id);
    }

    isLeapTarget(tile, borders = null) {
      const human = this.human();
      if (!tile || !human || human.animal !== "frog" || tile.owner || this.isBlocked(tile)) return false;
      const sources = borders || this.humanBorders();
      return sources.some((source) => {
        const range = human.flags?.jumpPad || human.buildings?.jumpPad ? 3 : 2;
        const d = this.distance(source, tile);
        return d >= 2 && d <= range;
      });
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
      this.pendingAbilityTarget = false;
      this.pendingBuildType = null;
      this.pendingSpecialType = null;
      this.mode = "expand";
    }

    loop() {
      const draw = () => {
        const now = performance.now();
        const fpsLimit = this.ui.mobilePreferences?.().fpsLimit || 60;
        const frameInterval = 1000 / fpsLimit;
        if (this.isTouchLayout() && this.lastRenderAt && now - this.lastRenderAt < frameInterval - 1) {
          requestAnimationFrame(draw);
          return;
        }
        this.lastRenderAt = now;
        const view = this.ui.viewOptions();
        this.recordFrame(now, view);
        this.renderer.draw({
          ...view,
          selectedTileId: this.selectedTileId,
          hoverTileId: this.hoverTileId,
          sourceIds: this.sourceIds,
          legalTileIds: this.legalTileIds(),
          preview: this.preview,
          rallyTileId: this.rallyTileId,
          mode: this.mode,
          performanceLow: this.performanceAutoLow,
          performanceLevel: this.runtimeVisualState.temporaryPerformanceLevel,
          runtimeVisualState: this.runtimeVisualState,
          spawnSelection: this.spawnRenderOptions(),
          pointerDebug: this.renderer.lastPointerHit
            ? { ...this.renderer.lastPointerHit, selectedTileId: this.selectedTileId, hoveredTileId: this.hoverTileId }
            : null,
        });
        if (this.state && view.showDebugStats && now - this.lastPerfUiAt > 500) {
          this.lastPerfUiAt = now;
          this.ui.updateDebugStats(this.state);
        }
        if (this.state && now - this.lastCooldownUiAt > 250) {
          this.lastCooldownUiAt = now;
          this.ui.refreshAbilityCooldown?.(this.estimatedServerNow());
        }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }

    estimatedServerNow() {
      return this.serverClock.time + Math.max(0, performance.now() - this.serverClock.receivedAt) / 1000;
    }

    spawnRenderOptions() {
      if (!this.isSpawnPhase()) return null;
      return {
        phase: this.state.phase,
        candidateIds: this.spawnCandidateIds || new Set(),
        unavailableCandidateIds: this.spawnUnavailableCandidateIds || new Set(),
        candidateZones: this.spawnCandidateZones || new Map(),
        hoverTileId: this.hoverTileId,
        selectedTileId: this.selectedTileId,
        startRadius: this.state.spawn?.startRadius || 2,
        reservations: this.state.spawn?.reservations || [],
        ownReservation: this.state.spawn?.ownReservation || null,
        minimumDistanceRadius: this.state.spawn?.minimumDistanceRadius || 6,
        inspection: this.spawnInspection,
      };
    }

    recordFrame(now = performance.now(), view = null) {
      if (!this.frameSample.lastAt) {
        this.frameSample.lastAt = now;
        return;
      }
      const frameMs = Math.max(0, now - this.frameSample.lastAt);
      this.frameSample.lastAt = now;
      this.frameSample.frames += 1;
      this.frameSample.totalMs += frameMs;
      this.frameSample.worstMs = Math.max(this.frameSample.worstMs, frameMs);
      if (now - this.frameSample.since >= 1000) {
        const fps = Math.round((this.frameSample.frames * 1000) / Math.max(1, now - this.frameSample.since));
        const avgFrame = this.frameSample.totalMs / Math.max(1, this.frameSample.frames);
        this.performanceStats.fps = fps;
        this.performanceStats.lowestFps = Math.min(this.performanceStats.lowestFps || fps, fps);
        this.performanceStats.frameMs = Number(avgFrame.toFixed(1));
        this.performanceStats.worstFrameMs = Number(this.frameSample.worstMs.toFixed(1));
        this.updateRuntimeVisualPerformance(fps, now, view);
        this.frameSample = { frames: 0, totalMs: 0, worstMs: 0, since: now, lastAt: now };
      }
    }

    updateRuntimeVisualPerformance(fps, now, view = null) {
      const autoEnabled = view?.effects?.autoLowPerformance !== false;
      const runtime = this.runtimeVisualState;
      if (!autoEnabled) {
        if (runtime.temporaryPerformanceLevel > 0 || this.performanceAutoLow) this.clearRuntimeVisualReduction("auto performance disabled", { silent: true });
        return;
      }
      const cooldownReady = now - (runtime.lastAutoChangeTime || 0) > 10000;
      if (fps < 45) {
        this.performanceLowSince = this.performanceLowSince || now;
        runtime.stableFpsSince = 0;
        if (now - this.performanceLowSince > 3000 && cooldownReady && runtime.temporaryPerformanceLevel < 2) {
          runtime.temporaryPerformanceLevel += 1;
          runtime.autoReducedEffects = true;
          runtime.fpsLowReason = `FPS ${fps} below 45`;
          runtime.lastAutoChangeTime = now;
          runtime.renderCacheVersion += 1;
          this.performanceAutoLow = runtime.temporaryPerformanceLevel > 0;
          this.renderer.invalidateVisualCaches?.("auto performance reduce");
          if (now - (runtime.lastNoticeAt || 0) > 15000) {
            runtime.lastNoticeAt = now;
            this.ui.toast("Performance mode reduced visuals temporarily.");
          }
        }
        return;
      }
      this.performanceLowSince = 0;
      if (fps >= 50) runtime.stableFpsSince = runtime.stableFpsSince || now;
      else runtime.stableFpsSince = 0;
      if (runtime.temporaryPerformanceLevel > 0 && runtime.stableFpsSince && now - runtime.stableFpsSince > 15000 && cooldownReady) {
        runtime.temporaryPerformanceLevel -= 1;
        runtime.lastAutoChangeTime = now;
        runtime.renderCacheVersion += 1;
        runtime.fpsLowReason = runtime.temporaryPerformanceLevel > 0 ? "Restoring visuals gradually" : "";
        runtime.autoReducedEffects = runtime.temporaryPerformanceLevel > 0;
        this.performanceAutoLow = runtime.temporaryPerformanceLevel > 0;
        if (!this.performanceAutoLow) runtime.stableFpsSince = 0;
        this.renderer.invalidateVisualCaches?.("auto performance restore");
        if (!this.performanceAutoLow && now - (runtime.lastNoticeAt || 0) > 12000) {
          runtime.lastNoticeAt = now;
          this.ui.toast("Visuals restored.");
        }
      }
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

    relationship(playerId) {
      return this.state?.relationships?.find((entry) => entry.playerId === playerId) || null;
    }

    isBlocked(tile) {
      return Boolean(tile && this.state.config.tileTypes[tile.type]?.blocks);
    }

    isTileUnderAttack(tile) {
      if (!tile) return false;
      return (this.state?.activeAttacks || []).some((wave) => {
        if (wave.targetStartTile === tile.id) return true;
        if (wave.frontierTiles?.includes(tile.id)) return true;
        if (wave.capturedTiles?.includes(tile.id)) return true;
        return false;
      });
    }

    neutralExpansionCost(tile, jumped = false) {
      const human = this.human();
      const type = this.state?.config.tileTypes[tile?.type];
      if (!tile || !type) return 0;
      const core = human?.coreTileId != null ? this.tileMap.get(human.coreTileId) : null;
      const distanceFromCore = core ? this.distance(core, tile) : 0;
      const nearbyEnemyBorders = this.neighbors(tile).filter((neighbor) => neighbor.owner && neighbor.owner !== human?.id).length;
      const comebackThreshold = this.state?.config?.balance?.comebackTerritoryPct || 0.08;
      return (
        root.PondConfig?.getNeutralTileExpansionCost?.(tile.type, human?.animal, {
          jumped,
          flockRush: human?.animal === "duck" && this.state.serverTime < human.abilityActiveUntil,
          goldenCurrent: human?.animal === "carp" && this.state.serverTime < human.abilityActiveUntil,
          mudTunnel: Boolean(human?.flags?.mudTunnel),
          jumpPad: Boolean(human?.flags?.jumpPad),
          territory: human?.territory || 0,
          distanceFromCore,
          nearbyEnemyBorders,
          specialCostBonus: this.specialCostBonus(tile),
          rainstorm: this.state?.lakeEvent?.active?.type === "rainstorm",
          evolved: (human?.level || 1) >= 5,
          comebackCore: core && this.distance(core, tile) <= 3 && (human?.territoryPct || 0) < comebackThreshold,
          comebackSmall: this.neighbors(tile).some((neighbor) => neighbor.owner === human?.id) && (human?.territoryPct || 0) < comebackThreshold,
        }) || type.captureCost
      );
    }

    specialCostBonus(tile) {
      if (!tile) return 0;
      if (tile.objectiveId) {
        const objective = this.state.objectives?.find((entry) => entry.id === tile.objectiveId);
        if (objective?.active) return objective.definition?.captureCostBonus || 0;
      }
      if (tile.campId) {
        const camp = this.state.camps?.find((entry) => entry.id === tile.campId);
        if (camp?.active) return camp.definition?.captureCostBonus || 0;
      }
      return 0;
    }

    buildingCost(buildingType, human = this.human()) {
      const details = root.PondBuildingRules?.buildingCostDetails?.(
        human,
        buildingType,
        this.state?.config || {},
        this.state?.config?.balance || root.PondBalance || {},
      );
      if (details && Number.isFinite(details.cost)) return details.cost;
      const configured = this.state?.config?.buildingCosts?.[buildingType];
      if (configured != null) return configured;
      const building = this.state?.config?.buildings?.[buildingType];
      return building?.cost ?? Infinity;
    }

    buildPreview(buildingType, tile = this.selectedTile(), human = this.human()) {
      const preview = root.PondBuildingRules?.previewBuild?.({
        player: human,
        tile,
        buildingType,
        gameConfig: this.state?.config || {},
        balance: this.state?.config?.balance || root.PondBalance || {},
        now: this.state?.serverTime || 0,
        instantBuild: Boolean(this.state?.sandbox?.rules?.instantBuild),
      });
      if (preview) return preview;
      const cost = this.buildingCost(buildingType, human);
      return {
        buildingType,
        cost,
        canBuild: Boolean(human && tile && tile.owner === human.id && !tile.building && human.energy >= cost),
        reason: "",
        buildTime: this.state?.config?.balance?.buildTimeSeconds || 10,
        energyRequired: Math.max(0, cost - Math.round(human?.energy || 0)),
      };
    }

    constructionLeft(tile) {
      return Math.max(0, Math.ceil((tile?.buildingActiveAt || 0) - (this.state?.serverTime || 0)));
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
      const key = `${this.stateVersion}|${humanId || ""}`;
      if (this.humanBordersCache.key === key) return this.humanBordersCache.borders;
      const borders = this.state?.tiles.filter((tile) => this.isBorder(tile, humanId)) || [];
      this.humanBordersCache = { key, borders };
      return borders;
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
      const borderTools = root.PondBorderStatus;
      const tileType = this.state.config.tileTypes[tile.type];
      const ownerIsHuman = tile.owner === human.id;
      const underAttack = this.isTileUnderAttack(tile);
      const context = {
        canExpand: !tile.owner && !this.isBlocked(tile) && Boolean(this.closestSource(tile)),
        canDefend: ownerIsHuman && (this.isBorder(tile, human.id) || Boolean(tile.building)),
        canBuild: ownerIsHuman && !tile.building,
        canUpgradeBuilding: ownerIsHuman && Boolean(tile.building) && (tile.buildingLevel || 1) < 3,
        canRemoveBuilding: ownerIsHuman && Boolean(tile.building),
        underAttack,
        pendingAbility: this.pendingAbilityTarget,
        pendingBuildType: this.pendingBuildType,
        pendingSpecialType: this.pendingSpecialType,
        pendingCommand: this.pendingCurrentPush,
        validAbilityTarget: this.isLeapTarget(tile),
        validBuildTarget: this.pendingBuildType ? this.canBuildHere(human, tile, this.pendingBuildType) : false,
        validSpecialTarget: this.pendingSpecialType ? this.isValidSpecialTarget(tile, this.pendingSpecialType) : false,
      };
      if (!tile.owner && !this.isBlocked(tile)) {
        const source = this.closestSource(tile);
        const jumped = Boolean(source && !this.neighbors(source).some((neighbor) => neighbor.id === tile.id));
        const expansionCost = this.neutralExpansionCost(tile, jumped);
        const expansionProgress = Number(tile.captureProgress?.[human.id] || 0);
        const sendEnergy = Math.round(human.energy * this.ui.percent);
        const remaining = Math.max(0, Math.round(expansionCost - expansionProgress));
        const willCapture = context.canExpand && sendEnergy >= remaining;
        const status = borderTools?.statusFor?.({ tile, tileType, canExpand: context.canExpand, underAttack }) || null;
        return {
          ...context,
          jumped,
          flockRush: human.animal === "duck" && this.state.serverTime < human.abilityActiveUntil,
          goldenCurrent: human.animal === "carp" && this.state.serverTime < human.abilityActiveUntil,
          expansionCost,
          expansionProgress,
          expansionRemaining: remaining,
          sendEnergy,
          willCapture,
          status,
          estimateText: willCapture
            ? `Will capture with ${sendEnergy} energy`
            : `${Math.round(expansionProgress)}/${expansionCost} capture, ${remaining} left`,
          resultText: willCapture ? "Capture now" : `Needs ${remaining} energy`,
          warning: context.canExpand ? "" : "Too far from your border.",
        };
      }
      if (!tile.owner || ownerIsHuman) {
        const defenseTotal = Math.round((tile.defenseEnergy || 0) + (tileType?.defenseBonus || 0));
        const status = borderTools?.statusFor?.({ tile, tileType, ownerIsHuman, underAttack }) || null;
        return {
          ...context,
          status,
          defenseLevel: borderTools?.defenseLevel?.(defenseTotal) || "Low",
          defenseTotal,
          warning: underAttack ? "This front is being attacked. Defend here to raise capture cost." : "",
        };
      }
      const relation = this.relationship(tile.owner);
      if (relation && !relation.canAttack) {
        const status = borderTools?.statusFor?.({ tile, tileType, relation, canAttack: false, underAttack }) || null;
        return { ...context, kind: "blockedAttack", reason: relation.blockReason, relationship: relation, status, warning: relation.blockReason };
      }
      const source = this.closestSource(tile);
      const connected = Boolean(source && this.neighbors(source).some((neighbor) => neighbor.id === tile.id));
      if (!connected) {
        const status = borderTools?.statusFor?.({ tile, tileType, relation, canAttack: false, underAttack }) || null;
        const currentPushPreview = this.estimateCurrentPush(tile, human);
        return {
          ...context,
          kind: currentPushPreview.valid ? "attackBorder" : "blockedAttack",
          canAttack: false,
          reason: currentPushPreview.valid ? "Too far for Border Attack. Try Current Push." : "Too far from border",
          relationship: relation,
          status,
          currentPushPreview,
          recommendedAction: currentPushPreview.valid ? "Current Push" : "Move closer",
          recommendedReason: currentPushPreview.valid ? "Enemy coastal border is far but reachable by water." : "No valid water route found.",
          warning: currentPushPreview.valid ? "Too far for Border Attack. Try Current Push." : "Attack from a connected front-line border.",
        };
      }

      const energy = Math.round(human.energy * this.ui.percent);
      const estimate = this.estimateWave(tile, energy);
      const fogged = this.state.lakeEvent?.active?.type === "foggyMarsh";
      const estimatedCost = Number(estimate.nextCost) || 0;
      const attackProgress = Number(tile.captureProgress?.[human.id] || 0);
      const adjustedCost = Math.max(0, estimatedCost - attackProgress);
      const pressureConfig = this.attackPressureConfig();
      const threshold = Number(pressureConfig.captureThreshold || 0.82);
      const terrainDefense = Math.round(tileType?.defenseBonus || 0);
      const formula = this.combatFormula();
      const reinforcedBonus = Math.round(
        this.effectiveDefenseEnergy(this.player(tile.owner), tile) * (formula.defenseEnergyMultiplier || 0.58) +
          Math.min(5, terrainDefense) * (formula.terrainDefenseMultiplier || 1.05) +
          this.specialCostBonus(tile),
      );
      const status = borderTools?.statusFor?.({
        tile,
        tileType,
        relation,
        canAttack: true,
        underAttack,
        estimatedCost: adjustedCost || estimatedCost,
      }) || null;
      const risk = borderTools?.riskLevel?.(energy, adjustedCost || estimatedCost, estimate.tiles) || "Unknown";
      const warning =
        adjustedCost && energy < adjustedCost * threshold
          ? `Quick Bite will weaken this border. Send about ${Math.ceil(adjustedCost - energy)} more energy to break it now.`
          : status?.id === "reinforced" || status?.id === "strong"
            ? "Strong border: Push 50% or Wave 75% after a Bite weakens it."
            : risk === "Bad Attack" || risk === "Very Risky"
              ? "Risky attack. Bite first, or save energy for a stronger wave."
              : "";
      const currentPushPreview = this.estimateCurrentPush(tile, human);
      const styleLabel = this.ui.attackStyleLabel?.(this.ui.percent) || "Border Attack";
      const recommendedAction =
        attackProgress > 0 && adjustedCost <= energy * 1.15
          ? "Strong Push"
          : estimate.tiles >= 4 || this.ui.percent >= 0.75
            ? "Full Wave"
            : adjustedCost && energy < adjustedCost
              ? "Quick Bite"
              : "Strong Push";
      const recommendedReason =
        recommendedAction === "Quick Bite"
          ? "Small attacks now weaken the front for your next push."
          : recommendedAction === "Full Wave"
            ? "A larger send can roll through several connected tiles."
            : attackProgress > 0
              ? "This border already has pressure on it and is close to breaking."
              : "Enemy border is connected to your front line.";
      const estimateText = fogged
        ? "Hidden by Foggy Marsh"
        : attackProgress > 0
          ? `Weakened ${Math.round(attackProgress)}/${estimatedCost}; ${Math.ceil(adjustedCost)} left`
          : estimate.tiles > 0
            ? `${styleLabel}: ${estimate.tiles} tile${estimate.tiles === 1 ? "" : "s"}, first cost ~${estimatedCost}`
            : `${styleLabel}: weakens border (${Math.min(energy, estimatedCost)}/${estimatedCost})`;
      return {
        ...context,
        kind: "attackBorder",
        canAttack: true,
        relationship: relation,
        status,
        risk,
        percent: Math.round(this.ui.percent * 100),
        strength: energy,
        sendEnergy: energy,
        tiles: fogged ? "?" : estimate.tiles,
        nextCost: fogged ? "?" : Math.ceil(adjustedCost || estimate.nextCost),
        rawNextCost: estimate.nextCost,
        attackProgress,
        attackRemaining: Math.ceil(adjustedCost),
        pressureThreshold: Math.ceil(estimatedCost * threshold),
        defenseReasons: this.attackDefenseReasons(tile, this.player(tile.owner), estimatedCost, adjustedCost),
        terrainDefense,
        reinforcedBonus,
        defenseLevel: borderTools?.defenseLevel?.((tile.defenseEnergy || 0) + terrainDefense) || "Low",
        warning,
        currentPushPreview,
        recommendedAction,
        recommendedReason,
        estimateText,
      };
    }

    estimateCurrentPush(target, human = this.human()) {
      const config = this.state?.config?.combat?.currentPush || {};
      const waterTypes = new Set(["water", "lily"]);
      const energy = Math.round((human?.energy || 0) * this.ui.percent);
      if (!target?.owner || target.owner === human?.id || !human || energy < (config.minEnergy || 10)) {
        return { valid: false, reason: "Not enough energy or invalid target." };
      }
      const targetCoast = this.neighbors(target).some((neighbor) => waterTypes.has(neighbor.type) && !this.isBlocked(neighbor));
      if (!targetCoast) return { valid: false, reason: "Target is not connected to water." };
      const starts = this.state.tiles.filter((tile) => tile.owner === human.id && waterTypes.has(tile.type)).slice(0, 42);
      if (!starts.length) return { valid: false, reason: "No owned water source." };
      const maxRange = config.maxRange || 32;
      const queue = starts.map((tile) => ({ tile, distance: 1 }));
      const seen = new Set(starts.map((tile) => tile.id));
      while (queue.length) {
        const current = queue.shift();
        if (Math.abs(current.tile.x - target.x) + Math.abs(current.tile.y - target.y) <= 1) {
          const distance = current.distance;
          const tier = Math.max(0, Math.ceil((distance - (config.distanceTier || 8)) / (config.distanceTier || 8)));
          const efficiency = Math.max(config.minEfficiency || 0.5, (config.baseEfficiency || 0.78) - tier * (config.distancePenaltyPerTier || 0.1));
          const travelTime = Math.max(config.minTravelSeconds || 3, Math.min(config.maxTravelSeconds || 12, distance * (config.secondsPerTile || 0.28)));
          const impactPower = Math.round(energy * (this.state.config.balance.attackPowerMultiplier || 1) * efficiency);
          const low = Math.max(0, Math.floor(impactPower / Math.max(10, this.estimateTileCost(target, 0, this.player(target.owner)))));
          const high = Math.max(low, Math.min(config.maxImpactCaptures || 7, low + 3));
          return {
            valid: true,
            distance,
            travelTime: Number(travelTime.toFixed(1)),
            sendEnergy: energy,
            impactPower,
            estimatedCapture: `${low}-${high}`,
            risk: tier > 1 ? "Long route reduces power" : "Defender can reinforce before impact",
          };
        }
        if (current.distance >= maxRange) continue;
        this.neighbors(current.tile).forEach((neighbor) => {
          if (seen.has(neighbor.id) || this.isBlocked(neighbor) || !waterTypes.has(neighbor.type)) return;
          if (neighbor.owner && neighbor.owner !== human.id && neighbor.owner !== target.owner) return;
          seen.add(neighbor.id);
          queue.push({ tile: neighbor, distance: current.distance + 1 });
        });
      }
      return { valid: false, reason: "No open water route." };
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
        queue.sort(
          (a, b) =>
            a.distance - b.distance ||
            this.estimateAdjustedTileCost(a.tile, a.distance, defender, human.id).adjustedCost -
              this.estimateAdjustedTileCost(b.tile, b.distance, defender, human.id).adjustedCost,
        );
        const current = queue.shift();
        const { rawCost, adjustedCost } = this.estimateAdjustedTileCost(current.tile, current.distance, defender, human.id);
        if (!nextCost) nextCost = Math.round(rawCost);
        const closeEnough = rawCost > 0 && remaining / rawCost >= (this.attackPressureConfig().captureThreshold || 0.82);
        if (adjustedCost > remaining && !closeEnough) break;
        remaining -= Math.min(adjustedCost, remaining);
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
        queue.sort(
          (a, b) =>
            a.distance - b.distance ||
            this.estimateAdjustedTileCost(a.tile, a.distance, defender, human.id).adjustedCost -
              this.estimateAdjustedTileCost(b.tile, b.distance, defender, human.id).adjustedCost,
        );
        const current = queue.shift();
        const { rawCost, adjustedCost } = this.estimateAdjustedTileCost(current.tile, current.distance, defender, human.id);
        if (!nextCost) nextCost = Math.round(rawCost);
        const closeEnough = rawCost > 0 && remaining / rawCost >= (this.attackPressureConfig().captureThreshold || 0.82);
        if (adjustedCost > remaining && !closeEnough) break;
        remaining -= Math.min(adjustedCost, remaining);
        ids.push(current.tile.id);
        this.neighbors(current.tile).forEach((neighbor) => {
          if (seen.has(neighbor.id) || neighbor.owner !== defender.id || this.isBlocked(neighbor)) return;
          seen.add(neighbor.id);
          queue.push({ tile: neighbor, distance: current.distance + 1 });
        });
      }

      return { ids, nextCost };
    }

    combatFormula() {
      return this.state?.config?.combat?.formula || root.PondCombat?.formula || {};
    }

    attackPressureConfig() {
      return this.state?.config?.combat?.pressure || root.PondCombat?.pressure || {};
    }

    attackPressure(tile, attackerId = this.state?.humanId) {
      if (!tile?.owner || !attackerId || tile.owner === attackerId) return 0;
      return Math.max(0, Number(tile.captureProgress?.[attackerId] || 0));
    }

    effectiveDefenseEnergy(defender, tile) {
      const balance = this.state?.config?.balance || root.PondBalance || {};
      const cap = defender?.animal === "turtle" ? balance.turtleDefendMaxEnergy || 72 : balance.defendMaxEnergy || 56;
      return Math.max(0, Math.min(cap, Number(tile?.defenseEnergy || 0)));
    }

    estimateAdjustedTileCost(tile, distance, defender, attackerId = this.state?.humanId) {
      const rawCost = this.estimateTileCost(tile, distance, defender);
      const pressure = this.attackPressure(tile, attackerId);
      return {
        rawCost,
        adjustedCost: Math.max(0, rawCost - pressure),
        pressure,
      };
    }

    attackDefenseReasons(tile, defender, rawCost, adjustedCost) {
      const reasons = [];
      const type = this.state.config.tileTypes[tile.type];
      if ((tile.defenseEnergy || 0) >= 18) reasons.push("reinforced border");
      if ((type?.defenseBonus || 0) >= 2 || tile.type === "reeds" || tile.type === "mud") reasons.push("strong terrain");
      if (tile.building) reasons.push("building defense");
      if (defender?.animal === "turtle") reasons.push("turtle border bonus");
      if (defender?.energy > defender?.maxEnergy * 0.7) reasons.push("stored enemy energy");
      if (adjustedCost < rawCost) reasons.unshift("existing attack pressure");
      return reasons.slice(0, 3);
    }

    estimateTileCost(tile, distance, defender) {
      const type = this.state.config.tileTypes[tile.type];
      const formula = this.combatFormula();
      const baseByTile = formula.baseCostByTile || {};
      const base = tile.building ? formula.buildingBaseCost || 18 : baseByTile[tile.type] || (tile.type === "water" ? 6 : tile.type === "lily" ? 8 : tile.type === "reeds" ? 12 : tile.type === "mud" ? 14 : 16);
      const balance = this.state.config.balance || root.PondBalance || {};
      const attacker = this.human();
      const energyRatio = defender.energy / Math.max(1, defender.maxEnergy);
      let cost =
        base * (this.state.config.balance.attackCostMultiplier || 1) +
        Math.min(5, type.defenseBonus || 0) * (formula.terrainDefenseMultiplier || 1.05) +
        this.effectiveDefenseEnergy(defender, tile) * (formula.defenseEnergyMultiplier || 0.58) +
        distance * (formula.distanceCost || 1.1) +
        Math.min(formula.defenderEnergyFlatCap || 12, defender.energy * (formula.defenderEnergyFlatMultiplier || 0.024));
      if (defender.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) cost *= 1.2;
      if (tile.type === "water" && defender.animal === "frog") cost *= 0.95;
      if (defender.animal === "turtle") cost *= balance.turtleBorderDefenseMultiplier || 1.14;
      if (defender.animal === "turtle" && this.state.serverTime < (defender.abilityActiveUntil || 0)) {
        cost *= balance.shellGuardCaptureCostMultiplier || 1.22;
        if ((tile.defenseEnergy || 0) > 4) cost *= balance.shellGuardDefendedExtraMultiplier || 1.08;
      }
      if (defender.animal === "carp") cost *= balance.carpDefenseMultiplier || 0.92;
      if (attacker?.animal === "duck" && tile.type === "water") cost *= 0.86;
      if (attacker?.animal === "duck" && tile.type === "water" && this.state.serverTime < (attacker.abilityActiveUntil || 0)) cost *= balance.flockRushOpenWaterCostMultiplier || 0.65;
      if (attacker?.animal === "snake" && (tile.type === "reeds" || tile.type === "mud")) cost *= 0.86;
      if (attacker?.animal === "frog" && tile.type === "lily") cost *= 0.92;
      if (attacker?.animal === "carp" && this.state.serverTime < (attacker.abilityActiveUntil || 0) && tile.type === "water") cost *= balance.goldenCurrentWaterCostMultiplier || 0.8;
      if (attacker?.animal === "carp" && this.state.serverTime < (attacker.abilityActiveUntil || 0) && tile.type === "lily") cost *= balance.goldenCurrentLilyCostMultiplier || 0.7;
      if (this.state.lakeEvent?.active?.type === "mudslide" && tile.type === "mud") cost *= this.state.config.balance.mudslideDefenseMultiplier || 1.22;
      cost += this.specialCostBonus(tile);
      return Math.max(4, cost * ((formula.defenderEnergyRatioBase || 0.82) + energyRatio * (formula.defenderEnergyRatioMultiplier || 0.32)));
    }

    distance(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    isTouchLayout() {
      return window.matchMedia?.("(max-width: 900px), (pointer: coarse)")?.matches || false;
    }
  }

  const startClient = () => {
    if (!root.pondFrontGame) root.pondFrontGame = new PondGameClient();
  };
  if (root.document?.readyState === "loading") root.addEventListener("DOMContentLoaded", startClient, { once: true });
  else startClient();
})(window);
