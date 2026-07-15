const assert = require("assert");
const fs = require("fs");
const path = require("path");

const originalLog = console.log;
console.log = () => {};
const { PondFrontServerGame } = require("../server");
const SupportManager = require("../server/SupportManager");
console.log = originalLog;

const combat = require("../shared/combatConfig");
const actions = require("../shared/actionConfig");
const release = require("../shared/releaseConfig");

const root = path.join(__dirname, "..");
const expectedPercents = [0.1, 0.25, 0.5, 0.75, 1];
assert.deepStrictEqual(combat.sendProfiles.map((profile) => profile.percent), expectedPercents, "combat send profiles must expose all five percentages");
assert.deepStrictEqual(actions.PERCENTS.map((profile) => profile.value), expectedPercents, "context actions must derive the same five percentages");
assert.strictEqual(combat.attackStyles.probe.label, "Probe", "10% attack must have a clear shared label");
assert.strictEqual(combat.attackStyles.wave.percent, 0.75, "Full Wave must remain the 75% profile");

const player = { id: "human", animal: "duck", energy: 100, buildings: {}, abilityReadyAt: 0, specialStatus: {} };
const state = {
  phase: "PLAYING",
  serverTime: 100,
  config: { balance: { defendSpendMultiplier: 0.78 }, buildings: {}, specials: {}, tileTypes: { water: { label: "Open Water" } } },
};
const ownActions = actions.getAvailableTileActions({
  state,
  player,
  tile: { id: 1, type: "water", owner: "human", defenseEnergy: 0 },
  context: { canDefend: true },
  helpers: { isBlocked: () => false },
});
const defend25 = ownActions.actions.find((entry) => entry.id === "defend" && entry.payload.percent === 0.25);
assert.strictEqual(defend25.cost, 20, "defense preview must use the authoritative rounded 78% spend multiplier");
assert.ok(defend25.hint.includes("20 Animal Energy"), "defense action must explain its rounded visible cost");

const game = new PondFrontServerGame({ skipInitialReset: true });
game.reset("duck", "easy", { mapSize: "small", botCount: 2, privateMatch: true, skipSpawnSelection: true });
const human = game.players.find((candidate) => !candidate.isBot);
const border = game.tileManager.borders(human.id)[0];
human.energy = 100;
human.defendCooldownUntil = 0;
const beforeDefend = human.energy;
const energyUsedBefore = human.stats.energyUsed;
const authoritativeDefendPreview = actions.defendPreview({ config: { balance: game.snapshot(human.id).config.balance }, serverTime: game.now() }, human, border, 0.25, game.now());
const defendResult = game.handleAction({ type: "defend", playerId: human.id, tileId: border.id, percent: 0.25, clientActionId: "update2-defend" });
assert.ok(defendResult.ok, `authoritative defend should succeed: ${defendResult.message}`);
assert.strictEqual(defendResult.spentEnergy, defend25.cost, "defend acknowledgement must return the exact displayed cost");
assert.strictEqual(defendResult.defenseEnergy, authoritativeDefendPreview.total, "shared defense preview must equal the authoritative stored-defense result");
assert.ok(Math.abs((human.stats.energyUsed - energyUsedBefore) - defend25.cost) < 0.001, "shown defense cost must equal authoritative energy-used accounting");
assert.ok(beforeDefend - human.energy <= defend25.cost, "mission rewards may offset the spend but must never increase its authoritative cost");

human.defendCooldownUntil = 0;
const beforeInvalid = human.energy;
const invalidPercent = game.handleAction({ type: "defend", playerId: human.id, tileId: border.id, percent: 0.33, clientActionId: "update2-invalid" });
assert.strictEqual(invalidPercent.resultType, "invalidPercent", "modified clients must not send unsupported percentages");
assert.strictEqual(human.energy, beforeInvalid, "rejected percentages must not deduct energy");

const supportActor = { id: "supporter", name: "Supporter", energy: 101, defeated: false, supportReadyAt: 0, stats: {} };
const supportTarget = { id: "ally", name: "Ally", energy: 0, maxEnergy: 200, defeated: false, stats: {} };
const support = new SupportManager(() => {});
const supportResult = support.send({ now: () => 100, getPlayer: (id) => id === supportTarget.id ? supportTarget : null, diplomacy: { areAllied: () => true } }, supportActor, supportTarget.id, 0.25);
assert.ok(supportResult.ok, "shared 25% ally support must succeed when affordable");
assert.strictEqual(supportResult.sent, combat.energyForPercent(101, 0.25), "support acknowledgement must match the shared rounded send");
assert.strictEqual(supportActor.energy, 76, "support must deduct the exact displayed 25 energy");

const neutral = actions.getAvailableTileActions({
  state,
  player,
  tile: { id: 2, type: "water", owner: null },
  context: { canExpand: true, expansionRemaining: 12 },
  helpers: { isBlocked: () => false },
});
assert.strictEqual(neutral.actions.filter((entry) => entry.id === "expand").length, 5, "neutral menu must expose five sends");
assert.ok(neutral.actions.find((entry) => entry.id === "expand").hint.includes("needs about 12"), "expansion actions must show pressure context");

const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const desktopAttackButtons = (html.match(/data-attack-style=/g) || []).length;
const mobileAttackButtons = (html.match(/data-mobile-attack=/g) || []).length;
assert.strictEqual(desktopAttackButtons, 5, "desktop attack selector must expose five profiles");
assert.strictEqual(mobileAttackButtons, 5, "mobile attack selector must expose five profiles");
assert.strictEqual(release.CURRENT.version, "2.0.0", "release metadata must identify Update 2.0.0");
assert.strictEqual(release.CURRENT.title, "The Great Lake Update", "release title must identify The Great Lake Update");

console.log("PASS Update 2 Great Lake regression (22 checks)");
