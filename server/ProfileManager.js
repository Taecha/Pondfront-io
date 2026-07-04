const animals = require("../shared/animals");
const achievements = require("../shared/achievementConfig");
const badges = require("../shared/badgeConfig");
const progression = require("../shared/progressionConfig");

class ProfileManager {
  constructor(db, matchHistoryManager) {
    this.db = db;
    this.matchHistory = matchHistoryManager;
  }

  profile(userId) {
    const user = this.db.findUserById(userId);
    if (!user) return null;
    const stats = this.db.statsFor(userId);
    const levelInfo = progression.levelFromXp(user.xp || 0);
    const unlockedAchievements = this.db.achievementsFor(userId);
    const achievementMap = new Map(unlockedAchievements.map((entry) => [entry.achievementId, entry]));
    const titleMap = new Map(progression.titles.map((title) => [title.id, title]));
    const badgeMap = new Map(badges.map((badge) => [badge.id, badge]));
    const cosmeticMap = new Map(progression.cosmetics.map((cosmetic) => [cosmetic.id, cosmetic]));

    return {
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        level: user.level || levelInfo.level,
        xp: user.xp || 0,
        coins: user.coins || 0,
        selectedBadge: user.selectedBadge || "rookie",
        selectedBadgeLabel: badgeMap.get(user.selectedBadge)?.label || "Pond Rookie Badge",
        selectedBadgeIcon: badgeMap.get(user.selectedBadge)?.icon || "R",
        selectedTitle: user.selectedTitle || progression.defaultTitle,
        selectedTitleLabel: titleMap.get(user.selectedTitle)?.label || "Pond Rookie",
        selectedCosmetic: user.selectedCosmetic || progression.defaultCosmetic,
        selectedCosmeticLabel: cosmeticMap.get(user.selectedCosmetic)?.label || "Clear Ripple Border",
        unlockedBadges: user.unlockedBadges || ["rookie"],
        unlockedTitles: user.unlockedTitles || [progression.defaultTitle],
        unlockedCosmetics: user.unlockedCosmetics || [progression.defaultCosmetic],
        levelProgress: levelInfo,
      },
      stats: {
        ...stats,
        winRate: stats.gamesPlayed ? stats.wins / stats.gamesPlayed : 0,
      },
      animals: Object.keys(animals).map((animal) => {
        const entry = this.db.animalStatsFor(userId, animal);
        return {
          ...entry,
          label: animals[animal].label,
          icon: animals[animal].icon,
          winRate: entry.gamesPlayed ? entry.wins / entry.gamesPlayed : 0,
        };
      }),
      achievements: achievements.map((achievement) => ({
        ...achievement,
        unlocked: achievementMap.has(achievement.id),
        unlockedAt: achievementMap.get(achievement.id)?.unlockedAt || null,
      })),
      badges: badges.map((badge) => ({
        ...badge,
        unlocked: (user.unlockedBadges || []).includes(badge.id),
        selected: user.selectedBadge === badge.id,
      })),
      titles: progression.titles.map((title) => ({
        ...title,
        unlocked: (user.unlockedTitles || []).includes(title.id),
        selected: user.selectedTitle === title.id,
      })),
      cosmetics: progression.cosmetics.map((cosmetic) => ({
        ...cosmetic,
        unlocked: (user.unlockedCosmetics || []).includes(cosmetic.id),
        selected: user.selectedCosmetic === cosmetic.id,
      })),
      recentMatches: this.matchHistory.list(userId, 16),
    };
  }

  selectBadge(userId, badgeId) {
    const user = this.db.findUserById(userId);
    if (!user) return { ok: false, message: "Login required." };
    if (!(user.unlockedBadges || []).includes(badgeId)) return { ok: false, message: "Badge is locked." };
    this.db.updateUser(userId, { selectedBadge: badgeId });
    return { ok: true, message: "Badge selected.", profile: this.profile(userId) };
  }

  selectTitle(userId, titleId) {
    const user = this.db.findUserById(userId);
    if (!user) return { ok: false, message: "Login required." };
    if (!(user.unlockedTitles || []).includes(titleId)) return { ok: false, message: "Title is locked." };
    this.db.updateUser(userId, { selectedTitle: titleId });
    return { ok: true, message: "Title selected.", profile: this.profile(userId) };
  }

  selectCosmetic(userId, cosmeticId) {
    const user = this.db.findUserById(userId);
    if (!user) return { ok: false, message: "Login required." };
    if (!(user.unlockedCosmetics || []).includes(cosmeticId)) return { ok: false, message: "Cosmetic is locked." };
    this.db.updateUser(userId, { selectedCosmetic: cosmeticId });
    return { ok: true, message: "Cosmetic selected.", profile: this.profile(userId) };
  }

  leaderboard(category = "highestLevel", limit = 20) {
    const rows = this.db.data.users
      .map((user) => {
        const stats = this.db.statsFor(user.id);
        const animalStats = this.db.allAnimalStats(user.id);
        const bestAnimal = (animal) => animalStats.find((entry) => entry.animal === animal) || { wins: 0, gamesPlayed: 0, highestTerritoryPercent: 0 };
        const values = {
          mostWins: stats.wins || 0,
          highestWinRate: stats.gamesPlayed >= 3 ? (stats.wins || 0) / stats.gamesPlayed : 0,
          mostTilesCaptured: stats.totalTilesCaptured || 0,
          mostEliminations: stats.eliminations || 0,
          highestLevel: user.level || 1,
          bestDuck: bestAnimal("duck").wins * 100 + bestAnimal("duck").highestTerritoryPercent,
          bestSnake: bestAnimal("snake").wins * 100 + bestAnimal("snake").highestTerritoryPercent,
          bestFrog: bestAnimal("frog").wins * 100 + bestAnimal("frog").highestTerritoryPercent,
          bestTurtle: bestAnimal("turtle").wins * 100 + bestAnimal("turtle").highestTerritoryPercent,
          bestCarp: bestAnimal("carp").wins * 100 + bestAnimal("carp").highestTerritoryPercent,
        };
        return {
          userId: user.id,
          username: user.username,
          level: user.level || 1,
          selectedBadge: user.selectedBadge || "rookie",
          selectedTitle: user.selectedTitle || progression.defaultTitle,
          value: Number(values[category] ?? values.highestLevel),
          stats,
        };
      })
      .filter((row) => row.stats.gamesPlayed > 0 || category === "highestLevel")
      .sort((a, b) => b.value - a.value || b.level - a.level)
      .slice(0, Math.max(1, Math.min(50, Number(limit) || 20)));
    return { category, rows };
  }
}

module.exports = ProfileManager;
