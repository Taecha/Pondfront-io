# PondFront.io Mobile-First Test Report

Date: 2026-07-12

## Automated Results

- `scripts/mobileFirstTest.js`: 19/19 passed.
- `scripts/criticalSystemsTest.js`: 10/10 passed.
- `scripts/spawnModesTest.js`: all 34 checks passed.
- `scripts/spawnVisibilityTest.js`: all 16 checks passed.
- `scripts/pointerSpawnTest.js`: all pointer, edge, snapping, large-map, and spawn checks passed.
- `scripts/realGameModesTest.js`: all 31 checks passed.
- `scripts/accountPersistenceTest.js`: all 9 checks passed.
- `scripts/oauthSecurityTest.js`: all security and persistence checks passed.
- Changed client JavaScript files pass `node --check`.

## Viewport Matrix

| Viewport | Layout | Horizontal overflow | Map visible | Dock inside viewport |
|---|---|---:|---:|---:|
| 360x640 | Phone portrait | No | Yes | Yes |
| 390x844 | Phone portrait | No | Yes | Yes |
| 412x915 | Phone portrait | No | Yes | Yes |
| 640x360 | Tablet/phone landscape | No | Yes | Yes |
| 844x390 | Tablet landscape | No | Yes | Yes |
| 768x1024 | Tablet portrait | No | Yes | Yes |
| 1024x768 | Tablet landscape/touch fallback | No | Yes | Yes |

The live 390x844 browser check also verified a 52px spawn HUD, full remaining-height map, safe bottom spawn card, hidden live rank/minimap chips during spawn, and a four-action live dock after the match began.

## Required Test Cases

| # | Test | Result | Evidence |
|---:|---|---|---|
| 1 | Pan and zoom map | Pass | Gesture threshold, pinch isolation, inertia, and canonical pointer tests passed |
| 2 | Tap exact border | Pass | Edge crossing and 27 pointer round trips selected the expected tile |
| 3 | Long press neutral border | Pass | Neutral shared resolver exposes four sends; mobile sheet rendered in browser |
| 4 | Long press enemy border | Pass | Enemy resolver exposes Bite/Push/Wave, specials, diplomacy, and reasons |
| 5 | Build Lily Farm | Pass | Authoritative preview, live scaled cost, rejection reason, and deduction path covered by critical suite |
| 6 | Use animal ability | Pass | Server returned absolute active/cooldown timestamps; reconnect snapshot agreed |
| 7 | Target Current Push | Pass | Route targeting, legal glow state, local snap, confirm, and cancel paths checked |
| 8 | Spawn selection | Pass | Live mobile random/confirm flow plus full spawn suites passed |
| 9 | Open leaderboard | Pass | Floating rank chip and scrollable touch overlay fit responsive geometry |
| 10 | Open minimap | Pass | Touch overlay and existing tap/drag camera handler retained; refresh throttled |
| 11 | Open settings | Pass | Fresh-build browser check opened the 390x844 full-height scrollable panel; close control remained visible |
| 12 | Rotate device | Pass | Portrait-to-landscape self-correction and canvas geometry passed |
| 13 | Login/signup | Pass | Persistence suite passed; mobile form uses 16px inputs and safe scrolling |
| 14 | Google/Discord buttons | Conditional pass | OAuth security/callback suite passed; real redirects require configured credentials |
| 15 | Classic match | Pass, simulated | Authoritative elimination, reconnect, HUD, and ending paths passed; no full-length manual match |
| 16 | Golden Lily | Pass | Score zones, HUD state, scoring, and independent win condition passed |
| 17 | Flood Survival | Pass | Preparation, wave HUD, sanctuary loss, and all-waves victory passed |
| 18 | Last Nest | Pass | Nest health/protection HUD and final-Nest ending passed |
| 19 | Large Amazon map | Pass, simulated | 20 unique bot spawns and 5,307 valid human tiles; physical-device thermal test remains |
| 20 | No console errors | Pass in tested flow | Browser flow and all syntax suites completed without client exception |
| 21 | No duplicate touch actions | Pass | Pointer state, reconnect, and one-confirm submission guards checked |
| 22 | No horizontal scrolling | Pass | All seven browser viewport geometries reported no overflow |
| 23 | No server crash | Pass | Health remained available throughout all integration suites |

## Performance Defaults

- Touch devices default to the Simple/Balanced-Low visual path.
- Device pixel ratio is capped to 1.6 on touch and 1.25 in Battery Saver.
- Main rendering can be capped to 30 or 60 FPS.
- Battery Saver reduces effects, motion, DPR, and minimap refresh to 1.4 seconds.
- Visible-tile rendering, off-screen effect skipping, and cached map layers remain enabled.
