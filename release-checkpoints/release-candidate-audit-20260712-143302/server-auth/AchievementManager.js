const achievements = require("../shared/achievementConfig");

class AchievementManager {
  constructor(db) {
    this.db = db;
  }

  unlockEligible(userId, matchRecord = {}) {
    const stats = this.db.statsFor(userId);
    const animalStats = this.db.allAnimalStats(userId);
    const unlocked = [];
    achievements.forEach((achievement) => {
      if (this.db.achievementsFor(userId).some((entry) => entry.achievementId === achievement.id)) return;
      if (!this.isComplete(achievement, stats, animalStats, matchRecord)) return;
      const result = this.db.unlockAchievement(userId, achievement);
      if (result) {
        console.log(`[ACHIEVEMENT] unlocked userId=${userId} achievement=${achievement.id}`);
        if (achievement.badgeId) console.log(`[BADGE] unlocked userId=${userId} badge=${achievement.badgeId}`);
        unlocked.push({ ...achievement, unlockedAt: result.unlock.unlockedAt });
      }
    });
    return unlocked;
  }

  isComplete(achievement, stats, animalStats, matchRecord) {
    const threshold = Number(achievement.threshold || 1);
    const animalEntry = achievement.animal ? animalStats.find((entry) => entry.animal === achievement.animal) : null;
    switch (achievement.conditionType) {
      case "gamesPlayed":
      case "wins":
      case "totalBuildingsBuilt":
      case "totalBuildingUpgrades":
      case "totalObjectivesCaptured":
      case "biggestAttackWave":
      case "longestSurvivalTime":
      case "comebackWins":
      case "supportSent":
        return Number(stats[achievement.conditionType] || 0) >= threshold;
      case "animalWins":
        return Number(animalEntry?.wins || 0) >= threshold;
      case "animalWave":
        return Number(animalEntry?.biggestAttackWave || 0) >= threshold || (matchRecord.animal === achievement.animal && Number(matchRecord.biggestAttackWave || 0) >= threshold);
      case "animalDefenses":
        return Number(animalEntry?.defenses || 0) >= threshold;
      case "animalIncome":
        return Number(animalEntry?.highestIncome || 0) >= threshold;
      default:
        return false;
    }
  }
}

module.exports = AchievementManager;
