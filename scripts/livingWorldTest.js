const assert = require("assert");
const fs = require("fs");
const path = require("path");
const atmosphere = require("../shared/worldAtmosphereConfig");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const phases = [0, 240, 720, 960].map((elapsed) => atmosphere.phaseAt(elapsed).id);
assert.deepStrictEqual(phases, ["sunrise", "day", "sunset", "night"], "day cycle phases should remain ordered");
assert.strictEqual(atmosphere.ambientWeatherAt(90, 2).id, atmosphere.ambientWeatherAt(90, 2).id, "weather must be deterministic");
assert.strictEqual(atmosphere.eventWeather({ type: "rainstorm" }).visual, "storm", "lake events should override ambient weather visuals");
assert.strictEqual(atmosphere.phaseAt(10, { cycleSeconds: 1200, startOffset: 0 }).id, "sunrise", "state atmosphere should use elapsed match time");

const livingWorld = read("public/livingWorld.js");
assert.match(livingWorld, /this\.pool = \[\]/, "living world should pool transient entities");
assert.match(livingWorld, /this\.profile\.entities/, "living world should cap entities by quality profile");
assert.match(livingWorld, /batterySaver/, "battery saver should disable living-world work");
assert.match(livingWorld, /strategicView/, "strategic view should remain uncluttered");
assert.match(livingWorld, /point\.x < -32/, "off-screen entities should be culled");

const html = read("public/index.html");
assert.match(html, /worldAtmosphereConfig\.js/, "atmosphere config should load in the browser");
assert.match(html, /livingWorld\.js/, "living-world renderer should load before the map renderer");
assert.match(html, /id="livingWorld"/, "living-world setting should be exposed");
assert.match(html, /id="cameraEffects"/, "camera-effect setting should be exposed");
assert.match(html, /data-right-panel-tab="world"/, "world activity tab should be reachable");

const ui = read("public/ui.js");
assert.match(ui, /updateWorldActivity\(state\)/, "world activity should refresh from match state");
assert.match(ui, /showMatchIntro\(state\)/, "match intro should be available");
assert.match(ui, /livingWorld: !batterySaver/, "view options should carry living-world preference");

const render = read("public/render.js");
assert.match(render, /const threatened =/, "animal leaders should react when their territory is threatened");
assert.match(render, /const victorious =/, "winning animal leaders should celebrate");

const audio = read("public/audioManager.js");
for (const channel of ["environmentVolume", "combatVolume", "animalVolume", "buildingVolume", "uiVolume"]) {
  assert.ok(audio.includes(channel), `audio mixer should include ${channel}`);
}
assert.match(audio, /spatialOptions\(event/, "map sounds should react to camera position and zoom");

console.log("Living world test passed: atmosphere, entity caps, settings, UI activity, and audio channels are wired.");
