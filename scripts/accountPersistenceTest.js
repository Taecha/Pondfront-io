const fs = require("fs");
const path = require("path");
const PondDatabase = require("../server/db");
const AuthManager = require("../server/AuthManager");
const AchievementManager = require("../server/AchievementManager");
const MatchHistoryManager = require("../server/MatchHistoryManager");
const ProfileManager = require("../server/ProfileManager");

const checks = [];
const databaseFile = path.join(__dirname, "..", "data", `.qa-account-${process.pid}-${Date.now()}.db`);

function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
  };
}

function cookieFrom(response) {
  return String(response.headers["set-cookie"] || "").split(";")[0];
}

let db;
let reopened;
try {
  db = new PondDatabase(databaseFile);
  const auth = new AuthManager(db);
  const signupResponse = responseRecorder();
  const username = `QA_${process.pid}`;
  const signup = auth.signup(
    { username, password: "pondpass7", confirmPassword: "pondpass7" },
    { headers: { "user-agent": "PondFront QA" } },
    signupResponse,
  );
  const cookie = cookieFrom(signupResponse);
  check("signup creates account and secure session", signup.ok && cookie.startsWith("pond_session="), signup.message);

  const signedIn = auth.currentUser({ headers: { cookie } });
  check("session restores signed-in user", signedIn?.username === username, signedIn?.username || "missing");
  const wrongLogin = auth.login(
    { username, password: "wrong-password" },
    { headers: { "user-agent": "PondFront QA" } },
    responseRecorder(),
  );
  check("wrong password is rejected", !wrongLogin.ok && wrongLogin.status === 401, wrongLogin.message);

  const matchRecord = {
    matchId: `qa-match-${Date.now()}`,
    animal: "duck",
    result: "win",
    rank: 1,
    territoryPercent: 72,
    eliminations: 1,
    tilesCaptured: 40,
    buildingsBuilt: 2,
    buildingUpgrades: 1,
    objectivesCaptured: 1,
    abilitiesUsed: 1,
    energySpent: 120,
    energyGenerated: 180,
    biggestAttackWave: 24,
    matchDuration: 300,
    supportSent: 0,
    defenses: 2,
    highestIncome: 8,
    comebackWin: false,
  };
  const recorded = db.recordMatch(signedIn.id, matchRecord, 50, 8);
  const achievementManager = new AchievementManager(db);
  const unlocked = achievementManager.unlockEligible(signedIn.id, matchRecord);
  check("match stats and history save", recorded?.stats?.gamesPlayed === 1 && db.matchHistoryFor(signedIn.id, 5).length === 1);
  check("eligible achievements and badges unlock", unlocked.some((entry) => entry.id === "pond_winner") && db.findUserById(signedIn.id).unlockedBadges.includes("first_win"), unlocked.map((entry) => entry.id).join(", "));

  const profileManager = new ProfileManager(db, new MatchHistoryManager(db));
  const selected = profileManager.selectBadge(signedIn.id, "first_win");
  check("unlocked badge can be selected", selected.ok && selected.profile.user.selectedBadge === "first_win", selected.message);
  const renamed = profileManager.updateDisplayName(signedIn.id, "QA Pond Captain");
  check("display name updates without changing login username", renamed.ok && db.findUserById(signedIn.id).username === username, renamed.message);
  db.close();
  db = null;

  reopened = new PondDatabase(databaseFile);
  const authAfterRestart = new AuthManager(reopened);
  const restoredUser = authAfterRestart.currentUser({ headers: { cookie } });
  const restoredProfile = new ProfileManager(reopened, new MatchHistoryManager(reopened)).profile(restoredUser?.id);
  check("session survives database restart", restoredUser?.username === username, restoredUser?.username || "missing");
  check(
    "profile, badge, stats, achievements, and history survive restart",
      restoredProfile?.user?.selectedBadge === "first_win" &&
      restoredProfile?.user?.displayName === "QA Pond Captain" &&
      restoredProfile?.stats?.gamesPlayed === 1 &&
      restoredProfile?.recentMatches?.length === 1 &&
      restoredProfile?.achievements?.some((entry) => entry.id === "pond_winner" && entry.unlocked),
    restoredProfile ? `${restoredProfile.stats.gamesPlayed} game, ${restoredProfile.recentMatches.length} history` : "missing",
  );
} finally {
  db?.close?.();
  reopened?.close?.();
  [databaseFile, `${databaseFile}-wal`, `${databaseFile}-shm`].forEach((file) => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
}

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
