/**
 * Shared helpers for Aurora backend test scripts.
 *
 * Run any script from the backend/ directory:
 *   node tests/test-ai-chat.js
 *
 * The backend must be running on $TEST_API_URL (default http://localhost:3001).
 * Tests print colored OK/FAIL lines; exit code is non-zero on the first failure.
 */
import "dotenv/config";

export const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

export const log = {
  step: (msg) => console.log(`${CYAN}▸ ${msg}${RESET}`),
  ok: (msg) => console.log(`${GREEN}✓ ${msg}${RESET}`),
  fail: (msg) => console.log(`${RED}✗ ${msg}${RESET}`),
  info: (msg) => console.log(`${DIM}  ${msg}${RESET}`),
};

export async function api(path, init = {}, token) {
  const headers = { ...(init.headers || {}) };
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: res.status, ok: res.ok, data };
}

export async function ensureBackend() {
  try {
    const { ok } = await api("/api/health");
    if (!ok) throw new Error("health check failed");
  } catch (err) {
    log.fail(`Backend unreachable at ${API_URL} — ${err.message}`);
    log.info("Start it with:  cd backend && npm run dev");
    process.exit(2);
  }
}

export class DbUnavailableError extends Error {
  constructor(detail) {
    super(`MongoDB unavailable: ${detail}`);
    this.name = "DbUnavailableError";
  }
}

function isDbUnavailable(payload) {
  const s = JSON.stringify(payload || "");
  return /buffering timed out|MONGODB_URI|MongoNetworkError|ECONNREFUSED|ENOTFOUND|MongooseServerSelection/i.test(s);
}

export async function ensureUser(emailPrefix = "tester") {
  const email = `${emailPrefix}+${Date.now()}@aurora.test`;
  const password = "AuroraTest!42";
  const reg = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Aurora Tester", email, password }),
  });
  if (!reg.ok) {
    if (reg.status === 409) {
      const login = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!login.ok) {
        if (isDbUnavailable(login.data)) throw new DbUnavailableError(summarize(login.data));
        throw new Error(`login failed: ${JSON.stringify(login.data)}`);
      }
      return { token: login.data.token, user: login.data.user };
    }
    if (isDbUnavailable(reg.data)) throw new DbUnavailableError(summarize(reg.data));
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.data)}`);
  }
  return { token: reg.data.token, user: reg.data.user };
}

/** Wrap a test body so that a missing MongoDB connection logs a SKIP and exits 0. */
export async function runTest(name, fn) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      log.info(`SKIP ${name}: ${err.message}`);
      log.info("Set MONGODB_URI in backend/.env to run the full DB-backed flow.");
      return;
    }
    log.fail(`${name} threw: ${err.message}`);
    process.exitCode = 1;
  }
}

export function expect(name, cond, detail = "") {
  if (cond) {
    log.ok(name);
    if (detail) log.info(detail);
    return true;
  }
  log.fail(name);
  if (detail) log.info(detail);
  process.exitCode = 1;
  return false;
}

export function summarize(data, max = 240) {
  const s = typeof data === "string" ? data : JSON.stringify(data);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
