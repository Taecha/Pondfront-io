(function initPondContextMenu(root) {
  class PondContextMenu {
    constructor() {
      this.callbacks = {};
      this.items = [];
      this.visible = false;
      this.el = document.createElement("div");
      this.el.className = "context-menu hidden";
      this.el.setAttribute("role", "menu");
      document.body.appendChild(this.el);
      this.bind();
    }

    on(name, callback) {
      this.callbacks[name] = callback;
    }

    emit(name, payload) {
      this.callbacks[name]?.(payload);
    }

    bind() {
      this.el.addEventListener("click", (event) => {
        const button = event.target.closest("[data-menu-index]");
        if (!button || button.disabled) return;
        const item = this.items[Number(button.dataset.menuIndex)];
        this.close(false);
        this.emit("action", item.payload || {});
      });

      this.el.addEventListener("pointerenter", (event) => this.previewFromEvent(event), true);
      this.el.addEventListener("focusin", (event) => this.previewFromEvent(event));
      this.el.addEventListener("pointerleave", () => this.emit("preview", null));

      document.addEventListener("pointerdown", (event) => {
        if (!this.visible) return;
        if (performance.now() - this.openedAt < 80) return;
        if (!this.el.contains(event.target)) this.close();
      });

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.visible) this.close();
      });
    }

    previewFromEvent(event) {
      const button = event.target.closest?.("[data-menu-index]");
      if (!button || button.disabled) {
        this.emit("preview", null);
        return;
      }
      const item = this.items[Number(button.dataset.menuIndex)];
      this.emit("preview", item.preview || item.payload || null);
    }

    open({ x, y, title, subtitle, items }) {
      this.items = items || [];
      this.openedAt = performance.now();
      this.visible = true;
      this.el.innerHTML = this.render(title, subtitle);
      this.el.classList.remove("hidden");
      this.position(x, y);
      requestAnimationFrame(() => this.el.classList.add("open"));
    }

    close(emitClose = true) {
      if (!this.visible) return;
      this.visible = false;
      this.el.classList.remove("open");
      this.el.classList.add("hidden");
      this.emit("preview", null);
      if (emitClose) this.emit("close");
    }

    render(title = "Actions", subtitle = "") {
      const body = this.items
        .map((item, index) => {
          if (item.separator) return `<div class="menu-separator"></div>`;
          const disabled = item.disabled ? "disabled" : "";
          const danger = item.danger ? " danger" : "";
          const hint = item.hint ? `<small>${escapeHtml(item.hint)}</small>` : "";
          const icon = item.icon ? escapeHtml(item.icon) : "";
          return `<button class="context-item${danger}" data-menu-index="${index}" ${disabled} role="menuitem">
            <span class="menu-icon">${icon}</span>
            <span><strong>${escapeHtml(item.label)}</strong>${hint}</span>
          </button>`;
        })
        .join("");

      return `<div class="context-head">
        <strong>${escapeHtml(title)}</strong>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
      </div>
      <div class="context-body">${body}</div>`;
    }

    position(x, y) {
      const pad = 10;
      const rect = this.el.getBoundingClientRect();
      const left = Math.max(pad, Math.min(window.innerWidth - rect.width - pad, x + 8));
      const top = Math.max(pad, Math.min(window.innerHeight - rect.height - pad, y + 8));
      this.el.style.left = `${left}px`;
      this.el.style.top = `${top}px`;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  root.PondContextMenu = PondContextMenu;
})(window);
