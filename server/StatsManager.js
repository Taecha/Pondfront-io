const progression = require("../shared/progressionConfig");

class StatsManager {
  constructor(db, achievementManager) {
    this.db = db;
    this.achievementManager = achievementManager;
  }

  recordMatch(game) {
    if (!game || !game.ended || game.accountRewardsRecorded) return [];
    if (game.matchSettings?.sandbox?.enabled) return [];
    game.accountRewardsRecorded = true;
    game.accountRewardsByPlayer = game.accountRewardsByPlayer || {};
    const playable = Math.max(1, game.tileManager?.playable?.().length || game.playable || 1);
    const ranked = game.players
      .slice()
      .sort((a, b) => b.territory - a.territory || (b.stats?.tilesCaptured || 0) - (a.stats?.tilesCaptured || 0));
    const rewards = [];
    game.players
      .filter((player) => !player.isBot && player.accountUserId)
      .forEach((player) => {
        const reward = this.recordPlayer(game, player, ranked, playable);
        if (!reward) return;
        player.matchRewards = reward;
        game.accountRewardsByPlayer[player.id] = reward;
        rewards.push(reward);
        game.pushEvent({
          kind: "profileRewards",
          playerId: player.id,
          xpGained: reward.xpGained,
          coinsGained: reward.coinsGained,
          levelBefore: reward.levelBefore,
          levelAfter: reward.levelAfter,
          achievements: reward.achievements.map((entry) => ({ id: entry.id, name: entry.name, badgeIcon: entry.badgeIcon })),
          message: `${player.name} earned ${reward.xpGained} XP and ${reward.coinsGained} coins.`,
          at: game.now(),
        });
        reward.achievements.forEach((achievement) => {
          game.pushEvent({
            kind: "achievementUnlocked",
            playerId: player.id,
            achievementId: achievement.id,
            name: achievement.name,
            badgeIcon: achievement.badgeIcon,
            xpReward: achievement.xpReward,
            coinReward: achievement.coinReward,
            message: `Achievement unlocked: ${achievement.name}.`,
            at: game.now(),
          });
        });
      });
    return rewards;
  }

  recordPlayer(game, player, ranked, playable) {
    const user = this.db.findUserById(player.accountUserId);
    if (!user || this.db.hasMatch(user.id, game.matchId)) return null;
    console.log(`[STATS] saving match for userId=${user.id} matchId=${game.matchId}`);
    const winningTeam = game.winnerTeamId && player.teamId && player.teamId === game.winnerTeamId;
    const won = winningTeam || player.id === game.winnerId;
    const elapsed = Math.round(game.elapsed ? game.elapsed() : 0);
    const rank = ranked.findIndex((entry) => entry.id === player.id) + 1;
    const stats = player.stats || {};
    const territoryPercent = Math.round((player.territory / playable) * 1000) / 10;
    const xpBase = this.calculateXp(player, won, elapsed);
    const coinsBase = Math.max(5, Math.round(xpBase / (progression.rewards.coinDivisor || 10)));
    const levelBefore = user.level || 1;
    const xpBefore = user.xp || 0;
    const matchRecord = {
      matchId: game.matchId,
      animal: player.animal,
      result: won ? "win" : "loss",
      rank,
      territoryPercent,
      eliminations: stats.playersDefeated || 0,
      tilesCaptured: stats.tilesCaptured || 0,
      buildingsBuilt: stats.buildingsBuilt || 0,
      buildingUpgrades: stats.buildingUpgrades || 0,
      objectivesCaptured: stats.objectivesCaptured || 0,
      abilitiesUsed: stats.abilitiesUsed || 0,
      energySpent: Math.round(stats.energyUsed || 0),
      energyGenerated: Math.round((stats.incomePeak || player.income || 0) * Math.max(20, elapsed) * 0.55),
      biggestAttackWave: stats.bestAttackWave || 0,
      matchDuration: elapsed,
      supportSent: Math.round(stats.supportSent || 0),
      defenses: stats.defenses || 0,
      highestIncome: Number(stats.incomePeak || player.income || 0),
      comebackWin: Boolean(won && (player.flags?.lastNestProtection || player.flags?.coreLastStandUsed || player.stats?.surrenderedEnemies)),
    };
    const saved = this.db.recordMatch(user.id, matchRecord, xpBase, coinsBase);
    if (!saved) return null;
    console.log(`[STATS] ${matchRecord.result} updated userId=${user.id} games=${saved.stats.gamesPlayed} wins=${saved.stats.wins} losses=${saved.stats.losses}`);
    const achievementUnlocks = this.achievementManager.unlockEligible(user.id, matchRecord);
    const freshUser = this.db.findUserById(user.id);
    const levelAfter = freshUser?.level || saved.user.level || levelBefore;
    const xpAfter = freshUser?.xp || saved.user.xp || xpBefore;
    const totalAchievementXp = achievementUnlocks.reduce((sum, entry) => sum + (entry.xpReward || 0), 0);
    const totalAchievementCoins = achievementUnlocks.reduce((sum, entry) => sum + (entry.coinReward || 0), 0);
    return {
      userId: user.id,
      playerId: player.id,
      username: user.username,
      matchId: game.matchId,
      result: matchRecord.result,
      rank,
      animal: player.animal,
      xpGained: xpBase + totalAchievementXp,
      coinsGained: coinsBase + totalAchievementCoins,
      matchXp: xpBase,
      matchCoins: coinsBase,
      levelBefore,
      levelAfter,
      xpBefore,
      xpAfter,
      achievements: achievementUnlocks,
      match: matchRecord,
    };
  }

  calculateXp(player, won, elapsed) {
    const stats = player.stats || {};
    const rewards = progression.rewards;
    let xp = rewards.playMatch;
    if (won) xp += rewards.winMatch;
    xp += (stats.playersDefeated || 0) * rewards.elimination;
    xp += (stats.objectivesCaptured || 0) * rewards.objective;
    xp += (stats.buildingsBuilt || 0) * rewards.building;
    xp += (stats.buildingUpgrades || 0) * rewards.upgrade;
    xp += Math.min(5, stats.abilitiesUsed || 0) * rewards.ability;
    if (elapsed >= 900) xp += rewards.longSurvival;
    xp += Math.min(70, Math.floor((stats.tilesCaptured || 0) / 5) * 3);
    return Math.max(20, Math.round(xp));
  }
}

module.exports = StatsManager;
