/**
 * Auth controller — supports both Postgres (preferred) and MongoDB (legacy).
 *
 * Email/password: hashed with bcrypt, stored in lifeos_users (Postgres) or
 * User model (Mongo). Postgres is used when DATABASE_URL is configured
 * (standard on Replit). Mongo is used when MONGODB_URI is set.
 * Both paths can coexist — Postgres is checked first.
 */

import bcrypt from "bcryptjs";
import { isPgReady, pgQuery, tryPg } from "../config/postgres.js";
import { signToken } from "../utils/verifyToken.js";
import { processVoiceLogin } from "../utils/voiceLogin.js";

/* ── helpers ────────────────────────────────────────────────────────────── */

function pgUserId(email) {
  return `u_${Buffer.from(email.toLowerCase()).toString("base64url").slice(0, 22)}`;
}

async function tryMongoUser() {
  try {
    const { default: User } = await import("../models/User.js");
    return User;
  } catch {
    return null;
  }
}

/* ── POST /api/auth/register ────────────────────────────────────────────── */
export async function register(req, res) {
  try {
    const { name, email, password, bio } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalEmail  = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 10);

    // ── Postgres path ──────────────────────────────────────────────────────
    if (isPgReady()) {
      const existing = await tryPg(async () => {
        const r = await pgQuery("SELECT id FROM lifeos_users WHERE email = $1", [normalEmail]);
        return r.rows[0];
      });
      if (existing) return res.status(409).json({ error: "Email already registered" });

      const id  = pgUserId(normalEmail);
      const row = await tryPg(async () => {
        const r = await pgQuery(
          `INSERT INTO lifeos_users (id, email, name, password_hash, provider, bio, last_login_at)
           VALUES ($1, $2, $3, $4, 'email', $5::jsonb, NOW())
           RETURNING id, email, name`,
          [id, normalEmail, name?.trim() || null, passwordHash, JSON.stringify(bio || {})]
        );
        return r.rows[0];
      });
      if (!row) return res.status(500).json({ error: "Failed to create account" });

      const token = signToken({ id: row.id, email: row.email });
      return res.status(201).json({
        token,
        user: { id: row.id, email: row.email, name: row.name, tier: "free" },
      });
    }

    // ── Mongo path (legacy) ────────────────────────────────────────────────
    const User = await tryMongoUser();
    if (!User) return res.status(503).json({ error: "No database configured. Please contact support." });

    const existing = await User.findOne({ email: normalEmail });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const user  = await User.create({ name: name?.trim(), email: normalEmail, passwordHash });
    const token = signToken({ id: user._id.toString(), email: user.email });
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, tier: user.tier },
    });
  } catch (err) {
    console.error("[auth.register]", err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── POST /api/auth/login ───────────────────────────────────────────────── */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const normalEmail = email.toLowerCase().trim();

    // ── Postgres path ──────────────────────────────────────────────────────
    if (isPgReady()) {
      const row = await tryPg(async () => {
        const r = await pgQuery(
          "SELECT id, email, name, password_hash FROM lifeos_users WHERE email = $1",
          [normalEmail]
        );
        return r.rows[0];
      });

      if (row) {
        if (!row.password_hash) {
          return res.status(401).json({
            error: "This account uses Google sign-in. Please use 'Continue with Google'.",
          });
        }
        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return res.status(401).json({ error: "Invalid email or password" });

        await tryPg(async () =>
          pgQuery("UPDATE lifeos_users SET last_login_at = NOW() WHERE id = $1", [row.id])
        );

        const token = signToken({ id: row.id, email: row.email });
        return res.json({ token, user: { id: row.id, email: row.email, name: row.name, tier: "free" } });
      }
      // No Postgres row — fall through to Mongo (migration support)
    }

    // ── Mongo path (legacy) ────────────────────────────────────────────────
    const User = await tryMongoUser();
    if (!User) {
      return res.status(401).json({ error: "Account not found. Please create an account first." });
    }
    const user = await User.findOne({ email: normalEmail });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    user.lastLoginAt = new Date();
    await user.save().catch(() => {});

    const token = signToken({ id: user._id.toString(), email: user.email });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, tier: user.tier } });
  } catch (err) {
    console.error("[auth.login]", err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── POST /api/auth/voice-login ─────────────────────────────────────────── */
export async function voiceLogin(req, res) {
  try {
    const file  = req.file;
    const email = req.body?.email?.toLowerCase()?.trim();
    if (!file)  return res.status(400).json({ error: "audio file is required (field: audio)" });
    if (!email) return res.status(400).json({ error: "email is required" });

    const { transcript, voicePrintId } = await processVoiceLogin(file);

    const User = await tryMongoUser();
    if (!User) return res.status(503).json({ error: "Voice login requires MongoDB. Use email login instead." });

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, voicePrintId });
    } else if (!user.voicePrintId) {
      user.voicePrintId = voicePrintId;
      await user.save();
    } else if (user.voicePrintId !== voicePrintId) {
      return res.status(401).json({ error: "Voice print does not match this account", transcript });
    }
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ id: user._id.toString(), email: user.email });
    return res.json({ token, transcript, user: { id: user._id, name: user.name, email: user.email, tier: user.tier } });
  } catch (err) {
    console.error("[auth.voiceLogin]", err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── POST /api/auth/google ──────────────────────────────────────────────── */
export async function googleSignIn(req, res) {
  try {
    const email    = String(req.body?.email    || "").trim().toLowerCase();
    const rawName  = String(req.body?.name     || "").trim();
    const photoUrl = String(req.body?.photoUrl || "").trim() || null;
    const bio      = req.body?.bio && typeof req.body.bio === "object" ? req.body.bio : {};

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!rawName) {
      return res.status(400).json({ error: "Name is required for Google sign-in." });
    }

    // ── Postgres path ──────────────────────────────────────────────────────
    if (isPgReady()) {
      const id  = `g_${Buffer.from(email).toString("base64url").slice(0, 22)}`;
      const existing = await pgQuery("SELECT id, email, name, photo_url, bio FROM lifeos_users WHERE email = $1", [email]);
      let row;
      if (existing.rows.length === 0) {
        const ins = await pgQuery(
          `INSERT INTO lifeos_users (id, email, name, photo_url, provider, bio, last_login_at)
           VALUES ($1, $2, $3, $4, 'google', $5::jsonb, NOW())
           RETURNING id, email, name, photo_url, bio`,
          [id, email, rawName || email.split("@")[0], photoUrl, JSON.stringify(bio)]
        );
        row = ins.rows[0];
      } else {
        const merged  = { ...(existing.rows[0].bio || {}), ...bio };
        const upd = await pgQuery(
          `UPDATE lifeos_users
              SET name = COALESCE(NULLIF($2,''), name),
                  photo_url = COALESCE($3, photo_url),
                  bio = $4::jsonb,
                  last_login_at = NOW()
            WHERE email = $1
            RETURNING id, email, name, photo_url, bio`,
          [email, rawName, photoUrl, JSON.stringify(merged)]
        );
        row = upd.rows[0];
      }
      const token = signToken({ id: row.id, email: row.email });
      return res.json({
        token,
        user: { id: row.id, email: row.email, name: row.name, photoUrl: row.photo_url, bio: row.bio, tier: "free" },
      });
    }

    // ── Mongo path (legacy) ────────────────────────────────────────────────
    try {
      const User = await tryMongoUser();
      if (!User) throw new Error("no mongo");
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ name: rawName || email.split("@")[0], email, tier: "free" });
      } else {
        if (rawName) user.name = rawName;
        user.lastLoginAt = new Date();
        await user.save().catch(() => {});
      }
      const token = signToken({ id: user._id.toString(), email: user.email });
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, photoUrl, bio, tier: user.tier } });
    } catch {
      const token = signToken({ id: `guest_${email}`, email });
      return res.json({
        token,
        user: { id: `guest_${email}`, name: rawName || email.split("@")[0], email, photoUrl, bio, tier: "guest" },
        notice: "Connected (no database — your data lives in this session).",
      });
    }
  } catch (err) {
    console.error("[auth.googleSignIn]", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export const demoGoogleLogin = googleSignIn;

/* ── GET /api/auth/me ───────────────────────────────────────────────────── */
export async function me(req, res) {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    // Postgres
    if (isPgReady()) {
      const row = await tryPg(async () => {
        const r = await pgQuery("SELECT id, email, name, photo_url, bio FROM lifeos_users WHERE id = $1", [uid]);
        return r.rows[0];
      });
      if (row) {
        return res.json({ user: { id: row.id, email: row.email, name: row.name, photoUrl: row.photo_url, bio: row.bio } });
      }
    }

    // Mongo fallback
    try {
      const User = await tryMongoUser();
      if (User) {
        const user = await User.findById(uid).select("-passwordHash");
        if (user) return res.json({ user });
      }
    } catch { /* ignore */ }

    return res.status(404).json({ error: "User not found" });
  } catch (err) {
    console.error("[auth.me]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
