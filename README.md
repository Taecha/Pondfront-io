# PondFront.io

PondFront.io is an animal-themed real-time territory strategy prototype. Pick Duck, Snake, or Frog, expand through a pond map, manage Animal Energy, fight border wars, use abilities, build upgrades, and race to control 70% of the lake.

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:5173/
```

The server uses `PORT` when a host provides one, so it is ready for Node web hosting.

## Deploy From GitHub

This game uses `server.js` for the match state, bots, energy, combat, abilities, and API routes. GitHub Pages only hosts static files, so GitHub Pages cannot run the full game server.

Use GitHub as the code home, then connect the repository to a Node host such as Render, Railway, Fly.io, or another service that can run:

```bash
npm start
```

Render can use the included `render.yaml` file:

1. Create a new GitHub repository.
2. Upload or push this `pondfront` folder.
3. Open Render in Chrome and choose **New Web Service**.
4. Connect the GitHub repository.
5. Use:
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
6. Deploy, then open the public URL Render gives you.

## Project Layout

```text
server.js                 Node web server and game loop
public/                   Browser UI, canvas rendering, VFX, controls
server/                   Server-authoritative managers
shared/                   Shared config, balance, and animal data
scripts/                  Simulation and balance checks
```
