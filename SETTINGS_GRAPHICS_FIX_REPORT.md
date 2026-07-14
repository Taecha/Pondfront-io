# PondFront.io Update 1.01 - Settings & Graphics Fix

## 1. Root Cause

The Settings form maintained a draft, but its `input` handler only changed form values. It did not apply that draft to the running renderer, VFX, audio, mobile, or world systems. `Cancel` rewrote controls without restoring runtime state. In addition:

- `strategicView` defaulted to `true`, causing Medium, High, and Ultra to render through the same clean-map path.
- Desktop rendering ignored the FPS setting because frame skipping only ran in touch layout.
- The renderer and mobile controller still read legacy localStorage keys instead of the versioned settings document.
- Preset definitions existed in both UI code and shared configuration and did not include water, fog, shadows, or world animation.
- Audio category values were multiplied into newly created voices instead of controlling persistent gain buses.
- Adaptive quality changed renderer options directly without exposing a separate selected/effective settings layer.

## 2. Previously Disconnected Settings

The affected controls included graphics preset, visual quality, effects, particles, decorations, living world, screen shake, audio category sliders, FPS limit on desktop, Battery Saver restoration, and several mobile presentation preferences. Water, shadow, fog, world animation, and border effect controls did not previously exist as real settings.

## 3. Central Architecture

`PondSettingsManager` now owns:

- `savedSettings`: validated values persisted for the next session.
- `activeSettings`: values controlling the current client.
- `draftSettings`: values being edited and previewed.
- `openSnapshot`: the active state restored by Cancel.
- `adaptiveOverrides`: temporary performance reductions kept separate from player choices.

It exposes `get`, `getValue`, `getEffective`, `setDraft`, `applyDraft`, `cancelDraft`, `resetCategory`, `resetAll`, `subscribe`, and adaptive override methods. Preview, apply, cancel, reset, and performance events use one deduplicated subscriber set.

## 4. Rendering Connections

- UI render options now come from central effective settings instead of form controls or old storage keys.
- Water quality controls background wave density, shimmer, reflections, and map water texture.
- Shadow quality controls map and active-building shadows.
- Fog quality controls fog visibility and layer count.
- World animation quality controls entity, wildlife, weather, and ambient motion density.
- Border Effects removes optional animated border glow while retaining ownership borders and attack indicators.
- Particle and effect quality reconfigure and immediately trim the active VFX pools.
- Decorations and Living World immediately remove or restore ambient entities.
- Reduced Motion suppresses screen shake and camera effects while retaining gameplay indicators.

## 5. Audio Connections

Web Audio now uses persistent gain buses for general SFX, UI, combat, animal, building, environment, music, and master output. Previewed sliders update those buses immediately, including already playing music, ambience, and category-routed sounds. Preview changes use `persist: false`; Apply saves them, and Cancel restores the opening mixer state.

## 6. Preset Differences

| Profile | Particles | Water | Shadows | Fog | Decorations | World Animation |
| --- | --- | --- | --- | --- | --- | --- |
| Low | Low cap | Low | Off | Low | Off | Low |
| Medium | Moderate | Medium | Low | Medium | On | Medium |
| High | High | High | Medium | High | On | High |
| Ultra | Maximum safe | Ultra | High | Ultra | Full | Ultra |
| Custom | Player values | Player value | Player value | Player value | Player value | Player value |

Changing a preset-owned option switches the preset to Custom. The automated VFX profile test measured a desktop particle cap of 34 on Low and 380 on Ultra.

## 7. Cache Invalidation

Preview, Apply, Cancel, reset, and adaptive events invalidate renderer visual caches and minimap presentation without touching territory ownership or resetting the match. VFX pools are trimmed immediately. Living World entities are trimmed when their effective limit drops. Battery Saver changes also recalculate the canvas pixel ratio.

## 8. Persistence And Migration

