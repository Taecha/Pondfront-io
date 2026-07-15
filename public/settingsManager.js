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
      this.listeners = new Set();
      this.adaptiveOverrides = {};
      this.adaptiveLevel = 0;
      this.savedSettings = this.load();
      this.activeSettings = { ...this.savedSettings };
      this.draftSettings = { ...this.activeSettings };
      this.openSnapshot = { ...this.activeSettings };
      this.applied = this.activeSettings;
      this.draft = this.draftSettings;
      this.writeControls(this.activeSettings);
      this.applyRuntime(this.activeSettings, { initial: true, persistAudio: false, reason: "startup" });
      this.bind();
      this.showCategory(this.activeCategory);
    }

    control(key) {
      return this.form?.elements?.namedItem(key) || document.getElementById(key);
    }

    get() {
      return { ...this.activeSettings };
    }

    getEffective() {
      const selected = this.activeSettings;
      const effective = this.config.sanitize({ ...selected, ...this.adaptiveOverrides });
      if (selected.batterySaver) {
        effective.effectsLevel = "low";
        effective.particlesLevel = "low";
        effective.waterQuality = "low";
        effective.shadowQuality = "off";
        effective.fogQuality = "low";
        effective.worldAnimationQuality = "low";
        effective.decorativeAnimals = false;
        effective.mapDecorations = false;
        effective.screenShake = false;
      }
      return effective;
    }

    getValue(key, options = {}) {
      return (options.effective ? this.getEffective() : this.activeSettings)[key];
    }

    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notify(type, changedKeys = [], reason = "settings changed") {
      const uniqueKeys = [...new Set(changedKeys)];
      const event = Object.freeze({
        type,
        reason,
        changedKeys: uniqueKeys,
        channels: this.changeChannels(uniqueKeys),
        activeSettings: this.get(),
        savedSettings: { ...this.savedSettings },
        draftSettings: { ...this.draftSettings },
        effectiveSettings: this.getEffective(),
        adaptiveOverrides: { ...this.adaptiveOverrides },
      });
      this.listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error("Settings subscriber failed", error);
        }
      });
      return event;
    }

    load() {
      const raw = localStorage.getItem(this.config.STORAGE_KEY);
      if (raw) {
        const values = this.config.parseDocument(raw).values;
        this.persist(values);
        return values;
      }
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
      const clean = this.config.sanitize(migrated);
      const values = this.config.PRESETS[clean.visualPreset] ? this.config.valuesForPreset(clean.visualPreset, clean) : clean;
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
        const target = event.target;
        if (!target.matches("input, select")) return;
        const key = target.name || target.id;
        if (key === "visualPreset") this.applyPresetToDraft(target.value);
        else if (this.config.PRESET_KEYS.includes(key)) {
          const preset = this.control("visualPreset");
          if (preset) preset.value = "custom";
        }
        this.draftSettings = this.readControls();
        this.draft = this.draftSettings;
        this.previewDraft([key, ...(key === "visualPreset" ? this.config.PRESET_KEYS : [])]);
        this.updateRangeOutput(target);
        this.updateDirty();
      });
      this.applyButton?.addEventListener("click", () => this.applyDraft());
      this.cancelButton?.addEventListener("click", () => this.cancelDraft());
      this.restoreButton?.addEventListener("click", () => this.resetAll());
      this.resetCategoryButton?.addEventListener("click", () => this.resetCategory());
      this.exportButton?.addEventListener("click", () => this.exportSettings());
      this.importButton?.addEventListener("click", () => this.importInput?.click());
      this.importInput?.addEventListener("change", () => this.importSettings());
      this.form?.querySelectorAll("input[type='range']").forEach((node) => this.updateRangeOutput(node));
    }

    open() {
      this.openSnapshot = { ...this.activeSettings };
      this.draftSettings = { ...this.activeSettings };
      this.draft = this.draftSettings;
      this.writeControls(this.draftSettings);
      this.filter("");
      if (this.search) this.search.value = "";
      this.updateDirty();
      setTimeout(() => this.search?.focus(), 30);
    }

    closeWithCancel() {
      this.cancelDraft(true);
    }

    setDraft(key, value) {
      if (!(key in this.config.DEFAULTS)) return;
      this.writeControl(this.control(key), this.config.sanitizeValue(key, value));
      if (this.config.PRESET_KEYS.includes(key)) this.writeControl(this.control("visualPreset"), "custom");
      this.draftSettings = this.readControls();
      this.draft = this.draftSettings;
      this.previewDraft([key]);
      this.updateDirty();
    }

    previewDraft(changedKeys = []) {
      const previous = this.activeSettings;
      this.activeSettings = this.config.sanitize(this.draftSettings);
      this.applied = this.activeSettings;
      this.applyRuntime(this.activeSettings, { persistAudio: false, reason: "preview" });
      this.notify("settings:previewed", changedKeys.length ? changedKeys : this.changedKeys(previous, this.activeSettings), "preview");
    }

    applyDraft() {
      const previous = this.savedSettings;
      this.draftSettings = this.readControls();
      this.activeSettings = this.config.sanitize(this.draftSettings);
      this.savedSettings = { ...this.activeSettings };
      this.openSnapshot = { ...this.activeSettings };
      this.applied = this.activeSettings;
      this.draft = this.draftSettings;
      this.persist(this.savedSettings);
      this.applyRuntime(this.activeSettings, { persistAudio: true, reason: "apply" });
      this.notify("settings:applied", this.changedKeys(previous, this.activeSettings), "apply");
      this.updateDirty();
      this.ui.audio?.play("confirm", { ui: true, cooldown: 0 });
      this.ui.toast("Settings applied.");
      this.ui.hideSettingsPanel();
    }

    apply() {
      this.applyDraft();
    }

    cancelDraft(close = true) {
      const previous = this.activeSettings;
      this.activeSettings = this.config.sanitize(this.openSnapshot);
      this.draftSettings = { ...this.activeSettings };
      this.applied = this.activeSettings;
      this.draft = this.draftSettings;
      this.writeControls(this.activeSettings);
      this.applyRuntime(this.activeSettings, { persistAudio: false, reason: "cancel" });
      this.notify("settings:cancelled", this.changedKeys(previous, this.activeSettings), "cancel");
      this.updateDirty();
      if (close) this.ui.hideSettingsPanel();
    }

    cancel(close = true) {
      this.cancelDraft(close);
    }

    resetAll() {
      if (!window.confirm("Restore every PondFront setting to its default value?")) return;
      this.draftSettings = { ...this.config.DEFAULTS };
      this.draft = this.draftSettings;
      this.writeControls(this.draftSettings);
      this.previewDraft(Object.keys(this.config.DEFAULTS));
      this.notify("settings:reset", Object.keys(this.config.DEFAULTS), "reset all preview");
      this.updateDirty();
    }

    restoreDefaults() {
      this.resetAll();
    }

    resetCategory() {
      const keys = this.config.CATEGORY_KEYS[this.activeCategory] || [];
      keys.forEach((key) => this.writeControl(this.control(key), this.config.DEFAULTS[key]));
      if (keys.some((key) => this.config.PRESET_KEYS.includes(key))) this.writeControl(this.control("visualPreset"), "custom");
      this.draftSettings = this.readControls();
      this.draft = this.draftSettings;
      this.previewDraft(keys);
      this.notify("settings:reset", keys, `reset ${this.activeCategory}`);
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
      const values = this.config.valuesForPreset(preset, this.readControls());
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
      output.textContent = `${Math.round(Number(node.value) * 100)}%`;
    }

    updateDirty() {
      const dirty = JSON.stringify(this.config.sanitize(this.draftSettings)) !== JSON.stringify(this.config.sanitize(this.savedSettings));
      this.panel?.classList.toggle("settings-dirty", dirty);
      if (this.dirtyStatus) this.dirtyStatus.textContent = dirty ? "Unsaved preview" : "All changes saved";
    }

    applyRuntime(values, options = {}) {
      if (options.initial) this.writeControls(values);
      this.ui.setUiScale(values.uiScale, { store: false, emit: false });
      document.body.dataset.colorVision = values.colorVisionMode;
      document.body.classList.toggle("reduced-motion", values.reducedMotion);
      document.body.classList.toggle("battery-saver", values.batterySaver);
      this.ui.applyMobilePreferences(values);
      this.ui.updateAudioSettings(values, { persist: options.persistAudio === true });
      this.ui.updateMuteButton();
      this.ui.updateWorldSettings?.(values);
      if (!options.initial) this.ui.emit("viewChanged", { reason: options.reason || "settings changed" });
    }

    setRuntimeValue(key, value) {
      if (!(key in this.config.DEFAULTS)) return;
      const previous = this.activeSettings;
      const next = this.config.sanitize({ ...this.activeSettings, [key]: value });
      if (this.config.PRESET_KEYS.includes(key)) next.visualPreset = this.config.matchingPreset(next);
      this.activeSettings = next;
      this.savedSettings = { ...next };
      this.draftSettings = { ...next };
      this.openSnapshot = { ...next };
      this.applied = this.activeSettings;
      this.draft = this.draftSettings;
      this.persist(next);
      this.writeControls(next);
      this.applyRuntime(next, { persistAudio: true, reason: "runtime control" });
      this.notify("settings:applied", this.changedKeys(previous, next), "runtime control");
      this.updateDirty();
    }

    setAdaptiveLevel(level = 0) {
      const nextLevel = Math.max(0, Math.min(2, Number(level) || 0));
      if (!this.activeSettings.adaptiveQuality) return this.clearAdaptiveOverrides();
      const previous = JSON.stringify(this.adaptiveOverrides);
      this.adaptiveLevel = nextLevel;
      this.adaptiveOverrides = nextLevel <= 0
        ? {}
        : nextLevel === 1
          ? { particlesLevel: this.downgrade(this.activeSettings.particlesLevel, 1), waterQuality: this.downgrade(this.activeSettings.waterQuality, 1), fogQuality: this.downgrade(this.activeSettings.fogQuality, 1), worldAnimationQuality: this.downgrade(this.activeSettings.worldAnimationQuality, 1) }
          : { particlesLevel: "low", waterQuality: "low", fogQuality: "low", worldAnimationQuality: "low", decorativeAnimals: false, mapDecorations: false };
      if (previous !== JSON.stringify(this.adaptiveOverrides)) this.notify("settings:performanceChanged", Object.keys(this.adaptiveOverrides), "adaptive quality");
    }

    clearAdaptiveOverrides() {
      if (!Object.keys(this.adaptiveOverrides).length && this.adaptiveLevel === 0) return;
      const keys = Object.keys(this.adaptiveOverrides);
      this.adaptiveOverrides = {};
      this.adaptiveLevel = 0;
      this.notify("settings:performanceChanged", keys, "adaptive quality restored");
    }

    downgrade(value = "medium", steps = 1) {
      const order = ["off", "low", "medium", "high", "ultra"];
      const index = Math.max(1, order.indexOf(value));
      return order[Math.max(1, index - Math.max(0, steps))] || "low";
    }

    changedKeys(before = {}, after = {}) {
      return Object.keys(this.config.DEFAULTS).filter((key) => before[key] !== after[key]);
    }

    changeChannels(keys = []) {
      const channels = new Set();
      const categoryFor = (key) => Object.entries(this.config.CATEGORY_KEYS).find(([, values]) => values.includes(key))?.[0];
      keys.forEach((key) => {
        const category = categoryFor(key);
        if (["graphics", "camera", "accessibility"].includes(category)) channels.add("settings:graphicsChanged");
        if (category === "effects") channels.add("settings:effectsChanged");
        if (category === "audio") channels.add("settings:audioChanged");
        if (category === "world") channels.add("settings:worldChanged");
        if (category === "performance") channels.add("settings:performanceChanged");
      });
      return [...channels];
    }

    diagnostics() {
      return {
        activePreset: this.activeSettings.visualPreset,
        draftPreset: this.draftSettings.visualPreset,
        savedPreset: this.savedSettings.visualPreset,
        effectivePreset: this.config.matchingPreset(this.getEffective()),
        adaptiveOverrides: { ...this.adaptiveOverrides },
        fpsLimit: Number(this.getEffective().batterySaver ? 30 : this.getEffective().fpsLimit),
      };
    }

    exportSettings() {
      const blob = new Blob([JSON.stringify(this.config.documentFor(this.draftSettings), null, 2)], { type: "application/json" });
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
        if (!window.confirm("Replace the current settings preview with this imported file?")) return;
        this.draftSettings = next;
        this.draft = this.draftSettings;
        this.writeControls(next);
        this.previewDraft(Object.keys(this.config.DEFAULTS));
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
