const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const progressionConfig = require("../shared/progressionConfig");
const badgeConfig = require("../shared/badgeConfig");
const achievementConfig = require("../shared/achievementConfig");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (error) {
  throw new Error("PondFront account persistence requires Node 22+ with node:sqlite support.");
}

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_FILE = path.join(DATA_DIR, "pondfront.db");
const LEGACY_JSON_FILE = path.join(DATA_DIR, "pondfront-db.json");

function nowIso() {
  return new Date().toISOString();
}

function int(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
}

function num(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function jsonArray(value, fallback = []) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function defaultStats(userId) {
  return {
    userId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    eliminations: 0,
    totalTilesCaptured: 0,
    totalEnergyGenerated: 0,
    totalEnergySpent: 0,
    totalBuildingsBuilt: 0,
    totalBuildingUpgrades: 0,
    totalObjectivesCaptured: 0,
    totalAbilitiesUsed: 0,
    supportSent: 0,
    biggestAttackWave: 0,
    longestSurvivalTime: 0,
    comebackWins: 0,
    favoriteAnimal: "duck",
  };
}

function defaultAnimalStats(userId, animal) {
  return {
    userId,
    animal,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    abilitiesUsed: 0,
    tilesCaptured: 0,
    highestTerritoryPercent: 0,
    biggestAttackWave: 0,
    defenses: 0,
    highestIncome: 0,
  };
}

class PondDatabase {
  constructor(filePath = process.env.PONDFRONT_DB || DEFAULT_FILE) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const fresh = !fs.existsSync(this.filePath) || fs.statSync(this.filePath).size === 0;
    this.db = new DatabaseSync(this.filePath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.migrate();
    this.syncCatalogTables();
    this.data = {};
    Object.defineProperty(this.data, "users", { enumerable: true, get: () => this.allUsers() });
    if (fresh && path.resolve(this.filePath) === path.resolve(DEFAULT_FILE)) this.importLegacyJson();
  }

  load() {
    return true;
  }

  save() {
    this.setMeta("updatedAt", nowIso());
  }

  close() {
    this.db?.close?.();
  }

  id(prefix) {
    return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
  }

  run(sql, ...params) {
    return this.db.prepare(sql).run(...params);
  }

  get(sql, ...params) {
    return this.db.prepare(sql).get(...params);
  }

  all(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }

  transaction(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        usernameKey TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL DEFAULT '',
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastLoginAt TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        selectedBadge TEXT NOT NULL DEFAULT 'rookie',
        selectedTitle TEXT NOT NULL DEFAULT 'pond_rookie',
        selectedCosmetic TEXT NOT NULL DEFAULT 'clear_ripple',
        unlockedTitles TEXT NOT NULL DEFAULT '["pond_rookie"]',
        unlockedCosmetics TEXT NOT NULL DEFAULT '["clear_ripple"]'
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        userAgent TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        lastSeenAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerUserId TEXT NOT NULL,
        providerEmail TEXT NOT NULL DEFAULT '',
        providerEmailVerified INTEGER NOT NULL DEFAULT 0,
        providerDisplayName TEXT NOT NULL DEFAULT '',
        avatarUrl TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        lastLoginAt TEXT NOT NULL,
        UNIQUE (provider, providerUserId),
        UNIQUE (userId, provider),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        stateHash TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        codeVerifier TEXT NOT NULL,
        userId TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'login',
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_stats (
        userId TEXT PRIMARY KEY,
        gamesPlayed INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        eliminations INTEGER NOT NULL DEFAULT 0,
        totalTilesCaptured INTEGER NOT NULL DEFAULT 0,
        totalEnergyGenerated INTEGER NOT NULL DEFAULT 0,
        totalEnergySpent INTEGER NOT NULL DEFAULT 0,
        totalBuildingsBuilt INTEGER NOT NULL DEFAULT 0,
        totalBuildingUpgrades INTEGER NOT NULL DEFAULT 0,
        totalObjectivesCaptured INTEGER NOT NULL DEFAULT 0,
        totalAbilitiesUsed INTEGER NOT NULL DEFAULT 0,
        supportSent INTEGER NOT NULL DEFAULT 0,
        biggestAttackWave INTEGER NOT NULL DEFAULT 0,
        longestSurvivalTime INTEGER NOT NULL DEFAULT 0,
        comebackWins INTEGER NOT NULL DEFAULT 0,
        favoriteAnimal TEXT NOT NULL DEFAULT 'duck',
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS animal_stats (
        userId TEXT NOT NULL,
        animal TEXT NOT NULL,
        gamesPlayed INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        abilitiesUsed INTEGER NOT NULL DEFAULT 0,
        tilesCaptured INTEGER NOT NULL DEFAULT 0,
        highestTerritoryPercent REAL NOT NULL DEFAULT 0,
        biggestAttackWave INTEGER NOT NULL DEFAULT 0,
        defenses INTEGER NOT NULL DEFAULT 0,
        highestIncome REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (userId, animal),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        badgeIcon TEXT NOT NULL DEFAULT '',
        badgeId TEXT NOT NULL DEFAULT '',
        xpReward INTEGER NOT NULL DEFAULT 0,
        coinReward INTEGER NOT NULL DEFAULT 0,
        conditionType TEXT NOT NULL DEFAULT '',
        threshold REAL NOT NULL DEFAULT 0,
        animal TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        userId TEXT NOT NULL,
        achievementId TEXT NOT NULL,
        unlockedAt TEXT NOT NULL,
        PRIMARY KEY (userId, achievementId),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (achievementId) REFERENCES achievements(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '',
        unlockCondition TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        userId TEXT NOT NULL,
        badgeId TEXT NOT NULL,
        unlockedAt TEXT NOT NULL,
        PRIMARY KEY (userId, badgeId),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (badgeId) REFERENCES badges(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS match_history (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        matchId TEXT NOT NULL,
        animal TEXT NOT NULL,
        result TEXT NOT NULL,
        rank INTEGER NOT NULL DEFAULT 0,
        territoryPercent REAL NOT NULL DEFAULT 0,
        eliminations INTEGER NOT NULL DEFAULT 0,
        tilesCaptured INTEGER NOT NULL DEFAULT 0,
        buildingsBuilt INTEGER NOT NULL DEFAULT 0,
        buildingUpgrades INTEGER NOT NULL DEFAULT 0,
        objectivesCaptured INTEGER NOT NULL DEFAULT 0,
        abilitiesUsed INTEGER NOT NULL DEFAULT 0,
        energySpent INTEGER NOT NULL DEFAULT 0,
        energyGenerated INTEGER NOT NULL DEFAULT 0,
        biggestAttackWave INTEGER NOT NULL DEFAULT 0,
        matchDuration INTEGER NOT NULL DEFAULT 0,
        supportSent INTEGER NOT NULL DEFAULT 0,
        defenses INTEGER NOT NULL DEFAULT 0,
        highestIncome REAL NOT NULL DEFAULT 0,
        comebackWin INTEGER NOT NULL DEFAULT 0,
        xpGained INTEGER NOT NULL DEFAULT 0,
        coinsGained INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        UNIQUE (userId, matchId),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_match_history_user_created ON match_history(userId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(userId);
      CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expiresAt);
    `);
    this.ensureColumn("users", "displayName", "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn("users", "emailVerified", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("users", "avatarUrl", "TEXT NOT NULL DEFAULT ''");
    if (!this.get("SELECT value FROM meta WHERE key = ?", "createdAt")) this.setMeta("createdAt", nowIso());
    this.setMeta("version", "3");
  }

  ensureColumn(table, column, definition) {
    const allowed = new Set(["users:displayName", "users:emailVerified", "users:avatarUrl"]);
    if (!allowed.has(`${table}:${column}`)) throw new Error("Unsupported schema migration.");
    const columns = this.all(`PRAGMA table_info(${table})`);
    if (!columns.some((entry) => entry.name === column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  setMeta(key, value) {
    this.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, String(value));
  }

  syncCatalogTables() {
    achievementConfig.forEach((achievement) => {
      this.run(
        `INSERT INTO achievements (id, name, description, badgeIcon, badgeId, xpReward, coinReward, conditionType, threshold, animal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           badgeIcon = excluded.badgeIcon,
           badgeId = excluded.badgeId,
           xpReward = excluded.xpReward,
           coinReward = excluded.coinReward,
           conditionType = excluded.conditionType,
           threshold = excluded.threshold,
           animal = excluded.animal`,
        achievement.id,
        achievement.name,
        achievement.description,
        achievement.badgeIcon || "",
        achievement.badgeId || "",
        int(achievement.xpReward),
        int(achievement.coinReward),
        achievement.conditionType || "",
        num(achievement.threshold),
        achievement.animal || "",
      );
    });
    badgeConfig.forEach((badge) => {
      this.run(
        `INSERT INTO badges (id, name, description, icon, unlockCondition)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           icon = excluded.icon,
           unlockCondition = excluded.unlockCondition`,
        badge.id,
        badge.label || badge.name || badge.id,
        badge.description || badge.source || "",
        badge.icon || "",
        badge.source || badge.unlockCondition || "",
      );
    });
  }

  importLegacyJson(filePath = LEGACY_JSON_FILE) {
    if (!fs.existsSync(filePath) || this.allUsers().length) return;
    let legacy;
    try {
      legacy = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return;
    }
    const users = legacy.users || [];
    if (!users.length) return;
    this.transaction(() => {
      users.forEach((entry) => {
        const user = {
          id: entry.id || this.id("user"),
          username: this.normalizeUsername(entry.username),
          usernameKey: entry.usernameKey || this.usernameKey(entry.username),
          email: String(entry.email || ""),
          displayName: String(entry.displayName || entry.username || ""),
          emailVerified: Boolean(entry.emailVerified),
          avatarUrl: String(entry.avatarUrl || ""),
          passwordHash: entry.passwordHash || "",
          createdAt: entry.createdAt || nowIso(),
          lastLoginAt: entry.lastLoginAt || entry.createdAt || nowIso(),
          level: int(entry.level, 1),
          xp: int(entry.xp),
          coins: int(entry.coins),
          selectedBadge: entry.selectedBadge || "rookie",
          selectedTitle: entry.selectedTitle || progressionConfig.defaultTitle,
          selectedCosmetic: entry.selectedCosmetic || progressionConfig.defaultCosmetic,
          unlockedBadges: entry.unlockedBadges || ["rookie"],
          unlockedTitles: entry.unlockedTitles || [progressionConfig.defaultTitle],
          unlockedCosmetics: entry.unlockedCosmetics || [progressionConfig.defaultCosmetic],
        };
        this.insertUserRow(user, true);
        this.upsertPlayerStats({ ...defaultStats(user.id), ...(legacy.playerStats?.[user.id] || {}) });
        (user.unlockedBadges || ["rookie"]).forEach((badgeId) => this.unlockBadge(user.id, badgeId, user.createdAt));
      });
      Object.values(legacy.animalStats || {}).forEach((entry) => this.upsertAnimalStats(entry));
      (legacy.userAchievements || []).forEach((entry) => {
        if (!entry.userId || !entry.achievementId) return;
        this.run(
          "INSERT OR IGNORE INTO user_achievements (userId, achievementId, unlockedAt) VALUES (?, ?, ?)",
          entry.userId,
          entry.achievementId,
          entry.unlockedAt || nowIso(),
        );
      });
      (legacy.matchHistory || []).forEach((entry) => this.insertMatchHistory(entry));
      (legacy.sessions || []).forEach((entry) => {
        if (!entry.token || !entry.userId || (entry.expiresAt && entry.expiresAt < nowIso())) return;
        this.run(
          "INSERT OR IGNORE INTO sessions (token, userId, userAgent, createdAt, lastSeenAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)",
          entry.token,
          entry.userId,
          entry.userAgent || "",
          entry.createdAt || nowIso(),
          entry.lastSeenAt || nowIso(),
          entry.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        );
      });
    });
    console.log(`[DB] imported ${users.length} legacy account(s) into ${path.basename(this.filePath)}`);
  }

  normalizeUsername(username) {
    return String(username || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 20);
  }

  usernameKey(username) {
    return this.normalizeUsername(username).toLowerCase();
  }

  rowToUser(row) {
    if (!row) return null;
    const user = {
      ...row,
      level: int(row.level, 1),
      xp: int(row.xp),
      coins: int(row.coins),
      unlockedBadges: this.badgesFor(row.id).map((entry) => entry.badgeId),
      unlockedTitles: jsonArray(row.unlockedTitles, [progressionConfig.defaultTitle]),
      unlockedCosmetics: jsonArray(row.unlockedCosmetics, [progressionConfig.defaultCosmetic]),
    };
    if (!user.unlockedBadges.length) user.unlockedBadges = ["rookie"];
    this.ensureUnlocksForLevel(user);
    return user;
  }

  allUsers() {
    return this.all("SELECT * FROM users ORDER BY createdAt ASC").map((row) => this.rowToUser(row));
  }

  findUserByUsername(username) {
    return this.rowToUser(this.get("SELECT * FROM users WHERE usernameKey = ?", this.usernameKey(username)));
  }

  findUserById(userId) {
    return this.rowToUser(this.get("SELECT * FROM users WHERE id = ?", userId));
  }

  createUser({ username, passwordHash = "", email = "", displayName = "", emailVerified = false, avatarUrl = "" }) {
    const cleanUsername = this.normalizeUsername(username);
    const user = {
      id: this.id("user"),
      username: cleanUsername,
      usernameKey: this.usernameKey(cleanUsername),
      email: String(email || "").trim().slice(0, 120),
      displayName: String(displayName || cleanUsername).trim().slice(0, 80),
      emailVerified: Boolean(emailVerified),
      avatarUrl: String(avatarUrl || "").trim().slice(0, 500),
      passwordHash,
      createdAt: nowIso(),
      lastLoginAt: nowIso(),
      level: 1,
      xp: 0,
      coins: 0,
      selectedBadge: "rookie",
      selectedTitle: progressionConfig.defaultTitle,
      selectedCosmetic: progressionConfig.defaultCosmetic,
      unlockedBadges: ["rookie"],
      unlockedTitles: [progressionConfig.defaultTitle],
      unlockedCosmetics: [progressionConfig.defaultCosmetic],
    };
    this.transaction(() => {
      this.insertUserRow(user);
      this.upsertPlayerStats(defaultStats(user.id));
      this.unlockBadge(user.id, "rookie", user.createdAt);
    });
    return this.findUserById(user.id);
  }

  insertUserRow(user, ignore = false) {
    const verb = ignore ? "INSERT OR IGNORE" : "INSERT";
    this.run(
      `${verb} INTO users
       (id, username, usernameKey, email, displayName, emailVerified, avatarUrl, passwordHash, createdAt, lastLoginAt, level, xp, coins, selectedBadge, selectedTitle, selectedCosmetic, unlockedTitles, unlockedCosmetics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      user.id,
      user.username,
      user.usernameKey,
      user.email || "",
      user.displayName || user.username,
      user.emailVerified ? 1 : 0,
      user.avatarUrl || "",
      user.passwordHash,
      user.createdAt,
      user.lastLoginAt,
      int(user.level, 1),
      int(user.xp),
      int(user.coins),
      user.selectedBadge || "rookie",
      user.selectedTitle || progressionConfig.defaultTitle,
      user.selectedCosmetic || progressionConfig.defaultCosmetic,
      JSON.stringify(user.unlockedTitles || [progressionConfig.defaultTitle]),
      JSON.stringify(user.unlockedCosmetics || [progressionConfig.defaultCosmetic]),
    );
  }

  updateUser(userId, patch = {}) {
    const user = this.findUserById(userId);
    if (!user) return null;
    Object.assign(user, patch);
    user.xp = int(user.xp);
    user.coins = int(user.coins);
    user.level = progressionConfig.levelFromXp(user.xp).level;
    this.ensureUnlocksForLevel(user);
    this.writeUserState(user);
    return this.findUserById(userId);
  }

  writeUserState(user) {
    this.run(
      `UPDATE users SET
        username = ?, usernameKey = ?, email = ?, displayName = ?, emailVerified = ?, avatarUrl = ?, passwordHash = ?, lastLoginAt = ?, level = ?, xp = ?, coins = ?,
        selectedBadge = ?, selectedTitle = ?, selectedCosmetic = ?, unlockedTitles = ?, unlockedCosmetics = ?
       WHERE id = ?`,
      user.username,
      user.usernameKey || this.usernameKey(user.username),
      user.email || "",
      user.displayName || user.username,
      user.emailVerified ? 1 : 0,
      user.avatarUrl || "",
      user.passwordHash,
      user.lastLoginAt || nowIso(),
      int(user.level, 1),
      int(user.xp),
      int(user.coins),
      user.selectedBadge || "rookie",
      user.selectedTitle || progressionConfig.defaultTitle,
      user.selectedCosmetic || progressionConfig.defaultCosmetic,
      JSON.stringify(user.unlockedTitles || [progressionConfig.defaultTitle]),
      JSON.stringify(user.unlockedCosmetics || [progressionConfig.defaultCosmetic]),
      user.id,
    );
    this.replaceUserBadges(user.id, user.unlockedBadges || ["rookie"]);
  }

  addSession(userId, userAgent = "", suppliedToken = "") {
    const token = String(suppliedToken || this.id("sess"));
    const now = nowIso();
    const session = {
      token,
      userId,
      userAgent: String(userAgent || "").slice(0, 160),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    };
    this.run("DELETE FROM sessions WHERE userId = ? AND expiresAt < ?", userId, now);
    this.run(
      "INSERT INTO sessions (token, userId, userAgent, createdAt, lastSeenAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)",
      session.token,
      session.userId,
      session.userAgent,
      session.createdAt,
      session.lastSeenAt,
      session.expiresAt,
    );
    this.run("UPDATE users SET lastLoginAt = ? WHERE id = ?", now, userId);
    return session;
  }

  getSession(token) {
    const safe = String(token || "");
    const session = this.get("SELECT * FROM sessions WHERE token = ?", safe);
    if (!session) return null;
    if (session.expiresAt < nowIso()) {
      this.deleteSession(safe);
      return null;
    }
    this.run("UPDATE sessions SET lastSeenAt = ? WHERE token = ?", nowIso(), safe);
    return session;
  }

  deleteSession(token) {
    this.run("DELETE FROM sessions WHERE token = ?", String(token || ""));
  }

  findUserByVerifiedEmail(email) {
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) return null;
    return this.rowToUser(this.get("SELECT * FROM users WHERE lower(email) = ? AND emailVerified = 1", clean));
  }

  uniqueUsername(preferred = "Pond Player") {
    const base = this.normalizeUsername(preferred).replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Pond Player";
    if (!this.findUserByUsername(base)) return base;
    for (let suffix = 2; suffix < 10000; suffix += 1) {
      const tail = ` ${suffix}`;
      const candidate = `${base.slice(0, Math.max(1, 20 - tail.length))}${tail}`;
      if (!this.findUserByUsername(candidate)) return candidate;
    }
    return `Pond ${crypto.randomBytes(4).toString("hex")}`.slice(0, 20);
  }

  oauthAccount(provider, providerUserId) {
    return this.get("SELECT * FROM oauth_accounts WHERE provider = ? AND providerUserId = ?", String(provider), String(providerUserId));
  }

  oauthAccountForUser(userId, provider) {
    return this.get("SELECT * FROM oauth_accounts WHERE userId = ? AND provider = ?", String(userId), String(provider));
  }

  oauthAccountsFor(userId) {
    return this.all(
      `SELECT id, userId, provider, providerUserId, providerDisplayName, avatarUrl, createdAt, lastLoginAt,
              CASE WHEN providerEmailVerified = 1 THEN 1 ELSE 0 END AS emailVerified
       FROM oauth_accounts WHERE userId = ? ORDER BY provider ASC`,
      String(userId),
    );
  }

  linkOAuthAccount(userId, identity = {}) {
    const provider = String(identity.provider || "");
    const providerUserId = String(identity.providerUserId || "");
    if (!userId || !["google", "discord"].includes(provider) || !providerUserId) return { ok: false, reason: "invalid_identity" };
    const claimed = this.oauthAccount(provider, providerUserId);
    if (claimed && claimed.userId !== userId) return { ok: false, reason: "provider_already_connected", account: claimed };
    const existingForUser = this.oauthAccountForUser(userId, provider);
    if (existingForUser && existingForUser.providerUserId !== providerUserId) return { ok: false, reason: "provider_slot_used", account: existingForUser };
    const now = nowIso();
    const values = [
      String(identity.email || "").trim().slice(0, 160),
      identity.emailVerified ? 1 : 0,
      String(identity.displayName || "").trim().slice(0, 100),
      String(identity.avatarUrl || "").trim().slice(0, 500),
      now,
    ];
    if (claimed || existingForUser) {
      const account = claimed || existingForUser;
      this.run(
        `UPDATE oauth_accounts SET providerEmail = ?, providerEmailVerified = ?, providerDisplayName = ?, avatarUrl = ?, lastLoginAt = ? WHERE id = ?`,
        ...values,
        account.id,
      );
    } else {
      this.run(
        `INSERT INTO oauth_accounts
         (id, userId, provider, providerUserId, providerEmail, providerEmailVerified, providerDisplayName, avatarUrl, createdAt, lastLoginAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        this.id("oauth"),
        userId,
        provider,
        providerUserId,
        values[0],
        values[1],
        values[2],
        values[3],
        now,
        now,
      );
    }
    const user = this.findUserById(userId);
    if (user && (!user.displayName || user.displayName === user.username) && identity.displayName) user.displayName = String(identity.displayName).slice(0, 80);
    if (user && !user.avatarUrl && identity.avatarUrl) user.avatarUrl = String(identity.avatarUrl).slice(0, 500);
    if (user && !user.email && identity.emailVerified && identity.email) {
      user.email = String(identity.email).slice(0, 120);
      user.emailVerified = true;
    }
    if (user) this.writeUserState(user);
    return { ok: true, account: this.oauthAccount(provider, providerUserId), user: this.findUserById(userId) };
  }

  disconnectOAuthAccount(userId, provider) {
    const result = this.run("DELETE FROM oauth_accounts WHERE userId = ? AND provider = ?", String(userId), String(provider));
    return Number(result.changes || 0) > 0;
  }

  createOAuthState(entry = {}) {
    const now = nowIso();
    this.run("DELETE FROM oauth_states WHERE expiresAt < ?", now);
    this.run(
      `INSERT INTO oauth_states (stateHash, provider, codeVerifier, userId, mode, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      String(entry.stateHash),
      String(entry.provider),
      String(entry.codeVerifier),
      String(entry.userId || ""),
      entry.mode === "link" ? "link" : "login",
      now,
      entry.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    );
  }

  consumeOAuthState(stateHash) {
    return this.transaction(() => {
      const entry = this.get("SELECT * FROM oauth_states WHERE stateHash = ?", String(stateHash));
      if (!entry) return null;
      this.run("DELETE FROM oauth_states WHERE stateHash = ?", String(stateHash));
      return entry.expiresAt >= nowIso() ? entry : null;
    });
  }

  statsFor(userId) {
    const row = this.get("SELECT * FROM player_stats WHERE userId = ?", userId);
    if (row) return this.playerStatsFromRow(row);
    const stats = defaultStats(userId);
    this.upsertPlayerStats(stats);
    return stats;
  }

  playerStatsFromRow(row) {
    return {
      ...row,
      gamesPlayed: int(row.gamesPlayed),
      wins: int(row.wins),
      losses: int(row.losses),
      eliminations: int(row.eliminations),
      totalTilesCaptured: int(row.totalTilesCaptured),
      totalEnergyGenerated: int(row.totalEnergyGenerated),
      totalEnergySpent: int(row.totalEnergySpent),
      totalBuildingsBuilt: int(row.totalBuildingsBuilt),
      totalBuildingUpgrades: int(row.totalBuildingUpgrades),
      totalObjectivesCaptured: int(row.totalObjectivesCaptured),
      totalAbilitiesUsed: int(row.totalAbilitiesUsed),
      supportSent: int(row.supportSent),
      biggestAttackWave: int(row.biggestAttackWave),
      longestSurvivalTime: int(row.longestSurvivalTime),
      comebackWins: int(row.comebackWins),
      favoriteAnimal: row.favoriteAnimal || "duck",
    };
  }

  upsertPlayerStats(stats) {
    const merged = { ...defaultStats(stats.userId), ...stats };
    this.run(
      `INSERT INTO player_stats
       (userId, gamesPlayed, wins, losses, eliminations, totalTilesCaptured, totalEnergyGenerated, totalEnergySpent,
        totalBuildingsBuilt, totalBuildingUpgrades, totalObjectivesCaptured, totalAbilitiesUsed, supportSent,
        biggestAttackWave, longestSurvivalTime, comebackWins, favoriteAnimal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET
        gamesPlayed = excluded.gamesPlayed,
        wins = excluded.wins,
        losses = excluded.losses,
        eliminations = excluded.eliminations,
        totalTilesCaptured = excluded.totalTilesCaptured,
        totalEnergyGenerated = excluded.totalEnergyGenerated,
        totalEnergySpent = excluded.totalEnergySpent,
        totalBuildingsBuilt = excluded.totalBuildingsBuilt,
        totalBuildingUpgrades = excluded.totalBuildingUpgrades,
        totalObjectivesCaptured = excluded.totalObjectivesCaptured,
        totalAbilitiesUsed = excluded.totalAbilitiesUsed,
        supportSent = excluded.supportSent,
        biggestAttackWave = excluded.biggestAttackWave,
        longestSurvivalTime = excluded.longestSurvivalTime,
        comebackWins = excluded.comebackWins,
        favoriteAnimal = excluded.favoriteAnimal`,
      merged.userId,
      int(merged.gamesPlayed),
      int(merged.wins),
      int(merged.losses),
      int(merged.eliminations),
      int(merged.totalTilesCaptured),
      int(merged.totalEnergyGenerated),
      int(merged.totalEnergySpent),
      int(merged.totalBuildingsBuilt),
      int(merged.totalBuildingUpgrades),
      int(merged.totalObjectivesCaptured),
      int(merged.totalAbilitiesUsed),
      int(merged.supportSent),
      int(merged.biggestAttackWave),
      int(merged.longestSurvivalTime),
      int(merged.comebackWins),
      merged.favoriteAnimal || "duck",
    );
  }

  animalStatsFor(userId, animal) {
    const row = this.get("SELECT * FROM animal_stats WHERE userId = ? AND animal = ?", userId, animal);
    if (row) return this.animalStatsFromRow(row);
    const stats = defaultAnimalStats(userId, animal);
    this.upsertAnimalStats(stats);
    return stats;
  }

  animalStatsFromRow(row) {
    return {
      ...row,
      gamesPlayed: int(row.gamesPlayed),
      wins: int(row.wins),
      losses: int(row.losses),
      abilitiesUsed: int(row.abilitiesUsed),
      tilesCaptured: int(row.tilesCaptured),
      highestTerritoryPercent: num(row.highestTerritoryPercent),
      biggestAttackWave: int(row.biggestAttackWave),
      defenses: int(row.defenses),
      highestIncome: num(row.highestIncome),
    };
  }

  upsertAnimalStats(stats) {
    if (!stats?.userId || !stats?.animal) return;
    const merged = { ...defaultAnimalStats(stats.userId, stats.animal), ...stats };
    this.run(
      `INSERT INTO animal_stats
       (userId, animal, gamesPlayed, wins, losses, abilitiesUsed, tilesCaptured, highestTerritoryPercent, biggestAttackWave, defenses, highestIncome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(userId, animal) DO UPDATE SET
        gamesPlayed = excluded.gamesPlayed,
        wins = excluded.wins,
        losses = excluded.losses,
        abilitiesUsed = excluded.abilitiesUsed,
        tilesCaptured = excluded.tilesCaptured,
        highestTerritoryPercent = excluded.highestTerritoryPercent,
        biggestAttackWave = excluded.biggestAttackWave,
        defenses = excluded.defenses,
        highestIncome = excluded.highestIncome`,
      merged.userId,
      merged.animal,
      int(merged.gamesPlayed),
      int(merged.wins),
      int(merged.losses),
      int(merged.abilitiesUsed),
      int(merged.tilesCaptured),
      num(merged.highestTerritoryPercent),
      int(merged.biggestAttackWave),
      int(merged.defenses),
      num(merged.highestIncome),
    );
  }

  allAnimalStats(userId) {
    return this.all("SELECT * FROM animal_stats WHERE userId = ? ORDER BY animal ASC", userId).map((row) => this.animalStatsFromRow(row));
  }

  hasMatch(userId, matchId) {
    return Boolean(this.get("SELECT id FROM match_history WHERE userId = ? AND matchId = ?", userId, matchId));
  }

  recordMatch(userId, matchRecord, xpGained, coinsGained) {
    const user = this.findUserById(userId);
    if (!user || this.hasMatch(userId, matchRecord.matchId)) return null;
    let result;
    this.transaction(() => {
      const stats = this.statsFor(userId);
      const animalStats = this.animalStatsFor(userId, matchRecord.animal);
      const won = matchRecord.result === "win";

      stats.gamesPlayed += 1;
      stats.wins += won ? 1 : 0;
      stats.losses += won ? 0 : 1;
      stats.eliminations += int(matchRecord.eliminations);
      stats.totalTilesCaptured += int(matchRecord.tilesCaptured);
      stats.totalEnergyGenerated += int(matchRecord.energyGenerated);
      stats.totalEnergySpent += int(matchRecord.energySpent);
      stats.totalBuildingsBuilt += int(matchRecord.buildingsBuilt);
      stats.totalBuildingUpgrades += int(matchRecord.buildingUpgrades);
      stats.totalObjectivesCaptured += int(matchRecord.objectivesCaptured);
      stats.totalAbilitiesUsed += int(matchRecord.abilitiesUsed);
      stats.supportSent += int(matchRecord.supportSent);
      stats.biggestAttackWave = Math.max(int(stats.biggestAttackWave), int(matchRecord.biggestAttackWave));
      stats.longestSurvivalTime = Math.max(int(stats.longestSurvivalTime), int(matchRecord.matchDuration));
      stats.comebackWins += matchRecord.comebackWin ? 1 : 0;

      animalStats.gamesPlayed += 1;
      animalStats.wins += won ? 1 : 0;
      animalStats.losses += won ? 0 : 1;
      animalStats.abilitiesUsed += int(matchRecord.abilitiesUsed);
      animalStats.tilesCaptured += int(matchRecord.tilesCaptured);
      animalStats.highestTerritoryPercent = Math.max(num(animalStats.highestTerritoryPercent), num(matchRecord.territoryPercent));
      animalStats.biggestAttackWave = Math.max(int(animalStats.biggestAttackWave), int(matchRecord.biggestAttackWave));
      animalStats.defenses += int(matchRecord.defenses);
      animalStats.highestIncome = Math.max(num(animalStats.highestIncome), num(matchRecord.highestIncome));

      this.upsertPlayerStats(stats);
      this.upsertAnimalStats(animalStats);
      const favorite = this.allAnimalStats(userId).sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.wins - a.wins)[0];
      stats.favoriteAnimal = favorite?.animal || matchRecord.animal || stats.favoriteAnimal;
      this.upsertPlayerStats(stats);

      user.xp = int(user.xp) + int(xpGained);
      user.coins = int(user.coins) + int(coinsGained);
      user.level = progressionConfig.levelFromXp(user.xp).level;
      this.ensureUnlocksForLevel(user);
      this.writeUserState(user);

      const history = {
        id: this.id("match"),
        userId,
        createdAt: nowIso(),
        ...matchRecord,
        xpGained: int(xpGained),
        coinsGained: int(coinsGained),
      };
      this.insertMatchHistory(history);
      this.run(
        `DELETE FROM match_history
         WHERE userId = ? AND id NOT IN (
           SELECT id FROM match_history WHERE userId = ? ORDER BY createdAt DESC LIMIT 800
         )`,
        userId,
        userId,
      );
      result = { user: this.findUserById(userId), stats, animalStats, history };
    });
    return result;
  }

  insertMatchHistory(entry = {}) {
    if (!entry.userId || !entry.matchId) return;
    this.run(
      `INSERT OR IGNORE INTO match_history
       (id, userId, matchId, animal, result, rank, territoryPercent, eliminations, tilesCaptured, buildingsBuilt,
        buildingUpgrades, objectivesCaptured, abilitiesUsed, energySpent, energyGenerated, biggestAttackWave,
        matchDuration, supportSent, defenses, highestIncome, comebackWin, xpGained, coinsGained, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.id || this.id("match"),
      entry.userId,
      entry.matchId,
      entry.animal || "duck",
      entry.result || "loss",
      int(entry.rank),
      num(entry.territoryPercent),
      int(entry.eliminations),
      int(entry.tilesCaptured),
      int(entry.buildingsBuilt),
      int(entry.buildingUpgrades),
      int(entry.objectivesCaptured),
      int(entry.abilitiesUsed),
      int(entry.energySpent),
      int(entry.energyGenerated),
      int(entry.biggestAttackWave),
      int(entry.matchDuration),
      int(entry.supportSent),
      int(entry.defenses),
      num(entry.highestIncome),
      entry.comebackWin ? 1 : 0,
      int(entry.xpGained),
      int(entry.coinsGained),
      entry.createdAt || nowIso(),
    );
  }

  unlockAchievement(userId, achievement, unlockedAt = nowIso()) {
    if (this.achievementsFor(userId).some((entry) => entry.achievementId === achievement.id)) return null;
    const user = this.findUserById(userId);
    if (!user) return null;
    this.run("INSERT OR IGNORE INTO user_achievements (userId, achievementId, unlockedAt) VALUES (?, ?, ?)", userId, achievement.id, unlockedAt);
    user.xp = int(user.xp) + int(achievement.xpReward);
    user.coins = int(user.coins) + int(achievement.coinReward);
    if (achievement.badgeId) {
      user.unlockedBadges = [...new Set([...(user.unlockedBadges || ["rookie"]), achievement.badgeId])];
      this.unlockBadge(userId, achievement.badgeId, unlockedAt);
      if (!user.selectedBadge || user.selectedBadge === "rookie") user.selectedBadge = achievement.badgeId;
    }
    user.level = progressionConfig.levelFromXp(user.xp).level;
    this.ensureUnlocksForLevel(user);
    this.writeUserState(user);
    return { unlock: { userId, achievementId: achievement.id, unlockedAt }, user: this.findUserById(userId) };
  }

  achievementsFor(userId) {
    return this.all(
      `SELECT ua.userId, ua.achievementId, ua.unlockedAt
       FROM user_achievements ua
       WHERE ua.userId = ?
       ORDER BY ua.unlockedAt ASC`,
      userId,
    );
  }

  badgesFor(userId) {
    return this.all("SELECT userId, badgeId, unlockedAt FROM user_badges WHERE userId = ? ORDER BY unlockedAt ASC", userId);
  }

  unlockBadge(userId, badgeId, unlockedAt = nowIso()) {
    if (!badgeConfig.some((badge) => badge.id === badgeId)) return false;
    this.run("INSERT OR IGNORE INTO user_badges (userId, badgeId, unlockedAt) VALUES (?, ?, ?)", userId, badgeId, unlockedAt);
    return true;
  }

  replaceUserBadges(userId, badges = []) {
    const unique = [...new Set(badges.length ? badges : ["rookie"])].filter((badgeId) => badgeConfig.some((badge) => badge.id === badgeId));
    unique.forEach((badgeId) => this.unlockBadge(userId, badgeId));
  }

  matchHistoryFor(userId, limit = 20) {
    return this.all(
      "SELECT * FROM match_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
      userId,
      Math.max(1, Math.min(100, int(limit, 20))),
    ).map((entry) => ({ ...entry, comebackWin: Boolean(entry.comebackWin) }));
  }

  ensureUnlocksForLevel(user) {
    const level = user.level || 1;
    user.unlockedBadges = [...new Set(user.unlockedBadges?.length ? user.unlockedBadges : ["rookie"])];
    user.unlockedTitles = [
      ...new Set([
        ...(user.unlockedTitles?.length ? user.unlockedTitles : [progressionConfig.defaultTitle]),
        ...progressionConfig.titles.filter((title) => level >= title.unlockLevel).map((title) => title.id),
      ]),
    ];
    user.unlockedCosmetics = [
      ...new Set([
        ...(user.unlockedCosmetics?.length ? user.unlockedCosmetics : [progressionConfig.defaultCosmetic]),
        ...progressionConfig.cosmetics.filter((cosmetic) => level >= cosmetic.unlockLevel).map((cosmetic) => cosmetic.id),
      ]),
    ];
    if (!badgeConfig.some((badge) => badge.id === user.selectedBadge) || !user.unlockedBadges.includes(user.selectedBadge)) {
      user.selectedBadge = user.unlockedBadges[0] || "rookie";
    }
    if (!user.unlockedTitles.includes(user.selectedTitle)) user.selectedTitle = user.unlockedTitles[0] || progressionConfig.defaultTitle;
    if (!user.unlockedCosmetics.includes(user.selectedCosmetic)) user.selectedCosmetic = user.unlockedCosmetics[0] || progressionConfig.defaultCosmetic;
  }
}

module.exports = PondDatabase;
