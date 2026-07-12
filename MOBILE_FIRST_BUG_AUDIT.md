# PondFront.io Mobile-First Bug Audit

Date: 2026-07-12

## Scope

Audited mobile layout, map input, spawn selection, contextual actions, targeting, cooldown display, authentication layout, responsive overlays, notifications, and rendering cost. Server ownership of gameplay actions remains unchanged.

## Fixed Critical and High Issues

| Severity | Bug | Root cause | Fix | Result |
|---|---|---|---|---|
| Critical | Tiny finger movement immediately panned the map | Touch input entered pan mode before crossing a movement threshold | Pan now starts only after the configurable tap threshold; long press is cancelled after movement | Passed gesture regression |
| High | Mobile was a shrunken desktop with panels covering the lake | Desktop side panels and action bars remained active at touch breakpoints | Added a map-first touch shell, compact top HUD, contextual four-action dock, and request-only sheets | Passed seven-viewport browser matrix |
| High | Settings could not be tapped in live mobile play | A legacy visibility rule hid the real button while its compact label styling remained | Touch layout now explicitly displays a fixed 38px settings control and reserves HUD space for it | Fixed; final browser verification required after reload |
| High | Layout mode could remain portrait after rotation | Some viewport changes do not emit the expected window resize event | Added visualViewport resize handling and state-update self-correction | Browser rotation recovery passed |
| High | Risky double tap could spend energy immediately | Quick action directly executed gameplay | Default double tap now opens context actions; Info and None remain configurable | Passed mobile regression |
| High | Long-press actions could drift from desktop actions | Mobile paths could build their own action list | Dock and full action sheet consume the shared authoritative action resolver | Critical resolver suite passed |
| High | Targeted specials were too easy to misfire | First target tap submitted immediately | Current Push, specials, and targeted abilities now show valid targets and require a second confirmation tap | Automated targeting checks passed |
| High | Spawn controls rendered partly off-screen | Legacy centering transforms overrode the mobile bottom-sheet layout | Spawn map is full-screen; controls are pinned inside safe areas; live 390x844 check passed | Passed browser spawn check |
| High | 1024px tablets could fall back to desktop controls | Touch layout width fallback stopped at 900px | Tablet fallback now extends through 1024px while coarse pointers always use touch mode | Covered by responsive tests |
| Medium | Mobile action sheet could clip during entrance | Initial 18px translation moved the sheet below its safe bottom position | Reduced travel to 8px, removed margin, and enforced border-box sizing | Browser sheet stayed inside viewport |
| Medium | HUD fourth slot showed time instead of mode state | Desktop timer was reused on mobile | Added mode-aware Animals/Teams, Lily score, Flood wave, or Nest health status; spawn still shows timer | Mode suites passed |
| Medium | Repeated notifications stacked excessively | Every duplicate created a new toast and four were retained | Duplicate messages merge with a count and only three stack toasts remain | Static and syntax checks passed |
| Medium | Ability cooldown lacked an at-a-glance mobile state | Dock only displayed text | Added server-timed Ready, Active, cooldown seconds, disabled reason, and radial progress styling | Authoritative cooldown suite passed |
| Medium | Mobile effects and minimap could waste battery | Desktop DPR and refresh cadence were reused | Added DPR caps, mobile minimap throttling, FPS setting, and Battery Saver overrides | Rendering syntax and mobile regression passed |

## Consistency Checks

- Map taps use the renderer's canonical screen-to-world conversion.
- Building cards and action sheets use shared/server preview costs; no mobile-only gameplay formula was added.
- Ability state uses absolute server cooldown and active timestamps.
- Two-finger tap cancels targeting; pinch movement cannot also submit a tap.
- UI controls are outside the canvas input path, preventing touch-through.
- Reconnect tests create no duplicate player or touch action state.

## Residual Validation

- Real Google and Discord redirects require deployed credentials and provider callback URLs; the local security suite passed with provider mocks.
- Long-duration thermal FPS should still be checked on a physical low-end phone. Automated tests verify caps, culling, and refresh throttles but cannot reproduce device heat.
- iOS keyboard behavior should receive one physical Safari pass even though the form uses 16px inputs, safe-area padding, and scrollable sheets.

