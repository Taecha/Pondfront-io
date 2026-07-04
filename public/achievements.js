(function initPondAchievementView(root) {
  const AchievementView = {
    render(profile, escape) {
      const safe = escape || ((value) => String(value ?? ""));
      const achievements = profile?.achievements || [];
      if (!achievements.length) return `<p class="profile-empty">No achievements loaded yet.</p>`;
      return `<div class="achievement-grid">${achievements
        .map(
          (achievement) => `<article class="achievement-card ${achievement.unlocked ? "unlocked" : "locked"}">
            <span>${safe(achievement.badgeIcon || "?")}</span>
            <div>
              <strong>${safe(achievement.name)}</strong>
              <p>${safe(achievement.description)}</p>
              <small>${achievement.unlocked ? `Unlocked ${safe(formatDate(achievement.unlockedAt))}` : `Reward: ${achievement.xpReward || 0} XP / ${achievement.coinReward || 0} coins`}</small>
            </div>
          </article>`,
        )
        .join("")}</div>`;
    },
  };

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  root.PondAchievementView = AchievementView;
})(window);
