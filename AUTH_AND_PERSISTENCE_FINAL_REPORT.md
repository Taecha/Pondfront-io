# Authentication and Persistence Final Report

Date: 2026-07-12

## Status

Local release candidate: **Pass with external deployment requirements**.

Render deployment: **Blocked for durable account release**. `render.yaml` uses the free Render plan without a persistent disk, so the SQLite database can be lost when the service is replaced or restarted. Google and Discord are also disabled on the deployed service because their credentials are not configured.

## Verified Locally

- Username signup, duplicate rejection, login, incorrect-password rejection, logout, session refresh, and profile reload.
- Passwords use salted `scrypt` hashes and constant-time comparison.
- Session cookies are `HttpOnly`, `SameSite=Lax`, scoped to `/`, and `Secure` in production.
- Only a hashed session token is stored in SQLite; the raw cookie is not persisted.
- Users, stats, selected badge/title, achievements, badges, and match history survive server/database reopen tests.
- Duplicate achievement grants are idempotent.
- Modified and sandbox matches are ineligible for progression rewards.
- Google and Discord providers disable cleanly when optional configuration is absent.
- OAuth uses one-time state and PKCE S256; tokens are not written to the account database.
- A verified email is not used to silently merge separate provider identities.
- A provider cannot be disconnected when it is the account's only login method.
- Lobby and gameplay identity comes from server-issued session/player tokens rather than a client-selected user id.

## Tests

- `scripts/accountPersistenceTest.js`: 10/10 checks passed.
- `scripts/oauthSecurityTest.js`: all checks passed.
- `scripts/httpSecurityIntegrationTest.js`: production health, headers, cookie, origin rejection, auth rate limiting, and absent-provider handling passed using an isolated database and port.
- Restart/reopen tests use isolated data and do not modify the production database.

## External Setup Required

- Set a strong `SESSION_SECRET` in Render. Production startup now fails clearly when it is absent.
- Add persistent storage or move accounts to a managed durable database before public release.
- Configure Google and Discord client credentials and callback URLs, then perform real provider login/cancel/link tests. Provider callback success cannot be fully exercised without those credentials.
- Keep HTTPS enabled so production `Secure` cookies can be returned by browsers.

No migrations or existing user records were deleted during this audit.
