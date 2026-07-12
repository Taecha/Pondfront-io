# Menu, Cooldown, and Authentication Fix Report

Date: 2026-07-12

## Automated and browser results

| # | Test | Result |
| --- | --- | --- |
| 1 | Neutral border has four expansion choices | PASS |
| 2 | Enemy border has Bite, Push, Wave, Max, Current Push, special/info/ping | PASS |
| 3 | Own empty tile has Build, Defend, Ability, Shield, ping | PASS |
| 4 | Own building exposes building management actions | PASS by resolver/manual code path |
| 5 | Ally tile has inspect, support, help, guard | PASS |
| 6 | Objective actions append inspect/contest/ping/defend | PASS by resolver path |
| 7 | PC right-click opens bounded menu for cursor tile | PASS live browser |
| 8 | Mobile uses same actions in compact bottom sheet | PASS live 390x844 browser |
| 9 | Disabled actions show exact reasons | PASS live browser |
| 10 | Build submenu uses shared preview cost | PASS |
| 11 | Five animal abilities apply gameplay effects | PASS existing QA suite |
| 12 | Reconnect snapshot restores cooldown timestamp | PASS |
| 13 | Rejected ability does not consume/restart cooldown | PASS |
| 14 | Countdown returns to Ready from absolute timestamp | PASS by clock contract |
| 15 | Button, panel, menu, mobile card share cooldown state | PASS |
| 16 | Create password account and session | PASS |
| 17 | Logout/login returns same account | PASS |
| 18 | Session survives refresh/database reopen | PASS |
| 19 | Google OAuth mock authorization and callback | PASS |
| 20 | Discord OAuth mock authorization and callback | PASS |
| 21 | Both providers link to one profile | PASS |
| 22 | Invalid login is clear and non-crashing | PASS |
| 23 | Missing OAuth variables disable providers | PASS |
| 24 | Real Render HTTPS provider/cookie test | NOT RUN: deployment URL/secrets unavailable |
| 25 | Profile, progression, history survive DB restart | PASS |
| 26 | Browser console errors | PASS: none from changed systems |
| 27 | Unhandled promise rejection | PASS |
| 28 | Server health after restart | PASS |
| 29 | Duplicate expansion/attack/defend commands blocked client-side; server revalidates all | PASS |
| 30 | PC and mobile layouts | PASS live browser |

## Commands

- `node scripts/criticalSystemsTest.js`: 10/10 PASS
- `node scripts/accountPersistenceTest.js`: 9/9 PASS
- `node scripts/oauthSecurityTest.js`: all checks PASS
- `node scripts/qaPlaytest.js`: five animal abilities PASS; one unrelated random bot-attack simulation assertion failed

## Deployment checklist

1. Set `APP_BASE_URL` to the exact Render HTTPS origin.
2. Set Google and Discord client IDs, secrets, and exact callback URLs.
3. Keep the generated `SESSION_SECRET` stable.
4. For persistent SQLite profiles, use a paid Render disk and set `PONDFRONT_DB=/var/data/pondfront.db`, or migrate to a durable relational database.
5. Verify real callbacks and the returned `pond_session` cookie on the deployed origin.
