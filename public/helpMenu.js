(function initPondHelp(root) {
  const TABS = [
    { id: "basics", label: "Basics" },
    { id: "animals", label: "Animals" },
    { id: "terrain", label: "Terrain" },
    { id: "buildings", label: "Buildings" },
    { id: "combat", label: "Combat" },
    { id: "abilities", label: "Abilities" },
    { id: "diplomacy", label: "Diplomacy" },
    { id: "objectives", label: "Objectives" },
    { id: "mobile", label: "Mobile" },
    { id: "winning", label: "Winning" },
  ];

  class PondHelpMenu {
    constructor(button) {
      this.active = "basics";
      this.el = document.createElement("section");
      this.el.className = "help-modal hidden";
      this.el.setAttribute("aria-modal", "true");
      this.el.setAttribute("role", "dialog");
      document.body.appendChild(this.el);
      button?.addEventListener("click", () => this.open());
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.close();
      });
      this.el.addEventListener("click", (event) => {
        if (event.target === this.el || event.target.closest("[data-help-close]")) this.close();
        const tab = event.target.closest("[data-help-tab]");
        if (tab) {
          this.active = tab.dataset.helpTab;
          this.render();
        }
      });
    }

    open(tab = this.active) {
      this.active = tab;
      this.render();
      this.el.classList.remove("hidden");
    }

    close() {
      this.el.classList.add("hidden");
    }

    render() {
      this.el.innerHTML = `<div class="help-card">
        <header>
          <div>
            <span class="label">Pond Guide</span>
            <h2>How to Control the Lake</h2>
          </div>
          <button data-help-close class="icon-button" aria-label="Close help">X</button>
        </header>
        <nav class="help-tabs">
          ${TABS.map((tab) => `<button data-help-tab="${tab.id}" class="${tab.id === this.active ? "active" : ""}">${tab.label}</button>`).join("")}
        </nav>
        <div class="help-content">${this.content(this.active)}</div>
      </div>`;
    }

    content(tab) {
      if (tab === "animals") {
        return cards([
          ["Duck", "Fast open-water expansion, slightly higher max energy, and efficient open-water bite attacks."],
          ["Snake", "Strong around reeds and mud. Ambush makes prepared attacks crack fortified borders harder."],
          ["Frog", "Gains extra lily income and can jump short gaps. Big Leap captures nearby neutral clusters."],
          ["Turtle", "Defensive tank. Slower expansion, stronger borders, better Reed Guards, and Shell Guard that slows attacks without making borders untouchable."],
          ["Carp", "Economy scaler. Better water and lily income, cheaper Lily Farms, and Golden Current for growth pushes."],
        ]);
      }
      if (tab === "terrain") {
        return cards([
          ["Open Water", root.PondInfo?.TIPS.water],
          ["Lily Pad", root.PondInfo?.TIPS.lily],
          ["Reeds", root.PondInfo?.TIPS.reeds],
          ["Mud Island", root.PondInfo?.TIPS.mud],
          ["Rock", root.PondInfo?.TIPS.rock],
        ]);
      }
      if (tab === "buildings") {
        return cards([
          ["Nest", root.PondInfo?.TIPS.nest],
          ["Lily Farm", root.PondInfo?.TIPS.lilyFarm],
          ["Reed Guard", root.PondInfo?.TIPS.reedGuard],
          ["Mud Tunnel", root.PondInfo?.TIPS.mudTunnel],
          ["Jump Pad", root.PondInfo?.TIPS.jumpPad],
        ]);
      }
      if (tab === "combat") {
        return list([
          "You can only attack connected enemy borders.",
          "Attacks commit Animal Energy once, then the wave pushes automatically until spent.",
          "Sending more Animal Energy makes the committed wave stronger but leaves you more vulnerable.",
          "Enemy defense, terrain, and stored energy can slow attacks, but blocked hits now leave pressure for your next push.",
          "Use Bite 25% to weaken, Push 50% to break normal fronts, and Wave 75%+ to roll through a soft border.",
          "Specials are expensive pond tactics: Lily Barrage weakens a small enemy area, Dragonfly Guard reduces Lily Barrage and Current Push, and Reed Shield slows normal attack waves.",
          "Every special has counterplay. Reinforce, spread out, shield the border, or attack somewhere else while the defender spends energy.",
          "Defended borders cost more to capture.",
          "Right-click or tap an enemy border for Bite, Push, Wave, and Max attacks.",
        ]);
      }
      if (tab === "abilities") {
        return cards([
          ["Duck Flock Rush", "One tap. Open-water expansion gets cheaper for a short burst, and water attacks stay efficient for opening fights."],
          ["Snake Ambush", "One tap prepares the next reed or mud attack. Use it to break reinforced enemy fronts with a Push or Wave."],
          ["Frog Big Leap", "Tap Ability, then tap a glowing neutral leap target. Big Leap never captures enemy tiles."],
          ["Turtle Shell Guard", "One tap. Turtle borders become harder to capture for a short defensive window, but repeated attacks still build pressure."],
          ["Carp Golden Current", "One tap. Income rises and water or lily expansion becomes cheaper for a short economy surge."],
        ]);
      }
      if (tab === "diplomacy") {
        return list([
          "Alliances stop friendly attacks and unlock private ally pings.",
          "Alliance requests expire if they are not accepted.",
          "Truces temporarily block attacks without making players allies.",
          "Breaking an alliance creates betrayal cooldown before the betrayer can attack.",
          "Right-click or long-press another player to request alliance, offer truce, declare war, mark enemy, or ping.",
        ]);
      }
      if (tab === "objectives") {
        return cards([
          ["Lake Objectives", "Timed map goals that give strong economy, defense, or cooldown bonuses while you hold them."],
          ["Critter Camps", "Neutral camps are optional fights that grant temporary attack, defense, income, or scouting power."],
          ["Minimap", "Objectives and camps appear as clean markers on the minimap so you can pan there quickly."],
        ]);
      }
      if (tab === "mobile") {
        return list([
          "One finger drags the camera; two fingers pinch to zoom.",
          "Double tap a valid border target to quick expand, attack, or defend.",
          "Long press a territory tile to open combat and diplomacy actions.",
          "Long press an ally to ping help, danger, attack, or defend.",
          "Tap the minimap or drag on it to jump the camera.",
          "Use the bottom action card for the clearest next command.",
        ]);
      }
      if (tab === "winning") {
        return list([
          "Normal matches use elimination: win when only one animal or team remains.",
          "The timer shows elapsed time and does not force a timeout ending.",
          "Territory control is an optional server mode, not the default win condition.",
          "A bigger lake empire gives more income and max energy, but also creates longer borders to defend.",
        ]);
      }
      return list([
        "Expand into neutral pond tiles to gain territory.",
        "Territory gives income and max Animal Energy.",
        "Use Animal Energy to attack, build, defend, and activate abilities.",
        "Right-click tiles for the fastest actions and clear info.",
        "Eliminate rivals until one animal or team remains.",
      ]);
    }
  }

  function list(items) {
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function cards(items) {
    return `<div class="help-grid">${items
      .map(([title, body]) => `<article><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body || "")}</p></article>`)
      .join("")}</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  root.PondHelpMenu = PondHelpMenu;
})(window);
