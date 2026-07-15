const fs = require("fs");
const path = require("path");
const pointerMath = require("../shared/pointerMath");
const PondActions = require("../shared/actionConfig");

const root = path.join(__dirname, "..");
const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

const sizes = [
  [360, 640, 2],
  [390, 844, 3],
  [412, 915, 2.625],
  [640, 360, 2],
  [844, 390, 2],
  [768, 1024, 2],
  [1024, 768, 1.5],
];

sizes.forEach(([width, height, dpr]) => {
  const metrics = {
    rect: { left: 7, top: 49, width, height: height - 49 },
    backingWidth: width * dpr,
    backingHeight: (height - 49) * dpr,
    dpr,
  };
  const camera = { x: 1092, y: 684, zoom: width < height ? 0.72 : 1.18 };
  const world = { x: 936, y: 598 };
  const client = pointerMath.worldPointToClient(world.x, world.y, metrics, camera);
  const restored = pointerMath.screenPointToWorld(client.x, client.y, metrics, camera);
  check(`${width}x${height} canonical pointer round trip`, Math.abs(restored.x - world.x) < 0.001 && Math.abs(restored.y - world.y) < 0.001, `${restored.x.toFixed(2)},${restored.y.toFixed(2)}`);
});

const gameSource = fs.readFileSync(path.join(root, "public", "game.js"), "utf8");
const mobileSource = fs.readFileSync(path.join(root, "public", "mobileControls.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

check("touch panning starts only after movement threshold", gameSource.includes('(event.pointerType === "touch" && this.pointer.moved)'));
check("mobile double tap keeps its configurable action-menu behavior", gameSource.includes('doubleTap || "actions"') && gameSource.includes('event?.pointerType !== "touch"'));
check("desktop double click uses Expand on a valid neutral border", /!tile\.owner && context\.canExpand[\s\S]{0,180}handleAction\(\{ type: "expand"/.test(gameSource));
check("desktop double click uses Reinforce on a valid owned border", /tile\.owner === this\.state\.humanId && context\.canDefend[\s\S]{0,180}handleAction\(\{ type: "defend"/.test(gameSource));
check("desktop double click attacks a valid connected enemy border", /tile\.owner && tile\.owner !== this\.state\.humanId && context\.canAttack[\s\S]{0,180}handleAction\(\{ type: "attack"/.test(gameSource));
check("mobile action dock caps primary actions at four", mobileSource.includes(".slice(0, 4)"));
check("mobile dock uses shared available actions", mobileSource.includes("context.availableActions"));
check("targeted actions require mobile confirmation", gameSource.includes("confirmMobileTarget") && gameSource.includes("Target adjusted"));
check("local target snapping is limited", gameSource.includes("nearbyValidTarget(tile, predicate, radius = 1)"));
check("mobile layout modes include portrait, landscape, and tablet", mobileSource.includes('"phone-portrait"') && mobileSource.includes('"phone-landscape"') && mobileSource.includes('"tablet"'));
check("safe areas protect top and bottom controls", css.includes("safe-area-inset-top") && css.includes("safe-area-inset-bottom") && css.includes("safe-area-inset-left") && css.includes("safe-area-inset-right"));
check("mobile settings include handedness and battery saver", html.includes('id="mobileDockSide"') && html.includes('id="batterySaver"') && html.includes('id="fpsLimit"'));
check("auth inputs use mobile no-zoom sizing", css.includes("body.touch-layout .auth-form input") && css.includes("font-size: 16px"));
check("desktop mobile controls default hidden", css.includes(".mobile-touch-dock") && css.includes("display: none"));

const player = { id: "p0", animal: "duck", energy: 100, buildings: {}, abilityReadyAt: 0, specialCooldowns: {}, specialStatus: {} };
const state = {
  phase: "PLAYING",
  serverTime: 100,
  players: [player, { id: "p1", name: "Rival" }],
  config: {
    tileTypes: { water: { label: "Open Water" } },
    buildings: { lilyFarm: { label: "Lily Farm", cost: 40 } },
    specials: { lilyBarrage: { label: "Lily Barrage", cost: 120 } },
  },
};
const neutral = PondActions.getAvailableTileActions({ state, player, tile: { id: 1, type: "water", owner: null }, context: { canExpand: true }, helpers: { isBlocked: () => false } });
check("mobile resolver exposes five shared neutral sends", neutral.actions.filter((action) => action.id === "expand").length === 5);

checks.forEach((entry) => console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.name}${entry.detail ? ` - ${entry.detail}` : ""}`));
const failed = checks.filter((entry) => !entry.pass);
if (failed.length) process.exitCode = 1;
else console.log(`PASS mobile-first regression (${checks.length} checks)`);
