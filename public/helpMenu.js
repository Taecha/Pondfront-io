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
          ["Duck", "Fast open-water expansion, slightly higher max energy, and Flock Rush for quick growth."],
          ["Snake", "Strong around reeds and mud. Ambush makes a prepared reed or mud attack hit harder."],
          ["Frog", "Gains extra lily income and can jump short gaps. Big Leap captures nearby neutral clusters."],
          ["Turtle", "Defensive tank. Slower expansion, stronger borders, better Reed Guards, and Shell Guard under pressure."],
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
          "Sending more Animal Energy makes the attack wave stronger.",
          "Enemy defense, terrain, and stored energy can block attacks.",
          "Defended borders cost more to capture.",
          "Right-click an enemy border for quick 10%, 25%, 50%, 75%, and 100% attacks.",
        ]);
      }
      if (tab === "abilities") {
        return cards([
          ["Duck Flock Rush", "One tap. Open-water expansion gets cheaper for a short burst, so use it before claiming big neutral fronts."],
          ["Snake Ambush", "One tap prepares the next reed or mud attack. Strike from the right border to spend the bonus."],
          ["Frog Big Leap", "Tap Ability, then tap a glowing neutral leap target. Big Leap never captures enemy tiles."],
          ["Turtle Shell Guard", "One tap. Turtle borders become much harder to capture for a short defensive window."],
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
          "Control 70% of the playable lake to win instantly.",
          "If the timer ends first, the player with the highest territory wins.",
          "A bigger lake empire gives more income and max energy, but also creates longer borders to defend.",
        ]);
      }
      return list([
        "Expand into neutral pond tiles to gain territory.",
        "Territory gives income and max Animal Energy.",
        "Use Animal Energy to attack, build, defend, and activate abilities.",
        "Right-click tiles for the fastest actions and clear info.",
        "Control 70% of the lake to win.",
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
