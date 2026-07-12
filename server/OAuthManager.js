const crypto = require("crypto");

const PROVIDERS = Object.freeze({
  google: {
    label: "Google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    userEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  },
  discord: {
    label: "Discord",
    authorizationEndpoint: "https://discord.com/oauth2/authorize",
    tokenEndpoint: "https://discord.com/api/oauth2/token",
    userEndpoint: "https://discord.com/api/v10/users/@me",
    scope: "identify email",
  },
});

class OAuthManager {
  constructor(db, authManager, options = {}) {
    this.db = db;
    this.auth = authManager;
    this.env = options.env || process.env;
    this.fetch = options.fetchImpl || global.fetch;
    this.appBaseUrl = this.validBaseUrl(this.env.APP_BASE_URL || `http://localhost:${this.env.PORT || 5173}`);
    this.providers = Object.fromEntries(
      Object.entries(PROVIDERS).map(([id, definition]) => {
        const prefix = id.toUpperCase();
        const callback = this.validCallbackUrl(
          this.env[`${prefix}_CALLBACK_URL`] || `${this.appBaseUrl}/api/auth/oauth/${id}/callback`,
          id,
        );
        const clientId = String(this.env[`${prefix}_CLIENT_ID`] || "").trim();
        const clientSecret = String(this.env[`${prefix}_CLIENT_SECRET`] || "").trim();
        return [id, { ...definition, id, callback, clientId, clientSecret, enabled: Boolean(this.auth.available && clientId && clientSecret && callback) }];
      }),
    );
  }

  validBaseUrl(value) {
    try {
      const url = new URL(String(value));
      if (url.username || url.password || url.search || url.hash) throw new Error("invalid base URL");
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) {
        throw new Error("APP_BASE_URL must use HTTPS outside localhost");
      }
      return url.toString().replace(/\/$/, "");
    } catch {
      return `http://localhost:${this.env.PORT || 5173}`;
    }
  }

  validCallbackUrl(value, provider) {
    try {
      const url = new URL(String(value));
      if (url.username || url.password || url.search || url.hash) return "";
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) return "";
      if (url.origin !== new URL(this.appBaseUrl).origin) return "";
      if (url.pathname !== `/api/auth/oauth/${provider}/callback`) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  providerStatus(userId = "") {
    const connected = new Set(userId ? this.db.oauthAccountsFor(userId).map((entry) => entry.provider) : []);
    return Object.values(this.providers).map((provider) => ({
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      connected: connected.has(provider.id),
    }));
  }

  begin(providerId, req, res, mode = "login") {
    const provider = this.providers[providerId];
    if (!provider?.enabled) return { ok: false, status: 503, message: `${PROVIDERS[providerId]?.label || "OAuth"} sign-in is not configured yet.` };
    const user = this.auth.currentUser(req);
    const safeMode = mode === "link" ? "link" : "login";
    if (safeMode === "link" && !user) return { ok: false, status: 401, message: "Log in before connecting another account." };
    if (safeMode === "link" && this.db.oauthAccountForUser(user.id, providerId)) {
      return { ok: false, status: 409, message: `${provider.label} is already connected.` };
    }

    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    this.db.createOAuthState({
      stateHash: this.stateHash(state),
      provider: providerId,
      codeVerifier: verifier,
      userId: safeMode === "link" ? user.id : "",
      mode: safeMode,
    });
    this.setStateCookie(res, providerId, state);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.callback,
      response_type: "code",
      scope: provider.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    if (providerId === "google") params.set("prompt", "select_account");
    return { ok: true, status: 302, location: `${provider.authorizationEndpoint}?${params.toString()}` };
  }

  async callback(providerId, query, req, res) {
    const provider = this.providers[providerId];
    if (!provider?.enabled) return this.callbackError(res, providerId, "provider_unavailable");
    const state = String(query.get("state") || "");
    const stateCookie = this.auth.cookies(req)[this.stateCookieName(providerId)] || "";
    this.clearStateCookie(res, providerId);
    if (!state || !stateCookie || !this.safeEqual(state, stateCookie)) return this.callbackError(res, providerId, "session_expired");
    const storedState = this.db.consumeOAuthState(this.stateHash(state));
    if (!storedState || storedState.provider !== providerId) return this.callbackError(res, providerId, "session_expired");
    if (query.get("error")) return this.callbackError(res, providerId, "cancelled");
    const code = String(query.get("code") || "");
    if (!code || code.length > 4096) return this.callbackError(res, providerId, "provider_error");

    try {
      let tokenData = await this.exchangeCode(provider, code, storedState.codeVerifier);
      const identity = await this.fetchIdentity(provider, tokenData.access_token);
      tokenData = null;
      const resolved = this.resolveAccount(identity, storedState);
      if (!resolved.ok) return this.callbackError(res, providerId, resolved.reason);
      this.auth.deleteCurrentSession(req);
      if (!this.auth.issueSession(resolved.user.id, req, res)) return this.callbackError(res, providerId, "server_error");
      console.log(`[OAUTH] ${providerId} login success userId=${resolved.user.id}`);
      const result = storedState.mode === "link" ? "linked" : "success";
      return { ok: true, status: 302, location: `/?auth=${result}&provider=${encodeURIComponent(providerId)}` };
    } catch (error) {
      console.error(`[OAUTH] ${providerId} callback failed: ${this.safeLogMessage(error)}`);
      return this.callbackError(res, providerId, "server_error");
    }
  }

  resolveAccount(identity, state) {
    const existingAccount = this.db.oauthAccount(identity.provider, identity.providerUserId);
    if (state.mode === "link") {
      const user = this.db.findUserById(state.userId);
      if (!user) return { ok: false, reason: "session_expired" };
      if (existingAccount && existingAccount.userId !== user.id) return { ok: false, reason: "account_already_connected" };
      const linked = this.db.linkOAuthAccount(user.id, identity);
      return linked.ok ? { ok: true, user: linked.user } : { ok: false, reason: this.linkReason(linked.reason) };
    }

    if (existingAccount) {
      const updated = this.db.linkOAuthAccount(existingAccount.userId, identity);
      return updated.ok ? { ok: true, user: updated.user } : { ok: false, reason: this.linkReason(updated.reason) };
    }

    if (identity.emailVerified && identity.email && this.db.findUserByVerifiedEmail(identity.email)) {
      return { ok: false, reason: "email_link_required" };
    }
    const username = this.db.uniqueUsername(identity.displayName || `${PROVIDERS[identity.provider].label} Player`);
    const user = this.db.createUser({
      username,
      passwordHash: "",
      email: identity.emailVerified ? identity.email : "",
      emailVerified: identity.emailVerified,
      displayName: identity.displayName || username,
      avatarUrl: identity.avatarUrl || "",
    });
    const linked = this.db.linkOAuthAccount(user.id, identity);
    return linked.ok ? { ok: true, user: linked.user } : { ok: false, reason: this.linkReason(linked.reason) };
  }

  disconnect(providerId, user) {
    if (!user || !this.providers[providerId]) return { ok: false, status: 400, message: "Unknown connected account." };
    const account = this.db.oauthAccountForUser(user.id, providerId);
    if (!account) return { ok: false, status: 404, message: `${this.providers[providerId].label} is not connected.` };
    const accounts = this.db.oauthAccountsFor(user.id);
    const hasPassword = String(user.passwordHash || "").startsWith("scrypt$");
    if (!hasPassword && accounts.length <= 1) {
      return { ok: false, status: 400, message: "Add another sign-in method before disconnecting your only account." };
    }
    this.db.disconnectOAuthAccount(user.id, providerId);
    return { ok: true, status: 200, message: `${this.providers[providerId].label} disconnected.` };
  }

  async exchangeCode(provider, code, verifier) {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: provider.callback,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: verifier,
    });
    const response = await this.fetch(provider.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(`token exchange rejected (${response.status})`);
    return data;
  }

  async fetchIdentity(provider, accessToken) {
    const response = await this.fetch(provider.userEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id && !data.sub) throw new Error(`identity request rejected (${response.status})`);
    if (provider.id === "google") {
      return {
        provider: "google",
        providerUserId: String(data.sub),
        email: data.email_verified ? String(data.email || "") : "",
        emailVerified: Boolean(data.email_verified),
        displayName: String(data.name || "Google Player").slice(0, 100),
        avatarUrl: this.safeAvatar(data.picture, ["googleusercontent.com"]),
      };
    }
    const avatarUrl = data.avatar ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(data.id)}/${encodeURIComponent(data.avatar)}.png?size=128` : "";
    return {
      provider: "discord",
      providerUserId: String(data.id),
      email: data.verified ? String(data.email || "") : "",
      emailVerified: Boolean(data.verified && data.email),
      displayName: String(data.global_name || data.username || "Discord Player").slice(0, 100),
      avatarUrl,
    };
  }

  safeAvatar(value, allowedDomains = []) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol !== "https:" || !allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return "";
      return url.toString().slice(0, 500);
    } catch {
      return "";
    }
  }

  stateHash(state) {
    return crypto.createHash("sha256").update(String(state || "")).digest("hex");
  }

  safeEqual(left, right) {
    const a = Buffer.from(String(left));
    const b = Buffer.from(String(right));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  stateCookieName(providerId) {
    return `pond_oauth_${providerId}`;
  }

  setStateCookie(res, providerId, state) {
    this.appendCookie(
      res,
      `${this.stateCookieName(providerId)}=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/auth/oauth/${providerId}/callback; Max-Age=600${this.auth.secureCookies ? "; Secure" : ""}`,
    );
  }

  clearStateCookie(res, providerId) {
    this.appendCookie(
      res,
      `${this.stateCookieName(providerId)}=; HttpOnly; SameSite=Lax; Path=/api/auth/oauth/${providerId}/callback; Max-Age=0${this.auth.secureCookies ? "; Secure" : ""}`,
    );
  }

  appendCookie(res, cookie) {
    const current = res.getHeader?.("Set-Cookie");
    res.setHeader("Set-Cookie", current ? (Array.isArray(current) ? [...current, cookie] : [current, cookie]) : cookie);
  }

  callbackError(res, providerId, reason) {
    return { ok: false, status: 302, location: `/?authError=${encodeURIComponent(reason)}&provider=${encodeURIComponent(providerId)}` };
  }

  linkReason(reason) {
    if (reason === "provider_already_connected" || reason === "provider_slot_used") return "account_already_connected";
    return "server_error";
  }

  safeLogMessage(error) {
    return String(error?.message || "provider request failed").replace(/[\r\n]/g, " ").slice(0, 180);
  }
}

module.exports = OAuthManager;
