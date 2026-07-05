(function initPondAuth(root) {
  class PondAuthController {
    constructor(options = {}) {
      this.profile = options.profile || null;
      this.user = null;
      this.mode = "login";
      this.changeHandlers = [];
      this.nodes = {
        panel: document.querySelector("#accountPanel"),
        badge: document.querySelector("#accountBadgeMini"),
        name: document.querySelector("#accountName"),
        hint: document.querySelector("#accountHint"),
        loginOpen: document.querySelector("#loginOpenButton"),
        signupOpen: document.querySelector("#signupOpenButton"),
        continueGuest: document.querySelector("#continueGuestButton"),
        profileOpen: document.querySelector("#profileOpenButton"),
        logout: document.querySelector("#logoutButton"),
        form: document.querySelector("#authForm"),
        title: document.querySelector("#authFormTitle"),
        close: document.querySelector("#authCloseButton"),
        username: document.querySelector("#authUsername"),
        password: document.querySelector("#authPassword"),
        confirmRow: document.querySelector("#authConfirmRow"),
        confirm: document.querySelector("#authConfirmPassword"),
        error: document.querySelector("#authError"),
        submit: document.querySelector("#authSubmitButton"),
        nameInputs: [
          document.querySelector("#playerName"),
          document.querySelector("#createNameInput"),
          document.querySelector("#joinPlayerName"),
          document.querySelector("#lobbyPlayerName"),
        ],
      };
      this.bind();
      window.addEventListener("pond:profile-updated", (event) => {
        const profileUser = event.detail?.user;
        if (!profileUser || !this.user || profileUser.id !== this.user.id) return;
        this.setUser({ ...this.user, ...profileUser }, { loadProfile: false });
      });
      this.refresh();
    }

    onChange(callback) {
      this.changeHandlers.push(callback);
      if (this.user !== undefined) callback(this.user);
    }

    bind() {
      this.nodes.loginOpen?.addEventListener("click", () => this.open("login"));
      this.nodes.signupOpen?.addEventListener("click", () => this.open("signup"));
      this.nodes.continueGuest?.addEventListener("click", () => {
        this.hideForm();
        this.setError("");
      });
      this.nodes.profileOpen?.addEventListener("click", () => this.profile?.open("overview"));
      this.nodes.logout?.addEventListener("click", () => this.logout());
      this.nodes.close?.addEventListener("click", () => this.hideForm());
      this.nodes.form?.addEventListener("submit", (event) => {
        event.preventDefault();
        this.submit();
      });
    }

    open(mode = "login") {
      this.mode = mode;
      this.nodes.form?.classList.remove("hidden");
      this.nodes.title.textContent = mode === "signup" ? "Create Account" : "Login";
      this.nodes.submit.textContent = mode === "signup" ? "Sign Up" : "Login";
      this.nodes.confirmRow?.classList.toggle("hidden", mode !== "signup");
      this.nodes.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
      this.setError("");
      this.nodes.username?.focus();
    }

    hideForm() {
      this.nodes.form?.classList.add("hidden");
    }

    async submit() {
      const payload = {
        username: this.nodes.username?.value || "",
        password: this.nodes.password?.value || "",
        confirmPassword: this.nodes.confirm?.value || "",
      };
      const path = this.mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      this.nodes.submit.disabled = true;
      this.setError("");
      try {
        const data = await this.request(path, { method: "POST", body: JSON.stringify(payload) });
        this.setUser(data.user);
        this.hideForm();
        this.nodes.password.value = "";
        if (this.nodes.confirm) this.nodes.confirm.value = "";
      } catch (error) {
        this.setError(error.message || "Connection error.");
      } finally {
        this.nodes.submit.disabled = false;
      }
    }

    async logout() {
      try {
        await this.request("/api/auth/logout", { method: "POST", body: "{}" });
      } catch {
        // Logout should still return the UI to guest state if the old session vanished.
      }
      this.setUser(null);
      this.hideForm();
    }

    async refresh() {
      try {
        const data = await this.request("/api/auth/me");
        this.setUser(data.user || null);
      } catch {
        this.setUser(null);
      }
    }

    setUser(user, options = {}) {
      this.user = user || null;
      this.profile?.setUser(this.user);
      this.nodes.panel?.classList.toggle("guest", !this.user);
      this.nodes.panel?.classList.toggle("signed-in", Boolean(this.user));
      this.nodes.badge.textContent = this.user ? this.badgeIcon(this.user.selectedBadge) : "G";
      this.nodes.name.textContent = this.user ? this.user.username : "Playing as Guest";
      this.nodes.hint.textContent = this.user
        ? `Level ${this.user.level || 1} | ${Math.round(this.user.xp || 0)} XP | ${Math.round(this.user.coins || 0)} coins`
        : "Create an account to save XP, badges, stats, and match history.";
      this.nodes.loginOpen?.classList.toggle("hidden", Boolean(this.user));
      this.nodes.signupOpen?.classList.toggle("hidden", Boolean(this.user));
      this.nodes.profileOpen?.classList.toggle("hidden", !this.user);
      this.nodes.logout?.classList.toggle("hidden", !this.user);
      if (this.user?.username) {
        this.nodes.nameInputs.forEach((input) => {
          if (input && (!input.value || input.value === "Player" || input.value === "Host")) input.value = this.user.username;
        });
      }
      this.changeHandlers.forEach((callback) => callback(this.user));
      window.dispatchEvent(new CustomEvent("pond:account-changed", { detail: { user: this.user } }));
      if (this.user && options.loadProfile !== false) this.profile?.load?.();
    }

    badgeIcon(badgeId) {
      return (root.PondBadgeConfig || []).find((badge) => badge.id === badgeId)?.icon || "R";
    }

    setError(message) {
      if (!this.nodes.error) return;
      this.nodes.error.textContent = message || "";
      this.nodes.error.classList.toggle("hidden", !message);
    }

    async request(path, options = {}) {
      const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Connection error.");
      return data;
    }
  }

  root.PondAuthController = PondAuthController;
})(window);
