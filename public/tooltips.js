(function initPondTooltips(root) {
  class PondTooltips {
    constructor() {
      this.el = document.createElement("div");
      this.el.className = "pond-tooltip hidden";
      document.body.appendChild(this.el);
      this.activeTarget = null;
      this.bind();
    }

    bind() {
      document.addEventListener("pointerover", (event) => {
        const target = event.target.closest?.("[data-tip], [data-tip-key]");
        if (target) this.show(target);
      });
      document.addEventListener("focusin", (event) => {
        const target = event.target.closest?.("[data-tip], [data-tip-key]");
        if (target) this.show(target);
      });
      document.addEventListener("pointerout", (event) => {
        if (this.activeTarget && !event.relatedTarget?.closest?.("[data-tip], [data-tip-key]")) this.hide();
      });
      document.addEventListener("focusout", () => this.hide());
      document.addEventListener("click", (event) => {
        const target = event.target.closest?.("[data-tip], [data-tip-key]");
        if (!target) this.hide();
        else this.show(target);
      });
    }

    show(target) {
      const text = target.dataset.tip || root.PondInfo?.TIPS?.[target.dataset.tipKey];
      if (!text) return;
      this.activeTarget = target;
      this.el.textContent = text;
      this.el.classList.remove("hidden");
      this.position(target);
    }

    hide() {
      this.activeTarget = null;
      this.el.classList.add("hidden");
    }

    position(target) {
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = this.el.getBoundingClientRect();
      const pad = 10;
      let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      let top = targetRect.bottom + 8;
      left = Math.max(pad, Math.min(window.innerWidth - tooltipRect.width - pad, left));
      if (top + tooltipRect.height > window.innerHeight - pad) top = targetRect.top - tooltipRect.height - 8;
      this.el.style.left = `${left}px`;
      this.el.style.top = `${Math.max(pad, top)}px`;
    }
  }

  root.PondTooltips = PondTooltips;
})(window);
