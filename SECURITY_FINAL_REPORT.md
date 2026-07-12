# Security Final Report

Date: 2026-07-12

## Result

Local release candidate: **Pass with known hardening limitations**. No destructive testing was performed against production.

## Protections Verified or Added

- Production refuses to start without `SESSION_SECRET`.
- Passwords use salted `scrypt` and constant-time comparison.
- Production session cookie is `HttpOnly`, `SameSite=Lax`, `Secure`, path-scoped, and expires after 30 days.
- Session tokens are random; only their hash is stored in SQLite.
- Mutating `/api/*` POST requests enforce same-origin validation.
- Login and signup have per-address rolling-window rate limits with bounded cleanup.
- Baseline headers include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, and a restrictive `Permissions-Policy`; production adds HSTS.
- OAuth uses state, PKCE S256, one-time state consumption, and does not persist access tokens.
- Provider/email rules prevent silent account merging and duplicate provider attachment.
- SQL operations use prepared statements.
- Static paths are confined to the public/shared roots.
- Lobby setting/start actions verify host authority.
- Match actions derive actor identity from the server-issued match token and revalidate ownership, target, cost, cooldown, alliance, phase, and mode rules.
- Client progression/stat claims are not trusted; modified/sandbox matches cannot farm rewards.
- Bounded `clientActionId` receipts make action replay idempotent.
- Route, timer, bot, tick, and process error boundaries log safe diagnostics without returning secrets.
- Production debug/combat telemetry is gated behind development flags.

## Automated Checks

- Production cookie/header/origin/rate-limit integration: pass.
- Startup with required secret absent: expected clear failure.
- Optional OAuth configuration absent: clean disable.
- OAuth/account-link security suite: pass.
- Lobby host/reconnect/duplicate/start authorization suite: 15/15 pass.
- Server-authoritative gameplay/replay checks: pass.

## Known Limitations

- A strict Content Security Policy is not enabled. The current UI uses dynamic inline styling; CSP should be introduced with a nonce/hash refactor instead of breaking gameplay during this bug-fix pass.
- Rate limiting is process-local. A multi-instance deployment should use a shared limiter.
- SQLite is appropriate for the current single-instance design but requires durable storage, backups, and one-writer deployment discipline.
- Real Google/Discord callback flows remain blocked by missing deployed provider configuration.
- The Render service currently runs stale assets and is therefore not the audited binary.

No secret values are included in this report or normal server responses.
