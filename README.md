# PondFront.io

**Current release: Update 2 - The Great Lake Update**

**Update 1 — Full Public Release**

PondFront.io is a server-authoritative animal territory strategy game set across living ponds, lakes, rivers, and wetlands. Choose an animal faction, expand your habitat, build structures, manage Animal Energy, use unique abilities, form alliances, and compete to become the final surviving species.

The game takes inspiration from the broad real-time territory strategy genre, including OpenFront.io. PondFront.io uses its own animal factions, pond rules, interface, visuals, names, sounds, and code.

## About The Game

Every match begins with an animal and a small habitat. Players claim connected neutral tiles to grow their income and maximum Animal Energy, then spend that energy on construction, reinforcement, abilities, specials, and committed border attacks. Terrain matters: open water, lily pads, reeds, mud, rocks, and nest zones create different routes and defensive positions.

The server owns territory, energy, combat results, buildings, bots, diplomacy, cooldowns, objectives, progression, and victory checks. The browser sends player intentions and renders the accepted state on a responsive Canvas map.

## Key Features

- Five playable factions: Duck, Snake, Frog, Turtle, and Carp.
- Connected territory expansion with visible costs and server validation.
- Animal Energy economy based on habitat size, terrain, buildings, and faction perks.
- Committed frontline attacks with Bite, Push, Wave, and Max energy sends.
- Reinforcement, terrain defense, Current Push, and three counterable pond specials.
- Constructible Nests, Lily Farms, Reed Guards, Mud Tunnels, and Jump Pads.
- Alliances, peace requests, enemy marking, warnings, support, and betrayal timers.
- Server-controlled bots with multiple difficulty levels and strategic personalities.
- Classic Elimination, Golden Lily Control, Flood Survival, Last Nest, Co-op, Team Battle, Practice, and Sandbox play.
- Spawn selection, minimap, camera pan and zoom, strategy view, objectives, map events, and match results.
- Guest play, local accounts, optional Google and Discord OAuth, profiles, XP, badges, achievements, missions, and match history.
- Desktop and mobile controls with touch sheets, pinch zoom, safe-area layout, UI scaling, and low-performance presets.
- Adaptive Web Audio ambience, spatial map feedback, distinct animal sounds, and a seven-channel mixer.
- Server-synchronized sunrise, day, sunset, night, weather, and per-match seasons with equal global effects.
- Searchable, category-based Settings with draft Apply/Cancel behavior, import/export, and mobile-safe scrolling.

## Living World

The server chooses the current time phase, season, and weather state. Every connected client receives the same clock and modifier breakdown. The standard day cycle lasts 20 minutes; private, custom, and Sandbox hosts can choose a 16-24 minute cycle or fix a phase and season.

- **Sunrise** improves construction and upgrade speed by 4%.
- **Day** improves Lily Farm income by 4% and economy building income by 2%.
- **Sunset** improves animal ability recovery by 4%.
- **Night** improves territory defense by 4% and Reed Guard defense by 2%.
- **Spring** favors farms and construction, **Summer** favors energy and ability costs, **Autumn** favors expansion, and **Winter** favors defense while slightly reducing farm income.

World bonuses are server-authoritative and equal for all players. Combined bonuses are capped at 15% income, 15% defense, 10% expansion discount, 15% construction speed, and 10% cooldown improvement. The World Status HUD shows the live phase, season, weather, next transition, and numeric effects.

## Settings

Settings are stored in one versioned document. Opening Settings creates a draft: **Apply** saves and activates it, while **Cancel**, Escape, and closing the panel discard uncommitted changes. The desktop layout uses category navigation and one content scroller; mobile uses a full-screen one-column layout with safe-area padding and an always-visible action footer.

Adaptive Quality is disabled by default. When enabled, it can temporarily reduce only nonessential rendering work during sustained low frame rate and automatically restores it after performance stabilizes. It never rewrites the player's chosen graphics settings.

## How To Play

1. Choose an animal and a game mode.
2. Select a valid spawn area when the match requests one.
3. Expand into connected neutral territory.
4. Generate Animal Energy and keep enough in reserve.
5. Build structures that improve income, capacity, defense, or mobility.
6. Reinforce important borders before rival waves arrive.
7. Attack a connected enemy border with an appropriate energy send.
8. Use abilities, specials, and diplomacy at the right moment.
9. Complete the selected mode objective or remain the final faction.

The first match shows a short introduction. Coach hints continue on the map and can be disabled or reset in Settings.

## Animal Factions

### Duck

