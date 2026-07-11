# PondFront.io

PondFront.io is an original animal-themed real-time territory strategy prototype in development. Players lead pond animals across a giant lake, expand tile by tile, spend Animal Energy on committed attack waves, build compact upgrades, form alliances, and fight to control the pond.

The game is inspired by the broad strategy-game idea of territory expansion, borders, energy economy, diplomacy, bots, and domination. It does not use or copy OpenFront.io assets, code, branding, names, sounds, or UI.

## Current Features

- Five playable animals: Duck, Snake, Frog, Turtle, and Carp.
- Server-authoritative map ownership, energy, combat, bots, diplomacy, buildings, objectives, and win checks.
- Canvas strategy map with zoom, pan, minimap, clean borders, region names, water texture, sparse terrain accents, and optional decorations.
- Animal Energy economy with territory income, max energy scaling, lily income, buildings, and defensive spending.
- No-cooldown normal border attacks: Bite, Push, Wave, and Max spend energy immediately and push until spent.
- Special cooldown actions still exist for animal abilities, Current Push, diplomacy/pings, reinforce, and construction.
- Same-target attack merging so repeated hits feed an active wave instead of cluttering the map.
- Frontline combat, weakened borders, reinforcement, terrain defense, contested waves, Current Push, and bot attacks.
- Diplomacy with alliances, peace, enemy marking, warnings, support, betrayal timers, and team/co-op modes.
- Lobby system with solo, practice, sandbox, private lobbies, map size, bot difficulty, and team settings.
- Player accounts, Google/Discord sign-in, linked accounts, profiles, XP, badges, achievements, match history, missions, and local persistence.
- Pond specials: Lily Barrage, Dragonfly Guard, and Reed Shield, with server-side costs, cooldowns, targeting, and counterplay.
- Smarter bot personalities, including Expander, Defender, Fighter, Objective Hunter, Leader Hunter, and Supporter behavior.
- First-match tutorial and compact coach hints for expansion, attacking, building, defense, objectives, and specials.
- Mobile support with tap controls, compact action cards, mobile attack buttons, safe-area UI, and touch-friendly sheets.
- Settings for strategic view, animal visuals, audio, effect quality, coach hints, and a debug stats overlay.

## How To Play

1. Choose an animal and enter a match.
2. Expand into neutral pond tiles to grow income and max Animal Energy.
3. Build Nest, Lily Farm, Reed Guard, Mud Tunnel, or Jump Pad on owned tiles.
4. Attack connected enemy borders by choosing Bite, Push, Wave, or Max.
5. Reinforce important fronts and use terrain bonuses.
6. Use animal abilities, Current Push, and pond specials at the right moment.
7. Watch bot personalities and diplomacy before choosing enemies.
8. Win by controlling the lake or outlasting the other animals/teams.

## Animals

- Duck: beginner-friendly open-water expansion, higher max energy, Flock Rush.
- Snake: reed and mud pressure, Ambush attack power, stronger defensive terrain play.
- Frog: lily income and jump tactics, Big Leap neutral captures.
- Turtle: strong borders and Shell Guard defense, slower but hard to break.
- Carp: economy scaling through water and lily income, Golden Current growth window.

## Combat

Normal border attacks do not use cooldowns. If the target is valid, connected, not allied, not protected by truce, and the player has enough Animal Energy, the server starts or merges a committed attack wave immediately.

Attack pacing is controlled by:

- Animal Energy spent.
- Minimum useful attack energy.
- Defender energy and tile defense.
- Terrain and building bonuses.
- Active wave limit.
- Same-target energy merging.
- Bot thinking intervals.

Current Push is different: it is a special long-range water-route attack and still has cooldown.

## Specials

- Lily Barrage: expensive long-range pressure that weakens a small enemy cluster and can capture a few undefended tiles.
- Dragonfly Guard: anti-strike defense that reduces Lily Barrage and Current Push impact in a protected area.
- Reed Shield: border defense that slows normal committed waves and slightly softens strike damage.

Specials are intentionally costly. Spending energy on a special can leave your borders weaker if the attack fails.

## Bots

Bots are server-controlled and use difficulty profiles, reaction delays, mistakes, build choices, diplomacy, abilities, specials, and personalities. Easy bots expand and attack slowly. Normal bots are meant to feel fair. Hard and Chaos are more aggressive.

Selected bot info panels show animal, level, difficulty, personality, relationship, and strength estimate so rival behavior is easier to read.

## Controls

