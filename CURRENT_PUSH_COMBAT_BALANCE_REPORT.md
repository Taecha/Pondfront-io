# PondFront.io Current Push and Combat Balance Report

## Summary

Current Push was reworked from an instant route attack into a server-authoritative traveling water attack. It now has travel time, visible route data, warning events, cooldown, range/efficiency penalties, reinforcement counterplay, and a limited impact capture size.

Combat clarity was improved with a direct Current Push button, clearer Border Attack vs Current Push text, incoming warning banner, route preview estimates, and clearer combat messages.

Bots were rebalanced through a shared difficulty config so Easy/Normal are less punishing and Hard/Chaos remain challenging.

## Current Push Changes

- Added server-side active Current Push objects.
- Current Push now travels before impact instead of capturing instantly.
- Travel time scales with route distance and is clamped between 3s and 12s.
- Defender receives an incoming warning before impact.
- Target banner shows incoming Current Push and can focus the target tile.
- Defender can reinforce the target before impact.
- Defender-owned route tiles weaken the push.
- Turtle Shell Guard reduces Current Push impact power.
- Long routes lose power and capture fewer tiles.
- Current Push has a 45s cooldown.
- Current Push has a range limit and minimum energy requirement.
- Current Push cannot attack allies or truce targets.
- Current Push route cancels if blocked by rocks/blocked terrain.

## Combat UI Changes

- Added a bottom-bar `Current Push` button.
- Enemy border panel now shows:
  - recommended action
  - reason
  - Current Push route distance
  - travel time
  - impact power
  - capture estimate
- Far enemy borders now say: `Too far for Border Attack. Try Current Push.`
- Current Push route is drawn as a teal route line with a moving marker and impact countdown.
- Incoming Current Push uses the compact warning banner.
- VFX added for launch, warning, blocked, and impact.

## Bot Difficulty Changes

Added `shared/botDifficultyConfig.js`.

Easy:
- Slower turns and reaction delay.
- Longer attack cooldown.
- Smaller attacks.
- High mistake chance.
- Almost never uses Current Push.
- Beginner Combat defaults on.

Normal:
- Fairer reaction delay.
- Longer cooldowns than before.
- Rare Current Push.
- More mistakes than Hard.

Hard:
- Faster and smarter, but still cooldown-limited.
- Occasional Current Push.

Chaos:
- Aggressive, frequent pressure, more Current Push.
- Advanced mode only.

## Tests Run

1. Current Push delayed travel:
   - Launched a valid route attack.
   - Warning fired before impact.
   - Target did not change ownership before impact.
   - Route object cleared after impact.

2. Strong Current Push impact:
   - Launched with high energy against weak defense.
   - Captured after travel, not instantly.
   - Capture was limited by max impact capture rules.

3. Reinforcement counterplay:
   - Increased target defense before impact.
   - Current Push captured 0 tiles.
   - Message: `Current Push blocked by reinforced border.`

4. Blocked route:
   - Changed a route tile to rock after launch.
   - Current Push cancelled.
   - Message: `Current Push route blocked.`

5. Ally protection:
   - Tried Current Push against an allied target.
   - Rejected.
   - Message: `Cannot attack ally.`

6. Syntax checks:
   - 46 JavaScript files passed `node --check`.

7. Server smoke check:
   - `http://localhost:5173/health` returned OK.
   - Main page and new shared bot config served with HTTP 200.

## Notes

- Current Push is now best used as delayed pressure, not instant territory theft.
- Normal Border Attack remains the best option for direct connected fighting.
- Mobile support uses the existing bottom bar, warning banner, compact toasts, and tap-to-focus warning behavior.
