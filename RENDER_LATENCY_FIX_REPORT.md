# PondFront.io Render Latency Fix Report

## Summary

Expansion now feels instant on slower deployed connections because the client shows a local pending effect immediately and the server returns a small authoritative delta instead of a full map snapshot for normal gameplay actions.

Real ownership is still server-authoritative. The client only shows pending visuals until the server confirms or rejects the action.

## What Changed

Client:

- Expand, Attack, Defend, and Current Push now create pending visuals immediately.
- Pending expansion shows a ripple/glow and `Expanding...` text before the network response.
- Pending actions include a `clientActionId`.
- Gameplay action requests send `responseMode: "delta"`.
- Client merges server-confirmed changed tiles, player stats, active attacks, active expansions, specials, and new events.
- Rejected actions remove the pending visual and show blocked feedback.
- Debug mode records round-trip latency and server process time.

Server:

- `/api/action` now supports delta responses for gameplay actions.
- Delta responses include:
  - `clientActionId`
  - `serverReceivedTime`
  - `serverProcessMs`
  - `changedTiles`
  - changed player stats
  - active wave snapshots
  - events emitted by the action
- Full snapshots are still used for match start, reconnect/state polling, and non-delta requests.

## Local Benchmark

Local test against `http://localhost:5173`:

- Expand samples: 12
- Average round trip: 4ms
- Worst round trip: 10ms
- Average server process time: 1ms
- Worst server process time: 3ms
- Average delta response size: about 3.8 KB
- Full state response size at the same time: about 815 KB
- Normal live polling now uses state deltas when possible:
  - Full state: about 805 KB
  - Delta state: about 10.7 KB
  - Reduction: about 75x

The deployed Render delay is therefore mostly network/payload/hosting latency, not local expansion logic.

## How To Debug On Render

Open the game with:

```text
?latency=1
```

Example:

```text
https://your-render-url.onrender.com/?latency=1
```

Then open the browser console and look for:

```text
[EXPAND LATENCY]
```

The debug panel also shows:

- Ping
- Expand round-trip time
- Server process time
- Server tick time
- Messages per second

## Test Results

Passed:

- Syntax check for server, shared, and public files.
- QA playtest script.
- Delta expand response returns changed tiles.
- Delta expand response includes server process timing.
- Live polling can return a delta instead of a full map snapshot.
- Full state polling still works.
- Local server health check passes.
