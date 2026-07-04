const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const progressionConfig = require("../shared/progressionConfig");
const badgeConfig = require("../shared/badgeConfig");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_FILE = path.join(DATA_DIR, "pondfront-db.json");

function nowIso() {
  return new Date().toISOString();
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

function emptyData() {
  return {
    meta: {
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    users: [],
    sessions: [],
    playerStats: {},
    animalStats: {},
    userAchievements: [],
    matchHistory: [],
  };
}

class PondDatabase {
  constructor(filePath = process.env.PONDFRONT_DB || DEFAULT_FILE) {
    this.filePath = filePath;
    this.data = emptyData();
    this.load();
  }

  load() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.save();
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.data = { ...emptyData(), ...parsed };
      this.data.playerStats = this.data.playerStats || {};
      this.data.animalStats = this.data.animalStats || {};
      this.data.userAchievements = this.data.userAchievements || [];
      this.data.matchHistory = this.data.matchHistory || [];
      this.data.sessions = this.data.sessions || [];
      this.data.users = this.data.users || [];
    } catch {
      const backup = `${this.filePath}.${Date.now()}.broken`;
      if (fs.existsSync(this.filePath)) fs.copyFileSync(this.filePath, backup);
      this.data = emptyData();
      this.save();
    }
  }

  save() {
    this.data.meta.updatedAt = nowIso();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  id(prefix) {
    return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
  }

  normalizeUsername(username) {
    return String(username || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 18);
  }

  usernameKey(username) {
    return this.normalizeUsername(username).toLowerCase();
  }

  findUserByUsername(username) {
    const key = this.usernameKey(username);
    return this.data.users.find((user) => user.usernameKey === key) || null;
  }

  findUserById(userId) {
    return this.data.users.find((user) => user.id === userId) || null;
  }

  createUser({ username, passwordHash, email = "" }) {
    const cleanUsername = this.normalizeUsername(username);
    const user = {
      id: this.id("user"),
      username: cleanUsername,
      usernameKey: this.usernameKey(cleanUsername),
      email: String(email || "").trim().slice(0, 120),
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
    this.data.users.push(user);
    this.data.playerStats[user.id] = defaultStats(user.id);
    this.save();
    return user;
  }

  updateUser(userId, patch = {}) {
    const user = this.findUserById(userId);
    if (!user) return null;
    Object.assign(user, patch);
    const levelInfo = progressionConfig.levelFromXp(user.xp || 0);
    user.level = levelInfo.level;
    this.ensureUnlocksForLevel(user);
    this.save();
    return user;
  }

  addSession(userId, userAgent = "") {
    const token = this.id("sess");
    const session = {
      token,
      userId,
      userAgent: String(userAgent || "").slice(0, 160),
      createdAt: nowIso(),
      lastSeenAt: nowIso(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    };
    this.data.sessions = this.data.sessions.filter((entry) => !(entry.userId === userId && entry.expiresAt < nowIso()));
    this.data.sessions.push(session);
    this.updateUser(userId, { lastLoginAt: nowIso() });
    this.save();
    return session;
  }

  getSession(token) {
    const safe = String(token || "");
    const session = this.data.sessions.find((entry) => entry.token === safe);
    if (!session || session.expiresAt < nowIso()) return null;
    session.lastSeenAt = nowIso();
    return session;
  }

  deleteSession(token) {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((entry) => entry.token !== token);
    if (this.data.sessions.length !== before) this.save();
  }

  statsFor(userId) {
    if (!this.data.playerStats[userId]) this.data.playerStats[userId] = defaultStats(userId);
    return this.data.playerStats[userId];
  }

  animalStatsFor(userId, animal) {
    const key = `${userId}:${animal}`;
    if (!this.data.animalStats[key]) this.data.animalStats[key] = defaultAnimalStats(userId, animal);
    return this.data.animalStats[key];
  }

  allAnimalStats(userId) {
    return Object.values(this.data.animalStats).filter((entry) => entry.userId === userId);
  }

  hasMatch(userId, matchId) {
    return this.data.matchHistory.some((entry) => entry.userId === userId && entry.matchId === matchId);
  }

  recordMatch(userId, matchRecord, xpGained, coinsGained) {
    const user = this.findUserById(userId);
    if (!user || this.hasMatch(userId, matchRecord.matchId)) return null;
    const stats = this.statsFor(userId);
    const animalStats = this.animalStatsFor(userId, matchRecord.animal);
    const won = matchRecord.result === "win";

    stats.gamesPlayed += 1;
    stats.wins += won ? 1 : 0;
    stats.losses += won ? 0 : 1;
    stats.eliminations += matchRecord.eliminations || 0;
    stats.totalTilesCaptured += matchRecord.tilesCaptured || 0;
    stats.totalEnergyGenerated += matchRecord.energyGenerated || 0;
    stats.totalEnergySpent += matchRecord.energySpent || 0;
    stats.totalBuildingsBuilt += matchRecord.buildingsBuilt || 0;
    stats.totalBuildingUpgrades += matchRecord.buildingUpgrades || 0;
    stats.totalObjectivesCaptured += matchRecord.objectivesCaptured || 0;
    stats.totalAbilitiesUsed += matchRecord.abilitiesUsed || 0;
    stats.supportSent += matchRecord.supportSent || 0;
    stats.biggestAttackWave = Math.max(stats.biggestAttackWave || 0, matchRecord.biggestAttackWave || 0);
    stats.longestSurvivalTime = Math.max(stats.longestSurvivalTime || 0, matchRecord.matchDuration || 0);
    stats.comebackWins += matchRecord.comebackWin ? 1 : 0;

    animalStats.gamesPlayed += 1;
    animalStats.wins += won ? 1 : 0;
    animalStats.losses += won ? 0 : 1;
    animalStats.abilitiesUsed += matchRecord.abilitiesUsed || 0;
    animalStats.tilesCaptured += matchRecord.tilesCaptured || 0;
    animalStats.highestTerritoryPercent = Math.max(animalStats.highestTerritoryPercent || 0, matchRecord.territoryPercent || 0);
    animalStats.biggestAttackWave = Math.max(animalStats.biggestAttackWave || 0, matchRecord.biggestAttackWave || 0);
    animalStats.defenses += matchRecord.defenses || 0;
    animalStats.highestIncome = Math.max(animalStats.highestIncome || 0, matchRecord.highestIncome || 0);

    const favorite = this.allAnimalStats(userId).sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.wins - a.wins)[0];
    stats.favoriteAnimal = favorite?.animal || matchRecord.animal || stats.favoriteAnimal;

    user.xp = Math.max(0, Math.round((user.xp || 0) + xpGained));
    user.coins = Math.max(0, Math.round((user.coins || 0) + coinsGained));
    const levelInfo = progressionConfig.levelFromXp(user.xp);
    user.level = levelInfo.level;
    this.ensureUnlocksForLevel(user);

    const history = {
      id: this.id("match"),
      userId,
      createdAt: nowIso(),
      ...matchRecord,
      xpGained,
      coinsGained,
    };
    this.data.matchHistory.unshift(history);
    this.data.matchHistory = this.data.matchHistory.slice(0, 800);
    this.save();
    return { user, stats, animalStats, history };
  }

  unlockAchievement(userId, achievement, unlockedAt = nowIso()) {
    if (this.data.userAchievements.some((entry) => entry.userId === userId && entry.achievementId === achievement.id)) return null;
    const user = this.findUserById(userId);
    if (!user) return null;
    const unlock = {
      userId,
      achievementId: achievement.id,
      unlockedAt,
    };
    this.data.userAchievements.push(unlock);
    user.xp = Math.max(0, Math.round((user.xp || 0) + (achievement.xpReward || 0)));
    user.coins = Math.max(0, Math.round((user.coins || 0) + (achievement.coinReward || 0)));
    if (achievement.badgeId) {
      user.unlockedBadges = [...new Set([...(user.unlockedBadges || ["rookie"]), achievement.badgeId])];
      if (!user.selectedBadge || user.selectedBadge === "rookie") user.selectedBadge = achievement.badgeId;
    }
    const levelInfo = progressionConfig.levelFromXp(user.xp);
    user.level = levelInfo.level;
    this.ensureUnlocksForLevel(user);
    this.save();
    return { unlock, user };
  }

  achievementsFor(userId) {
    return this.data.userAchievements.filter((entry) => entry.userId === userId);
  }

  matchHistoryFor(userId, limit = 20) {
    return this.data.matchHistory.filter((entry) => entry.userId === userId).slice(0, limit);
  }

  ensureUnlocksForLevel(user) {
    const level = user.level || 1;
    user.unlockedBadges = [...new Set(user.unlockedBadges || ["rookie"])];
    user.unlockedTitles = [
      ...new Set([
        ...(user.unlockedTitles || [progressionConfig.defaultTitle]),
        ...progressionConfig.titles.filter((title) => level >= title.unlockLevel).map((title) => title.id),
      ]),
    ];
    user.unlockedCosmetics = [
      ...new Set([
        ...(user.unlockedCosmetics || [progressionConfig.defaultCosmetic]),
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