The versioned `pondfront:settings:v2` document remains the source of truth. Validation now migrates legacy preset names (`Simple` to `low`, `Balanced`/`Normal` to `medium`), string booleans, formatted FPS values, and Unlimited to `0`. Missing or invalid values fall back per field without discarding valid choices.

## 9. Adaptive Quality

Adaptive Quality remains off by default. When enabled, it publishes temporary particle, water, fog, world animation, decoration, and wildlife overrides. Controls continue to show the selected settings. Recovery removes overrides and restores the selected profile. Battery Saver similarly computes an effective low-power profile and caps rendering at 30 FPS without overwriting saved custom settings.

## 10. Files Changed

- `shared/settingsConfig.js`
- `shared/releaseConfig.js`
- `public/settingsManager.js`
- `public/index.html`
- `public/style.css`
- `public/ui.js`
- `public/game.js`
- `public/render.js`
- `public/vfx.js`
- `public/livingWorld.js`
- `public/audioManager.js`
- `public/mobileControls.js`
- `package.json`
- `scripts/settingsGraphicsFixTest.js`
- `SETTINGS_GRAPHICS_FIX_REPORT.md`

## 11. Tests Completed

- `settingsGraphicsFixTest.js`: passed. Validates schema migration, presets, Custom detection, manager events, render/audio wiring, FPS modes, and Low/Ultra VFX limits.
- `settingsLivingWorldTest.js`: passed. Validates settings draft/apply structure and authoritative world rules.
- `mobileFirstTest.js`: 22/22 passed, including desktop double-click actions and mobile layouts.
- `releaseRulesTest.js`: all 21 authoritative gameplay checks passed.
- `performanceStabilityTest.js`: passed a 20-minute, 20-bot Amazon simulation; 5.554 ms average server tick and 9.832 ms p95.
- Syntax checks passed for all 12 changed JavaScript files.
- Live server health passed at `http://localhost:5173/health` with release `Settings & Graphics Fix`.

Automated in-app browser control could not initialize in this host session because its runtime reported `Cannot redefine property: process`. The live server and code-level integration tests were completed; the cross-browser Chrome/Edge/Firefox visual matrix remains a manual release check.

## 12. Bugs Fixed

- Live settings preview did not reach game systems.
- Cancel did not reapply opening values.
- High and Ultra were flattened by default Strategic View.
- Desktop FPS limits were ignored.
- Battery Saver could depend on stale legacy storage.
- Particle caps did not shrink immediately.
- Decorations could remain alive after being disabled.
- Audio categories only affected newly created sounds.
- Mobile controls read a different preference source.
- Adaptive reductions were not represented separately from selected settings.

## 13. Known Remaining Issues

- Browser vendors and device GPUs may produce slightly different Canvas and Web Audio output; the full Chrome, Edge, Firefox, tablet, and physical-phone visual matrix should be run before public deployment.
- Web Audio remains synthesized rather than sample based.
- Browser autoplay rules still require one user interaction before audio can begin.

## 14. Update 1.01 Changelog

### Fixed

- Fixed graphics options changing in the menu without affecting the game.
- Fixed particle and effect quality not updating active systems.
- Fixed decorations remaining visible after being disabled.
- Fixed audio sliders only affecting newly created sounds.
- Fixed graphics presets changing their label without applying a profile.
- Fixed settings migration, startup restoration, and Cancel rollback.
- Fixed desktop frame limits being ignored.
- Fixed Adaptive Quality lacking a separate temporary override layer.
- Preserved the smaller-display Settings scrolling fix.

### Improved

- Added immediate graphics and audio previews.
- Added one central settings manager and validated schema.
- Added real Low, Medium, High, Ultra, and Custom profiles.
- Added real water, shadow, fog, world animation, and border effect controls.
- Added 30, 45, 60, 90, 120, and Unlimited visual frame limits.
- Improved cache refresh, Battery Saver, adaptive recovery, and mobile preference wiring.