- Role: fast, beginner-friendly expansion.
- Passive: cheaper and faster open-water growth with slightly higher capacity.
- Ability: **Flock Rush**, a short open-water expansion and attack boost.
- Weakness: less effective in reed fights.

### Snake

- Role: ambush and defensive border control.
- Passive: stronger pressure around reeds and mud.
- Ability: **Ambush**, empowering the next valid reed or mud attack.
- Weakness: slower open-water expansion.

### Frog

- Role: mobility and objective tactics.
- Passive: lily income and short gap-jump expansion.
- Ability: **Big Leap**, capturing a nearby valid neutral cluster.
- Weakness: lower open-water defense.

### Turtle

- Role: durable borders and defensive control.
- Passive: stronger borders with slower early expansion.
- Ability: **Shell Guard**, temporarily slowing pressure against defended fronts.
- Weakness: limited early growth speed.

### Carp

- Role: economy scaling and water control.
- Passive: stronger water and lily income with weaker defense.
- Ability: **Golden Current**, briefly improving income for a larger follow-up play.
- Weakness: vulnerable to early pressure.

## Buildings

- **Nest** increases maximum Animal Energy.
- **Lily Farm** increases income and is especially efficient for Carp.
- **Reed Guard** improves nearby border defense.
- **Mud Tunnel** improves Snake movement through mud and reeds.
- **Jump Pad** supports Frog mobility.

Buildings require time to complete. Their cost scales through the shared building rules, and the server revalidates cost, ownership, terrain, construction state, and cooldown before accepting a build. Captured buildings transfer with their tile and enter a short conversion period.

## Combat And Specials

Normal border attacks spend energy immediately and do not use a general attack cooldown. A valid attack must be connected, hostile, permitted by diplomacy, and funded with enough Animal Energy. Repeated sends to the same valid front merge into the active wave.

- **Bite**, **Push**, **Wave**, and **Max** commit increasing percentages of energy.
- **Current Push** is a cooldown-based water-route attack.
- **Lily Barrage** pressures a small distant enemy cluster after a warning.
- **Dragonfly Guard** protects an area from Lily Barrage and Current Push.
- **Reed Shield** strengthens a selected friendly border against normal waves.

Every special is expensive, server-validated, cooldown-limited, and designed with counterplay.

## Game Modes

- **Classic Elimination**: the final valid faction or team wins.
- **Golden Lily Control**: hold Golden Lilies to reach the score target.
- **Flood Survival**: endure the configured flood waves.
- **Last Nest**: protect your Core Nest and capture opposing cores.
- **Solo**: one player against server-controlled animals.
- **Co-op Team**: human teammates share the survival objective.
- **Team Battle**: configured teams compete under the selected rules.
- **Practice**: private bot match with low pressure.
- **Sandbox**: testing controls with progression disabled.

Modes marked Coming Soon in the interface are intentionally disabled and rejected by the server.

## Controls

### Desktop

- Left click a tile to select it.
- Double-click a valid neutral border to expand, an owned border to reinforce, or a connected enemy border to attack.
- Drag the map or use `WASD` / arrow keys to pan.
- Use the mouse wheel or zoom controls to zoom.
- Use the bottom action bar for energy percentage, expansion, attacks, defense, buildings, abilities, and specials.
- Right-click territory for contextual diplomacy and territory commands.
- Press `Escape` to close an open dialog or sheet.

### Mobile

- Tap a tile to select it and use the compact action card.
- Double-tap a valid neutral border to expand, or an owned border to reinforce.
- Drag to pan and pinch to zoom.
- Long-press for contextual actions.
- Open More for buildings, specials, diplomacy, and secondary commands.

## Technology And Architecture

- Node.js HTTP server and authoritative match simulation.
- Canvas 2D client map renderer with camera, minimap, interpolation, and pooled effects.
- Shared CommonJS/browser configuration modules for costs, factions, modes, maps, objectives, releases, and balance rules.
- Server managers for tiles, economy, combat, bots, diplomacy, teams, buildings, specials, objectives, events, spawns, modes, accounts, and progression.
- SQLite persistence for accounts, sessions, profiles, achievements, badges, and history.
- Cookie-backed authenticated sessions with request validation, rate limits, security headers, and OAuth state checks.
- Web Audio synthesis with adaptive music states, spatial attenuation, randomized ambience, cooldowns, and simultaneous-voice limits.

## Running Locally

### Requirements

- Node.js 22 or newer.
- A modern browser with Canvas, Fetch, Pointer Events, and Web Audio support.

### Start

This project currently has no required third-party runtime packages. From the project folder, run:

```bash
npm start
```

Then open:

```text
http://localhost:5173/
```

