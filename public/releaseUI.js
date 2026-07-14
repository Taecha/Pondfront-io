(function initPondReleaseUI(root) {
  class PondReleaseUI {
    constructor() {
      this.release = root.PondRelease;
      this.activeTab = "updates";
      this.nodes = {
        launch: document.querySelector("#launchScreen"),
        launchStatus: document.querySelector("#launchStatus"),
        launchTip: document.querySelector("#launchTip"),
        launchVersion: document.querySelector("#launchVersion"),
        launchMap: document.querySelector("#launchMap"),
        launchMode: document.querySelector("#launchMode"),
        lobbyStatus: document.querySelector("#lobbyServerStatus"),
        lobbyVersion: document.querySelector("#lobbyVersion"),
        newBadge: document.querySelector("#newUpdateBadge"),
        modal: document.querySelector("#releaseModal"),
        title: document.querySelector("#releaseModalTitle"),
        body: document.querySelector("#releaseModalBody"),
        close: document.querySelector("#releaseModalClose"),
        tabs: [...document.querySelectorAll("[data-release-tab]")],
        updates: document.querySelector("#lobbyUpdatesButton"),
        credits: document.querySelector("#lobbyCreditsButton"),
        settings: document.querySelector("#lobbySettingsButton"),
        achievements: document.querySelector("#lobbyAchievementsButton"),
        tutorial: document.querySelector("#lobbyTutorialButton"),
        animals: document.querySelector("#lobbyAnimalButton"),
        coop: document.querySelector("#lobbyCoopButton"),
      };
      if (!this.release) {
        this.finishLoading(false);
        return;
      }
      this.moveGlobalDialogs();
      this.applyReleaseMetadata();
      this.bind();
      this.render();
      this.refreshBadge();
      this.load();
    }

    moveGlobalDialogs() {
      const settings = document.querySelector("#settingsPanel");
      if (settings && settings.parentElement !== document.body) document.body.appendChild(settings);
    }

    applyReleaseMetadata() {
      const current = this.release.CURRENT;
      if (this.nodes.launchVersion) this.nodes.launchVersion.textContent = current.version;
      if (this.nodes.lobbyVersion) this.nodes.lobbyVersion.textContent = `${current.label} - v${current.version}`;
      const map = document.querySelector("#mapSize");
      const mode = document.querySelector("#ruleMode");
      const sync = () => {
        if (this.nodes.launchMap) this.nodes.launchMap.textContent = map?.selectedOptions?.[0]?.textContent || "Medium Lake";
        if (this.nodes.launchMode) this.nodes.launchMode.textContent = mode?.selectedOptions?.[0]?.textContent || "Classic Elimination";
      };
      map?.addEventListener("change", sync);
      mode?.addEventListener("change", sync);
      sync();
    }

    bind() {
      this.nodes.updates?.addEventListener("click", () => this.open("updates"));
      this.nodes.credits?.addEventListener("click", () => this.open("credits"));
      this.nodes.close?.addEventListener("click", () => this.close());
      this.nodes.modal?.addEventListener("click", (event) => {
        if (event.target === this.nodes.modal) this.close();
      });
      this.nodes.tabs.forEach((button) => button.addEventListener("click", () => {
        this.activeTab = button.dataset.releaseTab || "updates";
        this.render();
      }));
      this.nodes.settings?.addEventListener("click", () => {
        document.querySelector("#settingsButton")?.click();
      });
      this.nodes.achievements?.addEventListener("click", () => root.PondProfile?.open("achievements"));
      this.nodes.animals?.addEventListener("click", () => document.querySelector(".animal-select-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      this.nodes.coop?.addEventListener("click", () => {
        const select = document.querySelector("#gameMode");
        if (!select) return;
        select.value = "coop";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector(".match-options")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      this.nodes.tutorial?.addEventListener("click", () => {
        localStorage.removeItem("pondfront:tutorial");
        localStorage.removeItem("pondfront:coachHints");
        const hints = document.querySelector("#showCoachHints");
        if (hints) hints.checked = true;
        document.querySelector("#lobbyHelpButton")?.click();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !this.nodes.modal?.classList.contains("hidden")) this.close();
      });
    }

    async load() {
      this.setTip();
      let online = false;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const response = await fetch("/health", { cache: "no-store", signal: controller.signal });
        clearTimeout(timer);
        const health = response.ok ? await response.json() : null;
        online = Boolean(health?.ok);
        if (health?.version && this.nodes.lobbyVersion) this.nodes.lobbyVersion.textContent = `${health.update || this.release.CURRENT.label} - v${health.version}`;
      } catch {}
      this.finishLoading(online);
    }

    setTip() {
      const tips = this.release.TIPS || [];
      if (!tips.length || !this.nodes.launchTip) return;
      const previous = Number(sessionStorage.getItem("pondfront:last-loading-tip") || -1);
      let index = Math.floor(Math.random() * tips.length);
      if (tips.length > 1 && index === previous) index = (index + 1) % tips.length;
      sessionStorage.setItem("pondfront:last-loading-tip", String(index));
      this.nodes.launchTip.textContent = tips[index];
    }

    finishLoading(online) {
      [this.nodes.launchStatus, this.nodes.lobbyStatus].forEach((node) => {
        if (!node) return;
        node.className = `server-status ${online ? "online" : "offline"}`;
        node.textContent = online ? "Server Online" : "Server Unavailable";
      });
      setTimeout(() => {
        this.nodes.launch?.classList.add("ready");
        setTimeout(() => this.nodes.launch?.classList.add("hidden"), 420);
      }, 620);
    }

    open(tab = "updates") {
      this.activeTab = tab;
      this.nodes.modal?.classList.remove("hidden");
      this.render();
      if (tab === "updates") {
        localStorage.setItem(this.release.VIEWED_STORAGE_KEY, this.release.CURRENT.id);
        this.refreshBadge();
      }
    }

    close() {
      this.nodes.modal?.classList.add("hidden");
    }

    refreshBadge() {
      const viewed = localStorage.getItem(this.release.VIEWED_STORAGE_KEY) === this.release.CURRENT.id;
      this.nodes.newBadge?.classList.toggle("hidden", viewed);
    }

    render() {
      if (!this.nodes.body) return;
      this.nodes.tabs.forEach((button) => button.classList.toggle("active", button.dataset.releaseTab === this.activeTab));
      if (this.activeTab === "credits") {
        this.nodes.title.textContent = "Credits";
        this.nodes.body.innerHTML = `<div class="credits-list">${this.release.CREDITS.map((line) => `<p>${this.escape(line)}</p>`).join("")}</div>`;
        return;
      }
      const entry = this.release.CURRENT;
      this.nodes.title.textContent = `${entry.label} — ${entry.title}`;
      const section = (title, items) => `<section><h3>${title}</h3><ul>${items.map((item) => `<li>${this.escape(item)}</li>`).join("")}</ul></section>`;
      this.nodes.body.innerHTML = `
        <article class="release-entry">
          <div class="release-entry-head"><span class="release-badge">${this.escape(entry.label)}</span><time datetime="${entry.date}">${this.escape(entry.date)}</time><strong>v${this.escape(entry.version)}</strong></div>
          ${section("New", entry.new)}
          ${section("Improved", entry.improved)}
          ${section("Balance", entry.balance)}
          ${section("Fixed", entry.fixed)}
          ${section("Known Issues", entry.knownIssues)}
        </article>`;
    }

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    }
  }

  root.PondReleaseUI = new PondReleaseUI();
})(window);