- Left click or tap a tile to select it.
- Drag or pan to move around the map.
- Mouse wheel or zoom buttons to zoom.
- Click Expand, Attack, Defend, Build, Ability, Special, or Current Push after selecting a tile.
- Right click enemy/player territory for diplomacy and signals.
- On mobile, tap a tile and use the compact action card.
- Open Settings to change view mode, effects, audio, coach hints, UI scale, or debug stats.

## Run Locally

Install Node.js 22 or newer, then run:

```bash
npm start
```

Open:

```text
http://localhost:5173/
```

If `localhost refused to connect`, the server is not running. Start it again with `npm start` from this folder.

## Google And Discord Sign-In

PondFront uses server-side OAuth authorization-code flows. Players authenticate on Google or Discord; PondFront never receives provider passwords and does not retain provider access tokens.

1. Duplicate `.env.example` as `.env` for local development.
2. Generate a long random `SESSION_SECRET`.
3. In Google Cloud, create an OAuth 2.0 **Web application** and add this exact authorized redirect URI:

```text
http://localhost:5173/api/auth/oauth/google/callback
```

4. In the Discord Developer Portal, create an application, open OAuth2, and add this exact redirect URI:

```text
http://localhost:5173/api/auth/oauth/discord/callback
```

5. Put the client IDs and secrets in `.env`, then restart `npm start`.

Only basic identity scopes are requested: Google `openid email profile`, and Discord `identify email`. Missing credentials leave that provider button disabled without stopping the game. Never commit `.env`; it is ignored by Git.

For Render, set the same variables in **Environment** and replace every localhost value with the service's exact HTTPS origin. For example:

```text
APP_BASE_URL=https://your-pondfront.onrender.com
GOOGLE_CALLBACK_URL=https://your-pondfront.onrender.com/api/auth/oauth/google/callback
DISCORD_CALLBACK_URL=https://your-pondfront.onrender.com/api/auth/oauth/discord/callback
```

Register those exact production callback URLs with Google and Discord too. Callback origins that differ from `APP_BASE_URL` are rejected.

## Deploy From GitHub

GitHub Pages cannot run the full game because PondFront.io needs a Node server for matchmaking, bots, combat, and accounts.

Use GitHub as the code home, then deploy to a Node host such as Render, Railway, Fly.io, or another service that can run:

```bash
npm start
```

Render setup:

1. Create a new GitHub repository.
2. Upload or push this `pondfront` folder, including `public`, `server`, `shared`, `data`, `package.json`, and `server.js`.
3. Create a Render Web Service from the GitHub repo.
4. Use build command `npm install`.
5. Use start command `npm start`.
6. Use health check path `/health`.
7. Open the public Render URL after deploy.

## Project Layout

```text
server.js                 Node web server, match loop, API routes
public/                   Browser UI, Canvas renderer, controls, VFX, audio
server/                   Server-authoritative gameplay managers
shared/                   Shared animals, combat, map, balance, bot configs
scripts/                  Simulation and balance checks
data/                     Local account/profile persistence
docs/screenshots/         Screenshot placeholders and capture notes
```

Key files:

- `server/BotManager.js` - bot pacing, personalities, skirmishes, diplomacy, and surrender rules.
- `server/CombatManager.js` - expansion, committed attacks, defense, Current Push, and ability combat.
- `server/SpecialManager.js` - Lily Barrage, Dragonfly Guard, and Reed Shield validation/effects.
- `public/ui.js` - lobby, panels, mobile action cards, coach hints, settings, and debug stats.
- `public/render.js` and `public/vfx.js` - Canvas rendering, strategic map visuals, particles, and feedback.
- `shared/balanceConfig.js`, `shared/botDifficultyConfig.js`, and `shared/specialConfig.js` - tuning values.

## Screenshots

Add screenshots to `docs/screenshots/` when you want a visual README.

- `docs/screenshots/lobby.png` - polished lobby and animal selection.
- `docs/screenshots/strategy-map.png` - clean territory map with borders.
- `docs/screenshots/combat-wave.png` - committed energy wave attacking a border.
- `docs/screenshots/mobile.png` - mobile action card and attack buttons.
- `docs/screenshots/sandbox.png` - sandbox testing tools.

## Developer Checks

```bash
npm run check
npm run test:accounts
npm run test:oauth
npm run simulate:balance
```

## Roadmap Ideas

- More lake maps and biome layouts.
- Match replay viewer.
- More readable team battle overlays.
- Ranked/custom lobby settings.
- More animal cosmetics, badges, and seasonal pond events.
- More tutorial missions and post-match analytics.
