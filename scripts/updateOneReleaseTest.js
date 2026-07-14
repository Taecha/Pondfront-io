const assert = require("assert");
const fs = require("fs");
const path = require("path");
const release = require("../shared/releaseConfig");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));

assert.strictEqual(release.CURRENT.label, "Update 1.01", "current public label must be Update 1.01");
assert.ok(release.HISTORY.some((entry) => entry.label === "Update 1"), "Update 1 must remain in release history");
assert.strictEqual(release.CURRENT.version, pkg.version, "shared and package versions must match");
assert.strictEqual(release.updateLabel(1, 1), "Update 1.01", "future patch labels must be supported");
assert.strictEqual(release.updateLabel(1, 4), "Update 1.04", "future patch labels must remain zero-padded");
for (const key of ["new", "improved", "balance", "fixed", "knownIssues"]) {
  assert.ok(Array.isArray(release.CURRENT[key]) && release.CURRENT[key].length, `${key} release notes must be populated`);
}
assert.ok(new Set(release.TIPS).size === release.TIPS.length && release.TIPS.length >= 6, "loading tips must be varied and unique");

const html = read("public/index.html");
for (const id of ["launchScreen", "lobbyServerStatus", "lobbyUpdatesButton", "lobbyCreditsButton", "lobbySettingsButton", "releaseModal", "newUpdateBadge", "resetTutorialButton"]) {
  assert.ok(html.includes(`id="${id}"`), `${id} must be reachable in the release UI`);
}
for (const control of ["masterVolume", "musicVolume", "ambientVolume", "animalVolume", "combatVolume", "buildingVolume", "uiVolume", "backgroundAudio", "reducedSound", "audioQuality"]) {
  assert.ok(html.includes(`id="${control}"`), `${control} must exist in audio settings`);
}
assert.ok(html.indexOf("/shared/releaseConfig.js") < html.indexOf("./releaseUI.js"), "release config must load before release UI");

const releaseUI = read("public/releaseUI.js");
assert.match(releaseUI, /VIEWED_STORAGE_KEY/, "update viewed state must be persisted");
assert.match(releaseUI, /sessionStorage\.getItem\("pondfront:last-loading-tip"\)/, "loading tips must avoid immediate repeats");
assert.match(releaseUI, /fetch\("\/health"/, "launch and lobby must report real server health");

const audio = read("public/audioManager.js");
for (const feature of ["buildingVolume", "backgroundAudio", "reducedSound", "audioQuality", "activeVoices", "startAmbientLife", "spatialOptions"]) {
  assert.ok(audio.includes(feature), `audio manager must include ${feature}`);
}
for (const sound of ["selectDuck", "selectSnake", "selectFrog", "selectTurtle", "selectCarp", "ambientWater", "ambientReeds", "ambientRain", "retreat"]) {
  assert.ok(audio.includes(sound), `${sound} sound identity must be wired`);
}

const server = read("server.js");
assert.match(server, /version: releaseConfig\.CURRENT\.version/, "health response must use shared release version");
assert.match(server, /update: releaseConfig\.CURRENT\.label/, "health response must use shared update label");

const readme = read("README.md");
assert.doesNotMatch(readme, /prototype|early[- ]access|\bbeta\b/i, "public README must not use prerelease wording");

console.log("Update 1 release test passed: metadata, loading, updates, tutorial access, mixer controls, audio limits, and future labels are wired.");
