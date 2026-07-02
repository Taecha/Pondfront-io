# PondFront.io Alliance Audit

## What Worked Before

- Players could request an alliance from the selected player panel or right-click menu.
- Bots could immediately accept or decline a basic alliance request.
- Breaking an alliance removed both players from each other's ally list.
- Combat checked `areAllied`, so direct attacks against allies were blocked.
- The leaderboard and selected-player panel showed a simple ally status.
- Mobile long press already opened the same context menu used on desktop.

## What Was Broken Or Too Simple

- Alliance requests were mostly instant; there was no real pending request state for the player to accept or reject.
- There was no request expiration timer.
- `sendPeace` was treated like an alliance request instead of a truce.
- Breaking an alliance had no betrayal cooldown, so a player could break and attack immediately.
- There was no war/truce state in the diplomacy layer.
- Bots only understood `allied` or `not allied`; they did not reason about truce, betrayal, or pending requests.
- The UI did not explain why attacks were blocked beyond a basic ally warning.
- Ally pings existed, but the relationship rules around private/public pings were not explicit server-side.

## What Was Confusing

- "Peace" and "Alliance" could do the same thing.
- "Enemy" marked a rival but did not clearly connect to war state.
- The selected player panel did not show timers for pending requests, truce, war, or betrayal cooldown.
- The right-click menu always offered similar actions even when a relationship made them invalid.

## Upgrades Added

- Added relationship states:
  - Neutral
  - Alliance Requested
  - Allied
  - At War
  - Truce
  - Betrayal Cooldown
  - Marked Enemy
- Added server-authoritative relationship records in `server/DiplomacyManager.js`.
- Added `shared/diplomacyConfig.js` for state labels, icons, timing, and ping types.
- Added request expiration after 45 seconds.
- Added truce duration of 60 seconds.
- Added betrayal cooldown of 45 seconds after breaking an alliance.
- Added war memory after attacks and war declarations.
- Added anti-spam cooldown for repeated diplomacy requests.
- Added bot acceptance/rejection logic using personality, power balance, common enemies, and betrayal memory.
- Added private ally ping validation and public warning pings.
- Added filtered event visibility so private ally pings are not treated like public signals.

## Remaining Notes

- The prototype still has one human player per local match, so human-to-human accept/reject flow is represented through bot-to-human pending requests.
- The current UI uses compact buttons instead of a full radial diplomacy wheel. It is cleaner and works on mobile, but a future visual radial menu could feel even richer.

