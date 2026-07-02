# PondFront.io Alliance And Combat Test Report

## Automated Checks

Command:

```text
node --check on 25 project files
```

Result:

```text
Passed
```

Command:

```text
node scripts/qaPlaytest.js
```

Result:

```text
Passed: 37 checks
Failed: 0 checks
```

## Alliance Tests

- Request alliance:
  - Result: passed.
  - Detail: pending alliance request appears.
- Accept alliance:
  - Result: passed.
  - Detail: players become allied.
- Attack ally:
  - Result: passed.
  - Detail: server rejects with `Cannot attack ally.`
- Break alliance:
  - Result: passed.
  - Detail: betrayal cooldown starts.
- Attack during betrayal cooldown:
  - Result: passed.
  - Detail: server rejects with betrayal cooldown message.
- Truce:
  - Result: passed.
  - Detail: attacks are blocked during the truce timer.
- Request expiration:
  - Result: passed.
  - Detail: pending request expires back to neutral after the timer.
- Bot diplomacy:
  - Result: passed.
  - Detail: bot simulation produced diplomacy events and included peaceful/loyal/opportunist personalities.

## Combat Tests

- Frontline border attack:
  - Result: passed.
  - Detail: attack starts a war relationship.
- Far enemy tile attack:
  - Result: passed.
  - Detail: server rejects with `Too far from border.`
- Defended border:
  - Result: passed.
  - Detail: capture cost rose from about 9 to about 33 after defense was added.
- Snake Ambush:
  - Result: passed.
  - Detail: Ambush prepares the next reed/mud attack.
- Turtle Shell Guard:
  - Result: passed.
  - Detail: enemy capture cost increased during Shell Guard.
- Insufficient/invalid attack paths:
  - Result: covered by server validation and UI blocked-action feedback.

## Mobile Support Verified In Code

- Tap selects tiles.
- Double tap performs quick expand, attack, or defend when valid.
- Long press opens the same context menu used by right-click.
- Context menu now includes alliance, truce, war, pings, warning, and attack actions.
- Buttons are disabled when a relationship makes the action invalid.
- Minimap now shows ping pulses.
- Map canvas uses touch-action controls and keeps one-finger pan / pinch zoom behavior.

## Browser Smoke Test

Desktop:
- `GET /` returned HTTP 200.
- Lobby loaded with five animal cards.
- Game started from the browser.
- Game screen became visible.
- Top bar showed live animal and energy values.
- Diplomacy panel contained 10 upgraded actions.
- Browser console showed no errors or warnings.

Mobile viewport:
- Tested at 390 x 844.
- Game started successfully.
- Mobile map controls were visible.
- Bottom action bar fit the viewport width.
- Horizontal page overflow was hidden.
- Browser console showed no errors or warnings.

## Balance Simulation

Command:

```text
node scripts/simulateBalance.js
```

Result:

```text
Passed
Matches: 10
Average attacks: 69.8
Average wave captures: 176.9
Average builds: 729.5
Average income: 24.24/s
```

Notes:
- Combat volume is lower than before because truce and alliance states now actually block some attacks.
- Bots still attacked in every simulated match.
- Winners included several animal families, including Carp and Turtle themed bots.

## Files Most Directly Updated

- `shared/diplomacyConfig.js`
- `shared/combatConfig.js`
- `server/DiplomacyManager.js`
- `server/CombatManager.js`
- `server/BotManager.js`
- `server.js`
- `public/game.js`
- `public/ui.js`
- `public/infoPanel.js`
- `public/render.js`
- `public/helpMenu.js`
- `public/index.html`
- `public/style.css`
- `scripts/qaPlaytest.js`
