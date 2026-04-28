import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

let pool = null;
let pgReady = false;

export function getPool() {
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => console.warn("[pg] idle client error:", err.message));
  }
  return pool;
}

export function isPgReady() {
  return pgReady;
}

export async function pgQuery(text, params) {
  const p = getPool();
  if (!p) throw new Error("Postgres not configured (DATABASE_URL missing)");
  return p.query(text, params);
}

export async function tryPg(fn, fallback = null) {
  if (!pgReady) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn("[pg] op failed:", err.message);
    return fallback;
  }
}

export async function initPostgres() {
  if (!connectionString) {
    console.warn("[pg] DATABASE_URL not set — persistent storage disabled (memory only).");
    return false;
  }
  try {
    const p = getPool();
    await p.query("SELECT 1");

    await p.query(`
      CREATE TABLE IF NOT EXISTS lifeos_users (
        id           TEXT PRIMARY KEY,
        email        TEXT UNIQUE NOT NULL,
        name         TEXT,
        photo_url    TEXT,
        provider     TEXT NOT NULL DEFAULT 'google',
        bio          JSONB DEFAULT '{}'::jsonb,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS lifeos_chat_sessions (
        id          TEXT PRIMARY KEY,
        user_id     TEXT,
        title       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lifeos_chat_messages (
        id         BIGSERIAL PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES lifeos_chat_sessions(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS lifeos_chat_messages_session_idx
        ON lifeos_chat_messages (session_id, created_at);

      CREATE TABLE IF NOT EXISTS lifeos_onboarding (
        user_id     TEXT PRIMARY KEY,
        step        INT NOT NULL DEFAULT 0,
        answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
        profile     JSONB,
        completed   BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lifeos_explore_reports (
        id         BIGSERIAL PRIMARY KEY,
        user_id    TEXT,
        report     JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    pgReady = true;
    console.log("[pg] connected and schema initialized.");
    return true;
  } catch (err) {
    console.warn("[pg] init failed:", err.message);
    pgReady = false;
    return false;
  }
}
