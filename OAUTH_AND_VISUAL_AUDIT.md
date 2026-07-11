# PondFront OAuth And Visual Audit

## Existing System

- Accounts used SQLite-backed username/password login with scrypt hashes and server sessions.
- Progress was already keyed by the stable PondFront `userId`: stats, animal stats, XP, coins, badges, achievements, selected cosmetics, and match history.
- Guest play remained available, but guest browser state was not trusted as permanent progression.
- The Canvas renderer already supported quality presets, temporary automatic reductions, strategic view, capped effects, mobile limits, and themed maps.

## Problems Found

- No Google or Discord identity flow or provider-link table existed.
- Raw random session tokens were stored in SQLite rather than a keyed digest.
- There was no account screen for adding or removing sign-in methods.
- Provider availability, callback validation, state, PKCE, and duplicate-provider handling did not exist.
- Territory colors had no color-vision remapping option.
- Several map backgrounds used the same dark blue treatment, weakening biome identity.

## Changes Applied

- Added additive `oauth_accounts` and one-time `oauth_states` tables without deleting or resetting existing users.
- Added `displayName`, `emailVerified`, and `avatarUrl` through safe additive migrations.
- Added official Google OIDC and Discord OAuth authorization-code flows with state and PKCE S256.
- Added exact callback path/origin checks, minimal scopes, server-side token exchange, and ephemeral provider access-token use.
- Session cookies are HttpOnly, SameSite=Lax, Secure on HTTPS/production, expire after 30 days, and are regenerated after login. SQLite stores only an HMAC digest of new session tokens.
- Added explicit provider linking/disconnect rules and blocked removal of the only sign-in method.
- Duplicate verified emails are never auto-merged; the player must sign in to the existing profile and explicitly connect the provider.
- Added disabled provider states, friendly callback errors, profile avatars, and a Connected Accounts tab. Emails remain private.
- Added map-specific water palettes, stronger pond terrain colors, compact action colors, and persistent Standard/Deuteranopia/Protanopia/Tritanopia palette choices.
- Preserved animal icons, labels, borders, and selection outlines so relationship meaning does not rely on color alone.

## Guest Upgrade Safety

Guests can start Google or Discord sign-in from the login card. The confirmation explains that only server-verified rewards are eligible. Existing browser-only or sandbox-generated values are not imported, preventing client-forged stats and duplicate rewards. New verified play continues on the resulting persistent account.

## Secrets And Deployment

- Secrets are read only from environment variables and are absent from frontend JavaScript.
- `.env` is ignored; `.env.example` contains placeholders only.
- Missing provider credentials disable that provider cleanly.
- Production callback URLs must use HTTPS and the same origin as `APP_BASE_URL`.
