(function initPondContextMenu(root) {
  class PondContextMenu {
    constructor() {
      this.callbacks = {};
      this.items = [];
      this.visible = false;
      this.stack = [];
      this.el = document.createElement("div");
      this.el.className = "context-menu hidden";
      this.el.setAttribute("role", "menu");
      this.el.setAttribute("aria-label", "Tile actions");
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
        if (item?.back) {
          const previous = this.stack.pop();
          this.path.pop();
          if (previous) this.show(previous);
          return;
        }
        if (item?.submenu?.length) {
          this.stack.push(this.current);
          this.path.push(item.id || item.label);
          this.show({ title: item.label, subtitle: item.hint || "Choose an action", items: item.submenu });
          return;
        }
        this.close(false);
        this.emit("action", item?.payload || {});
      });

      this.el.addEventListener("pointerenter", (event) => this.previewFromEvent(event), true);
      this.el.addEventListener("focusin", (event) => this.previewFromEvent(event));
      this.el.addEventListener("pointerleave", () => this.emit("preview", null));
      this.el.addEventListener("pointerdown", (event) => {
        if (!this.mobile || !event.target.closest(".context-head")) return;
        this.swipe = { id: event.pointerId, y: event.clientY };
        this.el.setPointerCapture?.(event.pointerId);
      });
      this.el.addEventListener("pointermove", (event) => {
        if (!this.swipe || this.swipe.id !== event.pointerId) return;
        const distance = Math.max(0, event.clientY - this.swipe.y);
        this.el.style.transform = `translateY(${Math.min(120, distance)}px)`;
      });
      const finishSwipe = (event) => {
        if (!this.swipe || this.swipe.id !== event.pointerId) return;
        const distance = Math.max(0, event.clientY - this.swipe.y);
        this.swipe = null;
        this.el.style.transform = "";
        if (distance >= 72) this.close();
      };
      this.el.addEventListener("pointerup", finishSwipe);
      this.el.addEventListener("pointercancel", finishSwipe);
      document.addEventListener("pointerdown", (event) => {
        if (!this.visible || performance.now() - this.openedAt < 80) return;
        if (!this.el.contains(event.target)) this.close();
      });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.visible) this.close();
      });
    }

    previewFromEvent(event) {
      const button = event.target.closest?.("[data-menu-index]");
      if (!button || button.disabled) return this.emit("preview", null);
      const item = this.items[Number(button.dataset.menuIndex)];
      this.emit("preview", item?.preview || item?.payload || null);
    }

    open({ x, y, title, subtitle, items, mobile = false }) {
      this.stack = [];
      this.path = [];
      this.anchor = { x, y };
      this.mobile = Boolean(mobile || window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 720);
      this.current = { title, subtitle, items: this.normalize(items) };
      this.openedAt = performance.now();
      this.visible = true;
      this.el.classList.toggle("context-mobile-sheet", this.mobile);
      this.show(this.current);
      this.el.classList.remove("hidden");
      this.position(x, y);
      requestAnimationFrame(() => this.el.classList.add("open"));
    }

    refresh(menu) {
      if (!this.visible || !menu) return;
      const rootView = { title: menu.title, subtitle: menu.subtitle, items: this.normalize(menu.items || menu.actions) };
      const nextStack = [];
      let view = rootView;
      for (const key of this.path || []) {
        const parent = view.items.find((item) => (item.id || item.label) === key && item.submenu?.length);
        if (!parent) break;
        nextStack.push(view);
        view = { title: parent.label, subtitle: parent.hint || "Choose an action", items: parent.submenu };
      }
      this.stack = nextStack;
      this.path = this.path.slice(0, nextStack.length);
      this.show(view);
      this.position(this.anchor?.x || 0, this.anchor?.y || 0);
    }

    normalize(items = []) {
      return items.map((item) => ({
        ...item,
        disabled: item.disabled ?? item.available === false,
        submenu: item.submenu ? this.normalize(item.submenu) : null,
        payload: item.payload || (item.id ? { action: item.id } : {}),
      }));
    }

    show(view) {
      this.current = { ...view, items: this.normalize(view.items) };
      this.items = this.stack.length ? [{ label: "Back", icon: "<", back: true }, ...this.current.items] : this.current.items;
      this.el.innerHTML = this.render(this.current.title, this.current.subtitle);
    }

    close(emitClose = true) {
      if (!this.visible) return;
      this.visible = false;
      this.stack = [];
      this.path = [];
      this.el.classList.remove("open");
      this.el.classList.add("hidden");
      this.emit("preview", null);
      if (emitClose) this.emit("close");
    }

    render(title = "Actions", subtitle = "") {
      const body = this.items.map((item, index) => {
        if (item.separator) return `<div class="menu-separator"></div>`;
        const danger = item.danger ? " danger" : "";
        const disabled = item.disabled ? "disabled" : "";
        const reason = item.disabled ? item.disabledReason || item.hint : item.hint;
        const meta = [item.cost != null ? `${Math.ceil(item.cost)} energy` : "", item.cooldownRemaining > 0 ? `${Math.ceil(item.cooldownRemaining)}s` : ""].filter(Boolean).join(" | ");
        return `<button class="context-item${danger}" data-menu-index="${index}" ${disabled} role="menuitem" title="${escapeHtml(reason || "")}">
          <span class="menu-icon">${escapeHtml(item.icon || "i")}</span>
          <span class="menu-copy"><strong>${escapeHtml(item.label)}</strong>${meta ? `<em>${escapeHtml(meta)}</em>` : ""}${reason ? `<small>${escapeHtml(reason)}</small>` : ""}</span>
          ${item.submenu?.length ? '<span class="menu-arrow">&gt;</span>' : ""}
        </button>`;
      }).join("");
      return `<div class="context-head"><strong>${escapeHtml(title)}</strong>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}</div><div class="context-body">${body}</div>`;
    }

    position(x = 0, y = 0) {
      if (this.mobile) {
        this.el.style.left = "8px";
        this.el.style.top = "auto";
        return;
      }
      const pad = 10;
      const rect = this.el.getBoundingClientRect();
      this.el.style.left = `${Math.max(pad, Math.min(window.innerWidth - rect.width - pad, x + 8))}px`;
      this.el.style.top = `${Math.max(pad, Math.min(window.innerHeight - rect.height - pad, y + 8))}px`;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  root.PondContextMenu = PondContextMenu;
})(window);
