# PondFront.io Render Deployment Performance Notes

## Current Finding

Before this update, each Expand click returned a full game snapshot. On a deployed Render server, that can feel like a one-second dead click because the response includes the full tile map and full match state.

After this update, normal gameplay actions can return small deltas while full snapshots remain available for start, reconnect, and periodic sync.

## Local Measurement

Measured locally after the fix:

- Average Expand round trip: 4ms
- Worst Expand round trip: 10ms
- Average server processing: 1ms
- Worst server processing: 3ms
- Average delta response size: about 3.8 KB
- Full state response size: about 815 KB

This means deployed delay is likely caused by network distance, Render instance wake/CPU, or payload transfer, not by a slow local expansion algorithm.

## Render Checklist

Recommended Render settings:

- Set `NODE_ENV=production`.
- Use a Render region close to the main players.
- Avoid free-tier sleep for active play if possible.
- Keep debug logs off unless testing with `?latency=1`.
- Use the smallest map/bot count for weaker instances.
- Confirm `/health` returns quickly before play.
- Test with mobile effects on Medium or Low if the device is weak.

## Latency Testing On Render

Open:

```text
https://your-render-url.onrender.com/?latency=1
```

Then test:

1. Start a practice match.
2. Click Expand 20 times.
3. Watch console logs for `[EXPAND LATENCY]`.
4. Record:
   - `roundTripMs`
   - `serverProcessMs`
   - `changedTiles`

Interpretation:

- High `roundTripMs`, low `serverProcessMs`: network, Render region, sleeping instance, or payload transfer.
- High `serverProcessMs`: server CPU, map size, bot count, or heavy match logic.
- Low numbers but bad visual feel: client rendering or missing pending feedback.

## What Was Optimized

- Client shows pending visuals instantly.
- Action sends include `clientActionId`.
- Server returns delta action responses.
- Changed tiles are sent instead of the full map.
- Player stats and active waves are merged locally.
- Debug stats now show server processing time.

