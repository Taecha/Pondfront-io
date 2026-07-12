const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const port = 5190 + (process.pid % 200);
const origin = `http://localhost:${port}`;
const databaseFile = path.join(root, "data", `.qa-http-${process.pid}-${Date.now()}.db`);
const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function waitForServer(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("QA server startup timed out.")), timeoutMs);
    const onData = (chunk) => {
      const text = String(chunk);
      if (!text.includes("server running")) return;
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      resolve();
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`QA server exited early (${code}).`));
    });
  });
}

async function request(pathname, options = {}) {
  return fetch(`${origin}${pathname}`, options);
}

(async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      SESSION_SECRET: "isolated-qa-session-secret-at-least-32-bytes",
      APP_BASE_URL: origin,
      TRUST_PROXY: "1",
      PONDFRONT_DB: databaseFile,
      PONDFRONT_SILENT_MAP_LOGS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  try {
    await waitForServer(child);
    const health = await request("/health");
    check("production health endpoint responds", health.status === 200 && (await health.json()).ok);
    check(
      "baseline security headers are present",
      health.headers.get("x-content-type-options") === "nosniff" &&
        health.headers.get("x-frame-options") === "DENY" &&
        health.headers.get("strict-transport-security")?.includes("max-age="),
    );

    const signup = await request("/api/auth/signup", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: `HttpQA${process.pid}`, password: "pondpass7", confirmPassword: "pondpass7" }),
    });
    const cookie = signup.headers.get("set-cookie") || "";
    check("production session cookie is hardened", signup.status === 200 && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie) && /Secure/i.test(cookie), cookie.replace(/pond_session=[^;]+/, "pond_session=<redacted>"));

    const crossOrigin = await request("/api/lobby/create", {
      method: "POST",
      headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" },
      body: "{}",
    });
    check("cross-origin mutating API request is rejected", crossOrigin.status === 403);

    let throttledStatus = 0;
    for (let index = 0; index < 17; index += 1) {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.42" },
        body: JSON.stringify({ username: "missing-user", password: "wrong-password" }),
      });
      throttledStatus = login.status;
    }
    check("login attempts are rate limited", throttledStatus === 429, `status ${throttledStatus}`);

    const providers = await request("/api/auth/providers");
    const providerState = await providers.json();
    const providerRows = providerState.providers || [];
    check("missing OAuth providers disable cleanly", providers.status === 200 && providerRows.length === 2 && providerRows.every((provider) => provider.enabled === false));
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    [databaseFile, `${databaseFile}-wal`, `${databaseFile}-shm`].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }

  const failed = checks.filter((entry) => !entry.pass);
  console.log(JSON.stringify({ ok: failed.length === 0, failed, checks, stderr: stderr.includes("SESSION_SECRET") ? "unexpected secret error" : "clean" }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
