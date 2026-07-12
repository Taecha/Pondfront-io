# Final Regression Matrix

Date: 2026-07-12

Legend: **Pass**, **Fixed**, **Known limitation**, **Blocked by external configuration**, or **N/A**. A cell is not marked Pass unless it was directly automated or visually exercised.

| Feature | Local desktop | Render desktop | Mobile portrait | Mobile landscape | Co-op | Reconnect | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Server startup/health | Pass | Pass | N/A | N/A | N/A | N/A | Pass | Local and Render `/health` returned 200 |
| Auth/session security | Pass | Known limitation | Pass | Pass | N/A | Pass | Blocked by external configuration | Render OAuth disabled and durable disk absent |
| Account persistence | Pass | Known limitation | Pass | Pass | N/A | Pass | Blocked by external configuration | Isolated restart tests pass; Render free filesystem is ephemeral |
| Lobby create/join/ready/start | Pass | Known limitation | Pass | Pass | Pass | Fixed | Pass locally | 15/15 integration checks; deployed build is stale |
| Duplicate lobby player | Fixed | Known limitation | Fixed | Fixed | Pass | Fixed | Fixed | Existing authenticated member is restored |
| Spawn reservation | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Pointer/spawn/mode suites passed on all maps |
| Pointer/map hit detection | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Canonical transform and resize/orientation tests passed |
| Context actions | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Desktop right-click remained in viewport; shared resolver used |
| Building costs/transfer | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Shared preview plus authoritative validation |
| Expansion/combat | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Duplicate action replay fixed; authoritative suites pass |
| Abilities/specials | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Five animals and four specials covered |
| Classic mode | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Correct elimination path |
| Golden Lily mode | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Score target works with rivals alive |
| Flood mode | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Preparation, waves, Sanctuary, victory/loss pass |
| Last Nest mode | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | Nest survival/final capture pass |
| Coming Soon modes | Pass | Known limitation | Pass | Pass | Pass | N/A | Pass locally | Server rejects start; no Classic fallback |
| Bot fairness/stability | Pass | Known limitation | Pass | Pass | Pass | N/A | Pass locally | Staggered thinkers; 600-second and 20-minute accelerated runs |
| Desktop layout | Pass | Pass | N/A | N/A | Pass | Pass | Pass | 1440x900 local; Render home visually checked |
| Mobile responsive layout | Pass | Known limitation | Pass | Pass | Pass | Pass | Pass locally | 360x640, 390x844, 412x915, 640x360, 844x390, tablets; no overflow |
| Mobile touch dock | Pass | Blocked by external configuration | Pass | Pass | Pass | Pass | Known limitation | Remote stale build lacks current `mobileControls.js`/dock |
| Long server stability | Pass | Known limitation | N/A | N/A | Pass | N/A | Pass locally | 4,800 accelerated ticks, bounded events, 11.08 MB heap growth |
| Network payload/deltas | Fixed | Known limitation | Fixed | Fixed | Pass | Pass | Fixed locally | Full JSON gzip reduced about 2.34 MB to 63.7 KB; delta 5.9 KB |
| Google/Discord live callback | Blocked by external configuration | Blocked by external configuration | Blocked | Blocked | N/A | N/A | Blocked | Requires provider credentials/callback registration |

## Responsive Visual Checks

The map remained the primary surface, the action dock stayed within the viewport, four compact top stats remained visible, and no horizontal overflow appeared at every listed local viewport. The current Render homepage also fit at 390x844, but its gameplay mobile bundle is stale and is not certified.
