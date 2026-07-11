# OAuth Security And Visual Test Report

## Automated Authentication Tests

Command: `npm run test:oauth`

- PASS: New Google identity creates one PondFront account using Google `sub`.
- PASS: Repeat Google login restores the same account.
- PASS: New Discord identity creates one account using the Discord user ID.
- PASS: Repeat Discord login restores the same account.
- PASS: Google and Discord link to one password account while XP and coins remain unchanged.
- PASS: A provider identity cannot link to two PondFront accounts.
- PASS: Matching verified email requires explicit linking and does not merge automatically.
- PASS: OAuth cancellation creates no account.
- PASS: State is random, cookie-bound, one-time, and replay-resistant.
- PASS: PKCE S256 is sent and the verifier is required during token exchange.
- PASS: Provider access/refresh tokens have no database columns and are not retained.
- PASS: New raw session cookies are not stored in SQLite.
- PASS: Logout deletes the session and expires the cookie.
- PASS: Missing provider environment variables return a helpful unavailable state.

## Progression Regression Tests

Command: `npm run test:accounts`

- PASS: Password signup/login remain functional.
- PASS: Session survives a database restart.
- PASS: XP, stats, achievements, badges, selected badge, and match history survive restart.
- PASS: Wrong passwords are rejected.

## Visual And Accessibility Checks

- Map palettes now vary for Amazon, Mekong, Everglades, Nile, and the standard pond.
- Territory, minimap, border, player marker, attack, and name rendering share the selected accessible player palette.
- Standard, green-red, red-green, and blue-yellow support modes persist independently of visual quality presets.
- Animal badges, labels, border thickness, selected outlines, and warning states remain available as non-color cues.
- Existing particle caps, visible-tile culling, minimap throttling, mobile reductions, temporary automatic quality changes, and user preset persistence remain intact.
- Login and connected-account controls use compact responsive layouts on desktop and mobile.

## Manual Provider Test Requirement

Real Google and Discord consent screens require owner-created credentials and registered callback URLs. After those environment variables are added, complete one live login and disconnect/reconnect check for each provider on both localhost and the deployed Render origin.
