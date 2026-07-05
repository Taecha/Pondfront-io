# PondFront.io Account Persistence Fix Report

## Summary

Account data now persists in SQLite instead of a JSON-only prototype store. Signup, login, profile loading, selected badge/title/cosmetic, achievements, badges, stats, and match history are saved server-side.

## Files Updated

- `server/db.js`
- `server/AuthManager.js`
- `server/ProfileManager.js`
- `server/StatsManager.js`
- `server/AchievementManager.js`
- `server.js`
- `public/auth.js`
- `public/profile.js`
- `package.json`

## Persistence

- Database file: `data/pondfront.db`
- Legacy import: `data/pondfront-db.json` imports once when the default SQLite DB is first created.
- Password storage: salted `scrypt` hash.
- Session storage: server-side session table plus httpOnly `pond_session` cookie.

## API Coverage

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/profile/me`
- `GET /api/stats/me`
- `GET /api/achievements/me`
- `GET /api/badges/me`
- `GET /api/matches/me`
- `POST /api/profile/select-badge`
- `POST /api/profile/select-title`
- `POST /api/profile/select-cosmetic`

## Test Results

- Signup HTTP test: passed.
- Session restore with `/api/auth/me`: passed.
- Profile load with `/api/profile/me`: passed.
- Stats API: passed.
- Badges API: passed.
- Achievements API: passed.
- Match history API: passed.
- Logout API: passed.
- Login after logout: passed.
- SQLite close/reopen persistence cycle: passed.
- Selected badge persisted after DB reopen: passed.
- Win/stat/XP/match history persisted after DB reopen: passed.
- Achievement and badge unlock persistence: passed.
- Guest mode remains available.
- Sandbox still skips account rewards through existing server-side check.
- `pnpm run check`: passed.
- Local server health: `http://localhost:5173/health` returned 200.

## Security Notes

- Client cannot submit arbitrary XP, wins, badges, or achievements.
- Badge/title/cosmetic selection is validated against server-owned unlock state.
- Password hashes are never returned to the client.
- Dev logs do not print passwords or session tokens.
