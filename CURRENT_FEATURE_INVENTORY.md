# PondFront.io Current Feature Inventory

Status is based on code inspection and the automated suites present on 2026-07-12. `Complete` means an authoritative implementation and usable client path exist; it does not imply a long physical-device endurance run.

## Core

| System | Status | Evidence/notes |
|---|---|---|
| HTTP/server startup and health | Complete | `server.js`, `/health`, Render health check |
| HTTP polling/delta connection and reconnect | Complete | `/api/state`, versioned deltas, lobby session tokens |
| Socket.IO transport | Unused/not implemented | The current project has no Socket.IO dependency; multiplayer uses authenticated HTTP polling/actions |
| Match creation and phases | Complete | Lobby/start, Spawn Selection, Countdown, Playing, Ended |
| Grid map generation and tile ownership | Complete | `TileManager`, map configuration, pointer/spawn tests |
| Player and bot state | Complete | Server-owned state, snapshots, bot manager |
| Economy and income | Complete | `EconomyManager`, shared balance/config |
| Expansion and combat waves | Complete | `CombatManager`, action resolver, critical tests |
| Win/elimination rules | Complete | Mode manager plus distinct-mode tests |

## Lobby And Multiplayer

| System | Status | Evidence/notes |
|---|---|---|
| Create/join lobby and room codes | Complete | `LobbyManager` and Socket.IO handlers |
| Host controls and host transfer | Complete | Host-only validation and next-host assignment |
| Ready/unready and synchronized settings | Complete | Lobby public state and readiness validation |
| Map/mode/bot/difficulty controls | Complete | Lobby settings and server normalization |
| Co-op teams, shared vision, friendly fire rules | Complete | `TeamManager`, mode and spawn suites |
| Modifiers/custom match reward blocking | Complete | `ModifierManager`, progression eligibility tests |
| Spawn timer/early start/reconnect | Complete | Spawn suites |
| Multiple real human clients over the public internet | Partially complete | Architecture exists; multi-device production load was not reproduced locally |

## Maps

| Map | Status | Notes |
|---|---|---|
| Small/Medium/Large/Huge generated lakes | Complete | Active configurations |
| Amazon River | Complete | Large-map spawn/connectivity tests |
| Mekong Delta | Complete | Large-map spawn/connectivity tests |
| Everglades Swamp | Complete | Large-map spawn/connectivity tests |
| Nile River | Complete | Large-map spawn/connectivity tests |

## Game Modes

| Mode | Status | Notes |
|---|---|---|
| Classic Elimination | Complete | Last living animal/team; no score ending |
| Golden Lily Control | Complete | Control zones, scoring, target victory, mode HUD |
| Flood Survival | Complete | Co-op defenders, waves, sanctuary, separate ending |
| Last Nest | Complete | Nest health/protection and final-Nest victory |
| Sandbox | Complete | Private testing controls; progression disabled |
| River Domination | Coming Soon | Configured as unimplemented; start is blocked |
| Pond Rush | Coming Soon | Configured as unimplemented; start is blocked |
| Migration | Coming Soon | Configured as unimplemented; start is blocked |
| Animal King | Coming Soon | Configured as unimplemented; start is blocked |
| Peaceful Expansion | Coming Soon | Configured as unimplemented; start is blocked |

## Gameplay

| System | Status | Notes |
|---|---|---|
| Neutral expansion waves and partial progress | Complete | Server-authoritative wave state |
| Bite, Push, Wave, Max attacks | Complete | Shared action resolver and committed waves |
| Defend/reinforce and terrain modifiers | Complete | Combat/economy managers |
| Current Push | Complete | Route validation, warning, impact, cooldown, counterplay |
| Lily Barrage | Complete | Delayed strike, radius, capture limits, defenses |
| Dragonfly Guard and Reed Shield | Complete | Authoritative defense zones and expiry |
| Buildings, construction time, upgrades | Complete | Live preview costs and server validation |
| Building capture/conversion | Complete | Type/level transfer and owner bonus refresh |
| Objectives and camps | Complete | `ObjectiveManager` and configured objective types |
| Lake/map events | Complete, endurance unverified | `EventManager`; cleanup exists, repeated 20-minute device run not completed |
| Last Stand | Complete | Server trigger, income/defense flags |
| Team revives | Complete | Server validation, cost, protection, modifier control |
| Diplomacy and team support | Complete | Server-managed alliances, truce checks, support commands |

## Animals

| Animal | Status | Ability |
|---|---|---|
| Duck | Complete | Flock Rush |
| Snake | Complete | Ambush |
| Frog | Complete | Big Leap |
| Turtle | Complete | Shell Guard |
| Carp | Complete | Golden Current |

## Objectives And Events

| Group | Status | Included implementations |
|---|---|---|
| General objectives | Complete | Golden Lily, Ancient Reed, Mud Spring, Clear Water Shrine, Deep Current |
| Map objectives/camps | Complete | Golden Lily Basin, Reed Wall, Canal Gate, Lotus Field, Mud Market, River Shrine, Misty Reed, Turtle/Crab/Otter camps, Dragonfly Swarm, Oasis Shrine, Crocodile Rock, Golden Lotus, River Gate |
| General events | Complete | Rainstorm, Foggy Marsh, Lily Bloom, Mud Slide, Migration, Flood Wave, Reed Surge, Current Shift, Rockfall |
| Map events | Complete | Jungle Rain, Canal Surge, Sand Wind, Flood Pulse, Oasis Bloom |

## User Interface

| System | Status | Notes |
|---|---|---|
| Desktop compact interface | Complete | Canvas-first play area and contextual side panels |
| Phone portrait/landscape and tablet | Complete | Mobile-first shell and viewport matrix |
| Desktop context menu/mobile long press | Complete | Shared action resolver |
| Context-sensitive action dock | Complete | Four primary actions plus More |
| Build/special/team/info sheets | Complete | Shared costs/reasons and swipe close |
| Settings and visual presets | Complete | Simple/Balanced/High/Ultra, accessibility, battery options |
| Minimap and leaderboard overlays | Complete | Touch overlays and camera handler |
| Mode HUD and spawn UI | Complete | Mode-aware status and mobile spawn sheet |
| Notifications | Complete | Three-message cap and duplicate merging |
| Debug panels | Complete, dev-only | Hidden unless debug/development flags are active |

## Accounts And Persistence

| System | Status | Notes |
|---|---|---|
| Guest play | Complete | No persistent progression expected |
| Username/password signup/login/logout | Complete | Hashed passwords and server sessions |
| Google OAuth | Complete when configured | PKCE/state/callback/linking implemented; optional when missing |
| Discord OAuth | Complete when configured | PKCE/state/callback/linking implemented; optional when missing |
| Account linking/disconnecting | Complete | Duplicate identity prevention and last-login-method guard |
| Persistent sessions | Complete locally | SQLite-backed sessions |
| Profile/stats/achievements/badges/history | Complete locally | Persistence and restart suite passes |
| Durable Render persistence | Broken by deployment configuration | Free Render filesystem is ephemeral and no disk/external DB is configured |

## Server-Only, UI-Only, And Dead Code

- No active game mode is UI-only; unimplemented modes are explicitly `Coming Soon` and server-blocked.
- Development diagnostics and bot/combat logs are server-only and gated by `NODE_ENV=development` or debug settings.
- The legacy `data/pondfront-db.json` is retained for migration/history safety and is not treated as the active SQLite store.
- No dead code was deleted during inventory because usage must be proven before cleanup.
