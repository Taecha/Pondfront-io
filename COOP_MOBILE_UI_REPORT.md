# PondFront.io Co-Op Team + Mobile UI Report

## Summary

Added a server-authoritative team system with Solo, Co-Op Team, and Team Battle modes. Co-Op now gives the human player teammate bots with roles, shared team protection, team pings, team commands, and combined team win scoring. Mobile UI was tightened with a Tiny scale option, smaller controls, a compact Team sheet, and a team/player leaderboard toggle.

## Major Changes

- Added `shared/teamConfig.js` for game modes, team colors, bot roles, and team command definitions.
- Added `server/TeamManager.js` for team assignment, team score, team commands, teammate bot reactions, and team snapshots.
- Updated `server.js` to accept team-mode lobby settings, assign teams before spawning, expose `teamState`, and use team win conditions.
- Updated diplomacy and combat validation so teammates cannot attack, declare war, mark enemy, or break team protection.
- Updated bot AI so teammate bots can react to Attack, Defend, Help, Push, Objective, Retreat, and Protect commands.
- Fixed Co-Op spawn assignment so rival bots cannot reuse teammate spawn points.
- Added lobby controls for Solo, Co-Op Team, Team Battle, teammate count, team bot difficulty, team count, and bots per team.
- Added team stat, Team button, mobile Team button, compact Team command sheet, team roster, recent team pings, and leaderboard mode toggle.
- Added subtle team visuals: team badges in map labels/leaderboard, teammate border outlines, team-colored pings, and minimap team outline.
- Added Tiny UI scale and smaller mobile buttons/panels while keeping touch targets usable.

## Tests Run

- `node --check` on all changed and dependent JS files: passed.
- `node scripts/qaPlaytest.js`: passed.
- Targeted server test:
  - Co-Op mode starts with teammate bots.
  - Teammate attack is blocked with `Cannot attack teammate.`
  - Team command is accepted and queued for teammate bots.
  - Team Battle creates teams and combines team territory.
- Fresh local API test:
  - Co-Op mode active.
  - Blue Team has 2 living teammate bots.
  - Team command creates an active `Attack Here` command.
- Browser smoke test:
  - Lobby loaded with no console errors.
  - Co-Op mode started from the lobby once successfully.
  - Team sheet opened and displayed command buttons.

## Tooling Note

The bundled runtime only includes `node.exe`, so `npm run check` could not be invoked from that bundled path. I ran the equivalent `node --check` list directly instead.

## Local URL

The refreshed server is running at:

`http://localhost:5173/`
