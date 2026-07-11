const config = require("../shared/gameConfig");
const spawnConfig = require("../shared/spawnConfig");

class SpawnManager {
  constructor(game) {
    this.game = game;
    this.tileManager = game.tileManager;
    this.reservations = new Map();
    this.candidates = [];
    this.candidateById = new Map();
    this.mainWaterIds = new Set();
    this.startedAt = 0;
    this.deadline = null;
    this.countdownEndsAt = 0;
    this.autoAssigned = new Set();
    this.version = 0;
  }

  prepare(now = this.game.now()) {
    this.mainWaterIds = this.findMainWaterNetwork();
    this.candidates = this.generateCandidates();
    this.candidateById = new Map(this.candidates.map((candidate) => [candidate.tileId, candidate]));
    this.startedAt = now;
    this.deadline = this.game.matchSettings.spawnSelectionSeconds > 0 ? now + this.game.matchSettings.spawnSelectionSeconds : null;
    this.game.phase = spawnConfig.PHASES.SPAWN_SELECTION;
    this.assignBotSpawns();
  }

  findMainWaterNetwork() {
    const visited = new Set();
    let largest = [];
    this.tileManager.playable().forEach((start) => {
      if (visited.has(start.id)) return;
      const component = [];
      const queue = [start];
      visited.add(start.id);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const tile = queue[cursor];
        component.push(tile.id);
        tile.neighbors.forEach((neighbor) => {
          if (visited.has(neighbor.id) || config.TILE_TYPES[neighbor.type]?.blocks) return;
          visited.add(neighbor.id);
          queue.push(neighbor);
        });
      }
      if (component.length > largest.length) largest = component;
    });
    return new Set(largest);
  }

  generateCandidates() {
    const ids = new Set();
    const seeds = [];
    this.tileManager.spawnPoints.forEach(([x, y]) => {
      const tile = this.tileManager.get(x, y);
      if (tile && !ids.has(tile.id)) {
        ids.add(tile.id);
        seeds.push(tile);
      }
    });
    const step = this.tileManager.tiles.length > 9000 ? 4 : 3;
    for (let y = 2; y < this.tileManager.rows - 2; y += step) {
      for (let x = 2; x < this.tileManager.cols - 2; x += step) {
        const tile = this.tileManager.get(x, y);
        if (!tile || ids.has(tile.id)) continue;
        ids.add(tile.id);
        seeds.push(tile);
      }
    }
    return seeds
      .map((tile) => this.inspectCandidate(tile))
      .filter((candidate) => candidate.valid)
      .sort((a, b) => b.baseScore - a.baseScore)
      .slice(0, Math.max(260, this.game.players.length * 35));
  }

  inspectCandidate(tile) {
    const blocked = !tile || config.TILE_TYPES[tile.type]?.blocks;
    const objectiveDistance = tile ? this.nearestObjectiveDistance(tile) : 0;
    const nearby = tile ? this.tileManager.nearbyPlayableCount(tile.x, tile.y, 3) : 0;
    const directions = tile ? this.expansionDirections(tile) : 0;
    const inMainWater = Boolean(tile && this.mainWaterIds.has(tile.id));
    const valid = Boolean(
      tile &&
        !blocked &&
        !tile.objectiveId &&
        !tile.campId &&
        inMainWater &&
        nearby >= spawnConfig.MIN_NEARBY_TILES &&
        directions >= spawnConfig.MIN_EXPANSION_DIRECTIONS &&
        objectiveDistance >= this.objectiveClearance(),
    );
    return {
      tileId: tile?.id ?? -1,
      x: tile?.x ?? -1,
      y: tile?.y ?? -1,
      type: tile?.type || "blocked",
      nearby,
      directions,
      objectiveDistance,
      valid,
      baseScore: nearby * 1.45 + directions * 12 + Math.min(14, objectiveDistance) * 0.7 + (tile?.type === "water" ? 8 : tile?.type === "lily" ? 5 : 2),
      reason: valid ? "Valid starting water." : this.invalidReason({ tile, blocked, inMainWater, nearby, directions, objectiveDistance }),
    };
  }

  invalidReason(check) {
    if (!check.tile) return "That tile does not exist.";
    if (check.blocked) return "Choose playable water, not blocked land.";
    if (check.tile.objectiveId || check.tile.campId) return "Starting nests cannot cover an objective.";
    if (!check.inMainWater) return "That water pocket does not reach the main pond.";
    if (check.nearby < spawnConfig.MIN_NEARBY_TILES) return "This canal is too cramped for a fair start.";
    if (check.directions < spawnConfig.MIN_EXPANSION_DIRECTIONS) return "This location needs more expansion routes.";
    if (check.objectiveDistance < this.objectiveClearance()) return "Choose a location farther from the main objective.";
    return "That location is unavailable.";
  }

  objectiveClearance() {
    const mode = this.game.matchSettings.ruleMode;
    return mode === "goldenLily" || mode === "riverDomination" ? 7 : 4;
  }

  nearestObjectiveDistance(tile) {
    const objectiveTiles = this.game.objectives?.objectives?.map((objective) => this.tileManager.getById(objective.tileId)).filter(Boolean) || [];
    if (!objectiveTiles.length) return 99;
    return Math.min(...objectiveTiles.map((objective) => Math.abs(tile.x - objective.x) + Math.abs(tile.y - objective.y)));
  }

  expansionDirections(tile) {
    const rays = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    return rays.filter(([dx, dy]) => {
      for (let distance = 1; distance <= 3; distance += 1) {
        const next = this.tileManager.get(tile.x + dx * distance, tile.y + dy * distance);
        if (next && !config.TILE_TYPES[next.type]?.blocks && this.mainWaterIds.has(next.id)) return true;
      }
      return false;
    }).length;
  }

  minimumDistance(player, other = null) {
    const playable = Math.max(1, this.tileManager.playable().length);
    const count = Math.max(2, this.game.players.length);
    let distance = Math.max(5, Math.min(15, Math.round(Math.sqrt(playable / count) * 0.7)));
    if (player?.teamId && other?.teamId === player.teamId) {
      const style = this.game.matchSettings.teamSpawnStyle || "nearby";
      if (style === "together") distance = Math.max(5, Math.round(distance * 0.62));
      if (style === "nearby") distance = Math.max(5, Math.round(distance * 0.78));
      if (style === "spread") distance = Math.round(distance * 1.18);
    }
    if (this.game.matchSettings.ruleMode === "pondRush") distance = Math.max(4, distance - 2);
    return distance;
  }

  validate(playerId, tileId, options = {}) {
    if (this.game.phase !== spawnConfig.PHASES.SPAWN_SELECTION) return { ok: false, message: "Starting locations are locked." };
    const player = this.game.getPlayer(playerId);
    if (!player || player.removed || player.spectator) return { ok: false, message: "Player is not part of this match." };
    const tile = this.tileManager.getById(Number(tileId));
    if (!tile) return { ok: false, message: "That tile does not exist." };
    const candidate = this.candidateById.get(tile.id) || this.inspectCandidate(tile);
    if (!candidate.valid) return { ok: false, message: candidate.reason };
    const teammateDistances = [];
    for (const [otherId, reservation] of this.reservations.entries()) {
      if (otherId === playerId) continue;
      const otherPlayer = this.game.getPlayer(otherId);
      const otherTile = this.tileManager.getById(reservation.tileId);
      if (!otherTile) continue;
      const distance = Math.hypot(tile.x - otherTile.x, tile.y - otherTile.y);
      if (player.teamId && otherPlayer?.teamId === player.teamId) teammateDistances.push(distance);
      if (distance < this.minimumDistance(player, otherPlayer)) {
        const revealOwner = this.canRevealReservation(player, otherPlayer);
        const ownerLabel = revealOwner ? otherPlayer?.name || "another animal" : "another claimed area";
        return {
          ok: false,
          reason: "tooClose",
          message: `Too close to ${ownerLabel}. Choose a location farther away.`,
          conflictingPlayerId: revealOwner ? otherId : null,
        };
      }
    }
    const teamStyle = this.game.matchSettings.teamSpawnStyle || "nearby";
    if (teammateDistances.length && (teamStyle === "together" || teamStyle === "nearby")) {
      const teammate = this.game.players.find((other) => other.id !== player.id && other.teamId === player.teamId);
      const maxDistance = this.minimumDistance(player, teammate) * (teamStyle === "together" ? 3.2 : 4.8);
      if (Math.min(...teammateDistances) > maxDistance) {
        return { ok: false, message: `Team Spawn Style is ${teamStyle}. Choose water closer to a teammate.` };
      }
    }
    if (options.bot && !this.mainWaterIds.has(tile.id)) return { ok: false, message: "Bot spawn is not connected to the main pond." };
    return { ok: true, candidate, tile, player };
  }

  visibilityMode() {
    return spawnConfig.sanitizeVisibility(
      this.game.matchSettings.enemySpawnVisibility ?? (this.game.matchSettings.secretSpawns ? "hidden" : "visible"),
    );
  }

  canRevealReservation(viewer, owner) {
    if (!viewer || !owner) return false;
    if (viewer.id === owner.id) return true;
    if (viewer.teamId && owner.teamId === viewer.teamId) return true;
    return this.visibilityMode() === "visible" || this.game.phase === spawnConfig.PHASES.PLAYING || this.game.phase === spawnConfig.PHASES.ENDED;
  }

  emitReservationEvent(kind, reservation = {}, extra = {}) {
    this.version += 1;
    const owner = this.game.getPlayer(reservation.playerId || extra.playerId);
    const payload = {
      kind,
      playerId: owner?.id || reservation.playerId || extra.playerId || null,
      playerName: owner?.name || "Claimed Area",
      animal: owner?.animal || null,
      tileId: reservation.tileId ?? extra.tileId ?? null,
      reservationRadius: reservation.reservationRadius ?? this.game.modifierManager?.startingTerritoryRadius?.() ?? spawnConfig.START_RADIUS,
      minimumDistanceRadius: reservation.minimumDistanceRadius ?? this.minimumDistance(owner),
      teamId: owner?.teamId || null,
      confirmed: Boolean(reservation.confirmed),
      version: this.version,
      at: this.game.now(),
      ...extra,
    };
    this.game.pushEvent(payload);
    return payload;
  }

  reserveSpawn(playerId, tileId, options = {}) {
    const current = this.reservations.get(playerId);
    if (current?.confirmed && this.game.matchSettings.lockSpawnOnConfirm && !options.force) {
      return { ok: false, message: "This lobby locks a starting nest after confirmation." };
    }
    const validated = this.validate(playerId, tileId, options);
    if (!validated.ok) {
      this.emitReservationEvent("spawnReservationRejected", { playerId, tileId }, {
        reason: validated.reason || "invalid",
        message: validated.message,
        conflictingPlayerId: validated.conflictingPlayerId || null,
        visibility: "private",
      });
      return { ...validated, version: this.version };
    }
    if (current && current.tileId !== validated.tile.id) this.emitReservationEvent("spawnReleased", current);
    const player = validated.player;
    const reservation = {
      playerId,
      tileId: validated.tile.id,
      confirmed: Boolean(options.confirmed),
      reservedAt: this.game.now(),
      autoAssigned: Boolean(options.autoAssigned),
      reservationRadius: this.game.modifierManager?.startingTerritoryRadius?.() || spawnConfig.START_RADIUS,
      minimumDistanceRadius: this.minimumDistance(player),
    };
    this.reservations.set(playerId, reservation);
    this.emitReservationEvent(reservation.confirmed ? "spawnConfirmed" : "spawnReserved", reservation);
    return {
      ok: true,
      message: options.autoAssigned ? "A starting location was selected automatically." : "Starting nest reserved. Confirm when ready.",
      reservation: { ...reservation },
      version: this.version,
    };
  }

  releaseSpawn(playerId) {
    if (this.game.phase !== spawnConfig.PHASES.SPAWN_SELECTION) return { ok: false, message: "Starting locations are locked." };
    const current = this.reservations.get(playerId);
    if (!current) return { ok: true, message: "Choose a new starting location." };
    if (current.confirmed && this.game.matchSettings.lockSpawnOnConfirm) return { ok: false, message: "This lobby locks confirmed spawns." };
    this.reservations.delete(playerId);
    this.emitReservationEvent("spawnReleased", current);
    return { ok: true, message: "Starting location released. Choose another.", version: this.version };
  }

  confirmSpawn(playerId) {
    const reservation = this.reservations.get(playerId);
    if (!reservation) return { ok: false, message: "Choose a starting water tile first." };
    const validated = this.validate(playerId, reservation.tileId);
    if (!validated.ok) {
      this.reservations.delete(playerId);
      this.emitReservationEvent("spawnReleased", reservation, { reason: validated.reason || "invalid" });
      return validated;
    }
    reservation.confirmed = true;
    reservation.confirmedAt = this.game.now();
    this.emitReservationEvent("spawnConfirmed", reservation);
    this.maybeStartEarly();
    return { ok: true, message: "Starting nest confirmed.", reservation: { ...reservation }, version: this.version };
  }

  randomSpawn(playerId, options = {}) {
    const player = this.game.getPlayer(playerId);
    if (!player) return { ok: false, message: "Player is not part of this match." };
    const ranked = this.candidates
      .map((candidate) => ({ candidate, score: this.playerScore(player, candidate) }))
      .sort((a, b) => b.score - a.score);
    const limit = player.isBot ? (player.difficulty === "easy" ? 36 : player.difficulty === "normal" ? 24 : 12) : 30;
    const pool = ranked.slice(0, limit).filter(({ candidate }) => this.validate(playerId, candidate.tileId, { bot: player.isBot }).ok);
    if (!pool.length) {
      const fallback = ranked.find(({ candidate }) => this.validate(playerId, candidate.tileId, { bot: player.isBot }).ok);
      if (!fallback) return { ok: false, message: "No fair starting area is available." };
      return this.reserveSpawn(playerId, fallback.candidate.tileId, options);
    }
    const spread = player.isBot && player.difficulty === "chaos" ? pool.length : Math.max(4, Math.ceil(pool.length * 0.45));
    const choice = pool[Math.floor(Math.random() * Math.min(pool.length, spread))];
    return this.reserveSpawn(playerId, choice.candidate.tileId, options);
  }

  playerScore(player, candidate) {
    let score = candidate.baseScore;
    if (player.animal === "duck") score += (candidate.type === "water" ? 18 : 0) + candidate.nearby * 0.18;
    if (player.animal === "snake") score += candidate.type === "reeds" || candidate.type === "mud" ? 17 : 0;
    if (player.animal === "frog") score += candidate.type === "lily" ? 20 : candidate.directions * 2;
    if (player.animal === "turtle") score += candidate.type === "mud" ? 16 : Math.max(0, 4 - candidate.directions) * 2;
    if (player.animal === "carp") score += (candidate.type === "water" || candidate.type === "lily" ? 14 : 0) + candidate.nearby * 0.12;
    this.reservations.forEach((reservation, otherId) => {
      if (otherId === player.id) return;
      const other = this.game.getPlayer(otherId);
      const otherTile = this.tileManager.getById(reservation.tileId);
      if (!otherTile) return;
      const distance = Math.hypot(candidate.x - otherTile.x, candidate.y - otherTile.y);
      const sameTeam = Boolean(player.teamId && player.teamId === other?.teamId);
      const style = this.game.matchSettings.teamSpawnStyle || "nearby";
      if (sameTeam && style === "together") score -= Math.abs(distance - this.minimumDistance(player, other) * 1.3) * 2;
      else if (sameTeam && style === "nearby") score -= Math.abs(distance - this.minimumDistance(player, other) * 1.8);
      else score += Math.min(22, distance * 0.7);
    });
    return score + Math.random() * (player.difficulty === "easy" ? 24 : player.difficulty === "normal" ? 13 : 7);
  }

  assignBotSpawns() {
    this.game.players
      .filter((player) => player.isBot && !player.removed)
      .forEach((bot) => {
        const result = this.randomSpawn(bot.id, { confirmed: true, autoAssigned: true });
        if (!result.ok) {
          bot.removed = true;
          bot.defeated = true;
        }
      });
  }

  allHumansConfirmed() {
    const humans = this.game.players.filter((player) => !player.isBot && !player.removed && player.connected !== false);
    return humans.length > 0 && humans.every((player) => this.reservations.get(player.id)?.confirmed);
  }

  maybeStartEarly() {
    if (this.game.matchSettings.startEarlyWhenReady && this.allHumansConfirmed()) this.beginCountdown("Everyone is ready.");
  }

  beginCountdown(message = "Starting locations locked.") {
    if (this.game.phase !== spawnConfig.PHASES.SPAWN_SELECTION) return false;
    this.assignFallbacks();
    this.game.phase = spawnConfig.PHASES.COUNTDOWN;
    this.countdownEndsAt = this.game.now() + spawnConfig.FINAL_COUNTDOWN_SECONDS;
    this.game.pushEvent({ kind: "spawnCountdown", message, countdown: spawnConfig.FINAL_COUNTDOWN_SECONDS, at: this.game.now() });
    return true;
  }

  assignFallbacks() {
    this.game.players
      .filter((player) => !player.removed && !this.reservations.get(player.id)?.confirmed)
      .forEach((player) => {
        const result = this.randomSpawn(player.id, { confirmed: true, autoAssigned: true, force: true });
        if (result.ok) this.autoAssigned.add(player.id);
        else {
          player.removed = true;
          player.defeated = true;
        }
      });
  }

  update() {
    const now = this.game.now();
    if (this.game.phase === spawnConfig.PHASES.SPAWN_SELECTION && this.deadline != null && now >= this.deadline) {
      this.beginCountdown("Spawn selection ended. Unconfirmed animals received a fair location.");
    }
    if (this.game.phase === spawnConfig.PHASES.COUNTDOWN && now >= this.countdownEndsAt) this.activateMatch();
  }

  activateMatch() {
    if (this.game.phase !== spawnConfig.PHASES.COUNTDOWN) return false;
    this.assignFallbacks();
    const radius = this.game.modifierManager?.startingTerritoryRadius?.() || spawnConfig.START_RADIUS;
    this.game.players.forEach((player) => {
      if (player.removed) return;
      const reservation = this.reservations.get(player.id);
      if (!reservation) return;
      this.tileManager.claimStartAt(player, reservation.tileId, this.game.now(), radius);
    });
    this.game.activatePlayingPhase();
    return true;
  }

  handleAction(player, body = {}) {
    if (body.type === "spawnReserve") return this.reserveSpawn(player.id, Number(body.tileId));
    if (body.type === "spawnConfirm") return this.confirmSpawn(player.id);
    if (body.type === "spawnRandom") return this.randomSpawn(player.id);
    if (body.type === "spawnRelease") return this.releaseSpawn(player.id);
    if (body.type === "spawnStartCountdown" && player.isHost) {
      return this.beginCountdown("The host started the final countdown.")
        ? { ok: true, message: "Final countdown started." }
        : { ok: false, message: "The countdown cannot start now." };
    }
    return { ok: false, message: "Choose and confirm a starting nest before playing." };
  }

  snapshot(viewerId, includeCandidates = false) {
    const now = this.game.now();
    const viewer = this.game.getPlayer(viewerId);
    const visibility = this.visibilityMode();
    let hiddenIndex = 0;
    const reservations = [...this.reservations.values()].map((reservation) => {
      const owner = this.game.getPlayer(reservation.playerId);
      const tile = this.tileManager.getById(reservation.tileId);
      const isOwn = reservation.playerId === viewerId;
      const isTeammate = Boolean(!isOwn && viewer?.teamId && owner?.teamId === viewer.teamId);
      const reveal = this.canRevealReservation(viewer, owner);
      const relation = isOwn ? "own" : isTeammate ? "teammate" : owner?.isBot ? "bot" : "enemy";
      const minimumDistanceRadius = this.minimumDistance(viewer || owner, owner);
      if (reveal || visibility === "teamOnly") {
        return {
          ...reservation,
          playerId: reveal ? reservation.playerId : null,
          playerName: reveal ? owner?.name || "Unknown Animal" : "Claimed Area",
          animal: reveal ? owner?.animal || null : null,
          color: reveal ? owner?.color || "#d96b61" : "#d96b61",
          teamId: reveal ? owner?.teamId || null : null,
          isBot: reveal ? Boolean(owner?.isBot) : false,
          anonymous: !reveal,
          relation: reveal ? relation : "enemy",
          minimumDistanceRadius,
        };
      }
      hiddenIndex += 1;
      const maskStep = 6;
      return {
        playerId: null,
        playerName: "Hidden Claimed Area",
        animal: null,
        tileId: null,
        x: tile ? Math.max(0, Math.min(this.tileManager.cols - 1, Math.round(tile.x / maskStep) * maskStep)) : null,
        y: tile ? Math.max(0, Math.min(this.tileManager.rows - 1, Math.round(tile.y / maskStep) * maskStep)) : null,
        maskedId: `hidden-${hiddenIndex}`,
        reservationRadius: Math.max(reservation.reservationRadius || spawnConfig.START_RADIUS, 3),
        minimumDistanceRadius: Math.max(3, minimumDistanceRadius - 2),
        confirmed: reservation.confirmed,
        autoAssigned: reservation.autoAssigned,
        anonymous: true,
        masked: true,
        relation: "enemy",
        color: "#d96b61",
      };
    });
    const own = this.reservations.get(viewerId) || null;
    const readyHumans = this.game.players.filter((player) => !player.isBot && !player.removed && this.reservations.get(player.id)?.confirmed).length;
    const totalHumans = this.game.players.filter((player) => !player.isBot && !player.removed).length;
    const activePlayers = this.game.players.filter((player) => !player.removed && !player.spectator);
    const readyCount = activePlayers.filter((player) => this.reservations.get(player.id)?.confirmed).length;
    const statusRows = activePlayers.map((player, index) => {
      const reservation = this.reservations.get(player.id);
      const reveal = this.canRevealReservation(viewer, player);
      const isOwn = player.id === viewerId;
      const isTeammate = Boolean(!isOwn && viewer?.teamId && player.teamId === viewer.teamId);
      const status =
        player.connected === false
          ? "Disconnected"
          : reservation?.confirmed
            ? "Confirmed"
            : reservation
              ? "Reserved"
              : player.isBot
                ? "Auto Assigning"
                : "Choosing";
      return {
        statusId: reveal ? player.id : `hidden-player-${index}`,
        playerId: reveal ? player.id : null,
        playerName: reveal ? player.name : "Hidden Rival",
        animal: reveal ? player.animal : null,
        color: reveal ? player.color : "#d96b61",
        teamId: reveal ? player.teamId || null : null,
        isBot: reveal ? Boolean(player.isBot) : false,
        isOwn,
        isTeammate,
        anonymous: !reveal,
        status,
      };
    });
    const unavailableCandidateIds = viewer
      ? this.candidates
          .filter((candidate) =>
            [...this.reservations.entries()].some(([otherId, reservation]) => {
              if (otherId === viewerId) return false;
              const owner = this.game.getPlayer(otherId);
              const tile = this.tileManager.getById(reservation.tileId);
              return Boolean(tile && Math.hypot(candidate.x - tile.x, candidate.y - tile.y) < this.minimumDistance(viewer, owner));
            }),
          )
          .map((candidate) => candidate.tileId)
      : [];
    return {
      version: this.version,
      phase: this.game.phase,
      label: spawnConfig.phaseLabel(this.game.phase),
      startedAt: this.startedAt,
      deadline: this.deadline,
      timeLeft:
        this.game.phase === spawnConfig.PHASES.COUNTDOWN
          ? Math.max(0, this.countdownEndsAt - now)
          : this.deadline == null
            ? null
            : Math.max(0, this.deadline - now),
      countdownEndsAt: this.countdownEndsAt,
      startRadius: this.game.modifierManager?.startingTerritoryRadius?.() || spawnConfig.START_RADIUS,
      minimumDistanceRadius: viewer ? this.minimumDistance(viewer) : 6,
      enemyVisibility: visibility,
      readyHumans,
      totalHumans,
      readyCount,
      totalPlayers: activePlayers.length,
      allReady: totalHumans > 0 && readyHumans === totalHumans,
      lockOnConfirm: Boolean(this.game.matchSettings.lockSpawnOnConfirm),
      ownReservation: own ? { ...own } : null,
      reservations,
      statusRows,
      unavailableCandidateIds,
      autoAssigned: this.autoAssigned.has(viewerId),
      candidateIds: includeCandidates ? this.candidates.map((candidate) => candidate.tileId) : undefined,
    };
  }
}

module.exports = SpawnManager;
