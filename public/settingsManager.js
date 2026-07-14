(function initPondSettingsManager(root) {
  class PondSettingsManager {
    constructor(ui) {
      this.ui = ui;
      this.config = root.PondSettingsConfig;
      this.panel = ui.nodes.settingsPanel;
      this.form = document.querySelector("#settingsForm");
      this.search = document.querySelector("#settingsSearch");
      this.navButtons = [...document.querySelectorAll("[data-settings-nav]")];
      this.categorySelect = document.querySelector("#settingsCategorySelect");
      this.pages = [...document.querySelectorAll("[data-settings-page]")];
      this.applyButton = document.querySelector("#settingsApplyButton");
      this.cancelButton = document.querySelector("#settingsCancelButton");
      this.restoreButton = document.querySelector("#settingsRestoreButton");
      this.resetCategoryButton = document.querySelector("#settingsResetCategoryButton");
      this.exportButton = document.querySelector("#settingsExportButton");
      this.importButton = document.querySelector("#settingsImportButton");
      this.importInput = document.querySelector("#settingsImportInput");
      this.dirtyStatus = document.querySelector("#settingsDirtyStatus");
      this.activeCategory = "gameplay";
      this.applied = this.load();
      this.draft = { ...this.applied };
      this.writeControls(this.applied);
      this.applyRuntime(this.applied, { initial: true });
      this.bind();
      this.showCategory(this.activeCategory);
    }

    control(key) {
      return this.form?.elements?.namedItem(key) || document.getElementById(key);
    }

    load() {
      const raw = localStorage.getItem(this.config.STORAGE_KEY);
      if (raw) return this.config.parseDocument(raw).values;
      const migrated = { ...this.config.DEFAULTS };
      Object.entries(this.config.LEGACY_KEYS).forEach(([key, storageKey]) => {
        const value = localStorage.getItem(storageKey);
        if (value != null) migrated[key] = value;
      });
      migrated.mobileVibration = localStorage.getItem("pondfront:mobile-vibration") !== "off";
      migrated.batterySaver = localStorage.getItem("pondfront:battery-saver") === "on";
      migrated.showCoachHints = localStorage.getItem("pondfront:coachHints") !== "off";
      const audio = this.ui.audio?.settings || {};
      Object.keys(audio).forEach((key) => {
        const mapped = key === "muted" ? "muteAll" : key;
        if (mapped in migrated) migrated[mapped] = audio[key];
      });
      const values = this.config.sanitize(migrated);
      this.persist(values);
      return values;
    }

    persist(values) {
      localStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(this.config.documentFor(values)));
    }

    bind() {
      this.navButtons.forEach((button) => button.addEventListener("click", () => this.showCategory(button.dataset.settingsNav)));
      this.categorySelect?.addEventListener("change", () => this.showCategory(this.categorySelect.value));
      this.search?.addEventListener("input", () => this.filter(this.search.value));
      this.form?.addEventListener("input", (event) => {
        if (!event.target.matches("input, select")) return;
        if (event.target.id === "visualPreset") this.applyPresetToDraft(event.target.value);
        this.draft = this.readControls();
        this.updateRangeOutput(event.target);
        this.updateDirty();
      });
      this.applyButton?.addEventListener("click", () => this.apply());
      this.cancelButton?.addEventListener("click", () => this.cancel());
      this.restoreButton?.addEventListener("click", () => this.restoreDefaults());
      this.resetCategoryButton?.addEventListener("click", () => this.resetCategory());
      this.exportButton?.addEventListener("click", () => this.exportSettings());
      this.importButton?.addEventListener("click", () => this.importInput?.click());
      this.importInput?.addEventListener("change", () => this.importSettings());
      this.form?.querySelectorAll("input[type='range']").forEach((node) => this.updateRangeOutput(node));
    }

    open() {
      this.draft = { ...this.applied };
      this.writeControls(this.draft);
      this.filter("");
      if (this.search) this.search.value = "";
      this.updateDirty();
      setTimeout(() => this.search?.focus(), 30);
    }

    closeWithCancel() {
      this.cancel(true);
    }

    apply() {
      this.draft = this.readControls();
      this.applied = { ...this.draft };
      this.persist(this.applied);
      this.applyRuntime(this.applied);
      this.updateDirty();
      this.ui.audio?.play("confirm", { ui: true, cooldown: 0 });
      this.ui.toast("Settings applied.");
      this.ui.hideSettingsPanel();
    }

    cancel(close = true) {
      this.draft = { ...this.applied };
      this.writeControls(this.applied);
      this.updateDirty();
      if (close) this.ui.hideSettingsPanel();
    }

    restoreDefaults() {
      if (!window.confirm("Restore every PondFront setting to its default value?")) return;
      this.draft = { ...this.config.DEFAULTS };
      this.writeControls(this.draft);
      this.updateDirty();
    }

    resetCategory() {
      const page = this.pages.find((entry) => entry.dataset.settingsPage === this.activeCategory);
      page?.querySelectorAll("[name]").forEach((node) => {
        const key = node.name;
        if (key in this.config.DEFAULTS) this.writeControl(node, this.config.DEFAULTS[key]);
      });
      this.draft = this.readControls();
      this.updateDirty();
    }

    showCategory(category) {
      const next = this.config.CATEGORIES.includes(category) ? category : "gameplay";
      this.activeCategory = next;
      this.navButtons.forEach((button) => {
        const active = button.dataset.settingsNav === next;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      if (this.categorySelect) this.categorySelect.value = next;
      this.pages.forEach((page) => page.classList.toggle("active", page.dataset.settingsPage === next));
      document.querySelector("#settingsScroll")?.scrollTo({ top: 0, behavior: "instant" });
    }

    filter(query) {
      const term = String(query || "").trim().toLowerCase();
      document.body.classList.toggle("settings-searching", Boolean(term));
      let firstMatch = null;
      this.pages.forEach((page) => {
        let matches = 0;
        page.querySelectorAll(".setting-row").forEach((row) => {
          const visible = !term || row.textContent.toLowerCase().includes(term) || String(row.dataset.search || "").toLowerCase().includes(term);
          row.classList.toggle("search-hidden", !visible);
          if (visible && term) matches += 1;
        });
        page.classList.toggle("search-match", Boolean(term && matches));
        if (matches && !firstMatch) firstMatch = page.dataset.settingsPage;
      });
      if (term && firstMatch) this.showCategory(firstMatch);
    }

    applyPresetToDraft(preset) {
      const values = this.config.PRESETS[preset];
      if (!values) return;
      Object.entries(values).forEach(([key, value]) => this.writeControl(this.control(key), value));
    }

    readControls() {
      const values = { ...this.config.DEFAULTS };
      Object.keys(values).forEach((key) => {
        const node = this.control(key);
        if (!node) return;
        values[key] = node.type === "checkbox" ? node.checked : node.type === "range" ? Number(node.value) : node.value;
      });
      return this.config.sanitize(values);
    }

    writeControls(values) {
      Object.entries(this.config.sanitize(values)).forEach(([key, value]) => this.writeControl(this.control(key), value));
      this.form?.querySelectorAll("input[type='range']").forEach((node) => this.updateRangeOutput(node));
    }

    writeControl(node, value) {
      if (!node) return;
      if (node.type === "checkbox") node.checked = Boolean(value);
      else node.value = String(value);
    }

    updateRangeOutput(node) {
      if (!node?.id || node.type !== "range") return;
      const output = document.querySelector(`[data-setting-value-for="${node.id}"]`);
      if (!output) return;
      output.textContent = node.id === "cameraSensitivity" ? `${Math.round(Number(node.value) * 100)}%` : `${Math.round(Number(node.value) * 100)}%`;
    }

    updateDirty() {
      const dirty = JSON.stringify(this.config.sanitize(this.draft)) !== JSON.stringify(this.config.sanitize(this.applied));
      this.panel?.classList.toggle("settings-dirty", dirty);
      if (this.dirtyStatus) this.dirtyStatus.textContent = dirty ? "Unsaved changes" : "All changes saved";
    }

    applyRuntime(values, options = {}) {
      this.writeControls(values);
      this.ui.setUiScale(values.uiScale, { store: false, emit: false });
      document.body.dataset.colorVision = values.colorVisionMode;
      localStorage.setItem("pondfront:coachHints", values.showCoachHints ? "on" : "off");
      this.ui.applyMobilePreferences();
      this.ui.updateAudioSettings();
      this.ui.updateMuteButton();
      this.ui.updateWorldSettings?.();
      if (!options.initial) this.ui.emit("viewChanged");
    }

    setRuntimeValue(key, value) {
      if (!(key in this.config.DEFAULTS)) return;
      const next = this.config.sanitize({ ...this.applied, [key]: value });
      this.applied = next;
      this.draft = { ...next };
      this.persist(next);
      this.applyRuntime(next);
      this.updateDirty();
    }

    exportSettings() {
      const blob = new Blob([JSON.stringify(this.config.documentFor(this.draft), null, 2)], { type: "application/json" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = "pondfront-settings.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    }

    async importSettings() {
      const file = this.importInput?.files?.[0];
      if (!file) return;
      try {
        const next = this.config.parseDocument(await file.text()).values;
        if (!window.confirm("Replace the current settings draft with this imported file?")) return;
        this.draft = next;
        this.writeControls(next);
        this.updateDirty();
      } catch {
        this.ui.toast("That settings file could not be read.", true);
      } finally {
        if (this.importInput) this.importInput.value = "";
      }
    }
  }

  root.PondSettingsManager = PondSettingsManager;
})(typeof window !== "undefined" ? window : globalThis);
