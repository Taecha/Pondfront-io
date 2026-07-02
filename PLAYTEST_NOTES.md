# PondFront.io Playtest Notes

Date: 2026-07-02

## Test Pass

- Browser loaded the game locally at `http://localhost:5173/`.
- Started a visible browser match successfully with the Duck default start screen.
- Started server matches as Duck, Snake, and Frog through the local API to verify all three animals still initialize correctly.
- Ran accelerated bot-only simulations to observe long-match pacing, bot fighting, farming, territory growth, and income.
- Checked browser console after reload/start: no console errors.

## What Felt Too Easy

- Before this balance pass, expansion and farming rewarded fast map painting more than strategic timing.
- Lily Farm income was immediate and too large for a low-risk economy action.
- Bots let players expand safely for too long because they preferred neutral tiles over pressure attacks.

## What Felt Too Fast

- Early territory growth scaled max energy and income too quickly.
- Neutral expansion cost did not account for empire size or distance from the start, so large players could keep growing almost as cheaply as small players.
- Farms became useful instantly, which made economy snowballing feel too clean.

## What Felt Too Slow

- Fighting pressure arrived too late because bot logic treated enemy attacks as a backup plan after expansion.
- Defensive actions were useful, but bots did not choose them often enough near contested borders.

## Why Bots Were Not Attacking Enough

- Bot turns prioritized neutral expansion whenever neutral tiles existed.
- There were no clear early, mid, late, or leader-pressure phases.
- Bot attack scoring did not strongly punish high-threat leaders or reward attacking weak neighbors.
- Bots had no personalities, so their behavior felt too samey.

## Systems Needing Balance

- Neutral expansion cost needed territory, distance, terrain, and enemy-border scaling.
- Income needed slower territory scaling and soft caps.
- Lily Farms needed limits, delayed activation, and dynamic cost.
- Bots needed phase-based aggression and leader targeting.
- Attack spam needed cooldown and war exhaustion so combat has waves instead of noise.

## Changed First

- Added shared balance config.
- Slowed income and max-energy growth.
- Added expansion scaling.
- Added Lily Farm limits, delayed activation, and dynamic cost.
- Added bot personalities and phase-based attack pressure.
- Added simulation metrics for match length, attacks, captures, builds, farms, and income.

## Remaining Ideas

- Add visible objective zones such as Golden Lily, Ancient Reed, and Mud Spring.
- Add clearer contested-border UI.
- Add stronger diplomacy reactions when one leader approaches the win threshold.
- Add a post-match timeline showing attacks, farms, and leader changes.
