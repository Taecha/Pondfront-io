import { ANIMALS, BUILDINGS, TILE_TYPES } from "./config.js";

export class UIManager {
  constructor(game) {
    this.game = game;
    this.selectedAnimal = "duck";
    this.longPressTimer = null;
    this.pointer = {
      down: false,
      dragging: false,
      longPressed: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      pointerId: null,
    };

    this.nodes = {
      startScreen: document.querySelector("#startScreen"),
      gameScreen: document.querySelector("#gameScreen"),
      startGame: document.querySelector("#startGame"),
      restartGame: document.querySelector("#restartGame"),
      animalCards: [...document.querySelectorAll(".animal-card")],
      difficulty: document.querySelector("#difficulty"),
      practiceMode: document.querySelector("#practiceMode"),
      canvas: document.querySelector("#gameCanvas"),
      miniMap: document.querySelector("#miniMap"),
      energyStat: document.querySelector("#energyStat"),
      territoryStat: document.querySelector("#territoryStat"),
      controlFill: document.querySelector("#controlFill"),
      incomeStat: document.querySelector("#incomeStat"),
      animalStat: document.querySelector("#animalStat"),
      abilityName: document.querySelector("#abilityName"),
      cooldownFill: document.querySelector("#cooldownFill"),
      cooldownText: document.querySelector("#cooldownText"),
      tilePanel: document.querySelector(".tile-panel"),
      tileTypeInfo: document.querySelector("#tileTypeInfo"),
      tileOwnerInfo: document.querySelector("#tileOwnerInfo"),
      tileIncomeInfo: document.querySelector("#tileIncomeInfo"),
      tileDefenseInfo: document.querySelector("#tileDefenseInfo"),
      selectedCount: document.querySelector("#selectedCount"),
      sendButtons: [...document.querySelectorAll("[data-send]")],
      defendButton: document.querySelector("#defendButton"),
      buildButton: document.querySelector("#buildButton"),
      abilityButton: document.querySelector("#abilityButton"),
      buildPanel: document.querySelector("#buildPanel"),
      buildButtons: [...document.querySelectorAll("[data-building]")],
      leaderboard: document.querySelector("#leaderboard"),
      toast: document.querySelector("#toast"),
      radialMenu: document.querySelector("#radialMenu"),
      result: document.querySelector("#matchResult"),
      resultTitle: document.querySelector("#resultTitle"),
      resultText: document.querySelector("#resultText"),
    };
  }

