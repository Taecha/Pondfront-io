const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

const tempDb = path.join(__dirname, "..", "data", `.qa-startup-${process.pid}-${Date.now()}.db`);
const baseEnv = { ...process.env, PONDFRONT_DB: tempDb };
delete baseEnv.GOOGLE_CLIENT_ID;
delete baseEnv.GOOGLE_CLIENT_SECRET;
delete baseEnv.DISCORD_CLIENT_ID;
delete baseEnv.DISCORD_CLIENT_SECRET;

const missingSecretEnv = { ...baseEnv, NODE_ENV: "production" };
delete missingSecretEnv.SESSION_SECRET;
const missingSecret = spawnSync(process.execPath, ["-e", "require('./server')"], { cwd: path.join(__dirname, ".."), env: missingSecretEnv, encoding: "utf8" });
check(
  "production refuses missing session secret",
  missingSecret.status !== 0 && `${missingSecret.stderr}${missingSecret.stdout}`.includes("SESSION_SECRET is required"),
  `exit ${missingSecret.status}`,
);

const optionalOAuthEnv = { ...baseEnv, NODE_ENV: "production", SESSION_SECRET: "qa-only-session-secret-at-least-32-bytes" };
const optionalOAuth = spawnSync(process.execPath, ["-e", "const s=require('./server'); console.log('loaded', Boolean(s.server))"], {
  cwd: path.join(__dirname, ".."),
  env: optionalOAuthEnv,
  encoding: "utf8",
});
check("missing optional OAuth configuration loads cleanly", optionalOAuth.status === 0 && optionalOAuth.stdout.includes("loaded true"), optionalOAuth.stderr.trim());

const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
check("HTTP request boundary returns generic error", source.includes("Promise.resolve(handleRequest(req, res)).catch") && source.includes("could not complete that request"));
check("all mutating API routes use same-origin validation", source.includes('req.method === "POST" && url.pathname.startsWith("/api/")'));
check("auth endpoints have bounded attempt limiting", source.includes("const authAttempts = new Map()") && source.includes("allowAuthAttempt") && source.includes("Too many login attempts"));

[tempDb, `${tempDb}-wal`, `${tempDb}-shm`].forEach((file) => {
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

const failed = checks.filter((entry) => !entry.pass);
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
if (failed.length) process.exitCode = 1;
