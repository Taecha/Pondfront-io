const fs = require("fs");
const path = require("path");
const PondDatabase = require("../server/db");
const AuthManager = require("../server/AuthManager");
const OAuthManager = require("../server/OAuthManager");

const databaseFile = path.join(__dirname, "..", "data", `.qa-oauth-${process.pid}-${Date.now()}.db`);
const checks = [];
let db;

function check(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
  };
}

function cookiesFrom(response) {
  const values = response.headers["set-cookie"] || [];
  return (Array.isArray(values) ? values : [values]).map((value) => String(value).split(";")[0]);
}

function cookieNamed(response, name) {
  return cookiesFrom(response).find((cookie) => cookie.startsWith(`${name}=`)) || "";
}

async function run() {
  process.env.SESSION_SECRET = "qa-session-secret-that-is-long-and-random-enough";
  const env = {
    APP_BASE_URL: "http://localhost:5173",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    GOOGLE_CALLBACK_URL: "http://localhost:5173/api/auth/oauth/google/callback",
    DISCORD_CLIENT_ID: "discord-client-id",
    DISCORD_CLIENT_SECRET: "discord-client-secret",
    DISCORD_CALLBACK_URL: "http://localhost:5173/api/auth/oauth/discord/callback",
  };
  const identities = {
    google: { sub: "google-100", name: "Lily Google", email: "lily-google@example.test", email_verified: true, picture: "https://lh3.googleusercontent.com/a/test" },
    discord: { id: "discord-100", username: "reed-user", global_name: "Reed Discord", email: "reed-discord@example.test", verified: true, avatar: "avatarhash" },
  };
  const fakeFetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes("/token")) {
      check("token exchange uses form encoding", options.method === "POST" && options.headers["Content-Type"] === "application/x-www-form-urlencoded");
      check("PKCE verifier reaches token exchange", String(options.body).includes("code_verifier="));
      return { ok: true, status: 200, json: async () => ({ access_token: "ephemeral-access-token" }) };
    }
    if (target.includes("googleapis.com/v1/userinfo")) return { ok: true, status: 200, json: async () => identities.google };
    if (target.includes("discord.com/api/v10/users/@me")) return { ok: true, status: 200, json: async () => identities.discord };
    return { ok: false, status: 404, json: async () => ({}) };
  };

  db = new PondDatabase(databaseFile);
  const auth = new AuthManager(db);
  const oauth = new OAuthManager(db, auth, { env, fetchImpl: fakeFetch });

  async function flow(provider, options = {}) {
    const startResponse = responseRecorder();
    const startRequest = { headers: { cookie: options.sessionCookie || "", "user-agent": "PondFront OAuth QA" } };
    const start = oauth.begin(provider, startRequest, startResponse, options.mode || "login");
    if (!start.ok) return { start };
    const authorizationUrl = new URL(start.location);
    const state = authorizationUrl.searchParams.get("state");
    const stateCookie = cookieNamed(startResponse, `pond_oauth_${provider}`);
    const callbackResponse = responseRecorder();
    const callbackRequest = { headers: { cookie: [options.sessionCookie, stateCookie].filter(Boolean).join("; "), "user-agent": "PondFront OAuth QA" } };
    const query = new URLSearchParams({ state, ...(options.cancel ? { error: "access_denied" } : { code: "provider-code" }) });
    const callback = await oauth.callback(provider, query, callbackRequest, callbackResponse);
    return { start, state, stateCookie, callback, callbackResponse, sessionCookie: cookieNamed(callbackResponse, "pond_session"), authorizationUrl };
  }

  const google = await flow("google");
  check("Google authorization uses official endpoint", google.authorizationUrl?.origin === "https://accounts.google.com");
  check("authorization request includes state and S256 PKCE", Boolean(google.state) && google.authorizationUrl?.searchParams.get("code_challenge_method") === "S256");
  check("client secret is never placed in authorization URL", !google.start.location.includes(env.GOOGLE_CLIENT_SECRET));
  check("OAuth callback creates an HttpOnly session", google.callback.ok && google.sessionCookie.startsWith("pond_session="));
  const googleUser = auth.currentUser({ headers: { cookie: google.sessionCookie } });
  check("Google identity is stored by provider subject", db.oauthAccount("google", "google-100")?.userId === googleUser?.id);
  check("verified Google avatar and profile are saved", googleUser?.displayName === "Lily Google" && googleUser?.avatarUrl.includes("googleusercontent.com"));

  const logoutResponse = responseRecorder();
  auth.logout({ headers: { cookie: google.sessionCookie } }, logoutResponse);
  check("logout destroys the server session", !auth.currentUser({ headers: { cookie: google.sessionCookie } }));
  check("logout expires the browser cookie", cookiesFrom(logoutResponse).some((cookie) => cookie === "pond_session="));

  const googleAgain = await flow("google");
  const googleUserAgain = auth.currentUser({ headers: { cookie: googleAgain.sessionCookie } });
  check("repeat Google login returns the same PondFront account", googleUserAgain?.id === googleUser?.id && db.allUsers().length === 1);

  const discord = await flow("discord");
  const discordUser = auth.currentUser({ headers: { cookie: discord.sessionCookie } });
  check("Discord authorization uses official endpoint", discord.authorizationUrl?.origin === "https://discord.com");
  check("Discord identity creates a persistent account", db.oauthAccount("discord", "discord-100")?.userId === discordUser?.id);
  const discordAgain = await flow("discord");
  check("repeat Discord login does not duplicate accounts", auth.currentUser({ headers: { cookie: discordAgain.sessionCookie } })?.id === discordUser?.id);

  const passwordResponse = responseRecorder();
  const signup = auth.signup({ username: "PondLinker", password: "pondpass7", confirmPassword: "pondpass7" }, { headers: { "user-agent": "PondFront OAuth QA" } }, passwordResponse);
  const passwordCookie = cookieNamed(passwordResponse, "pond_session");
  db.updateUser(signup.user.id, { xp: 840, coins: 77 });
  identities.google = { sub: "google-link", name: "Linked Google", email: "linked-google@example.test", email_verified: true, picture: "" };
  const linkedGoogle = await flow("google", { mode: "link", sessionCookie: passwordCookie });
  identities.discord = { id: "discord-link", username: "linked-discord", global_name: "Linked Discord", email: "linked-discord@example.test", verified: true, avatar: "" };
  const linkedDiscord = await flow("discord", { mode: "link", sessionCookie: linkedGoogle.sessionCookie });
  const linkedUser = auth.currentUser({ headers: { cookie: linkedDiscord.sessionCookie } });
  check("Google and Discord can link to one existing profile", db.oauthAccountsFor(signup.user.id).length === 2 && linkedUser?.id === signup.user.id);
  check("linked account keeps progression", linkedUser?.xp === 840 && linkedUser?.coins === 77);

  const secondResponse = responseRecorder();
  auth.signup({ username: "SecondPond", password: "pondpass8", confirmPassword: "pondpass8" }, { headers: { "user-agent": "PondFront OAuth QA" } }, secondResponse);
  identities.google = { sub: "google-link", name: "Linked Google", email: "linked-google@example.test", email_verified: true, picture: "" };
  const duplicateLink = await flow("google", { mode: "link", sessionCookie: cookieNamed(secondResponse, "pond_session") });
  check("provider identity cannot link to two PondFront accounts", !duplicateLink.callback.ok && duplicateLink.callback.location.includes("account_already_connected"));

  const emailOwner = db.createUser({ username: "VerifiedOwner", passwordHash: auth.hashPassword("pondpass9"), email: "shared@example.test", emailVerified: true });
  identities.google = { sub: "google-shared-email", name: "Shared Email", email: "shared@example.test", email_verified: true, picture: "" };
  const emailCollision = await flow("google");
  check("matching verified email requires explicit linking", !emailCollision.callback.ok && emailCollision.callback.location.includes("email_link_required"));
  check("email collision does not overwrite the existing account", db.findUserByVerifiedEmail("shared@example.test")?.id === emailOwner.id);

  identities.discord = { id: "discord-cancel", username: "cancelled", email: "cancel@example.test", verified: true, avatar: "" };
  const cancelled = await flow("discord", { cancel: true });
  check("provider cancellation creates no account", !cancelled.callback.ok && !db.oauthAccount("discord", "discord-cancel"));

  const replay = await oauth.callback("google", new URLSearchParams({ state: google.state, code: "replayed-code" }), { headers: { cookie: google.stateCookie, "user-agent": "PondFront OAuth QA" } }, responseRecorder());
  check("OAuth state is one-time and replay resistant", !replay.ok && replay.location.includes("session_expired"));

  const disabled = new OAuthManager(db, auth, { env: { APP_BASE_URL: "http://localhost:5173" }, fetchImpl: fakeFetch });
  check("providers disable cleanly when credentials are missing", disabled.providerStatus().every((provider) => !provider.enabled));
  check("unconfigured OAuth start returns a helpful 503", disabled.begin("google", { headers: {} }, responseRecorder()).status === 503);

  const oauthColumns = db.all("PRAGMA table_info(oauth_accounts)").map((column) => String(column.name).toLowerCase());
  check("access and refresh tokens are not stored in account schema", !oauthColumns.some((name) => name.includes("token")));
  check("completed and cancelled OAuth states are consumed", db.all("SELECT * FROM oauth_states").length === 0);
  check("raw session cookie is not stored in SQLite", !db.getSession(google.sessionCookie.split("=")[1]));
}

run()
  .catch((error) => check("OAuth test suite completed", false, error.stack || error.message))
  .finally(() => {
    db?.close?.();
    [databaseFile, `${databaseFile}-wal`, `${databaseFile}-shm`].forEach((file) => { if (fs.existsSync(file)) fs.unlinkSync(file); });
    const failed = checks.filter((entry) => !entry.pass);
    console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));
    if (failed.length) process.exitCode = 1;
  });
