# Update 2 Security Report

## Authority Boundary

The client sends intentions only. The server validates player identity, match phase, ownership, target, route, relationship, action percentage, energy, cooldown, construction, special rules, mode rules, and progression eligibility before changing state.

Update 2 adds explicit server rejection for unsupported send percentages. A modified client sending 33% receives `invalidPercent`; no energy is deducted.

## Verified Protections

- Client action IDs and a bounded receipt cache make duplicate requests idempotent.
- Bots cannot be controlled through the player action API.
- Allied and truce targets are rejected by authoritative diplomacy checks.
- Cross-origin mutating requests are rejected by same-origin validation.
- Login attempts are rate limited; the HTTP integration test reached the expected 429 response.
- Production startup refuses a missing `SESSION_SECRET`.
- Production cookies are HttpOnly, Secure, SameSite=Lax, path-scoped, and expire server-side on logout.
- Password login rejects invalid credentials without leaking which credential failed.
- OAuth uses official provider endpoints, state, one-time consumption, PKCE S256, form-encoded token exchange, and explicit account linking.
- OAuth access and refresh tokens are not stored in the account schema.
- Raw session cookies are not stored in SQLite.
- Baseline HTTP security headers are enabled.

## Persistence Verification

Signup, session restoration, stats, match history, achievements, badges, selected badge, display name, and profile state survived a database restart. Achievement unlocks were duplicate-safe.

## Deployment Requirements

- Set a high-entropy `SESSION_SECRET` in production.
- Configure Google/Discord client IDs, secrets, and exact HTTPS callback URLs only when those providers are enabled.
- Use a persistent Render disk or external database for durable accounts.
- Never expose provider secrets or database files through `public/`.

No critical or high security finding remains open from the automated and HTTP integration pass.

