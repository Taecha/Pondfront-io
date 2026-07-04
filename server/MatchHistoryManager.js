class MatchHistoryManager {
  constructor(db) {
    this.db = db;
  }

  list(userId, limit = 20) {
    return this.db.matchHistoryFor(userId, limit);
  }
}

module.exports = MatchHistoryManager;
