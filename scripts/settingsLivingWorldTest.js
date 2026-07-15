const assert = require("assert");
const fs = require("fs");
const path = require("path");
const settings = require("../shared/settingsConfig");
const world = require("../shared/worldAtmosphereConfig");
const release = require("../shared/releaseConfig");
const { PondFrontServerGame } = require("../server");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

assert.strictEqual(settings.VERSION, 2, "settings state must be versioned");
assert.strictEqual(settings.DEFAULTS.adaptiveQuality, false, "Adaptive Quality must be opt-in");
assert.deepStrictEqual(settings.parseDocument("broken").values, settings.sanitize(settings.DEFAULTS), "bad imports must restore safe defaults");
assert.strictEqual(settings.sanitize({ masterVolume: 8 }).masterVolume, 1, "volume imports must be clamped");

const ordered = [0, 0.2, 0.6, 0.8].map((progress) => world.phaseAt(progress * world.DEFAULT_CYCLE_SECONDS, { cycleSeconds: world.DEFAULT_CYCLE_SECONDS }).id);
assert.deepStrictEqual(ordered, ["sunrise", "day", "sunset", "night"], "world phases must remain in order");
const publicWorld = world.sanitizeWorldSettings({ phaseMode: "night", seasonMode: "winter", cycleSeconds: 960 }, {});
assert.strictEqual(publicWorld.phaseMode, "cycle", "public matches must use the standard cycle");
assert.strictEqual(publicWorld.seasonMode, "random", "public matches must choose a fair random season");
const customWorld = world.sanitizeWorldSettings({ phaseMode: "night", seasonMode: "winter", cycleSeconds: 960 }, { privateMatch: true });
assert.strictEqual(customWorld.phaseMode, "night", "private hosts may fix the time phase");
assert.strictEqual(customWorld.seasonMode, "winter", "private hosts may fix the season");
const nightWinter = world.modifiersFor("night", "winter", true);
assert.strictEqual(nightWinter.territoryDefense, 0.09, "night and winter defense should stack fairly");
assert.ok(nightWinter.territoryDefense <= world.CAPS.defense, "defense must respect its cap");
assert.ok(world.modifiersFor("sunrise", "spring", true).constructionSpeed <= world.CAPS.construction, "construction must respect its cap");
assert.ok(world.modifiersFor("day", "spring", true).farmIncome <= world.CAPS.income, "income must respect its cap");

const game = new PondFrontServerGame({ skipInitialReset: true });
game.reset("duck", "easy", {
  skipSpawnSelection: true,
  privateMatch: true,
  mapSize: "small",
  allowBots: false,
  botCount: 0,
  world: { phaseMode: "day", seasonMode: "spring", gameplayImpacts: true, weatherFrequency: "off" },
});
const snapshot = game.snapshot();
assert.strictEqual(snapshot.worldState.phase.id, "day", "server snapshot must own the selected phase");
assert.strictEqual(snapshot.worldState.season.id, "spring", "server snapshot must own the selected season");
assert.ok(snapshot.worldState.modifiers.farmIncome > 0, "server snapshot must expose applied world effects");
const human = game.getPlayer(snapshot.humanId);
assert.ok(human.flags.worldBuildTimeMultiplier < 1, "server construction previews must include the current world speed");

const html = read("public/index.html");
for (const id of ["settingsSearch", "settingsCategorySelect", "settingsApplyButton", "settingsCancelButton", "settingsRestoreButton", "settingsExportButton", "settingsImportButton", "worldStatusPanel"]) {
  assert.ok(html.includes(`id="${id}"`), `${id} must exist`);
}
assert.strictEqual((html.match(/class="settings-content-scroll"/g) || []).length, 1, "Settings must have exactly one content scroller");
assert.ok(html.indexOf("/shared/settingsConfig.js") < html.indexOf("./settingsManager.js"), "shared settings config must load before its manager");

const manager = read("public/settingsManager.js");
assert.match(manager, /this\.draft/, "settings must use a draft state");
assert.match(manager, /settings applied/i, "Apply must commit settings explicitly");
assert.match(manager, /closeWithCancel/, "closing settings must discard the draft");
const css = read("public/style.css");
assert.match(css, /height:\s*100dvh/, "mobile settings must use dynamic viewport height");
assert.match(css, /\.settings-content-scroll[\s\S]*overflow-y:\s*auto/, "the content region must own scrolling");
const serverText = read("server.js");
assert.match(serverText, /worldState:\s*this\.world\?\.snapshot/, "full snapshots must include authoritative world state");
assert.match(serverText, /worldState:\s*match\.world\?\.snapshot/g, "delta snapshots must include authoritative world state");
assert.ok(release.HISTORY.some((entry) => entry.label === "Update 1.01"), "release history must retain Update 1.01");

console.log("Update 1.01 test passed: settings draft/apply flow, responsive scroller, authoritative world state, caps, and release metadata are wired.");
