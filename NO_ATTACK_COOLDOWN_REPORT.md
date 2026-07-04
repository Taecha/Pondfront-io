# No Attack Cooldown Report

## Goal

Normal border attacks should be limited by Animal Energy and server validation, not by a timer. Current Push, animal abilities, diplomacy, pings, reinforcement, and construction can still use cooldowns or build timers.

## Changes Made

- Set normal border attack cooldown to `0` in `shared/combatConfig.js`.
- Added `minimumAttackEnergy` so tiny attacks fail with an energy message instead of a cooldown message.
- Increased normal active wave cap to `3`.
- Removed the server-side normal attack cooldown rejection from `server/CombatManager.js`.
- Normal attacks now immediately spend selected energy when validated.
- Repeated attacks on the same active target merge into the existing wave and return `resultType: "mergedAttack"`.
- Same-target merging pushes an `attackWave` event with `merged: true` and the message `Added energy to active wave`.
- Kept Current Push cooldown intact.
- Kept animal ability cooldowns intact.
- Kept bot attack pacing as AI thinking delay, not player-facing attack cooldown.
- Updated UI labels to show send energy, active waves, low-energy disabled states, and Current Push as the cooldown-based special.

## Validation Rules

The server still checks:

- Player and target validity.
- Enemy ownership.
- Diplomacy, alliance, and truce blocks.
- Connected frontline reach.
- Minimum attack energy.
- Active wave cap.
- Terrain and defender costs.
- Energy cannot go negative because the server spends from real player energy.

## Manual Test Results

- Bite can start immediately when enough energy is available.
- A second attack can be sent right away if enough energy remains.
- Same-target attacks merge into the active wave.
- Low-energy attacks are blocked by `Not enough Animal Energy`.
- Current Push still has cooldown.
- Animal abilities still have cooldown.
- Mobile attack buttons show energy send amounts and no normal cooldown text.
- Bots still attack with decision pacing and energy thresholds.

## Technical Test

- `npm run check` passed after adding the bundled Node runtime to PATH in this Codex environment.
- Local server restarted on port `5173`.
- `/health` returned `200`.
- Browser smoke test started a Solo Match and confirmed the map canvas was visible and nonblank.
