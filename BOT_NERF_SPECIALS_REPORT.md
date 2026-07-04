# Bot Nerf And Pond Specials Report

## Goal

Make Easy and Normal bots fairer while adding balanced pond-themed special mechanics that create strategy without copying real-world weapon names or any other game's assets, UI, code, or branding.

## Bot Difficulty Changes

- Added a true `Passive` bot mode for sandbox/testing. Passive bots do not expand or attack unless directly commanded by sandbox tools.
- Easy bots now use about 45% player expansion pace, 8-12 second reaction delay, 5-8 second expansion cooldown, 20-30 second attack delay, and 45% mistake chance.
- Normal bots now use about 70% player expansion pace, 5-8 second reaction delay, 3-6 second expansion cooldown, 14-22 second attack delay, and 25% mistake chance.
- Hard bots still pressure the map, but with limited perfection, slower special timing, and a 10% mistake chance.
- Chaos bots remain the advanced aggressive setting.
- Easy and Normal bots now wait for more energy, send less early expansion energy, build less often, and sometimes choose weaker actions.
- Bot debug logs include bot name, difficulty, energy, action, target, reason, cooldown, and result when running in development mode.

## Special Mechanics Added

- `Lily Barrage`: long-range pond-energy strike that warns before impact, weakens a small enemy area, and can capture only a few weak tiles.
- `Dragonfly Guard`: anti-strike defense zone that protects own/allied territory and reduces Lily Barrage and Current Push impact.
- `Reed Shield`: border defense zone that slows committed attack waves and slightly reduces Lily Barrage damage.

## Server Authority

- Server validates special type, target tile, range, owner, cooldown, energy cost, diplomacy, alliance/truce state, and valid territory rules.
- Client only sends the chosen special type and target tile.
- Lily Barrage impact, capture, weakening, defense reduction, cooldowns, and energy spending happen server-side.
- Dragonfly Guard and Reed Shield zones are owned and expired by the server.
- Lily Barrage cannot directly hit a protected Core Nest and cannot instantly wipe a player by itself.

## UI And Feedback

- Added a `Special` button to the main action bar.
- Added a special selection sheet with cost, cooldown, target type, effect, and counterplay text.
- Added target previews for Lily Barrage, Dragonfly Guard, and Reed Shield.
- Added mobile-friendly special cards and confirm flow.
- Added warning rings, countdowns, projectile/splash effects, Dragonfly Guard circles, Reed Shield border pulses, floating text, and sound feedback.

## Bot Special Rules

- Easy bots do not use specials.
- Normal bots use specials rarely and only after the early game.
- Hard bots use specials occasionally with imperfect targeting.
- Chaos bots use specials more often.
- Bots must have enough energy and ready cooldowns.
- Bots avoid unfairly targeting the human every time and can choose defensive or weaker actions.

## Balance Notes

- Lily Barrage costs 120 Animal Energy and has a 60 second cooldown, so a failed strike creates a real tempo loss.
- Dragonfly Guard costs 90 Animal Energy and lasts 20 seconds, protecting an area but spending energy that could have been used for expansion.
- Reed Shield costs 70 Animal Energy and lasts 18 seconds, helping border defense without making borders invincible.
- Beginner Combat makes hostile bot Lily Barrage pressure weaker against the player.

## Test Results

- `pnpm run check` passed with the bundled Node runtime.
- Easy bot API smoke test showed bots expanding slowly instead of taking the whole map immediately.
- Lily Barrage rejected an out-of-range target with `outOfRange`.
- Lily Barrage accepted a valid enemy target, spent 120 Animal Energy, started a 60 second cooldown, created a warning event, and resolved after the warning delay.
- Lily Barrage impact captured 4 weak tiles and weakened 2 tiles in the test, without instantly eliminating the defender.
- Reed Shield activated on an owned border tile and created a server defense zone.
- Dragonfly Guard activated on owned territory and created a server defense zone.
- Server stayed running during API tests.
- After the final restart, `/health` returned `200` and Dragonfly Guard placed successfully on owned territory through `/api/action`.

## Remaining QA

- Do a full visual mobile device pass after more UI changes.
- Watch Normal bots for 5-10 live matches to confirm they pressure without snowballing.
- Revisit Lily Barrage numbers if players find it too weak against heavily reinforced targets or too strong against new players.
