# PondFront.io Account Save Audit

## Current Findings

- The project already had real server-side auth managers and httpOnly cookie sessions.
- Passwords were already hashed with `crypto.scryptSync`, not stored as plain text.
- Guest mode already worked separately from account mode.
- Match rewards were already server-authoritative through `StatsManager.recordMatch(game)`.
- Sandbox matches were already excluded from account rewards.
- The main persistence weakness was storage: account data lived in `data/pondfront-db.json`, not a real database.
- Profile data was mostly loaded through `/api/profile/me`, but direct APIs for achievements, badges, and match history were missing.
- Profile UI did not always refresh full saved profile data immediately after auth/reward changes.

## What Was Frontend-Only

- UI preferences such as sound, visual settings, and tutorial state are still correctly local-only.
- Account progress is no longer treated as frontend source of truth.
- The client still only displays rewards/achievements sent by the server.

## What Was Memory/JSON Only

- Users, sessions, stats, achievements, badges, and match history were stored in one JSON document.
- Restart persistence worked only if the JSON file survived, but it was not structured like a database and was easier to corrupt.

## Fixed

- Replaced JSON account storage with SQLite at `data/pondfront.db`.
- Added safe table creation/migration with `CREATE TABLE IF NOT EXISTS`.
- Added one-time legacy import from `data/pondfront-db.json` into the default SQLite DB.
- Added tables for users, sessions, player stats, animal stats, achievements, user achievements, badges, user badges, and match history.
- Added direct APIs:
  - `GET /api/achievements/me`
  - `GET /api/badges/me`
  - `GET /api/matches/me`
- Updated `/api/stats/me` to return the same full animal stat shape as profile.
- Added safe dev logs for auth, profile loads, match saving, achievement unlocks, and badge unlocks.
- Updated client auth/profile sync so login, refresh, profile selection, and reward events reload server profile state.

## Still Intentionally Server-Only

- XP, coins, wins, losses, achievements, badges, selected badge validation, and match history remain controlled by the server.
- There is no client endpoint that directly adds XP, wins, coins, or achievements.
