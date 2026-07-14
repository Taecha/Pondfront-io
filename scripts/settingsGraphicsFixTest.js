const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const settings = require("../shared/settingsConfig");
const release = require("../shared/releaseConfig");

assert.strictEqual(settings.VERSION, 2, "settings document remains versioned");
assert.strictEqual(settings.DEFAULTS.adaptiveQuality, false, "Adaptive Quality must remain opt-in");
assert.strictEqual(settings.DEFAULTS.strategicView, false, "normal graphics must not be hidden by strategic view");
assert.deepStrictEqual(settings.OPTIONS.fpsLimit, ["0", "30", "45", "60", "90", "120"], "all FPS choices must validate");
assert.strictEqual(settings.parseDocument({ visualPreset: "Simple", fpsLimit: "60 FPS", batterySaver: "on" }).values.visualPreset, "low", "old preset names migrate");
assert.strictEqual(settings.parseDocument({ fpsLimit: "Unlimited" }).values.fpsLimit, "0", "Unlimited migrates to zero");
assert.strictEqual(settings.parseDocument({ screenShake: "false" }).values.screenShake, false, "saved checkbox strings migrate safely");
assert.strictEqual(settings.valuesForPreset("ultra").waterQuality, "ultra", "Ultra must change water quality");
assert.strictEqual(settings.valuesForPreset("low").mapDecorations, false, "Low must disable decorations");
assert.strictEqual(settings.valuesForPreset("low").shadowQuality, "off", "Low must disable soft shadows");
assert.strictEqual(settings.matchingPreset(settings.valuesForPreset("high")), "high", "preset matching must be deterministic");
assert.strictEqual(settings.matchingPreset({ ...settings.valuesForPreset("high"), waterQuality: "low" }), "custom", "manual changes must become Custom");

const html = read("public/index.html");
for (const id of ["visualPreset", "waterQuality", "shadowQuality", "fogQuality", "worldAnimationQuality", "borderEffects", "fpsLimit", "graphicsTestPanel"]) {
  assert.ok(html.includes(`id="${id}"`), `${id} control must exist`);
}
for (const value of ["30", "45", "60", "90", "120", "0"]) assert.ok(html.includes(`<option value="${value}">`), `FPS ${value} must be selectable`);
assert.ok(html.includes('<option value="custom">Custom</option>'), "Custom preset must be visible");

const manager = read("public/settingsManager.js");
for (const method of ["getEffective", "setDraft", "applyDraft", "cancelDraft", "resetAll", "subscribe", "setAdaptiveLevel"]) {
  assert.match(manager, new RegExp(`${method}\\(`), `${method} must be implemented`);
}
assert.match(manager, /settings:previewed/, "preview events must be emitted");
assert.match(manager, /persistAudio:\s*false/, "previews and Cancel must not persist audio");
assert.match(manager, /openSnapshot/, "Cancel must restore the settings active when the panel opened");

const ui = read("public/ui.js");
assert.match(ui, /settingsManager\?\.getEffective/, "render options must read effective central settings");
assert.match(ui, /waterQuality:\s*settings\.waterQuality/, "water quality must reach the renderer");
assert.match(ui, /shadowQuality:\s*settings\.shadowQuality/, "shadow quality must reach the renderer");
assert.match(ui, /borderEffects:\s*settings\.borderEffects/, "border effects must reach the renderer");

const game = read("public/game.js");
assert.match(game, /frameInterval = fpsLimit > 0/, "FPS limiter must support Unlimited");
assert.doesNotMatch(game, /isTouchLayout\(\) && this\.lastRenderAt/, "desktop must use the FPS limiter too");
assert.match(game, /setAdaptiveLevel/, "performance manager must publish temporary adaptive overrides");

const renderer = read("public/render.js");
assert.match(renderer, /options\.waterQuality/, "renderer must read water quality");
assert.match(renderer, /shadowProfile/, "renderer must read shadow quality");
assert.match(renderer, /borderEffects !== false/, "renderer must suppress optional border glow");

const audio = read("public/audioManager.js");
assert.match(audio, /this\.categoryGains/, "audio must use live category gain buses");
assert.match(audio, /options\.persist !== false/, "audio preview must avoid persistent writes");
assert.match(audio, /panner\.connect\(destination\)/, "existing category audio must route through mutable gains");

const vfxSource = read("public/vfx.js");
const sandbox = { window: {}, performance: { now: () => 0 }, setTimeout, clearTimeout, console };
vm.runInNewContext(vfxSource, sandbox);
const vfx = new sandbox.window.PondVFX({});
vfx.configure({ level: "ultra", particles: "ultra", visualQuality: "ultra", mapDecorations: true, isMobile: false });
const ultraParticles = vfx.maxParticles;
vfx.configure({ level: "low", particles: "low", visualQuality: "low", mapDecorations: false, isMobile: false });
const lowParticles = vfx.maxParticles;
assert.ok(ultraParticles >= lowParticles * 5, "Ultra particle cap must be visibly higher than Low");
vfx.configure({ level: "off", particles: "off" });
assert.strictEqual(vfx.maxParticles, 0, "Particles Off must remove the active cap");
assert.strictEqual(vfx.maxEffects, 0, "Effects Off must remove optional effects");

assert.strictEqual(release.CURRENT.title, "Settings & Graphics Fix", "Update 1.01 title must identify this fix");
console.log(`Settings & Graphics Fix test passed: Low ${lowParticles} particles, Ultra ${ultraParticles}, live manager/audio/render/FPS wiring verified.`);
