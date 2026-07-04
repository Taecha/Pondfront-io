const crypto = require("crypto");

class AuthManager {
  constructor(db) {
    this.db = db;
    this.cookieName = "pond_session";
  }

  publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      level: user.level || 1,
      xp: user.xp || 0,
      coins: user.coins || 0,
      selectedBadge: user.selectedBadge || "rookie",
      selectedTitle: user.selectedTitle || "pond_rookie",
      selectedCosmetic: user.selectedCosmetic || "clear_ripple",
      unlockedBadges: user.unlockedBadges || ["rookie"],
      unlockedTitles: user.unlockedTitles || ["pond_rookie"],
      unlockedCosmetics: user.unlockedCosmetics || ["clear_ripple"],
    };
  }

  signup(body = {}, req, res) {
    const username = this.cleanUsername(body.username);
    const password = String(body.password || "");
    const confirm = String(body.confirmPassword || body.confirm || "");
    const validation = this.validateSignup(username, password, confirm);
    if (validation) return { ok: false, status: 400, message: validation };
    if (this.db.findUserByUsername(username)) return { ok: false, status: 409, message: "Username already taken." };
    const user = this.db.createUser({ username, passwordHash: this.hashPassword(password), email: body.email });
    const session = this.db.addSession(user.id, req.headers["user-agent"]);
    this.setSessionCookie(res, session.token);
    return { ok: true, status: 200, message: "Account created.", user: this.publicUser(user) };
  }

  login(body = {}, req, res) {
    const username = this.cleanUsername(body.username);
    const password = String(body.password || "");
    const user = this.db.findUserByUsername(username);
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      return { ok: false, status: 401, message: "Wrong username or password." };
    }
    const session = this.db.addSession(user.id, req.headers["user-agent"]);
    this.setSessionCookie(res, session.token);
    return { ok: true, status: 200, message: "Logged in.", user: this.publicUser(user) };
  }

  logout(req, res) {
    const token = this.sessionToken(req);
    if (token) this.db.deleteSession(token);
    this.clearSessionCookie(res);
    return { ok: true, status: 200, message: "Logged out." };
  }

  currentUser(req) {
    const token = this.sessionToken(req);
    if (!token) return null;
    const session = this.db.getSession(token);
    if (!session) return null;
    return this.db.findUserById(session.userId);
  }

  validateSignup(username, password, confirm) {
    if (!/^[a-zA-Z0-9 _-]{3,18}$/.test(username)) return "Username must be 3-18 letters, numbers, spaces, _ or -.";
    if (password.length < 6) return "Password too short.";
    if (password.length > 96) return "Password is too long.";
    if (password !== confirm) return "Passwords do not match.";
    return "";
  }

  cleanUsername(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 18);
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    return `scrypt$16384$8$1$${salt}$${hash}`;
  }

  verifyPassword(password, stored) {
    try {
      const [algorithm, n, r, p, salt, hash] = String(stored || "").split("$");
      if (algorithm !== "scrypt" || !salt || !hash) return false;
      const expected = Buffer.from(hash, "hex");
      const actual = crypto.scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  sessionToken(req) {
    return this.cookies(req)[this.cookieName] || "";
  }

  cookies(req) {
    return Object.fromEntries(
      String(req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const index = part.indexOf("=");
          return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
        }),
    );
  }

  setSessionCookie(res, token) {
    res.setHeader("Set-Cookie", `${this.cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
  }

  clearSessionCookie(res) {
    res.setHeader("Set-Cookie", `${this.cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  }
}

module.exports = AuthManager;