`npm run dev` currently starts the same local server. On Windows, `Open PondFront.bat` or `Start-PondFront.ps1` starts the game and opens the browser.

### Environment Variables

Copy `.env.example` to `.env` when accounts or deployment settings are needed. Important variables are:

- `APP_BASE_URL`: public origin without a trailing slash.
- `SESSION_SECRET`: private random session secret, at least 32 bytes in production.
- `TRUST_PROXY`: set to `1` behind a trusted HTTPS reverse proxy.
- `PONDFRONT_DB`: SQLite database path; use a persistent disk in production.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`: optional Google OAuth configuration.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`: optional Discord OAuth configuration.

OAuth buttons remain disabled when their provider is not configured. Never commit `.env` or provider secrets.

### Validation

```bash
npm run check
npm run test:critical-systems
npm run test:mobile
npm run test:release-rules
npm run test:update-one
```

Additional focused tests are available in `package.json` for lobbies, accounts, OAuth, spawn selection, game modes, security, maps, living-world effects, and long-match stability.

### Production

The app does not require a separate client build step. The Node server serves `public/` and `shared/` directly. The included `render.yaml` uses:

```text
Build: npm install
Start: npm start
Health: /health
```

Production deployments must set a strong `SESSION_SECRET`, the correct HTTPS `APP_BASE_URL`, trusted-proxy behavior, and persistent storage. Free hosts with ephemeral filesystems will not retain SQLite data after redeploys.

If the Render service was created as a regular Web Service instead of from the Blueprint, add the secret manually:

1. Open the PondFront service in the Render Dashboard.
2. Open **Environment** and choose **Add Environment Variable**.
3. Set the key to `SESSION_SECRET` and use Render's generated secret value option, or provide a private random value of at least 32 bytes.
4. Choose **Save and deploy**.

Do not put the secret in GitHub or hardcode it in `server.js`. New services created from the included `render.yaml` Blueprint receive a generated `SESSION_SECRET` automatically.

## Project Structure

```text
public/    Browser UI, Canvas rendering, audio, controls, and effects
server/    Authoritative game, account, persistence, lobby, and bot managers
shared/    Configuration and formulas used by both server and browser
scripts/   Regression, QA, balance, security, mobile, and stability tests
data/      Local runtime data such as the SQLite database
docs/      Supporting design and audit documentation
server.js  HTTP routes, sessions, lobby transport, and match orchestration
```

## Screenshots

Release screenshots are planned for the repository gallery. Until they are added, launch the local game to view the lobby, spawn selection, main strategy map, mobile action dock, and results screen directly.

## Update History

### Update 1 — Full Public Release

- Added a shared release/version source, launch presentation, live server status, rotating tips, Updates tab, unread badge, and Credits.
- Improved lobby navigation, animal comparisons, tutorial access, and mobile release panels.
- Added a complete audio mixer with environment, animals, combat, buildings, and UI routing; pond ambience; animal selection identities; adaptive music; and voice limits.
- Corrected stale version wording, lobby Settings access, tutorial replay, building audio routing, and health response metadata.
- Preserved the existing authoritative gameplay balance while expanding regression coverage.

The exact in-game changelog and release history are stored in `shared/releaseConfig.js`, so later update entries can be added without rebuilding the release interface.

## Roadmap

These are ideas, not completed features:

- More verified map themes and spectator tools.
- Additional licensed wildlife recordings and biome sound packs.
- Improved reconnect recovery for interrupted live multiplayer sessions.
- Optional external database adapters for multi-instance hosting.
- Additional animal factions after balance testing.

## Contributing

Bug reports and focused improvement proposals are welcome. Keep changes scoped, preserve server authority, use the shared configuration modules instead of duplicating displayed values, and add a regression test when changing gameplay rules.

Before proposing a change, run the relevant package tests and describe any intentional balance impact. Do not submit copied assets, branding, UI, sounds, or code from another game.

## Bug Reports

Include:

- What happened and what you expected.
- Exact steps to reproduce it.
- Device, operating system, browser, and orientation.
- Game mode, map, animal, and bot difficulty.
- Whether you were a guest or signed-in player.
- Screenshot or short video when useful.
- Browser console error and server log excerpt, with private data removed.

## Credits

- Design, code, and pond world: PondFront.io project contributors.
- Genre inspiration: real-time territory strategy games, including OpenFront.io.
- Runtime technology: Node.js, Canvas 2D, Web Audio, and SQLite.
- PondFront.io uses its own faction names, visuals, rules, sounds, and interface.

## License

`package.json` currently declares `UNLICENSED`. No open-source license has been selected. All rights are reserved unless the project owner publishes a separate license.
