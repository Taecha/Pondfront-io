(function initPondHelp(root) {
  const TABS = [
    { id: "basics", label: "Basics" },
    { id: "animals", label: "Animals" },
    { id: "terrain", label: "Terrain" },
    { id: "buildings", label: "Buildings" },
    { id: "combat", label: "Combat" },
    { id: "diplomacy", label: "Diplomacy" },
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
      if (tab === "diplomacy") {
        return list([
          "Alliances stop friendly attacks.",
          "Allies can use pings to request help or mark danger.",
          "You can break alliances later if the board changes.",
          "Right-click another player to request alliance, mark enemy, or send a signal.",
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