  bind() {
    this.nodes.animalCards.forEach((card) => {
      card.addEventListener("click", () => this.chooseAnimal(card.dataset.animal));
    });

    this.nodes.startGame.addEventListener("click", () => {
      this.nodes.startScreen.classList.add("hidden");
      this.nodes.gameScreen.classList.remove("hidden");
      this.game.start({
        animal: this.selectedAnimal,
        difficulty: this.nodes.difficulty.value,
        practice: this.nodes.practiceMode.checked,
      });
    });

    this.nodes.restartGame.addEventListener("click", () => {
      this.nodes.result.classList.add("hidden");
      this.nodes.startScreen.classList.remove("hidden");
      this.nodes.gameScreen.classList.add("hidden");
      this.game.stop();
    });

    this.nodes.sendButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.nodes.sendButtons.forEach((candidate) => candidate.classList.remove("active"));
        button.classList.add("active");
        this.game.sendPercent = Number(button.dataset.send);
      });
    });

    this.nodes.defendButton.addEventListener("click", () => {
      this.game.toggleDefendMode();
      this.syncModeButtons();
    });

    this.nodes.buildButton.addEventListener("click", () => {
      this.game.toggleBuildMode();
      this.syncModeButtons();
    });

    this.nodes.abilityButton.addEventListener("click", () => {
      const result = this.game.useAbility();
      this.toast(result.reason);
    });

    this.nodes.buildButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.game.selectedBuilding = button.dataset.building;
        this.nodes.buildButtons.forEach((candidate) => candidate.classList.remove("active"));
        button.classList.add("active");
      });
    });

    this.nodes.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.nodes.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.nodes.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.nodes.canvas.addEventListener("pointercancel", () => this.cancelPointer());
    this.nodes.canvas.addEventListener("pointerleave", () => {
      this.game.hoverTile = null;
      this.nodes.canvas.style.cursor = "default";
    });
    this.nodes.canvas.addEventListener("contextmenu", (event) => this.onContextMenu(event));
    window.addEventListener("click", (event) => {
      if (!this.nodes.radialMenu.contains(event.target)) this.closeRadialMenu();
    });

    this.nodes.radialMenu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      this.game.handleDiplomacy(button.dataset.action);
      this.closeRadialMenu();
    });

    window.addEventListener("resize", () => this.game.resize());
  }

  chooseAnimal(animal) {
    this.selectedAnimal = animal;
    this.nodes.animalCards.forEach((card) => {
      card.classList.toggle("selected", card.dataset.animal === animal);
    });
  }

  onPointerDown(event) {
    if (event.button === 2) return;
    const pos = this.getCanvasPoint(event);
    this.game.hoverTile = this.game.tileFromCanvas(pos.x, pos.y);
    this.pointer = {
      down: true,
      dragging: false,
      longPressed: false,
      startX: pos.x,
      startY: pos.y,
      x: pos.x,
      y: pos.y,
      pointerId: event.pointerId,
    };
    this.nodes.canvas.setPointerCapture(event.pointerId);
    this.closeRadialMenu();

    clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      if (!this.pointer.down || this.pointer.dragging) return;
      const tile = this.game.tileFromCanvas(pos.x, pos.y);
      if (tile?.owner && tile.owner !== this.game.humanId) {
        this.pointer.longPressed = true;
        this.openRadialMenu(pos.x, pos.y, tile);
      }
    }, 560);
  }

  onPointerMove(event) {
    const pos = this.getCanvasPoint(event);
    this.game.hoverTile = this.game.tileFromCanvas(pos.x, pos.y);
    this.syncCanvasCursor(this.game.hoverTile);
    if (!this.pointer.down) return;
    this.pointer.x = pos.x;
    this.pointer.y = pos.y;

    const dx = Math.abs(pos.x - this.pointer.startX);
    const dy = Math.abs(pos.y - this.pointer.startY);
    if (dx + dy > 12) {
      this.pointer.dragging = true;
      clearTimeout(this.longPressTimer);
      this.game.dragRect = {
        x1: this.pointer.startX,
        y1: this.pointer.startY,
        x2: pos.x,
        y2: pos.y,
      };
      this.game.selectBordersInRect(this.game.dragRect);
    }
  }

  onPointerUp(event) {
    clearTimeout(this.longPressTimer);
    if (!this.pointer.down) return;
    const pos = this.getCanvasPoint(event);
    const wasDragging = this.pointer.dragging;
    const wasLongPressed = this.pointer.longPressed;
    this.cancelPointer();

    if (wasDragging || wasLongPressed) {
      this.game.dragRect = null;
      return;
    }

    const tile = this.game.tileFromCanvas(pos.x, pos.y);
    if (!tile) return;
    const result = this.game.handleTileClick(tile);
    if (result?.reason) this.toast(result.reason);
  }

  cancelPointer() {
    clearTimeout(this.longPressTimer);
    this.pointer.down = false;
    this.pointer.dragging = false;
    this.pointer.longPressed = false;
    this.game.dragRect = null;
  }

  onContextMenu(event) {
    event.preventDefault();
    const pos = this.getCanvasPoint(event);
    const tile = this.game.tileFromCanvas(pos.x, pos.y);
    if (tile?.owner && tile.owner !== this.game.humanId) {
      this.openRadialMenu(pos.x, pos.y, tile);
    }
  }

  openRadialMenu(x, y, tile) {
    this.game.diplomacyTarget = tile.owner;
    const menu = this.nodes.radialMenu;
    menu.style.left = `${Math.max(6, Math.min(x, this.nodes.canvas.clientWidth - 190))}px`;
    menu.style.top = `${Math.max(6, Math.min(y, this.nodes.canvas.clientHeight - 110))}px`;
    menu.classList.remove("hidden");
  }

  closeRadialMenu() {
    this.nodes.radialMenu.classList.add("hidden");
  }

  getCanvasPoint(event) {
    const rect = this.nodes.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  update() {
    const player = this.game.getHuman();
    if (!player) return;

    this.nodes.energyStat.textContent = `${Math.floor(player.energy)} / ${Math.floor(player.maxEnergy)}`;
    const territoryPercent = this.game.getTerritoryPercent(player);
    this.nodes.territoryStat.textContent = `${Math.round(territoryPercent * 100)}%`;
    this.nodes.controlFill.style.transform = `scaleX(${Math.max(0, Math.min(1, territoryPercent / 0.7))})`;
    this.nodes.incomeStat.textContent = `+${player.income.toFixed(1)}/s`;
    this.nodes.animalStat.textContent = ANIMALS[player.animal].label;
    this.nodes.abilityName.textContent = ANIMALS[player.animal].ability;
    this.nodes.selectedCount.textContent = String(this.game.selectedTiles.length);

    const cooldownLeft = Math.max(0, player.abilityReadyAt - this.game.time);
    const cooldownTotal = ANIMALS[player.animal].abilityCooldown;
    const readyRatio = cooldownLeft <= 0 ? 1 : 1 - cooldownLeft / cooldownTotal;
    this.nodes.cooldownFill.style.transform = `scaleX(${Math.max(0, Math.min(1, readyRatio))})`;
    this.nodes.cooldownText.textContent =
      cooldownLeft <= 0 ? "Ready" : `${Math.ceil(cooldownLeft)}s`;
    this.nodes.abilityButton.disabled = cooldownLeft > 0;

    this.syncBuildButtons(player);
    this.syncModeButtons();
    this.updateTilePanel(player);
    this.updateLeaderboard();
  }

  syncModeButtons() {
    this.nodes.defendButton.classList.toggle("active", this.game.mode === "defend");
    this.nodes.buildButton.classList.toggle("active", this.game.mode === "build");
    this.nodes.buildPanel.classList.toggle("hidden", this.game.mode !== "build");
  }

  syncBuildButtons(player) {
    this.nodes.buildButtons.forEach((button) => {
      const building = BUILDINGS[button.dataset.building];
      const animalAllowed = !building.animal || building.animal === player.animal;
      const affordable = player.energy >= building.cost;
      button.disabled = !animalAllowed || !affordable;
      button.textContent = `${building.label} ${building.cost}`;
    });
  }

  updateLeaderboard() {
    const leaders = this.game.players
      .filter((player) => !player.defeated)
      .slice()
      .sort((a, b) => b.territory - a.territory)
      .slice(0, 6);
    this.nodes.leaderboard.innerHTML = leaders
      .map((player) => {
        const pct = Math.round(this.game.getTerritoryPercent(player) * 100);
        const name = player.id === this.game.humanId ? "You" : player.name;
        return `<li><span style="color:${player.color}">${name}</span> ${pct}%</li>`;
      })
      .join("");
  }

  updateTilePanel(player) {
    const tile = this.game.hoverTile ?? this.game.lastActionTile ?? this.game.tileManager.getOwnedTiles(player.id)[0];
    if (!tile) return;

    const type = TILE_TYPES[tile.type];
    const owner = this.game.getPlayer(tile.owner);
    const actionKind = this.game.getTileActionKind(tile, player);
    const ownerText = owner
      ? owner.id === this.game.humanId
        ? "Your pond"
        : this.game.areAllied(player.id, owner.id)
          ? `${owner.name} ally`
          : `${owner.name} front`
      : type.blocks
        ? "Blocked"
        : "Neutral pond";

    this.nodes.tileTypeInfo.textContent = type.label;
    this.nodes.tileOwnerInfo.textContent = ownerText;
    this.nodes.tileIncomeInfo.textContent = `Inc +${(type.incomeBonus + this.game.animalManager.getIncomeBonus(player, tile)).toFixed(1)}`;
    this.nodes.tileDefenseInfo.textContent = `Def ${type.defenseBonus >= 900 ? "Block" : `+${type.defenseBonus}`}`;
    this.nodes.tilePanel.dataset.action = actionKind;
  }

  syncCanvasCursor(tile) {
    const kind = this.game.getTileActionKind(tile);
    this.nodes.canvas.style.cursor = ["expand", "attack", "build", "defend"].includes(kind)
      ? "pointer"
      : "default";
  }

  showResult(winner, timedOut = false) {
    const humanWon = winner?.id === this.game.humanId;
    this.nodes.resultTitle.textContent = humanWon ? "Pond Secured" : "Pond Claimed";
    const label = winner ? `${winner.name} the ${ANIMALS[winner.animal].label}` : "No one";
    this.nodes.resultText.textContent = timedOut
      ? `${label} held the largest territory when the reeds settled.`
      : `${label} controls 70% of the lake.`;
    this.nodes.result.classList.remove("hidden");
  }

  toast(message) {
    if (!message) return;
    clearTimeout(this.toastTimer);
    this.nodes.toast.textContent = message;
    this.nodes.toast.classList.remove("hidden");
    this.toastTimer = setTimeout(() => this.nodes.toast.classList.add("hidden"), 1700);
  }
}
