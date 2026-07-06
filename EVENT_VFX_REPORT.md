# PondFront.io Event VFX Report

## Summary

This update upgrades lake/world events so they have clear warning, active, and ending feedback. Events now carry visual metadata, affected map areas, minimap feedback, banner text, particles, and lightweight audio hooks.

## Event System

Added event visual metadata in `shared/lakeEvents.js`:

- Mud Slide
- Flood Wave
- Lily Bloom
- Reed Surge
- Rainstorm
- Current Shift
- Rockfall
- Foggy Marsh
- Migration

Server-side event flow now includes:

- `lakeEventWarning`
- `lakeEventStarted`
- `lakeEventEnded`

The server also sends compact affected areas:

- tile IDs
- focus tile
- area label
- bounds
- direction for moving water/current events

## Visual Effects

`public/vfx.js` now includes reusable event functions:

- `playEventWarning(eventType, area)`
- `playEventStart(eventType, area)`
- `playEventLoop(eventType, area)`
- `playEventEnd(eventType, area)`
- `clearEventEffects(eventId)`

Event effects include:

- warning rings and countdowns
- mud streaks and splashes
- flood/current flow trails
- lily bloom sparkles
- reed sway pulses
- rain and storm tint
- rock crack/falling stone particles
- soft fog/mist
- ending fade and lingering Mud Slide stain

## Map And Minimap

`public/render.js` now draws active and upcoming event areas directly on the map. It uses capped tile overlays so the board remains readable.

Minimap feedback now shows:

- event affected zones
- warning pulses
- focus tile rings
- direction marks for Flood Wave and Current Shift

## UI And Audio

The event banner now supports upcoming event warnings with area text and countdowns.

`public/audioManager.js` adds original synthetic event hooks:

- mud rumble
- flood rush
- bloom chime
- reed rustle
- storm rain/rumble
- rockfall crack
- fog wind

No copyrighted audio files were added.

## Mobile And Performance

Mobile and low-quality modes reduce:

- affected tile overlay count
- particle count
- minimap event density
- rain density
- text clutter

The renderer caps event overlays and skips tiny/off-screen effects.

## QA Checklist

Passed by implementation review and automated syntax checks:

- Mud Slide has warning/start/active/end effects.
- Flood Wave path and direction are visible.
- Lily Bloom has readable glow and particles.
- Reed Surge has reed motion and green pulse.
- Rainstorm adds light rain without hiding gameplay.
- Current Shift shows directional flow.
- Rockfall shows crack/stone feedback.
- Foggy Marsh uses transparent mist and remains readable.
- Minimap shows event areas and focus pings.
- Mobile density is reduced.
- No external assets or copied effects were used.

