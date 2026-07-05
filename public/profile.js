(function initPondProfile(root) {
  class PondProfileView {
    constructor() {
      this.user = null;
      this.profile = null;
      this.activeTab = "overview";
      this.leaderboard = root.PondGlobalLeaderboard ? new root.PondGlobalLeaderboard({ escape: (value) => this.escape(value) }) : null;
      this.nodes = {
        modal: document.querySelector("#profileModal"),
        close: document.querySelector("#profileCloseButton"),
        guest: document.querySelector("#profileGuestState"),
        content: document.querySelector("#profileContent"),
        username: document.querySelector("#profileUsername"),
        title: document.querySelector("#profileTitle"),
        badgeIcon: document.querySelector("#profileBadgeIcon"),
        level: document.querySelector("#profileLevel"),
        xpBar: document.querySelector("#profileXpBar"),
        xpText: document.querySelector("#profileXpText"),
        tabs: [...document.querySelectorAll("[data-profile-tab]")],
        tabContent: document.querySelector("#profileTabContent"),
      };
      this.bind();
    }

    bind() {
      this.nodes.close?.addEventListener("click", () => this.close());
      this.nodes.modal?.addEventListener("click", (event) => {
        if (event.target === this.nodes.modal) this.close();
      });
      this.nodes.tabs.forEach((button) => {
        button.addEventListener("click", () => {
          this.activeTab = button.dataset.profileTab || "overview";
          this.render();
        });
      });
      this.nodes.tabContent?.addEventListener("click", (event) => this.handleClick(event));
      this.nodes.tabContent?.addEventListener("change", (event) => this.handleChange(event));
    }

    setUser(user) {
      this.user = user || null;
      if (!this.user) this.profile = null;
    }

    async open(tab = this.activeTab || "overview") {
      this.activeTab = tab;
      this.nodes.modal?.classList.remove("hidden");
      await this.load();
    }

    close() {
      this.nodes.modal?.classList.add("hidden");
    }

    async load() {
      if (!this.user) {
        this.profile = null;
        this.render();
        return;
      }
      try {
        const data = await this.request("/api/profile/me");
        this.profile = data.profile;
      } catch (error) {
        this.profile = null;
      }
      this.render();
    }

    render() {
      const profile = this.profile;
      this.nodes.guest?.classList.toggle("hidden", Boolean(profile));
      this.nodes.content?.classList.toggle("hidden", !profile);
      this.nodes.username.textContent = profile?.user?.username || "Guest";
      this.nodes.title.textContent = profile?.user?.selectedTitleLabel || "Create an account to save progress";
      this.nodes.badgeIcon.textContent = profile?.user?.selectedBadgeIcon || "G";
      if (!profile) {
        this.nodes.tabContent.innerHTML = "";
        return;
      }
      const levelInfo = profile.user.levelProgress || { currentXp: 0, nextXp: 1, progress: 0 };
      this.nodes.level.textContent = `Level ${profile.user.level || 1}`;
      this.nodes.xpBar.style.transform = `scaleX(${Math.max(0, Math.min(1, levelInfo.progress || 0))})`;
      this.nodes.xpText.textContent = `${Math.round(levelInfo.currentXp || 0)} / ${Math.round(levelInfo.nextXp || 0)} XP`;
      this.nodes.tabs.forEach((button) => button.classList.toggle("active", button.dataset.profileTab === this.activeTab));
      this.renderTab();
    }

    renderTab() {
      const profile = this.profile;
      if (!profile) return;
      const stats = profile.stats || {};
      const tab = this.activeTab;
      if (tab === "overview") {
        this.nodes.tabContent.innerHTML = `
          <div class="profile-overview-grid">
            ${this.metric("Games", stats.gamesPlayed)}
            ${this.metric("Wins", stats.wins)}
            ${this.metric("Win Rate", `${Math.round((stats.winRate || 0) * 100)}%`)}
            ${this.metric("Favorite", this.animalLabel(stats.favoriteAnimal))}
            ${this.metric("Tiles", stats.totalTilesCaptured)}
            ${this.metric("Biggest Wave", stats.biggestAttackWave)}
          </div>
          <div class="profile-callout">
            <strong>${this.escape(profile.user.selectedBadgeLabel)}</strong>
            <p>${this.escape(profile.user.selectedCosmeticLabel)} equipped. Coins: ${Math.round(profile.user.coins || 0)}</p>
          </div>`;
        return;
      }
      if (tab === "stats") {
        this.nodes.tabContent.innerHTML = `
          <div class="profile-stat-list">
            ${this.row("Games Played", stats.gamesPlayed)}
            ${this.row("Wins", stats.wins)}
            ${this.row("Losses", stats.losses)}
            ${this.row("Eliminations", stats.eliminations)}
            ${this.row("Energy Spent", stats.totalEnergySpent)}
            ${this.row("Energy Generated", stats.totalEnergyGenerated)}
            ${this.row("Buildings Built", stats.totalBuildingsBuilt)}
            ${this.row("Building Upgrades", stats.totalBuildingUpgrades)}
            ${this.row("Objectives Captured", stats.totalObjectivesCaptured)}
            ${this.row("Longest Survival", this.formatTime(stats.longestSurvivalTime || 0))}
          </div>`;
        return;
      }
      if (tab === "animals") {
        this.nodes.tabContent.innerHTML = `<div class="animal-stat-grid">${profile.animals
          .map(
            (animal) => {
              const visual = this.visualFor(animal.animal);
              return `<article>
              <span class="animal-disc animal-visual-disc ${this.escape(animal.animal)}" style="--animal-color:${this.escape(visual.badge || "#83dced")};--animal-accent:${this.escape(visual.accent || "#edf8fb")}">${this.escape(visual.short || animal.icon)}</span>
              <strong>${this.escape(animal.label)}</strong>
              <small>${this.escape(visual.role || "Pond strategy")} | ${this.escape(visual.terrain || "Mixed pond")}</small>
              <small>${animal.gamesPlayed} games | ${animal.wins} wins | ${Math.round((animal.highestTerritoryPercent || 0) * 10) / 10}% best</small>
            </article>`;
            },
          )
          .join("")}</div>`;
        return;
      }
      if (tab === "achievements") {
        this.nodes.tabContent.innerHTML = root.PondAchievementView?.render(profile, (value) => this.escape(value)) || "";
        return;
      }
      if (tab === "history") {
        this.nodes.tabContent.innerHTML = `
          <div class="match-history-list">${
            profile.recentMatches
              .map(
                (match) => `<article>
                  <strong>${match.result === "win" ? "Victory" : "Defeat"} as ${this.animalLabel(match.animal)}</strong>
                  <small>#${match.rank} | ${match.territoryPercent}% territory | ${match.tilesCaptured} tiles | ${this.formatTime(match.matchDuration)}</small>
                  <em>+${match.xpGained || 0} XP / +${match.coinsGained || 0} coins</em>
                </article>`,
              )
              .join("") || `<p class="profile-empty">No saved matches yet.</p>`
          }</div>`;
        return;
      }
      if (tab === "cosmetics") {
        this.nodes.tabContent.innerHTML = `
          <div class="cosmetic-section">
            <h3>Badges</h3>
            <div class="unlock-grid">${profile.badges.map((badge) => this.unlockButton("badge", badge.id, badge.label, badge.icon, badge.unlocked, badge.selected)).join("")}</div>
            <h3>Titles</h3>
            <div class="unlock-grid">${profile.titles.map((title) => this.unlockButton("title", title.id, title.label, `L${title.unlockLevel}`, title.unlocked, title.selected)).join("")}</div>
            <h3>Cosmetics</h3>
            <div class="unlock-grid">${profile.cosmetics.map((cosmetic) => this.unlockButton("cosmetic", cosmetic.id, cosmetic.label, "", cosmetic.unlocked, cosmetic.selected)).join("")}</div>
            <h3>Global Leaderboard</h3>
            <div id="globalLeaderboardMount" class="profile-loading">Loading leaderboard...</div>
          </div>`;
        this.renderLeaderboard();
      }
    }

    async renderLeaderboard(category = "highestLevel") {
      const mount = document.querySelector("#globalLeaderboardMount");
      if (!mount || !this.leaderboard) return;
      try {
        mount.innerHTML = await this.leaderboard.render(category);
      } catch {
        mount.innerHTML = `<p class="profile-empty">Could not load leaderboard.</p>`;
      }
    }

    handleClick(event) {
      const button = event.target.closest?.("[data-select-kind]");
      if (!button || button.disabled) return;
      const kind = button.dataset.selectKind;
      const id = button.dataset.selectId;
      const path =
        kind === "badge"
          ? "/api/profile/select-badge"
          : kind === "title"
            ? "/api/profile/select-title"
            : "/api/profile/select-cosmetic";
      const key = kind === "badge" ? "badgeId" : kind === "title" ? "titleId" : "cosmeticId";
      this.request(path, { method: "POST", body: JSON.stringify({ [key]: id }) })
        .then((data) => {
          this.profile = data.profile;
          this.render();
          window.dispatchEvent(new CustomEvent("pond:profile-updated", { detail: data.profile }));
        })
        .catch(() => {});
    }

    handleChange(event) {
      const select = event.target.closest?.("[data-global-leaderboard-category]");
      if (select) this.renderLeaderboard(select.value);
    }

    unlockButton(kind, id, label, icon, unlocked, selected) {
      return `<button data-select-kind="${this.escape(kind)}" data-select-id="${this.escape(id)}" ${unlocked ? "" : "disabled"} class="${selected ? "selected" : ""}" type="button">
        <span>${this.escape(icon || (selected ? "OK" : ""))}</span>
        <strong>${this.escape(label)}</strong>
        <small>${selected ? "Selected" : unlocked ? "Unlocked" : "Locked"}</small>
      </button>`;
    }

    metric(label, value) {
      return `<article><span>${this.escape(label)}</span><strong>${this.escape(value ?? 0)}</strong></article>`;
    }

    row(label, value) {
      return `<div><span>${this.escape(label)}</span><strong>${this.escape(value ?? 0)}</strong></div>`;
    }

    animalLabel(animal) {
      return root.PondAnimals?.[animal]?.label || animal || "Duck";
    }

    visualFor(animal) {
      return root.PondAnimalVisuals?.animals?.[animal] || {
        short: root.PondAnimals?.[animal]?.icon || "A",
        badge: root.PondAnimals?.[animal]?.color || "#83dced",
        accent: "#edf8fb",
        role: root.PondAnimals?.[animal]?.ability || "Pond strategy",
        terrain: "Mixed pond",
      };
    }

    formatTime(seconds) {
      const safe = Math.max(0, Math.floor(Number(seconds) || 0));
      const mins = Math.floor(safe / 60);
      const secs = String(safe % 60).padStart(2, "0");
      return `${mins}:${secs}`;
    }

    async request(path, options = {}) {
      const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Connection error.");
      return data;
    }

    escape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  }

  root.PondProfileView = PondProfileView;
})(window);
