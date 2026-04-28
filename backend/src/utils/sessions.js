import { randomUUID } from "crypto";
import { pgQuery, isPgReady, tryPg } from "../config/postgres.js";

/**
 * Persistent chat session storage backed by Postgres.
 * Falls back gracefully (no-ops) when Postgres isn't ready, so the
 * application keeps working in pure in-memory mode.
 */

export function newSessionId() {
  return randomUUID();
}

export async function ensureSession({ sessionId, userId, title }) {
  if (!isPgReady()) return sessionId || newSessionId();
  const id = sessionId || newSessionId();
  await tryPg(() =>
    pgQuery(
      `INSERT INTO lifeos_chat_sessions (id, user_id, title)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW(),
         title = COALESCE(lifeos_chat_sessions.title, EXCLUDED.title)`,
      [id, userId || null, title || null]
    )
  );
  return id;
}

export async function appendMessage({ sessionId, role, content, userId }) {
  if (!isPgReady() || !sessionId || !content) return;
  await ensureSession({ sessionId, userId });
  await tryPg(() =>
    pgQuery(
      `INSERT INTO lifeos_chat_messages (session_id, role, content) VALUES ($1, $2, $3)`,
      [sessionId, role, content]
    )
  );
  await tryPg(() =>
    pgQuery(`UPDATE lifeos_chat_sessions SET updated_at = NOW() WHERE id = $1`, [sessionId])
  );
}

export async function listSessions({ userId, limit = 50 }) {
  if (!isPgReady()) return [];
  const result = await tryPg(
    () =>
      pgQuery(
        `SELECT s.id, s.title, s.created_at, s.updated_at,
                (SELECT content FROM lifeos_chat_messages m
                  WHERE m.session_id = s.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                (SELECT COUNT(*) FROM lifeos_chat_messages m WHERE m.session_id = s.id) AS message_count
           FROM lifeos_chat_sessions s
          WHERE ($1::text IS NULL OR s.user_id = $1)
          ORDER BY s.updated_at DESC
          LIMIT $2`,
        [userId || null, limit]
      ),
    { rows: [] }
  );
  return result?.rows || [];
}

export async function getSessionMessages({ sessionId, userId }) {
  if (!isPgReady()) return null;
  const sess = await tryPg(
    () =>
      pgQuery(
        `SELECT id, user_id, title, created_at, updated_at FROM lifeos_chat_sessions WHERE id = $1`,
        [sessionId]
      ),
    null
  );
  if (!sess?.rows?.length) return null;
  const session = sess.rows[0];
  if (userId && session.user_id && session.user_id !== userId) return null;

  const msgs = await tryPg(
    () =>
      pgQuery(
        `SELECT role, content, created_at FROM lifeos_chat_messages
          WHERE session_id = $1 ORDER BY created_at ASC`,
        [sessionId]
      ),
    { rows: [] }
  );
  return { session, messages: msgs.rows };
}
