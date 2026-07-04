# PondFront.io Account, Profile, and Progression Report

## What Was Added

- Guest mode remains available. Guests can play normally, but the lobby reminds them that long-term progress requires an account.
- Sign up, login, logout, and current-session checks were added with secure httpOnly cookies.
- Passwords are hashed on the server with Node `crypto.scrypt`; plain passwords are never stored.
- A local persistent database was added at `data/pondfront-db.json` for prototype accounts, sessions, stats, achievements, and match history.
- Server-side match rewards were added. The client cannot submit fake wins, XP, coins, or achievements.
- Player profiles now include level, XP, coins, badge, title, stats, animal stats, achievements, match history, cosmetics, and global leaderboard.
- Match-end rewards now show XP, coins, level progress, and unlocked achievements.
- Lobby rows and in-game leaderboard rows can show lightweight account badge/title info without cluttering the map.

## New Backend Files

- `server/db.js`
- `server/AuthManager.js`
- `server/ProfileManager.js`
- `server/StatsManager.js`
- `server/AchievementManager.js`
- `server/MatchHistoryManager.js`

## New Shared Config

- `shared/progressionConfig.js`
- `shared/badgeConfig.js`
- `shared/achievementConfig.js`

## New Client Files

- `public/auth.js`
- `public/profile.js`
- `public/achievements.js`
- `public/leaderboard.js`

## API Routes Added

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/profile/me`
- `GET /api/profile/:userId`
- `POST /api/profile/select-badge`
- `POST /api/profile/select-title`
- `POST /api/profile/select-cosmetic`
- `GET /api/stats/me`
- `GET /api/leaderboard`

## Server-Side Reward Rules

- Play match: +20 XP
- Win match: +100 XP
- Elimination: +25 XP
- Objective capture: +20 XP
- Building built: +5 XP
- Building upgraded: +10 XP
- Ability use: +10 XP, capped per match
- Long survival bonus: +35 XP
- Coins are awarded from XP and achievement rewards.

## Achievements Added

- First Steps
- Pond Winner
- Duck Rush
- Snake Strike
- Frog Leap
- Shell Wall
- Golden Current
- Builder
- Architect
- Wave Master
- Objective Hunter
- Comeback Animal
- Team Player
- Survivor
- Lake Emperor

## Testing Completed

1. Guest session check returned guest mode successfully.
2. Created a new account successfully.
3. Started a logged-in no-bot test match.
4. Server ended the match and awarded saved rewards.
5. Profile saved 1 game played and 1 win.
6. Achievements unlocked after the real server-side match result.
7. Match history appeared in the profile.
8. Global leaderboard returned the saved account.
9. Logout worked.
10. Login worked again with the same account.
11. Syntax checks passed for the new shared, server, and client files.

## Notes

- The database is file-backed for the local prototype so it works immediately without installing SQLite/Postgres packages.
- The manager files keep the account system isolated, so it can be moved to SQLite or PostgreSQL later.
- Guest play is intentionally unchanged and does not appear on the global leaderboard.
