# PondFront.io Update 1.01 Test Report

Status: passed on July 14, 2026.

## Browser Viewports

- 1366 x 768 desktop: passed. Settings footer stayed visible, the live World Status HUD rendered at 330 x 71, and horizontal overflow was 0 px.
- 1920 x 1080 desktop: passed. The 980 x 760 settings shell stayed centered with one content scroller and no horizontal overflow.
- 1024 x 768 tablet: passed. The 1004 x 753 settings shell fit the viewport, retained desktop category navigation, and had no horizontal overflow.
- 390 x 844 mobile: passed. Settings became a full-screen 390 x 844 sheet, used the mobile category selector, kept Apply/Cancel fixed, scrolled through the last Audio control, and had no horizontal overflow.

## Settings Results

- Search switched to the matching category and filtered controls correctly.
- Cancel discarded an unsaved Sound change; reopening restored the applied value.
- Apply persisted the Adaptive Quality choice; it was then returned to its disabled-by-default state.
- Category switching and scrolling reached the final Audio control while the footer remained visible.
- Lobby Settings opens through the shared Settings Manager, clearing stale draft/search state.
- Restore Defaults and JSON import use confirmation before replacing settings.

## Living World Results

- A live practice match exposed synchronized phase, season, weather, next-phase timing, and modifier data.
- The mobile World Status HUD rendered at 292 x 86 without covering the action dock or creating page overflow.
- The server `/api/state` snapshot reported the authoritative world state while the match was playing.
- Economy, construction, expansion, ability recovery/cost, and defense consume capped server modifiers for humans and bots equally.
- Browser console result: 0 errors and 0 warnings.

## Automated Results

- JavaScript syntax: 89 files passed `node --check`.
- Settings and Living World contract tests: passed.
- Critical systems, mobile-first, lobby, spawn, pointer, game-mode, release, map, and startup-security suites: passed.
- Account persistence: 10/10 checks passed, including restart survival.
- OAuth security: all Google, Discord, PKCE, session, linking, and replay checks passed.
- HTTP security integration: headers, secure production cookie, origin checks, rate limiting, and missing-provider handling passed.
- Full gameplay playtest: passed, including maps, expansion, construction, animals, diplomacy, combat, bots, win, and elimination rules.
- Performance simulation: 1,200 seconds, 20 bots, 4,800 ticks; 9.623 ms average, 32.62 ms p99, 36.37 MB heap growth, result passed.
- Live server remained available at `http://localhost:5173/` with no crash.
