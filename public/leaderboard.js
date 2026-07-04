(function initPondGlobalLeaderboard(root) {
  const CATEGORIES = [
    ["highestLevel", "Highest Level"],
    ["mostWins", "Most Wins"],
    ["highestWinRate", "Best Win Rate"],
    ["mostTilesCaptured", "Tiles Captured"],
    ["mostEliminations", "Eliminations"],
    ["bestDuck", "Best Duck"],
    ["bestSnake", "Best Snake"],
    ["bestFrog", "Best Frog"],
    ["bestTurtle", "Best Turtle"],
    ["bestCarp", "Best Carp"],
  ];

  class PondGlobalLeaderboard {
    constructor(options = {}) {
      this.escape = options.escape || ((value) => String(value ?? ""));
    }

    async render(category = "highestLevel") {
      const data = await this.request(`/api/leaderboard?category=${encodeURIComponent(category)}&limit=12`);
      const rows = data.leaderboard?.rows || [];
      return `<div class="global-leaderboard">
        <label>Category<select data-global-leaderboard-category>${CATEGORIES.map(
          ([id, label]) => `<option value="${id}" ${id === category ? "selected" : ""}>${this.escape(label)}</option>`,
        ).join("")}</select></label>
        <ol>${rows
          .map(
            (row, index) => `<li>
              <span>#${index + 1}</span>
              <strong>${this.escape(row.username)}</strong>
              <em>${this.formatValue(category, row.value)}</em>
            </li>`,
          )
          .join("") || `<li><span>-</span><strong>No ranked players yet</strong><em>Play a saved match</em></li>`}</ol>
      </div>`;
    }

    formatValue(category, value) {
      if (category === "highestWinRate") return `${Math.round(Number(value || 0) * 100)}%`;
      if (category.startsWith("best")) return `${Math.round(Number(value || 0))} pts`;
      return String(Math.round(Number(value || 0)));
    }

    async request(path, options = {}) {
      const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Connection error.");
      return data;
    }
  }

  root.PondGlobalLeaderboard = PondGlobalLeaderboard;
})(window);
